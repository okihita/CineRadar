#!/usr/bin/env python3
"""Merge batch scrape results into single output file."""
import json
from datetime import datetime
from pathlib import Path


def merge_batches(data_dir: str = "data"):
    data_path = Path(data_dir)
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Find all batch files
    batch_files = sorted(data_path.glob("batch_*_*.json"))
    print(f"📦 Found {len(batch_files)} batch files")
    
    if not batch_files:
        print("❌ No batch files found")
        return
    
    # Merge movies
    movie_map = {}
    city_stats = {}
    
    for batch_file in batch_files:
        print(f"   Loading {batch_file.name}")
        with open(batch_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for movie in data.get('movies', []):
            movie_id = movie['id']
            if movie_id in movie_map:
                # Merge cities and schedules
                existing = movie_map[movie_id]
                for city in movie.get('cities', []):
                    if city not in existing['cities']:
                        existing['cities'].append(city)
                for city, schedules in movie.get('schedules', {}).items():
                    if city not in existing['schedules']:
                        existing['schedules'][city] = schedules
            else:
                movie_map[movie_id] = movie
        
        city_stats.update(data.get('city_stats', {}))
    
    # Sort by city count
    movies = sorted(movie_map.values(), key=lambda x: len(x.get('cities', [])), reverse=True)
    presales = [m for m in movies if m.get('is_presale')]
    
    # Save merged result
    output_file = data_path / f"movies_{date_str}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'scraped_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'date': date_str,
            'summary': {
                'total_cities': len(city_stats),
                'total_movies': len(movies),
                'presale_count': len(presales)
            },
            'movies': movies,
            'city_stats': city_stats,
        }, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Merged {len(movies)} movies from {len(city_stats)} cities")
    print(f"💾 Saved to: {output_file}")


if __name__ == "__main__":
    merge_batches()
