#!/usr/bin/env python3
"""
CineRadar Data Validator
Validates scraped data before Firestore upload.

Usage:
    python -m backend.scrapers.validate              # Validate today's data
    python -m backend.scrapers.validate --file X    # Validate specific file
    
Exit codes:
    0 - Validation passed
    1 - Validation failed
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pydantic import ValidationError


def validate_daily_scrape(data_dir: str = "data", file_path: Optional[str] = None) -> bool:
    """Validate a daily movie data file.
    
    Args:
        data_dir: Directory containing movie data files
        file_path: Optional specific file to validate
        
    Returns:
        True if validation passed, False otherwise
    """
    from backend.schemas.movie import DailySnapshotSchema
    
    data_path = Path(data_dir)
    
    if file_path:
        input_file = Path(file_path)
    else:
        # Find today's file
        today = datetime.now().strftime("%Y-%m-%d")
        input_file = data_path / f"movies_{today}.json"
        
        # Fall back to latest if today's doesn't exist
        if not input_file.exists():
            movie_files = sorted(data_path.glob("movies_*.json"), reverse=True)
            if movie_files:
                input_file = movie_files[0]
    
    if not input_file.exists():
        print(f"❌ File not found: {input_file}")
        return False
    
    print(f"📂 Validating: {input_file}")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return False
    
    # Schema validation
    try:
        validated = DailySnapshotSchema.model_validate(data)
        print(f"✅ Schema validation PASSED")
        print(f"   📅 Date: {validated.date}")
        print(f"   🎬 Movies: {len(validated.movies)}")
        print(f"   🏙️ Cities: {len(validated.city_stats)}")
        print(f"   🎟️ Pre-sales: {validated.summary.presale_count}")
    except ValidationError as e:
        print(f"❌ Schema validation FAILED:")
        for error in e.errors():
            loc = ' → '.join(str(x) for x in error['loc'])
            print(f"   {loc}: {error['msg']}")
        return False
    
    # Integrity assertions
    try:
        validated.integrity_check(min_movies=10, min_cities=50)
        print(f"✅ Integrity check PASSED")
    except AssertionError as e:
        print(f"❌ Integrity check FAILED: {e}")
        return False
    
    # Additional quality checks
    movies_with_schedules = sum(1 for m in validated.movies if m.schedules)
    merchants = set()
    for m in validated.movies:
        merchants.update(m.merchants)
    
    print(f"   📊 Movies with schedules: {movies_with_schedules}")
    print(f"   🏢 Merchants: {', '.join(sorted(merchants))}")
    
    if movies_with_schedules < 5:
        print(f"⚠️ Warning: Only {movies_with_schedules} movies have schedules")
    
    return True


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate CineRadar scraped data")
    parser.add_argument('--file', '-f', help="Specific file to validate")
    parser.add_argument('--data-dir', '-d', default="data", help="Data directory")
    
    args = parser.parse_args()
    
    success = validate_daily_scrape(data_dir=args.data_dir, file_path=args.file)
    
    if success:
        print("\n🎉 All validations passed!")
        sys.exit(0)
    else:
        print("\n💥 Validation failed - data will NOT be uploaded")
        sys.exit(1)


if __name__ == "__main__":
    main()
