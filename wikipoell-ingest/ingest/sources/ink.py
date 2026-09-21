"""ink-clothing.com — custom storefront, men's and women's.

The detail page's `h1` is the article code, written without the slash after
type+gender and with the model/material groups separated by " / "
(`AM2795-IN / XWARTS 010`). The missing slash is handled by the shared
cleaner; the separator is site-specific and normalised here.

Gender comes from which brand page the product was listed on.
"""

from __future__ import annotations

import re
from typing import Any

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.sources.darklands import guess_category
from ingest.sources.html_catalog import HtmlCatalogSource

BASE_URL = "https://ink-clothing.com"
BRAND = "Carol-Christian-Poell"


def normalize_code(raw: str) -> str:
    """`AM2795-IN / XWARTS 010` -> `AM2795-IN XWARTS 010`.

    Here " / " separates the model group from the material group, where
    elsewhere it separates material from colour — so it becomes a space, not
    a slash, and the shared cleaner handles the rest.
    """
    return re.sub(r"\s+/\s+", " ", raw.strip())


class InkSource(HtmlCatalogSource):
    name = "ink"
    label = "INK"
    base_url = BASE_URL
    start_urls = [
        (f"{BASE_URL}/en/Man/brands/60/{BRAND}/NONE/id=347", {"gender": "M"}),
        (f"{BASE_URL}/en/Woman/brands/60/{BRAND}/NONE/id=347", {"gender": "F"}),
    ]
    product_link_selector = "a.product"
    # The brand page lists the whole catalog at once.
    page_param = None

    def is_product_link(self, href: str) -> bool:
        return "/detail/" in href

    def parse_detail(
        self, url: str, tree: HTMLParser, hints: dict[str, Any]
    ) -> RawListing | None:
        h1 = tree.css_first("h1")
        heading = re.sub(r"\s+", " ", (h1.text() or "").strip()) if h1 else ""
        if not heading:
            return None

        images = []
        for img in tree.css("img"):
            src = img.attributes.get("src") or ""
            if "content_product" in src:
                # Thumbnails are proxied through thumb.php; take the original.
                match = re.search(r"src=(https?://[^&]+)", src)
                images.append(match.group(1) if match else src)
            elif src.startswith("http") and "/product" in src:
                images.append(src)

        return RawListing(
            site_key=self.site_key(url),
            url=url,
            title=heading,
            article_code=normalize_code(heading),
            images=list(dict.fromkeys(images)),
            gender_hint=hints.get("gender"),
            category_hint=guess_category(heading),
            raw={"heading": heading},
        )
