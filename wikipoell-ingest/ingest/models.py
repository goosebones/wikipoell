"""The shapes that flow through the pipeline.

RawListing  — what a source module produces. No classification.
FieldValue  — one normalised field, with why we believe it.
Draft       — a listing's fields after normalisation (and maybe the LLM).
Decision    — where the draft goes: publish, llm, or human.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class Origin(StrEnum):
    """Where a field's value came from. Shown in admin review."""

    CODE = "code"  # parsed from the article code
    SKU = "sku"  # parsed from the site's SKU
    TITLE = "title"  # inferred from the listing title
    HINT = "hint"  # given by the site (section, entry URL, …)
    LLM = "llm"


class Route(StrEnum):
    PUBLISH = "publish"
    LLM = "llm"
    HUMAN = "human"


@dataclass(frozen=True)
class RawListing:
    """One product as a site presents it. Source modules produce only this."""

    site_key: str
    url: str
    title: str
    sku: str | None = None
    article_code: str | None = None
    description: str | None = None
    images: list[str] = field(default_factory=list)
    gender_hint: str | None = None
    category_hint: str | None = None
    color_hint: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    def content_hash(self) -> str:
        """Stable digest of everything we'd re-process if it changed.

        Deliberately excludes site_key and url (identity, not content) and
        anything we derive ourselves.
        """
        payload = json.dumps(
            {
                "title": self.title,
                "sku": self.sku,
                "article_code": self.article_code,
                "description": self.description,
                "images": sorted(self.images),
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        return hashlib.sha256(payload.encode("utf8")).hexdigest()


@dataclass
class FieldValue:
    value: Any
    confidence: float
    origin: Origin

    def to_json(self) -> dict[str, Any]:
        return {
            "value": self.value,
            "confidence": round(self.confidence, 3),
            "origin": str(self.origin),
        }


@dataclass
class Draft:
    """A listing's normalised fields, plus what we could not resolve."""

    listing: RawListing
    fields: dict[str, FieldValue] = field(default_factory=dict)
    # (field, value) pairs whose value is not in the Property vocabulary.
    unknown_values: list[tuple[str, str]] = field(default_factory=list)
    # True when the listing showed an article code we could not parse.
    code_unparseable: bool = False
    llm_confidence: float | None = None
    llm_notes: str | None = None
    llm_model: str | None = None

    def get(self, name: str) -> Any:
        fv = self.fields.get(name)
        return fv.value if fv else None

    def set(self, name: str, value: Any, confidence: float, origin: Origin) -> None:
        if value is None or value == "" or value == []:
            return
        self.fields[name] = FieldValue(value, confidence, origin)

    def field_values(self) -> dict[str, Any]:
        """Plain field → value mapping, for the API request body."""
        return {name: fv.value for name, fv in self.fields.items()}

    def review_fields(self) -> dict[str, dict[str, Any]]:
        return {name: fv.to_json() for name, fv in self.fields.items()}


@dataclass
class Decision:
    route: Route
    reasons: list[str] = field(default_factory=list)

    @property
    def publish(self) -> bool:
        return self.route is Route.PUBLISH
