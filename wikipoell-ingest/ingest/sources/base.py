"""The framework every source module is built on.

A source answers four questions about its site, one method each:

1. **Navigation** — `items()`: walk the site and yield one item per garment,
   fetched as far as the other three need (a JSON product, a parsed detail
   page, a catalog node). Anything that isn't a garment is skipped here.
2. **Images** — `images(item)`: the garment's photos, as absolute URLs, in
   the order the site shows them. The first is the cover.
3. **Attributes** — `attributes(item)`: what the site states about the
   garment's classification, in its own terms. The article code above all;
   gender, category and color where the site gives them separately.
4. **Details** — `details(item)`: everything else on the page about *this*
   garment that could help a person or the LLM classify it, under `Detail`
   labels — vendor categories, composition, color names, feature lines,
   sizes. Shop boilerplate (shipping, store hours, other products) stays out.

Plus identity (`site_key`, `url`), `title` and `description`, which the
content hash is built from. `listing()` puts it all together; subclasses
rarely override it.

Platform bases implement navigation once for a kind of shop: `ShopifySource`,
`WooCommerceSource` and `HtmlCatalogSource`. A new site usually picks one and
writes only the hooks.

Politeness is not optional: one request at a time, a delay between them, and
honouring Retry-After. A source that gets itself blocked takes the whole
pipeline down with it.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any

import httpx

from ingest.models import Attributes, RawListing

DEFAULT_DELAY = 1.5
TIMEOUT = 30.0
MAX_RETRIES = 3


class Source[Item]:
    """Base class. Subclasses set name/label and implement the hooks."""

    name: str = ""
    label: str = ""
    #: True when the site's title is the only name a product has (see `ink`).
    title_is_final: bool = False

    def __init__(self, delay: float = DEFAULT_DELAY) -> None:
        self.delay = delay
        self._last_request = 0.0
        self._client = httpx.Client(follow_redirects=True, timeout=TIMEOUT)
        #: (url, message) for items that could not be read. The run records
        #: them as failures; one bad product page never ends the source.
        self.problems: list[tuple[str, str]] = []

    # -- 1. navigation -----------------------------------------------------

    def items(self) -> Iterator[Item]:
        raise NotImplementedError

    # -- identity, title and prose -----------------------------------------

    def site_key(self, item: Item) -> str | None:
        """A stable per-site id. None skips the item."""
        raise NotImplementedError

    def url(self, item: Item) -> str:
        raise NotImplementedError

    def title(self, item: Item) -> str:
        raise NotImplementedError

    def description(self, item: Item) -> str | None:
        return None

    # -- 2. images ---------------------------------------------------------

    def images(self, item: Item) -> list[str]:
        raise NotImplementedError

    # -- 3. attributes -----------------------------------------------------

    def attributes(self, item: Item) -> Attributes:
        return Attributes()

    # -- 4. details --------------------------------------------------------

    def details(self, item: Item) -> dict[str, str]:
        return {}

    def raw(self, item: Item) -> dict[str, Any]:
        """Anything else worth keeping for debugging."""
        return {}

    # -- assembly ----------------------------------------------------------

    def listing(self, item: Item) -> RawListing | None:
        site_key = self.site_key(item)
        title = self.title(item)
        if not site_key or not title:
            return None
        return RawListing(
            site_key=site_key,
            url=self.url(item),
            title=title,
            images=list(dict.fromkeys(u for u in self.images(item) if u)),
            attributes=self.attributes(item),
            description=self.description(item),
            details={k: v for k, v in self.details(item).items() if v},
            title_is_final=self.title_is_final,
            raw=self.raw(item),
        )

    def listings(self) -> Iterator[RawListing]:
        for item in self.items():
            try:
                listing = self.listing(item)
            except Exception as exc:  # one unreadable product is not fatal
                self.problem(self._describe(item), exc)
                continue
            if listing is not None:
                yield listing

    def problem(self, where: str, exc: Exception) -> None:
        self.problems.append((where, str(exc)[:300]))

    def _describe(self, item: Item) -> str:
        try:
            return self.url(item)
        except Exception:
            return repr(item)[:120]

    # -- fetching ----------------------------------------------------------

    def _wait(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_request = time.monotonic()

    def get(self, url: str) -> httpx.Response:
        last_error: object = None
        for attempt in range(MAX_RETRIES):
            self._wait()
            try:
                response = self._client.get(url)
            except httpx.HTTPError as exc:  # network-level
                last_error = exc
                time.sleep(2**attempt)
                continue

            if response.status_code == 429 or response.status_code >= 500:
                last_error = f"HTTP {response.status_code}"
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
