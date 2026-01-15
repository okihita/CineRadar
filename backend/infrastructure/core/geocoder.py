"""
Geocoding Service

Provides geocoding functionality using OpenStreetMap Nominatim API.
Includes caching to avoid repeated API calls.
"""

import asyncio
import json
import os
from typing import Any

import aiohttp


# Default cache file location
DEFAULT_CACHE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "geocode_cache.json"
)


async def geocode_address(
    address: str,
    city: str,
    session: aiohttp.ClientSession,
    cache: dict[str, dict[str, float]],
) -> dict[str, float] | None:
    """
    Geocode an address using OpenStreetMap Nominatim.

    Args:
        address: Street address to geocode
        city: City name for context
        session: aiohttp client session (reuse for rate limiting)
        cache: In-memory cache dict to store results

    Returns:
        Dict with 'lat' and 'lng' keys, or None if not found
    """
    cache_key = f"{address}|{city}"

    # Check cache first
    if cache_key in cache:
        return cache[cache_key]

    # Build search query
    search_query = f"{address}, {city}, Indonesia"

    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": search_query, "format": "json", "limit": 1, "countrycodes": "id"}
        headers = {"User-Agent": "CineRadar/1.0 (cinema data aggregator)"}

        async with session.get(url, params=params, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                if data and len(data) > 0:
                    result = {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
                    cache[cache_key] = result
                    return result

        return None

    except Exception:
        return None


def load_geocode_cache(cache_path: str = DEFAULT_CACHE_PATH) -> dict[str, dict[str, float]]:
    """
    Load geocoding cache from disk.

    Args:
        cache_path: Path to cache JSON file

    Returns:
        Cache dict, empty if file doesn't exist or is invalid
    """
    try:
        if os.path.exists(cache_path):
            with open(cache_path, encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_geocode_cache(
    cache: dict[str, dict[str, float]], cache_path: str = DEFAULT_CACHE_PATH
) -> bool:
    """
    Save geocoding cache to disk.

    Args:
        cache: Cache dict to save
        cache_path: Path to cache JSON file

    Returns:
        True if saved successfully
    """
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
        return True
    except Exception:
        return False


class Geocoder:
    """
    Geocoding service with rate limiting and caching.

    Example:
        geocoder = Geocoder()
        await geocoder.geocode_theatres_in_movie_data(movie_map)
    """

    RATE_LIMIT_SECONDS = 1.1  # Nominatim requires 1 req/sec

    def __init__(self, cache_path: str = DEFAULT_CACHE_PATH, logger: Any = None) -> None:
        """
        Initialize geocoder.

        Args:
            cache_path: Path to cache file
            logger: Optional logging function (called with message strings)
        """
        self.cache_path = cache_path
        self.cache = load_geocode_cache(cache_path)
        self.log = logger or (lambda msg: print(msg))

    def _collect_theatres_to_geocode(
        self, movie_map: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Collect theatres that need geocoding from movie data."""
        theatres_to_geocode = []

        for _movie_id, movie in movie_map.items():
            if "schedules" in movie:
                for city_name, theatres in movie["schedules"].items():
                    for theatre in theatres:
                        if theatre.get("address"):
                            cache_key = f"{theatre['address']}|{city_name}"
                            if cache_key not in self.cache:
                                theatres_to_geocode.append(
                                    {
                                        "address": theatre["address"],
                                        "city": city_name,
                                        "theatre": theatre,
                                    }
                                )

        return theatres_to_geocode

    def _apply_cached_coordinates(self, movie_map: dict[str, Any]) -> None:
        """Apply cached coordinates to theatres that haven't been geocoded yet."""
        for _movie_id, movie in movie_map.items():
            if "schedules" in movie:
                for city_name, theatres in movie["schedules"].items():
                    for theatre in theatres:
                        if theatre.get("address") and "lat" not in theatre:
                            cache_key = f"{theatre['address']}|{city_name}"
                            if cache_key in self.cache:
                                theatre["lat"] = self.cache[cache_key]["lat"]
                                theatre["lng"] = self.cache[cache_key]["lng"]

    async def geocode_theatres_in_movie_data(self, movie_map: dict[str, Any]) -> dict[str, Any]:
        """
        Geocode all theatre addresses in movie data.

        Updates theatres in-place with 'lat' and 'lng' fields.
        Uses cache to avoid repeated API calls.

        Args:
            movie_map: Dict of movie_id -> movie data with schedules

        Returns:
            The same movie_map with geocoded theatre locations
        """
        self.log("📍 Starting theatre geocoding...")
        self.log(f"   Loaded {len(self.cache)} cached locations")

        # Collect theatres needing geocoding
        theatres_to_geocode = self._collect_theatres_to_geocode(movie_map)
        self.log(f"   {len(theatres_to_geocode)} theatres need geocoding")

        # Geocode with rate limiting
        geocoded = 0
        failed = 0

        async with aiohttp.ClientSession() as session:
            for i, item in enumerate(theatres_to_geocode):
                coords = await geocode_address(
                    item["address"], item["city"], session, self.cache
                )

                if coords:
                    item["theatre"]["lat"] = coords["lat"]
                    item["theatre"]["lng"] = coords["lng"]
                    geocoded += 1
                else:
                    failed += 1

                # Progress every 10
                if (i + 1) % 10 == 0:
                    self.log(
                        f"   Geocoded {i + 1}/{len(theatres_to_geocode)} "
                        f"({geocoded} ok, {failed} failed)"
                    )

                # Rate limit for Nominatim
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)

        # Apply cached coordinates to remaining theatres
        self._apply_cached_coordinates(movie_map)

        # Save updated cache
        if save_geocode_cache(self.cache, self.cache_path):
            self.log(f"   Saved {len(self.cache)} locations to cache")
        else:
            self.log("   ⚠️ Failed to save cache")

        self.log(f"📍 Geocoding complete: {geocoded} new, {failed} failed")
        return movie_map
