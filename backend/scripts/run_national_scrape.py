#!/usr/bin/env python3
"""Run national scrape with API scraper.

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

from backend.infrastructure.core.tix_client import CineRadarScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("=" * 60)
    logger.info("CineRadar API National Scrape")
    logger.info("=" * 60)
    logger.info("Rate limit: 4 req/sec")
    logger.info("Estimated time: ~10-15 minutes")

    scraper = CineRadarScraper(rate_limit=4)

    start = time.time()
    result = await scraper.scrape_and_upload(dry_run=False)
    elapsed = time.time() - start

    logger.info("=" * 60)
    logger.info("National Scrape Complete!")
    uploaded_movies = result.get("uploaded", 0)
    total_showtimes = result.get("stats", {}).get("total_showtimes", 0)
    target_date = result.get("date")
    error_counts = result.get("error_counts", {})
    recent_errors = result.get("recent_errors", [])

    # Anomaly Thresholds (National circuit sanity floor)
    # A standard theatrical slate across Indonesia has at least 15 active movies and 1,500+ showtimes.
    # Yielding fewer than 5 movies or 500 showtimes signals severe scraping degradation or partial WAF blocks.
    MIN_EXPECTED_SHOWTIMES = 500
    MIN_EXPECTED_MOVIES = 5

    is_failure = uploaded_movies < MIN_EXPECTED_MOVIES or total_showtimes < MIN_EXPECTED_SHOWTIMES

    # Notification Service
    try:
        from backend.infrastructure.core.resend_notification_service import (
            ResendNotificationService,
        )
        from backend.infrastructure.repositories.firestore_utils import get_firestore_client

        db = get_firestore_client()
        notifier = ResendNotificationService(db=db)
    except Exception as e:
        logger.warning(f"Could not initialize notification service: {e}")
        notifier = None

    if is_failure:
        err_details = "\n".join([f"  • {e}" for e in recent_errors]) if recent_errors else "  • No explicit HTTP exceptions recorded"
        http_breakdown = ", ".join([f"HTTP {k}: {v}" for k, v in error_counts.items()]) if error_counts else "None"

        error_msg = (
            f"🚨 *[CineRadar CRITICAL] Morning National Scrape Anomaly!*\n\n"
            f"📅 *Date:* {target_date}\n"
            f"⚠️ *Failure:* Scraping volume below operational thresholds!\n"
            f"• *Movies Uploaded:* {uploaded_movies} (Min expected: {MIN_EXPECTED_MOVIES})\n"
            f"• *Showtimes Found:* {total_showtimes} (Min expected: {MIN_EXPECTED_SHOWTIMES})\n"
            f"• *Error Codes:* {http_breakdown}\n\n"
            f"*Sample Errors:*\n{err_details}\n\n"
            f"Possible causes: TIX.id WAF block, API schema change, or network failure.\n"
            f"Immediate investigation required."
        )
        logger.error(error_msg)
        if notifier:
            await notifier.send_alert(
                subject=f"🚨 [CineRadar CRITICAL] Morning Scrape Failed ({target_date})",
                body=error_msg,
                metadata={
                    "Date": target_date,
                    "Uploaded Movies": uploaded_movies,
                    "Total Showtimes": total_showtimes,
                    "API Requests": result.get("api_requests", 0),
                    "HTTP Errors": http_breakdown,
                    "Status": "ANOMALY_THRESHOLD_BREACH",
                },
            )
        # Force non-zero exit code so GitHub Actions alerts and fails loudly
        sys.exit(1)

    # Success Morning Briefing
    if notifier:
        success_body = (
            f"🎬 *[CineRadar] Morning National Scrape Complete*\n\n"
            f"📅 *Date:* {target_date}\n"
            f"🏙️ *Coverage:* {uploaded_movies} Movies across {result.get('total_cities', 0)} Cities\n"
            f"🎟️ *Total Showtimes Found:* {total_showtimes:,}\n"
            f"⏱️ *Duration:* {elapsed / 60:.1f} minutes\n"
            f"🟢 *Status:* All systems green & JIT pipeline armed."
        )
        await notifier.send_alert(
            subject=f"🎬 [CineRadar] Morning Scrape Complete: {uploaded_movies} Movies ({target_date})",
            body=success_body,
            metadata={
                "Date": target_date,
                "Movies Uploaded": uploaded_movies,
                "Showtimes": total_showtimes,
                "Cities": result.get("total_cities", 0),
                "Duration": f"{elapsed / 60:.1f} min",
            },
        )


if __name__ == "__main__":
    asyncio.run(main())
