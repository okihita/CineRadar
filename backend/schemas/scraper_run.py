"""
Scraper Run Schema
Validates scraper run log entries for Firestore.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ScraperRunSchema(BaseModel):
    """Log entry for a scraper run.

    Stored in Firestore 'scraper_runs' collection for monitoring.

    Example:
        {
            "status": "success",
            "date": "2025-12-18",
            "movies": 30,
            "theatres_total": 200,
            "theatres_success": 198,
            "theatres_failed": 2,
            "cities": 83,
            "presales": 5
        }
    """

    status: Literal["success", "partial", "failed"] = Field(
        ..., description="success=all OK, partial=some failures, failed=critical error"
    )
    date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    movies: int = Field(ge=0, default=0)
    theatres_total: int = Field(ge=0, default=0)
    theatres_success: int = Field(ge=0, default=0)
    theatres_failed: int = Field(ge=0, default=0)
    cities: int = Field(ge=0, default=0)
    presales: int = Field(ge=0, default=0)
    error: str | None = Field(None, description="Error message if status is 'failed'")
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="ISO timestamp of when this run was logged",
    )

    def is_healthy(self) -> bool:
        """Check if the run was successful with reasonable data.

        Returns:
            True if status is 'success' and basic thresholds met
        """
        return self.status == "success" and self.movies >= 10 and self.cities >= 50
