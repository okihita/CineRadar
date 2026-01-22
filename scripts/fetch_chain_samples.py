import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any

from google.cloud import firestore
from backend.infrastructure.core.seat_scraper import SeatScraper

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    db = firestore.Client()
    date_str = "2026-01-22"
    
    logger.info(f"Listing movies in schedules/{date_str}/movies to find candidates...")
    
    movies_ref = db.collection("schedules").document(date_str).collection("movies")
    movies_stream = movies_ref.limit(20).stream()
    
    candidates = []
    for m in movies_stream:
        candidates.append(m.id)
        
    logger.info(f"Found candidate movies: {candidates}")
    
    targets = {"XXI": None, "CGV": None, "Cinépolis": None}
    
    # Iterate through candidates until we find all targets
    for movie_id in candidates:
        if all(targets.values()):
            break
            
        logger.info(f"Checking movie {movie_id}...")
        doc = movies_ref.document(movie_id).get()
        data = doc.to_dict()
        schedules = data.get("schedules", {})
        
        for city, theatres in schedules.items():
            for theatre in theatres:
                merchant = theatre.get("merchant")
                key = None
                if "XXI" in merchant.upper():
                    key = "XXI"
                elif "CGV" in merchant.upper():
                    key = "CGV"
                elif "CINEPOLIS" in merchant.upper() or "CINÉPOLIS" in merchant.upper():
                    key = "Cinépolis"
                
                if key and targets[key] is None:
                    rooms = theatre.get("rooms", [])
                    for room in rooms:
                        all_showtimes = room.get("all_showtimes", [])
                        if all_showtimes:
                            st = all_showtimes[0]
                            # Check if it has a showtime_id (some legacy might not)
                            st_id = st.get("showtime_id")
                            if st_id:
                                targets[key] = {
                                    "showtime_id": st_id,
                                    "merchant": merchant,
                                    "theatre": theatre.get("theatre_name"),
                                    "movie_id": movie_id
                                }
                                logger.info(f"  -> Found {key}: {targets[key]['theatre']}")
                                break
                    if targets[key]:
                        break
    
    logger.info(f"Final targets: {json.dumps(targets, indent=2)}")
    
    # Initialize scraper
    scraper = SeatScraper()
    if not scraper.load_token_from_storage():
        logger.error("Failed to load token!")
        return

    # Fetch and save
    for key, info in targets.items():
        if not info:
            logger.warning(f"No showtime found for {key}")
            continue
            
        logger.info(f"Fetching layout for {key} ({info['theatre']})...")
        layout = await scraper._fetch_seat_layout_api(info['showtime_id'], info['merchant'])
        
        if layout:
            filename = f"raw_{key.lower().replace('é', 'e')}.json"
            with open(filename, "w") as f:
                json.dump(layout, f, indent=2)
            
            line_count = len(json.dumps(layout, indent=2).splitlines())
            logger.info(f"✅ Saved {filename}: {line_count} lines")
        else:
            logger.error(f"❌ Failed to fetch {key}")

if __name__ == "__main__":
    asyncio.run(main())