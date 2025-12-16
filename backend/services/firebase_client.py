"""
Firestore client for CineRadar theatre database.
Manages theatre collection with geocoding data.
"""
from datetime import datetime
from typing import Dict, List, Optional
import os
import json
import tempfile


def get_firestore_client():
    """Get Firestore client with proper credentials.
    
    Supports:
    - FIREBASE_SERVICE_ACCOUNT env var (JSON string) for CI/CD
    - GOOGLE_APPLICATION_CREDENTIALS file path
    - Default application credentials (local dev)
    """
    from google.cloud import firestore
    
    # Check for service account JSON in env (for GitHub Actions)
    service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if service_account_json:
        # Write to temp file for google-cloud-firestore
        creds_data = json.loads(service_account_json)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(creds_data, f)
            temp_path = f.name
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_path
        return firestore.Client(project=creds_data.get('project_id', 'cineradar-481014'))
    
    # Default: use ADC or GOOGLE_APPLICATION_CREDENTIALS
    return firestore.Client(project=os.environ.get('FIREBASE_PROJECT_ID', 'cineradar-481014'))



def upsert_theatre(theatre_data: Dict) -> bool:
    """
    Insert or update a theatre in Firestore.
    
    Args:
        theatre_data: dict with theatre_id, name, merchant, city, address, lat, lng, room_types
    
    Returns:
        True if successful
    """
    try:
        db = get_firestore_client()
        theatre_id = theatre_data.get('theatre_id')
        
        if not theatre_id:
            return False
        
        doc_ref = db.collection('theatres').document(str(theatre_id))
        
        # Check if exists
        doc = doc_ref.get()
        now = datetime.utcnow().isoformat()
        
        if doc.exists:
            # Update existing
            update_data = {
                'name': theatre_data.get('name'),
                'merchant': theatre_data.get('merchant'),
                'city': theatre_data.get('city'),
                'address': theatre_data.get('address'),
                'last_seen': now,
                'updated_at': now,
            }
            
            # Update lat/lng if provided
            if theatre_data.get('lat') is not None:
                update_data['lat'] = theatre_data['lat']
            if theatre_data.get('lng') is not None:
                update_data['lng'] = theatre_data['lng']
            if theatre_data.get('place_id'):
                update_data['place_id'] = theatre_data['place_id']
            
            # Merge room types
            existing_rooms = set(doc.to_dict().get('room_types', []))
            new_rooms = set(theatre_data.get('room_types', []))
            update_data['room_types'] = list(existing_rooms | new_rooms)
            
            doc_ref.update(update_data)
        else:
            # Create new
            doc_ref.set({
                'theatre_id': str(theatre_id),
                'name': theatre_data.get('name'),
                'merchant': theatre_data.get('merchant'),
                'city': theatre_data.get('city'),
                'address': theatre_data.get('address'),
                'lat': theatre_data.get('lat'),
                'lng': theatre_data.get('lng'),
                'place_id': theatre_data.get('place_id'),
                'room_types': theatre_data.get('room_types', []),
                'last_seen': now,
                'created_at': now,
                'updated_at': now,
            })
        
        return True
    except Exception as e:
        print(f"Error upserting theatre {theatre_data.get('theatre_id')}: {e}")
        return False


def get_theatre(theatre_id: str) -> Optional[Dict]:
    """Get a theatre by ID."""
    try:
        db = get_firestore_client()
        doc = db.collection('theatres').document(str(theatre_id)).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Error getting theatre {theatre_id}: {e}")
        return None


def get_all_theatres() -> List[Dict]:
    """Get all theatres."""
    try:
        db = get_firestore_client()
        docs = db.collection('theatres').stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        print(f"Error getting all theatres: {e}")
        return []


def get_theatres_by_city(city: str) -> List[Dict]:
    """Get all theatres in a city."""
    try:
        db = get_firestore_client()
        docs = db.collection('theatres').where('city', '==', city.upper()).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        print(f"Error getting theatres for {city}: {e}")
        return []


def sync_theatres_from_scrape(movies: List[Dict]) -> Dict:
    """
    Sync theatres from scraped movie data to Firestore.
    
    Args:
        movies: List of movie dicts with schedules
        
    Returns:
        Summary dict with counts
    """
    seen_theatres = {}
    
    for movie in movies:
        schedules = movie.get('schedules', {})
        for city, theatres in schedules.items():
            for theatre in theatres:
                theatre_id = theatre.get('theatre_id')
                if not theatre_id:
                    continue
                
                # Collect room types from this movie
                room_types = [r.get('category') for r in theatre.get('rooms', []) if r.get('category')]
                
                if theatre_id in seen_theatres:
                    # Merge room types
                    seen_theatres[theatre_id]['room_types'].extend(room_types)
                else:
                    seen_theatres[theatre_id] = {
                        'theatre_id': theatre_id,
                        'name': theatre.get('theatre_name'),
                        'merchant': theatre.get('merchant'),
                        'city': city,
                        'address': theatre.get('address'),
                        'lat': theatre.get('lat'),
                        'lng': theatre.get('lng'),
                        'room_types': room_types,
                    }
    
    # Dedupe room types and upsert
    success = 0
    failed = 0
    
    for theatre_id, data in seen_theatres.items():
        data['room_types'] = list(set(data['room_types']))
        if upsert_theatre(data):
            success += 1
        else:
            failed += 1
    
    return {
        'total': len(seen_theatres),
        'success': success,
        'failed': failed
    }


def log_scraper_run(run_data: Dict) -> bool:
    """Log a scraper run to Firestore."""
    try:
        db = get_firestore_client()
        db.collection('scraper_runs').add({
            **run_data,
            'timestamp': datetime.utcnow().isoformat()
        })
        return True
    except Exception as e:
        print(f"Error logging scraper run: {e}")
        return False


def save_daily_snapshot(data: Dict) -> bool:
    """Save daily movie snapshot to Firestore for web app."""
    try:
        db = get_firestore_client()
        date = data.get('date', datetime.utcnow().strftime('%Y-%m-%d'))
        
        # Slim down movies - remove full schedules, keep only counts
        slim_movies = []
        for m in data.get('movies', []):
            schedules = m.get('schedules', {})
            schedule_summary = {city: len(theatres) for city, theatres in schedules.items()}
            slim_movies.append({
                'id': m.get('id'),
                'title': m.get('title'),
                'genres': m.get('genres', []),
                'poster': m.get('poster'),
                'age_category': m.get('age_category'),
                'country': m.get('country'),
                'merchants': m.get('merchants', []),
                'is_presale': m.get('is_presale', False),
                'cities': m.get('cities', []),
                'theatre_counts': schedule_summary,
            })
        
        db.collection('snapshots').document('latest').set({
            'scraped_at': data.get('scraped_at'),
            'date': date,
            'summary': data.get('summary', {}),
            'movies': slim_movies,
            'city_stats': data.get('city_stats', {}),
        })
        
        print(f"   Saved snapshot for {date}")
        return True
    except Exception as e:
        print(f"Error saving snapshot: {e}")
        return False
