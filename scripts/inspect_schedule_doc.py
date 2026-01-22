from google.cloud import firestore
import json
import logging

def main():
    db = firestore.Client()
    date_str = "2026-01-22"
    movie_id = "2003773176210866176"
    
    print(f"Inspecting schedules/{date_str}/movies/{movie_id}")
    doc_ref = db.collection("schedules").document(date_str).collection("movies").document(movie_id)
    doc = doc_ref.get()
    
    if doc.exists:
        data = doc.to_dict()
        # Print keys to verify structure
        print(f"Keys: {list(data.keys())}")
        schedules = data.get("schedules", {})
        print(f"Cities: {list(schedules.keys())}")
        
        # Print first theatre in first city
        if schedules:
            first_city = list(schedules.keys())[0]
            theatres = schedules[first_city]
            if theatres:
                print(json.dumps(theatres[0], default=str, indent=2))
    else:
        print("Doc not found")

if __name__ == "__main__":
    main()