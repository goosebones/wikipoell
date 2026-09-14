"""Format a listing title into house style.

Extends `formatTitle()` from `legacy/agent-review/review.js`. The legacy version
stripped one trailing `/COLOR` segment; the live ccp-room catalog often carries
two or three (`…HOOSIE/19/st`, `…JKT/010/blck`), so that left 119 of 579 titles
with a slash still in them.

Slashes cannot simply be cut at the first occurrence: a handful of real titles
contain one (`HAAR/DARK BROWN HAIR TIE`, and one that begins with an article
code). So trailing segments are stripped only while they look like metadata —
short and space-free. That takes slash-bearing titles from 542 to 9, and those
nine are genuinely malformed and route to a person.
"""

from __future__ import annotations

import re

# A trailing "/token" where token is short and has no spaces: /19, /010, /19*,
# /bims, /blck, /010-pacal. Applied repeatedly. A segment with a space in it
# ("/black rubber") is real text and stops the loop.
_TRAILING_META = re.compile(r"/[^/\s]{1,12}\s*$")

_ABBREVIATIONS: list[tuple[re.Pattern[str], str]] = [
    # O.D. / O. D. / O. D, / O.DYED / O. DYED — 343 of 579 titles use one of these.
    (re.compile(r"\bO\.\s*D(?:\.|,|YED\b)", re.I), "Object Dyed "),
    (re.compile(r"\bL\.\s*(?:JACKET|JKT)\b", re.I), "Leather Jacket"),
    (re.compile(r"\bJKT\b", re.I), "Jacket"),
    (re.compile(r"\bH\.\s*NECK\b", re.I), "High Neck"),
    # "2 B. LEATHER" — the corpus spells this out as "2 BUTTON" 13 times.
    (re.compile(r"\b(\d)\s*B\.", re.I), r"\1 Button"),
]

_PUNCT = re.compile(r"[,.]")
_SPACES = re.compile(r"\s+")
_WORD_START = re.compile(r"(^|[\s\-.])(\w)")
# "LEATHER L. JKT" expands to "Leather Leather Jacket"; no real title repeats a
# word back to back.
_DOUBLED_WORD = re.compile(r"\b(\w+)(\s+\1)+\b", re.I)


def strip_metadata_suffixes(text: str) -> str:
    previous = None
    while previous != text:
        previous = text
        text = _TRAILING_META.sub("", text).strip()
    return text


def format_title(raw: str | None) -> str | None:
    if not raw:
        return None
    text = strip_metadata_suffixes(raw.strip())
    for pattern, replacement in _ABBREVIATIONS:
        text = pattern.sub(replacement, text)
    text = _PUNCT.sub("", text)
    text = _SPACES.sub(" ", text).strip().lower()
    text = _WORD_START.sub(lambda m: m.group(1) + m.group(2).upper(), text)
    text = _DOUBLED_WORD.sub(r"\1", text)
    return text.strip() or None


def is_well_formed(title: str | None) -> bool:
    """True when a title is safe to publish without a person looking at it.

    Rejects the leftovers that mean the source data was odd: too short, still
    carrying a slash, or with no letters in it at all.
    """
    if not title or len(title) < 3:
        return False
    if "/" in title:
        return False
    return any(ch.isalpha() for ch in title)
