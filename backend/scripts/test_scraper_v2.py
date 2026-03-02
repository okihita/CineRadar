#!/usr/bin/env python3
"""
Test script for CineRadarScraperV2.

Tests the V2 scraper with per-city schedule checking.

Usage:
    uv run python -m backend.scripts.test_scraper_v2
    uv run python -m backend.scripts.test_scraper_v2 --city BAUBAU
"""

import argparse
import asyncio
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)

from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2


async def test_scraper(city: str | None = None) -> int:
    """Test the V2 scraper."""
    print("=" * 60)
    print("CineRadarScraperV2 Test")
    print("=" * 60)
    print()

    scraper = CineRadarScraperV2()

    if city:
        print(f"Testing with city: {city}")
        result = await scraper.scrape(specific_city=city)
    else:
        print("Testing with first 3 cities...")
        result = await scraper.scrape(city_limit=3)

    if not result:
        print("❌ No results returned")
        return 1

    print()
    print("=" * 60)
    print("Results Summary:")
    print("=" * 60)
    print(f"Date: {result.get('date')}")
    print(f"Cities scraped: {result.get('total_cities')}")
    print()

    stats = result.get("stats", {})
    print("Statistics:")
    print(f"  Movies checked: {stats.get('total_movies', 0)}")
    print(f"  Movies with shows today: {stats.get('movies_with_shows', 0)}")
    print(f"  Movies skipped (no shows): {stats.get('movies_skipped', 0)}")
    print(f"  Total showtimes: {stats.get('total_showtimes', 0)}")
    print()

    # Show details per city
    for city_result in result.get("results", []):
        city_name = city_result.get("city")
        city_stats = city_result.get("stats", {})
        print(f"📍 {city_name}:")
        print(f"   Movies with shows: {city_stats.get('movies_with_shows', 0)}")
        print(f"   Movies skipped: {city_stats.get('movies_skipped', 0)}")
        print(f"   Total showtimes: {city_stats.get('total_showtimes', 0)}")

        # Show first movie with shows
        movies = city_result.get("movies", [])
        if movies:
            first = movies[0]
            print(f"   First movie: {first.get('title')} ({first.get('showtime_count')} showtimes)")
        print()

    print("=" * 60)
    print("✅ Test complete!")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Test CineRadarScraperV2")
    parser.add_argument("--city", type=str, help="Test specific city")
    args = parser.parse_args()

    exit_code = asyncio.run(test_scraper(args.city))
    exit(exit_code)


if __name__ == "__main__":
    main()
