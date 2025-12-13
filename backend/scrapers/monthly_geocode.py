#!/usr/bin/env python3
"""
Geocode theatres using Google Places API (New) for exact building locations.
Returns place_id for accurate Google Maps links.
"""
import json
import time
import os
import requests
from pathlib import Path
from typing import Dict, Optional

# Configuration
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY environment variable not set")
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
CACHE_FILE = Path(__file__).parent.parent.parent / "data" / "places_cache.json"


def load_cache() -> Dict:
    """Load cached place data."""
    if CACHE_FILE.exists():
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache: Dict):
    """Save cache to file."""
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


def search_place(theatre_name: str, city: str) -> Optional[Dict]:
    """
    Search for a theatre using Google Places API (New) Text Search.
    Returns place_id, lat, lng, and name.
    """
    # Build search query
    query = f"{theatre_name} cinema {city} Indonesia"
    
    try:
        response = requests.post(
            PLACES_SEARCH_URL,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location"
            },
            json={"textQuery": query},
            timeout=15
        )
        
        data = response.json()
        
        if "places" in data and len(data["places"]) > 0:
            place = data["places"][0]
            location = place.get("location", {})
            display_name = place.get("displayName", {})
            
            return {
                "place_id": place.get("id"),
                "lat": location.get("latitude"),
                "lng": location.get("longitude"),
                "formatted_address": place.get("formattedAddress"),
                "name": display_name.get("text"),
                "query_used": query
            }
    except Exception as e:
        print(f"    Error: {str(e)[:80]}")
    
    return None


def geocode_theatre(theatre_name: str, city: str, cache: Dict) -> Optional[Dict]:
    """Geocode a theatre, using cache if available."""
    cache_key = f"{theatre_name}|{city}"
    
    if cache_key in cache:
        return cache[cache_key]
    
    result = search_place(theatre_name, city)
    
    if result:
        cache[cache_key] = result
    
    return result


def main():
    # Find the latest movie file
    data_dir = Path(__file__).parent.parent.parent / "data"
    movie_files = sorted(data_dir.glob("movies_*.json"), reverse=True)
    
    if not movie_files:
        print("❌ No movie data files found in data/")
        return
    
    input_file = movie_files[0]
    print(f"\n📍 CineRadar Theatre Geocoder (Google Places API New)")
    print("=" * 60)
    print(f"Input: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    movies = data.get('movies', [])
    print(f"Movies: {len(movies)}")
    
    # Load cache
    cache = load_cache()
    print(f"Cache: {len(cache)} entries loaded")
    
    # Collect unique theatres
    theatres = {}
    for movie in movies:
        schedules = movie.get('schedules', {})
        for city, city_theatres in schedules.items():
            for theatre in city_theatres:
                theatre_id = theatre.get('theatre_id')
                if theatre_id and theatre_id not in theatres:
                    theatres[theatre_id] = {
                        'name': theatre.get('theatre_name'),
                        'city': city,
                        'theatre_ref': theatre
                    }
    
    print(f"Unique theatres: {len(theatres)}")
    
    # Count how many need geocoding
    need_geocoding = sum(1 for t in theatres.values() 
                         if f"{t['name']}|{t['city']}" not in cache)
    from_cache = len(theatres) - need_geocoding
    
    print(f"From cache: {from_cache}")
    print(f"Need geocoding: {need_geocoding}")
    
    if need_geocoding > 0:
        print(f"\n⏱️ Estimated time: ~{need_geocoding * 0.3:.0f} seconds")
        print("Starting geocoding...\n")
    
    # Geocode theatres
    success = 0
    failed = 0
    processed = 0
    
    for theatre_id, t in theatres.items():
        cache_key = f"{t['name']}|{t['city']}"
        
        if cache_key not in cache:
            result = geocode_theatre(t['name'], t['city'], cache)
            processed += 1
            
            if result:
                success += 1
            else:
                failed += 1
                print(f"    ❌ Failed: {t['name']} in {t['city']}")
            
            # Rate limiting
            time.sleep(0.2)
            
            # Progress update
            if processed % 20 == 0:
                print(f"   [{processed}/{need_geocoding}] ✓{success} ✗{failed}")
                save_cache(cache)  # Save periodically
        
        # Apply geocode data to theatre
        if cache_key in cache:
            place_data = cache[cache_key]
            t['theatre_ref']['lat'] = place_data.get('lat')
            t['theatre_ref']['lng'] = place_data.get('lng')
            t['theatre_ref']['place_id'] = place_data.get('place_id')
    
    # Final progress
    if need_geocoding > 0:
        print(f"   [{processed}/{need_geocoding}] ✓{success} ✗{failed}")
    
    # Save cache
    save_cache(cache)
    print(f"\n📊 Results: {success} geocoded, {failed} failed")
    print(f"💾 Cache saved: {len(cache)} entries")
    
    # Save updated data
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"💾 Data saved: {input_file}")
    
    # Count theatres with place_id
    with_place_id = sum(1 for t in theatres.values() 
                        if t['theatre_ref'].get('place_id'))
    without_place_id = len(theatres) - with_place_id
    
    print(f"\n✅ Done! {with_place_id} theatres with place_id, {without_place_id} without")


if __name__ == "__main__":
    main()
