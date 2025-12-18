"""
Validate Data Use Case

Validates scraped data before storage or upload.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from backend.domain.models import Movie, ScrapeResult


@dataclass
class ValidationResult:
    """Result of data validation."""
    valid: bool
    movies: int
    cities: int
    errors: list[str]
    warnings: list[str]

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0


class ValidateDataUseCase:
    """Use case: Validate scraped movie data.

    Performs schema validation and integrity checks.

    Example:
        use_case = ValidateDataUseCase()
        result = use_case.validate_file("data/movies_2025-12-18.json")

        if not result.valid:
            for error in result.errors:
                print(f"Error: {error}")
    """

    # Minimum thresholds for integrity checks
    MIN_MOVIES = 10
    MIN_CITIES = 50

    def __init__(
        self,
        min_movies: int = None,
        min_cities: int = None,
    ):
        """Initialize with optional custom thresholds.

        Args:
            min_movies: Minimum movies expected
            min_cities: Minimum cities expected
        """
        self.min_movies = min_movies or self.MIN_MOVIES
        self.min_cities = min_cities or self.MIN_CITIES

    def validate_result(self, result: ScrapeResult) -> ValidationResult:
        """Validate a ScrapeResult object.

        Args:
            result: ScrapeResult to validate

        Returns:
            ValidationResult with errors/warnings
        """
        errors = []
        warnings = []

        # Count movies
        movie_count = len(result.movies)

        # Count unique cities
        all_cities = set()
        for movie in result.movies:
            all_cities.update(movie.cities)
        city_count = len(all_cities)

        # Integrity checks
        if movie_count < self.min_movies:
            errors.append(f"Too few movies: {movie_count} < {self.min_movies}")

        if city_count < self.min_cities:
            errors.append(f"Too few cities: {city_count} < {self.min_cities}")

        # Data quality checks
        movies_without_schedules = sum(
            1 for m in result.movies
            if not m.schedules
        )
        if movies_without_schedules > movie_count * 0.5:
            warnings.append(f"{movies_without_schedules}/{movie_count} movies have no schedules")

        # Check for required fields
        for i, movie in enumerate(result.movies):
            if not movie.id:
                errors.append(f"Movie at index {i} has no ID")
            if not movie.title:
                errors.append(f"Movie at index {i} has no title")

        return ValidationResult(
            valid=len(errors) == 0,
            movies=movie_count,
            cities=city_count,
            errors=errors,
            warnings=warnings,
        )

    def validate_file(self, file_path: str) -> ValidationResult:
        """Validate a movie data JSON file.

        Args:
            file_path: Path to JSON file

        Returns:
            ValidationResult with errors/warnings
        """
        path = Path(file_path)

        if not path.exists():
            return ValidationResult(
                valid=False,
                movies=0,
                cities=0,
                errors=[f"File not found: {file_path}"],
                warnings=[],
            )

        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            return ValidationResult(
                valid=False,
                movies=0,
                cities=0,
                errors=[f"Invalid JSON: {e}"],
                warnings=[],
            )

        # Try Pydantic validation first
        errors = []
        warnings = []

        try:
            from pydantic import ValidationError as PydanticValidationError

            from backend.schemas.movie import DailySnapshotSchema

            DailySnapshotSchema.model_validate(data)

            # Convert Pydantic model back to our domain object
            movies = [Movie.from_dict(m) for m in data.get('movies', [])]

            result = ScrapeResult(
                movies=movies,
                scraped_at=data.get('scraped_at', ''),
                date=data.get('date', ''),
                cities_scraped=len(data.get('city_stats', {})),
            )

            return self.validate_result(result)

        except PydanticValidationError as e:
            for err in e.errors():
                loc = ' → '.join(str(x) for x in err['loc'])
                errors.append(f"Schema error at {loc}: {err['msg']}")

            # Still count what we can
            movies = data.get('movies', [])
            cities = set()
            for m in movies:
                cities.update(m.get('cities', []))

            return ValidationResult(
                valid=False,
                movies=len(movies),
                cities=len(cities),
                errors=errors[:10],  # Limit errors shown
                warnings=[f"... and {len(errors) - 10} more errors"] if len(errors) > 10 else [],
            )

        except ImportError:
            # Pydantic not available, do basic validation
            warnings.append("Pydantic not available, using basic validation")

            movies = data.get('movies', [])
            cities = data.get('city_stats', {})

            if len(movies) < self.min_movies:
                errors.append(f"Too few movies: {len(movies)} < {self.min_movies}")

            if len(cities) < self.min_cities:
                errors.append(f"Too few cities: {len(cities)} < {self.min_cities}")

            return ValidationResult(
                valid=len(errors) == 0,
                movies=len(movies),
                cities=len(cities),
                errors=errors,
                warnings=warnings,
            )
