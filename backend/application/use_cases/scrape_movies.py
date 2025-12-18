"""
Scrape Movies Use Case

Orchestrates the movie scraping workflow:
1. Scrape movie data from source
2. Validate the data
3. Save to repository
4. Sync theatres
5. Log the run
"""

from dataclasses import dataclass
from datetime import datetime

from backend.application.ports.scraper import IMovieScraper
from backend.application.ports.storage import IMovieRepository, ITheatreRepository
from backend.domain.errors import ScrapingError
from backend.domain.models import Movie, ScrapeResult, Theatre


@dataclass
class ScrapeMoviesResult:
    """Result of the scrape movies use case."""
    movies: list[Movie]
    cities_scraped: int
    theatres_synced: int
    success: bool
    error: str | None = None

    @property
    def movie_count(self) -> int:
        return len(self.movies)


class ScrapeMoviesUseCase:
    """Use case: Scrape movie availability and save to storage.

    This is the main entry point for the daily movie scrape.
    It coordinates scraping, validation, and storage.

    Example:
        scraper = TixMovieScraper()
        movie_repo = FirestoreMovieRepository()
        theatre_repo = FirestoreTheatreRepository()

        use_case = ScrapeMoviesUseCase(scraper, movie_repo, theatre_repo)
        result = await use_case.execute(cities=['JAKARTA', 'BANDUNG'])

        if result.success:
            print(f"Scraped {result.movie_count} movies")
    """

    def __init__(
        self,
        scraper: IMovieScraper,
        movie_repo: IMovieRepository,
        theatre_repo: ITheatreRepository,
    ):
        """Initialize with dependencies.

        Args:
            scraper: Movie scraper implementation
            movie_repo: Movie storage implementation
            theatre_repo: Theatre storage implementation
        """
        self.scraper = scraper
        self.movie_repo = movie_repo
        self.theatre_repo = theatre_repo

    async def execute(
        self,
        cities: list[str] | None = None,
        fetch_schedules: bool = True,
        save_to_storage: bool = True,
        sync_theatres: bool = True,
        headless: bool = True,
    ) -> ScrapeMoviesResult:
        """Execute the movie scraping use case.

        Args:
            cities: Optional list of cities to scrape
            fetch_schedules: Whether to fetch detailed showtimes
            save_to_storage: Whether to save result to repository
            sync_theatres: Whether to sync theatre data
            headless: Run browser in headless mode

        Returns:
            ScrapeMoviesResult with success/failure and data
        """
        theatres_synced = 0

        try:
            # Step 1: Scrape movies
            movies = await self.scraper.scrape_movies(
                cities=cities,
                fetch_schedules=fetch_schedules,
                headless=headless,
            )

            if not movies:
                return ScrapeMoviesResult(
                    movies=[],
                    cities_scraped=0,
                    theatres_synced=0,
                    success=False,
                    error="No movies found during scrape"
                )

            # Step 2: Calculate city count
            all_cities = set()
            for movie in movies:
                all_cities.update(movie.cities)

            # Step 3: Sync theatres if requested
            if sync_theatres and fetch_schedules:
                theatres_synced = await self._sync_theatres(movies)

            # Step 4: Save to storage if requested
            if save_to_storage:
                result = ScrapeResult(
                    movies=movies,
                    scraped_at=datetime.utcnow().isoformat(),
                    date=datetime.now().strftime("%Y-%m-%d"),
                    cities_scraped=len(all_cities),
                    success=True,
                )
                self.movie_repo.save_snapshot(result)

            return ScrapeMoviesResult(
                movies=movies,
                cities_scraped=len(all_cities),
                theatres_synced=theatres_synced,
                success=True,
            )

        except ScrapingError as e:
            return ScrapeMoviesResult(
                movies=[],
                cities_scraped=0,
                theatres_synced=0,
                success=False,
                error=f"Scraping failed: {e}"
            )
        except Exception as e:
            return ScrapeMoviesResult(
                movies=[],
                cities_scraped=0,
                theatres_synced=0,
                success=False,
                error=f"Unexpected error: {e}"
            )

    async def _sync_theatres(self, movies: list[Movie]) -> int:
        """Extract and sync theatre data from movies.

        Args:
            movies: List of movies with schedule data

        Returns:
            Number of theatres synced
        """
        synced = 0
        seen_ids = set()

        for movie in movies:
            for city, schedules in movie.schedules.items():
                for schedule in schedules:
                    if schedule.theatre_id in seen_ids:
                        continue

                    seen_ids.add(schedule.theatre_id)

                    # Create Theatre from schedule
                    theatre = Theatre.from_schedule(schedule, city)

                    if self.theatre_repo.upsert(theatre):
                        synced += 1

        return synced
