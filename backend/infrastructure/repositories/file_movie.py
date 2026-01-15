"""
File-based Movie Repository

Implements IMovieRepository using local JSON files.
Useful for development and batch processing.
"""

import json
from pathlib import Path

from backend.application.ports.storage import IMovieRepository
from backend.domain.models import Movie, ScrapeResult


class FileMovieRepository(IMovieRepository):
    """File-based implementation of movie storage.

    Stores movie snapshots as JSON files in a data directory.

    Example:
        repo = FileMovieRepository("data")

        # Save snapshot
        result = ScrapeResult(movies=[...], scraped_at="...", date="2025-12-18")
        repo.save_snapshot(result)

        # Load from file
        latest = repo.get_latest_snapshot()
    """

    def __init__(self, data_dir: str = "data"):
        """Initialize with data directory.

        Args:
            data_dir: Path to data directory
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)

    def save_snapshot(self, result: ScrapeResult) -> bool:
        """Save a daily movie snapshot.

        Args:
            result: ScrapeResult containing movies and metadata

        Returns:
            True if save successful
        """
        try:
            data = result.to_dict()

            # Add city_stats
            city_stats: dict[str, int] = {}
            for movie in result.movies:
                for city in movie.cities:
                    city_stats[city] = city_stats.get(city, 0) + 1
            data["city_stats"] = city_stats

            # Save to dated file
            output_file = self.data_dir / f"movies_{result.date}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            return True

        except Exception as e:
            print(f"⚠️ Error saving snapshot: {e}")
            return False

    def get_latest_snapshot(self) -> ScrapeResult | None:
        """Get the most recent movie snapshot.

        Finds the newest movies_*.json file.

        Returns:
            ScrapeResult or None if no snapshots exist
        """
        try:
            movie_files = sorted(self.data_dir.glob("movies_*.json"), reverse=True)

            if not movie_files:
                return None

            return self._load_file(movie_files[0])

        except Exception as e:
            print(f"⚠️ Error getting latest snapshot: {e}")
            return None

    def get_snapshot_by_date(self, date: str) -> ScrapeResult | None:
        """Get snapshot for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            ScrapeResult or None if not found
        """
        file_path = self.data_dir / f"movies_{date}.json"

        if not file_path.exists():
            return None

        return self._load_file(file_path)

    def _load_file(self, file_path: Path) -> ScrapeResult | None:
        """Load a movie data file."""
        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)

            movies = [Movie.from_dict(m) for m in data.get("movies", [])]

            return ScrapeResult(
                movies=movies,
                scraped_at=data.get("scraped_at", ""),
                date=data.get("date", ""),
                cities_scraped=len(data.get("city_stats", {})),
                success=True,
            )

        except Exception as e:
            print(f"⚠️ Error loading {file_path}: {e}")
            return None

    def list_snapshots(self) -> list[str]:
        """List all available snapshot dates.

        Returns:
            List of date strings
        """
        files = self.data_dir.glob("movies_*.json")
        dates = []

        for f in sorted(files, reverse=True):
            # Extract date from filename
            name = f.stem  # movies_2025-12-18
            if name.startswith("movies_"):
                dates.append(name[7:])  # 2025-12-18

        return dates
