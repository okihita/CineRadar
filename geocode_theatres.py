#!/usr/bin/env python3
"""
CineRadar Theatre Geocoder using Google Maps API.
Adds lat/lng coordinates to theatre data in existing JSON files.
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import aiohttp

# Google Maps API Key
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', 'REDACTED_API_KEY')

# Rate limit for Google: 50 QPS allowed, but we'll be conservative
RATE_LIMIT_SECONDS = 0.1

# Cache file
CACHE_FILE = Path(__file__).parent / "data" / "geocode_cache.json"


async def geocode_address(address: str, city: str, session: aiohttp.ClientSession, cache: dict) -> dict | None:
    """Geocode an address using Google Maps Geocoding API."""
    cache_key = f"{address}|{city}"
    
    # Check cache first
    if cache_key in cache:
        return cache[cache_key]
    
    search_query = f"{address}, {city}, Indonesia"
    
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": search_query,
            "key": GOOGLE_MAPS_API_KEY,
            "region": "id"
        }
        
        async with session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                if data.get('status') == 'OK' and data.get('results'):
                    location = data['results'][0]['geometry']['location']
                    result = {
                        "lat": location['lat'],
                        "lng": location['lng']
                    }
                    cache[cache_key] = result
                    return result
                elif data.get('status') == 'ZERO_RESULTS':
                    return None
                else:
                    print(f"   API Error: {data.get('status')} - {data.get('error_message', '')}")
        return None
    except Exception as e:
        print(f"   Error geocoding: {e}")
        return None


async def geocode_movie_data(input_file: Path):
    """Geocode all theatre addresses in a movie data file."""
    print(f"\n📍 CineRadar Theatre Geocoder (Google Maps)")
    print(f"=" * 50)
    print(f"Input: {input_file}")
    
    # Load data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    movies = data.get('movies', [])
    print(f"Movies: {len(movies)}")
    
    # Load cache
    cache = {}
    if CACHE_FILE.exists():
        with open(CACHE_FILE, 'r') as f:
            cache = json.load(f)
        print(f"Cache: {len(cache)} entries loaded")
    
    # Collect unique theatres to geocode
    theatres_to_geocode = []
    theatres_from_cache = 0
    
    for movie in movies:
        schedules = movie.get('schedules', {})
        for city_name, theatres in schedules.items():
            for theatre in theatres:
                if not theatre.get('address'):
                    continue
                    
                cache_key = f"{theatre['address']}|{city_name}"
                
                if cache_key in cache:
                    # Apply cached coordinates
                    theatre['lat'] = cache[cache_key]['lat']
                    theatre['lng'] = cache[cache_key]['lng']
                    theatres_from_cache += 1
                elif 'lat' not in theatre:
                    theatres_to_geocode.append({
                        'address': theatre['address'],
                        'city': city_name,
                        'theatre': theatre
                    })
    
    print(f"From cache: {theatres_from_cache}")
    print(f"Need geocoding: {len(theatres_to_geocode)}")
    
    if not theatres_to_geocode:
        print("✅ All theatres already geocoded!")
    else:
        print(f"\n⏱️ Estimated time: ~{len(theatres_to_geocode) * RATE_LIMIT_SECONDS:.0f} seconds")
        print(f"Starting geocoding...\n")
        
        geocoded = 0
        failed = 0
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            for i, item in enumerate(theatres_to_geocode):
                coords = await geocode_address(
                    item['address'],
                    item['city'],
                    session,
                    cache
                )
                
                if coords:
                    item['theatre']['lat'] = coords['lat']
                    item['theatre']['lng'] = coords['lng']
                    geocoded += 1
                else:
                    failed += 1
                
                # Progress every 50
                if (i + 1) % 50 == 0 or (i + 1) == len(theatres_to_geocode):
                    elapsed = time.time() - start_time
                    print(f"   [{i+1}/{len(theatres_to_geocode)}] ✓{geocoded} ✗{failed} | {elapsed:.1f}s")
                
                # Rate limit
                await asyncio.sleep(RATE_LIMIT_SECONDS)
        
        print(f"\n📊 Results: {geocoded} geocoded, {failed} failed")
    
    # Save cache
    CACHE_FILE.parent.mkdir(exist_ok=True)
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)
    print(f"💾 Cache saved: {len(cache)} entries")
    
    # Save updated data
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"💾 Data saved: {input_file}")
    
    # Count theatres with coords
    total_with_coords = 0
    total_without = 0
    for movie in movies:
        for city_name, theatres in movie.get('schedules', {}).items():
            for theatre in theatres:
                if 'lat' in theatre:
                    total_with_coords += 1
                else:
                    total_without += 1
    
    print(f"\n✅ Done! {total_with_coords} theatres with coordinates, {total_without} without")


def main():
    # Find the latest movie file
    data_dir = Path(__file__).parent / "data"
    movie_files = sorted(data_dir.glob("movies_*.json"), reverse=True)
    
    if not movie_files:
        print("❌ No movie data files found in data/")
        sys.exit(1)
    
    input_file = movie_files[0]
    asyncio.run(geocode_movie_data(input_file))


if __name__ == "__main__":
    main()
