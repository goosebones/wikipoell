"""closetcase.co — Shopify storefront.

Navigation and images: the Shopify base (`/products.json`). The whole shop is
`vendor: CCP`.

Attributes: **the product title is the article code**
(`AM/2793-IN/ST CORSS / 01`), spaced idiosyncratically, which the shared
cleaner handles. Category comes from the `CATEGORY_*` tag, which is cleaner
than `product_type` (that mixes casing and singular/plural: "Shoes",
"JACKETS", "rings").

Details: the `COLOR_*` tag as the color name, and the description's lines as
features — the shop writes them as a list ("Treated and distressed leather",
"Oxide / rust drops"), minus its contact boilerplate. Plus the base's product
type, sizes and tags.
"""

from __future__ import annotations

from ingest.models import Attributes, Detail
from ingest.sources.extract import html_lines
from ingest.sources.shopify import Product, ShopifySource

BASE_URL = "https://closetcase.co"

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

# Lines of the shop's own boilerplate, not about the garment.
_BOILERPLATE = ("contact us", "for further details", "interested in a purchase")


class ClosetcaseSource(ShopifySource):
    name = "closetcase"
    label = "Closet Case"
    base_url = BASE_URL
    vendor = "CCP"

    def attributes(self, item: Product) -> Attributes:
        categories = (
            _CATEGORY_BY_TAG.get(tag.removeprefix("CATEGORY_"))
            for tag in item.get("tags", [])
            if tag.startswith("CATEGORY_")
        )
        return Attributes(
            # The title *is* the code here; there is no separate field.
            article_code=self.title(item) or None,
            sku=self.first_sku(item),
            category=next((c for c in categories if c), None),
        )

    def details(self, item: Product) -> dict[str, str]:
        features = [
            line
            for line in html_lines(item.get("body_html"))
            if not any(b in line.lower() for b in _BOILERPLATE)
        ]
        color = (self.tag_value(item, "COLOR") or "").title()
        return {
            Detail.COLOR: color,
            Detail.FEATURES: "; ".join(features),
            **super().details(item),
        }
