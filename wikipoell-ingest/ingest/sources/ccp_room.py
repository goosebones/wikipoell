"""ccp-room.com — the brand's own catalog.

The whole catalog is one page. Every product is an `<a class="info__catalog-item">`
whose data-* attributes carry the entire record, so there is no per-product
request to make: one fetch yields ~579 listings.

Site key is the URL **fragment** (`/catalog/#<slug>`), because the path is
identical for every product on the site.
"""

from __future__ import annotations

from collections.abc import Iterator

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.sources.base import Source

BASE_URL = "https://www.ccp-room.com"
CATALOG_URL = f"{BASE_URL}/catalog/"

# Section ids on the page, in the order they appear. These become the category
# hint. "objects" has no archive category and resolves to None by design.
SECTIONS = ("leather", "clothes", "footwear", "accessories", "objects")


class CcpRoomSource(Source):
    name = "ccp-room"
    label = "CCP-ROOM"

    def listings(self) -> Iterator[RawListing]:
        tree = HTMLParser(self.get_text(CATALOG_URL))

        for section in SECTIONS:
            container = tree.css_first(f'div.info__wrap[id="{section}"]')
            if container is None:
                continue
            for node in container.css("a.info__catalog-item"):
                listing = self._to_listing(node, section)
                if listing is not None:
                    yield listing

    def _to_listing(self, node, section: str) -> RawListing | None:
        attrs = node.attributes
        # The class appears on an inner element too; only the real item
        # carries data-id.
        if attrs.get("data-id") is None:
            return None

        href = (attrs.get("href") or "").strip()
        site_key = href.lstrip("#")
        if not site_key:
            return None

        images = [
            f"{BASE_URL}{path.strip()}"
            for path in (attrs.get("data-img") or "").split(",")
            if path.strip()
        ]

        return RawListing(
            site_key=site_key,
            url=f"{CATALOG_URL}{href}",
            title=(attrs.get("data-name") or "").strip(),
            article_code=(attrs.get("data-article") or "").strip() or None,
            description=(attrs.get("data-composition") or "").strip() or None,
            images=images,
            category_hint=section,
            color_hint=(attrs.get("data-color") or "").strip() or None,
            raw={
                "id": attrs.get("data-id"),
                "section": section,
                "titlecolor": attrs.get("data-titlecolor"),
                "composition": attrs.get("data-composition"),
                "instock": attrs.get("data-instock"),
            },
        )
