"""thelibrary1994.com — Shopify storefront.

Navigation and images: the Shopify base (`/products.json`, vendor "Carol
Christian Poell").

Attributes: **the article code is split across three labels** in `body_html`:
`MODEL: MM/2144`, `MATERIAL: ROOMS-PTC (100% KANGAROO)`, `COLOUR: 10 (BLACK)`.
No product carries a full code in one piece. Reassembling them gives
`MM/2144 ROOMS-PTC/10`, which the shared parser reads without modification.
Gender and category come from tags (`gender_men`, `footwear_boots`), which are
far more reliable than keyword-matching the title.

Details: the material and colour labels as written, glosses included
(`ROOMS-PTC (100% KANGAROO)`, `10 (BLACK)`), plus the base's product type,
sizes and tags. The description carries the shop's prose about the piece.

Site key is `/products/<handle>`.
"""

from __future__ import annotations

import html
import re

from ingest.models import Attributes, Detail
from ingest.sources.shopify import Product, ShopifySource

BASE_URL = "https://thelibrary1994.com"

# <strong>MODEL:</strong><span> MM/2144</span>, or <b>MODEL:</b> MM/2149 on
# listings added since autumn 2026 — the label set is inconsistent
# in the source data ("COLOR", and "METERIAL" twice), so accept the variants.
# The colon is sometimes inside the <strong> and sometimes after it, which is
# why the trailing colon is stripped from the value as well (_LEADING_COLON):
# without that, codes came out as ": 7" and broke the article-code parser.
_LABEL = re.compile(
    r"<(?:strong|b)>\s*(MODEL|MATERIAL|METERIAL|COLOUR|COLOR)\s*:?\s*</(?:strong|b)>"
    r"\s*(?:<span>)?\s*([^<]*)",
    re.I,
)
_LEADING_COLON = re.compile(r"^\s*:\s*")
# Strip a parenthetical gloss: "ROOMS-PTC (100% KANGAROO)" -> "ROOMS-PTC",
# "10 (BLACK)" -> "10".
_GLOSS = re.compile(r"\s*[\(\[].*$")

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


def _written(body_html: str | None) -> dict[str, str]:
    """MODEL, MATERIAL and COLOUR as written, glosses included."""
    out: dict[str, str] = {}
    for label, value in _LABEL.findall(body_html or ""):
        key = label.upper()
        if key == "METERIAL":
            key = "MATERIAL"
        if key == "COLOR":
            key = "COLOUR"
        text = _LEADING_COLON.sub("", html.unescape(value)).strip()
        if text and key not in out:
            out[key] = text
    return out


def _labels(body_html: str | None) -> dict[str, str]:
    """The same labels as codes: glosses stripped, upper case."""
    labels = {
        k: _GLOSS.sub("", v).strip().upper() for k, v in _written(body_html).items()
    }
    return {k: v for k, v in labels.items() if v}


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

    def attributes(self, item: Product) -> Attributes:
        labels = _labels(item.get("body_html"))
        return Attributes(
            article_code=build_article_code(labels),
            sku=self.first_sku(item),
            gender=_GENDER_BY_TAG.get((self.tag_value(item, "gender") or "").lower()),
            category=next(
                (
                    _CATEGORY_BY_TAG[t]
                    for t in item.get("tags", [])
                    if t in _CATEGORY_BY_TAG
                ),
                None,
            ),
            color=labels.get("COLOUR"),
        )

    def details(self, item: Product) -> dict[str, str]:
        written = _written(item.get("body_html"))
        return {
            Detail.MATERIAL: written.get("MATERIAL", ""),
            Detail.COLOR: written.get("COLOUR", ""),
            **super().details(item),
        }
