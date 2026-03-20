"""Movie Details command for CLI."""

import asyncio
import logging
from typing import Any

from backend.application.use_cases.scrape_movie_details import ScrapeMovieDetailsUseCase
from backend.infrastructure.repositories.firestore_movie import FirestoreMovieRepository

logger = logging.getLogger(__name__)


def run_movie_details_scrape(
    movie_id: str | None = None,
    all_movies: bool = False,
    from_performance: bool = False,
    skip_existing: bool = True,
    update_ratings: bool = False,
) -> Any:
    """Scrape detailed movie information from TIX.id API.

    Args:
        movie_id: Specific movie ID to scrape
        all_movies: If True, scrape details for all movies in latest snapshot
        from_performance: If True, scrape all movies from movie_performance collection
        skip_existing: Skip movies that already have details saved
        update_ratings: Force update ratings even for existing movies

    """

    async def _run() -> Any:
        logger.info("\n" + "=" * 60)
        logger.info("🎬 CineRadar - Movie Details Scraper")
        logger.info("=" * 60 + "\n")

        use_case = ScrapeMovieDetailsUseCase()

        if movie_id:
            # Single movie mode
            movie_ids = [movie_id]
            logger.info(f"📋 Fetching details for movie: {movie_id}")
        elif from_performance:
            # FIX: Pull from V2 collection which uses correct Metadata IDs.
            # Schema: movie_performance_v2/{metadata_id}
            # Each document ID in this collection is a stable TIX Metadata ID.
            from backend.infrastructure.firestore_collections import MOVIE_PERFORMANCE_V2
            from backend.infrastructure.repositories.firestore_utils import get_firestore_client

            db = get_firestore_client()
            docs = db.collection(MOVIE_PERFORMANCE_V2).stream()
            movie_ids = [doc.id for doc in docs]

            if not movie_ids:
                logger.error("❌ No movies found in movie_performance_v2 collection")
                return None

            logger.info(f"📋 Found {len(movie_ids)} movies in movie_performance_v2")
        elif all_movies:
            # Get all movie IDs from latest snapshot.
            # Schema: snapshots/latest -> movies: [{ tix_metadata_id, ... }]
            # We must only use tix_metadata_id to avoid creating ghost documents.
            movie_repo = FirestoreMovieRepository()
            snapshot = movie_repo.get_latest_snapshot()

            if not snapshot or not snapshot.movies:
                logger.error("❌ No movies found in latest snapshot")
                return None

            # FIX: ONLY use tix_metadata_id. Ignore the schedule 'id' (Schedule ID).
            movie_ids = [m.tix_metadata_id for m in snapshot.movies if m.tix_metadata_id]

            if not movie_ids:
                logger.warning("⚠️ No movies with valid Metadata IDs found in snapshot.")
                return None

            logger.info(f"📋 Found {len(movie_ids)} movies with Metadata IDs in latest snapshot")
        else:
            logger.error("❌ Specify --movie-id, --all, or --from-performance")
            return None

        # Execute use case
        result = await use_case.execute(
            movie_ids=movie_ids,
            skip_existing=skip_existing,
            update_ratings=update_ratings,
        )

        # Report results
        logger.info("\n" + "-" * 40)
        logger.info("📊 Results:")
        logger.info(f"   Total requested: {result.total_requested}")
        logger.info(f"   Scraped: {result.scraped_count}")
        logger.info(f"   Skipped (existing): {result.skipped_count}")
        logger.info(f"   Failed: {result.failed_count}")

        if result.error:
            logger.error(f"   Error: {result.error}")

        return result

    return asyncio.run(_run())
