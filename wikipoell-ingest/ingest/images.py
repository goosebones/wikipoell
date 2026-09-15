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
from dataclasses import dataclass, field

import httpx

TIMEOUT = 60.0
MAX_BYTES = 10 * 1024 * 1024  # matches the API's own limit
ALLOWED = {"image/jpeg", "image/png", "image/gif", "image/webp"}


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
    def __init__(self, client, *, timeout: float = TIMEOUT) -> None:
        self.client = client
        self._http = httpx.Client(follow_redirects=True, timeout=timeout)

    def close(self) -> None:
        self._http.close()

    def copy(self, urls: list[str], image_group_id: str) -> ImageResult:
        """Download each URL and store it in R2. Order is preserved.

        A single bad image does not lose the garment — it is recorded and the
        rest are kept. The caller decides what to do with a garment that ended
        up with no images at all.
        """
        result = ImageResult()
        for url in urls:
            try:
                stored = self._copy_one(url, image_group_id)
                result.images.append({"url": stored, "sourceUrl": url})
            except Exception as exc:
                result.failures.append(f"{url}: {str(exc)[:160]}")
        return result

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
