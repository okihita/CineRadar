"""
JIT Seat Scraper - Dispatcher Function

HTTP-triggered Cloud Function that:
1. Queries Firestore for showtimes starting in T+8 to T+13 minutes
2. Publishes each showtime to Pub/Sub for individual scraping

Triggered by Cloud Scheduler every 5 minutes.
"""

import json
import logging
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import functions_framework
from google.cloud import firestore, pubsub_v1

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
PUBSUB_TOPIC = os.environ.get("PUBSUB_TOPIC", "scrape-seat-jit")
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")

# Window configuration (minutes from now)
WINDOW_START_MINUTES = 8  # Start scraping showtimes 8 min before start
WINDOW_END_MINUTES = 13  # End window at 13 min before start (5 min buffer)


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
    db: firestore.Client, window_start: datetime, window_end: datetime
) -> list[dict]:
    """Find showtimes starting within the specified time window.

    Args:
        db: Firestore client
        window_start: Start of window (showtime must be >= this)
        window_end: End of window (showtime must be <= this)

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

                        # Parse time and check if in window
                        showtime_dt = parse_showtime(time_str, window_start)
                        if showtime_dt and window_start <= showtime_dt <= window_end:
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


def publish_to_pubsub(publisher: pubsub_v1.PublisherClient, showtimes: list[dict]) -> int:
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


@functions_framework.http
def dispatch_jobs(request):
    """HTTP Cloud Function entry point.

    Triggered by Cloud Scheduler every 5 minutes.
    Finds upcoming showtimes and publishes them to Pub/Sub.
    """
    now = datetime.now(JAKARTA_TZ)
    window_start = now + timedelta(minutes=WINDOW_START_MINUTES)
    window_end = now + timedelta(minutes=WINDOW_END_MINUTES)

    logger.info(f"Dispatcher triggered at {now.isoformat()}")
    logger.info(f"Window: {window_start.strftime('%H:%M')} - {window_end.strftime('%H:%M')}")

    try:
        db = get_firestore_client()
        publisher = get_pubsub_publisher()

        # Find showtimes in window
        showtimes = find_upcoming_showtimes(db, window_start, window_end)
        logger.info(f"Found {len(showtimes)} showtimes in window")

        # Log sample showtimes for debugging
        if showtimes:
            sample = showtimes[:3]
            for s in sample:
                logger.info(
                    f"  Sample: {s.get('theatre_name', '')[:20]} @ {s.get('showtime')} - {s.get('merchant')}"
                )

        if showtimes:
            # Publish to Pub/Sub
            count = publish_to_pubsub(publisher, showtimes)
            logger.info(f"Published {count} messages to {PUBSUB_TOPIC}")
            return {"status": "ok", "published": count}, 200
        else:
            return {"status": "ok", "published": 0, "message": "No showtimes in window"}, 200

    except Exception as e:
        logger.error(f"Error in dispatcher: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}, 500
