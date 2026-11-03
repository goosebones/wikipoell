"""ccp-room.com — the brand's own catalog.

Navigation: the whole catalog is one page, in sections (leather, clothes,
footwear, accessories, objects). Every product is an
`<a class="info__catalog-item">` whose data-* attributes carry the entire
record, so one fetch yields ~579 listings and no product page is visited.

Images: `data-img`, reversed — see `images()`.

Attributes: `data-article` is the full article code; `data-color` the color
code; the section is the category hint ("objects" has no archive category and
resolves to None by design).

Details: the color name (`data-titlecolor`) and the composition
(`data-composition`, "50% LE - 50% PE"). The composition is also the
description, as it always has been, so stored content hashes still match.

Site key is the URL **fragment** (`/catalog/#<slug>`), because the path is
identical for every product on the site.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from selectolax.parser import HTMLParser, Node

from ingest.models import Attributes, Detail
from ingest.sources.base import Source

BASE_URL = "https://www.ccp-room.com"
CATALOG_URL = f"{BASE_URL}/catalog/"
SECTIONS = ("leather", "clothes", "footwear", "accessories", "objects")

# A product node and the section it was listed in.
Item = tuple[Node, str]


def _data(item: Item, name: str) -> str:
    return (item[0].attributes.get(f"data-{name}") or "").strip()


class CcpRoomSource(Source[Item]):
    name = "ccp-room"
    label = "CCP-ROOM"

    def items(self) -> Iterator[Item]:
        tree = HTMLParser(self.get_text(CATALOG_URL))
        for section in SECTIONS:
            container = tree.css_first(f'div.info__wrap[id="{section}"]')
            if container is None:
                continue
            for node in container.css("a.info__catalog-item"):
                # The class appears on an inner element too; only the real
                # item carries data-id.
                if node.attributes.get("data-id") is not None:
                    yield node, section

    def site_key(self, item: Item) -> str | None:
        return (item[0].attributes.get("href") or "").strip().lstrip("#") or None

    def url(self, item: Item) -> str:
        return f"{CATALOG_URL}{(item[0].attributes.get('href') or '').strip()}"

    def title(self, item: Item) -> str:
        return _data(item, "name")

    def description(self, item: Item) -> str | None:
        return _data(item, "composition") or None

    def images(self, item: Item) -> list[str]:
        # data-img is NOT display order. The site's gallery is built with
        #     dataset.img.split(",").forEach(e =>
        #         wrapper.insertAdjacentHTML("afterbegin", …))
        # — iterating forwards while *prepending*, so a visitor sees the list
        # back to front. Reverse it so the archive matches the site.
        paths = [p.strip() for p in _data(item, "img").split(",") if p.strip()]
        return [f"{BASE_URL}{path}" for path in paths][::-1]

    def attributes(self, item: Item) -> Attributes:
        return Attributes(
            article_code=_data(item, "article") or None,
            category=item[1],
            color=_data(item, "color") or None,
        )

    def details(self, item: Item) -> dict[str, str]:
        return {
            Detail.COLOR: _data(item, "titlecolor"),
            Detail.COMPOSITION: _data(item, "composition"),
        }

    def raw(self, item: Item) -> dict[str, Any]:
        return {
            "id": _data(item, "id"),
            "section": item[1],
            "instock": _data(item, "instock"),
        }
