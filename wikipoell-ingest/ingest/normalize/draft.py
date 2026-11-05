"""Turn a RawListing into a Draft using deterministic rules only.

Confidence here means "how much does the source of this value justify
publishing it unseen". A value read out of a structured article code is
certain; one inferred from a title is not.
"""

from __future__ import annotations

from dataclasses import replace

from ingest.models import Draft, Origin, RawListing
from ingest.normalize.article_code import parse_article_code
from ingest.normalize.category import resolve_category
from ingest.normalize.title import format_title
from ingest.normalize.vocabulary import VOCAB_FIELDS, Vocabulary

CODE_CONFIDENCE = 1.0
HINT_CONFIDENCE = 0.9
TITLE_CONFIDENCE = 0.6
# A model's suggested category is right for nearly all of its garments.
MODEL_CONFIDENCE = 0.95


def normalize(listing: RawListing, vocab: Vocabulary) -> Draft:
    draft = Draft(listing=listing)

    title = listing.title if listing.title_is_final else format_title(listing.title)
    if title:
        draft.set("title", title, CODE_CONFIDENCE, Origin.TITLE)

    attrs = listing.attributes
    parsed = parse_article_code(attrs.article_code)
    if parsed and parsed.ambiguous:
        # `AM/2603-IN 6` vs `PF/0916-ASA/8`: identical shape, and only the
        # vocabulary says whether the dashed token is a procedure or a
        # material. A material means the code attaches it with a dash — a form
        # we do not read yet, so treat the whole code as unparseable rather
        # than file a material under `procedure`.
        if any(vocab.knows("material", token) for token in parsed.ambiguous):
            parsed = None
        else:
            procedures = [*(parsed.procedure or []), *parsed.ambiguous]
            parsed = replace(parsed, procedure=procedures, ambiguous=None)

    if parsed and parsed.material and parsed.process:
        # `CON-EDGE`, `X-NIGHT`: the hyphen usually separates material from
        # process, but some material names contain one — or a space, which
        # retailers write as a hyphen. Only the vocabulary can tell `CON-EDGE`
        # (one material) from `CORS-PTC` (material + process), so if the two
        # halves spell a material when rejoined, that is what they are.
        for joiner in (" ", "-"):
            joined = f"{parsed.material}{joiner}{parsed.process}"
            if vocab.knows("material", joined):
                parsed = replace(parsed, material=joined, process=None)
                break

    if parsed:
        draft.set("type", parsed.type, CODE_CONFIDENCE, Origin.CODE)
        draft.set("gender", parsed.gender, CODE_CONFIDENCE, Origin.CODE)
        draft.set("model", parsed.model, CODE_CONFIDENCE, Origin.CODE)
        draft.set("procedure", parsed.procedure, CODE_CONFIDENCE, Origin.CODE)
        draft.set("material", parsed.material, CODE_CONFIDENCE, Origin.CODE)
        draft.set("process", parsed.process, CODE_CONFIDENCE, Origin.CODE)
        draft.set("color", parsed.color, CODE_CONFIDENCE, Origin.CODE)
    elif attrs.article_code:
        # The site showed a code we cannot read. That is a signal in itself:
        # never guess past it.
        draft.code_unparseable = True

    # Site-supplied hints fill gaps the code did not, and never override it.
    if attrs.color and "color" not in draft.fields:
        draft.set("color", attrs.color, HINT_CONFIDENCE, Origin.HINT)
    if attrs.gender and "gender" not in draft.fields:
        draft.set("gender", attrs.gender, HINT_CONFIDENCE, Origin.HINT)

    # The site's own category: either already resolved (the-library maps its
    # Shopify tags directly) or a section name for the keyword rules
    # (ccp-room: "leather", "footwear").
    site_category, site_confidence, site_origin = None, 0.0, Origin.HINT
    if vocab.knows_category(attrs.category):
        site_category, site_confidence = attrs.category, HINT_CONFIDENCE
    else:
        site_category = resolve_category(attrs.category, title)
        site_confidence, site_origin = TITLE_CONFIDENCE, Origin.TITLE

    # A known model settles the category, unless the site's is more specific
    # within it: a model filed under "footwear" keeps "footwear.sneakers".
    model_category = vocab.model_category(draft.get("model"))
    if vocab.knows_category(model_category) and not (
        site_category and site_category.startswith(f"{model_category}.")
    ):
        draft.set("category", model_category, MODEL_CONFIDENCE, Origin.MODEL)
    elif site_category:
        draft.set("category", site_category, site_confidence, site_origin)

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
