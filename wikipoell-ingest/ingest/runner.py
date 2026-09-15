"""Per-source orchestration and run bookkeeping.

One pass over one source: fetch listings, skip the unchanged, normalise and
route the rest, then create or update. Everything is counted so the run
document tells you what happened without reading the log.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field

from ingest.client import WikipoellClient
from ingest.images import ImageCopier
from ingest.models import Decision, Draft, RawListing, Route
from ingest.normalize.draft import normalize
from ingest.normalize.vocabulary import Vocabulary
from ingest.route import decide, missing_fields
from ingest.sources.base import Source


@dataclass
class SourceStats:
    name: str
    status: str = "running"
    durationMs: int = 0
    listingsFound: int = 0
    unchanged: int = 0
    created: int = 0
    updated: int = 0
    published: int = 0
    needsReview: int = 0
    failed: int = 0
    imagesCopied: int = 0
    imagesFailed: int = 0
    llmCalls: int = 0
    llmFailed: int = 0
    # Set when the whole source threw — the "scraper broke" signal.
    error: str | None = None


@dataclass
class RunReport:
    run_id: str
    sources: list[SourceStats] = field(default_factory=list)
    failures: list[dict[str, str]] = field(default_factory=list)

    def totals(self) -> dict[str, int]:
        keys = (
            "listingsFound",
            "unchanged",
            "created",
            "updated",
            "published",
            "needsReview",
            "failed",
            "imagesCopied",
            "imagesFailed",
            "llmCalls",
            "llmFailed",
        )
        return {k: sum(getattr(s, k) for s in self.sources) for k in keys}


class Runner:
    def __init__(
        self,
        client: WikipoellClient,
        vocab: Vocabulary,
        *,
        run_id: str,
        dry_run: bool = False,
        limit: int | None = None,
        threshold: float = 0.90,
        verbose: bool = True,
        llm=None,
    ) -> None:
        self.client = client
        self.vocab = vocab
        self.run_id = run_id
        self.dry_run = dry_run
        self.limit = limit
        self.threshold = threshold
        self.verbose = verbose
        self.llm = llm
        self.images = ImageCopier(client)

    def close(self) -> None:
        self.images.close()

    # -- one source --------------------------------------------------------

    def run_source(self, source: Source, report: RunReport) -> SourceStats:
        stats = SourceStats(name=source.name)
        started = time.monotonic()
        print(f"\n── {source.name} " + "─" * (60 - len(source.name)))

        try:
            existing = self.client.existing(source.name)
            print(f"   {len(existing)} known garments")

            unchanged_ids: list[str] = []
            for index, listing in enumerate(source.listings()):
                if self.limit is not None and index >= self.limit:
                    print(f"   … stopping at --limit {self.limit}")
                    break
                stats.listingsFound += 1
                try:
                    self._process(listing, source, existing, stats, unchanged_ids)
                except Exception as exc:  # one bad listing must not end the source
                    stats.failed += 1
                    report.failures.append(
                        {
                            "source": source.name,
                            "siteKey": listing.site_key,
                            "url": listing.url,
                            "message": str(exc)[:300],
                        }
                    )
                    print(f"   ✗ {listing.site_key}: {exc}")

            if unchanged_ids and not self.dry_run:
                self.client.touch(self.run_id, unchanged_ids)

            if stats.listingsFound == 0:
                # The classic silent breakage: the site changed its markup and
                # the selectors match nothing. Never let this look like success.
                stats.status = "failed"
                stats.error = "No listings found — the scraper may be broken"
            else:
                stats.status = "completed"

        except Exception as exc:
            stats.status = "failed"
            stats.error = str(exc)[:500]
            print(f"   ✗ source failed: {exc}")
        finally:
            source.close()

        stats.durationMs = int((time.monotonic() - started) * 1000)
        self._print_stats(stats)
        return stats

    # -- one listing -------------------------------------------------------

    def _process(self, listing, source, existing, stats, unchanged_ids) -> None:
        known = existing.get(listing.site_key)
        content_hash = listing.content_hash()

        if known and known.content_hash == content_hash:
            stats.unchanged += 1
            unchanged_ids.append(known.id)
            return

        draft = normalize(listing, self.vocab)
        decision = decide(draft, self.vocab, threshold=self.threshold)

        stage = "deterministic"
        if decision.route is Route.LLM:
            if self.llm is None:
                # No API key, or --no-llm. A person is the safe fallback.
                decision = Decision(Route.HUMAN, [*decision.reasons, "llm_skipped"])
            else:
                stage = "llm"
                stats.llmCalls += 1
                try:
                    draft = self.llm.review(draft, missing_fields(draft))
                except Exception as exc:
                    draft.llm_confidence = 0.0
                    draft.llm_notes = f"LLM error: {str(exc)[:200]}"
                    stats.llmFailed += 1
                decision = decide(
                    draft, self.vocab, after_llm=True, threshold=self.threshold
                )

        if decision.publish:
            stats.published += 1
        else:
            stats.needsReview += 1

        if self.verbose:
            self._print_listing(listing, draft, decision, known)

        if self.dry_run:
            if known:
                stats.updated += 1
            else:
                stats.created += 1
            return

        self._write(listing, source, draft, decision, known, content_hash, stats, stage)

    def _write(
        self, listing, source, draft, decision, known, content_hash, stats, stage
    ) -> None:
        review = {
            "required": not decision.publish,
            "reasons": decision.reasons,
            "stage": stage,
            "fields": draft.review_fields(),
        }
        if draft.llm_confidence is not None:
            review["llm"] = {
                "model": draft.llm_model,
                "confidence": draft.llm_confidence,
                "notes": draft.llm_notes,
            }

        if known:
            # Only copy source images this garment does not already have. Each
            # R2 upload mints a new UUID url, so without this every change to a
            # listing would duplicate its whole image set.
            fresh = [u for u in listing.images if u not in known.image_source_urls]
            image_group_id = str(uuid.uuid4())
            copied = self._copy_images(listing, image_group_id, stats, urls=fresh)
            self.client.update_garment(
                known.id,
                {
                    "runId": self.run_id,
                    "publish": decision.publish,
                    "fields": draft.field_values(),
                    "images": copied.images,
                    "ingest": {"contentHash": content_hash, "review": review},
                },
            )
            stats.updated += 1
            return

        image_group_id = str(uuid.uuid4())
        copied = self._copy_images(listing, image_group_id, stats)
        if not copied.ok:
            # The API requires at least one image, and a garment with none is
            # not worth publishing anyway.
            raise RuntimeError(
                f"no images could be copied ({len(copied.failures)} failed)"
            )

        self.client.create_garment(
            {
                "publish": decision.publish,
                "fields": draft.field_values(),
                "images": copied.images,
                "imageGroupId": image_group_id,
                "source": {"label": source.label, "url": listing.url},
                "ingest": {
                    "source": source.name,
                    "siteKey": listing.site_key,
                    "sourceUrl": listing.url,
                    "contentHash": content_hash,
                    "runId": self.run_id,
                    "review": review,
                },
            }
        )
        stats.created += 1

    def _copy_images(self, listing, image_group_id: str, stats, urls=None):
        """Download the listing's images into R2. Never hotlink (DESIGN.md §4.5)."""
        copied = self.images.copy(
            listing.images if urls is None else urls, image_group_id
        )
        stats.imagesCopied += len(copied.images)
        stats.imagesFailed += len(copied.failures)
        if copied.failures and self.verbose:
            for failure in copied.failures[:2]:
                print(f"       image: {failure}")
        return copied

    # -- output ------------------------------------------------------------

    def _print_listing(
        self, listing: RawListing, draft: Draft, decision: Decision, known
    ) -> None:
        mark = {"publish": "✓", "human": "⚑", "llm": "→"}[str(decision.route)]
        action = "update" if known else "create"
        title = (draft.get("title") or listing.title)[:44]
        print(f"   {mark} [{action}] {title:46} {listing.site_key[:34]}")
        if decision.reasons:
            print(f"       {', '.join(decision.reasons[:4])}")

    def _print_stats(self, s: SourceStats) -> None:
        print(
            f"   {s.status}: {s.listingsFound} found, {s.unchanged} unchanged, "
            f"{s.created} created, {s.updated} updated "
            f"({s.published} publish / {s.needsReview} review), {s.failed} failed"
        )
        if s.llmCalls:
            print(
                f"   llm   : {s.llmCalls} calls"
                + (f", {s.llmFailed} failed" if s.llmFailed else "")
            )
        if s.imagesCopied or s.imagesFailed:
            print(
                f"   images: {s.imagesCopied} copied to R2"
                + (f", {s.imagesFailed} failed" if s.imagesFailed else "")
            )
        if s.error:
            print(f"   error: {s.error}")


def new_run_id() -> str:
    return str(uuid.uuid4())


def stats_to_json(stats: list[SourceStats]) -> list[dict]:
    return [{k: v for k, v in asdict(s).items() if v is not None} for s in stats]
