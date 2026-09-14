"""Shared HTTP behaviour for source modules.

Politeness is not optional here: one request at a time, a delay between them,
and honouring Retry-After. A source that gets itself blocked takes the whole
pipeline down with it.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any

import httpx

from ingest.models import RawListing

DEFAULT_DELAY = 1.5
TIMEOUT = 30.0
MAX_RETRIES = 3


class Source:
    """Base class. Subclasses set name/label and implement `listings()`."""

    name: str = ""
    label: str = ""

    def __init__(self, delay: float = DEFAULT_DELAY) -> None:
        self.delay = delay
        self._last_request = 0.0
        self._client = httpx.Client(follow_redirects=True, timeout=TIMEOUT)

    # -- fetching ---------------------------------------------------------

    def _wait(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_request = time.monotonic()

    def get(self, url: str) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(MAX_RETRIES):
            self._wait()
            try:
                response = self._client.get(url)
            except httpx.HTTPError as exc:  # network-level
                last_error = exc
                time.sleep(2**attempt)
                continue

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                pause = float(retry_after) if retry_after else 5.0 * (attempt + 1)
                time.sleep(pause)
                continue
            if response.status_code >= 500:
                time.sleep(2**attempt)
                continue

            response.raise_for_status()
            return response

        raise RuntimeError(
            f"GET {url} failed after {MAX_RETRIES} attempts: {last_error}"
        )

    def get_text(self, url: str) -> str:
        return self.get(url).text

    def get_json(self, url: str) -> Any:
        return self.get(url).json()

    def close(self) -> None:
        self._client.close()

    # -- contract ---------------------------------------------------------

    def listings(self) -> Iterator[RawListing]:
        raise NotImplementedError
