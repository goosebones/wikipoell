"""lazzariweb.it — PrestaShop.

Navigation: the HTML base, over the paginated CCP brand page, following each
product to its **detail page**. An earlier version took the article code from
the listing card's `img alt`, which needed only three requests for the whole
catalog but was quietly wrong: on 21 of 65 products the alt yielded a doubled
fragment (`LM/2698 LM/2698`) that still *parses*, as material `LM` and colour
`2698`.

Images: the scoped `.js-qv-product-images` gallery (~6 per garment), at full
size. Scope matters: a broad `img` sweep picks up other brands' products.

Attributes: `<span itemprop="mpn" class="reference">` carries the real code
(`LM/2698-IN CORS-PTC/010`). Category from title keywords.

Details: the data sheet (`dl.data-sheet`: "Color", "Composition"). The long
description, which often says how a piece was dyed and what it is lined with,
is the description.
"""

from __future__ import annotations

import re
from typing import Any

from ingest.models import Attributes, Detail
from ingest.sources.darklands import guess_category
from ingest.sources.extract import clean, definition_list, node_text
from ingest.sources.html_catalog import HtmlCatalogSource, Page

BASE_URL = "https://www.lazzariweb.it"
START_URL = f"{BASE_URL}/en/carol-christian-poell-m-15.html"
_PRODUCT_PATH = re.compile(r"-p-\d+\.html$")


class LazzariSource(HtmlCatalogSource):
    name = "lazzari"
    label = "Lazzari"
    base_url = BASE_URL
    start_urls = [(START_URL, {})]
    product_link_selector = "article.product-miniature a.product-thumbnail"

    def is_product_link(self, href: str) -> bool:
        return bool(_PRODUCT_PATH.search(href))

    def site_key(self, item: Page) -> str | None:
        return item.url.replace(BASE_URL, "").split("?")[0]

    def description(self, item: Page) -> str | None:
        node = item.tree.css_first("#description, .product-description")
        return clean(node.text() if node else "")[:2000] or None

    def images(self, item: Page) -> list[str]:
        out = []
        for img in item.tree.css(".js-qv-product-images img"):
            src = (
                img.attributes.get("data-image-large-src")
                or img.attributes.get("data-full-size-image-url")
                or img.attributes.get("src")
                or ""
            )
            if src.startswith("http"):
                out.append(src.split("?")[0])
        return out

    def attributes(self, item: Page) -> Attributes:
        reference = node_text(item.tree.css_first("[itemprop=mpn], .reference"))
        return Attributes(
            article_code=reference or None,
            category=guess_category(self.title(item)),
        )

    def details(self, item: Page) -> dict[str, str]:
        sheet = definition_list(item.tree.css_first("dl.data-sheet"))
        return {
            Detail.COLOR: sheet.pop("Color", ""),
            Detail.COMPOSITION: sheet.pop("Composition", ""),
            **sheet,
        }

    def raw(self, item: Page) -> dict[str, Any]:
        return {
            "reference": node_text(item.tree.css_first("[itemprop=mpn], .reference"))
        }
