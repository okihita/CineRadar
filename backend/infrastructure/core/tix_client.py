"""CineRadar TIX.id Scraper Client
Pure API implementation.

This is a migration-friendly version that uses direct HTTP API calls
instead of browser automation. Key improvements over V1:
- No browser dependency (faster, lighter)
- Checks is_any_schedule before fetching showtimes (fixes "wrong date" bug)
- Per-city filtering (same movie may have shows in Jakarta but not Bandung)
- Rate limiting to avoid triggering TIX.id WAF
"""

import asyncio
import json
import logging
import os
import time
from datetime import UTC, datetime
from typing import Any

import httpx

from backend.infrastructure.city_data import CITIES
from backend.infrastructure.core.config import API_BASE
from backend.infrastructure.core.guest_token import GuestToken, fetch_guest_token
from backend.infrastructure.firestore_collections import MOVIES, SCHEDULES, SCHEDULES_V2
from backend.schemas.tix_api import (
    TixMovieItem,
    TixMovieResponse,
    TixScheduleDateResponse,
    TixSchedulesResponse,
    TixTheatre,
)

logger = logging.getLogger(__name__)

# API endpoints
MOVIES_URL = f"{API_BASE}/v1/movies"
SCHEDULES_DATE_URL = f"{API_BASE}/v1/schedules/date"
SCHEDULES_MOVIES_URL = f"{API_BASE}/v1/schedules/movies"

# Rate limiting: 5 requests per second
RATE_LIMIT = 5  # requests per second
MIN_INTERVAL = 1.0 / RATE_LIMIT  # 0.20 seconds between requests


class CineRadarScraper:
    """Movie availability scraper for TIX.id - Pure API version."""

    def __init__(self, rate_limit: int = RATE_LIMIT) -> None:
        self.cities = CITIES
        self.api_base = API_BASE
        self.guest_token: GuestToken | None = None
        self._client: httpx.AsyncClient | None = None
        self._last_request_time: float = 0.0
        self._min_interval = 1.0 / rate_limit if rate_limit > 0 else 0
        self._request_count = 0

    async def _rate_limit(self) -> None:
        """Enforce rate limiting between API calls."""
        if self._min_interval <= 0:
            return

        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < self._min_interval:
            await asyncio.sleep(self._min_interval - elapsed)
        self._last_request_time = time.time()
        self._request_count += 1

    async def _ensure_client(self) -> httpx.AsyncClient:
        """Ensure we have an HTTP client with valid token."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)

        # Refresh token if needed
        if not self.guest_token or self.guest_token.is_expired:
            self.guest_token = await fetch_guest_token()
            if not self.guest_token:
                raise RuntimeError("Failed to acquire guest token")

        return self._client

    async def _get_headers(self) -> dict[str, str]:
        """Get headers with valid authorization."""
        await self._ensure_client()
        if not self.guest_token:
            raise RuntimeError("Guest token not available")
        return {
            "Authorization": f"Bearer {self.guest_token.token}",
            "Content-Type": "application/json",
            "platform": "web",
        }

    async def fetch_movies(self, city_id: str) -> list[TixMovieItem]:
        """Fetch movies for a city using direct API call."""
        await self._rate_limit()
        client = await self._ensure_client()
        headers = await self._get_headers()

        response = await client.get(
            MOVIES_URL,
            params={
                "city_id": city_id,
                "movie_type": "NOW_PLAYING",
                "timezone": "7",
            },
            headers=headers,
        )

        if response.status_code == 200:
            data = TixMovieResponse.model_validate(response.json())
            return data.data
        else:
            logger.error(f"Failed to fetch movies: HTTP {response.status_code}")
            return []

    async def check_schedule_availability(self, schedule_id: str, city_id: str, date: str) -> bool:
        """Check if movie has any schedules for the given date in the given city.

        This is the key fix for the "wrong date" bug - we check BEFORE fetching.
        """
        await self._rate_limit()
        client = await self._ensure_client()
        headers = await self._get_headers()

        response = await client.get(
            SCHEDULES_DATE_URL,
            params={
                "schedule_id": schedule_id,
                "city_id": city_id,
            },
            headers=headers,
        )

        if response.status_code == 200:
            data = TixScheduleDateResponse.model_validate(response.json())

            # Find today's date and check is_any_schedule
            for date_entry in data.data:
                if date_entry.date == date:
                    return date_entry.is_any_schedule

            # Date not found in response = no schedules
            return False

        return False

    async def fetch_movie_schedules(
        self, schedule_id: str, city_id: str, date: str
    ) -> list[TixTheatre]:
        """Fetch theatre schedules for a movie in a city for a specific date.

        Handles pagination via has_next flag.
        """
        client = await self._ensure_client()
        headers = await self._get_headers()

        all_theatres = []
        page = 1

        while True:
            await self._rate_limit()
            response = await client.get(
                f"{SCHEDULES_MOVIES_URL}/{schedule_id}",
                params={
                    "city_id": city_id,
                    "date": date,
                    "page": page,
                },
                headers=headers,
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch schedules: HTTP {response.status_code}")
                break

            try:
                data = TixSchedulesResponse.model_validate(response.json())
            except Exception as e:
                logger.error(f"Failed to parse schedules response: {e}")
                break

            if not data.success or not data.data:
                break

            theatres = data.data.theaters
            has_next = data.data.has_next

            all_theatres.extend(theatres)

            if not has_next or not theatres:
                break

            page += 1
            # Rate limiting: small delay between pages
            await asyncio.sleep(0.1)

        return all_theatres

    def _parse_theatre(self, theatre_data: TixTheatre) -> dict[str, Any]:
        """Parse theatre data from API response."""
        # Extract location data if available
        lat = None
        lng = None
        if theatre_data.location:
            try:
                lat = (
                    float(theatre_data.location.latitude)
                    if theatre_data.location.latitude
                    else None
                )
                lng = (
                    float(theatre_data.location.longitude)
                    if theatre_data.location.longitude
                    else None
                )
            except (ValueError, TypeError):
                pass

        theatre: dict[str, Any] = {
            "theatre_id": theatre_data.id,
            "theatre_name": theatre_data.name,
            "merchant": theatre_data.merchant.merchant_name if theatre_data.merchant else None,
            "address": theatre_data.address,
            "lat": lat,
            "lng": lng,
            "rooms": [],
        }

        for group in theatre_data.price_groups:
            room: dict[str, Any] = {
                "category": group.category,
                "price": group.price_string,
                "showtimes": [],
                "all_showtimes": [],
                "past_showtimes": [],
            }

            for show in group.show_time:
                display_time = show.display_time
                status = show.status
                showtime_id = show.id
                studio_id = show.studio

                showtime_obj = {
                    "time": display_time,
                    "status": status,
                    "is_available": status == 1,
                    "showtime_id": showtime_id,
                    "studio_id": studio_id,
                }
                room["all_showtimes"].append(showtime_obj)

                if status == 1:
                    room["showtimes"].append(display_time)
                else:
                    room["past_showtimes"].append(display_time)

            if room["all_showtimes"]:
                theatre["rooms"].append(room)

        return theatre

    async def scrape_city(self, city: dict[str, Any], date: str) -> dict[str, Any]:
        """Scrape movies for a single city with per-movie schedule checking.

        This coordinates the discovery of playing movies. It explicitly manages
        the TIX API dual-ID system by delegating `id` to the schedule endpoints
        and retaining `movie_id` for downstream metadata resolution.
        """
        city_id = str(city.get("id", ""))
        city_name = city.get("name", "Unknown")

        logger.info(f"📍 Scraping {city_name}...")

        # Step 1: Fetch all movies in city
        movies = await self.fetch_movies(city_id)
        logger.info(f"   Found {len(movies)} movies")

        result = {
            "city": city_name,
            "city_id": city_id,
            "date": date,
            "movies": [],
            "skipped_movies": [],  # Track skipped movies for debugging
            "stats": {
                "total_movies": len(movies),
                "movies_with_shows": 0,
                "movies_skipped": 0,
                "total_showtimes": 0,
            },
        }

        # Step 2: For each movie, check if it has shows TODAY
        for movie in movies:
            # The TIX API provides two distinct IDs:
            # 1. `movie.id`: The Schedule Allocation ID. Used to fetch showtimes. Backwards-compatible with V1 Firestore Documents.
            # 2. `movie.movie_id`: The Metadata ID. Used to fetch enriched trailers/synopsis in the root `movies` collection.
            schedule_id = movie.id
            metadata_id = movie.movie_id
            movie_title = movie.title

            # Check is_any_schedule for TODAY in THIS city
            has_shows = await self.check_schedule_availability(schedule_id, city_id, date)

            if not has_shows:
                logger.debug(f"   ⏭️ {movie_title}: No shows today, skipping")
                result["skipped_movies"].append(
                    {
                        "movie_id": schedule_id,
                        "tix_metadata_id": metadata_id,
                        "title": movie_title,
                        "is_presale": movie.presale_flag == 1,
                    }
                )
                result["stats"]["movies_skipped"] += 1
                continue

            # Step 3: Fetch actual schedules
            theatres = await self.fetch_movie_schedules(schedule_id, city_id, date)

            if theatres:
                parsed_theatres = [self._parse_theatre(t) for t in theatres]

                # Count showtimes
                showtime_count = sum(
                    len(r.get("all_showtimes", []))
                    for t in parsed_theatres
                    for r in t.get("rooms", [])
                )

                movie_entry = {
                    "movie_id": schedule_id,
                    "tix_metadata_id": metadata_id,
                    "title": movie_title,
                    "poster": movie.poster_path,
                    "genres": [g.name for g in movie.genres],
                    "age_category": movie.age_category,
                    "merchants": [m.merchant_name for m in movie.merchant],
                    "is_presale": movie.presale_flag == 1,
                    "theatres": parsed_theatres,
                    "showtime_count": showtime_count,
                }

                result["movies"].append(movie_entry)
                result["stats"]["movies_with_shows"] += 1
                result["stats"]["total_showtimes"] += showtime_count

                logger.info(
                    f"   ✅ {movie_title}: {len(theatres)} theatres, {showtime_count} showtimes"
                )

        return result

    async def scrape(
        self,
        city_limit: int | None = None,
        specific_city: str | None = None,
        city_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """Scrape movie availability for cities using pure API.

        Args:
            city_limit: Limit number of cities to scrape
            specific_city: Scrape only this city
            city_names: List of specific city names to scrape

        Returns:
            Dict with movies and stats

        """
        logger.info("🎬 Starting API-only movie scrape...")

        # Get today's date in Jakarta time
        from backend.domain.time import JAKARTA_TZ

        today = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

        # Filter cities
        if specific_city:
            cities = [c for c in self.cities if c["name"].upper() == specific_city.upper()]
            if not cities:
                logger.error(f"❌ City '{specific_city}' not found")
                return {}
        elif city_names:
            city_names_upper = [n.upper() for n in city_names]
            cities = [c for c in self.cities if c["name"].upper() in city_names_upper]
        else:
            cities = self.cities[:city_limit] if city_limit else self.cities

        logger.info(f"📍 Processing {len(cities)} cities for {today}")

        results = []
        total_stats = {
            "total_movies": 0,
            "movies_with_shows": 0,
            "movies_skipped": 0,
            "total_showtimes": 0,
        }

        for city in cities:
            city_result = await self.scrape_city(city, today)
            results.append(city_result)

            # Aggregate stats
            stats = city_result.get("stats", {})
            total_stats["total_movies"] += stats.get("total_movies", 0)
            total_stats["movies_with_shows"] += stats.get("movies_with_shows", 0)
            total_stats["movies_skipped"] += stats.get("movies_skipped", 0)
            total_stats["total_showtimes"] += stats.get("total_showtimes", 0)

        # Close client
        if self._client:
            await self._client.aclose()
            self._client = None

        logger.info("=" * 60)
        logger.info("📊 Scraping Complete:")
        logger.info(f"   Cities: {len(cities)}")
        logger.info(f"   Movies checked: {total_stats['total_movies']}")
        logger.info(f"   Movies with shows today: {total_stats['movies_with_shows']}")
        logger.info(f"   Movies skipped (no shows): {total_stats['movies_skipped']}")
        logger.info(f"   Total showtimes: {total_stats['total_showtimes']}")
        logger.info(f"   API requests made: {self._request_count}")
        logger.info("=" * 60)

        return {
            "results": results,
            "date": today,
            "total_cities": len(cities),
            "stats": total_stats,
            "api_requests": self._request_count,
        }

    def transform_for_firestore(self, scrape_result: dict[str, Any]) -> list[dict[str, Any]]:
        """Transform scrape results to Firestore document format.

        Output is organized by city, but Firestore expects per-movie documents
        with a 'cities' dict containing {city_name: [theatres]}.

        Args:
            scrape_result: Output from scrape() method

        Returns:
            List of movie dicts ready for Firestore upload

        """
        # Group by movie_id across all cities
        movie_map: dict[str, dict[str, Any]] = {}

        for city_result in scrape_result.get("results", []):
            city_name = city_result.get("city", "")

            for movie in city_result.get("movies", []):
                movie_id = movie.get("movie_id", "")

                if movie_id not in movie_map:
                    # Initialize movie entry
                    movie_map[movie_id] = {
                        "movie_id": movie_id,
                        "tix_metadata_id": movie.get("tix_metadata_id", ""),
                        "title": movie.get("title", ""),
                        "poster": movie.get("poster", ""),
                        "genres": movie.get("genres", []),
                        "age_category": movie.get("age_category", ""),
                        "merchants": movie.get("merchants", []),
                        "is_presale": movie.get("is_presale", False),
                        "cities": {},  # {city_name: [theatres]}
                    }

                # Add theatres for this city
                theatres = movie.get("theatres", [])
                if theatres:
                    movie_map[movie_id]["cities"][city_name] = theatres

        return list(movie_map.values())

    def upload_to_firestore(self, movies: list[dict[str, Any]], date: str) -> int:
        """Upload movie schedules to Firestore schedules collection.

        Implements dual-write to both V1 (schedules) and V2 (schedules_v2) collections:
        - V1: Uses schedule_id as document ID (backward compatible)
        - V2: Uses metadata_id as document ID (immutable, consolidates schedule_ids)

        Args:
            movies: List of movie dicts from transform_for_firestore()
            date: Date string (YYYY-MM-DD)

        Returns:
            Number of movies uploaded

        """
        if not movies:
            logger.warning("⚠️ No movies to upload")
            return 0

        # Lazy import to avoid dependency issues in tests
        from google.cloud import firestore
        from google.oauth2 import service_account

        # Initialize Firestore client
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        if sa_json:
            sa_info = json.loads(sa_json)
            credentials = service_account.Credentials.from_service_account_info(sa_info)  # type: ignore[no-untyped-call]
            db = firestore.Client(credentials=credentials, project=sa_info["project_id"])
        else:
            db = firestore.Client()

        logger.info(f"📤 Uploading {len(movies)} movies to {SCHEDULES}/{date}/{MOVIES}/...")

        uploaded = 0
        v2_uploaded = 0

        for movie in movies:
            schedule_id = movie.get("movie_id")
            metadata_id = movie.get("tix_metadata_id")
            if not schedule_id:
                continue

            # Add metadata
            doc = {
                **movie,
                "date": date,
                "uploaded_at": datetime.now(UTC).isoformat(),
                "source": "api",
            }

            # V1: Write to schedules/{date}/movies/{schedule_id}
            doc_ref = (
                db.collection(SCHEDULES).document(date).collection(MOVIES).document(schedule_id)
            )
            doc_ref.set(doc)
            uploaded += 1

            # V2: Write to schedules_v2/{date}/movies/{metadata_id}
            # Uses metadata_id as document ID, accumulates schedule_ids
            if metadata_id:
                v2_doc_ref = (
                    db.collection(SCHEDULES_V2)
                    .document(date)
                    .collection(MOVIES)
                    .document(metadata_id)
                )

                # Check if document exists to merge schedule_ids
                existing_doc = v2_doc_ref.get()
                if existing_doc.exists:
                    existing_data = existing_doc.to_dict() or {}
                    existing_schedule_ids = set(existing_data.get("schedule_ids", []))
                    existing_schedule_ids.add(schedule_id)
                    schedule_ids_list = list(existing_schedule_ids)
                else:
                    schedule_ids_list = [schedule_id]

                v2_doc = {
                    "metadata_id": metadata_id,
                    "schedule_ids": schedule_ids_list,  # All schedule_ids for this movie
                    "title": movie.get("title", ""),
                    "poster": movie.get("poster", ""),
                    "genres": movie.get("genres", []),
                    "age_category": movie.get("age_category", ""),
                    "merchants": movie.get("merchants", []),
                    "is_presale": movie.get("is_presale", False),
                    "cities": movie.get("cities", {}),
                    "date": date,
                    "uploaded_at": datetime.now(UTC).isoformat(),
                    "source": "api",
                }

                v2_doc_ref.set(v2_doc)
                v2_uploaded += 1

            logger.info(f"   ✓ {movie.get('title', schedule_id)[:40]}")

        logger.info(f"✅ Uploaded {uploaded} movies to {SCHEDULES}/{date}/{MOVIES}/")
        logger.info(f"✅ Uploaded {v2_uploaded} movies to {SCHEDULES_V2}/{date}/{MOVIES}/")
        return uploaded

    async def scrape_and_upload(
        self,
        city_limit: int | None = None,
        specific_city: str | None = None,
        city_names: list[str] | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Scrape and optionally upload to Firestore.

        Args:
            city_limit: Limit number of cities to scrape
            specific_city: Scrape only this city
            city_names: List of specific city names to scrape
            dry_run: If True, skip Firestore upload

        Returns:
            Dict with scrape results and upload status

        """
        # Scrape
        result = await self.scrape(
            city_limit=city_limit,
            specific_city=specific_city,
            city_names=city_names,
        )

        if not result:
            return {"success": False, "error": "No scrape results"}

        # Transform for Firestore
        movies = self.transform_for_firestore(result)
        date = result.get("date", "")

        result["movies_for_firestore"] = len(movies)

        # Upload unless dry run
        if not dry_run:
            uploaded = self.upload_to_firestore(movies, date)
            result["uploaded"] = uploaded
        else:
            result["uploaded"] = 0
            logger.info("🔍 Dry run - skipping Firestore upload")

        result["success"] = True
        return result
