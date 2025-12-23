"""Tests for the upload_schedules CLI command."""

import json
from unittest.mock import MagicMock, patch
from pathlib import Path
import pytest

from backend.cli.upload_schedules import load_movie_data, transform_for_firestore


class TestLoadMovieData:
    """Tests for load_movie_data function."""

    def test_load_valid_json(self, tmp_path: Path):
        """Should load and parse valid JSON file."""
        data = {
            "date": "2025-12-23",
            "movies": [
                {"id": "123", "title": "Test Movie", "schedules": {}}
            ]
        }
        json_file = tmp_path / "movies_2025-12-23.json"
        json_file.write_text(json.dumps(data))

        result = load_movie_data(str(tmp_path))

        assert result is not None
        assert result["date"] == "2025-12-23"
        assert len(result["movies"]) == 1

    def test_no_json_files(self, tmp_path: Path):
        """Should return None when no JSON files exist."""
        result = load_movie_data(str(tmp_path))
        assert result is None

    def test_loads_most_recent_file(self, tmp_path: Path):
        """Should load the most recently modified JSON file."""
        import time
        
        # Create older file
        old_file = tmp_path / "movies_2025-12-22.json"
        old_file.write_text(json.dumps({"date": "2025-12-22", "movies": []}))
        
        # Ensure at least 0.1 second difference in mtime
        time.sleep(0.1)

        # Create newer file
        new_file = tmp_path / "movies_2025-12-23.json"
        new_file.write_text(json.dumps({"date": "2025-12-23", "movies": []}))

        result = load_movie_data(str(tmp_path))

        # Should load the newest file
        assert result is not None
        assert result["date"] == "2025-12-23"


class TestTransformForFirestore:
    """Tests for transform_for_firestore function."""

    def test_transform_movie_with_schedules(self):
        """Should correctly transform movie data for Firestore."""
        movie = {
            "id": "123456",
            "title": "Avatar: Fire and Ash",
            "schedules": {
                "JAKARTA": [
                    {
                        "theatre_id": "th001",
                        "theatre_name": "Grand Indonesia XXI",
                        "merchant": "XXI",
                        "address": "Jl. MH Thamrin",
                        "rooms": [
                            {
                                "category": "2D",
                                "price": "Rp50.000",
                                "showtimes": ["12:45", "15:30", "18:15"]
                            }
                        ]
                    }
                ]
            }
        }
        date = "2025-12-23"

        result = transform_for_firestore(movie, date)

        assert result["movie_id"] == "123456"
        assert result["title"] == "Avatar: Fire and Ash"
        assert result["date"] == "2025-12-23"
        assert "JAKARTA" in result["cities"]
        assert len(result["cities"]["JAKARTA"]) == 1
        assert result["cities"]["JAKARTA"][0]["theatre_name"] == "Grand Indonesia XXI"

    def test_transform_movie_no_schedules(self):
        """Should handle movie without schedules."""
        movie = {
            "id": "999",
            "title": "No Schedule Movie",
            "schedules": {}
        }

        result = transform_for_firestore(movie, "2025-12-23")

        assert result["movie_id"] == "999"
        assert result["cities"] == {}

    def test_transform_preserves_all_cities(self):
        """Should preserve schedules for all cities."""
        movie = {
            "id": "123",
            "title": "Multi City Movie",
            "schedules": {
                "JAKARTA": [{"theatre_id": "1"}],
                "SURABAYA": [{"theatre_id": "2"}],
                "BANDUNG": [{"theatre_id": "3"}],
            }
        }

        result = transform_for_firestore(movie, "2025-12-23")

        assert len(result["cities"]) == 3
        assert "JAKARTA" in result["cities"]
        assert "SURABAYA" in result["cities"]
        assert "BANDUNG" in result["cities"]


class TestUploadToFirestore:
    """Tests for Firestore upload functionality."""

    @patch("backend.cli.upload_schedules.get_firestore_client")
    def test_upload_creates_documents(self, mock_get_client):
        """Should create document for each movie."""
        from backend.cli.upload_schedules import upload_schedules_to_firestore

        mock_db = MagicMock()
        mock_get_client.return_value = mock_db
        mock_collection = MagicMock()
        mock_doc = MagicMock()
        mock_movies = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_doc
        mock_doc.collection.return_value = mock_movies
        mock_movies.document.return_value = mock_doc

        movies = [
            {"id": "123", "title": "Test", "schedules": {"JAKARTA": []}}
        ]

        upload_schedules_to_firestore(movies, "2025-12-23")

        # Verify Firestore was called
        mock_db.collection.assert_called_with("schedules")
        mock_doc.set.assert_called()
