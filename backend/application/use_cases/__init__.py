"""
CineRadar Use Cases (The Application) ⚙️

Technical Explanation:
**Use Cases** orchestrate the flow of data to achieve a specific user goal.

- **Orchestration**: They don't do the heavy lifting themselves; they tell the *Ports* what to do.
- **Business Logic**: They enforce rules like "You must have a valid token before scraping."
- **Dependency Rule**: They depend on the `domain` (for data structures) and `ports` (for interfaces), but never on concrete `infrastructure` classes.

Example: `ScrapeMoviesUseCase` says: "Scraper, get me movies. Repository, save them." It doesn't care *which* scraper or repository is used.
"""

from backend.application.use_cases.refresh_token import RefreshTokenUseCase
from backend.application.use_cases.scrape_movies import ScrapeMoviesUseCase
from backend.application.use_cases.scrape_seats import ScrapSeatsUseCase
from backend.application.use_cases.validate_data import ValidateDataUseCase

__all__ = [
    "RefreshTokenUseCase",
    "ScrapSeatsUseCase",
    "ScrapeMoviesUseCase",
    "ValidateDataUseCase",
]
