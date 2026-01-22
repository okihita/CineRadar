
from google.cloud import firestore
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    db = firestore.Client()
    date_str = "2026-01-22"
    
    movies_ref = db.collection("movie_performance")
    
    # Only look for a better Cinepolis sample
    found = False
    
    for movie_doc in movies_ref.stream():
        if found: break
        days_ref = movie_doc.reference.collection("days").document(date_str).collection("showtimes")
        
        for st_doc in days_ref.stream():
            data = st_doc.to_dict()
            theatre_name = data.get("theatre_name", "").upper()
            
            if "CINEPOLIS" in theatre_name or "CINÉPOLIS" in theatre_name:
                raw = data.get("raw_api_response", {})
                seat_map = raw.get("data", {}).get("seat_map")
                
                if seat_map and len(seat_map) > 0:
                    filename = "raw_cinepolis_valid.json"
                    with open(filename, "w") as f:
                        json.dump(raw, f, indent=2)
                    logger.info(f"✅ Found valid Cinépolis sample: {filename} ({len(seat_map)} items)")
                    found = True
                    break

if __name__ == "__main__":
    main()
