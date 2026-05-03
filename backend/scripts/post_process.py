#!/usr/bin/env python3
"""Post-processing script for the API scraper.

Handles the following tasks after a scrape completes:
1. Update snapshots/latest - for movie-details command
2. Sync theatres to theatres collection
3. Log initial scrape status

Usage:
    PYTHONPATH=. uv run python backend/scripts/post_process.py
"""

import json
import logging
import os
import sys
from datetime import UTC, datetime
from typing import Any, cast

sys.path.insert(0, ".")

from google.cloud import firestore
from google.oauth2 import service_account

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.core.resend_notification_service import ResendNotificationService
from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES
from backend.infrastructure.repositories.firestore_utils import (
    log_morning_scrape,
    save_daily_snapshot,
    sync_theatres_from_scrape,
)
from backend.scripts.discover_studios import discover_studios, populate_studios

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def get_firestore_client() -> firestore.Client:
    """Initialize Firestore client from service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_json:
        sa_info = json.loads(sa_json)
        credentials = service_account.Credentials.from_service_account_info(sa_info)
        return firestore.Client(credentials=credentials, project=sa_info["project_id"])
    else:
        return firestore.Client()


def load_schedules_as_movies(db: firestore.Client, date: str) -> list[dict[str, Any]]:
    """Load schedules and convert to movies format for post-processing.

    The scraper writes to schedules/{date}/movies/{movie_id}.
    This reads them back and converts to the format expected by
    save_daily_snapshot and sync_theatres_from_scrape.
    """
    logger.info(f"📥 Loading schedules from {SCHEDULES}/{date}/{MOVIES}/...")

    movies_ref = db.collection(SCHEDULES).document(date).collection(MOVIES)
    docs = list(movies_ref.stream())

    movies: list[dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict()

        # Convert new format to legacy format expected by post-processing
        # Scraper has: { movie_id, title, cities: {city_name: [theatres]} }
        # Legacy expects: { id, title, schedules: {city_name: [theatres]} }

        movie: dict[str, Any] = {
            "id": data.get("movie_id"),
            "tix_metadata_id": data.get("tix_metadata_id"),
            "title": data.get("title"),
            "poster": data.get("poster", ""),
            "genres": data.get("genres", []),
            "age_category": data.get("age_category", ""),
            "merchants": data.get("merchants", []),
            "is_presale": data.get("is_presale", False),
            # Convert 'cities' to 'schedules' for legacy compatibility
            "schedules": data.get("cities", {}),
            "cities": list(data.get("cities", {}).keys()),
        }
        movies.append(movie)

    logger.info(f"   Loaded {len(movies)} movies")
    return movies


def update_snapshots(db: firestore.Client, date: str, movies: list[dict[str, Any]]) -> None:
    """Update snapshots collection for movie-details command."""
    logger.info("📸 Updating snapshots...")

    # Build the data structure expected by save_daily_snapshot
    city_stats: dict[str, int] = {}
    for movie in movies:
        for city in movie.get("cities", []):
            city_stats[city] = city_stats.get(city, 0) + 1

    data: dict[str, Any] = {
        "scraped_at": datetime.now(UTC).isoformat(),
        "date": date,
        "movies": movies,
        "summary": {
            "total_movies": len(movies),
            "total_cities": len(city_stats),
        },
        "city_stats": city_stats,
    }

    save_daily_snapshot(data)
    logger.info("   ✓ Snapshots updated")
def sync_theatres(movies: list[dict[str, Any]]) -> list[str]:
    """Sync theatres from scraped data. Returns list of new theatre names."""
    logger.info("🎭 Syncing theatres...")
    result = sync_theatres_from_scrape(movies)
    logger.info(
        f"   ✓ Theatres: {result['success']}/{result['total']} synced ({len(result['new_theatres'])} new)"
    )
    return cast("list[str]", result.get("new_theatres", []))



async def run_studio_discovery(db: firestore.Client, date: str) -> None:
    """Automatically discover and populate new studios from schedules."""
    logger.info("🔍 Running automatic studio discovery...")
    from google.cloud.firestore import AsyncClient

    # Initialize an async client for the discovery part
    # Post-process usually runs in a context where credentials are available via env
    async_db = AsyncClient(project=db.project)
    try:
        studios = await discover_studios(async_db, date)
        if studios:
            await populate_studios(async_db, studios, dry_run=False)
    finally:
        async_db.close()


async def send_discovery_alerts(new_theatres: list[str]) -> None:
    """Send notifications for new theatre discoveries."""
    if new_theatres:
        notification_service = ResendNotificationService()
        subject = f"[CineRadar] {len(new_theatres)} New Theatres Discovered"
        body = "The following new theatres were discovered and added to the registry:\n\n"
        body += "\n".join([f"- {name}" for name in new_theatres])
        body += "\n\nPlease review theatre details and geocoding."

        await notification_service.send_alert(subject, body)


def log_scrape_status(movies: list[dict[str, Any]], city_stats: dict[str, int]) -> None:
    """Log the initial scrape status."""
    logger.info("📝 Logging scrape status...")

    # Count total theatres
    total_theatres = 0
    for movie in movies:
        for _city, theatres in movie.get("schedules", {}).items():
            total_theatres += len(theatres)

    log_morning_scrape(
        status="success",
        movies_found=len(movies),
        theatres_total=total_theatres,
        cities_covered=len(city_stats),
    )
    logger.info("   ✓ Scrape logged")


async def async_main() -> None:
    logger.info("=" * 60)
    logger.info("CineRadar Post-Processing")
    logger.info("=" * 60)

    # Get today's date in Jakarta timezone
    today = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")
    logger.info(f"📅 Processing date: {today}")

    # Initialize Firestore
    db = get_firestore_client()

    # Load schedules
    movies = load_schedules_as_movies(db, today)

    if not movies:
        logger.warning("⚠️ No movies found in schedules - skipping post-processing")
        return

    # Calculate city stats
    city_stats: dict[str, int] = {}
    for movie in movies:
        for city in movie.get("cities", []):
            city_stats[city] = city_stats.get(city, 0) + 1

    # Run post-processing steps
    update_snapshots(db, today, movies)
    new_theatres = sync_theatres(movies)

    # Run discovery and alerts
    await run_studio_discovery(db, today)
    await send_discovery_alerts(new_theatres)

    log_scrape_status(movies, city_stats)

    logger.info("=" * 60)
    logger.info("Post-Processing Complete!")
    logger.info(f"  Movies: {len(movies)}")
    logger.info(f"  Cities: {len(city_stats)}")
    logger.info("=" * 60)


if __name__ == "__main__":
    import asyncio
    asyncio.run(async_main())
