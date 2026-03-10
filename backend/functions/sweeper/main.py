"""JIT Seat Scraper - Sweeper Function.

HTTP-triggered Cloud Function that:
1. Lists all movies for today from `schedules` (V1) or `schedules_v2` (V2)
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


def aggregate_daily_stats(
    db: firestore.Client,
    date_str: str,
    movie_id: str,
    movie_title: str,
    metadata_id: str | None = None,
) -> bool:
    """Aggregate showtimes for a specific date and update DailyPerformance.

    Args:
        db: Firestore client
        date_str: Date string (YYYY-MM-DD)
        movie_id: Schedule ID (V1 compatibility)
        movie_title: Movie title for logging
        metadata_id: Immutable movie entity ID (V2 schema)

    Returns: True if updated (even if 0)
    """
    try:
        # V2 Migration: Try movie_performance_v2 first if metadata_id available
        showtimes_ref = None
        use_v2 = False

        if metadata_id:
            showtimes_ref_v2 = (
                db.collection("movie_performance_v2")
                .document(metadata_id)
                .collection("days")
                .document(date_str)
                .collection("showtimes")
            )
            # Check if V2 has data
            v2_snapshots = list(showtimes_ref_v2.limit(1).stream())
            if v2_snapshots:
                showtimes_ref = showtimes_ref_v2
                use_v2 = True
                logger.debug(f"Using V2 performance data for {metadata_id}")

        # Fallback to V1 if V2 not available
        if not showtimes_ref:
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
            return False

        # Daily Aggregation InMemory
        total_showtimes_scraped = 0
        total_seats = 0
        total_sold = 0
        occupancy_sum = 0.0
        cities: set[str] = set()

        for snap in snapshots:
            data = snap.to_dict()

            s_seats = data.get("total_seats", 0)

            # True Audience Delta: Try to use audience_count first, fallback to raw sold_seats
            s_sold = data.get("audience_count")
            if s_sold is None:
                s_sold = data.get("sold_seats", 0)

            # Try to use true delta occupancy first, fallback to raw occupancy
            s_occ = data.get("audience_pct")
            if s_occ is None:
                s_occ = data.get("occupancy_pct", 0.0)

            s_city = data.get("city", "")

            if s_seats > 0:
                total_showtimes_scraped += 1
                total_seats += s_seats
                total_sold += s_sold
                occupancy_sum += s_occ

            if s_city:
                cities.add(s_city)

        # Calculate averages
        avg_occupancy = (
            (occupancy_sum / total_showtimes_scraped) if total_showtimes_scraped > 0 else 0.0
        )

        # Update DailyPerformance (dual-write to V1 and V2)
        update_data = {
            "total_showtimes_scraped": total_showtimes_scraped,
            "total_seats": total_seats,
            "total_sold": total_sold,
            "avg_occupancy_pct": round(avg_occupancy, 1),
            "cities": sorted(cities),
            "last_swept_at": datetime.now(JAKARTA_TZ).isoformat(),
        }

        # V1 write (existing - keep for backward compatibility)
        daily_ref_v1 = (
            db.collection("movie_performance")
            .document(movie_id)
            .collection("days")
            .document(date_str)
        )
        daily_ref_v1.set(update_data, merge=True)

        # V2 write (new - only if metadata_id available and using V2 data)
        if metadata_id and use_v2:
            daily_ref_v2 = (
                db.collection("movie_performance_v2")
                .document(metadata_id)
                .collection("days")
                .document(date_str)
            )
            daily_ref_v2.set(update_data, merge=True)
            logger.debug(f"Daily Update V2 {metadata_id} ({date_str}): {total_sold}/{total_seats} seats")

        logger.debug(f"Daily Update {movie_id} ({date_str}): {total_sold}/{total_seats} seats")
        return True

    except Exception as e:
        logger.error(f"Failed to aggregate daily for {movie_title} on {date_str}: {e}")
        return False


def aggregate_all_time_stats(
    db: firestore.Client, movie_id: str, metadata_id: str | None = None
) -> bool:
    """Aggregate all daily stats into root MovieMetadata.

    Sums up all 'days' documents.

    Args:
        db: Firestore client
        movie_id: Schedule ID (V1 compatibility)
        metadata_id: Immutable movie entity ID (V2 schema)
    """
    try:
        # V2 Migration: Try movie_performance_v2 first if metadata_id available
        days_ref = None
        use_v2 = False

        if metadata_id:
            days_ref_v2 = (
                db.collection("movie_performance_v2")
                .document(metadata_id)
                .collection("days")
            )
            # Check if V2 has data
            v2_daily_docs = list(days_ref_v2.limit(1).stream())
            if v2_daily_docs:
                days_ref = days_ref_v2
                use_v2 = True
                logger.debug(f"Using V2 performance data for all-time stats: {metadata_id}")

        # Fallback to V1 if V2 not available
        if not days_ref:
            days_ref = db.collection("movie_performance").document(movie_id).collection("days")

        # Read all daily summaries (Read Ops = M days)
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

        # Weighted average for "All Time Occupancy"
        avg_occupancy = (all_time_sold / all_time_seats) * 100 if all_time_seats > 0 else 0.0

        root_update = {
            "total_sold": all_time_sold,
            "total_seats": all_time_seats,
            "total_showtimes_scraped": all_time_scraped,
            "avg_occupancy_pct": round(avg_occupancy, 1),
            "last_swept_at": datetime.now(JAKARTA_TZ).isoformat(),
        }

        # V1 write (existing - keep for backward compatibility)
        root_ref_v1 = db.collection("movie_performance").document(movie_id)
        root_ref_v1.set(root_update, merge=True)

        # V2 write (new - only if metadata_id available and using V2 data)
        if metadata_id and use_v2:
            root_ref_v2 = db.collection("movie_performance_v2").document(metadata_id)
            root_ref_v2.set(root_update, merge=True)

        return True

    except Exception as e:
        logger.error(f"Failed to aggregate all-time for {movie_id}: {e}")
        return False


@functions_framework.http  # type: ignore[untyped-decorator]
def run_sweeper(request: Any) -> Any:
    """HTTP Cloud Function entry point."""
    now = datetime.now(JAKARTA_TZ)

    # 1. Determine Date to Sweep
    today_str = now.strftime("%Y-%m-%d")
    dates_to_sweep = {today_str}

    logger.info(f"🧹 Starting Sweeper for {today_str} at {now.isoformat()}")

    db = get_firestore_client()

    # 2. Get list of active movies
    # V2 Migration: Try schedules_v2 first, fallback to schedules (V1)
    movies_ref_v2 = db.collection("schedules_v2").document(today_str).collection("movies")
    movies_ref_v1 = db.collection("schedules").document(today_str).collection("movies")

    movie_docs = list(movies_ref_v2.stream())
    use_v2_schema = True

    if not movie_docs:
        logger.info(f"No data in schedules_v2/{today_str}/movies, falling back to schedules (V1)")
        movie_docs = list(movies_ref_v1.stream())
        use_v2_schema = False
    else:
        logger.info(f"Using schedules_v2/{today_str}/movies (V2 schema)")

    # Store movie info: for V2, key is metadata_id; for V1, key is schedule_id
    movie_info = {}  # id -> {title, metadata_id, schedule_id}

    # Load Today's Movies
    for doc in movie_docs:
        data = doc.to_dict()
        title = data.get("title", "Unknown")

        if use_v2_schema:
            # V2 schema: document ID is metadata_id, schedule_ids is an array
            metadata_id = doc.id
            schedule_ids = data.get("schedule_ids", [])
            schedule_id = schedule_ids[0] if schedule_ids else metadata_id
            movie_info[metadata_id] = {
                "title": title,
                "metadata_id": metadata_id,
                "schedule_id": schedule_id,
            }
        else:
            # V1 schema: movie_id is schedule_id, metadata_id may be in tix_metadata_id
            schedule_id = data.get("movie_id") or data.get("id") or doc.id
            metadata_id = data.get("tix_metadata_id") or data.get("metadata_id")
            movie_info[schedule_id] = {
                "title": title,
                "metadata_id": metadata_id,
                "schedule_id": schedule_id,
            }

    logger.info(f"Found {len(movie_info)} unique active movies to sweep.")

    daily_updates = 0
    all_time_updates = 0

    # 3. Execution Loop
    for _, info in movie_info.items():
        title = info["title"]
        schedule_id = info["schedule_id"]
        metadata_id = info.get("metadata_id")

        # A. Update Daily Stats (for all target dates)
        updated_any_day = False
        for date_str in dates_to_sweep:
            if aggregate_daily_stats(db, date_str, schedule_id, title, metadata_id):
                updated_any_day = True

        if updated_any_day:
            daily_updates += 1

        # B. Update All-Time Stats
        if aggregate_all_time_stats(db, schedule_id, metadata_id):
            all_time_updates += 1

    # Log summary
    summary = {
        "dates_swept": list(dates_to_sweep),
        "movies_processed": len(movie_info),
        "daily_updates": daily_updates,
        "all_time_updates": all_time_updates,
        "timestamp": now.isoformat(),
        "schema": "v2" if use_v2_schema else "v1",
    }

    logger.info(
        f"🎉 Sweep Complete. Updated {daily_updates} daily & {all_time_updates} all-time stats."
    )

    return summary, 200
