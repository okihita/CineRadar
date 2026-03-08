"""CineRadar Application Ports (Interfaces) 🔌.

Technical Explanation:
In Clean Architecture (and Hexagonal Architecture), "Ports" are the **Interfaces** that the Application Layer uses to communicate with the outside world (Infrastructure).

- **Dependency Inversion**: High-level modules (Application) should not depend on low-level modules (Infrastructure). Both should depend on abstractions (Ports).
- **The Contract**: A Port defines *what* needs to be done (e.g., `save_movie(movie: Movie)`), but not *how*.
- **The Adapter**: The Infrastructure layer implements these interfaces (e.g., `FirestoreMovieRepository` implements `IMovieRepository`).

This allows us to write and test our business logic without needing a running database or browser. We can simply mock the Port interface.
"""

from backend.application.ports.scraper import IMovieScraper, ISeatScraper
from backend.application.ports.storage import IMovieRepository, ITheatreRepository, ITokenRepository

__all__ = [
    "IMovieRepository",
    "IMovieScraper",
    "ISeatScraper",
    "ITheatreRepository",
    "ITokenRepository",
]
