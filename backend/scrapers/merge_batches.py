#!/usr/bin/env python3
"""Merge batch scrape results into single output file with validation."""
import json
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def merge_batches(data_dir: str = "data", validate: bool = True) -> bool:
    """Merge batch files into single daily output.

    Args:
        data_dir: Directory containing batch files
        validate: Whether to validate merged output with Pydantic

    Returns:
        True if merge (and validation) successful
    """
    data_path = Path(data_dir)
    date_str = datetime.now().strftime("%Y-%m-%d")

    # Find all batch files
    batch_files = sorted(data_path.glob("batch_*_*.json"))
    print(f"📦 Found {len(batch_files)} batch files")

    if not batch_files:
        print("❌ No batch files found")
        return False

    # Merge movies
    movie_map = {}
    city_stats = {}

    for batch_file in batch_files:
        print(f"   Loading {batch_file.name}")
        with open(batch_file, encoding='utf-8') as f:
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

    # Build output data
    output_data = {
        'scraped_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'date': date_str,
        'summary': {
            'total_cities': len(city_stats),
            'total_movies': len(movies),
            'presale_count': len(presales)
        },
        'movies': movies,
        'city_stats': city_stats,
    }

    # Validate with Pydantic if enabled
    if validate:
        try:
            from pydantic import ValidationError

            from backend.schemas.movie import DailySnapshotSchema

            print("🔍 Validating merged data...")
            validated = DailySnapshotSchema.model_validate(output_data)
            print(f"✅ Validation passed: {len(validated.movies)} movies, {len(validated.city_stats)} cities")
        except ValidationError as e:
            print("❌ Validation FAILED - data quality issue detected:")
            for error in e.errors():
                loc = ' → '.join(str(x) for x in error['loc'])
                print(f"   {loc}: {error['msg']}")
            return False
        except ImportError:
            print("⚠️ Pydantic not available, skipping validation")

    # Save merged result
    output_file = data_path / f"movies_{date_str}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Merged {len(movies)} movies from {len(city_stats)} cities")
    print(f"💾 Saved to: {output_file}")
    return True


if __name__ == "__main__":
    success = merge_batches()
    sys.exit(0 if success else 1)

