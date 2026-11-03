"""Small helpers for reading product data out of HTML and JSON.

Shared by every source so the same kind of page is read the same way: prose
flattened to text, labeled rows read into pairs, schema.org data and meta
tags looked up by name.
"""

from __future__ import annotations

import html
import json
import re
from urllib.parse import urljoin

from selectolax.parser import HTMLParser, Node

_TAGS = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
# Block-level breaks, for splitting markup into its visible lines.
_BREAKS = re.compile(r"<br\s*/?>|</(?:p|div|li|h[1-6]|tr|center)>", re.I)

DESCRIPTION_LIMIT = 2000


def clean(text: str | None) -> str:
    """Whitespace collapsed and trimmed; "" for nothing."""
    return _SPACE.sub(" ", text or "").strip()


def html_text(markup: str | None, limit: int = DESCRIPTION_LIMIT) -> str | None:
    """Markup flattened to one line of text, or None when there is none.

    The steps and their order are what produced the stored content hashes
    (tags out, whitespace collapsed, then entities decoded), so changing them
    makes every listing that uses this look changed.
    """
    text = _TAGS.sub(" ", markup or "")
    text = html.unescape(_SPACE.sub(" ", text)).strip()
    return text[:limit] or None


def html_lines(markup: str | None) -> list[str]:
    """The visible lines of a block of markup, empty ones and "-" dropped."""
    text = _BREAKS.sub("\n", markup or "")
    lines = (clean(html.unescape(_TAGS.sub(" ", line))) for line in text.split("\n"))
    return [line for line in lines if line and line != "-"]


def node_text(node: Node | None) -> str:
    return clean(node.text()) if node is not None else ""


def pairs(tree: HTMLParser | Node, row: str, label: str, value: str) -> dict[str, str]:
    """Labeled rows as label → value: `pairs(t, "tr", "th", "td")`.

    Labels lose a trailing ":" or " -". Rows without a value are left out.
    """
    out: dict[str, str] = {}
    for node in tree.css(row):
        name, text = node.css_first(label), node.css_first(value)
        key = re.sub(r"\s*[:\-]\s*$", "", node_text(name))
        if key and node_text(text):
            out.setdefault(key, node_text(text))
    return out


def definition_list(node: Node | None) -> dict[str, str]:
    """A `<dl>`'s terms → definitions, in order."""
    if node is None:
        return {}
    terms = [node_text(n) for n in node.css("dt")]
    values = [node_text(n) for n in node.css("dd")]
    return {t: v for t, v in zip(terms, values, strict=False) if t and v}


def json_ld(tree: HTMLParser) -> list[dict]:
    """Every schema.org object on the page, `@graph`s unpacked."""
    out: list[dict] = []
    for script in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.text())
        except ValueError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict):
                out.extend(item.get("@graph") or [item])
    return out


def json_ld_product(tree: HTMLParser) -> dict:
    """The page's schema.org product, or {}."""
    for item in json_ld(tree):
        kind = item.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if any(k in ("Product", "IndividualProduct", "ProductModel") for k in kinds):
            return item
    return {}


def meta(tree: HTMLParser, name: str) -> str:
    """A `<meta>` tag's content, by `property` or `name`."""
    node = tree.css_first(f'meta[property="{name}"], meta[name="{name}"]')
    return clean(node.attributes.get("content")) if node is not None else ""


def absolute(base: str, src: str | None) -> str:
    return urljoin(base + "/", src.strip()) if src else ""


def joined(values: list[str] | None) -> str:
    """A list as one detail line: "7, 8, 9, 10"."""
    return ", ".join(v for v in (clean(v) for v in values or []) if v)
