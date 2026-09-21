"""lazzariweb.it — PrestaShop.

Unusually generous: the listing card's `img alt` contains the full article
code ("… AM/2609 black combat boots AM/2609-IN CORS-PTC/010 order online"),
so no detail request is needed at all and the whole catalog costs one request
per page of 24.
"""

from __future__ import annotations

import re
from collections.abc import Iterator

from selectolax.parser import HTMLParser

from ingest.models import RawListing
from ingest.normalize.article_code import parse_article_code
from ingest.sources.base import Source
from ingest.sources.darklands import guess_category

BASE_URL = "https://www.lazzariweb.it"
START_URL = f"{BASE_URL}/en/carol-christian-poell-m-15.html"
MAX_PAGES = 30
# The longest code-shaped run in the alt text is the article code.
_CODE = re.compile(
    r"[A-Z]{1,2}/{1,2}\d{3,5}[A-Z=]*(?:-[A-Z/=]+)?\s+[A-Z=]+(?:-[A-Z]+)?/[0-9A-Z*]+"
)


class LazzariSource(Source):
    name = "lazzari"
    label = "Lazzari"

    def listings(self) -> Iterator[RawListing]:
        seen: set[str] = set()
        for page in range(1, MAX_PAGES + 1):
            url = START_URL if page == 1 else f"{START_URL}?page={page}"
            tree = HTMLParser(self.get_text(url))
            cards = tree.css("article.product-miniature")
            fresh = 0
            for card in cards:
                listing = self._to_listing(card)
                if listing is None or listing.site_key in seen:
                    continue
                seen.add(listing.site_key)
                fresh += 1
                yield listing
            if fresh == 0:
                return

    def _to_listing(self, card) -> RawListing | None:
        link = card.css_first("a.product-thumbnail, a[href*='-p-']")
        if link is None:
            return None
        url = (link.attributes.get("href") or "").strip()
        if not url:
            return None

        img = card.css_first("img")
        alt = (img.attributes.get("alt") or "") if img else ""
        match = _CODE.search(alt)
        code = match.group(0) if match else None

        # `data-full-size-image-url` is the largest available; fall back to src.
        images = []
        for node in card.css("img"):
            src = (
                node.attributes.get("data-full-size-image-url")
                or node.attributes.get("src")
                or ""
            )
            if src.startswith("http"):
                images.append(src)

        name_node = card.css_first(".product-title, h2, h3")
        title = re.sub(r"\s+", " ", (name_node.text() if name_node else alt)).strip()
        # Strip the code and the SEO tail out of the display title.
        if code:
            title = title.replace(code, "").strip()
        title = re.sub(r"\s*(order )?online\s*$", "", title, flags=re.I).strip()

        return RawListing(
            site_key=url.replace(BASE_URL, "").split("?")[0],
            url=url,
            title=title or alt[:120],
            article_code=code if code and parse_article_code(code) else code,
            images=list(dict.fromkeys(images)),
            category_hint=guess_category(title),
            raw={"alt": alt[:200]},
        )
