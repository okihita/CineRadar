"""CineRadar Use Cases (The Application) ⚙️.

Technical Explanation:
**Use Cases** orchestrate the flow of data to achieve a specific user goal.

- **Orchestration**: They don't do the heavy lifting themselves; they tell the *Ports* what to do.
- **Business Logic**: They enforce rules like "You must have a valid token before scraping."
- **Dependency Rule**: They depend on the `domain` (for data structures) and `ports` (for interfaces), but never on concrete `infrastructure` classes.

Note: Most scraping workflows use CLI commands directly (backend/cli/commands/) instead of UseCases.
"""

from backend.application.use_cases.scrape_movie_details import ScrapeMovieDetailsUseCase

__all__ = [
    "ScrapeMovieDetailsUseCase",
]
