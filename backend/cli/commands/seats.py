"""
Seats command for CLI.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from backend.cli.utils import load_movie_data
from backend.infrastructure.core.seat_scraper import SeatScraper

logger = logging.getLogger(__name__)


def extract_showtimes_from_data(
    movie_data: dict[str, Any],
    city_filter: str | None = None,
    limit: int | None = None,
    jit_window_minutes: int = 20,
) -> list[dict[str, Any]]:
    """Extract showtime info from movie data for seat scraping."""
    showtimes = []

    for movie in movie_data.get("movies", []):
        movie_id = movie.get("movie_id")
        movie_title = movie.get("title", "")

        # Handle schema difference: Firestore uses 'cities', local files use 'schedules'
        schedules = movie.get("schedules") or movie.get("cities", {})

        for city_name, theatres in schedules.items():
            if city_filter and city_name.upper() != city_filter.upper():
                continue

            for theatre in theatres:
                theatre_id = theatre.get("theatre_id")
                theatre_name = theatre.get("theatre_name", "")
                merchant = theatre.get("merchant", "")

                for room in theatre.get("rooms", []):
                    room_name = room.get("category", room.get("room_name", ""))

                    # Use all_showtimes which contains showtime_id
                    for showtime_obj in room.get("all_showtimes", room.get("showtimes", [])):
                        if isinstance(showtime_obj, dict):
                            st_id = showtime_obj.get("showtime_id")
                            st_time = showtime_obj.get("time", "")
                            is_available = showtime_obj.get("is_available", True)
                        else:
                            st_id = None
                            st_time = showtime_obj
                            is_available = True

                        if st_id and is_available:
                            showtimes.append(
                                {
                                    "showtime_id": st_id,
                                    "showtime": st_time,
                                    "movie_id": movie_id,
                                    "movie_title": movie_title,
                                    "theatre_id": theatre_id,
                                    "theatre_name": theatre_name,
                                    "merchant": merchant,
                                    "room_name": room_name,
                                    "city": city_name,
                                    "date": movie_data.get(
                                        "date", datetime.now().strftime("%Y-%m-%d")
                                    ),
                                }
                            )

    if limit:
        showtimes = showtimes[:limit]

    return showtimes


def filter_jit_showtimes(
    showtimes: list[dict[str, Any]], window_minutes: int = 20
) -> list[dict[str, Any]]:
    """
    Filter showtimes to capture at T-20 minutes before start.

    Default window: showtimes starting in 5-25 minutes from now.
    For hourly JIT runs, use window_minutes=60 to get showtimes in 5-65 minutes.

    Args:
        showtimes: List of showtime dicts with 'showtime' (HH:MM format)
        window_minutes: Window size in minutes (default: 20 for T-20, use 60 for hourly)
                       Creates a window of [5, 5+window_minutes] minutes from now

    Returns:
        Filtered list of showtimes in the target window
    """
    now = datetime.now()
    cutoff_minutes = 5  # TIX.id closes booking 5 minutes before showtime

    # Calculate the scraping window: [cutoff + window, cutoff]
    # e.g., window_minutes=20 → scrape showtimes starting in 5-25 minutes
    window_start = now + timedelta(minutes=cutoff_minutes)
    window_end = now + timedelta(minutes=cutoff_minutes + window_minutes)

    filtered = []
    for st in showtimes:
        time_str = st.get("showtime", "")
        try:
            # Parse HH:MM format
            parts = time_str.split(":")
            if len(parts) == 2:
                show_time = now.replace(
                    hour=int(parts[0]), minute=int(parts[1]), second=0, microsecond=0
                )

                # Check if within target window (end-exclusive to avoid overlap)
                if window_start <= show_time < window_end:
                    minutes_until = (show_time - now).total_seconds() / 60
                    logger.debug(
                        f"   Found: {st.get('theatre_name', '?')[:30]} @ {time_str} "
                        f"(T-{minutes_until:.0f}m)"
                    )
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
    jit_window: int = 8,
    use_stored_token: bool = False,
) -> list[dict[str, Any]] | None:
    """Run seat scraping based on mode."""

    async def _run() -> list[dict[str, Any]] | None:
        # Load movie data
        movie_data = load_movie_data(output_dir)
        if not movie_data:
            return None

        # Extract showtimes
        showtimes = extract_showtimes_from_data(movie_data, city_filter=city, limit=limit)

        if not showtimes:
            logger.warning("⚠️ No showtimes with IDs found")
            return None

        # Apply batching if specified
        if batch is not None:
            per_batch = len(showtimes) // total_batches + 1
            start = batch * per_batch
            end = min(start + per_batch, len(showtimes))
            showtimes = showtimes[start:end]
            logger.info(f"🔢 Batch {batch}: {len(showtimes)} showtimes")

        # JIT mode: filter to upcoming showtimes only
        if mode == "jit":
            showtimes = filter_jit_showtimes(showtimes, jit_window)
            if not showtimes:
                logger.info(f"📋 No showtimes in next {jit_window} minutes")
                return None

        logger.info(f"📋 Found {len(showtimes)} showtimes to scrape")

        # Run scraper
        scraper = SeatScraper()

        # Use stored token (from Firestore) - browser login deprecated
        if use_stored_token:
            if not scraper.load_token_from_storage():
                logger.error("❌ No valid token in storage - cannot proceed")
                return None
            results = await scraper.scrape_all_showtimes_api_only(showtimes)
        else:
            # Browser-based login removed - require stored token
            logger.error("❌ --use-stored-token is required for seat scraping")
            logger.error("   Run 'python -m backend.cli.refresh_token' first to store a token")
            return None

        # Save results
        if results:
            date_str = datetime.now().strftime("%Y-%m-%d")
            output_path = Path(output_dir)

            if batch is not None:
                filename = f"seats_batch_{batch}_{date_str}.json"
            else:
                filename = f"seats_{mode}_{date_str}.json"

            with open(output_path / filename, "w") as f:
                json.dump(
                    {
                        "scraped_at": datetime.now().isoformat(),
                        "mode": mode,
                        "count": len(results),
                        "results": results,
                    },
                    f,
                    indent=2,
                )

            logger.info(f"💾 Saved {len(results)} results to {filename}")

        return results

    return asyncio.run(_run())
