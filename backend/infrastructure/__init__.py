"""CineRadar Infrastructure Layer (The Adapters) 🔌.

Technical Explanation:
The **Infrastructure Layer** contains the concrete implementations of the interfaces defined in `application/ports`.

- **The "How"**: This is where the actual code lives that talks to the database (Firestore) or the API.
- **Input Adapters**: Things that drive the app (e.g., CLI commands, Cloud Functions triggers).
- **Output Adapters**: Things the app drives (e.g., Repositories, Scrapers).

This layer depends on everything else. It imports `domain` models to wrap data and `application` ports to implement interfaces.
"""

# Re-export repositories for convenience
# Import scrapers directly: from backend.infrastructure.scrapers import TixMovieScraper
from backend.infrastructure.repositories import (
    FirestoreMovieRepository,
    FirestoreTheatreRepository,
    FirestoreTokenRepository,
)

__all__ = [
    # Repositories
    "FirestoreMovieRepository",
    "FirestoreTheatreRepository",
    "FirestoreTokenRepository",
]
