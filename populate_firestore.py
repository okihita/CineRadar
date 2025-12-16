#!/usr/bin/env python3
"""Populate Firestore with scraped data and log run status."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from backend.services.firebase_client import sync_theatres_from_scrape, log_scraper_run


def main():
    data_dir = Path(__file__).parent / "data"
    movie_files = sorted(data_dir.glob("movies_*.json"), reverse=True)
    
    if not movie_files:
        print("❌ No movie data files found")
        log_scraper_run({'status': 'failed', 'error': 'No data files found', 'movies': 0, 'theatres': 0})
        return
    
    input_file = movie_files[0]
    print(f"📂 Loading: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    movies = data.get('movies', [])
    summary = data.get('summary', {})
    print(f"🎬 Movies: {len(movies)}")
    
    # Sync to Firestore
    print("🔥 Syncing theatres to Firestore...")
    result = sync_theatres_from_scrape(movies)
    
    # Log scraper run
    log_scraper_run({
        'status': 'success' if result['failed'] == 0 else 'partial',
        'date': data.get('date'),
        'movies': len(movies),
        'theatres_total': result['total'],
        'theatres_success': result['success'],
        'theatres_failed': result['failed'],
        'cities': summary.get('total_cities', 0),
        'presales': summary.get('presale_count', 0),
    })
    
    print(f"\n✅ Done! Theatres: {result['success']}/{result['total']}")


if __name__ == "__main__":
    main()
