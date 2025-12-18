"""
CineRadar Test Suite - Use Cases

Tests for application use cases with mocked dependencies.
"""

import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

from backend.domain.models import Movie, ScrapeResult
from backend.application.use_cases.validate_data import ValidateDataUseCase, ValidationResult


class TestValidateDataUseCase:
    """Tests for ValidateDataUseCase."""
    
    def test_validate_result_success(self):
        """Valid data passes validation."""
        movies = [
            Movie(id=str(i), title=f"Movie {i}", cities=[f"CITY{i}"])
            for i in range(15)
        ]
        
        all_cities = set()
        for m in movies:
            all_cities.update(m.cities)
        
        result = ScrapeResult(
            movies=movies,
            scraped_at="2025-12-18",
            date="2025-12-18",
            cities_scraped=len(all_cities),
        )
        
        use_case = ValidateDataUseCase(min_movies=10, min_cities=5)
        validation = use_case.validate_result(result)
        
        assert validation.valid == True
        assert validation.movies == 15
        assert len(validation.errors) == 0
    
    def test_validate_result_too_few_movies(self):
        """Fails if too few movies."""
        movies = [Movie(id="1", title="Only One", cities=["JAKARTA"])]
        result = ScrapeResult(movies=movies, scraped_at="", date="")
        
        use_case = ValidateDataUseCase(min_movies=10, min_cities=1)
        validation = use_case.validate_result(result)
        
        assert validation.valid == False
        assert any("Too few movies" in e for e in validation.errors)
    
    def test_validate_result_too_few_cities(self):
        """Fails if too few cities."""
        movies = [
            Movie(id=str(i), title=f"M{i}", cities=["JAKARTA"])
            for i in range(20)
        ]
        result = ScrapeResult(movies=movies, scraped_at="", date="")
        
        use_case = ValidateDataUseCase(min_movies=10, min_cities=50)
        validation = use_case.validate_result(result)
        
        assert validation.valid == False
        assert any("Too few cities" in e for e in validation.errors)
    
    def test_validate_file_not_found(self):
        """Returns error for missing file."""
        use_case = ValidateDataUseCase()
        validation = use_case.validate_file("/nonexistent/file.json")
        
        assert validation.valid == False
        assert any("not found" in e.lower() for e in validation.errors)
    
    def test_validate_file_invalid_json(self):
        """Returns error for invalid JSON."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write("not valid json {{{")
            temp_path = f.name
        
        try:
            use_case = ValidateDataUseCase()
            validation = use_case.validate_file(temp_path)
            
            assert validation.valid == False
            assert any("json" in e.lower() for e in validation.errors)
        finally:
            Path(temp_path).unlink()
    
    def test_validate_file_success(self):
        """Validates a proper JSON file."""
        data = {
            "scraped_at": "2025-12-18T00:00:00",
            "date": "2025-12-18",
            "movies": [
                {"id": str(i), "title": f"Movie {i}", "cities": [f"CITY{i}"]}
                for i in range(15)
            ],
            "city_stats": {f"CITY{i}": 1 for i in range(15)},
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(data, f)
            temp_path = f.name
        
        try:
            use_case = ValidateDataUseCase(min_movies=10, min_cities=10)
            validation = use_case.validate_file(temp_path)
            
            assert validation.movies == 15
        finally:
            Path(temp_path).unlink()


class TestValidationResult:
    """Tests for ValidationResult dataclass."""
    
    def test_has_errors(self):
        result = ValidationResult(
            valid=False,
            movies=5,
            cities=3,
            errors=["Too few movies"],
            warnings=[],
        )
        assert result.has_errors == True
        assert result.has_warnings == False
    
    def test_has_warnings(self):
        result = ValidationResult(
            valid=True,
            movies=20,
            cities=50,
            errors=[],
            warnings=["Some movies have no schedules"],
        )
        assert result.has_errors == False
        assert result.has_warnings == True
