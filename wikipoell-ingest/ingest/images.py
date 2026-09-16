"""Copy source images into R2 via the webapp.

The archive owns its images. Hotlinking a retailer's CDN means the archive
goes blank the day they re-platform, so every image is downloaded and handed
to `/api/ingest/images`, which runs the same Sharp → WebP → R2 path the
webapp uses for user uploads.

A garment's images all share one `imageGroupId`, matching how existing
garments are stored (`<groupId>/<uuid>.webp`).
"""

from __future__ import annotations

import mimetypes
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import httpx

TIMEOUT = 60.0
MAX_BYTES = 10 * 1024 * 1024  # matches the API's own limit
ALLOWED = {"image/jpeg", "image/png", "image/gif", "image/webp"}
# Images within one garment are copied concurrently. Kept modest on purpose:
# the work is spread across a source CDN and the webapp's Sharp conversion,
# and a garment rarely has more than ~20 images, so higher values buy little
# while being noticeably less polite.
DEFAULT_CONCURRENCY = 6


@dataclass
class ImageResult:
    #: {"url": <R2 url>, "sourceUrl": <where it came from>} in display order.
    #: sourceUrl is what makes a re-scrape idempotent — each upload mints a new
    #: R2 UUID, so the source URL is the only stable identity an image has.
    images: list[dict[str, str]] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return bool(self.images)


def _content_type(response: httpx.Response, url: str) -> str | None:
    header = (response.headers.get("content-type") or "").split(";")[0].strip()
    if header in ALLOWED:
        return header
    guessed, _ = mimetypes.guess_type(url)
    return guessed if guessed in ALLOWED else None


class ImageCopier:
    def __init__(
        self,
        client,
        *,
        timeout: float = TIMEOUT,
        concurrency: int = DEFAULT_CONCURRENCY,
    ) -> None:
        self.client = client
        self.concurrency = max(1, concurrency)
        # httpx.Client is thread-safe, and connection pooling across threads is
        # exactly what makes this worth doing.
        self._http = httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            limits=httpx.Limits(max_connections=self.concurrency * 2),
        )
        self._pool = (
            ThreadPoolExecutor(max_workers=self.concurrency, thread_name_prefix="img")
            if self.concurrency > 1
            else None
        )

    def close(self) -> None:
        if self._pool is not None:
            self._pool.shutdown(wait=False, cancel_futures=True)
        self._http.close()

    def copy(self, urls: list[str], image_group_id: str) -> ImageResult:
        """Download each URL and store it in R2.

        Copies run concurrently but **order is preserved** — the first image is
        a garment's cover on the site, so the sequence is not cosmetic.

        A single bad image does not lose the garment: it is recorded as a
        failure and the rest are kept. The caller decides what to do with a
        garment that ended up with no images at all.
        """
        result = ImageResult()
        if not urls:
            return result

        if self._pool is None or len(urls) == 1:
            outcomes = [self._attempt(url, image_group_id) for url in urls]
        else:
            outcomes = list(
                self._pool.map(lambda u: self._attempt(u, image_group_id), urls)
            )

        for url, stored, error in outcomes:
            if error is None:
                result.images.append({"url": stored, "sourceUrl": url})
            else:
                result.failures.append(f"{url}: {error}")
        return result

    def _attempt(self, url: str, image_group_id: str):
        """(url, stored_url, error) — never raises, so one bad image is not fatal."""
        try:
            return url, self._copy_one(url, image_group_id), None
        except Exception as exc:
            return url, None, str(exc)[:160]

    def _copy_one(self, url: str, image_group_id: str) -> str:
        response = self._http.get(url)
        response.raise_for_status()

        content = response.content
        if not content:
            raise RuntimeError("empty response")
        if len(content) > MAX_BYTES:
            raise RuntimeError(f"too large ({len(content)} bytes)")

        content_type = _content_type(response, url)
        if content_type is None:
            raw = (response.headers.get("content-type") or "unknown").split(";")[0]
            raise RuntimeError(f"unsupported content-type {raw!r}")

        filename = url.rsplit("/", 1)[-1].split("?")[0] or "image"
        return self.client.upload_image(
            image_group_id=image_group_id,
            filename=filename,
            content=content,
            content_type=content_type,
        )
