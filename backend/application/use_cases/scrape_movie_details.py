"""
Scrape Movie Details Use Case

Orchestrates fetching movie details for discovered movies and saving to Firestore.
Designed to run as part of daily morning scrape for new movies.
"""

from dataclasses import dataclass

from backend.domain.models import MovieDetails
from backend.infrastructure.repositories.firestore_movie_details import (
    FirestoreMovieDetailsRepository,
)
from backend.infrastructure.scrapers.movie_details_client import MovieDetailsClient


@dataclass
class ScrapeMovieDetailsResult:
    """Result of scraping movie details."""

    total_requested: int
    scraped_count: int
    skipped_count: int
    failed_count: int
    success: bool
    error: str | None = None


class ScrapeMovieDetailsUseCase:
    """Use case: Scrape detailed movie information and save to Firestore.

    This fetches enriched movie data (cast, synopsis, ratings, etc.)
    for movies discovered during daily scrape.

    Example:
        use_case = ScrapeMovieDetailsUseCase()
        result = await use_case.execute(movie_ids=["123", "456"])

        if result.success:
            print(f"Scraped {result.scraped_count} movies")
    """

    def __init__(
        self,
        client: MovieDetailsClient | None = None,
        repository: FirestoreMovieDetailsRepository | None = None,
    ):
        """Initialize with dependencies.

        Args:
            client: Movie details API client (optional, creates default)
            repository: Firestore repository (optional, creates default)
        """
        self.client = client or MovieDetailsClient()
        self.repository = repository or FirestoreMovieDetailsRepository()

    async def execute(
        self,
        movie_ids: list[str],
        skip_existing: bool = True,
        update_ratings: bool = False,
    ) -> ScrapeMovieDetailsResult:
        """Execute the movie details scraping use case.

        Args:
            movie_ids: List of movie IDs to fetch details for
            skip_existing: Skip movies that already exist in Firestore
            update_ratings: If True, update ratings even for existing movies

        Returns:
            ScrapeMovieDetailsResult with counts and success status
        """
        total = len(movie_ids)
        skipped = 0
        scraped = 0
        failed = 0

        try:
            # Load authentication token
            if not self.client.load_token():
                return ScrapeMovieDetailsResult(
                    total_requested=total,
                    scraped_count=0,
                    skipped_count=0,
                    failed_count=total,
                    success=False,
                    error="Failed to load authentication token from Firestore",
                )

            # Get existing movie IDs if skipping
            existing_ids = set()
            if skip_existing and not update_ratings:
                existing_ids = self.repository.get_existing_ids()

            for movie_id in movie_ids:
                # Skip if exists and not updating ratings
                if movie_id in existing_ids and not update_ratings:
                    skipped += 1
                    continue

                # Fetch from API
                data = await self.client.fetch(movie_id)
                if not data:
                    failed += 1
                    continue

                # Convert to domain model
                movie_details = MovieDetails.from_api_response(data)

                # Save to Firestore
                if self.repository.save(movie_details):
                    scraped += 1
                else:
                    failed += 1

            return ScrapeMovieDetailsResult(
                total_requested=total,
                scraped_count=scraped,
                skipped_count=skipped,
                failed_count=failed,
                success=True,
            )

        except Exception as e:
            return ScrapeMovieDetailsResult(
                total_requested=total,
                scraped_count=scraped,
                skipped_count=skipped,
                failed_count=failed,
                success=False,
                error=str(e),
            )

    async def execute_for_new_movies(self, latest_movie_ids: list[str]) -> ScrapeMovieDetailsResult:
        """Execute for new movies only (designed for daily scrape integration).

        Automatically skips movies that already have details saved.

        Args:
            latest_movie_ids: Movie IDs from latest scrape

        Returns:
            ScrapeMovieDetailsResult
        """
        return await self.execute(latest_movie_ids, skip_existing=True)
