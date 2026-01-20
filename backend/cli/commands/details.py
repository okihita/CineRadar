"""
Movie Details command for CLI.
"""

import asyncio
import logging
from typing import Any

from backend.application.use_cases.scrape_movie_details import ScrapeMovieDetailsUseCase
from backend.infrastructure.repositories.firestore_movie import FirestoreMovieRepository
from backend.infrastructure.repositories.firestore_movie_performance import (
    FirestoreMoviePerformanceRepository,
)

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
            # Get all movie IDs from movie_performance collection
            perf_repo = FirestoreMoviePerformanceRepository()
            movies = perf_repo.list_movies(limit=500)

            if not movies:
                logger.error("❌ No movies found in movie_performance collection")
                return None

            movie_ids = [m.movie_id for m in movies]
            logger.info(f"📋 Found {len(movie_ids)} movies in movie_performance")
        elif all_movies:
            # Get all movie IDs from latest snapshot
            movie_repo = FirestoreMovieRepository()
            snapshot = movie_repo.get_latest_snapshot()

            if not snapshot or not snapshot.movies:
                logger.error("❌ No movies found in latest snapshot")
                return None

            movie_ids = [m.id for m in snapshot.movies]
            logger.info(f"📋 Found {len(movie_ids)} movies in latest snapshot")
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
