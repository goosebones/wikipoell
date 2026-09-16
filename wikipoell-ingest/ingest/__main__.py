"""CLI entry point.

    python -m ingest run [source ...] [--dry-run] [--limit N] [--images MODE]

Sources are positional. With none given, every registered source runs.
Unknown names fail before any network request is made.
"""

from __future__ import annotations

import argparse
import sys
import time

from ingest.client import WikipoellClient
from ingest.config import Config
from ingest.llm import LlmReviewer
from ingest.normalize.vocabulary import Vocabulary
from ingest.runner import Runner, RunReport, new_run_id, stats_to_json
from ingest.sources import REGISTRY, resolve


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
    run.add_argument(
        "--images",
        choices=("auto", "always", "never"),
        default="auto",
        help="when to show images to the LLM (Phase 2)",
    )
    run.add_argument("--no-llm", action="store_true", help="skip the LLM pass")
    run.add_argument("--trigger", choices=("manual", "cron"), default="manual")
    run.add_argument("--quiet", action="store_true", help="per-source totals only")

    sub.add_parser("sources", help="list registered sources")
    return parser


def cmd_sources() -> int:
    for name, cls in sorted(REGISTRY.items()):
        print(f"  {name:14} {cls.label}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    config = Config.load()
    sources = resolve(args.sources)  # raises on unknown names, before any I/O
    names = [s.name for s in sources]

    print(f"api     : {config.api_url}")
    print(f"sources : {', '.join(names)}")
    print(
        f"mode    : {'DRY RUN — nothing will be written' if args.dry_run else 'live'}"
    )
    if args.limit:
        print(f"limit   : {args.limit} per source")

    started = time.monotonic()
    with WikipoellClient(config) as client:
        context = client.context()
        vocab = Vocabulary.from_context(context)
        corrections = context.get("corrections", [])
        print(
            f"vocab   : {sum(len(v) for v in vocab.values.values())} property values, "
            f"{len(vocab.categories)} categories"
        )

        llm = None
        if args.no_llm:
            print("llm     : disabled (--no-llm)")
        elif not config.anthropic_api_key:
            print("llm     : disabled (ANTHROPIC_API_KEY not set)")
        else:
            llm = LlmReviewer(
                config.anthropic_api_key,
                vocab,
                corrections,
                images_mode=args.images,
                threshold=config.llm_threshold,
            )
            print(
                f"llm     : {llm.model}, images={args.images}, "
                f"{len(corrections)} few-shot examples, "
                f"threshold {config.llm_threshold}"
            )

        if args.dry_run:
            run_id = f"dry-run-{new_run_id()[:8]}"
        else:
            run_id = client.create_run(
                sources=names,
                dry_run=False,
                images=args.images,
                limit=args.limit,
                trigger=args.trigger,
            )
        print(f"run id  : {run_id}")
        print(f"images  : {config.image_concurrency} concurrent copies")

        report = RunReport(run_id=run_id)
        runner = Runner(
            client,
            vocab,
            run_id=run_id,
            dry_run=args.dry_run,
            limit=args.limit,
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
            client.update_run(
                run_id,
                status="failed" if any_failed else "completed",
                sources=stats_to_json(report.sources),
                totals=totals,
                failures=report.failures,
            )

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
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
