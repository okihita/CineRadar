"""Performance Aggregator Service.

Aggregates showtime snapshots into movie performance summaries.
Runs in real-time after each showtime is scraped.
"""

import logging
from datetime import UTC, datetime

from backend.domain.models import DailyPerformance, MovieMetadata, ShowtimeSnapshot
from backend.infrastructure.repositories import FirestoreMoviePerformanceRepository

logger = logging.getLogger(__name__)


class PerformanceAggregator:
    """Real-time aggregator for movie performance data.

    Updates movie summary whenever a new showtime snapshot is saved.
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
    ) -> DailyPerformance:
        """Handle a newly scraped showtime.

        Saves the snapshot, then recalculates and updates the movie summary.

        Args:
            snapshot: Showtime snapshot with occupancy data
            movie_title: Movie title (optional, fetched if not provided)
            movie_poster: Movie poster URL (optional)

        Returns:
            Updated DailyPerformance summary

        """
        movie_id = snapshot.movie_id
        date = snapshot.date

        # 1. Save the showtime snapshot
        logger.info(
            f"Saving showtime {snapshot.showtime_id} for movie {movie_id} "
            f"({snapshot.occupancy_pct}% occupied)"
        )
        self.repo.save_showtime(snapshot)

        # 2. Get all showtimes for this movie ON THIS DATE
        daily_showtimes = self.repo.get_daily_showtimes(movie_id, date)

        # 3. Aggregate into DailyPerformance
        daily_summary = self._aggregate_daily(
            date=date,
            showtimes=daily_showtimes,
        )

        # 4. Update Daily Stats in Firestore
        logger.info(
            f"Updated daily stats for {movie_id} on {date}: {daily_summary.total_showtimes} showtimes, "
            f"{daily_summary.avg_occupancy_pct}% avg occupancy"
        )
        self.repo.update_daily_stats(daily_summary, movie_id)

        # 5. Update Metadata (in case title/poster changed or just last_updated)
        # We only update this if we have title/poster info, valid metadata
        if movie_title or movie_poster:
            metadata = MovieMetadata(
                movie_id=movie_id,
                title=movie_title or snapshot.movie_title,
                poster=movie_poster or "",
                last_updated=datetime.now(UTC).isoformat(),
            )
            self.repo.update_metadata(metadata)

        return daily_summary

    def _aggregate_daily(
        self,
        date: str,
        showtimes: list[ShowtimeSnapshot],
    ) -> DailyPerformance:
        """Aggregate showtime snapshots into daily summary.

        Args:
            date: Date string
            showtimes: List of showtime snapshots for this date

        Returns:
            DailyPerformance summary

        """
        if not showtimes:
            return DailyPerformance(date=date)

        # Extract unique cities
        cities = sorted({st.city for st in showtimes if st.city})

        # Calculate totals
        total_seats = sum(st.total_seats for st in showtimes)

        total_sold = 0
        occupancy_sum = 0.0
        scraped_showtimes_count = 0

        for st in showtimes:
            if st.total_seats > 0:
                scraped_showtimes_count += 1

                # True Audience Delta: Try to use audience_count first, fallback to raw sold_seats
                st_sold = st.audience_count if st.audience_count is not None else st.sold_seats
                total_sold += st_sold

                # True Audience Delta: Try to use audience_pct first, fallback to raw occupancy_pct
                st_occ = st.audience_pct if st.audience_pct is not None else st.occupancy_pct
                occupancy_sum += st_occ

        # Calculate average occupancy
        avg_occupancy = (occupancy_sum / scraped_showtimes_count) if scraped_showtimes_count > 0 else 0.0

        return DailyPerformance(
            date=date,
            total_showtimes=len(showtimes),
            total_showtimes_scraped=scraped_showtimes_count,
            avg_occupancy_pct=round(avg_occupancy, 1),
            total_seats=total_seats,
            total_sold=total_sold,
            cities=cities,
            last_updated=datetime.now(UTC).isoformat(),
        )

    def recalculate_all(self, movie_ids: list[str] | None = None) -> None:
        """Recalculate summaries for all or specific movies.

        Note: Recalculating across ALL dates is expensive and complex with this schema.
        For now, this might just log a warning or be removed, as 'get_all_showtimes' is gone.

        To implement correctly, we'd need to list all 'days' subcollections for each movie.
        """
        logger.warning("recalculate_all is not fully implemented for date-sharded schema yet.")
