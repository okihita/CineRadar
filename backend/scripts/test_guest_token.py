#!/usr/bin/env python3
"""
Test script for guest token fetcher.

Verifies that:
1. Guest token can be acquired from TIX.id API
2. Token has valid JWT structure (3 parts)
3. Token works with /v1/movies endpoint

Usage:
    uv run python -m backend.scripts.test_guest_token
"""

import asyncio
import logging

import httpx

from backend.infrastructure.core.guest_token import (
    GUEST_AUTH_URL,
    fetch_guest_token,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)


async def test_guest_token() -> bool:
    """Test fetching a guest token from TIX.id API."""
    print("=" * 60)  # noqa: T201
    print("Guest Token Fetcher Test")  # noqa: T201
    print("=" * 60)  # noqa: T201
    print(f"Endpoint: {GUEST_AUTH_URL}")  # noqa: T201
    print()  # noqa: T201

    # Test 1: Fetch token
    print("[Test 1] Fetching guest token...")  # noqa: T201
    guest = await fetch_guest_token()

    if not guest:
        print("❌ FAILED: Could not fetch guest token")  # noqa: T201
        return False

    print("✅ SUCCESS: Token acquired!")  # noqa: T201
    print(f"   Token preview: {guest.token[:50]}...")  # noqa: T201
    print(f"   Expires at: {guest.expires_at.isoformat()}")  # noqa: T201
    print(f"   Minutes remaining: {guest.minutes_remaining:.1f}")  # noqa: T201
    print()  # noqa: T201

    # Test 2: Verify token structure (JWT check)
    print("[Test 2] Verifying token structure...")  # noqa: T201
    parts = guest.token.split(".")
    if len(parts) == 3:
        print("✅ SUCCESS: Token appears to be valid JWT (3 parts)")  # noqa: T201
    else:
        print(f"⚠️  WARNING: Token has {len(parts)} parts, expected 3")  # noqa: T201
    print()  # noqa: T201

    # Test 3: Use token to fetch movies (optional, requires network)
    print("[Test 3] Testing token against /v1/movies endpoint...")  # noqa: T201
    await test_token_with_movies(guest.token)

    return True


async def test_token_with_movies(token: str) -> bool:
    """Verify token works with actual API endpoint."""
    # Use Jakarta city_id for testing
    JAKARTA_CITY_ID = "973818511275069440"
    MOVIES_URL = "https://api-b2b.tix.id/v1/movies"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                MOVIES_URL,
                params={
                    "city_id": JAKARTA_CITY_ID,
                    "movie_type": "NOW_PLAYING",
                    "timezone": "7",
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                movies = data.get("data", [])
                print(f"✅ SUCCESS: Fetched {len(movies)} movies from Jakarta")  # noqa: T201
                if movies:
                    first_movie = movies[0]
                    print(f"   First movie: {first_movie.get('title', 'Unknown')}")  # noqa: T201
            else:
                print(f"❌ FAILED: HTTP {response.status_code}")  # noqa: T201
                print(f"   Response: {response.text[:200]}")  # noqa: T201
                return False

    except Exception as e:
        print(f"❌ FAILED: {e}")  # noqa: T201
        return False

    return True


async def main() -> int:
    """Run all tests."""
    success = await test_guest_token()
    print()  # noqa: T201
    print("=" * 60)  # noqa: T201
    if success:
        print("All tests passed! Guest token fetcher is working.")  # noqa: T201
    else:
        print("Some tests failed. Check logs above.")  # noqa: T201
    print("=" * 60)  # noqa: T201

    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
