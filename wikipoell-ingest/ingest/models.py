"""The shapes that flow through the pipeline.

RawListing  — what a source module produces. No classification.
Attributes  — what the site itself states about a garment's classification.
Detail      — the labels for everything else a listing says about a garment.
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
class Attributes:
    """What the site states about a garment's classification, in its terms.

    The article code carries most of it. The rest fills gaps the code leaves,
    and never overrides it.
    """

    article_code: str | None = None  # verbatim, as the site writes it
    sku: str | None = None
    gender: str | None = None  # "M" or "F"
    # An archive category id when the site's own category maps to one
    # ("footwear.boots"); otherwise a section name for the keyword rules.
    category: str | None = None
    color: str | None = None  # a color code ("010"), never a color name


class Detail(StrEnum):
    """Labels for what else a listing says about the garment.

    None of it is classified; it is kept for the reviewer and the LLM, which
    is where a composition line or a vendor category earns its keep. Sources
    use these labels where they fit so the same fact reads the same way from
    every site, and may add their own.
    """

    NAME = "Name"  # a descriptive product name, where the title is a code
    VENDOR_CATEGORY = "Vendor category"
    TAGS = "Tags"
    COLOR = "Color"  # the site's color name ("Black", "white (01)")
    MATERIAL = "Material"  # the site's material name ("CORDOVAN")
    COMPOSITION = "Composition"  # "100% Cordovan Leather", "50% LE - 50% PE"
    FEATURES = "Features"  # bullet-like lines: "Oxide / rust drops"
    SIZES = "Sizes"
    COLLECTION = "Collection"


@dataclass(frozen=True)
class RawListing:
    """One product as a site presents it. Source modules produce only this."""

    site_key: str
    url: str
    title: str
    images: list[str] = field(default_factory=list)
    attributes: Attributes = field(default_factory=Attributes)
    # The listing's own prose, as plain text. Part of the content hash.
    description: str | None = None
    # Label → text: everything else on the page about this garment that could
    # help classify it. Not part of the content hash.
    details: dict[str, str] = field(default_factory=dict)
    # True when the site's title is the only name the product has and should
    # be published exactly as written — see `ink`, whose h1 is the article
    # code. Suppresses both reformatting and the `title_unformatted` flag.
    title_is_final: bool = False
    raw: dict[str, Any] = field(default_factory=dict)

    def content_hash(self) -> str:
        """Stable digest of everything we'd re-process if it changed.

        Deliberately excludes site_key and url (identity, not content),
        anything we derive ourselves, and `details`: those were added after
        the stored hashes were computed, and including them would make every
        existing listing look changed.
        """
        payload = json.dumps(
            {
                "title": self.title,
                "sku": self.attributes.sku,
                "article_code": self.attributes.article_code,
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
