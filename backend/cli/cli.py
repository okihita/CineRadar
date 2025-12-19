#!/usr/bin/env python3
"""
CineRadar CLI - Unified Scraper Command Line Interface

Usage:
    python -m backend.cli movies [options]    # Scrape movie availability
    python -m backend.cli seats [options]     # Scrape seat occupancy
"""
import argparse
import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path

from backend.config import CITIES
from backend.infrastructure._legacy.seat_scraper import SeatScraper
from backend.infrastructure._legacy.tix_client import CineRadarScraper

# ============================================================================
# MOVIE SCRAPER COMMANDS
# ============================================================================

def run_movie_scrape(
    output_dir: str = "data",
    headless: bool = True,
    city_limit: int | None = None,
    specific_city: str | None = None,
    schedules: bool = False,
    batch: int | None = None,
    total_batches: int = 9,
    max_retries: int = 3
):
    """Run the movie availability scraper with retry logic."""

    async def _run():
        scraper = CineRadarScraper()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        date_str = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Determine cities to scrape
        if batch is not None:
            cities_per_batch = len(CITIES) // total_batches + 1
            start_idx = batch * cities_per_batch
            end_idx = min(start_idx + cities_per_batch, len(CITIES))
            city_names = [c['name'] for c in CITIES[start_idx:end_idx]]
            print(f"🔢 Batch {batch}/{total_batches-1}: cities {start_idx}-{end_idx-1} ({len(city_names)} cities)")
        else:
            city_names = None

        # Header
        print("\n" + "=" * 60)
        print("🎬 CineRadar - Movie Availability Scraper")
        print(f"📅 Date: {date_str}")
        print("=" * 60 + "\n")

        # Scrape with retry
        result = None
        for attempt in range(max_retries):
            try:
                result = await scraper.scrape(
                    headless=headless,
                    city_limit=city_limit,
                    specific_city=specific_city,
                    city_names=city_names,
                    fetch_schedules=schedules
                )
                if result and result.get('movies'):
                    break
            except Exception as e:
                print(f"⚠️ Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait = 2 ** attempt * 5
                    print(f"   Retrying in {wait}s...")
                    await asyncio.sleep(wait)

        if not result or not result.get('movies'):
            print("❌ No data collected after retries.")
            return None

        # Summary
        print(f"\n📊 Cities: {result['total_cities']}, Movies: {result['total_movies']}")

        # Save results
        if batch is not None:
            output_file = output_path / f"batch_{batch}_{date_str}.json"
        else:
            output_file = output_path / f"movies_{date_str}.json"

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'scraped_at': timestamp,
                'date': date_str,
                'batch': batch,
                'movies': result['movies'],
                'city_stats': result['city_stats'],
            }, f, indent=2, ensure_ascii=False)

        print(f"💾 Saved to: {output_file}")
        return result

    return asyncio.run(_run())


# ============================================================================
# SEAT SCRAPER COMMANDS
# ============================================================================

def load_movie_data(data_dir: str = "data") -> dict | None:
    """Load today's movie data from the daily scrape."""
    date_str = datetime.now().strftime("%Y-%m-%d")
    data_path = Path(data_dir)

    # Try today's merged file first, then batch files
    candidates = [
        data_path / f"movies_{date_str}.json",
        data_path / f"batch_0_{date_str}.json",
    ]

    for path in candidates:
        if path.exists():
            with open(path) as f:
                return json.load(f)

    print(f"⚠️ No movie data found for {date_str}")
    return None


def extract_showtimes_from_data(
    movie_data: dict,
    city_filter: str | None = None,
    limit: int | None = None,
    jit_window_minutes: int = 20
) -> list[dict]:
    """Extract showtime info from movie data for seat scraping."""
    showtimes = []

    for movie in movie_data.get('movies', []):
        movie_id = movie.get('movie_id')
        movie_title = movie.get('title', '')

        schedules = movie.get('schedules', {})

        for city_name, theatres in schedules.items():
            if city_filter and city_name.upper() != city_filter.upper():
                continue

            for theatre in theatres:
                theatre_id = theatre.get('theatre_id')
                theatre_name = theatre.get('theatre_name', '')
                merchant = theatre.get('merchant', '')

                for room in theatre.get('rooms', []):
                    room_name = room.get('category', room.get('room_name', ''))

                    # Use all_showtimes which contains showtime_id
                    for showtime_obj in room.get('all_showtimes', room.get('showtimes', [])):
                        if isinstance(showtime_obj, dict):
                            st_id = showtime_obj.get('showtime_id')
                            st_time = showtime_obj.get('time', '')
                            is_available = showtime_obj.get('is_available', True)
                        else:
                            st_id = None
                            st_time = showtime_obj
                            is_available = True

                        if st_id and is_available:
                            showtimes.append({
                                'showtime_id': st_id,
                                'showtime': st_time,
                                'movie_id': movie_id,
                                'movie_title': movie_title,
                                'theatre_id': theatre_id,
                                'theatre_name': theatre_name,
                                'merchant': merchant,
                                'room_name': room_name,
                                'city': city_name,
                                'date': movie_data.get('date', datetime.now().strftime('%Y-%m-%d'))
                            })

    if limit:
        showtimes = showtimes[:limit]

    return showtimes


def filter_jit_showtimes(showtimes: list[dict], window_minutes: int = 20) -> list[dict]:
    """
    Filter showtimes to only those starting within the next N minutes.

    Args:
        showtimes: List of showtime dicts with 'showtime' (HH:MM format)
        window_minutes: Time window in minutes

    Returns:
        Filtered list of showtimes
    """
    now = datetime.now()
    window_start = now
    window_end = now + timedelta(minutes=window_minutes)

    filtered = []
    for st in showtimes:
        time_str = st.get('showtime', '')
        try:
            # Parse HH:MM format
            parts = time_str.split(':')
            if len(parts) == 2:
                show_time = now.replace(
                    hour=int(parts[0]),
                    minute=int(parts[1]),
                    second=0,
                    microsecond=0
                )

                # Check if within window
                if window_start <= show_time <= window_end:
                    filtered.append(st)
        except (ValueError, IndexError):
            continue

    return filtered


def run_seat_scrape(
    mode: str = "morning",
    headless: bool = True,
    city: str | None = None,
    limit: int | None = None,
    batch: int | None = None,
    total_batches: int = 9,
    output_dir: str = "data",
    jit_window: int = 20,
    use_stored_token: bool = False
):
    """Run seat scraping based on mode."""

    async def _run():
        # Load movie data
        movie_data = load_movie_data(output_dir)
        if not movie_data:
            return None

        # Extract showtimes
        showtimes = extract_showtimes_from_data(movie_data, city_filter=city, limit=limit)

        if not showtimes:
            print("⚠️ No showtimes with IDs found")
            return None

        # Apply batching if specified
        if batch is not None:
            per_batch = len(showtimes) // total_batches + 1
            start = batch * per_batch
            end = min(start + per_batch, len(showtimes))
            showtimes = showtimes[start:end]
            print(f"🔢 Batch {batch}: {len(showtimes)} showtimes")

        # JIT mode: filter to upcoming showtimes only
        if mode == 'jit':
            showtimes = filter_jit_showtimes(showtimes, jit_window)
            if not showtimes:
                print(f"📋 No showtimes in next {jit_window} minutes")
                return None

        print(f"📋 Found {len(showtimes)} showtimes to scrape")

        # Run scraper
        scraper = SeatScraper()

        # Use stored token (from Firestore) or login fresh
        if use_stored_token:
            if not scraper.load_token_from_storage():
                print("❌ No valid token in storage - cannot proceed")
                return None
            results = await scraper.scrape_all_showtimes_api_only(showtimes)
        else:
            results = await scraper.scrape_all_showtimes(
                showtimes,
                headless=headless,
                batch_size=10
            )

        # Save results
        if results:
            date_str = datetime.now().strftime("%Y-%m-%d")
            output_path = Path(output_dir)

            if batch is not None:
                filename = f"seats_batch_{batch}_{date_str}.json"
            else:
                filename = f"seats_{mode}_{date_str}.json"

            with open(output_path / filename, 'w') as f:
                json.dump({
                    'scraped_at': datetime.now().isoformat(),
                    'mode': mode,
                    'count': len(results),
                    'results': results
                }, f, indent=2)

            print(f"💾 Saved {len(results)} results to {filename}")

        return results

    return asyncio.run(_run())


# ============================================================================
# CLI ENTRY POINT
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='CineRadar - TIX.id Movie & Seat Scraper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m backend.cli movies --city JAKARTA
  python -m backend.cli movies --batch 0 --total-batches 9
  python -m backend.cli seats --mode morning
  python -m backend.cli seats --city JAKARTA --limit 10
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Scraper command')

    # Movies subcommand
    movies_parser = subparsers.add_parser('movies', help='Scrape movie availability')
    movies_parser.add_argument('--visible', action='store_true', help='Show browser window')
    movies_parser.add_argument('--limit', type=int, help='Limit number of cities')
    movies_parser.add_argument('--city', type=str, help='Scrape specific city')
    movies_parser.add_argument('--schedules', action='store_true', help='Include schedules')
    movies_parser.add_argument('--output', default='data', help='Output directory')
    movies_parser.add_argument('--batch', type=int, help='Batch number (0-indexed)')
    movies_parser.add_argument('--total-batches', type=int, default=9)

    # Seats subcommand
    seats_parser = subparsers.add_parser('seats', help='Scrape seat occupancy')
    seats_parser.add_argument('--mode', choices=['morning', 'jit'], default='morning')
    seats_parser.add_argument('--visible', action='store_true', help='Show browser window')
    seats_parser.add_argument('--city', type=str, help='Filter by city')
    seats_parser.add_argument('--limit', type=int, help='Limit showtimes')
    seats_parser.add_argument('--output', default='data', help='Output directory')
    seats_parser.add_argument('--batch', type=int, help='Batch number')
    seats_parser.add_argument('--total-batches', type=int, default=9)
    seats_parser.add_argument('--jit-window', type=int, default=20, help='JIT window in minutes')
    seats_parser.add_argument('--use-stored-token', action='store_true', help='Use token from Firestore instead of logging in')

    args = parser.parse_args()

    if args.command == 'movies':
        run_movie_scrape(
            output_dir=args.output,
            headless=not args.visible,
            city_limit=args.limit,
            specific_city=args.city,
            schedules=args.schedules,
            batch=args.batch,
            total_batches=args.total_batches
        )
    elif args.command == 'seats':
        run_seat_scrape(
            mode=args.mode,
            headless=not args.visible,
            city=args.city,
            limit=args.limit,
            batch=args.batch,
            total_batches=args.total_batches,
            output_dir=args.output,
            jit_window=args.jit_window,
            use_stored_token=args.use_stored_token
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
