"""
CineRadar Test Suite - Domain Errors

Tests for custom exception hierarchy.
"""

import pytest

from backend.domain.errors import (
    CineRadarError,
    ScrapingError,
    LoginFailedError,
    TokenExpiredError,
    PageLoadError,
    RateLimitError,
    ValidationError,
    DataNotFoundError,
    IntegrityError,
    StorageError,
    FirestoreError,
    FileStorageError,
    ConfigurationError,
)


class TestErrorHierarchy:
    """Test that error hierarchy is correct."""
    
    def test_all_errors_inherit_from_base(self):
        """All custom errors should inherit from CineRadarError."""
        errors = [
            ScrapingError("test"),
            LoginFailedError("test"),
            TokenExpiredError("test"),
            ValidationError("test"),
            StorageError("test"),
            FirestoreError("test"),
        ]
        
        for err in errors:
            assert isinstance(err, CineRadarError)
    
    def test_scraping_errors_hierarchy(self):
        """Scraping errors should be catchable as ScrapingError."""
        errors = [
            LoginFailedError("test"),
            TokenExpiredError("test"),
            PageLoadError("test"),
            RateLimitError("test"),
        ]
        
        for err in errors:
            assert isinstance(err, ScrapingError)
            assert isinstance(err, CineRadarError)
    
    def test_storage_errors_hierarchy(self):
        """Storage errors should be catchable as StorageError."""
        errors = [
            FirestoreError("test"),
            FileStorageError("test"),
        ]
        
        for err in errors:
            assert isinstance(err, StorageError)
            assert isinstance(err, CineRadarError)


class TestErrorDetails:
    """Test that errors carry proper details."""
    
    def test_token_expired_error(self):
        err = TokenExpiredError("Token expired", expires_at="2025-01-01T00:00:00")
        assert err.expires_at == "2025-01-01T00:00:00"
        assert "expires_at" in err.details
        assert "2025-01-01" in str(err)
    
    def test_validation_error(self):
        err = ValidationError("Invalid value", field="email", value="bad@")
        assert err.field == "email"
        assert err.value == "bad@"
        assert "field" in err.details
    
    def test_data_not_found_error(self):
        err = DataNotFoundError(
            "Theatre not found",
            entity_type="Theatre",
            entity_id="123"
        )
        assert err.details["entity_type"] == "Theatre"
        assert err.details["entity_id"] == "123"
    
    def test_rate_limit_error(self):
        err = RateLimitError("Too many requests", retry_after=60)
        assert err.retry_after == 60
    
    def test_configuration_error(self):
        err = ConfigurationError("Missing env var", config_key="TIX_PASSWORD")
        assert err.config_key == "TIX_PASSWORD"


class TestErrorCatching:
    """Test that errors can be caught at various levels."""
    
    def test_catch_specific_error(self):
        """Can catch specific error type."""
        with pytest.raises(LoginFailedError):
            raise LoginFailedError("Bad password")
    
    def test_catch_parent_error(self):
        """Can catch parent error type."""
        with pytest.raises(ScrapingError):
            raise TokenExpiredError("Token expired")
    
    def test_catch_base_error(self):
        """Can catch base CineRadarError."""
        with pytest.raises(CineRadarError):
            raise FirestoreError("Connection failed")
    
    def test_error_message(self):
        """Error message is accessible."""
        err = CineRadarError("Something went wrong")
        assert str(err) == "Something went wrong"
    
    def test_error_with_details_string(self):
        """Error with details shows details in string."""
        err = CineRadarError("Error", details={"key": "value"})
        assert "key" in str(err)
        assert "value" in str(err)
