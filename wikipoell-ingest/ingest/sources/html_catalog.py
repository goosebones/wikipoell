"""Base for sites that only publish HTML.

The four remaining retailers all work the same way: a paginated brand page
lists products, and the detail page carries the article code. So the base
handles pagination and the listing→detail walk, and a subclass supplies two
things: how to find product links, and how to read one detail page.

Note this means one request per product, every run — the content hash is
computed from detail-page data, so there is nothing to compare without
fetching it. Sites with large catalogs are correspondingly slow; that cost is
noted per source in the README.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from urllib.parse import urljoin

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.sources.base import Source

MAX_PAGES = 40


class HtmlCatalogSource(Source):
    #: Origin, no trailing slash.
    base_url: str = ""
    #: Brand pages to walk. Each may carry hints (e.g. gender) that the
    #: listing page establishes and the detail page does not.
    start_urls: list[tuple[str, dict[str, Any]]] = []
    #: CSS selector for links to product detail pages.
    product_link_selector: str = "a[href]"
    #: Query parameter used for pagination; None disables paging.
    page_param: str | None = "page"

    # -- subclass hooks ----------------------------------------------------

    def is_product_link(self, href: str) -> bool:
        return True

    def parse_detail(
        self, url: str, tree: HTMLParser, hints: dict[str, Any]
    ) -> RawListing | None:
        raise NotImplementedError

    def site_key(self, url: str) -> str:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        key = parsed.path.rstrip("/")
        return f"{key}?{parsed.query}" if parsed.query else key

    # -- the walk ----------------------------------------------------------

    def product_links(self, tree: HTMLParser) -> list[str]:
        out, seen = [], set()
        for node in tree.css(self.product_link_selector):
            href = (node.attributes.get("href") or "").strip()
            if not href or href.startswith(("#", "javascript:", "mailto:")):
                continue
            absolute = urljoin(self.base_url + "/", href)
            if not self.is_product_link(absolute) or absolute in seen:
                continue
            seen.add(absolute)
            out.append(absolute)
        return out

    def _paged(self, url: str, page: int) -> str:
        if self.page_param is None or page == 1:
            return url
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}{self.page_param}={page}"

    def listings(self) -> Iterator[RawListing]:
        seen: set[str] = set()
        for start_url, hints in self.start_urls:
            for page in range(1, MAX_PAGES + 1):
                tree = HTMLParser(self.get_text(self._paged(start_url, page)))
                links = [u for u in self.product_links(tree) if u not in seen]
                if not links:
                    break  # no new products: end of pagination
                seen.update(links)
                for url in links:
                    try:
                        detail = HTMLParser(self.get_text(url))
                    except Exception:
                        continue  # one dead product page is not fatal
                    listing = self.parse_detail(url, detail, hints)
                    if listing is not None:
                        yield listing
                if self.page_param is None:
                    break
