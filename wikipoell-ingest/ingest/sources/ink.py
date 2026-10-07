"""ink-clothing.com — custom storefront, men's and women's.

The detail page's `h1` is the article code, written without the slash after
type+gender and with the model/material groups separated by " / "
(`AM2795-IN / XWARTS 010`). The missing slash is handled by the shared
cleaner; the separator is site-specific and normalised here.

Gender comes from which brand page the product was listed on.

That h1 is also the only name these products have — there is no descriptive
title on the site — so it is published verbatim (`title_is_final`) rather than
reformatted or sent to the LLM to have a sentence invented for it.
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


# `AM2601L / BUUS 010 AF0901L / BUUS 010` — some headings carry the men's
# code and the women's equivalent back to back. The first is the product on
# the page; a second code starts a new type+gender+model run.
_SECOND_CODE = re.compile(r"\s+(?=[A-Z]{2,3}[0-9]{3,})")
# `… ROOLS 01 (SPECIAL)`, `… WIM 10 SPECIAL` — a release marker, not code.
_SPECIAL_SUFFIX = re.compile(r"\s*\(?\bSPECIAL\b\)?\s*$", re.IGNORECASE)


def normalize_code(raw: str) -> str:
    """`AM2795-IN / XWARTS 010` -> `AM2795-IN XWARTS 010`.

    Here " / " separates the model group from the material group, where
    elsewhere it separates material from colour — so it becomes a space, not
    a slash, and the shared cleaner handles the rest.

    Also drops the two things ink appends to a code: a repeated women's
    equivalent, and a `SPECIAL` release marker. Both defeat every form in
    `article_code`, and neither belongs to the product being described.
    """
    text = _SPECIAL_SUFFIX.sub("", raw.strip())
    text = _SECOND_CODE.split(text)[0]
    return re.sub(r"\s+/\s+", " ", text.strip())


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
            title_is_final=True,
            gender_hint=hints.get("gender"),
            category_hint=guess_category(heading),
            raw={"heading": heading},
        )
