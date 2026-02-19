"""
Firestore client for CineRadar theatre database.
Manages theatre collection with geocoding data.
"""

import json
import logging
import os
import tempfile
from datetime import UTC, datetime
from typing import Any, cast

from backend.domain.time import JAKARTA_TZ
from backend.infrastructure.firestore_collections import (
    DISPATCHES,
    SCRAPER_LOGS,
    SNAPSHOTS,
    THEATRES,
)

logger = logging.getLogger(__name__)


def get_firestore_client() -> Any:
    """Get Firestore client with proper credentials.

    Supports:
    - FIREBASE_SERVICE_ACCOUNT env var (JSON string) for CI/CD
    - GOOGLE_APPLICATION_CREDENTIALS file path
    - Default application credentials (local dev)
    """
    from google.cloud import firestore

    # Check for service account JSON in env (for GitHub Actions)
    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if service_account_json:
        # Write to temp file for google-cloud-firestore
        creds_data = json.loads(service_account_json)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(creds_data, f)
            temp_path = f.name
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_path
        return firestore.Client(project=creds_data.get("project_id", "cineradar-481014"))

    # Default: use ADC or GOOGLE_APPLICATION_CREDENTIALS
    return firestore.Client(project=os.environ.get("FIREBASE_PROJECT_ID", "cineradar-481014"))


def upsert_theatre(theatre_data: dict[str, Any], validate: bool = True) -> bool:
    """
    Insert or update a theatre in Firestore.

    Args:
        theatre_data: dict with theatre_id, name, merchant, city, address, lat, lng, room_types
        validate: Whether to validate with Pydantic before writing

    Returns:
        True if successful
    """
    # Validate with Pydantic if enabled
    if validate:
        try:
            from pydantic import ValidationError

            from backend.schemas.theatre import TheatreSchema

            TheatreSchema.model_validate(theatre_data)
        except ValidationError as e:
            logger.error(
                f"⚠️ Validation failed for theatre {theatre_data.get('theatre_id')}: {e.errors()}"
            )
            return False
        except ImportError:
            pass  # Pydantic not available, skip validation

    try:
        db = get_firestore_client()
        theatre_id = theatre_data.get("theatre_id")

        if not theatre_id:
            return False

        doc_ref = db.collection(THEATRES).document(str(theatre_id))

        # Check if exists
        doc = doc_ref.get()
        now = datetime.now(UTC).isoformat()

        if doc.exists:
            # Update existing
            update_data = {
                "name": theatre_data.get("name"),
                "merchant": theatre_data.get("merchant"),
                "city": theatre_data.get("city"),
                "address": theatre_data.get("address"),
                "last_seen": now,
                "updated_at": now,
            }

            # Update lat/lng if provided
            if theatre_data.get("lat") is not None:
                update_data["lat"] = theatre_data["lat"]
            if theatre_data.get("lng") is not None:
                update_data["lng"] = theatre_data["lng"]
            if theatre_data.get("place_id"):
                update_data["place_id"] = theatre_data["place_id"]

            # Merge room types
            existing_rooms = set(doc.to_dict().get("room_types", []))
            new_rooms = set(theatre_data.get("room_types", []))
            update_data["room_types"] = list(existing_rooms | new_rooms)

            doc_ref.update(update_data)
        else:
            # Create new
            doc_ref.set(
                {
                    "theatre_id": str(theatre_id),
                    "name": theatre_data.get("name"),
                    "merchant": theatre_data.get("merchant"),
                    "city": theatre_data.get("city"),
                    "address": theatre_data.get("address"),
                    "lat": theatre_data.get("lat"),
                    "lng": theatre_data.get("lng"),
                    "place_id": theatre_data.get("place_id"),
                    "room_types": theatre_data.get("room_types", []),
                    "last_seen": now,
                    "created_at": now,
                    "updated_at": now,
                }
            )

        return True
    except Exception as e:
        logger.error(f"Error upserting theatre {theatre_data.get('theatre_id')}: {e}")
        return False


def get_theatre(theatre_id: str) -> dict[str, Any] | None:
    """Get a theatre by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection(THEATRES).document(str(theatre_id)).get()
        if doc.exists:
            return cast("dict[str, Any]", doc.to_dict())
        return None
    except Exception as e:
        logger.error(f"Error getting theatre {theatre_id}: {e}")
        return None


def get_all_theatres() -> list[dict[str, Any]]:
    """Get all theatres."""
    try:
        db = get_firestore_client()
        docs = db.collection(THEATRES).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"Error getting all theatres: {e}")
        return []


def get_theatres_by_city(city: str) -> list[dict[str, Any]]:
    """Get all theatres in a city."""
    try:
        db = get_firestore_client()
        docs = db.collection(THEATRES).where("city", "==", city.upper()).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"Error getting theatres for {city}: {e}")
        return []


def sync_theatres_from_scrape(movies: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Sync theatres from scraped movie data to Firestore.

    Args:
        movies: List of movie dicts with schedules

    Returns:
        Summary dict with counts
    """
    seen_theatres: dict[str, dict[str, Any]] = {}

    for movie in movies:
        schedules = movie.get("schedules", {})
        for city, theatres in schedules.items():
            for theatre in theatres:
                theatre_id = theatre.get("theatre_id")
                if not theatre_id:
                    continue

                # Collect room types from this movie
                room_types = [
                    r.get("category") for r in theatre.get("rooms", []) if r.get("category")
                ]

                if theatre_id in seen_theatres:
                    # Merge room types
                    seen_theatres[theatre_id]["room_types"].extend(room_types)
                else:
                    seen_theatres[theatre_id] = {
                        "theatre_id": theatre_id,
                        "name": theatre.get("theatre_name"),
                        "merchant": theatre.get("merchant"),
                        "city": city,
                        "address": theatre.get("address"),
                        "lat": theatre.get("lat"),
                        "lng": theatre.get("lng"),
                        "room_types": room_types,
                    }

    # Dedupe room types and upsert
    success = 0
    failed = 0

    for _theatre_id, data in seen_theatres.items():
        data["room_types"] = list(set(data["room_types"]))
        if upsert_theatre(data):
            success += 1
        else:
            failed += 1

    return {"total": len(seen_theatres), "success": success, "failed": failed}


# ============================================================================
# Consolidated scraper_logs functions (daily document model)
# ============================================================================


def log_morning_scrape(
    status: str,
    start_time: str | None = None,
    end_time: str | None = None,
    duration_seconds: float | None = None,
    movies_found: int = 0,
    theatres_total: int = 0,
    cities_covered: int = 0,
    error: str | None = None,
) -> bool:
    """Log morning scrape status to consolidated daily scraper_logs document.

    Args:
        status: 'running', 'success', or 'failed'
        start_time: ISO timestamp when scrape started
        end_time: ISO timestamp when scrape completed
        duration_seconds: Total duration in seconds
        movies_found: Number of movies found
        theatres_total: Total theatres scraped
        cities_covered: Number of cities covered
        error: Error message if status is 'failed'

    Returns:
        True if successful
    """
    try:
        db = get_firestore_client()

        # Use Jakarta timezone for document ID
        today_str = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

        morning_run: dict[str, Any] = {"status": status}

        if start_time:
            morning_run["start_time"] = start_time
        if end_time:
            morning_run["end_time"] = end_time
        if duration_seconds is not None:
            morning_run["duration_seconds"] = duration_seconds
        if status in ("success", "failed"):
            morning_run["movies_found"] = movies_found
            morning_run["theatres_total"] = theatres_total
            morning_run["cities_covered"] = cities_covered
        if error:
            morning_run["error"] = error

        db.collection(SCRAPER_LOGS).document(today_str).set(
            {
                "date": today_str,
                "created_at": datetime.now(UTC).isoformat(),
                "morning_run": morning_run,
            },
            merge=True,
        )

        logger.info(f"   Logged morning scrape ({status}) to scraper_logs/{today_str}")
        return True

    except Exception as e:
        logger.error(f"Error logging morning scrape: {e}")
        return False


def log_jit_dispatch(
    time_slot: str,
    showtimes_found: int,
    jobs_published: int,
    window_start: str | None = None,
    window_end: str | None = None,
    status: str = "ok",
    error: str | None = None,
) -> bool:
    """Log JIT dispatcher run to scraper_logs/{date}/dispatches/{HH-MM}.

    Creates the dispatch subcollection doc with metadata. Scrapers will later
    increment total_errors / total_successes on this same doc.

    Args:
        time_slot: Dispatch time in HH:MM format (e.g., "09:05")
        showtimes_found: Number of showtime docs found in window
        jobs_published: Number of Pub/Sub messages sent
        window_start: Target window start time (HH:MM)
        window_end: Target window end time (HH:MM)
        status: 'ok' or 'error'
        error: Error message if status is 'error'

    Returns:
        True if successful
    """
    try:
        db = get_firestore_client()

        # Use Jakarta timezone for document ID
        today_str = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

        # Use HH-MM format for doc ID (colons not allowed in Firestore doc IDs)
        dispatch_slot = time_slot.replace(":", "-")

        dispatch_entry: dict[str, Any] = {
            "dispatched_at": datetime.now(UTC).isoformat(),
            "time_slot": time_slot,
            "showtimes_found": showtimes_found,
            "jobs_published": jobs_published,
            "status": status,
            "total_errors": 0,
            "total_successes": 0,
        }

        if window_start:
            dispatch_entry["window_start"] = window_start
        if window_end:
            dispatch_entry["window_end"] = window_end
        if error:
            dispatch_entry["error"] = error

        # Ensure the parent daily doc exists
        daily_ref = db.collection(SCRAPER_LOGS).document(today_str)
        daily_ref.set(
            {
                "date": today_str,
                "created_at": datetime.now(UTC).isoformat(),
            },
            merge=True,
        )

        # Create the dispatch subcollection doc
        dispatch_ref = daily_ref.collection(DISPATCHES).document(dispatch_slot)
        dispatch_ref.set(dispatch_entry)

        logger.info(
            f"   Logged dispatch ({time_slot}) to scraper_logs/{today_str}/dispatches/{dispatch_slot}"
        )
        return True

    except Exception as e:
        logger.error(f"Error logging JIT dispatch: {e}")
        return False


def log_daily_summary(
    date_str: str,
    total_audience: int,
    total_seats: int,
    occupancy_pct: float,
    showtime_count: int,
    movie_count: int,
    theatre_count: int,
    city_count: int,
) -> bool:
    """Log daily summary to consolidated scraper_logs document.

    Args:
        date_str: Date in YYYY-MM-DD format
        total_audience: Total seats sold
        total_seats: Total seat capacity
        occupancy_pct: Occupancy percentage
        showtime_count: Number of showtimes tracked
        movie_count: Number of unique movies
        theatre_count: Number of unique theatres
        city_count: Number of cities covered

    Returns:
        True if successful
    """
    try:
        db = get_firestore_client()

        daily_summary = {
            "generated_at": datetime.now(UTC).isoformat(),
            "total_audience": total_audience,
            "total_seats": total_seats,
            "occupancy_pct": occupancy_pct,
            "showtime_count": showtime_count,
            "movie_count": movie_count,
            "theatre_count": theatre_count,
            "city_count": city_count,
        }

        db.collection(SCRAPER_LOGS).document(date_str).set(
            {"daily_summary": daily_summary},
            merge=True,
        )

        logger.info(f"   Logged daily summary to scraper_logs/{date_str}")
        return True

    except Exception as e:
        logger.error(f"Error logging daily summary: {e}")
        return False


def save_daily_snapshot(data: dict[str, Any]) -> bool:
    """Save daily movie snapshot to Firestore for web app.

    Saves to both 'latest' (for current access) and dated document (for history).
    """
    try:
        db = get_firestore_client()
        date = data.get("date", datetime.now(UTC).strftime("%Y-%m-%d"))

        # Slim down movies - remove full schedules, keep only counts
        slim_movies = []
        for m in data.get("movies", []):
            schedules = m.get("schedules", {})
            schedule_summary = {city: len(theatres) for city, theatres in schedules.items()}
            slim_movies.append(
                {
                    "id": m.get("id"),
                    "title": m.get("title"),
                    "genres": m.get("genres", []),
                    "poster": m.get("poster"),
                    "age_category": m.get("age_category"),
                    "country": m.get("country"),
                    "merchants": m.get("merchants", []),
                    "is_presale": m.get("is_presale", False),
                    "cities": m.get("cities", []),
                    "theatre_counts": schedule_summary,
                }
            )

        snapshot_data = {
            "scraped_at": data.get("scraped_at"),
            "date": date,
            "summary": data.get("summary", {}),
            "movies": slim_movies,
            "city_stats": data.get("city_stats", {}),
        }

        # Save to 'latest' (overwrites previous)
        db.collection(SNAPSHOTS).document("latest").set(snapshot_data)
        logger.info("   Saved snapshot to 'latest'")

        # Also save to dated document (archive)
        db.collection(SNAPSHOTS).document(date).set(snapshot_data)
        logger.info(f"   Archived snapshot to '{date}'")

        return True
    except Exception as e:
        logger.error(f"Error saving snapshot: {e}")
        return False
