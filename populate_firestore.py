#!/usr/bin/env python3
"""
Script to populate Firestore with existing theatre data from JSON files.
"""
import json
import sys
from pathlib import Path

# Add parent to path  
sys.path.insert(0, str(Path(__file__).parent))

from scraper.firestore_client import sync_theatres_from_scrape


def main():
    # Find the latest movie file
    data_dir = Path(__file__).parent / "data"
    movie_files = sorted(data_dir.glob("movies_*.json"), reverse=True)
    
    if not movie_files:
        print("❌ No movie data files found in data/")
        return
    
    input_file = movie_files[0]
    print(f"📂 Loading: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    movies = data.get('movies', [])
    print(f"🎬 Movies: {len(movies)}")
    
    # Sync to Firestore
    print("🔥 Syncing theatres to Firestore...")
    result = sync_theatres_from_scrape(movies)
    
    print(f"\n✅ Done!")
    print(f"   Total: {result['total']}")
    print(f"   Success: {result['success']}")
    print(f"   Failed: {result['failed']}")


if __name__ == "__main__":
    main()
