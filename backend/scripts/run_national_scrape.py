#!/usr/env python3
"""
Run national scrape with V2 scraper.

This is the entry point for the daily initial scrape.

Estimated time: ~10-15 minutes (83 cities, 4 req/sec rate limit)

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
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("=" * 60)
    logger.info("CineRadar V2 National Scrape")
    logger.info("=" * 60)
    logger.info("Rate limit: 4 req/sec")
    logger.info("Estimated time: ~10-15 minutes")

    scraper = CineRadarScraperV2(rate_limit=4)

    start = time.time()
    result = await scraper.scrape_and_upload(dry_run=False)
    elapsed = time.time() - start

    logger.info("=" * 60)
    logger.info("National Scrape Complete!")
    logger.info("=" * 60)
    logger.info(f"Date: {result.get('date')}")
    logger.info(f"Cities: {result.get('total_cities')}")
    logger.info(f"Stats: {result.get('stats')}")
    logger.info(f"API requests: {result.get('api_requests')}")
    logger.info(f"Movies uploaded: {result.get('uploaded')}")
    logger.info(f"Elapsed: {elapsed / 60:.1f} minutes")
    if result.get("api_requests"):
        logger.info(f"Effective rate: {result['api_requests'] / elapsed:.1f} req/sec")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
