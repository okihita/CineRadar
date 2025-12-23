#!/usr/bin/env python3
"""
Scrape the nearest upcoming showtime and output seat layout data.

Usage:
    python -m backend.cli.scrape_nearest_showtime
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path

from backend.cli.cli import extract_showtimes_from_data, load_movie_data
from backend.infrastructure._legacy.seat_scraper import SeatScraper


def find_nearest_showtime(showtimes: list[dict]) -> dict | None:
    """Find the showtime closest to now (preferring upcoming)."""
    now = datetime.now()

    def time_diff(st):
        time_str = st.get('showtime', '00:00')
        try:
            parts = time_str.split(':')
            show_time = now.replace(
                hour=int(parts[0]),
                minute=int(parts[1]),
                second=0,
                microsecond=0
            )
            diff = (show_time - now).total_seconds()
            # Prefer upcoming showtimes, but allow recently started (within -30 min)
            if diff < -1800:  # More than 30 min ago
                return float('inf')
            return abs(diff)
        except (ValueError, IndexError):
            return float('inf')

    valid = [st for st in showtimes if time_diff(st) != float('inf')]
    if not valid:
        return None

    return min(valid, key=time_diff)


async def main():
    print("🎬 Finding nearest showtime...")

    # Load movie data
    movie_data = load_movie_data()
    if not movie_data:
        print("❌ No movie data found")
        return

    # Extract all showtimes
    showtimes = extract_showtimes_from_data(movie_data)
    print(f"📋 Found {len(showtimes)} total showtimes")

    # Find nearest (with fallback)
    def time_diff_for_sort(st):
        time_str = st.get('showtime', '00:00')
        try:
            parts = time_str.split(':')
            show_time = now.replace(
                hour=int(parts[0]),
                minute=int(parts[1]),
                second=0,
                microsecond=0
            )
            diff = (show_time - now).total_seconds()
            # Only upcoming showtimes (starting in the future)
            if diff < 0:
                return float('inf')
            return diff  # Return positive diff (smaller = sooner)
        except (ValueError, IndexError):
            return float('inf')

    # Sort by time difference
    now = datetime.now()
    valid_showtimes = [st for st in showtimes if time_diff_for_sort(st) != float('inf')]
    valid_showtimes.sort(key=time_diff_for_sort)

    if not valid_showtimes:
        print("❌ No upcoming showtimes found")
        return

    # Initialize scraper
    scraper = SeatScraper()
    if not scraper.load_token_from_storage():
        print("❌ Could not load token")
        return

    # Try up to 5 showtimes until one works
    layout = None
    selected = None
    for i, nearest in enumerate(valid_showtimes[:5]):
        print(f"\n🎬 Trying showtime {i+1}/5:")
        print(f"   🎬 {nearest['movie_title']}")
        print(f"   🏢 {nearest['theatre_name']} ({nearest['merchant']})")
        print(f"   🕐 {nearest['showtime']}")
        print(f"   📍 {nearest['city']}")

        layout = await scraper._fetch_seat_layout_api(
            nearest['showtime_id'],
            nearest['merchant']
        )

        if layout:
            selected = nearest
            break
        else:
            print("   ⚠️ Failed, trying next...")

    if not layout or not selected:
        print("❌ Failed to fetch any seat layout after 5 attempts")
        return

    nearest = selected

    # Calculate occupancy (layout already fetched above)
    occupancy = scraper.calculate_occupancy(layout)
    print(f"   ✅ {occupancy['unavailable_seats']}/{occupancy['total_seats']} unavailable ({occupancy['occupancy_pct']}%)")

    # Build output data
    output = {
        'scraped_at': datetime.now().isoformat(),
        'showtime': {
            'movie_title': nearest['movie_title'],
            'movie_id': nearest['movie_id'],
            'theatre_name': nearest['theatre_name'],
            'theatre_id': nearest['theatre_id'],
            'merchant': nearest['merchant'],
            'city': nearest['city'],
            'room_name': nearest.get('room_name', ''),
            'time': nearest['showtime'],
            'showtime_id': nearest['showtime_id'],
        },
        'occupancy': occupancy,
        'seat_map': layout.get('data', {}).get('seat_map', []),
    }

    # Save to file
    output_path = Path('data/live_seat_snapshot.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Saved to {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
