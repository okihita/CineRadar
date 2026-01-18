#!/usr/bin/env python3
"""
Movie Performance CLI

Manually trigger movie performance data aggregation.

Usage:
    uv run python -m backend.cli.movie_performance --movie-id 1961889705591132160
    uv run python -m backend.cli.movie_performance --all --limit 10
    uv run python -m backend.cli.movie_performance --recalculate
"""

import argparse
import asyncio
import logging

from backend.application.services import PerformanceAggregator
from backend.domain.models import ShowtimeSnapshot
from backend.infrastructure.core.seat_scraper import SeatScraper
from backend.infrastructure.repositories import (
    FirestoreMoviePerformanceRepository,
    FirestoreMovieRepository,
)

logger = logging.getLogger(__name__)


def scrape_movie_performance(movie_id: str, aggregator: PerformanceAggregator) -> None:
    """Scrape seat data for a specific movie and aggregate performance.

    Args:
        movie_id: Movie identifier
        aggregator: PerformanceAggregator instance
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"🎬 Scraping performance for movie {movie_id}")
    logger.info(f"{'='*60}\n")

    # Get movie data from Firestore
    movie_repo = FirestoreMovieRepository()
    snapshot = movie_repo.get_latest_snapshot()

    if not snapshot:
        logger.error("❌ No movie snapshot found in Firestore")
        logger.info("   Run daily-scrape workflow first to get movie data")
        return

    # Find the movie
    movie_data = None
    for movie in snapshot.movies:
        if movie.id == movie_id:
            movie_data = movie
            break

    if not movie_data:
        logger.error(f"❌ Movie {movie_id} not found in snapshot")
        return

    logger.info(f"✅ Found movie: {movie_data.title}")

    # Extract showtimes to scrape
    showtimes = []
    for city, schedules in movie_data.schedules.items():
        for schedule in schedules:
            for room in schedule.rooms:
                for st in room.showtimes:
                    if st.showtime_id and st.is_available:
                        showtimes.append({
                            "showtime_id": st.showtime_id,
                            "movie_id": movie_id,
                            "movie_title": movie_data.title,
                            "theatre_id": schedule.theatre_id,
                            "theatre_name": schedule.theatre_name,
                            "city": city,
                            "merchant": schedule.merchant,
                            "room_category": room.room_category,
                            "showtime": st.showtime,
                            "date": snapshot.date,
                        })

    if not showtimes:
        logger.warning("⚠️ No showtimes with IDs found for this movie")
        return

    logger.info(f"📊 Found {len(showtimes)} showtimes to scrape")

    # Scrape seat data
    scraper = SeatScraper()
    if not scraper.load_token_from_storage():
        logger.error("❌ Failed to load auth token - run token-refresh workflow first")
        return

    results = asyncio.run(scraper.scrape_all_showtimes_api_only(showtimes[:10]))  # Limit for testing

    logger.info(f"\n✅ Scraped {len(results)} showtimes")

    # Convert to ShowtimeSnapshot and aggregate
    for result in results:
        snapshot = ShowtimeSnapshot(
            showtime_id=result["showtime_id"],
            movie_id=result["movie_id"],
            movie_title=result["movie_title"],
            theatre_id=result["theatre_id"],
            theatre_name=result["theatre_name"],
            city=result["city"],
            room_category=result["room_category"],
            merchant=result["merchant"],
            showtime=result["showtime"],
            date=result["date"],
            total_seats=result["total_seats"],
            sold_seats=result["unavailable_seats"],
            occupancy_pct=result["occupancy_pct"],
            layout=result["layout"],
            scraped_at=result["scraped_at"],
        )

        aggregator.on_showtime_scraped(
            snapshot, movie_title=movie_data.title, movie_poster=movie_data.poster
        )

    logger.info("\n🎉 Performance data saved to Firestore")
    logger.info(f"   Collection: movie_performance/{movie_id}")


def scrape_all_movies(limit: int, aggregator: PerformanceAggregator) -> None:
    """Scrape performance for all movies currently playing.

    Args:
        limit: Maximum number of movies to process
        aggregator: PerformanceAggregator instance
    """
    movie_repo = FirestoreMovieRepository()
    snapshot = movie_repo.get_latest_snapshot()

    if not snapshot:
        logger.error("❌ No movie snapshot found")
        return

    movies = snapshot.movies[:limit]
    logger.info(f"📊 Processing {len(movies)} movies...")

    for i, movie in enumerate(movies, 1):
        logger.info(f"\n[{i}/{len(movies)}] {movie.title}")
        scrape_movie_performance(movie.id, aggregator)


def recalculate_all(aggregator: PerformanceAggregator) -> None:
    """Recalculate all movie performance summaries.

    Args:
        aggregator: PerformanceAggregator instance
    """
    logger.info("🔄 Recalculating all movie performance summaries...")
    summaries = aggregator.recalculate_all()
    logger.info(f"✅ Recalculated {len(summaries)} movies")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Movie Performance Aggregation CLI")
    parser.add_argument("--movie-id", help="Scrape specific movie by ID")
    parser.add_argument("--all", action="store_true", help="Scrape all movies")
    parser.add_argument("--limit", type=int, default=10, help="Limit number of movies (default: 10)")
    parser.add_argument(
        "--recalculate", action="store_true", help="Recalculate summaries from existing data"
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    # Initialize aggregator
    repo = FirestoreMoviePerformanceRepository()
    aggregator = PerformanceAggregator(repo)

    if args.recalculate:
        recalculate_all(aggregator)
    elif args.movie_id:
        scrape_movie_performance(args.movie_id, aggregator)
    elif args.all:
        scrape_all_movies(args.limit, aggregator)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
