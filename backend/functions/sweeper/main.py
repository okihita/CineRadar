
"""
JIT Seat Scraper - Sweeper Function

HTTP-triggered Cloud Function that:
1. Lists all movies for today from `schedules`
2. For each movie, reads all `showtimes` (snapshots)
3. Aggregates DAILY stats (total sold, occupancy)
4. Updates the parent `DailyPerformance` document
5. Aggregates ALL-TIME stats (root collection)

Triggered by Cloud Scheduler every 30 minutes.

⚠️ SELF-CONTAINED FUNCTION CONSTRAINT ⚠️
This function MUST be entirely self-contained. DO NOT:
- Import from `backend.*` (will break deployment - paths don't exist in container)
- Extract constants/helpers to shared modules (will break deployment)
- Attempt to "clean up" duplication with infrastructure code

Code duplication with backend/infrastructure/ is INTENTIONAL and required for:
- Deployment isolation (--source=. only uploads this directory)
- Cold start performance (minimal dependencies)
- Independent deployments (update one function without affecting others)

Duplicated code in this file:
- PROJECT_ID, JAKARTA_TZ constants → also in dispatcher/main.py, scraper/main.py
- get_firestore_client() → also in infrastructure/repositories/firestore_utils.py

See: backend/functions/README.md#critical-self-contained-function-constraint
See: backend/docs/cloud-functions-architecture.md
"""

import logging
import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import functions_framework
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def aggregate_daily_stats(db: firestore.Client, date_str: str, movie_id: str, movie_title: str) -> bool:
    """Aggregate showtimes for a specific date and update DailyPerformance.

    Returns: True if updated (even if 0)
    """
    try:
        # 1. Get all showtimes for this date
        showtimes_ref = (
            db.collection("movie_performance")
            .document(movie_id)
            .collection("days")
            .document(date_str)
            .collection("showtimes")
        )

        # Stream all snapshots (Read Ops = N showtimes)
        snapshots = list(showtimes_ref.stream())

        if not snapshots:
            # Maybe the movie is in schedule but no showtimes scraped yet?
            # We skip updating to save writes, unless we want to clear stats?
            # Let's verify if DailyPerformance exists. If not, we might want to create it?
            # Actually, initialize_performance_data creates the doc.
            return False

        # 2. Daily Aggregation InMemory
        total_showtimes_scraped = 0
        total_seats = 0
        total_sold = 0
        occupancy_sum = 0.0
        cities: set[str] = set()

        for snap in snapshots:
            data = snap.to_dict()

            s_seats = data.get("total_seats", 0)
            s_sold = data.get("sold_seats", 0)
            s_city = data.get("city", "")
            s_occ = data.get("occupancy_pct", 0.0)

            # Use total_seats > 0 as proxy for "successfully scraped"
            if s_seats > 0:
                total_showtimes_scraped += 1
                total_seats += s_seats
                total_sold += s_sold
                occupancy_sum += s_occ

            if s_city:
                cities.add(s_city)

        # Calculate averages
        avg_occupancy = (occupancy_sum / total_showtimes_scraped) if total_showtimes_scraped > 0 else 0.0

        # 3. Update DailyPerformance
        daily_ref = (
            db.collection("movie_performance")
            .document(movie_id)
            .collection("days")
            .document(date_str)
        )

        update_data = {
            "total_showtimes_scraped": total_showtimes_scraped,
            "total_seats": total_seats,
            "total_sold": total_sold,
            "avg_occupancy_pct": round(avg_occupancy, 1),
            "cities": sorted(cities),
            "last_swept_at": datetime.now(JAKARTA_TZ).isoformat(),
        }

        # Merge update
        daily_ref.set(update_data, merge=True)

        logger.debug(f"Daily Update {movie_id} ({date_str}): {total_sold}/{total_seats} seats")
        return True

    except Exception as e:
        logger.error(f"Failed to aggregate daily for {movie_title} on {date_str}: {e}")
        return False


def aggregate_all_time_stats(db: firestore.Client, movie_id: str) -> bool:
    """Aggregate all daily stats into root MovieMetadata.

    Sums up all 'days' documents.
    """
    try:
        days_ref = (
            db.collection("movie_performance")
            .document(movie_id)
            .collection("days")
        )

        # Read all daily summaries (Read Ops = M days)
        # M is typically small (1-60)
        daily_docs = list(days_ref.stream())

        if not daily_docs:
            return False

        all_time_sold = 0
        all_time_seats = 0
        all_time_scraped = 0
        occupancy_sum = 0.0
        days_with_data = 0

        for doc in daily_docs:
            data = doc.to_dict()
            d_sold = data.get("total_sold", 0)
            d_seats = data.get("total_seats", 0)
            d_scraped = data.get("total_showtimes_scraped", 0)
            d_occ = data.get("avg_occupancy_pct", 0.0)

            all_time_sold += d_sold
            all_time_seats += d_seats
            all_time_scraped += d_scraped

            if d_scraped > 0:
                occupancy_sum += d_occ
                days_with_data += 1

        # Average of daily averages (simple approximation)
        # OR weighted average: (total_sold / total_seats) * 100
        # Weighted is more accurate for "All Time Occupancy"
        avg_occupancy = (
            (all_time_sold / all_time_seats) * 100 if all_time_seats > 0 else 0.0
        )

        # Update Root Metadata
        root_ref = db.collection("movie_performance").document(movie_id)

        root_update = {
            "total_sold": all_time_sold,
            "total_seats": all_time_seats,
            "total_showtimes_scraped": all_time_scraped,
            "avg_occupancy_pct": round(avg_occupancy, 1),
            "last_swept_at": datetime.now(JAKARTA_TZ).isoformat(),
        }

        root_ref.set(root_update, merge=True)
        return True

    except Exception as e:
        logger.error(f"Failed to aggregate all-time for {movie_id}: {e}")
        return False


@functions_framework.http  # type: ignore
def run_sweeper(request: Any) -> Any:
    """HTTP Cloud Function entry point."""
    now = datetime.now(JAKARTA_TZ)

    # 1. Determine Date to Sweep
    # Simplified: Always sweep TODAY only.
    # Valid validation confirms latest show is ~23:15, so 23:30 sweep covers it.
    today_str = now.strftime("%Y-%m-%d")
    dates_to_sweep = {today_str}

    logger.info(f"🧹 Starting Sweeper for {today_str} at {now.isoformat()}")

    db = get_firestore_client()

    # 2. Get list of active movies
    # Fetch movies from schedules/{today}/movies
    movies_ref = db.collection("schedules").document(today_str).collection("movies")
    movie_docs = list(movies_ref.stream())

    target_movie_ids = set()
    movie_titles = {}  # id -> title

    # Load Today's Movies
    for doc in movie_docs:
        data = doc.to_dict()
        mid = data.get("movie_id") or data.get("id") or doc.id
        target_movie_ids.add(mid)
        movie_titles[mid] = data.get("title", "Unknown")

    logger.info(f"Found {len(target_movie_ids)} unique active movies to sweep.")

    daily_updates = 0
    all_time_updates = 0

    # 3. Execution Loop
    for movie_id in target_movie_ids:
        title = movie_titles.get(movie_id, "Unknown")

        # A. Update Daily Stats (for all target dates)
        updated_any_day = False
        for date_str in dates_to_sweep:
            if aggregate_daily_stats(db, date_str, movie_id, title):
                updated_any_day = True

        if updated_any_day:
            daily_updates += 1

        # B. Update All-Time Stats
        # Always run this if we are processing the movie, to ensure consistency
        if aggregate_all_time_stats(db, movie_id):
            all_time_updates += 1

    # Log summary
    summary = {
        "dates_swept": list(dates_to_sweep),
        "movies_processed": len(target_movie_ids),
        "daily_updates": daily_updates,
        "all_time_updates": all_time_updates,
        "timestamp": now.isoformat(),
    }

    logger.info(
        f"🎉 Sweep Complete. Updated {daily_updates} daily & {all_time_updates} all-time stats."
    )

    return summary, 200
