"""JIT Seat Scraper - Dispatcher Function.

HTTP-triggered Cloud Function that:
1. Queries Firestore for showtimes starting in three non-overlapping 5-minute windows:
   [T+30, T+35), [T+20, T+25), and [T+10, T+15) minutes from now.
2. Publishes each showtime to Pub/Sub for individual scraping.
3. Every 5 minutes, it captures these three distinct "time waves" for scraping.

Triggered by Cloud Scheduler every 5 minutes.

NOTE: Token refresh is handled by the scraper function, not the dispatcher.
The dispatcher only finds and publishes showtimes; it does not need to access
the TIX API directly. The scraper handles token refresh on-demand when making
API calls, with proper retry logic and distributed locking.

⚠️ SELF-CONTAINED FUNCTION CONSTRAINT ⚠️
This function MUST be entirely self-contained. DO NOT:
- Import from `backend.*` (will break deployment - paths don't exist in container)
- Extract constants/helpers to shared modules (will break deployment)
- Attempt to "clean up" duplication with infrastructure code

⚠️ DEPLOYMENT PROTOCOL ⚠️
DO NOT deploy this function with raw `gcloud functions deploy` commands.
MUST ALWAYS be deployed via: `./backend/functions/deploy.sh dispatcher`

Code duplication with backend/infrastructure/ is INTENTIONAL and required for:
- Deployment isolation (--source=. only uploads this directory)
- Cold start performance (minimal dependencies)
- Independent deployments (update one function without affecting others)

See: backend/functions/README.md#critical-self-contained-function-constraint
See: backend/docs/cloud-functions-architecture.md
"""

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import functions_framework
import google.cloud.firestore as firestore
import google.cloud.pubsub_v1 as pubsub_v1

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
PUBSUB_TOPIC = os.environ.get("PUBSUB_TOPIC", "scrape-seat-jit")
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")

# Window configuration (minutes from now)
# Exactly one 5-minute bucket so each dispatch captures unique showtimes with no overlap.
# e.g., dispatch at 12:00 → captures showtimes from 12:20 to 12:24.
WINDOWS: list[dict[str, Any]] = [
    {"name": "T-30", "start": 30, "end": 35},
    {"name": "T-20", "start": 20, "end": 25},
    {"name": "T-10", "start": 10, "end": 15},
]


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def get_pubsub_publisher() -> pubsub_v1.PublisherClient:
    """Get Pub/Sub publisher client."""
    return pubsub_v1.PublisherClient()


def parse_showtime(time_str: str, date: datetime) -> datetime | None:
    """Parse HH:MM time string into datetime for the given date."""
    try:
        parts = time_str.split(":")
        if len(parts) == 2:
            return date.replace(hour=int(parts[0]), minute=int(parts[1]), second=0, microsecond=0)
    except (ValueError, IndexError):
        pass
    return None


def find_upcoming_showtimes(
    db: firestore.Client, window_start: datetime, window_end: datetime, phase: str = "T-30"
) -> list[dict[str, Any]]:
    """Find showtimes starting within the specified time window.

    Args:
        db: Firestore client
        window_start: Start of window (showtime must be >= this, inclusive)
        window_end: End of window (showtime must be < this, exclusive)

    Returns:
        List of showtime dicts with showtime_id, movie_id, metadata_id, time, etc.

    """
    today = window_start.strftime("%Y-%m-%d")

    # V2 Migration: Try schedules_v2 first, fallback to schedules (V1)
    movies_ref_v2 = db.collection("schedules_v2").document(today).collection("movies")
    movies_ref_v1 = db.collection("schedules").document(today).collection("movies")

    movie_docs = list(movies_ref_v2.stream())
    use_v2_schema = True

    if not movie_docs:
        logger.info(f"No data in schedules_v2/{today}/movies, falling back to schedules (V1)")
        movie_docs = list(movies_ref_v1.stream())
        use_v2_schema = False
    else:
        logger.info(f"Using schedules_v2/{today}/movies (V2 schema)")

    showtimes_to_scrape = []

    for movie_doc in movie_docs:
        movie = movie_doc.to_dict()
        movie_title = movie.get("title", "")

        if use_v2_schema:
            # V2 schema: document ID is metadata_id, schedule_ids is an array
            metadata_id = movie_doc.id
            schedule_ids = movie.get("schedule_ids", [])

            if not schedule_ids:
                logger.warning(
                    f"No schedule_ids for metadata_id={metadata_id} ({movie_title}), skipping"
                )
                continue

            # Use the first schedule_id for API calls
            movie_id = schedule_ids[0]
        else:
            # V1 schema: movie_id is schedule_id, metadata_id may be in tix_metadata_id
            movie_id = movie.get("movie_id", movie_doc.id)
            metadata_id = movie.get("tix_metadata_id") or movie.get("metadata_id")

        # Handle schema: 'cities' key (Firestore) or 'schedules' key (legacy)
        cities = movie.get("cities") or movie.get("schedules", {})

        for city_name, theatres in cities.items():
            for theatre in theatres:
                theatre_id = theatre.get("theatre_id", "")
                theatre_name = theatre.get("theatre_name", "")
                merchant = theatre.get("merchant", "")

                for room in theatre.get("rooms", []):
                    room_category = room.get("category", "")

                    # Use all_showtimes which has showtime_id
                    for showtime_obj in room.get("all_showtimes", []):
                        if not isinstance(showtime_obj, dict):
                            continue

                        showtime_id = showtime_obj.get("showtime_id")
                        time_str = showtime_obj.get("time", "")
                        is_available = showtime_obj.get("is_available", True)

                        if not showtime_id or not is_available:
                            continue

                        # Parse time and check if in window (end-exclusive to avoid overlap)
                        showtime_dt = parse_showtime(time_str, window_start)
                        if showtime_dt and window_start <= showtime_dt < window_end:
                            showtimes_to_scrape.append(
                                {
                                    "showtime_id": showtime_id,
                                    "movie_id": movie_id,  # schedule_id for V1 compatibility
                                    "metadata_id": metadata_id,  # NEW: immutable movie entity ID for V2
                                    "movie_title": movie_title,
                                    "theatre_id": theatre_id,
                                    "theatre_name": theatre_name,
                                    "city": city_name,
                                    "room_category": room_category,
                                    "merchant": merchant,
                                    "showtime": time_str,
                                    "studio_id": showtime_obj.get("studio_id"),
                                    "date": today,
                                    "scrape_phase": phase,
                                }
                            )

    return showtimes_to_scrape


def publish_to_pubsub(publisher: pubsub_v1.PublisherClient, showtimes: list[dict[str, Any]]) -> int:
    """Publish showtimes to Pub/Sub topic for scraping.

    Args:
        publisher: Pub/Sub publisher client
        showtimes: List of showtime dicts

    Returns:
        Number of messages published

    """
    topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)
    futures = []

    for showtime in showtimes:
        message_data = json.dumps(showtime).encode("utf-8")
        future = publisher.publish(topic_path, message_data)
        futures.append(future)

    # Wait for all publishes to complete
    for future in futures:
        future.result()

    return len(futures)


def log_jit_dispatch_to_firestore(
    db: firestore.Client,
    time_slot: str,
    showtimes_found: int,
    jobs_published: int,
    window_start_str: str,
    window_end_str: str,
    phase_counts: dict[str, int],
    status: str = "ok",
    error: str | None = None,
) -> None:
    """Log JIT dispatcher run to scraper_logs/{today}/dispatches/{HH-MM}.

    Creates the dispatch doc with metadata. Scrapers will later increment
    total_errors / total_successes on this same doc.
    """
    now = datetime.now(JAKARTA_TZ)
    today_str = now.strftime("%Y-%m-%d")

    # Use HH-MM format for doc ID (colons not allowed in Firestore doc IDs)
    dispatch_slot = time_slot.replace(":", "-")

    dispatch_entry = {
        "dispatched_at": datetime.now(UTC).isoformat(),
        "time_slot": time_slot,
        "showtimes_found": showtimes_found,
        "jobs_published": jobs_published,
        "window_start": window_start_str,
        "window_end": window_end_str,
        "status": status,
        "total_errors": 0,
        "total_successes": 0,
        # Phase-specific counts (Found)
        "t30_found": phase_counts.get("T-30", 0),
        "t20_found": phase_counts.get("T-20", 0),
        "t10_found": phase_counts.get("T-10", 0),
        # Phase-specific counters (initialized to 0, incremented by scraper)
        "t30_success": 0,
        "t20_success": 0,
        "t10_success": 0,
        "t30_error": 0,
        "t20_error": 0,
        "t10_error": 0,
    }
    if error:
        dispatch_entry["error"] = error

    # Ensure the parent daily doc exists
    daily_ref = db.collection("scraper_logs").document(today_str)
    daily_ref.set(
        {
            "date": today_str,
            "created_at": datetime.now(UTC).isoformat(),
        },
        merge=True,
    )

    # Create the dispatch subcollection doc
    dispatch_ref = daily_ref.collection("dispatches").document(dispatch_slot)
    dispatch_ref.set(dispatch_entry)

    logger.info(
        f"Logged dispatch ({time_slot}) to scraper_logs/{today_str}/dispatches/{dispatch_slot} (T-30: {phase_counts.get('T-30', 0)}, T-20: {phase_counts.get('T-20', 0)}, T-10: {phase_counts.get('T-10', 0)})"
    )


def log_job_creation(db: firestore.Client, batch_id: str, showtime: dict[str, Any]) -> None:
    """Log job creation to scraper_logs/{date}/dispatches/{slot}/jobs/{showtime_id}.

    This creates the initial job document with created_at timestamp.
    The scraper will update this document with checkpoints as it processes the job.

    Args:
        db: Firestore client
        batch_id: Batch ID in format "YYYYMMDD-HHMMSS"
        showtime: Showtime data dict

    """
    try:
        # Parse batch_id to get date and dispatch slot
        dt = datetime.strptime(batch_id, "%Y%m%d-%H%M%S")
        date_str = dt.strftime("%Y-%m-%d")
        dispatch_slot = dt.strftime("%H-%M")
        showtime_id = showtime.get("showtime_id")

        if not showtime_id:
            return

        now_iso = datetime.now(UTC).isoformat()

        job_ref = (
            db.collection("scraper_logs")
            .document(date_str)
            .collection("dispatches")
            .document(dispatch_slot)
            .collection("jobs")
            .document(showtime_id)
        )

        job_ref.set(
            {
                "showtime_id": showtime_id,
                "batch_id": batch_id,
                "job_data": {
                    "movie_id": showtime.get("movie_id"),
                    "movie_title": showtime.get("movie_title"),
                    "theatre_id": showtime.get("theatre_id"),
                    "theatre_name": showtime.get("theatre_name"),
                    "city": showtime.get("city"),
                    "merchant": showtime.get("merchant"),
                    "showtime": showtime.get("showtime"),
                    "studio_id": showtime.get("studio_id"),
                    "scrape_phase": showtime.get("scrape_phase"),
                },
                "lifecycle": {
                    "created_at": now_iso,
                },
                "status": "pending",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )

    except Exception as e:
        logger.warning(f"Failed to log job creation for {showtime.get('showtime_id')}: {e}")


@functions_framework.http
def dispatch_jobs(request: Any) -> Any:
    """HTTP Cloud Function entry point.

    Triggered by Cloud Scheduler every 5 minutes.
    Finds upcoming showtimes and publishes them to Pub/Sub.
    """
    actual_now = datetime.now(JAKARTA_TZ)

    # Snap to the nearest 5-minute floor so slight scheduler delays (e.g., 12:01
    # instead of 12:00) still produce the same deterministic window.
    now = actual_now.replace(minute=(actual_now.minute // 5) * 5, second=0, microsecond=0)

    logger.info(
        f"Dispatcher triggered at {actual_now.isoformat()} (snapped to {now.strftime('%H:%M')})"
    )

    try:
        db = get_firestore_client()
        publisher = get_pubsub_publisher()

        all_showtimes = []
        phase_counts = {}

        # Evaluate each configured window (e.g., T-30, T-15)
        for window in WINDOWS:
            window_start = now + timedelta(minutes=float(window["start"]))
            window_end = now + timedelta(minutes=float(window["end"]))
            phase_name = str(window["name"])

            logger.info(
                f"Checking {phase_name} Window: {window_start.strftime('%H:%M')} - {window_end.strftime('%H:%M')}"
            )

            showtimes = find_upcoming_showtimes(db, window_start, window_end, phase=phase_name)
            all_showtimes.extend(showtimes)
            phase_counts[phase_name] = len(showtimes)

            logger.info(f"Found {len(showtimes)} showtimes in {window['name']} window")

        # Log sample showtimes for debugging
        if all_showtimes:
            sample = all_showtimes[:3]
            for s in sample:
                logger.info(
                    f"  Sample [{s.get('scrape_phase')}]: {s.get('theatre_name', '')[:20]} @ {s.get('showtime')} "
                    f"- {s.get('merchant')}"
                )

            # Generate batch ID (timestamp of dispatch)
            batch_id = now.strftime("%Y%m%d-%H%M%S")

            # Add batch_id to all showtimes and log job creation
            for s in all_showtimes:
                s["batch_id"] = batch_id

                # Append phase to showtime_id for logging uniqueness within the same batch
                s["job_log_id"] = f"{s.get('showtime_id')}_{s.get('scrape_phase')}"

                # log_job_creation(db, batch_id, s)  # Log job creation for lifecycle tracking

            # Publish to Pub/Sub
            count = publish_to_pubsub(publisher, all_showtimes)
            logger.info(f"Published {count} messages to {PUBSUB_TOPIC} (Batch: {batch_id})")

            # Log to scraper_logs
            time_slot = now.strftime("%H:%M")
            log_jit_dispatch_to_firestore(
                db=db,
                time_slot=time_slot,
                showtimes_found=len(all_showtimes),
                jobs_published=count,
                window_start_str="T-30/T-20/T-10 Wave",
                window_end_str="T-30/T-20/T-10 Wave",
                phase_counts=phase_counts,
                status="ok",
            )

            return {"status": "ok", "published": count, "batch_id": batch_id}, 200
        else:
            # Log empty dispatch too
            time_slot = now.strftime("%H:%M")
            log_jit_dispatch_to_firestore(
                db=db,
                time_slot=time_slot,
                showtimes_found=0,
                jobs_published=0,
                window_start_str="T-30/T-20/T-10 Wave",
                window_end_str="T-30/T-20/T-10 Wave",
                phase_counts=phase_counts,
                status="ok",
            )
            return {"status": "ok", "published": 0, "message": "No showtimes in windows"}, 200

    except Exception as e:
        logger.error(f"Error in dispatcher: {e}", exc_info=True)
        # Log error to scraper_logs
        try:
            time_slot = now.strftime("%H:%M")
            log_jit_dispatch_to_firestore(
                db=db,
                time_slot=time_slot,
                showtimes_found=0,
                jobs_published=0,
                window_start_str="ERROR",
                window_end_str="ERROR",
                phase_counts={},
                status="error",
                error=str(e),
            )
        except Exception:
            pass  # Don't fail if logging fails
        return {"status": "error", "error": str(e)}, 500
