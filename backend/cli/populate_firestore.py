#!/usr/bin/env python3
"""Populate Firestore with scraped data."""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from backend.infrastructure.repositories.firestore_utils import (
    log_scraper_run,
    save_daily_snapshot,
    sync_theatres_from_scrape,
)


def main():
    data_dir = Path(__file__).parent / "data"

    # Use today's date to find the correct file
    today = datetime.now().strftime("%Y-%m-%d")
    input_file = data_dir / f"movies_{today}.json"

    # Fall back to latest file if today's doesn't exist
    if not input_file.exists():
        movie_files = sorted(data_dir.glob("movies_*.json"), reverse=True)
        if movie_files:
            input_file = movie_files[0]
        else:
            print("❌ No movie data files found")
            log_scraper_run(
                {"status": "failed", "error": "No data files found", "movies": 0, "theatres": 0}
            )
            return

    print(f"📂 Loading: {input_file}")

    with open(input_file, encoding="utf-8") as f:
        data = json.load(f)

    movies = data.get("movies", [])
    summary = data.get("summary", {})
    print(f"🎬 Movies: {len(movies)}")

    # Save daily snapshot for web app
    print("🔥 Saving daily snapshot...")
    save_daily_snapshot(data)

    # Sync theatres
    print("🔥 Syncing theatres...")
    result = sync_theatres_from_scrape(movies)

    # Log scraper run
    log_scraper_run(
        {
            "status": "success" if result["failed"] == 0 else "partial",
            "date": data.get("date"),
            "movies": len(movies),
            "theatres_total": result["total"],
            "theatres_success": result["success"],
            "theatres_failed": result["failed"],
            "cities": summary.get("total_cities", 0),
            "presales": summary.get("presale_count", 0),
        }
    )

    print(f"✅ Done! Theatres: {result['success']}/{result['total']}")


if __name__ == "__main__":
    main()
