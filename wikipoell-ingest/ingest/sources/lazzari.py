"""lazzariweb.it — PrestaShop.

Reads the **detail page**, not the listing card. An earlier version took the
article code out of the card's `img alt`, which needed only three requests for
the whole catalog but was quietly wrong: on 21 of 65 products the alt yielded
a doubled fragment (`LM/2698 LM/2698`) that still *parses* — as material `LM`,
colour `2698`. That put a model number in the colour field of 35 garments.

The detail page carries `<span itemprop="mpn" class="reference">` with the
real code (`LM/2698-IN CORS-PTC/010`), present on all 65 products rather than
56. One request per product is worth that.

The scoped `.js-qv-product-images` gallery also yields ~6 images per garment
instead of the 2 on the card. Scope matters: a broad `img` sweep of the page
picks up related products from other brands entirely.
"""

from __future__ import annotations

import re
from typing import Any

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.sources.darklands import guess_category
from ingest.sources.html_catalog import HtmlCatalogSource

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

    def parse_detail(
        self, url: str, tree: HTMLParser, hints: dict[str, Any]
    ) -> RawListing | None:
        h1 = tree.css_first("h1")
        title = re.sub(r"\s+", " ", (h1.text() or "").strip()) if h1 else ""
        if not title:
            return None

        # The brand and any embedded code are stripped centrally by
        # format_title(); the raw heading is kept here as the source of truth.
        reference = tree.css_first("[itemprop=mpn], .reference")
        code = (
            re.sub(r"\s+", " ", (reference.text() or "").strip()) if reference else None
        )

        images = []
        for img in tree.css(".js-qv-product-images img"):
            src = (
                img.attributes.get("data-image-large-src")
                or img.attributes.get("data-full-size-image-url")
                or img.attributes.get("src")
                or ""
            )
            if src.startswith("http"):
                images.append(src.split("?")[0])

        description = ""
        node = tree.css_first("#description, .product-description")
        if node:
            description = re.sub(r"\s+", " ", node.text() or "").strip()

        return RawListing(
            site_key=url.replace(BASE_URL, "").split("?")[0],
            url=url,
            title=title,
            article_code=code or None,
            description=description[:2000] or None,
            images=list(dict.fromkeys(images)),
            category_hint=guess_category(title),
            raw={"reference": code},
        )
