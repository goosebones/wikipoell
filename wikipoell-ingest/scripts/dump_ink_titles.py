"""Dump ink's raw product headings, keyed by site key.

    .venv/bin/python scripts/dump_ink_titles.py [out.json]

ink's detail-page `h1` is the article code and the only name the product has.
The pipeline reformats it for display; this records it verbatim so a repair
can put it back. Scrape only — nothing is written to the database.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingest.sources.ink import InkSource  # noqa: E402


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "ink-titles.json")
    source = InkSource()
    titles: dict[str, str] = {}
    try:
        for n, listing in enumerate(source.listings(), 1):
            # `raw["heading"]` is the untouched h1; `title` is the same string
            # before normalisation, but read the raw slot to be explicit.
            titles[listing.site_key] = listing.raw.get("heading") or listing.title
            if n % 50 == 0:
                print(f"  {n} listings", flush=True)
    finally:
        source.close()
    out.write_text(json.dumps(titles, indent=1, ensure_ascii=False))
    print(f"wrote {len(titles)} titles to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
