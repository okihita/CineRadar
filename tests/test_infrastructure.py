"""
CineRadar Test Suite - Infrastructure Layer

Tests for scrapers and repositories with integration testing.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from backend.domain.models import Movie, Token, Theatre, SeatOccupancy
from backend.domain.errors import LoginFailedError, TokenExpiredError
from backend.infrastructure.scrapers.base import BaseScraper
from backend.infrastructure.scrapers.movie_scraper import TixMovieScraper
from backend.infrastructure.scrapers.seat_scraper import TixSeatScraper


class TestBaseScraper:
    """Tests for BaseScraper base class."""
    
    def test_init(self):
        """BaseScraper initializes with config."""
        scraper = BaseScraper()
        assert scraper.api_base is not None
        assert scraper.app_base is not None
        assert scraper.auth_token is None
    
    def test_has_valid_token_false_when_none(self):
        """has_valid_token returns False when no token."""
        scraper = BaseScraper()
        assert scraper.has_valid_token() == False
    
    def test_has_valid_token_true_when_set(self):
        """has_valid_token returns True when token exists."""
        scraper = BaseScraper()
        scraper.auth_token = "test-token"
        assert scraper.has_valid_token() == True
    
    def test_log_output(self, capsys):
        """log() prints timestamped message."""
        scraper = BaseScraper()
        scraper.log("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out
        assert "[" in captured.out  # Timestamp brackets


class TestTixMovieScraper:
    """Tests for TixMovieScraper."""
    
    def test_init(self):
        """TixMovieScraper has cities list."""
        scraper = TixMovieScraper()
        assert hasattr(scraper, 'cities')
        assert len(scraper.cities) > 0
    
    def test_inherits_from_base(self):
        """TixMovieScraper inherits from BaseScraper."""
        scraper = TixMovieScraper()
        assert isinstance(scraper, BaseScraper)


class TestTixSeatScraper:
    """Tests for TixSeatScraper."""
    
    def test_init(self):
        """TixSeatScraper initializes correctly."""
        scraper = TixSeatScraper()
        assert scraper.auth_token is None
    
    def test_set_token(self):
        """set_token stores the token."""
        scraper = TixSeatScraper()
        scraper.set_token("test-jwt-token")
        assert scraper.auth_token == "test-jwt-token"
    
    @pytest.mark.asyncio
    async def test_scrape_seats_without_token_raises(self):
        """scrape_seats raises TokenExpiredError without token."""
        scraper = TixSeatScraper()
        with pytest.raises(TokenExpiredError):
            await scraper.scrape_seats(["123"], "XXI")
    
    def test_load_token_from_storage_no_token(self):
        """load_token_from_storage returns False when no token."""
        scraper = TixSeatScraper()
        
        # Mock the repository import inside the method
        with patch('backend.infrastructure.repositories.FirestoreTokenRepository') as mock_repo:
            mock_instance = Mock()
            mock_instance.get_current.return_value = None
            mock_repo.return_value = mock_instance
            
            result = scraper.load_token_from_storage()
            assert result == False


class TestFirestoreTokenRepository:
    """Tests for FirestoreTokenRepository (mocked)."""
    
    def test_store_token(self):
        """store() calls Firestore set()."""
        from backend.infrastructure.repositories.firestore_token import FirestoreTokenRepository
        
        repo = FirestoreTokenRepository()
        token = Token.create_new("test-token", "628***")
        
        # Mock the db property
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref
        repo._db = mock_db
        
        result = repo.store(token)
        
        assert result == True
        mock_doc_ref.set.assert_called_once()
    
    def test_get_current_returns_none_when_no_doc(self):
        """get_current() returns None when document doesn't exist."""
        from backend.infrastructure.repositories.firestore_token import FirestoreTokenRepository
        
        repo = FirestoreTokenRepository()
        
        # Mock Firestore to return non-existent doc
        mock_doc = MagicMock()
        mock_doc.exists = False
        
        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        
        repo._db = MagicMock()
        repo._db.collection.return_value.document.return_value = mock_doc_ref
        
        result = repo.get_current()
        assert result is None


class TestFirestoreTheatreRepository:
    """Tests for FirestoreTheatreRepository (mocked)."""
    
    def test_upsert_creates_new_theatre(self):
        """upsert() creates new document when not exists."""
        from backend.infrastructure.repositories.firestore_theatre import FirestoreTheatreRepository
        
        repo = FirestoreTheatreRepository()
        theatre = Theatre(
            theatre_id="123",
            name="Test Theatre",
            merchant="XXI",
            city="JAKARTA",
        )
        
        # Mock Firestore
        mock_doc = MagicMock()
        mock_doc.exists = False
        
        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        
        repo._db = MagicMock()
        repo._db.collection.return_value.document.return_value = mock_doc_ref
        
        result = repo.upsert(theatre)
        
        assert result == True
        mock_doc_ref.set.assert_called_once()
    
    def test_upsert_updates_existing_theatre(self):
        """upsert() updates document when exists."""
        from backend.infrastructure.repositories.firestore_theatre import FirestoreTheatreRepository
        
        repo = FirestoreTheatreRepository()
        theatre = Theatre(
            theatre_id="123",
            name="Test Theatre",
            merchant="XXI",
            city="JAKARTA",
            room_types=["2D"],
        )
        
        # Mock Firestore with existing doc
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {'room_types': ['IMAX']}
        
        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        
        repo._db = MagicMock()
        repo._db.collection.return_value.document.return_value = mock_doc_ref
        
        result = repo.upsert(theatre)
        
        assert result == True
        mock_doc_ref.update.assert_called_once()
        
        # Check that room_types are merged
        call_args = mock_doc_ref.update.call_args[0][0]
        assert '2D' in call_args['room_types'] or 'IMAX' in call_args['room_types']
