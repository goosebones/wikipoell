"""Base for WooCommerce shops.

Navigation: the public Store API, `/wp-json/wc/store/products`, the whole
catalog as JSON, 100 products a page. No HTML parsing.

Images: the product's `images`, in order.

Attributes: the SKU. Subclasses add the article code and decide which
products are CCP (`is_wanted`).

Details: the shop's categories, tags and product attributes (each attribute
under its own name, e.g. "Color": "Black").

Site key is `/product/<slug>`.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from ingest.models import Attributes, Detail
from ingest.sources.base import Source
from ingest.sources.extract import html_text, joined

PER_PAGE = 100
MAX_PAGES = 30

Product = dict[str, Any]


class WooCommerceSource(Source[Product]):
    #: Shop origin, no trailing slash.
    base_url: str = ""

    def items(self) -> Iterator[Product]:
        for page in range(1, MAX_PAGES + 1):
            url = (
                f"{self.base_url}/wp-json/wc/store/products"
                f"?per_page={PER_PAGE}&page={page}"
            )
            batch = self.get_json(url)
            if not isinstance(batch, list) or not batch:
                return
            yield from (p for p in batch if self.is_wanted(p))

    def is_wanted(self, item: Product) -> bool:
        """Whether a product is a CCP garment. Shops differ in how to tell."""
        return True

    def site_key(self, item: Product) -> str | None:
        slug = (item.get("slug") or "").strip()
        return f"/product/{slug}" if slug else None

    def url(self, item: Product) -> str:
        return item.get("permalink") or f"{self.base_url}/product/{item.get('slug')}"

    def title(self, item: Product) -> str:
        return (item.get("name") or "").strip()

    def description(self, item: Product) -> str | None:
        return html_text(item.get("description"))

    def images(self, item: Product) -> list[str]:
        return [img["src"] for img in item.get("images", []) if img.get("src")]

    def attributes(self, item: Product) -> Attributes:
        return Attributes(sku=(item.get("sku") or "").strip() or None)

    def details(self, item: Product) -> dict[str, str]:
        out = {
            Detail.VENDOR_CATEGORY: joined(
                [c.get("name") for c in item.get("categories", [])]
            ),
            Detail.TAGS: joined([t.get("name") for t in item.get("tags", [])]),
        }
        for attribute in item.get("attributes", []):
            terms = joined([t.get("name") for t in attribute.get("terms", [])])
            out[attribute.get("name") or "Attribute"] = terms
        return out

    def raw(self, item: Product) -> dict[str, Any]:
        return {"id": item.get("id"), "type": item.get("type")}
