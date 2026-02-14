"""
JIT Seat Scraper - Dispatcher Function

HTTP-triggered Cloud Function that:
1. Queries Firestore for showtimes starting in exactly the [T+15, T+20) minute window
2. Publishes each showtime to Pub/Sub for individual scraping
3. Each 5-minute dispatch captures exactly one non-overlapping bucket

Triggered by Cloud Scheduler every 5 minutes.
"""

import contextlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import functions_framework
import requests
from google.cloud import firestore, pubsub_v1

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
PUBSUB_TOPIC = os.environ.get("PUBSUB_TOPIC", "scrape-seat-jit")
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
REFRESH_API_URL = "https://api-b2b.tix.id/v1/users/refresh"

# Window configuration (minutes from now)
# Exactly one 5-minute bucket so each dispatch captures unique showtimes with no overlap.
# e.g., dispatch at 12:00 → captures showtimes from 12:15 to 12:19.
WINDOW_START_MINUTES = 15  # Start of window: showtimes starting 15 min from now
WINDOW_END_MINUTES = 20  # End of window: showtimes starting up to 20 min from now (exclusive)


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def get_pubsub_publisher() -> pubsub_v1.PublisherClient:
    """Get Pub/Sub publisher client."""
    return pubsub_v1.PublisherClient()


class TokenRefreshLock:
    """Distributed lock for token refresh using Firestore."""

    def __init__(self, db: firestore.Client):
        self.db = db
        self.lock_ref = db.collection("auth_tokens").document("refresh_lock")
        self.timeout = 30  # seconds

    def acquire(self, instance_id: str) -> bool:
        """Attempt to acquire the lock."""
        now = datetime.utcnow().isoformat()
        try:
            # Try to create lock doc
            self.lock_ref.create({
                "locked_at": now,
                "instance_id": instance_id
            })
            return True
        except Exception:
            # Already exists, check if stale
            doc = self.lock_ref.get()
            if not doc.exists:
                return self.acquire(instance_id)

            data = doc.to_dict()
            locked_at_str = data.get("locked_at", "")
            try:
                locked_at = datetime.fromisoformat(locked_at_str)
                age = (datetime.utcnow() - locked_at).total_seconds()
                if age > self.timeout:
                    logger.warning(f"Taking over stale lock (age={age:.1f}s)")
                    self.lock_ref.set({
                        "locked_at": now,
                        "instance_id": instance_id,
                        "took_over": True
                    })
                    return True
            except Exception:
                # Invalid timestamp, force take
                self.lock_ref.set({
                    "locked_at": now,
                    "instance_id": instance_id,
                    "took_over": True
                })
                return True

            return False

    def release(self) -> None:
        """Release the lock."""
        with contextlib.suppress(Exception):
            self.lock_ref.delete()


def refresh_access_token(db: firestore.Client, refresh_token: str) -> bool:
    """Refresh access token using the validation API with distributed locking."""
    import time
    import uuid

    instance_id = f"dispatcher-{uuid.uuid4().hex[:8]}"
    lock = TokenRefreshLock(db)

    # Try to acquire lock
    if not lock.acquire(instance_id):
        logger.info("Another instance is refreshing, waiting...")
        time.sleep(1)
        # We assume other instance succeeded
        return True

    logger.info("🔄 Acquired lock, attempting token refresh...")

    try:
        response = requests.post(
            REFRESH_API_URL,
            headers={
                "Authorization": f"Bearer {refresh_token}",
                "Content-Type": "application/json",
                "platform": "web",
            },
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            new_token = data.get("data", {}).get("token")

            if new_token:
                # Update Firestore
                now_iso = datetime.now().isoformat()
                db.collection("auth_tokens").document("tix_jwt").set(
                    {
                        "token": new_token,
                        "refresh_token": refresh_token,
                        "stored_at": now_iso,
                        "updated_by": instance_id,
                    },
                    merge=True,
                )
                logger.info("✅ Inline refresh successful & saved to Firestore")
                return True
            else:
                logger.error("❌ Refresh response missing token")
        else:
            logger.error(f"❌ Refresh failed: {response.status_code} {response.text[:100]}")

    except requests.RequestException as e:
        logger.error(f"❌ Refresh request exception: {e}")
    finally:
        lock.release()

    return False


def ensure_token_freshness(db: firestore.Client) -> None:
    """Ensure token is fresh before dispatching jobs.

    Refreshes if token is > 20 minutes old.
    """
    try:
        doc = db.collection("auth_tokens").document("tix_jwt").get()
        if not doc.exists:
            logger.warning("No token document found")
            return

        data = doc.to_dict()
        if not data:
            return

        stored_at_str = data.get("stored_at")
        refresh_token = data.get("refresh_token", "").strip('"')

        should_refresh = False

        if stored_at_str:
            try:
                # Handle potentially naive or aware inputs
                stored_at = datetime.fromisoformat(stored_at_str)
                if stored_at.tzinfo is None:
                    age = datetime.now() - stored_at
                else:
                    age = datetime.now(stored_at.tzinfo) - stored_at

                age_minutes = age.total_seconds() / 60

                if age_minutes >= 20:
                    logger.info(f"⚠️ Token is {age_minutes:.1f} min old. Dispatcher refreshing...")
                    should_refresh = True
                else:
                    logger.info(f"Token is {age_minutes:.1f} min old (fresh).")

            except ValueError:
                logger.warning("Could not parse stored_at time, forcing refresh check")
                should_refresh = True
        else:
            should_refresh = True

        if should_refresh and refresh_token:
            refresh_access_token(db, refresh_token)

    except Exception as e:
        logger.error(f"Failed to ensure token freshness: {e}")


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
    db: firestore.Client, window_start: datetime, window_end: datetime
) -> list[dict[str, Any]]:
    """Find showtimes starting within the specified time window.

    Args:
        db: Firestore client
        window_start: Start of window (showtime must be >= this, inclusive)
        window_end: End of window (showtime must be < this, exclusive)

    Returns:
        List of showtime dicts with showtime_id, movie_id, time, etc.
    """
    today = window_start.strftime("%Y-%m-%d")
    logger.info(f"Querying schedules/{today}/movies")

    movies_ref = db.collection("schedules").document(today).collection("movies")
    showtimes_to_scrape = []

    for movie_doc in movies_ref.stream():
        movie = movie_doc.to_dict()
        movie_id = movie.get("movie_id", movie_doc.id)
        movie_title = movie.get("title", "")

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
                                    "movie_id": movie_id,
                                    "movie_title": movie_title,
                                    "theatre_id": theatre_id,
                                    "theatre_name": theatre_name,
                                    "city": city_name,
                                    "room_category": room_category,
                                    "merchant": merchant,
                                    "showtime": time_str,
                                    "date": today,
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
        "dispatched_at": datetime.utcnow().isoformat() + "Z",
        "time_slot": time_slot,
        "showtimes_found": showtimes_found,
        "jobs_published": jobs_published,
        "window_start": window_start_str,
        "window_end": window_end_str,
        "status": status,
        "total_errors": 0,
        "total_successes": 0,
    }
    if error:
        dispatch_entry["error"] = error

    # Ensure the parent daily doc exists
    daily_ref = db.collection("scraper_logs").document(today_str)
    daily_ref.set(
        {
            "date": today_str,
            "created_at": datetime.utcnow().isoformat() + "Z",
        },
        merge=True,
    )

    # Create the dispatch subcollection doc
    dispatch_ref = daily_ref.collection("dispatches").document(dispatch_slot)
    dispatch_ref.set(dispatch_entry)

    logger.info(
        f"Logged dispatch ({time_slot}) to scraper_logs/{today_str}/dispatches/{dispatch_slot}"
    )


@functions_framework.http  # type: ignore[untyped-decorator]
def dispatch_jobs(request: Any) -> Any:
    """HTTP Cloud Function entry point.

    Triggered by Cloud Scheduler every 5 minutes.
    Finds upcoming showtimes and publishes them to Pub/Sub.
    """
    actual_now = datetime.now(JAKARTA_TZ)

    # Snap to the nearest 5-minute floor so slight scheduler delays (e.g., 12:01
    # instead of 12:00) still produce the same deterministic window.
    now = actual_now.replace(
        minute=(actual_now.minute // 5) * 5, second=0, microsecond=0
    )

    window_start = now + timedelta(minutes=WINDOW_START_MINUTES)
    window_end = now + timedelta(minutes=WINDOW_END_MINUTES)

    logger.info(
        f"Dispatcher triggered at {actual_now.isoformat()} "
        f"(snapped to {now.strftime('%H:%M')})"
    )
    logger.info(f"Window: {window_start.strftime('%H:%M')} - {window_end.strftime('%H:%M')}")

    try:
        db = get_firestore_client()
        publisher = get_pubsub_publisher()

        # Ensure token is fresh before dispatching
        ensure_token_freshness(db)

        # Find showtimes in window
        showtimes = find_upcoming_showtimes(db, window_start, window_end)
        logger.info(f"Found {len(showtimes)} showtimes in window")

        # Log sample showtimes for debugging
        if showtimes:
            sample = showtimes[:3]
            for s in sample:
                logger.info(
                    f"  Sample: {s.get('theatre_name', '')[:20]} @ {s.get('showtime')} "
                    f"- {s.get('merchant')}"
                )

        if showtimes:
            # Generate batch ID (timestamp of dispatch)
            batch_id = now.strftime("%Y%m%d-%H%M%S")

            # Add batch_id to all showtimes
            for s in showtimes:
                s["batch_id"] = batch_id

            # Publish to Pub/Sub
            count = publish_to_pubsub(publisher, showtimes)
            logger.info(f"Published {count} messages to {PUBSUB_TOPIC} (Batch: {batch_id})")

            # Log to scraper_logs
            time_slot = now.strftime("%H:%M")
            log_jit_dispatch_to_firestore(
                db=db,
                time_slot=time_slot,
                showtimes_found=len(showtimes),
                jobs_published=count,
                window_start_str=window_start.strftime("%H:%M"),
                window_end_str=window_end.strftime("%H:%M"),
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
                window_start_str=window_start.strftime("%H:%M"),
                window_end_str=window_end.strftime("%H:%M"),
                status="ok",
            )
            return {"status": "ok", "published": 0, "message": "No showtimes in window"}, 200

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
                window_start_str=window_start.strftime("%H:%M"),
                window_end_str=window_end.strftime("%H:%M"),
                status="error",
                error=str(e),
            )
        except Exception:
            pass  # Don't fail if logging fails
        return {"status": "error", "error": str(e)}, 500
