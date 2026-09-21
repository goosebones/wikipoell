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
# Short form: no material/process/colour. The optional `-PROC` tail covers
# retailer listings like `PM/26710D-IN`, which are otherwise complete.
SHORT = re.compile(r"^([A-Z])([MF])/{1,2}([0-9]+[A-Z]*)(?:-([A-Z/=]+))?\s*$")

# Retailers space these codes out in ways CCP does not. Normalising first
# lifted parse rates substantially where the product *title* is the code:
# closetcase 65->110 of 141, thirdshed 306->314 of 335, the-library 144->149,
# with no change at all to ccp-room, which writes them canonically.
_SLASH_AFTER = re.compile(r"/\s+")
_SLASH_BEFORE = re.compile(r"\s+/")
# `AM/2755SP-IN CORS 19` — colour separated from material by a space.
_SPACED_COLOUR = re.compile(r"(\s[A-Z=]+(?:-[A-Z]+)?)\s+([0-9]+[A-Z*]*)$")
# `AM2795-IN …` — ink-clothing drops the slash after type+gender entirely.
_MISSING_SLASH = re.compile(r"^([A-Z])([MF])(?=[0-9])")


def clean_article_code(raw: str) -> str:
    """Normalise a retailer's spacing before parsing.

    Handles `LM/ 2776-IN …`, `… CORSS / 01` and `… CORS 19`. Purely
    whitespace-level: no token is added, removed or reinterpreted.
    """
    text = _MISSING_SLASH.sub(r"\1\2/", raw.strip())
    text = _SLASH_AFTER.sub("/", text)
    text = _SLASH_BEFORE.sub("/", text)
    return _SPACED_COLOUR.sub(r"\1/\2", text)


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
    text = clean_article_code(article)

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
        type_, gender, model, procedure = m.groups()
        return ParsedCode(
            type=type_,
            gender=gender,
            model=model,
            procedure=[procedure] if procedure else None,
        )

    return None
