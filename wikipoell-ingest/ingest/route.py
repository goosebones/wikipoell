"""Decide where a draft goes: straight to the site, to the LLM, or to a person.

The rules are DESIGN.md §4.3. Two of them are worth restating because they
look arbitrary and are not:

  - An unknown vocabulary value goes to a **human**, not the LLM. Whether
    "XHORSASIS" should become a material is a vocabulary decision, and the LLM
    cannot make it — spending a call there buys nothing.
  - It still routes to the LLM first if something is *also* missing, so the
    person starts from a completed draft rather than a half-empty one.
"""

from __future__ import annotations

from ingest.config import (
    COLOR_EXEMPT_CATEGORY_PREFIX,
    LLM_CONFIDENCE_THRESHOLD,
    REQUIRED_FIELDS,
)
from ingest.models import Decision, Draft, Route
from ingest.normalize.title import is_well_formed
from ingest.normalize.vocabulary import Vocabulary


def required_fields_for(category: str | None) -> tuple[str, ...]:
    """Jewelry carries no color code, so color is not required there."""
    if category and category.startswith(COLOR_EXEMPT_CATEGORY_PREFIX):
        return tuple(f for f in REQUIRED_FIELDS if f != "color")
    return REQUIRED_FIELDS


def missing_fields(draft: Draft) -> list[str]:
    required = required_fields_for(draft.get("category"))
    return [name for name in required if draft.get(name) in (None, "", [])]


def decide(
    draft: Draft,
    vocab: Vocabulary,
    *,
    after_llm: bool = False,
    threshold: float = LLM_CONFIDENCE_THRESHOLD,
) -> Decision:
    human: list[str] = []

    for name, value in draft.unknown_values:
        human.append(f"unknown_vocab:{name}={value}")

    category = draft.get("category")
    if category is None:
        human.append("unknown_category")
    elif not vocab.knows_category(category):
        human.append(f"unknown_category:{category}")

    if draft.code_unparseable:
        code = draft.listing.article_code or ""
        human.append(f"code_unparseable:{code}")

    if not is_well_formed(draft.get("title")):
        human.append("title_unformatted")

    missing = missing_fields(draft)

    if after_llm:
        confidence = draft.llm_confidence if draft.llm_confidence is not None else 0.0
        if confidence < threshold:
            human.append(f"llm_low_confidence:{confidence:.2f}")
        # Anything the LLM failed to supply is not going to improve by asking
        # again, so it becomes a review reason rather than another LLM pass.
        human.extend(f"missing:{name}" for name in missing)
        return Decision(Route.HUMAN if human else Route.PUBLISH, human)

    if missing:
        # The LLM can fill gaps; it runs even alongside unknown-vocab reasons
        # so the human gets a complete draft. Reasons are carried forward.
        return Decision(Route.LLM, [f"missing:{name}" for name in missing] + human)

    return Decision(Route.HUMAN if human else Route.PUBLISH, human)
