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

from ingest.normalize.article_code import clean_article_code, parse_article_code

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

# The brand name in a title is noise — every garment in the archive is CCP.
# Retailers put it in as an SEO prefix (lazzari does on all 65 of its
# listings) or as a label ("CAROL CHRSTIAN POELL \"L\" BELT" — bilzerian's own
# typo included, hence `chr\w*`). Stripped anywhere in the string, not just at
# the front.
_BRAND = re.compile(
    r"\b(?:carol\s+chr\w*\s+poell|c\.?\s?c\.?\s?p\.?)\b",
    re.I,
)

# An article code inside a *display* title is noise — the code lives in its own
# fields. lazzari embeds it ("Carol Christian Poell AM/2609 black combat
# boots"); the module cannot strip it itself because the title carries a
# title-cased short form while the alt text has the full uppercase code.
# Requires 3-5 digits after the slash so "1/2 Zip" and "S/S" are untouched.
_EMBEDDED_CODE = re.compile(
    r"\b[A-Z]{1,2}/{1,2}\d{3,5}[A-Z=]*(?:-[A-Z/=]+)?"
    r"(?:\s+[A-Z=]+(?:-[A-Z]+)?/[0-9A-Z*]+)?",
    re.I,
)

_PUNCT = re.compile(r"[,.]")
_SPACES = re.compile(r"\s+")
_WORD_START = re.compile(r"(^|[\s\-.\"'])(\w)")
# "LEATHER L. JKT" expands to "Leather Leather Jacket"; no real title repeats a
# word back to back.
_DOUBLED_WORD = re.compile(r"\b(\w+)(\s+\1)+\b", re.I)


def strip_metadata_suffixes(text: str) -> str:
    previous = None
    while previous != text:
        previous = text
        text = _TRAILING_META.sub("", text).strip()
    return text


def strip_brand(text: str) -> str:
    """Remove the brand name and its abbreviations from a title."""
    cleaned = _BRAND.sub(" ", text)
    # Tidy the separators the removal leaves behind: a leading dash, a double
    # space, a stranded hyphen between words.
    # Removal can leave a separator dangling: a leading dash, a trailing
    # comma, or a hyphen that used to join the brand to the next word
    # ("CCP-style" -> "-style").
    cleaned = re.sub(r"(^|\s)[-–—]+(?=\w)", r"\1", cleaned)
    cleaned = re.sub(r"^\s*[-–—:|,]+\s*", "", cleaned)
    cleaned = re.sub(r"\s*[-–—:|,]+\s*$", "", cleaned)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def strip_article_code(text: str) -> str:
    """Drop an embedded article code, unless it is all the title has.

    A listing whose title is *only* a code (closetcase, thirdshed) keeps it —
    there is nothing else to show, and the deterministic pass still reads the
    code from the `article_code` field regardless.
    """
    stripped = _EMBEDDED_CODE.sub(" ", text)
    stripped = re.sub(r"\s{2,}", " ", stripped).strip(" -–—:|,")
    if len(stripped) < 6 or len(stripped.split()) < 2:
        return text
    return stripped


#: Longest a string can be and still be treated as "just an article code".
#: Keeps `AM/2793-IN/ST CORSS/01` (22) while letting a malformed prose title
#: that happens to parse, like `AM/2624 PABER-PTC/01 BIPOLAR PAPER DART BELT/01`
#: (47), fall through to normal formatting.
_CODE_TITLE_MAX = 40


def is_code_title(text: str) -> bool:
    """True when the title is nothing but an article code."""
    cleaned = clean_article_code(text)
    return len(cleaned) <= _CODE_TITLE_MAX and parse_article_code(cleaned) is not None


def format_title(raw: str | None) -> str | None:
    if not raw:
        return None

    # closetcase and thirdshed name their products with the article code and
    # nothing else. Such a title must survive intact: suffix-stripping would
    # eat the colour off the end (`MM/2144` -> `Mm`) and title-casing would
    # mangle the rest. Return it canonicalised instead.
    if is_code_title(raw.strip()):
        return clean_article_code(raw.strip()).upper()

    text = strip_brand(strip_metadata_suffixes(raw.strip()))
    text = strip_article_code(text)
    if not text:
        return None
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
