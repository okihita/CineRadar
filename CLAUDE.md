# CLAUDE.md - CineRadar AI Context

## Project Overview
Cinema movie and seat availability tracker for Indonesian cinemas. Scrapes TIX.id for movie showtimes and seat occupancy data.

## Architecture
**Clean Architecture** with 3 layers:
```
backend/
├── domain/           # Pure Python dataclasses + errors
├── application/      # Use cases + ports (interfaces)
├── infrastructure/   # Scrapers, repositories, CLI
└── schemas/          # Pydantic validation
```

## Quick Commands
```bash
# Run tests (67 total)
pytest tests/ -v

# Lint
ruff check backend/

# Type check
mypy backend/domain/

# Validate data file
python -m backend.infrastructure.cli validate --file data/movies_YYYY-MM-DD.json

# Run local scrape
python -m backend.infrastructure.cli movies --city JAKARTA --schedules --local
```

## Code Principles
1. **Never catch bare `except Exception`** - Use domain errors
2. **Use domain objects** - Movie, Theatre, Token - not raw dicts
3. **Type hints required** - All public functions
4. **Tests mirror structure** - `tests/test_domain_models.py` for `domain/models/`

## Domain Errors
```python
from backend.domain.errors import (
    CineRadarError,        # Base class
    ScrapingError,         # Scraping failures
    LoginFailedError,      # TIX.id auth failed
    TokenExpiredError,     # JWT expired
    ValidationError,       # Data validation
    FirestoreError,        # Firestore issues
)
```

## Testing Requirements
- Domain layer: Unit tests, no mocks needed
- Application layer: Mock ports (IMovieScraper, ITokenRepository)
- Infrastructure: Integration tests with mocked Firestore

## Before Committing
1. `pytest tests/ -q` → Must pass
2. `ruff check backend/` → Must be clean
3. Update `CHANGELOG.md` if adding features

## Current State (2025-12-18)
- Architecture: Clean Architecture ✅
- Tests: 67 passing ✅
- Score: 10/10 ✅
