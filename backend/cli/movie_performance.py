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
    logger.info(f"\n{'=' * 60}")
    logger.info(f"🎬 Scraping performance for movie {movie_id}")
    logger.info(f"{'=' * 60}\n")

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

    logger.info(f"✅ Found movie in snapshot: {movie_data.title}")

    # Fetch full details from schedules collection to get showtime_ids

    # Use the existing authenticated client from repository
    db = aggregator.repo.db

    # Use today's date (Jakarta) instead of snapshot date (which might be stale/UTC-1)
    from datetime import datetime
    from zoneinfo import ZoneInfo

    date_str = datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m-%d")

    logger.info(f"📥 Fetching detailed schedule from schedules/{date_str}/movies/{movie_id}")

    doc_ref = db.collection("schedules").document(date_str).collection("movies").document(movie_id)
    doc = doc_ref.get()

    if not doc.exists:
        logger.error(f"❌ Detailed schedule not found for {movie_id} on {date_str}")
        return

    # Use the detailed data which contains showtime_ids
    # Use the detailed data which contains showtime_ids
    detailed_data = doc.to_dict()

    # FIX SCHEMA MISMATCH:
    # Firestore stores schedules in 'cities' key as a dict {City: [Theatres]}
    # Movie.from_dict expects 'schedules' key for that map
    if "cities" in detailed_data and isinstance(detailed_data["cities"], dict):
        logger.info("🔧 Patching schema: Mapping 'cities' dict to 'schedules'")
        detailed_data["schedules"] = detailed_data["cities"]
        # Optional: Derive cities list from keys for correctness
        detailed_data["cities"] = list(detailed_data["cities"].keys())

    # EASIEST FIX: Parse detailed_data into a Movie object
    from backend.domain.models import Movie

    try:
        movie_data = Movie.from_dict(detailed_data)
        logger.info("✅ Parsed detailed movie data")
    except Exception as e:
        logger.error(f"❌ Failed to parse detailed data: {e}")
        return

    # Extract showtimes to scrape
    showtimes = []
    logger.info(f"🔍 Scanning schedules for {len(movie_data.schedules)} cities...")

    for city, schedules in movie_data.schedules.items():
        for schedule in schedules:
            for room in schedule.rooms:
                # logger.info(f"   Room: {room.category} ({len(room.showtimes)} showtimes)")
                for st in room.showtimes:
                    # Debug log first 2 showtimes
                    # logger.info(f"      Check: id={st.showtime_id} avail={st.is_available} time={st.time}")

                    if st.showtime_id and st.is_available:
                        showtimes.append(
                            {
                                "showtime_id": st.showtime_id,
                                "movie_id": movie_id,
                                "movie_title": movie_data.title,
                                "theatre_id": schedule.theatre_id,
                                "theatre_name": schedule.theatre_name,
                                "city": city,
                                "merchant": schedule.merchant,
                                "room_category": room.category,
                                "showtime": st.time,
                                "date": date_str,
                            }
                        )
                    elif not st.showtime_id:
                        pass  # logger.warning(f"      ❌ Missing ID: {st.time}")

    if not showtimes:
        logger.warning("⚠️ No showtimes with IDs found for this movie")
        # Dump one room's showtimes to see what's wrong
        if movie_data.schedules:
            first_city = next(iter(movie_data.schedules.keys()))
            first_sched = movie_data.schedules[first_city][0]
            if first_sched.rooms:
                logger.info(f"DEBUG: First room showtimes: {first_sched.rooms[0].showtimes}")
        return

    logger.info(f"📊 Found {len(showtimes)} showtimes to scrape")

    # Scrape seat data
    scraper = SeatScraper()
    if not scraper.load_token_from_storage():
        logger.error("❌ Failed to load auth token - run token-refresh workflow first")
        return

    results = asyncio.run(
        scraper.scrape_all_showtimes_api_only(showtimes[:10])
    )  # Limit for testing

    logger.info(f"\n✅ Scraped {len(results)} showtimes")

    # Convert to ShowtimeSnapshot and aggregate
    for result in results:
        showtime_snap = ShowtimeSnapshot(
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
            showtime_snap, movie_title=movie_data.title, movie_poster=movie_data.poster
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


def initialize_performance_data(aggregator: PerformanceAggregator) -> None:
    """Initialize performance data for all movies today without scraping seats.

    Populates movie_performance collection with:
    - Movie metadata (title, poster, etc.)
    - Total showtime counts
    - 0% occupancy (placeholder)
    """
    logger.info("🚀 Initializing performance data for today...")

    from datetime import datetime
    from zoneinfo import ZoneInfo

    from backend.domain.models import DailyPerformance, MovieMetadata

    # Use the existing authenticated client from repository
    db = aggregator.repo.db

    date_str = datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m-%d")
    logger.info(f"📅 Date: {date_str}")

    # Get all movies from schedules collection
    movies_ref = db.collection("schedules").document(date_str).collection("movies")
    docs = list(movies_ref.stream())

    if not docs:
        logger.warning(f"⚠️ No movies found in schedules/{date_str}/movies")
        return

    logger.info(f"📊 Found {len(docs)} movies in schedule")

    count = 0
    for doc in docs:
        data = doc.to_dict()
        movie_id = data.get("movie_id") or data.get("id")

        if not movie_id:
            continue

        # Count showtimes
        total_showtimes = 0
        cities_data = data.get("cities", {})  # Original schema was dict

        # Handle schema specific to upload_schedules.py
        if isinstance(cities_data, dict):
            for _city, theatres in cities_data.items():
                for theatre in theatres:
                    for room in theatre.get("rooms", []):
                        # Handle both all_showtimes and showtimes keys
                        sts = room.get("all_showtimes") or room.get("showtimes") or []
                        total_showtimes += len(sts)

        # Create and save metadata (Root)
        metadata = MovieMetadata(
            movie_id=movie_id,
            title=data.get("title", "Unknown"),
            poster=data.get("poster"),
            age_category=data.get("age_category"),
            last_updated=datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(),
        )
        aggregator.repo.update_metadata(metadata)

        # Create and save daily stats (Subcollection)
        daily = DailyPerformance(
            date=date_str,
            total_showtimes=total_showtimes,
            total_seats=0,
            total_sold=0,
            avg_occupancy_pct=0.0,
            cities=list(cities_data.keys()) if isinstance(cities_data, dict) else [],
            last_updated=datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(),
        )

        if aggregator.repo.update_daily_stats(daily, movie_id):
            logger.info(
                f"   ✓ Initialized {metadata.title} ({total_showtimes} showtimes) for {date_str}"
            )
            count += 1

    logger.info(f"\n✅ Successfully initialized {count} movies")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Movie Performance Aggregation CLI")
    parser.add_argument("--movie-id", help="Scrape specific movie by ID")
    parser.add_argument("--all", action="store_true", help="Scrape all movies")
    parser.add_argument(
        "--limit", type=int, default=10, help="Limit number of movies (default: 10)"
    )
    parser.add_argument(
        "--recalculate", action="store_true", help="Recalculate summaries from existing data"
    )
    parser.add_argument(
        "--init-only",
        action="store_true",
        help="Initialize performance data from schedules (no scraping)",
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    # Initialize aggregator
    repo = FirestoreMoviePerformanceRepository()
    aggregator = PerformanceAggregator(repo)

    if args.init_only:
        initialize_performance_data(aggregator)
    elif args.recalculate:
        aggregator.recalculate_all()
    elif args.movie_id:
        scrape_movie_performance(args.movie_id, aggregator)
    elif args.all:
        scrape_all_movies(args.limit, aggregator)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
