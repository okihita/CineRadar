#!/usr/bin/env python3
"""Populate Firestore with scraped data."""

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from backend.domain.time import get_jakarta_date_str
from backend.infrastructure.repositories.firestore_utils import (
    log_morning_scrape,
    save_daily_snapshot,
    sync_theatres_from_scrape,
)

logger = logging.getLogger(__name__)


def main() -> None:
    # Use project root data/ directory (same as merge_batches.py)
    project_root = Path(__file__).parent.parent.parent
    data_dir = project_root / "data"

    # Use today's date to find the correct file
    # Use today's date in Jakarta time
    today = get_jakarta_date_str()
    input_file = data_dir / f"movies_{today}.json"

    # Fall back to latest file if today's doesn't exist
    if not input_file.exists():
        movie_files = sorted(data_dir.glob("movies_*.json"), reverse=True)
        if movie_files:
            input_file = movie_files[0]
        else:
            logger.error("❌ No movie data files found")
            log_morning_scrape(
                status="failed",
                error="No data files found",
                movies_found=0,
                theatres_total=0,
            )
            return

    logger.info(f"📂 Loading: {input_file}")

    with open(input_file, encoding="utf-8") as f:
        data = json.load(f)

    movies = data.get("movies", [])
    summary = data.get("summary", {})
    logger.info(f"🎬 Movies: {len(movies)}")

    # Save daily snapshot for web app
    logger.info("🔥 Saving daily snapshot...")
    save_daily_snapshot(data)

    # Sync theatres
    logger.info("🔥 Syncing theatres...")
    result = sync_theatres_from_scrape(movies)

    # Log morning scrape to new consolidated scraper_logs
    log_morning_scrape(
        status="success" if result["failed"] == 0 else "partial",
        movies_found=len(movies),
        theatres_total=result["total"],
        cities_covered=summary.get("total_cities", 0),
    )

    logger.info(f"✅ Done! Theatres: {result['success']}/{result['total']}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
