"""
JIT Seat Scraper - Scraper Function

Pub/Sub-triggered Cloud Function that:
1. Receives showtime data from Pub/Sub message
2. Loads auth token from Firestore
3. Calls TIX.id API to get seat layout
4. Saves compressed snapshot to Firestore

Configure max_instances=5 to limit concurrency and avoid rate limiting.
"""

import base64
import contextlib
import gzip
import json
import logging
import os
from datetime import datetime
from typing import Any, cast
from zoneinfo import ZoneInfo

import functions_framework
import requests
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "cineradar-481014")
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
REFRESH_API_URL = "https://api-b2b.tix.id/v1/users/refresh"
ENABLE_SCHEMA_VALIDATION = os.environ.get("ENABLE_SCHEMA_VALIDATION", "true").lower() == "true"

# Merchant to API path mapping
MERCHANT_PATHS = {
    "CGV": "cgv",
    "XXI": "xxi",
    "Cinépolis": "cinepolis",
    "CINEPOLIS": "cinepolis",
}


def get_merchant_path(merchant: str) -> str:
    """Convert merchant name to API path."""
    return MERCHANT_PATHS.get(merchant, merchant.lower())


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)



def log_error_to_firestore(severity: str, message: str, context: dict[str, Any]) -> None:
    """Log error to Firestore 'scraper_errors' collection."""
    try:
        db = get_firestore_client()
        error_doc = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "severity": severity,
            "message": message,
            "context": context,
            "resolved": False
        }
        # Fire and forget (don't await/block too long)
        db.collection("scraper_errors").add(error_doc)
    except Exception as e:
        # Fallback to stdout if Firestore logging fails
        logger.error(f"Failed to log error to Firestore: {e}")


def log_critical(message: str, context: dict[str, Any]) -> None:
    """Log critical error with context for alerting."""
    logger.critical(f"🚨 CRITICAL: {message} | Context: {context}")
    log_error_to_firestore("CRITICAL", message, context)


def log_warning(message: str, context: dict[str, Any]) -> None:
    """Log warning with context for alerting."""
    logger.warning(f"⚠️ WARNING: {message} | Context: {context}")
    # Optional: We can choose to log specific warnings to Firestore too
    # For now, let's log them to keep track of schema drifts
    log_error_to_firestore("WARNING", message, context)


def log_info(message: str) -> None:
    """Log info message."""
    logger.info(f"i INFO: {message}")


def load_token_data(db: firestore.Client) -> dict[str, Any] | None:
    """Load TIX.id auth token data from Firestore.

    Returns dict with keys: token, refresh_token, stored_at
    Token strings are stripped of surrounding quotes.
    """
    try:
        doc = db.collection("auth_tokens").document("tix_jwt").get()
        if doc.exists:
            data = doc.to_dict()
            if not data:
                return None

            # Sanitize token strings (strip quotes)
            token = data.get("token", "").strip('"')
            refresh_token = data.get("refresh_token", "").strip('"')
            stored_at = data.get("stored_at", "")

            return {"token": token, "refresh_token": refresh_token, "stored_at": stored_at}
    except Exception as e:
        logger.error(f"Failed to load token data: {e}")
    return None


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
                return self.acquire(instance_id)  # Race condition handled

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


def refresh_access_token(db: firestore.Client, refresh_token: str) -> str | None:
    """Refresh access token using the validation API with distributed locking."""
    import time
    import uuid

    instance_id = f"scraper-{uuid.uuid4().hex[:8]}"
    lock = TokenRefreshLock(db)

    # Try to acquire lock with retry
    # If another instance is refreshing, we wait for it to finish instead of failing
    max_retries = 10
    for i in range(max_retries):
        if lock.acquire(instance_id):
            break

        logger.info(f"Another instance is refreshing, waiting... ({i+1}/{max_retries})")
        time.sleep(1.0) # Wait 1s between checks
        # Check if the other instance finished successfully
        token_data = load_token_data(db)
        if token_data and token_data.get("token"):
            # If the token was updated very recently (e.g. within last 30s), use it
            # This handles the case where the lock holder finished and released
            # For simplicity, just return the token if valid
            return str(token_data["token"])

    # If we still don't have the lock after retries, try one last check
    if not lock.acquire(instance_id):
         # Just return whatever is there, hoping it was refreshed
        token_data = load_token_data(db)
        if token_data and token_data.get("token"):
             logger.warning("Could not acquire lock, using existing token")
             return str(token_data["token"])
        return None

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
                return cast("str", new_token)
            else:
                logger.error("❌ Refresh response missing token")
        else:
            logger.error(f"❌ Refresh failed: {response.status_code} {response.text[:100]}")

    except requests.RequestException as e:
        logger.error(f"❌ Refresh request exception: {e}")
    finally:
        lock.release()

    return None


def get_valid_token(db: firestore.Client, force_refresh: bool = False) -> str | None:
    """Get a valid token, refreshing if necessary."""
    token_data = load_token_data(db)
    if not token_data or not token_data.get("token"):
        return None

    current_token = token_data["token"]
    refresh_token = token_data.get("refresh_token")
    stored_at_str = token_data.get("stored_at")

    should_refresh = force_refresh

    if not should_refresh and stored_at_str:
        try:
            # Handle potentially naive or aware inputs
            stored_at = datetime.fromisoformat(stored_at_str)
            if stored_at.tzinfo is None:
                # distinct lack of timezone info in stored string
                # assume local/server time matches
                age = datetime.now() - stored_at
            else:
                # stored time has timezone -> use timezone aware now
                age = datetime.now(stored_at.tzinfo) - stored_at

            age_minutes = age.total_seconds() / 60

            # Dispatcher refreshes at 20 mins. We only force refresh at 25 mins (emergency).
            # Reduced from 28 to 25 to allow more buffer before expiration.
            if age_minutes >= 25:
                logger.info(f"⚠️ Token is {age_minutes:.1f} min old. Refreshing (emergency fallback)...")
                should_refresh = True
            else:
                logger.info(f"Token is {age_minutes:.1f} min old (valid).")

        except ValueError:
            logger.warning("Could not parse stored_at time, forcing refresh check if possible")
            should_refresh = True
    elif not stored_at_str:
        should_refresh = True

    if should_refresh and refresh_token:
        new_token = refresh_access_token(db, refresh_token)
        if new_token:
            return new_token
        # If refresh fails, fall back to current token (better than nothing)
        logger.warning("Refresh failed, using existing token as fallback")

    return cast("str", current_token)


def fetch_seat_layout(showtime_id: str, merchant: str, token: str) -> dict[str, Any] | None:
    """Fetch seat layout from TIX.id API.

    Args:
        showtime_id: TIX.id showtime identifier
        merchant: Cinema chain (CGV, XXI, Cinépolis)
        token: JWT auth token

    Returns:
        Seat layout dict or None if failed
    """
    merchant_path = get_merchant_path(merchant)
    url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    }

    params = {
        "show_time_id": showtime_id,
        "tz": "7",  # UTC+7 offset
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return cast("dict[str, Any]", data)
            else:
                logger.error(f"API error: {data.get('error', {}).get('message', 'Unknown')}")
                return None
        elif response.status_code == 401:
            logger.warning("Auth token expired (401)")
            return None # Caller should handle retry
        else:
            body = response.text[:200] if response.text else "No body"
            logger.error(f"API error {response.status_code}: {body}")
            return None

    except requests.RequestException as e:
        logger.error(f"Request failed: {e}")
        return None

def fetch_seat_layout_with_retry(
    showtime_id: str, merchant: str, token: str, db: firestore.Client
) -> dict[str, Any] | None:
    """Fetch seat layout with 401 retry logic."""
    import time

    # First attempt
    result = fetch_seat_layout(showtime_id, merchant, token)
    if result:
        return result

    # Check if we should retry (did we get a 401?)
    # NOTE: fetch_seat_layout returns None on error, so we can't distinguish 401 easily
    # unless we modify it or infer. To keep it clean, let's modify fetch_seat_layout to return a status code or exception?
    # Or simply: if result is None, check token validity?

    # Actually, simpler to inline the logic or modify fetch_seat_layout to raise exception on 401.
    # But since we want to preserve existing signature for compatibility...

    # Let's re-implement the retry loop here using explicit requests to be safe and cleaner
    merchant_path = get_merchant_path(merchant)
    url = f"https://api-b2b.tix.id/v1/movies/{merchant_path}/layout"

    current_token = token

    for attempt in range(2):
        headers = {
            "Authorization": f"Bearer {current_token}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        }
        params = {"show_time_id": showtime_id, "tz": "7"}

        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return cast("dict[str, Any]", data)
                else:
                    logger.error(f"API error: {data.get('error', {}).get('message', 'Unknown')}")
                    return None

            elif response.status_code == 401:
                if attempt == 0:
                    logger.warning("Token 401 expired. Refreshing and retrying...")
                    new_token = get_valid_token(db, force_refresh=True)
                    if new_token:
                        current_token = new_token
                        time.sleep(0.5)
                        continue # Retry with new token
                    else:
                        logger.error("Failed to refresh token after 401.")
                        return None
                else:
                    logger.error("Still 401 after refresh.")
                    return None
            else:
                body = response.text[:200] if response.text else "No body"
                logger.error(f"API error {response.status_code}: {body}")
                return None

        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")
            if attempt == 0:
                time.sleep(1)
                continue
            return None

    return None


def validate_api_response(raw_response: dict[str, Any]) -> tuple[bool, str, str]:
    """
    Validate raw API response structure and detect schema changes.

    Returns:
        (is_valid, severity, error_message)

    Severity levels:
    - CRITICAL: Schema change that will break all scrapes
    - WARNING: Potential issue but might recover
    - INFO: Minor anomaly
    """
    if not isinstance(raw_response, dict):
        return False, "CRITICAL", "API response is not a dict"

    if not raw_response.get("success"):
        error = raw_response.get("error", {}).get("message", "Unknown")
        return False, "CRITICAL", f"API success=false: {error}"

    data = raw_response.get("data", {})
    seat_map = data.get("seat_map")

    if not isinstance(seat_map, list):
        return False, "CRITICAL", "seat_map is not a list - schema changed!"

    if not seat_map:
        return False, "WARNING", "Empty seat_map returned by API"

    # Check seat types detection
    seat_types = set()
    for item in seat_map:
        if "seat_rows" in item:
            for seat in item.get("seat_rows", []):
                if "seat_type" in seat:
                    seat_types.add(seat["seat_type"])

    if seat_types:
        log_info(f"Detected seat types: {', '.join(sorted(seat_types))}")

    return True, "INFO", "Schema validation passed"


def calculate_occupancy(
    seat_map: list[dict[str, Any]],
) -> tuple[int, int, float, list[Any]]:
    """Calculate occupancy from seat map.

    Status codes:
    - 1: Available (can purchase)
    - 5, 6: Unavailable (sold or blocked)

    Returns:
        Tuple of (total_seats, sold_seats, occupancy_pct, layout_grid)
    """
    total_seats = 0
    sold_seats = 0
    layout_grid = []

    for item in seat_map:
        if "seat_rows" in item:
            # Nested structure (XXI/CGV)
            row_name = item.get("row_name", "")
            row_statuses = []
            for seat in item.get("seat_rows", []):
                status = seat.get("status", 0)
                if status == 1:  # Available
                    total_seats += 1
                    row_statuses.append(1)
                elif status in (5, 6):  # Sold/blocked
                    total_seats += 1
                    sold_seats += 1
                    row_statuses.append(0)
            if row_statuses:
                layout_grid.append([row_name, row_statuses])
        else:
            # Flat structure (Cinépolis/CGV B2B)
            row_name = item.get("row_name", "ALL")
            status = item.get("seat_status", item.get("status", 0))
            seat_yn = item.get("seat_yn", "1")

            if seat_yn == "0":  # Aisle, skip
                continue

            seat_status_val = -1
            if seat_yn == "1" and status == 0:  # Sold
                total_seats += 1
                sold_seats += 1
                seat_status_val = 0
            elif status == 1:  # Available
                total_seats += 1
                seat_status_val = 1
            elif status in (5, 6):  # Sold/blocked
                total_seats += 1
                sold_seats += 1
                seat_status_val = 0

            if seat_status_val != -1:
                # Add to layout grid
                # Check if we need to start a new row
                if not layout_grid or layout_grid[-1][0] != row_name:
                    layout_grid.append([row_name, []])
                layout_grid[-1][1].append(seat_status_val)

    occupancy_pct = (sold_seats / total_seats * 100) if total_seats > 0 else 0.0
    return total_seats, sold_seats, round(occupancy_pct, 1), layout_grid


def save_snapshot(
    db: firestore.Client,
    showtime_data: dict[str, Any],
    layout: list[dict[str, Any]],
    total_seats: int,
    sold_seats: int,
    occupancy_pct: float,
    raw_api_response: dict[str, Any] | None = None,
) -> bool:
    """Save showtime snapshot to Firestore with compressed layout and raw API response.

    Path: movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}
    """
    movie_id = showtime_data["movie_id"]
    date = showtime_data["date"]
    showtime_id = showtime_data["showtime_id"]

    # Compress layout
    layout_json_str = json.dumps(layout)
    layout_compressed = gzip.compress(layout_json_str.encode("utf-8"))

    snapshot_data = {
        "showtime_id": showtime_id,
        "movie_id": movie_id,
        "movie_title": showtime_data.get("movie_title", ""),
        "theatre_id": showtime_data.get("theatre_id", ""),
        "theatre_name": showtime_data.get("theatre_name", ""),
        "city": showtime_data.get("city", ""),
        "room_category": showtime_data.get("room_category", ""),
        "merchant": showtime_data.get("merchant", ""),
        "showtime": showtime_data.get("showtime", ""),
        "date": date,
        "total_seats": total_seats,
        "sold_seats": sold_seats,
        "occupancy_pct": occupancy_pct,
        "layout_compressed": layout_compressed,
        "raw_api_response": raw_api_response,
        "scraped_at": datetime.now(JAKARTA_TZ).isoformat(),
    }

    try:
        doc_ref = (
            db.collection("movie_performance")
            .document(movie_id)
            .collection("days")
            .document(date)
            .collection("showtimes")
            .document(showtime_id)
        )
        doc_ref.set(snapshot_data)
        logger.info(f"Saved snapshot for {showtime_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to save snapshot: {e}")
        return False


@functions_framework.cloud_event  # type: ignore[untyped-decorator]
def scrape_seat(cloud_event: Any) -> None:
    """Pub/Sub Cloud Function entry point.

    Triggered by messages on scrape-seat-jit topic.
    Scrapes one showtime and saves to Firestore.
    """
    import time
    start_time = time.time()
    # Decode Pub/Sub message
    message_data = base64.b64decode(cloud_event.data["message"]["data"])
    showtime_data = json.loads(message_data)

    showtime_id = showtime_data.get("showtime_id")
    theatre_name = showtime_data.get("theatre_name", "")[:30]
    showtime_time = showtime_data.get("showtime", "")

    logger.info(f"Scraping {theatre_name} @ {showtime_time}")

    db = get_firestore_client()

    # Load token (with auto-refresh)
    token = get_valid_token(db)
    if not token:
        log_critical(
            "No valid token available - authentication failure",
            {
                "showtime_id": showtime_id,
                "theatre": theatre_name,
                "time": showtime_time,
            },
        )
        return  # Pub/Sub will retry

    # Fetch seat layout - need merchant for API path
    merchant = showtime_data.get("merchant", "XXI")
    raw_api_response = fetch_seat_layout_with_retry(showtime_id, merchant, token, db)

    if not raw_api_response:
        log_critical(
            "Failed to fetch seat layout from TIX.id API",
            {
                "showtime_id": showtime_id,
                "theatre": theatre_name,
                "time": showtime_time,
                "merchant": merchant,
                "error_type": "fetch_layout_failed",
            },
        )
        return  # Pub/Sub will retry

    # Validate schema if enabled
    if ENABLE_SCHEMA_VALIDATION:
        is_valid, severity, validation_msg = validate_api_response(raw_api_response)

        if not is_valid:
            if severity == "CRITICAL":
                log_critical(
                    f"Schema validation failed: {validation_msg}",
                    {
                        "showtime_id": showtime_id,
                        "theatre": theatre_name,
                        "severity": "CRITICAL",
                        "impact": "all_scrapes_affected",
                    },
                )
                # Store anyway for debugging
            else:
                log_warning(
                    f"Schema validation issue: {validation_msg}",
                    {"showtime_id": showtime_id, "theatre": theatre_name, "severity": severity},
                )
        else:
            log_info(f"Schema validation passed for {showtime_id}")

    # Extract seat map from response
    data = raw_api_response.get("data", {})
    seat_map = data.get("seat_map", [])

    # Calculate occupancy
    total_seats, sold_seats, occupancy_pct, layout = calculate_occupancy(seat_map)

    # Save to Firestore with raw API response
    save_snapshot(
        db, showtime_data, layout, total_seats, sold_seats, occupancy_pct, raw_api_response
    )

    logger.info(
        f"✓ {theatre_name} @ {showtime_time}: {occupancy_pct}% ({sold_seats}/{total_seats})"
    )

    # Log metrics to jit_stats if batch_id is present
    batch_id = showtime_data.get("batch_id")
    if batch_id:
        try:
            end_time = time.time()
            duration_ms = int((end_time - start_time) * 1000)

            # Lightweight stat doc
            stat_doc = {
                "batch_id": batch_id,
                "showtime_id": showtime_id,
                "duration_ms": duration_ms,
                "finished_at": datetime.utcnow().isoformat() + "Z",
                "status": "success",
                "occupancy_pct": occupancy_pct
            }

            # Fire and forget
            db.collection("jit_stats").add(stat_doc)
        except Exception as e:
            logger.warning(f"Failed to log jit_stats: {e}")
