"""CLI entry point.

    python -m ingest run [source ...] [--dry-run] [--limit N] [--db NAME]
    python -m ingest inspect SOURCE [--limit N] [--json]
    python -m ingest replace-images SOURCE [--dry-run] [--limit N] [--db NAME]
    python -m ingest sources

`inspect` scrapes a source and prints what it read for each garment —
identity, images, attributes, details — without classifying, contacting the
archive or writing anything. It is the tool for building and checking a
source module.

Sources are positional. With none given, every registered source runs.
Unknown names fail before any network request is made.
"""

from __future__ import annotations

import argparse
import itertools
import json
import sys
import time
import uuid
from collections import Counter
from dataclasses import asdict

from ingest.config import Config
from ingest.images import ImageCopier
from ingest.llm import LlmReviewer
from ingest.runner import Runner, RunReport, new_run_id, stats_to_json
from ingest.sources import REGISTRY, resolve
from ingest.store import Store


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="scrape, classify and ingest")
    run.add_argument(
        "sources",
        nargs="*",
        metavar="SOURCE",
        help="source names to run (default: all). Known: "
        + ", ".join(sorted(REGISTRY)),
    )
    run.add_argument(
        "--dry-run",
        action="store_true",
        help="do everything except write: no garments, no images, no run record",
    )
    run.add_argument("--limit", type=int, help="max listings per source")
    run.add_argument("--db", help="database to write to (default: INGEST_DB from .env)")
    run.add_argument(
        "--force",
        action="store_true",
        help="reprocess listings the site has not changed, to apply a parser "
        "or vocabulary fix. Requires naming sources. Human-reviewed "
        "garments are still skipped",
    )
    run.add_argument(
        "--images",
        choices=("auto", "always", "never"),
        default="auto",
        help="when to show images to the LLM (Phase 2)",
    )
    run.add_argument("--no-llm", action="store_true", help="skip the LLM pass")
    run.add_argument("--trigger", choices=("manual", "cron"), default="manual")
    run.add_argument("--quiet", action="store_true", help="per-source totals only")

    inspect = sub.add_parser("inspect", help="print what a source reads, write nothing")
    inspect.add_argument("source", choices=sorted(REGISTRY), metavar="SOURCE")
    inspect.add_argument("--limit", type=int, default=5, help="listings to read")
    inspect.add_argument("--json", action="store_true", help="one JSON object a line")

    replace = sub.add_parser(
        "replace-images",
        help="swap stored garments' photos for the ones the source reads now",
    )
    replace.add_argument("source", choices=sorted(REGISTRY), metavar="SOURCE")
    replace.add_argument("--dry-run", action="store_true", help="only count them")
    replace.add_argument("--limit", type=int, help="max listings to read")
    replace.add_argument("--db", help="database (default: INGEST_DB from .env)")

    sub.add_parser("sources", help="list registered sources")
    return parser


def cmd_sources() -> int:
    for name, cls in sorted(REGISTRY.items()):
        print(f"  {name:14} {cls.label}")
    return 0


def cmd_inspect(args: argparse.Namespace) -> int:
    (source,) = resolve([args.source])
    try:
        for listing in itertools.islice(source.listings(), args.limit):
            if args.json:
                print(json.dumps(asdict(listing), ensure_ascii=False))
                continue
            print(f"\n{listing.title}\n  {listing.url}  (key {listing.site_key})")
            print(f"  images: {len(listing.images)}  {(listing.images or [''])[0]}")
            for name, value in asdict(listing.attributes).items():
                if value:
                    print(f"  {name:12} {value}")
            for label, text in listing.details.items():
                print(f"  · {label}: {text[:160]}")
            if listing.description:
                print(f"  description: {listing.description[:160]}")
        for where, message in source.problems:
            print(f"\n✗ {where}: {message}")
    finally:
        source.close()
    return 1 if source.problems else 0


def cmd_replace_images(args: argparse.Namespace) -> int:
    """For when a source's image URLs change: a normal run would see every
    stored garment as changed and append its photos a second time. Fields are
    not touched, and a listing's other changes are not picked up."""
    config = Config.load(args.db)
    (source,) = resolve([args.source])
    print(f"database: {config.db_name}")
    counts = Counter()
    with Store(config) as store:
        known = store.existing(source.name)
        copier = ImageCopier(store, concurrency=config.image_concurrency)
        try:
            for listing in itertools.islice(source.listings(), args.limit):
                garment = known.get(listing.site_key)
                if garment is None:
                    counts["not stored"] += 1
                elif not listing.images or not garment.images_matchable:
                    counts["skipped"] += 1
                elif set(listing.images) <= garment.image_source_urls:
                    counts["already current"] += 1
                elif args.dry_run:
                    counts["would replace"] += 1
                else:
                    group = str(uuid.uuid4())
                    copied = copier.copy(listing.images, group)
                    if copied.failures:  # keep the old set rather than lose photos
                        counts["failed"] += 1
                        print(f"  ✗ {listing.site_key}: {copied.failures[0]}")
                        continue
                    store.replace_images(
                        garment.id,
                        images=copied.images,
                        image_group_id=group,
                        content_hash=listing.content_hash(),
                    )
                    counts["replaced"] += 1
                    print(f"  ✓ {listing.site_key}: {len(copied.images)} photos")
        finally:
            copier.close()
            source.close()
        if counts["replaced"]:
            print(f"site    : cache refresh {store.refresh_site()}")
    print(f"totals  : {dict(counts)}")
    return 1 if counts["failed"] else 0


def cmd_run(args: argparse.Namespace) -> int:
    config = Config.load(args.db)
    if args.force and not args.sources:
        print(
            "--force without a source would reprocess every listing of every "
            "source, which is hours of scraping and roughly one LLM call per "
            "garment. Name the sources you mean, e.g. `run closetcase --force`.",
            file=sys.stderr,
        )
        return 2
    sources = resolve(args.sources)  # raises on unknown names, before any I/O
    names = [s.name for s in sources]

    print(f"database: {config.db_name}")
    print(f"sources : {', '.join(names)}")
    print(
        f"mode    : {'DRY RUN — nothing will be written' if args.dry_run else 'live'}"
    )
    if args.limit:
        print(f"limit   : {args.limit} per source")
    if args.force:
        print("force   : reprocessing unchanged listings (reviewed ones skipped)")

    started = time.monotonic()
    with Store(config) as store:
        vocab = store.vocabulary()
        # Worked examples for the LLM come back in phase 3, from garments a
        # person has corrected.
        corrections: list[dict] = []
        codes = sum(len(v) for k, v in vocab.ids.items() if k != "model")
        print(
            f"vocab   : {codes} codes, {len(vocab.models)} models, "
            f"{len(vocab.categories)} categories"
        )

        llm = None
        if args.no_llm:
            print("llm     : disabled (--no-llm)")
        elif not config.openrouter_api_key:
            print("llm     : disabled (OPENROUTER_API_KEY not set)")
        else:
            llm = LlmReviewer(
                config.openrouter_api_key,
                vocab,
                corrections,
                images_mode=args.images,
                threshold=config.llm_threshold,
                model=config.llm_model,
            )
            print(
                f"llm     : {llm.model}, images={args.images}, "
                f"{len(corrections)} few-shot examples, "
                f"threshold {config.llm_threshold}"
            )

        if args.dry_run:
            run_id = f"dry-run-{new_run_id()[:8]}"
        else:
            run_id = store.create_run(
                sources=names,
                images=args.images,
                limit=args.limit,
                trigger=args.trigger,
            )
        print(f"run id  : {run_id}")
        print(f"images  : {config.image_concurrency} concurrent copies")

        report = RunReport(run_id=run_id)
        runner = Runner(
            store,
            vocab,
            run_id=run_id,
            dry_run=args.dry_run,
            limit=args.limit,
            force=args.force,
            threshold=config.llm_threshold,
            verbose=not args.quiet,
            llm=llm,
            image_concurrency=config.image_concurrency,
        )

        try:
            for source in sources:
                report.sources.append(runner.run_source(source, report))
        finally:
            runner.close()
            if llm is not None:
                llm.close()

        totals = report.totals()
        any_failed = any(s.status == "failed" for s in report.sources)

        if not args.dry_run:
            store.finish_run(
                run_id,
                status="failed" if any_failed else "completed",
                sources=stats_to_json(report.sources),
                totals=totals,
                failures=report.failures,
            )
            print(f"site    : cache refresh {store.refresh_site()}")

    elapsed = time.monotonic() - started
    print("\n" + "─" * 62)
    print(f"totals  : {totals}")
    print(f"elapsed : {elapsed:.1f}s")
    if args.dry_run:
        print("\nDry run complete. Nothing was written.")
    return 1 if any_failed else 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "sources":
        return cmd_sources()
    if args.command == "inspect":
        return cmd_inspect(args)
    if args.command == "replace-images":
        return cmd_replace_images(args)
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
