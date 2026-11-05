"""The only thing that knows where garments live: MongoDB and the R2 bucket.

The pipeline writes directly. The database's validators (the webapp's
`scripts/setup-db.mjs`) enforce the garment shape, so a document that breaks
it is refused and recorded as a failure. Two rules are enforced here rather
than trusted from the caller:

- **Human-reviewed garments keep their fields.** A re-scrape may refresh only
  `lastSeenAt`, `lastRunId`, `contentHash` and append new images.
- **Published garments are never demoted.** Only an admin, or unpublish by
  run, does that.

Images are converted to WebP here (quality 85, at most 2560 px, as the
webapp does) and stored as `<imageGroupId>/<uuid>.webp`.
"""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import boto3
import httpx
from bson import ObjectId
from PIL import Image
from pymongo import MongoClient

from ingest.config import Config
from ingest.normalize.vocabulary import Vocabulary

MAX_SIDE = 2560
WEBP_QUALITY = 85

# Every classification field a new garment starts with.
EMPTY_FIELDS: dict[str, Any] = {
    "gender": None,
    "model": None,
    "material": None,
    "color": None,
    "type": None,
    "category": None,
    "procedure": [],
    "process": [],
    "extras": [],
}


@dataclass(frozen=True)
class ExistingGarment:
    """One garment of a source, for change detection."""

    id: str
    site_key: str
    content_hash: str | None
    status: str
    human_reviewed: bool
    #: Source URLs already copied into R2, so we never fetch them twice.
    image_source_urls: frozenset[str] = frozenset()
    #: Total images on the garment, including any predating the pipeline.
    image_count: int = 0

    @property
    def images_matchable(self) -> bool:
        """Whether every image on the garment can be traced to a source URL.

        False for anything the old JS importer created: those images have no
        sourceUrl, so a source image cannot be checked against them and
        copying would duplicate the whole set.
        """
        return self.image_count == len(self.image_source_urls)


def _now() -> datetime:
    return datetime.now(UTC)


class Store:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._mongo = MongoClient(config.mongodb_url)
        self.db = self._mongo[config.db_name]
        self._s3 = boto3.client(
            "s3",
            endpoint_url=config.r2_endpoint,
            aws_access_key_id=config.r2_access_key_id,
            aws_secret_access_key=config.r2_secret_access_key,
            region_name="auto",
        )
        self._system_user: str | None = None

    def close(self) -> None:
        self._mongo.close()

    def __enter__(self) -> Store:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- reads -------------------------------------------------------------

    def vocabulary(self) -> Vocabulary:
        return Vocabulary.from_db(self.db)

    def system_user_id(self) -> str:
        """The user pipeline garments are attributed to: the one every
        existing pipeline garment already has."""
        if self._system_user is None:
            users = self.db.garments.distinct(
                "uploadedByUserId", {"ingest.source": {"$exists": True}}
            )
            if len(users) != 1:
                raise RuntimeError(f"Expected one pipeline user, found {users}")
            self._system_user = users[0]
        return self._system_user

    def existing(self, source: str) -> dict[str, ExistingGarment]:
        """Every garment of one source, keyed by site key."""
        rows = self.db.garments.find(
            {"ingest.source": source},
            {
                "status": 1,
                "images": 1,
                "ingest.siteKey": 1,
                "ingest.contentHash": 1,
                "ingest.humanReviewedAt": 1,
            },
        )
        out = {}
        for row in rows:
            ingest = row["ingest"]
            images = row.get("images") or []
            out[ingest["siteKey"]] = ExistingGarment(
                id=str(row["_id"]),
                site_key=ingest["siteKey"],
                content_hash=ingest.get("contentHash"),
                status=row["status"],
                human_reviewed=bool(ingest.get("humanReviewedAt")),
                image_source_urls=frozenset(
                    i["sourceUrl"] for i in images if i.get("sourceUrl")
                ),
                image_count=len(images),
            )
        return out

    # -- runs --------------------------------------------------------------

    def create_run(
        self,
        *,
        sources: list[str],
        images: str,
        limit: int | None,
        trigger: str = "manual",
    ) -> str:
        run_id = str(uuid.uuid4())
        now = _now()
        self.db.ingestruns.insert_one(
            {
                "_id": run_id,
                "startedAt": now,
                "status": "running",
                "trigger": trigger,
                "options": {
                    "sources": sources,
                    "dryRun": False,
                    "images": images,
                    "limit": limit,
                },
                "sources": [],
                "createdAt": now,
                "updatedAt": now,
            }
        )
        return run_id

    def finish_run(
        self,
        run_id: str,
        *,
        status: str,
        sources: list[dict],
        totals: dict[str, int],
        failures: list[dict],
    ) -> None:
        run = self.db.ingestruns.find_one({"_id": run_id}, {"startedAt": 1})
        now = _now()
        started = run["startedAt"].replace(tzinfo=UTC)
        self.db.ingestruns.update_one(
            {"_id": run_id},
            {
                "$set": {
                    "status": status,
                    "sources": sources,
                    "totals": totals,
                    "failures": failures[:200],
                    "finishedAt": now,
                    "durationMs": int((now - started).total_seconds() * 1000),
                    "updatedAt": now,
                }
            },
        )

    # -- garments ----------------------------------------------------------

    def create_garment(
        self,
        *,
        run_id: str,
        publish: bool,
        fields: dict[str, Any],
        images: list[dict[str, str]],
        image_group_id: str,
        source_label: str,
        ingest: dict[str, Any],
    ) -> str:
        """Insert a new pipeline garment. `fields` are node ids."""
        now = _now()
        result = self.db.garments.insert_one(
            {
                **EMPTY_FIELDS,
                **fields,
                "overrideTitle": None,
                "imageGroupId": image_group_id,
                "images": images,
                "status": "published" if publish else "pending",
                "uploadedByUserId": self.system_user_id(),
                "source": {
                    "type": "external",
                    "label": source_label,
                    "url": ingest["sourceUrl"],
                },
                "ingest": {
                    **ingest,
                    "runId": run_id,
                    "lastRunId": run_id,
                    "firstSeenAt": now,
                    "lastSeenAt": now,
                },
                "createdAt": now,
                "updatedAt": now,
            }
        )
        return str(result.inserted_id)

    def update_garment(
        self,
        garment_id: str,
        *,
        run_id: str,
        publish: bool,
        fields: dict[str, Any],
        images: list[dict[str, str]],
        content_hash: str,
        review: dict[str, Any],
    ) -> None:
        """Apply a re-scrape to a stored garment, under the update policy.

        Only fields the draft could read are written, so a value that went
        missing on the site never clears one already stored.
        """
        _id = ObjectId(garment_id)
        doc = self.db.garments.find_one(
            {"_id": _id}, {"status": 1, "images": 1, "ingest.humanReviewedAt": 1}
        )
        now = _now()
        update: dict[str, Any] = {
            "$set": {
                "ingest.lastSeenAt": now,
                "ingest.lastRunId": run_id,
                "ingest.contentHash": content_hash,
                "updatedAt": now,
            }
        }
        if not doc["ingest"].get("humanReviewedAt"):
            update["$set"].update(fields)
            update["$set"]["ingest.review"] = review
            if publish and doc["status"] == "pending":
                update["$set"]["status"] = "published"

        stored = doc.get("images") or []
        known = {i.get("sourceUrl") for i in stored}
        # Images that predate the pipeline carry no source url, so nothing
        # can be matched against them: append nothing to such a garment.
        fresh = (
            [i for i in images if i["sourceUrl"] not in known]
            if None not in known
            else []
        )
        if fresh:
            update["$push"] = {"images": {"$each": fresh}}
        self.db.garments.update_one({"_id": _id}, update)

    def replace_images(
        self,
        garment_id: str,
        *,
        images: list[dict[str, str]],
        image_group_id: str,
        content_hash: str,
    ) -> None:
        """Swap a garment's photos for a new set, leaving everything else.

        For when a source starts reading better copies of the same photos. The
        old files stay in R2.
        """
        self.db.garments.update_one(
            {"_id": ObjectId(garment_id)},
            {
                "$set": {
                    "images": images,
                    "imageGroupId": image_group_id,
                    "ingest.contentHash": content_hash,
                    "updatedAt": _now(),
                }
            },
        )

    def touch(self, run_id: str, ids: list[str]) -> None:
        """Mark unchanged garments as seen by this run."""
        if ids:
            self.db.garments.update_many(
                {"_id": {"$in": [ObjectId(i) for i in ids]}},
                {"$set": {"ingest.lastSeenAt": _now(), "ingest.lastRunId": run_id}},
            )

    # -- images ------------------------------------------------------------

    def upload_image(self, *, image_group_id: str, content: bytes) -> str:
        """Convert one image to WebP, store it in R2, return its public URL."""
        with Image.open(io.BytesIO(content)) as image:
            image = image.convert(
                "RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB"
            )
            image.thumbnail((MAX_SIDE, MAX_SIDE))
            out = io.BytesIO()
            image.save(out, "WEBP", quality=WEBP_QUALITY)
        key = f"{image_group_id}/{uuid.uuid4()}.webp"
        self._s3.put_object(
            Bucket=self.config.r2_bucket,
            Key=key,
            Body=out.getvalue(),
            ContentType="image/webp",
        )
        return f"{self.config.r2_public_url}/{key}"

    # -- the site ----------------------------------------------------------

    def refresh_site(self) -> str:
        """Ask the site to drop its cached garment pages, so a run's changes
        show at once. Returns what happened, for the log."""
        if not (self.config.site_url and self.config.revalidate_token):
            return "skipped (SITE_URL or REVALIDATE_TOKEN not set)"
        try:
            response = httpx.post(
                f"{self.config.site_url}/api/revalidate",
                headers={"Authorization": f"Bearer {self.config.revalidate_token}"},
                timeout=30,
            )
        except httpx.HTTPError as exc:
            # The run's writes are done; a stale cache only delays them.
            return f"failed ({exc}); changes show within the hour"
        return f"{response.status_code} from {self.config.site_url}"
