"""The archive's vocabulary, loaded from the database, as a lookup.

The parser reads **codes** (`ROOMS`, `010`, `IN`); garments store **node ids**
(`leather.kangaroo.rooms`, `black.010`, `in`). Every code is unique within
its collection, so each field gets a code → id index, and a draft is checked
and routed on codes and translated to ids only when it is written.

A value outside the vocabulary is never coerced: it is recorded and the
listing goes to a person, because adding vocabulary is a human decision.
Models are vocabulary too: an unknown model number blocks publishing until
someone adds it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Fields whose values are vocabulary codes, by collection.
CODE_COLLECTIONS = {
    "type": "types",
    "gender": "genders",
    "procedure": "procedures",
    "material": "materials",
    "process": "processes",
    "color": "colors",
}
# Fields checked against the vocabulary. A model "code" is its number, which
# is also its id.
VOCAB_FIELDS = (*CODE_COLLECTIONS, "model")
# Fields stored as lists on a garment.
LIST_FIELDS = ("procedure", "process")


@dataclass
class Model:
    label: str
    suggested_category: str | None


@dataclass
class Vocabulary:
    #: field -> code -> node id. For "model", number -> number.
    ids: dict[str, dict[str, str]] = field(default_factory=dict)
    models: dict[str, Model] = field(default_factory=dict)
    categories: set[str] = field(default_factory=set)
    #: (field, code) -> label, e.g. ("type", "A") -> "Shoes, bags, ties, …".
    #: Codes are opaque without these, which matters most on sources whose
    #: only signal is the article code.
    descriptions: dict[tuple[str, str], str] = field(default_factory=dict)

    @classmethod
    def from_db(cls, db: Any) -> Vocabulary:
        vocab = cls()
        for name, collection in CODE_COLLECTIONS.items():
            vocab.ids[name] = {}
            for node in db[collection].find({"code": {"$ne": None}}):
                vocab.ids[name][node["code"]] = node["_id"]
                if node.get("label"):
                    vocab.descriptions[(name, node["code"])] = node["label"]
        for model in db.models.find():
            vocab.models[model["_id"]] = Model(
                model.get("label") or "", model.get("suggestedCategory")
            )
            vocab.descriptions[("model", model["_id"])] = model.get("label") or ""
        vocab.ids["model"] = {number: number for number in vocab.models}
        vocab.categories = {c["_id"] for c in db.categories.find({}, {"_id": 1})}
        return vocab

    @property
    def values(self) -> dict[str, set[str]]:
        """Field -> the codes it accepts (what the LLM prompt lists)."""
        return {name: set(codes) for name, codes in self.ids.items()}

    def canonicalize(self, name: str, value: Any) -> Any:
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
        if value is None or name != "color":
            return value
        known = self.ids.get(name, {})
        text = str(value)
        if text in known:
            return value
        if len(text) == 1 and text.isdigit() and f"0{text}" in known:
            return f"0{text}"
        return value

    def knows(self, name: str, value: Any) -> bool:
        if value is None:
            return True  # absent is not unknown; required-ness is checked elsewhere
        return not self.unknown_values(name, value)

    def unknown_values(self, name: str, value: Any) -> list[str]:
        """The specific codes not in the vocabulary, for the review reason."""
        if value is None:
            return []
        known = self.ids.get(name, {})
        candidates = value if isinstance(value, list) else [value]
        return [str(v) for v in candidates if str(v) not in known]

    def knows_category(self, category: str | None) -> bool:
        return bool(category) and category in self.categories

    def model_category(self, model: str | None) -> str | None:
        """The category a model's garments usually belong to."""
        entry = self.models.get(model or "")
        return entry.suggested_category if entry else None

    def to_garment(self, values: dict[str, Any]) -> dict[str, Any]:
        """A draft's field values (codes) as garment fields (node ids).

        Only fields with a known value come back, so writing the result
        never clears a field the draft could not read. Lists stay lists, and
        a single procedure or process becomes a one-item list.
        """
        out: dict[str, Any] = {}
        for name in VOCAB_FIELDS:
            value = values.get(name)
            if value in (None, "", []):
                continue
            codes = value if isinstance(value, list) else [value]
            ids = [self.ids[name].get(str(code)) for code in codes]
            if None in ids:
                continue
            out[name] = ids if name in LIST_FIELDS else ids[0]
        if self.knows_category(values.get("category")):
            out["category"] = values["category"]
        return out
