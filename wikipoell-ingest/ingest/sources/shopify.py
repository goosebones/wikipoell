"""Base for Shopify storefronts.

Navigation: every Shopify shop serves `/products.json`, the whole catalog as
structured data, 250 products a page. Products are kept when their `vendor`
contains the configured name.

Images: the product's `images`, in order.

Attributes: the first variant SKU. Shops differ in where the article code
lives (the title, labels in the description, tags), so subclasses add it.

Details: `product_type` as the vendor category, the size option's values, and
the tags. Subclasses add what their shop's description carries.

Site key is `/products/<handle>`.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from ingest.models import Attributes, Detail
from ingest.sources.base import Source
from ingest.sources.extract import html_text, joined

PAGE_SIZE = 250
MAX_PAGES = 40  # ~10k products; a guard against an endless paginator

Product = dict[str, Any]


class ShopifySource(Source[Product]):
    #: Storefront origin, no trailing slash.
    base_url: str = ""
    #: Only products whose `vendor` contains this (case-insensitive) are kept.
    vendor: str = "Carol Christian Poell"

    def items(self) -> Iterator[Product]:
        wanted = self.vendor.lower()
        for page in range(1, MAX_PAGES + 1):
            url = f"{self.base_url}/products.json?limit={PAGE_SIZE}&page={page}"
            batch = self.get_json(url).get("products") or []
            if not batch:
                return
            for product in batch:
                if wanted in (product.get("vendor") or "").lower():
                    yield product

    def site_key(self, item: Product) -> str | None:
        handle = (item.get("handle") or "").strip()
        return f"/products/{handle}" if handle else None

    def url(self, item: Product) -> str:
        return f"{self.base_url}/products/{(item.get('handle') or '').strip()}"

    def title(self, item: Product) -> str:
        return (item.get("title") or "").strip()

    def description(self, item: Product) -> str | None:
        return html_text(item.get("body_html"))

    def images(self, item: Product) -> list[str]:
        return [img["src"] for img in item.get("images", []) if img.get("src")]

    def attributes(self, item: Product) -> Attributes:
        return Attributes(sku=self.first_sku(item))

    def details(self, item: Product) -> dict[str, str]:
        return {
            Detail.VENDOR_CATEGORY: (item.get("product_type") or "").strip(),
            Detail.SIZES: joined(self.sizes(item)),
            Detail.TAGS: joined(item.get("tags")),
        }

    def raw(self, item: Product) -> dict[str, Any]:
        return {"id": item.get("id")}

    # -- helpers -----------------------------------------------------------

    @staticmethod
    def first_sku(item: Product) -> str | None:
        for variant in item.get("variants", []):
            sku = (variant.get("sku") or "").strip()
            if sku:
                return sku
        return None

    @staticmethod
    def sizes(item: Product) -> list[str]:
        """The size option's values. Shops without options carry a single
        "Default Title" value, which is not a size."""
        for option in item.get("options", []):
            if option.get("name", "").lower() in ("size", "taglia", "sizes"):
                return [v for v in option.get("values", []) if v != "Default Title"]
        return []

    @staticmethod
    def tag_value(item: Product, prefix: str) -> str | None:
        """First tag with the given `prefix_`, minus the prefix: The Library
        tags products `gender_men`, `footwear_boots` and so on."""
        for tag in item.get("tags", []):
            if tag.startswith(f"{prefix}_"):
                return tag[len(prefix) + 1 :]
        return None
