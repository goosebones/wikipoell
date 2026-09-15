"""thelibrary1994.com — Shopify storefront.

Two things make this source different from ccp-room:

1. **The article code is split across three labels** in `body_html`:
   `MODEL: MM/2144`, `MATERIAL: ROOMS-PTC (100% KANGAROO)`, `COLOUR: 10 (BLACK)`.
   No product carries a full code in one piece — verified across all 361.
   Reassembling them gives `MM/2144 ROOMS-PTC/10`, which the shared parser in
   `normalize/article_code.py` reads without modification.

2. **Tags carry structured hints** — `footwear_boots`, `gender_men` — which are
   far more reliable than keyword-matching the title.

Site key is `/products/<handle>`, matching the URL path the existing 313
garments were backfilled from.
"""

from __future__ import annotations

import html
import re
from typing import Any

from ingest.models import RawListing
from ingest.sources.shopify import ShopifySource

BASE_URL = "https://thelibrary1994.com"

# <strong>MODEL:</strong><span> MM/2144</span> — the label set is inconsistent
# in the source data ("COLOR", and "METERIAL" twice), so accept the variants.
# The colon is sometimes inside the <strong> and sometimes after it, which is
# why the trailing colon is stripped from the value as well (_LEADING_COLON):
# without that, codes came out as ": 7" and broke the article-code parser.
_LABEL = re.compile(
    r"<strong>\s*(MODEL|MATERIAL|METERIAL|COLOUR|COLOR)\s*:?\s*</strong>"
    r"\s*(?:<span>)?\s*([^<]*)",
    re.I,
)
_LEADING_COLON = re.compile(r"^\s*:\s*")
# Strip a parenthetical gloss: "ROOMS-PTC (100% KANGAROO)" -> "ROOMS-PTC",
# "10 (BLACK)" -> "10".
_GLOSS = re.compile(r"\s*[\(\[].*$")
_TAGS = re.compile(r"<[^>]+>")

# Shopify tag prefix -> archive category.
_CATEGORY_BY_TAG = {
    "clothing_jackets": "outerwear.jackets",
    "clothing_coats": "outerwear.coats",
    "clothing_knitwear": "tops.sweatersAndKnitwear",
    "clothing_tops": "tops",
    "clothing_trousers": "bottoms.trousers",
    "clothing_pants": "bottoms.trousers",
    "clothing_jeans": "bottoms.denim",
    "clothing_shorts": "bottoms.shorts",
    "footwear_boots": "footwear.boots",
    "footwear_shoes": "footwear.shoes",
    "footwear_trainers": "footwear.sneakers",
    "accessories_gloves": "accessories.gloves",
    "accessories_necklace": "accessories.jewelry.necklaces",
    "accessories_rings": "accessories.jewelry.rings",
    "accessories_bag": "accessories.bags",
    "accessories_belt": "accessories.belts",
    "accessories_tie": "accessories.ties",
    "accessories_scarf": "accessories.scarves",
    "accessories_socks": "accessories.socks",
    # accessories_objects has no archive category, like ccp-room's "objects".
}

_GENDER_BY_TAG = {"men": "M", "women": "F", "male": "M", "female": "F"}


def _labels(body_html: str | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for label, value in _LABEL.findall(body_html or ""):
        key = label.upper()
        if key == "METERIAL":
            key = "MATERIAL"
        if key == "COLOR":
            key = "COLOUR"
        cleaned = _LEADING_COLON.sub("", html.unescape(value))
        cleaned = _GLOSS.sub("", cleaned).strip().upper()
        if cleaned and key not in out:
            out[key] = cleaned
    return out


def build_article_code(labels: dict[str, str]) -> str | None:
    """Reassemble `MODEL MATERIAL/COLOUR` into a single CCP article code.

    Returns the MODEL alone when the other two are absent — the parser's short
    form handles that. Values that are words rather than codes ("SILVER",
    "GREEN") are passed through unchanged: they parse, then fail the vocabulary
    check, which routes the listing to a person. That is the honest outcome.
    """
    model = labels.get("MODEL")
    if not model:
        return None
    material, colour = labels.get("MATERIAL"), labels.get("COLOUR")
    if material and colour:
        return f"{model} {material}/{colour}"
    return model


class TheLibrarySource(ShopifySource):
    name = "the-library"
    label = "The Library"
    base_url = BASE_URL

    def to_listing(self, product: dict[str, Any]) -> RawListing | None:
        handle = (product.get("handle") or "").strip()
        if not handle:
            return None

        labels = _labels(product.get("body_html"))
        category_hint = next(
            (
                _CATEGORY_BY_TAG[tag]
                for tag in product.get("tags", [])
                if tag in _CATEGORY_BY_TAG
            ),
            None,
        )
        gender_tag = self.tag_value(product, "gender")
        description = _TAGS.sub(" ", product.get("body_html") or "")
        description = html.unescape(re.sub(r"\s+", " ", description)).strip()

        return RawListing(
            site_key=f"/products/{handle}",
            url=f"{BASE_URL}/products/{handle}",
            title=(product.get("title") or "").strip(),
            sku=self.first_sku(product),
            article_code=build_article_code(labels),
            description=description[:2000] or None,
            images=self.image_urls(product),
            gender_hint=_GENDER_BY_TAG.get((gender_tag or "").lower()),
            category_hint=category_hint,
            color_hint=labels.get("COLOUR"),
            raw={
                "id": product.get("id"),
                "product_type": product.get("product_type"),
                "tags": product.get("tags"),
                "labels": labels,
            },
        )
