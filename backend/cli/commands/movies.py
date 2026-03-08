"""Movies command for CLI."""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.city_data import CITIES
from backend.infrastructure.core.tix_client_v2 import CineRadarScraperV2

logger = logging.getLogger(__name__)


def run_movie_scrape(
    output_dir: str = "data",
    city_limit: int | None = None,
    specific_city: str | None = None,
    max_retries: int = 3,
) -> dict[str, Any] | None:
    """Run the movie availability scraper with retry logic."""

    async def _run() -> dict[str, Any] | None:
        scraper = CineRadarScraperV2()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        current_time = datetime.now(JAKARTA_TZ)
        date_str = current_time.strftime("%Y-%m-%d")
        timestamp = current_time.strftime("%Y-%m-%d %H:%M:%S")

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
                result = await scraper.scrape_and_upload(
                    city_limit=city_limit,
                    specific_city=specific_city,
                    city_names=city_names,
                    dry_run=True,  # Match the V1 CLI behavior of writing locally without pushing to DB
                )
                if result and result.get("success"):
                    break
            except Exception as e:
                logger.error(f"⚠️ Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait = 2**attempt * 5
                    logger.info(f"   Retrying in {wait}s...")
                    await asyncio.sleep(wait)

        if not result or not result.get("success"):
            logger.error("❌ No data collected after retries.")
            return None

        # Summary
        total_cities = result.get("total_cities", len(CITIES))
        stats = result.get("stats", {})
        total_movies = stats.get("total_movies", 0)
        logger.info(f"\n📊 Cities: {total_cities}, Movies: {total_movies}")

        # Save results
        output_file = output_path / f"movies_{date_str}.json"

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "scraped_at": timestamp,
                    "date": date_str,
                    "stats": result.get("stats"),
                    "movies": result.get("movies_for_firestore", len(result.get("results", []))),
                    "api_requests": result.get("api_requests"),
                    "results": result.get("results"),
                },
                f,
                indent=2,
                ensure_ascii=False,
            )

        logger.info(f"💾 Saved to: {output_file}")
        return result

    return asyncio.run(_run())
