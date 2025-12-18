"""
CineRadar Test Suite - Repositories

Tests for repository implementations.
"""

import pytest
import json
import tempfile
from pathlib import Path

from backend.domain.models import Movie, ScrapeResult
from backend.infrastructure.repositories.file_movie import FileMovieRepository


class TestFileMovieRepository:
    """Tests for FileMovieRepository."""
    
    @pytest.fixture
    def temp_data_dir(self):
        """Create temporary data directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir
    
    def test_save_snapshot(self, temp_data_dir):
        """Can save a snapshot to file."""
        repo = FileMovieRepository(temp_data_dir)
        
        movies = [
            Movie(id="1", title="Test Movie", cities=["JAKARTA"]),
        ]
        result = ScrapeResult(
            movies=movies,
            scraped_at="2025-12-18T00:00:00",
            date="2025-12-18",
        )
        
        success = repo.save_snapshot(result)
        assert success == True
        
        # Check file exists
        expected_file = Path(temp_data_dir) / "movies_2025-12-18.json"
        assert expected_file.exists()
        
        # Check content
        with open(expected_file) as f:
            data = json.load(f)
        assert len(data["movies"]) == 1
        assert data["movies"][0]["title"] == "Test Movie"
    
    def test_get_latest_snapshot(self, temp_data_dir):
        """Can retrieve latest snapshot."""
        repo = FileMovieRepository(temp_data_dir)
        
        # Save a snapshot
        movies = [Movie(id="1", title="Latest", cities=["JAKARTA"])]
        result = ScrapeResult(movies=movies, scraped_at="", date="2025-12-18")
        repo.save_snapshot(result)
        
        # Retrieve it
        latest = repo.get_latest_snapshot()
        assert latest is not None
        assert latest.movies[0].title == "Latest"
    
    def test_get_latest_no_files(self, temp_data_dir):
        """Returns None when no snapshots exist."""
        repo = FileMovieRepository(temp_data_dir)
        latest = repo.get_latest_snapshot()
        assert latest is None
    
    def test_get_snapshot_by_date(self, temp_data_dir):
        """Can retrieve snapshot by date."""
        repo = FileMovieRepository(temp_data_dir)
        
        # Save two snapshots
        for date in ["2025-12-17", "2025-12-18"]:
            movies = [Movie(id="1", title=f"Movie for {date}", cities=["JKT"])]
            result = ScrapeResult(movies=movies, scraped_at="", date=date)
            repo.save_snapshot(result)
        
        # Get specific date
        snapshot = repo.get_snapshot_by_date("2025-12-17")
        assert snapshot is not None
        assert "2025-12-17" in snapshot.movies[0].title
    
    def test_list_snapshots(self, temp_data_dir):
        """Can list all available snapshots."""
        repo = FileMovieRepository(temp_data_dir)
        
        # Save multiple snapshots
        for date in ["2025-12-15", "2025-12-16", "2025-12-17"]:
            movies = [Movie(id="1", title="Test", cities=["JKT"])]
            result = ScrapeResult(movies=movies, scraped_at="", date=date)
            repo.save_snapshot(result)
        
        dates = repo.list_snapshots()
        assert len(dates) == 3
        assert "2025-12-17" in dates
        assert "2025-12-15" in dates
