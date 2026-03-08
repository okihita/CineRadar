#!/usr/bin/env python3
"""Test the V2 scraper.

Usage:
    PYTHONPATH=. uv run python backend/scripts/test_scraper_v2.py
    PYTHONPATH=. uv run python backend/scripts/test_scraper_v2.py --city SURABAYA
    PYTHONPATH=. uv run python backend/scripts/test_scraper_v2.py --limit 5
"""

import argparse
import asyncio
import logging
import sys

sys.path.insert(0, ".")

from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def test_scraper(city: str | None = None, limit: int = 3) -> int:
    """Test the V2 scraper."""
    logger.info("=" * 60)
    logger.info("CineRadarScraperV2 Test")
    logger.info("=" * 60)

    scraper = CineRadarScraperV2()

    if city:
        logger.info(f"Testing with city: {city}")
        result = await scraper.scrape(specific_city=city)
    else:
        logger.info(f"Testing with first {limit} cities...")
        result = await scraper.scrape(city_limit=limit)

    if not result:
        logger.error("❌ No results returned")
        return 1

    logger.info("")
    logger.info("=" * 60)
    logger.info("Results Summary:")
    logger.info("=" * 60)
    logger.info(f"Date: {result.get('date')}")
    logger.info(f"Cities scraped: {result.get('total_cities')}")
    logger.info("")

    stats = result.get("stats", {})
    logger.info("Statistics:")
    logger.info(f"  Movies checked: {stats.get('total_movies', 0)}")
    logger.info(f"  Movies with shows today: {stats.get('movies_with_shows', 0)}")
    logger.info(f"  Movies skipped (no shows): {stats.get('movies_skipped', 0)}")
    logger.info(f"  Total showtimes: {stats.get('total_showtimes', 0)}")
    logger.info("")

    # Show details per city
    for city_result in result.get("results", []):
        city_name = city_result.get("city")
        city_stats = city_result.get("stats", {})
        logger.info(f"📍 {city_name}:")
        logger.info(f"   Movies with shows: {city_stats.get('movies_with_shows', 0)}")
        logger.info(f"   Movies skipped: {city_stats.get('movies_skipped', 0)}")
        logger.info(f"   Total showtimes: {city_stats.get('total_showtimes', 0)}")

        # Show first movie with shows
        movies = city_result.get("movies", [])
        if movies:
            first = movies[0]
            logger.info(
                f"   First movie: {first.get('title')} ({first.get('showtime_count')} showtimes)"
            )
        logger.info("")

    logger.info("=" * 60)
    logger.info("✅ Test complete!")
    return 0


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Test the V2 scraper")
    parser.add_argument("--city", type=str, help="Specific city to test")
    parser.add_argument("--limit", type=int, default=3, help="Number of cities to test")
    args = parser.parse_args()

    exit_code = asyncio.run(test_scraper(city=args.city, limit=args.limit))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
