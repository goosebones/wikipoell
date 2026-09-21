"""alanbilzerian.com — BigCommerce.

The plainest of the sources: titles are descriptive ("L" Belt), and no article
code is published anywhere on the page. Everything here therefore reaches the
review queue by design — the value is discovering the garment exists and
capturing its images, not classifying it automatically.
"""

from __future__ import annotations

import re
from typing import Any

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.sources.darklands import guess_category
from ingest.sources.html_catalog import HtmlCatalogSource

BASE_URL = "https://www.alanbilzerian.com"
_BRAND_PREFIX = re.compile(r"^\s*carol\s+chr\w*\s+poell\s*", re.I)


class BilzerianSource(HtmlCatalogSource):
    name = "bilzerian"
    label = "Alan Bilzerian"
    base_url = BASE_URL
    start_urls = [(f"{BASE_URL}/carol-christian-poell/", {})]
    product_link_selector = (
        "li.product .card-title a[href], li.product .card-figure > a[href]"
    )

    def is_product_link(self, href: str) -> bool:
        # Cards also contain a wishlist link and a `#` quick-view trigger, and
        # the product url is a single path segment at the site root.
        if not href.startswith(BASE_URL) or "?" in href or "#" in href:
            return False
        path = href[len(BASE_URL) :].strip("/")
        return bool(path) and "/" not in path and not path.endswith(".php")

    def parse_detail(
        self, url: str, tree: HTMLParser, hints: dict[str, Any]
    ) -> RawListing | None:
        h1 = tree.css_first("h1")
        title = _BRAND_PREFIX.sub("", (h1.text() or "").strip()) if h1 else ""
        if not title:
            return None

        description = ""
        node = tree.css_first(".productView-description")
        if node:
            description = re.sub(r"\s+", " ", node.text() or "").strip()

        # The gallery holds every shot, but thumbnails are served at 100x100.
        # BigCommerce sizes are a path segment, so ask for the large variant.
        images = []
        for img in tree.css("[data-image-gallery] img, .productView-image img"):
            src = img.attributes.get("data-src") or img.attributes.get("src") or ""
            if not src.startswith("http"):
                continue
            src = re.sub(r"/stencil/\d+x\d+/", "/stencil/1280x1280/", src)
            images.append(src.split("?")[0])

        sku_node = tree.css_first("[itemprop=sku], .productView-info-value--sku")
        sku = (sku_node.text() or "").strip() if sku_node else None

        return RawListing(
            site_key=self.site_key(url),
            url=url,
            title=title,
            sku=sku or None,
            description=description[:2000] or None,
            images=list(dict.fromkeys(images)),
            category_hint=guess_category(title),
            raw={"note": "site publishes no article code"},
        )
