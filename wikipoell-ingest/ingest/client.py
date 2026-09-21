"""The only thing that knows the webapp API exists.

Python never touches MongoDB — every read and write goes through
/api/ingest/*, so Mongoose stays the single definition of a garment.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from ingest.config import Config

TIMEOUT = 60.0


@dataclass(frozen=True)
class ExistingGarment:
    """One row of the dedup index, as the API returns it."""

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


class WikipoellClient:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._client = httpx.Client(
            base_url=config.api_url,
            headers={"Authorization": f"Bearer {config.require_token()}"},
            timeout=TIMEOUT,
            verify=config.api_verify,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> WikipoellClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self._client.request(method, path, **kwargs)
        if response.status_code >= 400:
            detail = response.text[:400]
            raise RuntimeError(f"{method} {path} → {response.status_code}: {detail}")
        return response.json()

    # -- reads ------------------------------------------------------------

    def context(self) -> dict[str, Any]:
        """Vocabulary, categories, corrections and the system user id."""
        return self._request("GET", "/api/ingest/context")

    def existing(self, source: str) -> dict[str, ExistingGarment]:
        """Dedup index for one source, keyed by site key."""
        payload = self._request(
            "GET", "/api/ingest/garments", params={"source": source}
        )
        return {
            row["siteKey"]: ExistingGarment(
                id=row["id"],
                site_key=row["siteKey"],
                content_hash=row.get("contentHash"),
                status=row["status"],
                human_reviewed=bool(row.get("humanReviewedAt")),
                image_source_urls=frozenset(row.get("imageSourceUrls") or []),
                image_count=int(row.get("imageCount") or 0),
            )
            for row in payload["garments"]
        }

    # -- runs -------------------------------------------------------------

    def create_run(
        self,
        *,
        sources: list[str],
        dry_run: bool,
        images: str,
        limit: int | None,
        trigger: str = "manual",
    ) -> str:
        payload = self._request(
            "POST",
            "/api/ingest/runs",
            json={
                "trigger": trigger,
                "options": {
                    "sources": sources,
                    "dryRun": dry_run,
                    "images": images,
                    "limit": limit,
                },
            },
        )
        return payload["runId"]

    def update_run(self, run_id: str, **body: Any) -> Any:
        return self._request("PATCH", f"/api/ingest/runs/{run_id}", json=body)

    # -- writes -----------------------------------------------------------

    def create_garment(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/ingest/garments", json=body)

    def update_garment(self, garment_id: str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("PATCH", f"/api/ingest/garments/{garment_id}", json=body)

    def touch(self, run_id: str, ids: list[str]) -> dict[str, Any]:
        if not ids:
            return {"matched": 0, "modified": 0}
        return self._request(
            "PATCH",
            "/api/ingest/garments/touch",
            json={"runId": run_id, "ids": ids},
        )

    def upload_image(
        self, *, image_group_id: str, filename: str, content: bytes, content_type: str
    ) -> str:
        response = self._client.post(
            "/api/ingest/images",
            data={"imageGroupId": image_group_id},
            files={"file": (filename, content, content_type)},
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"image upload → {response.status_code}: {response.text[:200]}"
            )
        return response.json()["url"]
