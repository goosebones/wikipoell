"""Base for Shopify storefronts.

Every Shopify shop exposes `/products.json`, which returns the full catalog as
structured data — no HTML parsing, no headless browser. Subclasses say which
vendor to keep and how to turn a product into a RawListing.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from ingest.models import RawListing
from ingest.sources.base import Source

PAGE_SIZE = 250
MAX_PAGES = 40  # ~10k products; a guard against an endless paginator


class ShopifySource(Source):
    #: Storefront origin, no trailing slash.
    base_url: str = ""
    #: Only products whose `vendor` contains this (case-insensitive) are kept.
    vendor: str = "Carol Christian Poell"

    def products(self) -> Iterator[dict[str, Any]]:
        """Every product of the configured vendor, across all pages."""
        wanted = self.vendor.lower()
        for page in range(1, MAX_PAGES + 1):
            url = f"{self.base_url}/products.json?limit={PAGE_SIZE}&page={page}"
            payload = self.get_json(url)
            batch = payload.get("products") or []
            if not batch:
                return
            for product in batch:
                if wanted in (product.get("vendor") or "").lower():
                    yield product

    def listings(self) -> Iterator[RawListing]:
        for product in self.products():
            listing = self.to_listing(product)
            if listing is not None:
                yield listing

    def to_listing(self, product: dict[str, Any]) -> RawListing | None:
        raise NotImplementedError

    # -- helpers shared by Shopify subclasses -----------------------------

    @staticmethod
    def image_urls(product: dict[str, Any]) -> list[str]:
        return [img["src"] for img in product.get("images", []) if img.get("src")]

    @staticmethod
    def first_sku(product: dict[str, Any]) -> str | None:
        for variant in product.get("variants", []):
            sku = (variant.get("sku") or "").strip()
            if sku:
                return sku
        return None

    @staticmethod
    def tag_value(product: dict[str, Any], prefix: str) -> str | None:
        """First tag with the given `prefix_`, minus the prefix.

        The Library tags products `gender_men`, `color_green`,
        `footwear_boots` and so on — cheaper and more reliable than reading it
        back out of the title.
        """
        for tag in product.get("tags", []):
            if tag.startswith(f"{prefix}_"):
                return tag[len(prefix) + 1 :]
        return None
