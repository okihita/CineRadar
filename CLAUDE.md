# CLAUDE.md - CineRadar AI Context

## Project Overview
Cinema movie and seat availability tracker for Indonesian cinemas. Scrapes TIX.id for movie showtimes and seat occupancy data.

## Architecture
**Clean Architecture** with 3 layers:
```
backend/
├── domain/           # Pure Python dataclasses + errors
├── application/      # Use cases + ports (interfaces)
├── infrastructure/
│   ├── scrapers/     # Clean scraper implementations
│   ├── repositories/ # Firestore, file storage
│   ├── cli/          # CLI commands
│   └── _legacy/      # Legacy tix_client (don't modify)
├── cli/              # Main CLI entry points
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

## Linting Rules (ruff)
**Must pass before commit: `ruff check backend/`**

| Error | Fix |
|-------|-----|
| `W293` | No trailing whitespace on blank lines |
| `E722` | No bare `except:` - use `except Exception:` |
| `B007` | Unused loop vars must start with `_` (e.g., `_movie_id`) |
| `I001` | Imports must be sorted (run `ruff check --fix`) |
| `UP035` | Use `dict` not `typing.Dict` |
| `UP045` | Use `X | None` not `Optional[X]` |

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

## Current State (2025-12-19)
- Architecture: Clean Architecture ✅
- Tests: 67 passing ✅
- CI/CD: Comprehensive ✅
- Score: 10/10 ✅

## CI/CD Workflows
```bash
# Triggered on PR
pr-checks.yml        # Required for merge (lint + test + build)

# Triggered on push to main
ci.yml               # Backend lint/test/type-check
admin-ci.yml         # Frontend lint/type-check/build
smoke-tests.yml      # Production API tests

# Scheduled
daily-scrape.yml     # 6 AM WIB - Movies + seats
token-refresh.yml    # 5:50 AM WIB - JWT refresh
security-scan.yml    # Weekly CodeQL scan

# On failure
failure-reporter.yml # Auto-creates GitHub issues
```

## PR Requirements
PRs must pass `pr-checks.yml` which includes:
- `ruff check backend/` 
- `mypy backend/domain/`
- `pytest tests/ --cov-fail-under=70`
- `npm run build` in admin/

