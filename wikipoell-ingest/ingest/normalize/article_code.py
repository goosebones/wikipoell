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

The model is always digits only. Letters immediately after it are a procedure,
attached rather than dashed — `OM/2656OD-IN` is model 2656 with procedures OD
and IN, not a model called "2656OD". Checked against all 1,118 garments that
have a model: only 14 carried letters and every one was a parse failure.

Nothing validates the split here, deliberately. `PM/26710D-IN` yields procedure
`D`, which is not in the vocabulary, so it routes to a human — the site really
does print `26710D`, almost certainly a typo for `2671OD`. Same for the `N` in
`OM/2658B-N`. Guessing the intent is the review queue's job, not the parser's.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

FULL = re.compile(
    r"^([A-Z])([MF])/{1,2}([0-9]+)([A-Z=]*)(?:-([A-Z/=]+))?"
    r"\s+([A-Z=]{2,}(?:\s+[A-Z=]{2,})+|[A-Z=]+)(?:-([A-Z]+))?/(.+?)\s*$"
)
# Short form: no material/process/colour. The optional `-PROC` tail covers
# retailer listings like `PM/26710D-IN`, which are otherwise complete.
SHORT = re.compile(r"^([A-Z])([MF])/{1,2}([0-9]+)([A-Z=]*)(?:-([A-Z/=]+))?\s*$")

# Material but no colour — `MM/2144 SILVER`, `AM/2685C CORS`. Jewellery mostly:
# silver pieces carry no colour code, which is also why routing exempts
# `accessories.jewelry` from requiring one. Worth 14 listings across
# closetcase, thirdshed and lazzari, and nothing to the two canonical sources.
MEDIUM = re.compile(
    r"^([A-Z])([MF])/{1,2}([0-9]+)([A-Z=]*)(?:-([A-Z/=]+))?"
    r"\s+([A-Z=]{2,}(?:\s+[A-Z=]{2,})+|[A-Z=]+)(?:-([A-Z]+))?\s*$"
)

# Colour but no material — `AM/2603-IN 6`, `GM/2690-IN / 9`, `VM/2589S /103`.
# Worth 17 listings, all closetcase, every one of which lost its whole code.
#
# The dashed run is captured *unclassified*: `-IN 6` (procedure) and `-ASA/8`
# (material) are the same shape, and only the vocabulary separates them. This
# module does not consult it, so `normalize()` makes that call — see
# `ParsedCode.ambiguous`. No slash inside the run, or `-IN / BETWEEN/10` would
# swallow its material.
NO_MATERIAL = re.compile(
    r"^([A-Z])([MF])/{1,2}([0-9]+)([A-Z=]*)((?:-[A-Z=]+)*)[\s/]+([0-9]+[A-Z*]*)\s*$"
)

# A material may be several words — `ON EDGE`, `KIT BW`, `CON EDGE`. In that
# case every word needs two letters: no multi-word material in the vocabulary
# has a shorter one, and allowing it lets `AM/2600 L BIUS 19` read its `L`
# procedure as the start of a material called "L BIUS". A single-token
# material keeps the old rule, so `X-NIGHT` still splits as before.
#
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
# `X≡NIT`, `XΞNIT` — the material is `X=NIT`. ccp-room writes U+2261 IDENTICAL
# TO and ink writes U+039E GREEK CAPITAL XI; both are the same glyph intent.
_EQUALS_LOOKALIKE = re.compile(r"[\u2261\u039e\u03be]")
# `KMR/2785-IN …` — a third letter in the type+gender slot. Every stored copy
# of model 2785 (ten, across ccp-room, the-library and ink, human-reviewed
# among them) records `KM/2785` with procedure `IN` and no `R`, so the letter
# carries nothing this schema has a field for and is dropped rather than
# filed as a procedure it demonstrably is not.
_THIRD_HEAD_LETTER = re.compile(r"^([A-Z])([MF])[A-Z](?=/?[0-9])")


def clean_article_code(raw: str) -> str:
    """Normalise a retailer's spelling and spacing before parsing.

    Mostly whitespace: `LM/ 2776-IN …`, `… CORSS / 01`, `… CORS 19`. Two
    character-level rules go with them — an `=` written as `≡` or `Ξ`, and a
    stray third letter in the type+gender slot (`KMR/2785`). Neither invents
    a token; see the pattern definitions for why each is safe.
    """
    text = _EQUALS_LOOKALIKE.sub("=", raw.strip())
    text = _THIRD_HEAD_LETTER.sub(r"\1\2", text)
    text = _MISSING_SLASH.sub(r"\1\2/", text)
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
    # Dash-separated tokens that are a procedure or a material depending on the
    # vocabulary. Set only by NO_MATERIAL; `normalize()` resolves and clears it.
    ambiguous: tuple[str, ...] | None = None


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

    if m := MEDIUM.match(text):
        type_, gender, model, attached, dashed, material, process = m.groups()
        procedures = [p for p in (attached, dashed) if p]
        return ParsedCode(
            type=type_,
            gender=gender,
            model=model,
            procedure=procedures or None,
            material=material,
            process=process or None,
        )

    if m := NO_MATERIAL.match(text):
        type_, gender, model, attached, dashed, color = m.groups()
        tokens = [t for t in dashed.split("-") if t]
        return ParsedCode(
            type=type_,
            gender=gender,
            model=model,
            procedure=[attached] if attached else None,
            color=color,
            ambiguous=tuple(tokens) or None,
        )

    if m := SHORT.match(text):
        type_, gender, model, attached, dashed = m.groups()
        procedures = [p for p in (attached, dashed) if p]
        return ParsedCode(
            type=type_,
            gender=gender,
            model=model,
            procedure=procedures or None,
        )

    return None
