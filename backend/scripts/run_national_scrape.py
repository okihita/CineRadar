#!/usr/bin/env python3
"""
Run national scrape with V2 scraper.

Estimated time: ~25 minutes (100 cities, 4 req/sec rate limit)

Usage:
    PYTHONPATH=. uv run python backend/scripts/run_national_scrape.py
"""

import asyncio
import logging
import sys
import time

sys.path.insert(0, ".")

from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)


async def main():
    print("=" * 60)
    print("CineRadar V2 National Scrape")
    print("=" * 60)
    print()
    print("Rate limit: 4 req/sec")
    print("Estimated time: ~25 minutes")
    print()

    scraper = CineRadarScraperV2(rate_limit=4)

    start = time.time()
    result = await scraper.scrape_and_upload(dry_run=False)
    elapsed = time.time() - start

    print()
    print("=" * 60)
    print("National Scrape Complete!")
    print("=" * 60)
    print(f"Date: {result.get('date')}")
    print(f"Cities: {result.get('total_cities')}")
    print(f"Stats: {result.get('stats')}")
    print(f"API requests: {result.get('api_requests')}")
    print(f"Movies uploaded: {result.get('uploaded')}")
    print(f"Elapsed: {elapsed / 60:.1f} minutes")
    if result.get("api_requests"):
        print(f"Effective rate: {result['api_requests'] / elapsed:.1f} req/sec")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
