"""Turn a RawListing into a Draft using deterministic rules only.

Confidence here means "how much does the source of this value justify
publishing it unseen". A value read out of a structured article code is
certain; one inferred from a title is not.
"""

from __future__ import annotations

from ingest.models import Draft, Origin, RawListing
from ingest.normalize.article_code import parse_article_code
from ingest.normalize.category import resolve_category
from ingest.normalize.title import format_title
from ingest.normalize.vocabulary import VOCAB_FIELDS, Vocabulary

CODE_CONFIDENCE = 1.0
HINT_CONFIDENCE = 0.9
TITLE_CONFIDENCE = 0.6


def normalize(listing: RawListing, vocab: Vocabulary) -> Draft:
    draft = Draft(listing=listing)

    title = format_title(listing.title)
    if title:
        draft.set("title", title, CODE_CONFIDENCE, Origin.TITLE)

    parsed = parse_article_code(listing.article_code)
    if parsed:
        draft.set("type", parsed.type, CODE_CONFIDENCE, Origin.CODE)
        draft.set("gender", parsed.gender, CODE_CONFIDENCE, Origin.CODE)
        draft.set("model", parsed.model, CODE_CONFIDENCE, Origin.CODE)
        draft.set("procedure", parsed.procedure, CODE_CONFIDENCE, Origin.CODE)
        draft.set("material", parsed.material, CODE_CONFIDENCE, Origin.CODE)
        draft.set("process", parsed.process, CODE_CONFIDENCE, Origin.CODE)
        draft.set("color", parsed.color, CODE_CONFIDENCE, Origin.CODE)
    elif listing.article_code:
        # The site showed a code we cannot read. That is a signal in itself:
        # never guess past it.
        draft.code_unparseable = True

    # Site-supplied hints fill gaps the code did not, and never override it.
    if listing.color_hint and "color" not in draft.fields:
        draft.set("color", listing.color_hint, HINT_CONFIDENCE, Origin.HINT)
    if listing.gender_hint and "gender" not in draft.fields:
        draft.set("gender", listing.gender_hint, HINT_CONFIDENCE, Origin.HINT)

    # A source may hand us either a section name to run keyword rules against
    # (ccp-room: "leather", "footwear") or an already-resolved category
    # (the-library maps its Shopify tags directly). Trust the latter.
    if vocab.knows_category(listing.category_hint):
        draft.set("category", listing.category_hint, HINT_CONFIDENCE, Origin.HINT)
    else:
        category = resolve_category(listing.category_hint, title)
        if category:
            draft.set("category", category, TITLE_CONFIDENCE, Origin.TITLE)

    for name in VOCAB_FIELDS:
        if name in draft.fields:
            fv = draft.fields[name]
            fv.value = vocab.canonicalize(name, fv.value)

    draft.unknown_values = collect_unknown(draft, vocab)
    return draft


def collect_unknown(draft: Draft, vocab: Vocabulary) -> list[tuple[str, str]]:
    """Every (field, value) pair outside the vocabulary."""
    unknown: list[tuple[str, str]] = []
    for name in VOCAB_FIELDS:
        value = draft.get(name)
        if value is None:
            continue
        unknown.extend((name, v) for v in vocab.unknown_values(name, value))
    return unknown
