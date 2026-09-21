"""shelter2.com — Japanese hosted cart (shop-pro).

Product names are Japanese, so titles carry little signal — but the article
codes are not, and they appear in the detail page text. The codes do the work
here; the category comes from the section heading.

The shop serves EUC-JP; httpx decodes from the declared charset, so no
special handling is needed beyond not assuming UTF-8.
"""

from __future__ import annotations

import re
from typing import Any

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.normalize.article_code import parse_article_code
from ingest.sources.darklands import guess_category
from ingest.sources.html_catalog import HtmlCatalogSource

BASE_URL = "https://shelter2.com"
_CODE = re.compile(
    r"\b[A-Z]{1,2}/{1,2}\d{3,5}[A-Z=]*(?:-[A-Z/=]+)?"
    r"(?:\s+[A-Z=]+(?:-[A-Z]+)?\s*/\s*[0-9A-Z*]+)?"
)


class Shelter2Source(HtmlCatalogSource):
    name = "shelter2"
    label = "Shelter2"
    base_url = BASE_URL
    start_urls = [(f"{BASE_URL}/?mode=grp&gid=1127171", {})]
    product_link_selector = "a[href*='pid=']"

    def is_product_link(self, href: str) -> bool:
        return "pid=" in href and "mode=grp" not in href

    def site_key(self, url: str) -> str:
        match = re.search(r"pid=(\d+)", url)
        return f"/pid/{match.group(1)}" if match else url.replace(BASE_URL, "")

    def parse_detail(
        self, url: str, tree: HTMLParser, hints: dict[str, Any]
    ) -> RawListing | None:
        body = tree.body
        text = re.sub(r"\s+", " ", body.text() if body else "")

        # Prefer the longest code-shaped match: a full code beats a bare model.
        candidates = [c for c in _CODE.findall(text) if parse_article_code(c)]
        code = max(candidates, key=len) if candidates else None

        heading = tree.css_first("h2")
        section = re.sub(r"\s+", " ", (heading.text() or "").strip()) if heading else ""

        images = []
        for img in tree.css("img"):
            src = img.attributes.get("src") or ""
            if "/product/" in src and "_th." not in src:
                images.append(src.split("?")[0])

        title = section or (code or "")
        if not title:
            return None

        return RawListing(
            site_key=self.site_key(url),
            url=url,
            title=title,
            article_code=code,
            images=list(dict.fromkeys(images)),
            category_hint=guess_category(section),
            raw={"section": section},
        )
