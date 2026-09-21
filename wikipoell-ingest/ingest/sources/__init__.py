"""One module per site. Registry lives here."""

from __future__ import annotations

from ingest.sources.base import Source
from ingest.sources.bilzerian import BilzerianSource
from ingest.sources.ccp_room import CcpRoomSource
from ingest.sources.closetcase import ClosetcaseSource
from ingest.sources.darklands import DarklandsSource
from ingest.sources.ink import InkSource
from ingest.sources.lazzari import LazzariSource
from ingest.sources.shelter2 import Shelter2Source
from ingest.sources.the_library import TheLibrarySource
from ingest.sources.thirdshed import ThirdShedSource

# Name → factory. The CLI resolves positional arguments against this; with no
# arguments it runs every entry.
REGISTRY: dict[str, type[Source]] = {
    CcpRoomSource.name: CcpRoomSource,
    TheLibrarySource.name: TheLibrarySource,
    ClosetcaseSource.name: ClosetcaseSource,
    ThirdShedSource.name: ThirdShedSource,
    DarklandsSource.name: DarklandsSource,
    BilzerianSource.name: BilzerianSource,
    InkSource.name: InkSource,
    LazzariSource.name: LazzariSource,
    Shelter2Source.name: Shelter2Source,
}


def resolve(names: list[str]) -> list[Source]:
    """Instantiate the named sources, or all of them when none are named.

    Unknown names raise before any network request is made.
    """
    if not names:
        return [cls() for cls in REGISTRY.values()]
    unknown = [n for n in names if n not in REGISTRY]
    if unknown:
        known = ", ".join(sorted(REGISTRY))
        raise SystemExit(f"Unknown source(s): {', '.join(unknown)}. Known: {known}")
    return [REGISTRY[n]() for n in names]
