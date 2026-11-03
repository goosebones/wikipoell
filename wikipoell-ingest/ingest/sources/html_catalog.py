"""Base for sites that only publish HTML.

Navigation: a brand page (or one per gender) lists products, paginated with a
query parameter; each product link is followed to its detail page, and the
parsed detail page is the item the other hooks read. A subclass says where
to start, which links are products, and how pages are numbered. Pagination
ends at the first page with no new products.

Each start URL may carry hints the listing page establishes and the detail
page does not — darklands and ink split men's and women's, so gender comes
from the entry point.

This means one request per product, every run: the content hash is computed
from detail-page data, so there is nothing to compare without fetching it.

Site key defaults to the URL path (plus query, where the query is the id).
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urljoin, urlparse

from selectolax.parser import HTMLParser

from ingest.sources.base import Source
from ingest.sources.extract import node_text

MAX_PAGES = 40


@dataclass
class Page:
    """A product's detail page, with the hints from where it was listed."""

    url: str
    tree: HTMLParser
    hints: dict[str, Any] = field(default_factory=dict)


class HtmlCatalogSource(Source[Page]):
    #: Origin, no trailing slash.
    base_url: str = ""
    #: Brand pages to walk, each with its hints (e.g. {"gender": "M"}).
    start_urls: list[tuple[str, dict[str, Any]]] = []
    #: CSS selector for links to product detail pages.
    product_link_selector: str = "a[href]"
    #: Query parameter used for pagination; None when one page lists all.
    page_param: str | None = "page"

    def is_product_link(self, href: str) -> bool:
        return True

    # -- navigation --------------------------------------------------------

    def items(self) -> Iterator[Page]:
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
                        yield Page(url, HTMLParser(self.get_text(url)), hints)
                    except Exception as exc:  # one dead product page is not fatal
                        self.problem(url, exc)
                if self.page_param is None:
                    break

    def product_links(self, tree: HTMLParser) -> list[str]:
        out: list[str] = []
        for node in tree.css(self.product_link_selector):
            href = (node.attributes.get("href") or "").strip()
            if not href or href.startswith(("#", "javascript:", "mailto:")):
                continue
            absolute = urljoin(self.base_url + "/", href)
            if self.is_product_link(absolute) and absolute not in out:
                out.append(absolute)
        return out

    def _paged(self, url: str, page: int) -> str:
        if self.page_param is None or page == 1:
            return url
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}{self.page_param}={page}"

    # -- defaults for the hooks --------------------------------------------

    def site_key(self, item: Page) -> str | None:
        parsed = urlparse(item.url)
        key = parsed.path.rstrip("/")
        return f"{key}?{parsed.query}" if parsed.query else key

    def url(self, item: Page) -> str:
        return item.url

    def title(self, item: Page) -> str:
        return node_text(item.tree.css_first("h1"))
