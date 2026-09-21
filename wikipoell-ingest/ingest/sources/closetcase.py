"""closetcase.co — Shopify storefront.

The whole shop is `vendor: CCP`, and the **product title is the article code**
(`AM/2793-IN/ST CORSS / 01`), so there is nothing to infer from prose. Codes
are spaced idiosyncratically, which `clean_article_code()` handles.

Category comes from the `CATEGORY_*` tag, which is cleaner than `product_type`
(that field mixes casing and singular/plural: "Shoes", "JACKETS", "rings").
"""

from __future__ import annotations

import html
import re
from typing import Any

from ingest.models import RawListing
from ingest.sources.shopify import ShopifySource

BASE_URL = "https://closetcase.co"
_TAGS = re.compile(r"<[^>]+>")

_CATEGORY_BY_TAG = {
    "JACKETS": "outerwear.jackets",
    "COATS": "outerwear.coats",
    "VESTS": "outerwear.vests",
    "SHOES": "footwear.shoes",
    "SNEAKERS": "footwear.sneakers",
    "BOOTS": "footwear.boots",
    "SHIRTS": "tops.shirts",
    "SWEATERS": "tops.sweatersAndKnitwear",
    "TSHIRTS": "tops.shortSleeveTshirts",
    "PANTS": "bottoms.trousers",
    "TROUSERS": "bottoms.trousers",
    "SHORTS": "bottoms.shorts",
    "NECKLACES": "accessories.jewelry.necklaces",
    "RINGS": "accessories.jewelry.rings",
    "BRACELETS": "accessories.jewelry.bracelets",
    "EARRINGS": "accessories.jewelry.earrings",
    "BELTS": "accessories.belts",
    "GLOVES": "accessories.gloves",
    "BAGS": "accessories.bags",
    "WALLETS": "accessories.smallObjects",
    "KEYRING": "accessories.smallObjects",
    "SCARVES": "accessories.scarves",
    "SOCKS": "accessories.socks",
}


class ClosetcaseSource(ShopifySource):
    name = "closetcase"
    label = "Closet Case"
    base_url = BASE_URL
    vendor = "CCP"

    def to_listing(self, product: dict[str, Any]) -> RawListing | None:
        handle = (product.get("handle") or "").strip()
        if not handle:
            return None

        tags = product.get("tags") or []
        category_hint = next(
            (
                _CATEGORY_BY_TAG[tag[len("CATEGORY_") :]]
                for tag in tags
                if tag.startswith("CATEGORY_")
                and tag[len("CATEGORY_") :] in _CATEGORY_BY_TAG
            ),
            None,
        )
        description = _TAGS.sub(" ", product.get("body_html") or "")
        description = html.unescape(re.sub(r"\s+", " ", description)).strip()
        title = (product.get("title") or "").strip()

        return RawListing(
            site_key=f"/products/{handle}",
            url=f"{BASE_URL}/products/{handle}",
            title=title,
            sku=self.first_sku(product),
            # The title *is* the code here; there is no separate field.
            article_code=title or None,
            description=description[:2000] or None,
            images=self.image_urls(product),
            category_hint=category_hint,
            raw={
                "id": product.get("id"),
                "product_type": product.get("product_type"),
                "tags": tags,
            },
        )
