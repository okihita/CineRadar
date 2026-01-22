
from google.cloud import firestore
import json
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    db = firestore.Client()
    date_str = "2026-01-22"
    
    logger.info(f"Scanning movie_performance for {date_str}...")
    
    movies_ref = db.collection("movie_performance")
    found_targets = {"XXI": False, "CGV": False, "Cinépolis": False}
    
    for movie_doc in movies_ref.stream():
        if all(found_targets.values()):
            break
            
        days_ref = movie_doc.reference.collection("days").document(date_str).collection("showtimes")
        
        for st_doc in days_ref.stream():
            data = st_doc.to_dict()
            raw = data.get("raw_api_response")
            
            if not raw:
                continue
                
            theatre_name = data.get("theatre_name", "").upper()
            merchant = None
            
            if "XXI" in theatre_name:
                merchant = "XXI"
            elif "CGV" in theatre_name:
                merchant = "CGV"
            elif "CINEPOLIS" in theatre_name or "CINÉPOLIS" in theatre_name:
                merchant = "Cinépolis"
            
            if merchant and not found_targets[merchant]:
                filename = f"raw_{merchant.lower().replace('é', 'e')}.json"
                with open(filename, "w") as f:
                    json.dump(raw, f, indent=2)
                
                line_count = len(json.dumps(raw, indent=2).splitlines())
                logger.info(f"✅ Extracted {merchant} sample to {filename} ({line_count} lines)")
                found_targets[merchant] = True
                
            if all(found_targets.values()):
                break

    if not all(found_targets.values()):
        logger.warning(f"Could not find samples for: {[k for k, v in found_targets.items() if not v]}")

if __name__ == "__main__":
    main()
