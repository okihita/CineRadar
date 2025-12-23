#!/usr/bin/env python3
"""
CineRadar Scrapers Entry Point

This module provides backward compatibility by redirecting to the unified CLI.
For new usage, prefer: python -m backend.cli.cli [movies|seats] [options]
"""

import argparse
import sys

from backend.cli.cli import main as cli_main
from backend.cli.cli import run_movie_scrape

# If called directly as package, default to movie scraping for backward compatibility
if __name__ == "__main__":
    # Check if using new subcommand style or old style
    if len(sys.argv) > 1 and sys.argv[1] in ["movies", "seats"]:
        # New style: redirect to CLI
        cli_main()
    else:
        # Old style: run movie scrape directly (backward compatible)
        parser = argparse.ArgumentParser(description="CineRadar - TIX.id Movie Scraper")
        parser.add_argument("--visible", action="store_true")
        parser.add_argument("--limit", type=int)
        parser.add_argument("--city", type=str)
        parser.add_argument("--schedules", action="store_true")
        parser.add_argument("--output", default="data")
        parser.add_argument("--batch", type=int, help="Batch number (0-indexed)")
        parser.add_argument("--total-batches", type=int, default=9)

        args = parser.parse_args()

        run_movie_scrape(
            output_dir=args.output,
            headless=not args.visible,
            city_limit=args.limit,
            specific_city=args.city,
            schedules=args.schedules,
            batch=args.batch,
            total_batches=args.total_batches,
        )
