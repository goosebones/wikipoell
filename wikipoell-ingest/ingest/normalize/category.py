"""Resolve a listing to one of the archive's 45 categories.

Keyword rules ported from `mapCategory()` in `legacy/ccp-room/scrape.js`. The
site's own section (or entry URL) narrows the search first; the title decides
within it. Anything unresolved returns None and routes to a human — guessing a
category is worse than asking.
"""

from __future__ import annotations

# (section, [(keywords, category)]) — first keyword match wins, in order.
_RULES: dict[str, list[tuple[tuple[str, ...], str]]] = {
    "leather": [
        (("PARKA",), "outerwear.parkas"),
        (("BOMBER",), "outerwear.bombers"),
        (("BLAZER",), "outerwear.blazers"),
        (("VEST",), "outerwear.vests"),
        (("JACKET", "BIKER", "RIDER", "MOTO"), "outerwear.leatherJackets"),
        (("TRENCH", "COAT", "CABAN", "OVERCOAT", "CAPE"), "outerwear.coats"),
    ],
    "clothes": [
        (("TROUSERS", "PANTS"), "bottoms.trousers"),
        (("SHORTS",), "bottoms.shorts"),
        (("SKIRT",), "bottoms.skirts"),
        (("DENIM", "JEANS"), "bottoms.denim"),
        (("SWEATPANTS", "JOGGER"), "bottoms.sweatpants"),
        (("DRESS",), "tops.dresses"),
        (("HOODIE", "SWEATSHIRT"), "tops.hoodiesAndSweatshirts"),
        (("SWEATER", "KNIT", "KNITWEAR", "PULLOVER"), "tops.sweatersAndKnitwear"),
        (("TANK", "SLEEVELESS"), "tops.tankTopsAndSleeveless"),
        (("POLO",), "tops.polos"),
        (("BLOUSE",), "tops.blouses"),
        (
            ("LONG SLEEVE", "LONG-SLEEVE", "LS T-SHIRT", "LS TSHIRT"),
            "tops.longSleeveTshirts",
        ),
        (("SHIRT",), "tops.shirts"),
        (("T-SHIRT", "TSHIRT", "TEE"), "tops.shortSleeveTshirts"),
        (("VEST",), "outerwear.vests"),
        (("JACKET",), "outerwear.jackets"),
        (("COAT", "TRENCH"), "outerwear.coats"),
    ],
    "footwear": [
        (("BOOT", "ANKLE"), "footwear.boots"),
        (("SNEAKER", "TRAINER", "RUNNER"), "footwear.sneakers"),
        (("HEEL", "PUMP", "STILETTO"), "footwear.heels"),
        (("FLAT", "SLIPPER", "MULE"), "footwear.flats"),
    ],
    "accessories": [
        (("BAG", "TOTE", "BACKPACK", "CLUTCH", "POUCH"), "accessories.bags"),
        (("BELT",), "accessories.belts"),
        (("GLOVE",), "accessories.gloves"),
        (("SCARF", "STOLE", "WRAP"), "accessories.scarves"),
        (("HAT", "CAP", "BERET", "BEANIE"), "accessories.hats"),
        (("NECKTIE", "TIE"), "accessories.ties"),
        (("SOCK",), "accessories.socks"),
        # Jewelry rules are ordered most-specific first, which matters more
        # than it looks: "EARRINGS" contains "RING", and "CHAIN BRACELET"
        # contains "CHAIN". The original JS had RING before EARRING and CHAIN
        # before BRACELET, so both of those landed in the wrong category.
        (("EARRING",), "accessories.jewelry.earrings"),
        (("BRACELET", "BANGLE", "CUFF"), "accessories.jewelry.bracelets"),
        (("NECKLACE", "PENDANT", "CHAIN"), "accessories.jewelry.necklaces"),
        (("RING",), "accessories.jewelry.rings"),
        (("GLASSES", "SUNGLASSES", "EYEWEAR"), "accessories.glasses"),
    ],
}

# Fallback when the section is known but no keyword matched. `clothes` has no
# entry: it spans tops and bottoms, so there is no safe default. (The original
# JS defaulted it to "tops", which silently mislabelled every unmatched pair of
# trousers; returning None sends those to the LLM or a person instead.)
_SECTION_FALLBACK = {
    "leather": "outerwear",
    "footwear": "footwear.shoes",  # derby, oxford, brogue, …
    "accessories": "accessories",
}


def resolve_category(section: str | None, title: str | None) -> str | None:
    """Best category for a listing, or None when it needs a person."""
    if not section:
        return None
    text = (title or "").upper()
    for keywords, category in _RULES.get(section, []):
        if any(k in text for k in keywords):
            return category
    return _SECTION_FALLBACK.get(section)
