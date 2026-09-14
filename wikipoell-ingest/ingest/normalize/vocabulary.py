"""The Property collection, as a lookup.

The vocabulary is the standardisation target: `garmentKey` → set of valid
`garmentValue`s. A value outside it is never coerced — it is recorded and the
listing goes to a person, because adding vocabulary is a human decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Fields whose values are drawn from the Property vocabulary.
VOCAB_FIELDS = ("type", "gender", "procedure", "material", "process", "color")


@dataclass
class Vocabulary:
    values: dict[str, set[str]] = field(default_factory=dict)
    categories: set[str] = field(default_factory=set)

    @classmethod
    def from_context(cls, context: dict[str, Any]) -> Vocabulary:
        values: dict[str, set[str]] = {}
        for prop in context.get("properties", []):
            key = prop.get("garmentKey")
            value = prop.get("garmentValue")
            if key and value is not None:
                values.setdefault(key, set()).add(str(value))
        categories = {
            str(c["_id"]) for c in context.get("categories", []) if c.get("_id")
        }
        return cls(values=values, categories=categories)

    def canonicalize(self, garment_key: str, value: Any) -> Any:
        """Map a site's spelling onto the vocabulary's, where that is unambiguous.

        One rule so far: retailers write single-digit colors bare ("7") where
        CCP pads them ("07"), so pad on the way in.

        The guard matters more than the rule. **A leading zero identifies a
        different color, not a different spelling** — the vocabulary holds
        `10` (Black, Fabric) and `010` (Black, Leather) as separate entries,
        and likewise 19/019, 33/033, 35/035, 36/036, all in active use. And
        `3` (Grey, Reflective) is a genuine code in its own right, confirmed
        with the archive owner; it is *not* an unpadded `03` (Off White, Bone,
        Light Grey), and twenty published, human-verified garments depend on
        the distinction.

        So padding is applied only when the bare form is unknown *and* the
        padded form is known. Do not relax this into a blanket pad.
        """
        if value is None or garment_key != "color":
            return value
        known = self.values.get(garment_key, set())
        text = str(value)
        if text in known:
            return value
        if len(text) == 1 and text.isdigit() and f"0{text}" in known:
            return f"0{text}"
        return value

    def knows(self, garment_key: str, value: Any) -> bool:
        if value is None:
            return True  # absent is not unknown; required-ness is checked elsewhere
        known = self.values.get(garment_key)
        if not known:
            return False
        if isinstance(value, list):
            return all(str(v) in known for v in value)
        return str(value) in known

    def unknown_values(self, garment_key: str, value: Any) -> list[str]:
        """The specific values not in the vocabulary, for the review reason."""
        if value is None:
            return []
        known = self.values.get(garment_key, set())
        candidates = value if isinstance(value, list) else [value]
        return [str(v) for v in candidates if str(v) not in known]

    def knows_category(self, category: str | None) -> bool:
        return bool(category) and category in self.categories
