#!/usr/bin/env python3
"""
CineRadar CLI - Unified Scraper Command Line Interface

Usage:
    python -m backend.cli movies [options]    # Scrape movie availability
    python -m backend.cli seats [options]     # Scrape seat occupancy
"""

import argparse
import logging

# Re-export functions for backward compatibility with __main__.py
from backend.cli.commands.details import run_movie_details_scrape
from backend.cli.commands.movies import run_movie_scrape
from backend.cli.commands.seats import run_seat_scrape

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CineRadar - TIX.id Movie & Seat Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m backend.cli movies --city JAKARTA
  python -m backend.cli movies --batch 0 --total-batches 9
  python -m backend.cli seats --mode morning
  python -m backend.cli seats --city JAKARTA --limit 10
  python -m backend.cli movie-details --movie-id 1991446452714422272
  python -m backend.cli movie-details --all
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Scraper command")

    # Movies subcommand
    movies_parser = subparsers.add_parser("movies", help="Scrape movie availability")
    movies_parser.add_argument("--visible", action="store_true", help="Show browser window")
    movies_parser.add_argument("--limit", type=int, help="Limit number of cities")
    movies_parser.add_argument("--city", type=str, help="Scrape specific city")
    movies_parser.add_argument("--schedules", action="store_true", help="Include schedules")
    movies_parser.add_argument("--output", default="data", help="Output directory")
    movies_parser.add_argument("--batch", type=int, help="Batch number (0-indexed)")
    movies_parser.add_argument("--total-batches", type=int, default=9)

    # Seats subcommand
    seats_parser = subparsers.add_parser("seats", help="Scrape seat occupancy")
    seats_parser.add_argument("--mode", choices=["morning", "jit"], default="morning")
    seats_parser.add_argument("--visible", action="store_true", help="Show browser window")
    seats_parser.add_argument("--city", type=str, help="Filter by city")
    seats_parser.add_argument("--limit", type=int, help="Limit showtimes")
    seats_parser.add_argument("--output", default="data", help="Output directory")
    seats_parser.add_argument("--batch", type=int, help="Batch number")
    seats_parser.add_argument("--total-batches", type=int, default=9)
    seats_parser.add_argument(
        "--jit-window", type=int, default=8, help="JIT window in minutes (default: 8 for T-8)"
    )
    seats_parser.add_argument(
        "--use-stored-token",
        action="store_true",
        help="Use token from Firestore instead of logging in",
    )

    # Movie details subcommand
    details_parser = subparsers.add_parser("movie-details", help="Scrape detailed movie info")
    details_parser.add_argument("--movie-id", type=str, help="Specific movie ID to scrape")
    details_parser.add_argument(
        "--all",
        action="store_true",
        dest="all_movies",
        help="Scrape all movies from latest snapshot",
    )
    details_parser.add_argument(
        "--update-ratings", action="store_true", help="Update ratings for existing movies"
    )
    details_parser.add_argument(
        "--from-performance", action="store_true", help="Backfill from movie_performance collection"
    )
    details_parser.add_argument("--no-skip", action="store_true", help="Don't skip existing movies")

    args = parser.parse_args()

    if args.command == "movies":
        run_movie_scrape(
            output_dir=args.output,
            headless=not args.visible,
            city_limit=args.limit,
            specific_city=args.city,
            schedules=args.schedules,
            batch=args.batch,
            total_batches=args.total_batches,
        )
    elif args.command == "seats":
        run_seat_scrape(
            mode=args.mode,
            headless=not args.visible,
            city=args.city,
            limit=args.limit,
            batch=args.batch,
            total_batches=args.total_batches,
            output_dir=args.output,
            jit_window=args.jit_window,
            use_stored_token=args.use_stored_token,
        )
    elif args.command == "movie-details":
        run_movie_details_scrape(
            movie_id=args.movie_id,
            all_movies=args.all_movies,
            from_performance=args.from_performance,
            skip_existing=not args.no_skip,
            update_ratings=args.update_ratings,
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
