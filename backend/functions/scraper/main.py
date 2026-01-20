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
import gzip
import json
import logging
import os
from datetime import datetime
from typing import Any
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


def load_token_data(db: firestore.Client) -> dict | None:
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


def refresh_access_token(db: firestore.Client, refresh_token: str) -> str | None:
    """Refresh access token using the validation API."""
    logger.info("🔄 Attempting inline token refresh...")

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
                        "updated_by": "scraper-cloud-function",
                    },
                    merge=True,
                )

                logger.info("✅ Inline refresh successful & saved to Firestore")
                return new_token
            else:
                logger.error("❌ Refresh response missing token")
        else:
            logger.error(f"❌ Refresh failed: {response.status_code} {response.text[:100]}")

    except requests.RequestException as e:
        logger.error(f"❌ Refresh request exception: {e}")

    return None


def get_valid_token(db: firestore.Client) -> str | None:
    """Get a valid token, refreshing if necessary."""
    token_data = load_token_data(db)
    if not token_data or not token_data.get("token"):
        return None

    current_token = token_data["token"]
    refresh_token = token_data.get("refresh_token")
    stored_at_str = token_data.get("stored_at")

    # Check expiry
    # TIX.id tokens last 30 mins. We refresh if age > 25 mins (5 min buffer).
    should_refresh = False

    if stored_at_str:
        try:
            # Handle potentially naive or aware inputs
            stored_at = datetime.fromisoformat(stored_at_str)
            if stored_at.tzinfo is None:
                # distinct lack of timezone info in stored string -> assume local/server time matches
                age = datetime.now() - stored_at
            else:
                # stored time has timezone -> use timezone aware now
                age = datetime.now(stored_at.tzinfo) - stored_at

            age_minutes = age.total_seconds() / 60

            if age_minutes >= 25:
                logger.info(f"⚠️ Token is {age_minutes:.1f} min old. Refreshing...")
                should_refresh = True
            else:
                logger.info(f"Token is {age_minutes:.1f} min old (valid).")

        except ValueError:
            logger.warning("Could not parse stored_at time, forcing refresh check if possible")
            should_refresh = True
    else:
        should_refresh = True

    if should_refresh and refresh_token:
        new_token = refresh_access_token(db, refresh_token)
        if new_token:
            return new_token
        # If refresh fails, fall back to current token (better than nothing)
        logger.warning("Refresh failed, using existing token as fallback")

    return current_token


def fetch_seat_layout(showtime_id: str, merchant: str, token: str) -> dict | None:
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
                return data
            else:
                logger.error(f"API error: {data.get('error', {}).get('message', 'Unknown')}")
                return None
        elif response.status_code == 401:
            logger.error("Auth token expired")
            return None
        else:
            body = response.text[:200] if response.text else "No body"
            logger.error(f"API error {response.status_code}: {body}")
            return None

    except requests.RequestException as e:
        logger.error(f"Request failed: {e}")
        return None


def calculate_occupancy(seat_map: list) -> tuple[int, int, float, list]:
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
    showtime_data: dict,
    layout: list,
    total_seats: int,
    sold_seats: int,
    occupancy_pct: float,
) -> bool:
    """Save showtime snapshot to Firestore with compressed layout.

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
        logger.error("No valid token available")
        return  # Pub/Sub will retry

    # Fetch seat layout - need merchant for API path
    merchant = showtime_data.get("merchant", "XXI")
    layout_data = fetch_seat_layout(showtime_id, merchant, token)
    if not layout_data:
        logger.error("Failed to fetch seat layout")
        return  # Pub/Sub will retry

    # Extract seat map from response
    data = layout_data.get("data", {})
    seat_map = data.get("seat_map", [])

    # Calculate occupancy
    total_seats, sold_seats, occupancy_pct, layout = calculate_occupancy(seat_map)

    # Save to Firestore
    save_snapshot(db, showtime_data, layout, total_seats, sold_seats, occupancy_pct)

    logger.info(
        f"✓ {theatre_name} @ {showtime_time}: {occupancy_pct}% ({sold_seats}/{total_seats})"
    )
