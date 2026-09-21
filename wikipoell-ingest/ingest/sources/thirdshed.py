"""thethirdshed.com — WooCommerce.

The shop's public Store API returns the whole catalog as JSON, so no HTML
parsing. Every product is CCP — the brand name never appears anywhere, which
is why a naive "does it mention Carol Christian Poell" filter finds nothing.
Listings are identified instead by their **name being an article code**, which
is also the only structured data the shop carries: categories, SKUs and
attributes are all empty.

Anything whose name does not parse as a code is skipped rather than guessed
at, so a future non-CCP product cannot slip in.
"""

from __future__ import annotations

import html
import re
from collections.abc import Iterator
from typing import Any

from ingest.models import RawListing
from ingest.normalize.article_code import parse_article_code
from ingest.sources.base import Source

BASE_URL = "https://www.thethirdshed.com"
PER_PAGE = 100
MAX_PAGES = 30
_TAGS = re.compile(r"<[^>]+>")


class ThirdShedSource(Source):
    name = "thirdshed"
    label = "The Third Shed"

    def listings(self) -> Iterator[RawListing]:
        for page in range(1, MAX_PAGES + 1):
            url = (
                f"{BASE_URL}/wp-json/wc/store/products?per_page={PER_PAGE}&page={page}"
            )
            batch = self.get_json(url)
            if not isinstance(batch, list) or not batch:
                return
            for product in batch:
                listing = self._to_listing(product)
                if listing is not None:
                    yield listing

    def _to_listing(self, product: dict[str, Any]) -> RawListing | None:
        slug = (product.get("slug") or "").strip()
        name = (product.get("name") or "").strip()
        if not slug or not name:
            return None
        # The name is the only brand signal the shop has. If it is not a CCP
        # article code, this is not a garment we want.
        if parse_article_code(name) is None:
            return None

        description = _TAGS.sub(" ", product.get("description") or "")
        description = html.unescape(re.sub(r"\s+", " ", description)).strip()

        return RawListing(
            site_key=f"/product/{slug}",
            url=product.get("permalink") or f"{BASE_URL}/product/{slug}",
            title=name,
            article_code=name,
            description=description[:2000] or None,
            images=[img["src"] for img in product.get("images", []) if img.get("src")],
            raw={"id": product.get("id"), "type": product.get("type")},
        )
