"""
Movie Details API Client

Simple HTTP client for fetching detailed movie information from TIX.id API.
Requires authentication token from Firestore.
"""

import logging
from typing import Any

import httpx

from backend.config import API_BASE

logger = logging.getLogger(__name__)

# Endpoint for movie details - uses /v1 API path
MOVIE_DETAILS_ENDPOINT = f"{API_BASE}/v1/movies"


class MovieDetailsClient:
    """HTTP client for fetching movie details.

    Requires authentication token for API access.

    Example:
        client = MovieDetailsClient()
        client.load_token()  # Load from Firestore
        data = await client.fetch(movie_id="1991446452714422272")
        if data:
            print(data["name"])
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._token: str | None = None

    def set_token(self, token: str) -> None:
        """Set the authentication token."""
        self._token = token

    def load_token(self) -> bool:
        """Load authentication token from Firestore.

        Returns:
            True if token loaded successfully
        """
        from backend.infrastructure.repositories.firestore_token import FirestoreTokenRepository

        try:
            repo = FirestoreTokenRepository()
            token_info = repo.get_token_info()

            if token_info and token_info.get("token"):
                self._token = token_info["token"]
                logger.info("✅ Loaded auth token from Firestore")
                return True

            logger.warning("⚠️ No token found in Firestore")
            return False

        except Exception as e:
            logger.error(f"⚠️ Error loading token: {e}")
            return False

    def _get_headers(self) -> dict[str, str]:
        """Get request headers with auth token."""
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def fetch(self, movie_id: str) -> dict[str, Any] | None:
        """Fetch movie details from TIX.id API.

        Args:
            movie_id: TIX.id movie identifier

        Returns:
            The 'data' field from API response, or None if failed
        """
        if not self._token:
            logger.error("❌ No auth token set - call load_token() first")
            return None

        url = f"{MOVIE_DETAILS_ENDPOINT}/{movie_id}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=self._get_headers())
                response.raise_for_status()

                json_data = response.json()

                if not json_data.get("success"):
                    logger.warning(f"API returned success=false for movie {movie_id}")
                    return None

                return json_data.get("data")

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching movie {movie_id}: {e.response.status_code}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request error fetching movie {movie_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching movie {movie_id}: {e}")
            return None

    async def fetch_batch(
        self, movie_ids: list[str], skip_existing: set[str] | None = None
    ) -> list[dict[str, Any]]:
        """Fetch details for multiple movies.

        Args:
            movie_ids: List of movie IDs to fetch
            skip_existing: Set of movie IDs to skip (already scraped)

        Returns:
            List of movie data dicts (only successful fetches)
        """
        results = []
        skip = skip_existing or set()

        for movie_id in movie_ids:
            if movie_id in skip:
                logger.debug(f"Skipping existing movie {movie_id}")
                continue

            data = await self.fetch(movie_id)
            if data:
                results.append(data)

        return results

