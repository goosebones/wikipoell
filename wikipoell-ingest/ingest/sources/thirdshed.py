"""thethirdshed.com — WooCommerce.

Navigation and images: the WooCommerce base (the Store API). Every product is
CCP, but the brand name never appears anywhere, so a "does it mention Carol
Christian Poell" filter finds nothing. Products are kept instead when their
**name parses as an article code**; anything else is skipped rather than
guessed at, so a future non-CCP product cannot slip in. The shop lists some
photos twice, which the framework drops.

Attributes: the name, which is the article code (`AM/2793-IN CORSS-PTC/01`).
Categories, SKUs and attributes are all empty in this shop.

Details: the descriptive name the shop writes as the first line of the
description (`OBJECT DYED GOODYEAR SLANT COCKLE BOOT`), and any further
lines with words in them as features.
"""

from __future__ import annotations

import re

from ingest.models import Attributes, Detail
from ingest.normalize.article_code import parse_article_code
from ingest.sources.extract import html_lines
from ingest.sources.woocommerce import Product, WooCommerceSource

BASE_URL = "https://www.thethirdshed.com"


class ThirdShedSource(WooCommerceSource):
    name = "thirdshed"
    label = "The Third Shed"
    base_url = BASE_URL

    def is_wanted(self, item: Product) -> bool:
        return parse_article_code(self.title(item)) is not None

    def attributes(self, item: Product) -> Attributes:
        return Attributes(article_code=self.title(item))

    def details(self, item: Product) -> dict[str, str]:
        # Lines without letters are reference numbers, not features.
        lines = [
            line
            for line in html_lines(item.get("description"))
            if re.search("[A-Za-z]", line)
        ]
        return {
            Detail.NAME: lines[0] if lines else "",
            Detail.FEATURES: "; ".join(lines[1:]),
        }
