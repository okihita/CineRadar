#!/usr/bin/env python3
"""
Diagnostic tool to check seating layout scraping status.

Reports:
1. How many showtimes have raw_api_response stored
2. JIT scraper run counts and timestamps
"""

import argparse
import logging
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from google.cloud import firestore

JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
logger = logging.getLogger(__name__)


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client()


def check_seat_snapshots(db: firestore.Client, date_str: str) -> dict[str, Any]:
    """
    Count seat snapshots for a given date from seat_snapshots collection.

    Returns dict with counts.
    """
    logger.info(f"\n📊 Checking seat_snapshots collection for {date_str}...")
    logger.info("=" * 70)

    snapshots_ref = db.collection("seat_snapshots")
    # Query documents that have a 'date' field matching date_str
    # Or query by scraped_at timestamp range

    # For now, get all recent snapshots and filter by date
    all_snapshots = list(snapshots_ref.stream())

    total_snapshots = 0
    with_raw_response = 0
    without_raw_response = 0
    matching_date_snapshots = []

    for snap in all_snapshots:
        data = snap.to_dict()
        if data is None:
            continue

        # Check if this snapshot is for the target date
        snap_date = data.get("date") or data.get("showtime_date")

        # Also check scraped_at timestamp
        scraped_at = data.get("scraped_at")
        if scraped_at:
            try:
                ts = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
                if ts.date().strftime("%Y-%m-%d") != date_str:
                    continue
            except Exception:
                pass
        elif snap_date and snap_date != date_str:
            continue

        total_snapshots += 1
        matching_date_snapshots.append(snap)

        has_raw = data.get("raw_api_response") is not None
        if has_raw:
            with_raw_response += 1
        else:
            without_raw_response += 1

    logger.info(f"  Total snapshots for {date_str}: {total_snapshots}")
    logger.info(f"  With raw_api_response: {with_raw_response}")
    logger.info(f"  Without raw_api_response: {without_raw_response}")

    return {
        "total_snapshots": total_snapshots,
        "with_raw_response": with_raw_response,
        "without_raw_response": without_raw_response,
        "snapshots": matching_date_snapshots,
    }


def check_showtime_raw_responses(db: firestore.Client, date_str: str) -> dict[str, int]:
    """
    Count showtimes with and without raw_api_response for a given date.

    Returns dict with counts for:
    - total_showtimes: Total number of showtime documents
    - with_raw_response: Showtimes with raw_api_response field
    - without_raw_response: Showtimes without raw_api_response field
    - zero_seats: Showtimes where total_seats = 0
    """
    total_showtimes = 0
    with_raw_response = 0
    without_raw_response = 0
    zero_seats = 0
    movie_count = 0
    movie_ids_with_data = []

    logger.info(f"\n📊 Checking movie_performance collection for {date_str}...")
    logger.info("=" * 70)

    # Get all movies that have data for this date
    # Query: movie_performance/{movie_id}/days/{date}/showtimes/*

    # First, get all movies by querying root collection
    movies_ref = db.collection("movie_performance")
    movies_stream = movies_ref.stream()

    for movie_doc in movies_stream:
        movie_id = movie_doc.id
        movie_data = movie_doc.to_dict()
        movie_title = movie_data.get("title", "Unknown")

        # Check if this movie has showtimes for the target date
        days_ref = db.collection("movie_performance").document(movie_id).collection("days")
        date_doc_ref = days_ref.document(date_str)

        if not date_doc_ref.get().exists:
            continue

        movie_count += 1
        logger.info(f"  🎬 {movie_title} (ID: {movie_id})")

        # Get all showtimes for this movie/date
        showtimes_ref = date_doc_ref.collection("showtimes")
        showtimes_stream = showtimes_ref.stream()

        movie_showtime_count = 0
        movie_with_raw = 0
        movie_without_raw = 0

        for showtime_doc in showtimes_stream:
            showtime_data = showtime_doc.to_dict()
            total_showtimes += 1
            movie_showtime_count += 1

            # Check for raw_api_response
            has_raw = showtime_data.get("raw_api_response") is not None
            if has_raw:
                with_raw_response += 1
                movie_with_raw += 1
            else:
                without_raw_response += 1
                movie_without_raw += 1

            # Check for zero seats
            if showtime_data.get("total_seats", 0) == 0:
                zero_seats += 1

        if movie_showtime_count > 0:
            raw_pct = (movie_with_raw / movie_showtime_count) * 100
            logger.info(
                f"      Total: {movie_showtime_count}, With raw: {movie_with_raw} ({raw_pct:.1f}%)"
            )
            movie_ids_with_data.append((movie_id, movie_title, movie_showtime_count))

    result: dict[str, Any] = {
        "total_showtimes": total_showtimes,
        "with_raw_response": with_raw_response,
        "without_raw_response": without_raw_response,
        "zero_seats": zero_seats,
        "movie_count": movie_count,
        "movies_with_data": movie_ids_with_data,
    }
    return result


def check_jit_runs(db: firestore.Client, date_str: str) -> dict[str, Any]:
    """
    Query scraper_logs/{date}/dispatches subcollection to get JIT run information.

    Returns dict with:
    - total_runs: Number of dispatch entries
    - successful_runs: Number of runs with status 'ok'
    - failed_runs: Number of runs with status 'error'
    - total_jobs_published: Total jobs published across all runs
    - total_showtimes_found: Total showtimes found across all runs
    - total_scrape_errors: Total scraper errors across all dispatches
    - total_scrape_successes: Total scraper successes across all dispatches
    - first_run: Earliest timestamp
    - last_run: Latest timestamp
    - runs_detail: List of individual run details
    """
    logger.info(f"\n🔄 Checking JIT scraper runs for {date_str}...")
    logger.info("=" * 70)

    dispatch_ref = (
        db.collection("scraper_logs")
        .document(date_str)
        .collection("dispatches")
    )
    dispatch_docs = list(dispatch_ref.stream())

    if not dispatch_docs:
        logger.info(f"  ⚠️  No dispatches found in scraper_logs/{date_str}/dispatches")
        return {
            "total_runs": 0,
            "successful_runs": 0,
            "failed_runs": 0,
            "total_jobs_published": 0,
            "total_showtimes_found": 0,
            "total_scrape_errors": 0,
            "total_scrape_successes": 0,
            "first_run": None,
            "last_run": None,
            "runs_detail": [],
        }

    total_runs = len(dispatch_docs)
    successful_runs = 0
    failed_runs = 0
    total_jobs_published = 0
    total_showtimes_found = 0
    total_scrape_errors = 0
    total_scrape_successes = 0
    runs_detail = []
    timestamps = []

    # Sort by document ID (HH-MM format)
    sorted_docs = sorted(dispatch_docs, key=lambda d: d.id)

    for dispatch_doc in sorted_docs:
        run_data = dispatch_doc.to_dict()
        time_slot = run_data.get("time_slot", dispatch_doc.id.replace("-", ":"))
        status = run_data.get("status", "unknown")
        jobs_published = run_data.get("jobs_published", 0)
        showtimes_found = run_data.get("showtimes_found", 0)
        dispatched_at = run_data.get("dispatched_at", "")
        scrape_errors = run_data.get("total_errors", 0)
        scrape_successes = run_data.get("total_successes", 0)

        if status == "ok":
            successful_runs += 1
        elif status == "error":
            failed_runs += 1

        total_jobs_published += jobs_published
        total_showtimes_found += showtimes_found
        total_scrape_errors += scrape_errors
        total_scrape_successes += scrape_successes

        if dispatched_at:
            try:
                # Parse ISO timestamp
                ts = datetime.fromisoformat(dispatched_at.replace("Z", "+00:00"))
                timestamps.append(ts)
            except Exception:
                pass

        runs_detail.append(
            {
                "time_slot": time_slot,
                "status": status,
                "showtimes_found": showtimes_found,
                "jobs_published": jobs_published,
                "dispatched_at": dispatched_at,
                "total_errors": scrape_errors,
                "total_successes": scrape_successes,
            }
        )

        status_icon = "✅" if status == "ok" else "❌" if status == "error" else "⚠️"
        error_info = f" | Errors: {scrape_errors}" if scrape_errors > 0 else ""
        logger.info(
            f"  {status_icon} {time_slot}: Found {showtimes_found}, Published {jobs_published} jobs, "
            f"Success: {scrape_successes}{error_info}"
        )

    first_run = min(timestamps) if timestamps else None
    last_run = max(timestamps) if timestamps else None

    return {
        "total_runs": total_runs,
        "successful_runs": successful_runs,
        "failed_runs": failed_runs,
        "total_jobs_published": total_jobs_published,
        "total_showtimes_found": total_showtimes_found,
        "total_scrape_errors": total_scrape_errors,
        "total_scrape_successes": total_scrape_successes,
        "first_run": first_run,
        "last_run": last_run,
        "runs_detail": runs_detail,
    }


def format_duration(delta: timedelta) -> str:
    """Format timedelta as human readable string."""
    total_seconds = int(delta.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def main() -> None:
    parser = argparse.ArgumentParser(description="Check seating layout scraping status")
    parser.add_argument("--date", help="Date to check (YYYY-MM-DD). Defaults to today in WIB")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    args = parser.parse_args()

    # Determine date to check
    date_str = args.date or datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    logger.info("=" * 70)
    logger.info(f"🎬 CineRadar Seating Layout Scraping Status - {date_str}")
    logger.info("=" * 70)

    db = get_firestore_client()

    # Check 1: Seat snapshots (older collection)
    seat_snapshot_stats = check_seat_snapshots(db, date_str)

    # Check 2: Showtime raw API responses (newer movie_performance collection)
    showtime_stats = check_showtime_raw_responses(db, date_str)

    # Check 3: JIT runs
    jit_stats = check_jit_runs(db, date_str)

    # Summary
    logger.info("=" * 70)
    logger.info("📋 SUMMARY")
    logger.info("=" * 70)

    logger.info("\n🪑 Seat Snapshots (older collection):")
    logger.info(f"  Total snapshots: {seat_snapshot_stats['total_snapshots']}")
    if seat_snapshot_stats["total_snapshots"] > 0:
        logger.info(
            f"  With raw_api_response: {seat_snapshot_stats['with_raw_response']} ({(seat_snapshot_stats['with_raw_response'] / seat_snapshot_stats['total_snapshots'] * 100):.1f}%)"
        )
        logger.info(
            f"  Without raw_api_response: {seat_snapshot_stats['without_raw_response']} ({(seat_snapshot_stats['without_raw_response'] / seat_snapshot_stats['total_snapshots'] * 100):.1f}%)"
        )

    logger.info("\n🪑 Showtime Coverage (movie_performance collection):")
    logger.info(f"  Movies with data: {showtime_stats['movie_count']}")
    logger.info(f"  Total showtimes: {showtime_stats['total_showtimes']}")
    logger.info(
        f"  With raw_api_response: {showtime_stats['with_raw_response']} ({(showtime_stats['with_raw_response'] / max(showtime_stats['total_showtimes'], 1) * 100):.1f}%)"
    )
    logger.info(
        f"  Without raw_api_response: {showtime_stats['without_raw_response']} ({(showtime_stats['without_raw_response'] / max(showtime_stats['total_showtimes'], 1) * 100):.1f}%)"
    )
    logger.info(f"  Zero seats (potential issues): {showtime_stats['zero_seats']}")

    logger.info("\n🔄 JIT Scraper Activity:")
    logger.info(f"  Total runs: {jit_stats['total_runs']}")
    logger.info(f"  Successful: {jit_stats['successful_runs']}")
    logger.info(f"  Failed: {jit_stats['failed_runs']}")
    logger.info(f"  Total jobs published: {jit_stats['total_jobs_published']}")
    logger.info(f"  Total showtimes found: {jit_stats['total_showtimes_found']}")

    if jit_stats["first_run"]:
        duration = (
            jit_stats["last_run"] - jit_stats["first_run"]
            if jit_stats["last_run"]
            else timedelta(0)
        )
        logger.info(
            f"  First run: {jit_stats['first_run'].astimezone(JAKARTA_TZ).strftime('%H:%M:%S WIB')}"
        )
        logger.info(
            f"  Last run: {jit_stats['last_run'].astimezone(JAKARTA_TZ).strftime('%H:%M:%S WIB')}"
        )
        logger.info(f"  Duration: {format_duration(duration)}")

    # Health assessment
    logger.info("\n🩺 Health Assessment:")

    # Determine which collection to use for assessment
    total_showtimes_for_coverage = max(
        showtime_stats["total_showtimes"] + seat_snapshot_stats["total_snapshots"], 1
    )
    with_raw_for_coverage = (
        showtime_stats["with_raw_response"] + seat_snapshot_stats["with_raw_response"]
    )
    raw_coverage_pct = (with_raw_for_coverage / total_showtimes_for_coverage) * 100

    if raw_coverage_pct > 90:
        logger.info(f"  ✅ Raw API response coverage: Excellent ({raw_coverage_pct:.1f}%)")
    elif raw_coverage_pct > 70:
        logger.info(f"  ⚠️  Raw API response coverage: Good ({raw_coverage_pct:.1f}%)")
    else:
        logger.info(
            f"  ❌ Raw API response coverage: Poor ({raw_coverage_pct:.1f}%) - many showtimes missing raw data"
        )

    if jit_stats["failed_runs"] == 0 and jit_stats["total_runs"] > 0:
        logger.info(f"  ✅ JIT scraper: All runs successful ({jit_stats['total_runs']} runs)")
    elif jit_stats["failed_runs"] > 0:
        logger.info(
            f"  ❌ JIT scraper: {jit_stats['failed_runs']} failed runs out of {jit_stats['total_runs']}"
        )
    else:
        logger.info("  ⚠️  JIT scraper: No runs recorded")

    if showtime_stats["zero_seats"] > 0:
        zero_pct = (showtime_stats["zero_seats"] / max(showtime_stats["total_showtimes"], 1)) * 100
        logger.info(
            f"  ⚠️  Zero-seat showtimes: {showtime_stats['zero_seats']} ({zero_pct:.1f}%) - may indicate scraping issues"
        )

    # Verbose output
    if args.verbose:
        logger.info("\n📄 Detailed Movie Breakdown:")
        movies_data = showtime_stats["movies_with_data"]
        assert isinstance(movies_data, list)
        for _movie_id, movie_title, count in movies_data:
            logger.info(f"  - {movie_title}: {count} showtimes")

        logger.info("\n📄 Detailed JIT Run Breakdown:")
        runs_detail = jit_stats["runs_detail"]
        assert isinstance(runs_detail, list)
        for run in runs_detail:
            logger.info(
                f"  - {run['time_slot']}: status={run['status']}, found={run['showtimes_found']}, published={run['jobs_published']}"
            )

    logger.info("=" * 70)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
