"""ink-clothing.com — custom storefront, men's and women's.

Navigation: the HTML base, over the men's and women's brand pages, each of
which lists the whole catalog at once. Gender comes from which page a product
was listed on.

Images: the detail page's product photos (`content_product`), with thumbnail
proxies (`thumb.php?src=…`) resolved to the original.

Attributes: the `h1` is the article code, written without the slash after
type+gender and with " / " between the model and material groups
(`AM2795-IN / XWARTS 010`); `normalize_code()` fixes the separator and the
shared cleaner the rest. That h1 is also the title, published verbatim
(`title_is_final`).

Details: the product table's Collection and Material rows, and the block
under the Inquire button, which holds the only descriptive name the product
has (`OBJECT DYED X-REVERSE JAIL COAT`) and its size.
"""

from __future__ import annotations

import re
from typing import Any

from ingest.models import Attributes, Detail
from ingest.sources.darklands import guess_category
from ingest.sources.extract import html_lines, pairs
from ingest.sources.html_catalog import HtmlCatalogSource, Page

BASE_URL = "https://ink-clothing.com"
BRAND = "Carol-Christian-Poell"


# `AM2601L / BUUS 010 AF0901L / BUUS 010` — some headings carry the men's
# code and the women's equivalent back to back. The first is the product on
# the page; a second code starts a new type+gender+model run.
_SECOND_CODE = re.compile(r"\s+(?=[A-Z]{2,3}[0-9]{3,})")
# `… ROOLS 01 (SPECIAL)`, `… WIM 10 SPECIAL` — a release marker, not code.
_SPECIAL_SUFFIX = re.compile(r"\s*\(?\bSPECIAL\b\)?\s*$", re.IGNORECASE)
# The shop's contact boilerplate, which follows the name and size.
_CONTACT = re.compile(r"^-{3,}|PLEASE CONTACT|@INK-CLOTHING|MORE INFORMATION", re.I)


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
    page_param = None
    title_is_final = True

    def is_product_link(self, href: str) -> bool:
        return "/detail/" in href

    def images(self, item: Page) -> list[str]:
        out = []
        for img in item.tree.css("img"):
            src = img.attributes.get("src") or ""
            if "content_product" in src:
                # Thumbnails are proxied through thumb.php; take the original.
                match = re.search(r"src=(https?://[^&]+)", src)
                out.append(match.group(1) if match else src)
            elif src.startswith("http") and "/product" in src:
                out.append(src)
        return out

    def attributes(self, item: Page) -> Attributes:
        heading = self.title(item)
        return Attributes(
            article_code=normalize_code(heading),
            gender=item.hints.get("gender"),
            category=guess_category(self._name(item) or heading),
        )

    def _notes(self, item: Page) -> list[str]:
        """The lines under the Inquire button, up to the contact boilerplate."""
        block = item.tree.css_first(".product_detail_right center")
        lines = html_lines(block.html if block else "")
        end = next(
            (i for i, line in enumerate(lines) if _CONTACT.search(line)), len(lines)
        )
        return lines[:end]

    def _name(self, item: Page) -> str:
        names = [
            line for line in self._notes(item) if not line.upper().startswith("SIZE")
        ]
        return names[0] if names else ""

    def details(self, item: Page) -> dict[str, str]:
        table = pairs(
            item.tree.css_first(".product_info") or item.tree, "tr", "td", "td + td"
        )
        sizes = [
            re.sub(r"^SIZE\s*:\s*", "", line, flags=re.I)
            for line in self._notes(item)
            if line.upper().startswith("SIZE")
        ]
        collection = table.get("Collection", "")
        return {
            Detail.NAME: self._name(item),
            Detail.COLLECTION: "" if collection.upper() == "NONE" else collection,
            Detail.MATERIAL: table.get("Material", ""),
            Detail.SIZES: re.sub(r"\s*,\s*", ", ", ", ".join(sizes)),
        }

    def raw(self, item: Page) -> dict[str, Any]:
        return {"heading": self.title(item)}
