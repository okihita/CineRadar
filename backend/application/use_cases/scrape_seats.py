"""
Scrape Seats Use Case

Orchestrates seat occupancy scraping:
1. Load movie data to get showtime IDs
2. Validate token is available
3. Scrape seat data
4. Save results
"""

from dataclasses import dataclass

from backend.application.ports.scraper import ISeatScraper
from backend.application.ports.storage import IMovieRepository, ITokenRepository
from backend.domain.errors import ScrapingError, TokenExpiredError
from backend.domain.models import SeatOccupancy


@dataclass
class ScrapSeatsResult:
    """Result of the seat scraping use case."""
    occupancies: list[SeatOccupancy]
    showtimes_checked: int
    success: bool
    error: str | None = None

    @property
    def count(self) -> int:
        return len(self.occupancies)

    @property
    def average_occupancy(self) -> float:
        if not self.occupancies:
            return 0.0
        return sum(o.occupancy_pct for o in self.occupancies) / len(self.occupancies)


class ScrapSeatsUseCase:
    """Use case: Scrape seat occupancy for today's showtimes.

    Example:
        scraper = TixSeatScraper()
        movie_repo = FirestoreMovieRepository()
        token_repo = FirestoreTokenRepository()

        use_case = ScrapSeatsUseCase(scraper, movie_repo, token_repo)
        result = await use_case.execute(city='JAKARTA', limit=50)

        print(f"Average occupancy: {result.average_occupancy:.1f}%")
    """

    def __init__(
        self,
        scraper: ISeatScraper,
        movie_repo: IMovieRepository,
        token_repo: ITokenRepository,
    ):
        self.scraper = scraper
        self.movie_repo = movie_repo
        self.token_repo = token_repo

    async def execute(
        self,
        city: str | None = None,
        limit: int | None = None,
        showtime_ids: list[str] | None = None,
    ) -> ScrapSeatsResult:
        """Execute seat scraping.

        Args:
            city: Optional city filter
            limit: Maximum showtimes to scrape
            showtime_ids: Specific showtime IDs (overrides other filters)

        Returns:
            ScrapSeatsResult with occupancy data
        """
        try:
            # Step 1: Get token
            token = self.token_repo.get_current()
            if not token:
                return ScrapSeatsResult(
                    occupancies=[],
                    showtimes_checked=0,
                    success=False,
                    error="No token available - run token refresh first"
                )

            if not token.is_valid_for_scrape:
                return ScrapSeatsResult(
                    occupancies=[],
                    showtimes_checked=0,
                    success=False,
                    error=f"Token expires in {token.minutes_until_expiry} minutes (need 25+)"
                )

            # Set token on scraper
            self.scraper.set_token(token.token)

            # Step 2: Get showtime IDs
            if showtime_ids is None:
                ids_to_scrape = await self._get_showtime_ids_from_movies(city, limit)
            else:
                ids_to_scrape = showtime_ids

            if not ids_to_scrape:
                return ScrapSeatsResult(
                    occupancies=[],
                    showtimes_checked=0,
                    success=True,  # Not a failure, just no data
                    error="No showtimes with IDs found"
                )

            # Step 3: Scrape seats
            # Group by merchant for efficient API calls
            occupancies = await self.scraper.scrape_seats(
                showtime_ids=ids_to_scrape,
                merchant="XXI",  # TODO: Handle multiple merchants
            )

            return ScrapSeatsResult(
                occupancies=occupancies,
                showtimes_checked=len(ids_to_scrape),
                success=True,
            )

        except TokenExpiredError as e:
            return ScrapSeatsResult(
                occupancies=[],
                showtimes_checked=0,
                success=False,
                error=f"Token expired: {e}"
            )
        except ScrapingError as e:
            return ScrapSeatsResult(
                occupancies=[],
                showtimes_checked=0,
                success=False,
                error=f"Scraping failed: {e}"
            )

    async def _get_showtime_ids_from_movies(
        self,
        city: str | None,
        limit: int | None
    ) -> list[str]:
        """Extract showtime IDs from today's movie data."""
        snapshot = self.movie_repo.get_latest_snapshot()
        if not snapshot:
            return []

        ids = []
        for movie in snapshot.movies:
            for city_name, schedules in movie.schedules.items():
                if city and city_name.upper() != city.upper():
                    continue

                for schedule in schedules:
                    for room in schedule.rooms:
                        for showtime in room.showtimes:
                            if showtime.showtime_id and showtime.is_available:
                                ids.append(showtime.showtime_id)

                                if limit and len(ids) >= limit:
                                    return ids

        return ids
