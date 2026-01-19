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
TIX_API_URL = "https://api-b2b.tix.id/v1/showtimes/{showtime_id}/seatmap"


def get_firestore_client() -> firestore.Client:
    """Get Firestore client."""
    return firestore.Client(project=PROJECT_ID)


def load_token(db: firestore.Client) -> str | None:
    """Load TIX.id auth token from Firestore."""
    try:
        doc = db.collection("tokens").document("current").get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("token")
    except Exception as e:
        logger.error(f"Failed to load token: {e}")
    return None


def fetch_seat_layout(showtime_id: str, token: str) -> dict | None:
    """Fetch seat layout from TIX.id API.
    
    Args:
        showtime_id: TIX.id showtime identifier
        token: JWT auth token
    
    Returns:
        Seat layout dict or None if failed
    """
    url = TIX_API_URL.format(showtime_id=showtime_id)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "platform": "web",
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {})
        elif response.status_code == 401:
            logger.error("Auth token expired")
            return None
        else:
            logger.error(f"API error: {response.status_code}")
            return None
            
    except requests.RequestException as e:
        logger.error(f"Request failed: {e}")
        return None


def calculate_occupancy(layout: list) -> tuple[int, int, float]:
    """Calculate occupancy from seat layout.
    
    Returns:
        Tuple of (total_seats, sold_seats, occupancy_pct)
    """
    total_seats = 0
    sold_seats = 0
    
    for row in layout:
        for seat in row:
            if isinstance(seat, dict) and seat.get("type") == "seat":
                total_seats += 1
                # Status 2 = sold, Status 1 = available
                if seat.get("status") == 2:
                    sold_seats += 1
    
    occupancy_pct = (sold_seats / total_seats * 100) if total_seats > 0 else 0.0
    return total_seats, sold_seats, round(occupancy_pct, 1)


def save_snapshot(db: firestore.Client, showtime_data: dict, layout: list, 
                  total_seats: int, sold_seats: int, occupancy_pct: float) -> bool:
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


@functions_framework.cloud_event
def scrape_seat(cloud_event):
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
    
    # Load token
    token = load_token(db)
    if not token:
        logger.error("No valid token available")
        return  # Pub/Sub will retry
    
    # Fetch seat layout
    layout_data = fetch_seat_layout(showtime_id, token)
    if not layout_data:
        logger.error("Failed to fetch seat layout")
        return  # Pub/Sub will retry
    
    # Extract layout rows
    layout = layout_data.get("seatLayout", [])
    
    # Calculate occupancy
    total_seats, sold_seats, occupancy_pct = calculate_occupancy(layout)
    
    # Save to Firestore
    save_snapshot(db, showtime_data, layout, total_seats, sold_seats, occupancy_pct)
    
    logger.info(f"✓ {theatre_name} @ {showtime_time}: {occupancy_pct}% ({sold_seats}/{total_seats})")
