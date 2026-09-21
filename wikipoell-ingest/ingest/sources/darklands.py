"""darklands.berlin — custom Drupal storefront.

Men's and women's CCP pages are separate, which is where gender comes from —
the detail page does not state it. The article code sits in a bare `<p>` on
the detail page, so it is found by matching the code shape rather than a
selector, which survives the markup being re-themed.
"""

from __future__ import annotations

import re
from typing import Any

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.normalize.article_code import parse_article_code
from ingest.sources.html_catalog import HtmlCatalogSource

BASE_URL = "https://darklands.berlin"
_PRODUCT_PATH = re.compile(r"/tiefgarage/carol-christian-poell[^/]*/.+")
_CODE_LIKE = re.compile(
    r"^[A-Z]{1,2}/{1,2}\s?\d{3,5}[A-Z=]*(?:[-/][A-Z/=]+)*(?:\s.+)?$"
)

_CATEGORY_KEYWORDS = [
    (("BOOT",), "footwear.boots"),
    (("SNEAKER", "TRAINER"), "footwear.sneakers"),
    (("DERBY", "SHOE"), "footwear.shoes"),
    (("PARKA",), "outerwear.parkas"),
    (("BOMBER",), "outerwear.bombers"),
    (("BLAZER",), "outerwear.blazers"),
    (("COAT", "TRENCH", "CABAN"), "outerwear.coats"),
    (("JACKET",), "outerwear.jackets"),
    (("VEST",), "outerwear.vests"),
    (("TROUSER", "PANT"), "bottoms.trousers"),
    (("SHIRT",), "tops.shirts"),
    (("KNIT", "SWEATER"), "tops.sweatersAndKnitwear"),
    (("NECKLACE", "CHAIN"), "accessories.jewelry.necklaces"),
    (("RING",), "accessories.jewelry.rings"),
    (("GLOVE",), "accessories.gloves"),
    (("BELT",), "accessories.belts"),
    (("BAG",), "accessories.bags"),
]


def guess_category(title: str | None) -> str | None:
    text = (title or "").upper()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(k in text for k in keywords):
            return category
    return None


class DarklandsSource(HtmlCatalogSource):
    name = "darklands"
    label = "Darklands"
    base_url = BASE_URL
    start_urls = [
        (f"{BASE_URL}/tiefgarage/carol-christian-poell", {"gender": "M"}),
        (f"{BASE_URL}/tiefgarage/carol-christian-poell-womens", {"gender": "F"}),
    ]
    product_link_selector = "article.product a[href]"

    def is_product_link(self, href: str) -> bool:
        return bool(_PRODUCT_PATH.search(href))

    def parse_detail(
        self, url: str, tree: HTMLParser, hints: dict[str, Any]
    ) -> RawListing | None:
        h1 = tree.css_first("h1")
        title = (h1.text() or "").strip() if h1 else ""
        if not title:
            return None

        # The code is its own paragraph; match on shape so a re-theme does not
        # break it.
        code = None
        for node in tree.css("p, span, div"):
            text = (node.text() or "").strip()
            if (
                6 <= len(text) <= 48
                and _CODE_LIKE.match(text)
                and parse_article_code(text)
            ):
                code = text
                break

        images = []
        for img in tree.css(".product__images img, img.product__image"):
            src = img.attributes.get("src")
            if src:
                images.append(src if src.startswith("http") else BASE_URL + src)

        return RawListing(
            site_key=self.site_key(url),
            url=url,
            title=title,
            article_code=code,
            images=list(dict.fromkeys(images)),
            gender_hint=hints.get("gender"),
            category_hint=guess_category(title),
            raw={"gender_from": "entry page"},
        )
