#!/usr/bin/env python3
"""
Generate mock admission data for CineRadar.
Populates `daily_admissions` collection in Firestore with realistic-looking mock data.
"""
import argparse
import random
from datetime import datetime, timedelta
from backend.infrastructure._legacy.firebase_client import get_firestore_client

def get_latest_snapshot():
    """Fetch latest snapshot directly from Firestore."""
    db = get_firestore_client()
    if not db:
        return None
    try:
        doc = db.collection('snapshots').document('latest').get()
        return doc.to_dict() if doc.exists else None
    except Exception as e:
        print(f"Error fetching snapshot: {e}")
        return None

def generate_mock_admissions(days: int = 7):
    """Generate mock admission data for the last N days."""
    db = get_firestore_client()
    if not db:
        print("❌ Firestore not available")
        return

    # Get active movies from latest snapshot
    snapshot = get_latest_snapshot()
    if not snapshot or 'movies' not in snapshot:
        print("❌ No movie snapshot found")
        return

    movies = snapshot['movies']
    print(f"🎬 Generating mock data for {len(movies)} movies over {days} days...")

    start_date = datetime.now() - timedelta(days=days)
    
    total_written = 0
    batch = db.batch()
    batch_count = 0

    for i in range(days + 1):
        current_date = start_date + timedelta(days=i)
        date_str = current_date.strftime('%Y-%m-%d')
        is_weekend = current_date.weekday() >= 5  # Sat, Sun

        print(f"   📅 Processing {date_str}...")

        collection_ref = db.collection('daily_admissions').document(date_str).collection('movies')

        for movie in movies:
            movie_id = movie.get('id')
            movie_title = movie.get('title')
            
            # Base popularity (random but consistent per movie)
            popularity_seed = hash(movie_id) % 100
            base_occupancy = 0.3 + (popularity_seed / 200)  # 0.3 - 0.8 base
            
            if is_weekend:
                base_occupancy *= 1.5  # Higher on weekends
            
            # Generate mock showtimes
            mock_showtimes = []
            daily_total = 0
            
            # Create 10-20 mock showtimes per day per movie
            num_showtimes = random.randint(10, 20)
            
            cities = ['JAKARTA', 'SURABAYA', 'BANDUNG', 'MEDAN', 'AMBON']
            
            for _ in range(num_showtimes):
                city = random.choice(cities)
                hour = random.randint(10, 22)
                minute = random.choice([0, 15, 30, 45])
                time = f"{hour:02d}:{minute:02d}"
                
                capacity = random.choice([150, 180, 220, 300])
                
                # Random occupancy with some noise
                occupancy = min(0.98, max(0.05, random.normalvariate(base_occupancy, 0.15)))
                admissions = int(capacity * occupancy)
                
                daily_total += admissions
                
                mock_showtimes.append({
                    'time': time,
                    'city': city,
                    'theatre': f"{city} XXI",
                    'capacity': capacity,
                    'admissions': admissions,
                    'occupancy_pct': round(occupancy * 100, 1)
                })

            # Prepare document
            doc_data = {
                'movie_id': movie_id,
                'movie_title': movie_title,
                'date': date_str,
                'total_admissions': daily_total,
                'showtimes': mock_showtimes,
                'updated_at': datetime.now().isoformat()
            }

            doc_ref = collection_ref.document(movie_id)
            batch.set(doc_ref, doc_data)
            batch_count += 1
            total_written += 1

            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                print(f"      Saved batch...")

    if batch_count > 0:
        batch.commit()

    print(f"✅ Successfully wrote {total_written} admission records")

if __name__ == "__main__":
    generate_mock_admissions()
