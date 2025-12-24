"""
TIX.id Seat Scraper

Implements ISeatScraper interface for scraping seat occupancy data.
"""

from backend.application.ports.scraper import ISeatScraper
from backend.domain.errors import TokenExpiredError
from backend.domain.models import SeatOccupancy
from backend.infrastructure.scrapers.base import BaseScraper


class TixSeatScraper(BaseScraper, ISeatScraper):
    """TIX.id implementation of seat scraping.

    Scrapes seat occupancy data using the TIX.id API.
    Requires a valid JWT token.

    Example:
        scraper = TixSeatScraper()
        scraper.set_token("eyJ...")

        occupancies = await scraper.scrape_seats(
            showtime_ids=['123', '456'],
            merchant='XXI'
        )
    """

    def __init__(self):
        super().__init__()

    async def scrape_seats(
        self,
        showtime_ids: list[str],
        merchant: str,
    ) -> list[SeatOccupancy]:
        """Scrape seat occupancy for given showtimes.

        Args:
            showtime_ids: List of showtime IDs to check
            merchant: Cinema chain (XXI, CGV, Cinépolis)

        Returns:
            List of SeatOccupancy domain objects
        """
        if not self.auth_token:
            raise TokenExpiredError("No token set - call set_token() first")

        # Use legacy scraper for now
        # TODO: Migrate full logic here
        from backend.infrastructure.core.seat_scraper import SeatScraper

        legacy_scraper = SeatScraper()
        legacy_scraper.auth_token = self.auth_token

        # Convert showtime_ids to the format expected by legacy scraper
        showtimes = [{"showtime_id": sid} for sid in showtime_ids]

        results = await legacy_scraper.scrape_all_showtimes_api_only(showtimes)

        if not results:
            return []

        # Convert to domain objects
        occupancies = []
        for result in results:
            occ = SeatOccupancy(
                showtime_id=result.get("showtime_id", ""),
                movie_id=result.get("movie_id"),
                movie_title=result.get("movie_title"),
                theatre_id=result.get("theatre_id"),
                theatre_name=result.get("theatre_name"),
                city=result.get("city"),
                merchant=result.get("merchant", merchant),
                room_category=result.get("room_name"),
                showtime=result.get("showtime"),
                date=result.get("date"),
                scraped_at=result.get("scraped_at"),
                total_seats=result.get("total_seats", 0),
                sold_seats=result.get("unavailable_seats", 0),
                available_seats=result.get("available_seats", 0),
                occupancy_pct=result.get("occupancy_pct", 0.0),
                layout=result.get("layout", []),
            )
            occupancies.append(occ)

        return occupancies

    def set_token(self, token: str) -> None:
        """Set authentication token for API calls.

        Args:
            token: JWT token string
        """
        self.auth_token = token

    def load_token_from_storage(self) -> bool:
        """Load token from Firestore storage.

        Returns:
            True if token loaded and valid
        """
        from backend.infrastructure.repositories import FirestoreTokenRepository

        repo = FirestoreTokenRepository()
        token = repo.get_current()

        if not token or token.is_expired:
            return False

        self.auth_token = token.token
        return True
