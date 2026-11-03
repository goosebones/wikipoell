"""darklands.berlin — custom Drupal storefront.

Navigation: the HTML base, over separate men's and women's CCP pages, which
is where gender comes from (the detail page does not state it).

Images: the detail page's product gallery.

Attributes: the article code sits in a bare `<p>` in the product info, so it
is found by matching the code shape rather than a selector, which survives
the markup being re-themed. Category from title keywords, or failing that the
vendor category.

Details: the schema.org `category` ("Boots"), the composition line that
follows the code ("100% Cordovan Leather"), and the sizes.
"""

from __future__ import annotations

import re
from typing import Any

from ingest.models import Attributes, Detail
from ingest.normalize.article_code import parse_article_code
from ingest.sources.extract import clean, json_ld_product, node_text
from ingest.sources.html_catalog import HtmlCatalogSource, Page

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


def guess_category(text: str | None) -> str | None:
    """An archive category from keywords in a title or a vendor category."""
    upper = (text or "").upper()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(k in upper for k in keywords):
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

    def title(self, item: Page) -> str:
        # Trimmed but not collapsed, as when the stored hashes were computed.
        h1 = item.tree.css_first("h1")
        return (h1.text() or "").strip() if h1 else ""

    def _code_node(self, item: Page):
        for node in item.tree.css("p, span, div"):
            text = (node.text() or "").strip()
            if (
                6 <= len(text) <= 48
                and _CODE_LIKE.match(text)
                and parse_article_code(text)
            ):
                return node
        return None

    def images(self, item: Page) -> list[str]:
        out = []
        for img in item.tree.css(".product__images img, img.product__image"):
            src = img.attributes.get("src")
            if src:
                out.append(src if src.startswith("http") else BASE_URL + src)
        return out

    def attributes(self, item: Page) -> Attributes:
        code = self._code_node(item)
        vendor_category = json_ld_product(item.tree).get("category")
        return Attributes(
            article_code=(code.text() or "").strip() if code else None,
            gender=item.hints.get("gender"),
            category=guess_category(self.title(item))
            or guess_category(vendor_category),
        )

    def details(self, item: Page) -> dict[str, str]:
        code = self._code_node(item)
        # The composition is the paragraph after the code's.
        composition = code.next if code is not None else None
        while composition is not None and composition.tag != "p":
            composition = composition.next
        sizes = node_text(item.tree.css_first(".product__sizes"))
        return {
            Detail.VENDOR_CATEGORY: clean(json_ld_product(item.tree).get("category")),
            Detail.COMPOSITION: node_text(composition),
            Detail.SIZES: re.sub(r"^Sizes:\s*", "", sizes),
        }

    def raw(self, item: Page) -> dict[str, Any]:
        return {"gender_from": "entry page"}
