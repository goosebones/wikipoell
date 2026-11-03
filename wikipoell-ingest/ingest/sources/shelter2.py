"""shelter2.com — Japanese hosted cart (shop-pro).

Navigation: the HTML base, over the CCP group page; products are `?pid=<id>`
links. The shop serves EUC-JP, which httpx decodes from the declared charset.

Images: the product gallery under `#product` (main photo and thumbnails).
Scope matters: a broad sweep picks up other products' photos.

Attributes: the detail table labels the article number 品番
(`AM/2600L LUC-PTC`), which stops before the color. The color option names
the color with its code (`black (10)`), so when the product comes in one color
the two are joined into a full code (`AM/2600L LUC-PTC/10`). Without the
table, the longest code-shaped text on the page is used instead. Category
from keywords in the product name.

Details: the English product name (the `h2`, `GOODYEAR DERBYS`), the material
row 素材 (`CORDOVAN`), the color options and the sizes. The Japanese prose
about the piece is the description.

Site key is `/pid/<id>`.
"""

from __future__ import annotations

import re
from typing import Any

from ingest.models import Attributes, Detail
from ingest.normalize.article_code import parse_article_code
from ingest.sources.darklands import guess_category
from ingest.sources.extract import clean, joined, node_text, pairs
from ingest.sources.html_catalog import HtmlCatalogSource, Page

BASE_URL = "https://shelter2.com"
_CODE = re.compile(
    r"\b[A-Z]{1,2}/{1,2}\d{3,5}[A-Z=]*(?:-[A-Z/=]+)?"
    r"(?:\s+[A-Z=]+(?:-[A-Z]+)?\s*/\s*[0-9A-Z*]+)?"
)
# "black (10)" -> "10"
_COLOR_CODE = re.compile(r"\(\s*([0-9]{1,3}[A-Z]?)\s*\)")

ARTICLE_NUMBER = "品番"
MATERIAL = "素材"


class Shelter2Source(HtmlCatalogSource):
    name = "shelter2"
    label = "Shelter2"
    base_url = BASE_URL
    start_urls = [(f"{BASE_URL}/?mode=grp&gid=1127171", {})]
    product_link_selector = "a[href*='pid=']"

    def is_product_link(self, href: str) -> bool:
        return "pid=" in href and "mode=grp" not in href

    def site_key(self, item: Page) -> str | None:
        match = re.search(r"pid=(\d+)", item.url)
        return f"/pid/{match.group(1)}" if match else item.url.replace(BASE_URL, "")

    def title(self, item: Page) -> str:
        return node_text(item.tree.css_first("#product h2")) or (self._code(item) or "")

    def _table(self, item: Page) -> dict[str, str]:
        return pairs(item.tree, "table.item-detail tr", "th", "td")

    def _colors(self, item: Page) -> list[str]:
        # The page carries the option list twice (select and stock table).
        options = item.tree.css("select[name=option1] option")
        return list(dict.fromkeys(node_text(o) for o in options))

    def _code(self, item: Page) -> str | None:
        number = self._table(item).get(ARTICLE_NUMBER)
        colors = [
            m.group(1) for c in self._colors(item) if (m := _COLOR_CODE.search(c))
        ]
        if number and number.count("/") == 1 and len(colors) == 1:
            return f"{number}/{colors[0]}"
        if number:
            return number
        # No table: the longest code-shaped text; a full code beats a model.
        text = node_text(item.tree.body)
        candidates = [c for c in _CODE.findall(text) if parse_article_code(c)]
        return max(candidates, key=len) if candidates else None

    def description(self, item: Page) -> str | None:
        node = item.tree.css_first("div.product-order-exp")
        if node is None:
            return None
        text = node_text(node)
        table = node.css_first("table")
        if table is not None:
            text = clean(text.replace(node_text(table), ""))
        return text[:2000] or None

    def images(self, item: Page) -> list[str]:
        return [
            (img.attributes.get("src") or "").split("?")[0]
            for img in item.tree.css("#product .product-image img")
        ]

    def attributes(self, item: Page) -> Attributes:
        colors = [
            m.group(1) for c in self._colors(item) if (m := _COLOR_CODE.search(c))
        ]
        return Attributes(
            article_code=self._code(item),
            category=guess_category(self.title(item)),
            color=colors[0] if len(colors) == 1 else None,
        )

    def details(self, item: Page) -> dict[str, str]:
        # The stock table: a color header row, then one row per size.
        head = item.tree.css_first("tr.stock_head")
        rows = head.parent.css("tr") if head is not None and head.parent else []
        sizes = [
            node_text(row.css_first("th"))
            for row in rows
            if "stock_head" not in (row.attributes.get("class") or "")
        ]
        return {
            Detail.NAME: node_text(item.tree.css_first("#product h2")),
            Detail.MATERIAL: self._table(item).get(MATERIAL, ""),
            Detail.COLOR: joined(self._colors(item)),
            Detail.SIZES: joined([s for s in sizes if s]),
        }

    def raw(self, item: Page) -> dict[str, Any]:
        return {"table": self._table(item)}
