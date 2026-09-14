"""Parse CCP article codes.

Ported from `legacy/ccp-room/backfill-article-codes.js`, which is the stricter
of the two regexes that existed (it handles `=` in procedure and material, and
the accessory-only short form).

Format:  {TYPE}{GENDER}/{MODEL}[{PROC}][-{PROC}] {MATERIAL}[-{PROCESS}]/{COLOR}

    LM/2699-IN BIMS-PTC/19       type=L gender=M model=2699 proc=[IN] …
    LM/2638R-IN CORS-PTC/010     proc=[R, IN]
    LM//2399 BIMS-PTC/12         double slash before the model
    OM/2734-IN XITCH/7           no process segment
    MM/1914                      short form: metal accessories, no material
"""

from __future__ import annotations

import re
from dataclasses import dataclass

FULL = re.compile(
    r"^([A-Z])([MF])/{1,2}([0-9]+)([A-Z=]*)(?:-([A-Z/=]+))?"
    r"\s+([A-Z=]+)(?:-([A-Z]+))?/(.+?)\s*$"
)
SHORT = re.compile(r"^([A-Z])([MF])/{1,2}([0-9]+[A-Z]*)\s*$")


@dataclass(frozen=True)
class ParsedCode:
    type: str | None = None
    gender: str | None = None
    model: str | None = None
    procedure: list[str] | None = None
    material: str | None = None
    process: str | None = None
    color: str | None = None


def parse_article_code(article: str | None) -> ParsedCode | None:
    """Return the parsed code, or None when it does not match either form.

    None is meaningful: a listing that shows a code we cannot read is routed
    to a human rather than guessed at.
    """
    if not article or not article.strip():
        return None
    text = article.strip()

    if m := FULL.match(text):
        type_, gender, model, attached, dashed, material, process, color = m.groups()
        procedures = [p for p in (attached, dashed) if p]
        return ParsedCode(
            type=type_,
            gender=gender,
            model=model,
            procedure=procedures or None,
            material=material,
            process=process or None,
            color=color,
        )

    if m := SHORT.match(text):
        type_, gender, model = m.groups()
        return ParsedCode(type=type_, gender=gender, model=model)

    return None
