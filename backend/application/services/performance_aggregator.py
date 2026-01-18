"""
Performance Aggregator Service

Aggregates showtime snapshots into movie performance summaries.
Runs in real-time after each showtime is scraped.
"""

import logging
from datetime import UTC, datetime

from backend.domain.models import MoviePerformance, ShowtimeSnapshot
from backend.infrastructure.repositories import FirestoreMoviePerformanceRepository

logger = logging.getLogger(__name__)


class PerformanceAggregator:
    """Real-time aggregator for movie performance data.

    Updates movie summary whenever a new showtime snapshot is saved.

    Example:
        repo = FirestoreMoviePerformanceRepository()
        aggregator = PerformanceAggregator(repo)

        # After scraping a showtime
        snapshot = ShowtimeSnapshot(...)
        aggregator.on_showtime_scraped(snapshot)
        # → Saves snapshot + recalculates movie summary
    """

    def __init__(self, repo: FirestoreMoviePerformanceRepository):
        """Initialize aggregator.

        Args:
            repo: Firestore repository for persistence
        """
        self.repo = repo

    def on_showtime_scraped(
        self,
        snapshot: ShowtimeSnapshot,
        movie_title: str | None = None,
        movie_poster: str | None = None,
    ) -> MoviePerformance:
        """Handle a newly scraped showtime.

        Saves the snapshot, then recalculates and updates the movie summary.

        Args:
            snapshot: Showtime snapshot with occupancy data
            movie_title: Movie title (optional, fetched if not provided)
            movie_poster: Movie poster URL (optional)

        Returns:
            Updated MoviePerformance summary
        """
        movie_id = snapshot.movie_id

        # 1. Save the showtime snapshot
        logger.info(
            f"Saving showtime {snapshot.showtime_id} for movie {movie_id} "
            f"({snapshot.occupancy_pct}% occupied)"
        )
        self.repo.save_showtime(snapshot)

        # 2. Get all showtimes for this movie
        all_showtimes = self.repo.get_all_showtimes(movie_id)

        # 3. Aggregate into summary
        summary = self._aggregate(
            movie_id=movie_id,
            showtimes=all_showtimes,
            movie_title=movie_title or snapshot.movie_title,
            movie_poster=movie_poster or "",
        )

        # 4. Update summary in Firestore
        logger.info(
            f"Updated summary for {movie_id}: {summary.total_showtimes} showtimes, "
            f"{summary.avg_occupancy_pct}% avg occupancy"
        )
        self.repo.update_summary(summary)

        return summary

    def _aggregate(
        self,
        movie_id: str,
        showtimes: list[ShowtimeSnapshot],
        movie_title: str,
        movie_poster: str,
    ) -> MoviePerformance:
        """Aggregate showtime snapshots into movie summary.

        Args:
            movie_id: Movie identifier
            showtimes: List of all showtime snapshots for this movie
            movie_title: Movie title
            movie_poster: Poster URL

        Returns:
            MoviePerformance summary
        """
        if not showtimes:
            # No data yet, return empty summary
            return MoviePerformance(
                movie_id=movie_id,
                title=movie_title,
                poster=movie_poster,
                date=datetime.now().strftime("%Y-%m-%d"),
            )

        # Extract unique cities
        cities = sorted({st.city for st in showtimes if st.city})

        # Calculate totals
        total_seats = sum(st.total_seats for st in showtimes)
        total_sold = sum(st.sold_seats for st in showtimes)

        # Calculate average occupancy
        avg_occupancy = (
            sum(st.occupancy_pct for st in showtimes) / len(showtimes) if showtimes else 0.0
        )

        # Use date from first showtime
        date = showtimes[0].date if showtimes else datetime.now().strftime("%Y-%m-%d")

        return MoviePerformance(
            movie_id=movie_id,
            title=movie_title,
            poster=movie_poster,
            date=date,
            cities=cities,
            total_showtimes=len(showtimes),
            avg_occupancy_pct=round(avg_occupancy, 1),
            total_seats=total_seats,
            total_sold=total_sold,
            last_updated=datetime.now(UTC).isoformat(),
        )

    def recalculate_all(self, movie_ids: list[str] | None = None) -> list[MoviePerformance]:
        """Recalculate summaries for all or specific movies.

        Useful for backfilling or fixing data.

        Args:
            movie_ids: List of movie IDs to recalculate, or None for all

        Returns:
            List of updated MoviePerformance summaries
        """
        if movie_ids is None:
            # Get all movies
            summaries = self.repo.list_movies(limit=1000)
            movie_ids = [s.movie_id for s in summaries]

        results = []
        for movie_id in movie_ids:
            # Get existing summary for title/poster
            existing = self.repo.get_summary(movie_id)
            title = existing.title if existing else "Unknown"
            poster = existing.poster if existing else ""

            # Get all showtimes
            showtimes = self.repo.get_all_showtimes(movie_id)

            # Recalculate
            summary = self._aggregate(movie_id, showtimes, title, poster)
            self.repo.update_summary(summary)
            results.append(summary)

            logger.info(f"Recalculated {movie_id}: {summary.total_showtimes} showtimes")

        return results
