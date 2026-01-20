"""
Movies command for CLI.
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from backend.city_data import CITIES
from backend.infrastructure.core.tix_client import CineRadarScraper

logger = logging.getLogger(__name__)


def run_movie_scrape(
    output_dir: str = "data",
    headless: bool = True,
    city_limit: int | None = None,
    specific_city: str | None = None,
    schedules: bool = False,
    batch: int | None = None,
    total_batches: int = 9,
    max_retries: int = 3,
) -> dict[str, Any] | None:
    """Run the movie availability scraper with retry logic."""

    async def _run() -> dict[str, Any] | None:
        scraper = CineRadarScraper()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        current_time = datetime.now(ZoneInfo("Asia/Jakarta"))
        date_str = current_time.strftime("%Y-%m-%d")
        timestamp = current_time.strftime("%Y-%m-%d %H:%M:%S")

        # Determine cities to scrape
        if batch is not None:
            cities_per_batch = len(CITIES) // total_batches + 1
            start_idx = batch * cities_per_batch
            end_idx = min(start_idx + cities_per_batch, len(CITIES))
            city_names = [c["name"] for c in CITIES[start_idx:end_idx]]
            logger.info(
                f"🔢 Batch {batch}/{total_batches - 1}: cities {start_idx}-{end_idx - 1} "
                f"({len(city_names)} cities)"
            )
        else:
            city_names = None

        # Header
        logger.info("\n" + "=" * 60)
        logger.info("🎬 CineRadar - Movie Availability Scraper")
        logger.info(f"📅 Date: {date_str}")
        logger.info("=" * 60 + "\n")

        # Scrape with retry
        result = None
        for attempt in range(max_retries):
            try:
                result = await scraper.scrape(
                    headless=headless,
                    city_limit=city_limit,
                    specific_city=specific_city,
                    city_names=city_names,
                    fetch_schedules=schedules,
                )
                if result and result.get("movies"):
                    break
            except Exception as e:
                logger.error(f"⚠️ Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait = 2**attempt * 5
                    logger.info(f"   Retrying in {wait}s...")
                    await asyncio.sleep(wait)

        if not result or not result.get("movies"):
            logger.error("❌ No data collected after retries.")
            return None

        # Summary
        logger.info(f"\n📊 Cities: {result['total_cities']}, Movies: {result['total_movies']}")

        # Save results
        if batch is not None:
            output_file = output_path / f"batch_{batch}_{date_str}.json"
        else:
            output_file = output_path / f"movies_{date_str}.json"

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "scraped_at": timestamp,
                    "date": date_str,
                    "batch": batch,
                    "movies": result["movies"],
                    "city_stats": result["city_stats"],
                },
                f,
                indent=2,
                ensure_ascii=False,
            )

        logger.info(f"💾 Saved to: {output_file}")
        return result

    return asyncio.run(_run())
