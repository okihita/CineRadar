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
│   ├── scrapers/     # Clean scraper wrappers
│   ├── repositories/ # Firestore, file storage, utilities
│   └── core/         # Core scrapers (tix_client, seat_scraper)
├── cli/              # All CLI entry points
└── schemas/          # Pydantic validation
```

## Quick Commands
```bash
# Run tests (74 total)
pytest tests/ -v

# Lint
ruff check backend/

# Type check
mypy backend/domain/
```

## Code Principles
1. **Never catch bare `except`** - Use `except Exception:` minimum
2. **Use domain objects** - Movie, Theatre, Token - not raw dicts
3. **Type hints required** - All public functions
4. **Use `X | None`** - Not `Optional[X]`

## CI/CD Workflows (8 total)
```bash
# On push to main
ci.yml               # Backend + Frontend checks (unified)
admin-ci.yml         # Admin-specific checks
smoke-tests.yml      # Production API tests

# Scheduled
daily-scrape.yml     # 6 AM WIB - Movies + seats
token-refresh.yml    # Every 60 days - Full browser login

# Support
security-scan.yml    # Weekly CodeQL scan
failure-reporter.yml # Auto-creates GitHub issues
monthly-geocode.yml  # Theatre geocoding
```

## Token Management
- **Access Token**: 30-min TTL, stored in Firestore `auth_tokens/tix_jwt`
- **Refresh Token**: 91-day TTL, used for API refresh
- **Hybrid refresh**: API-first, GHA browser login fallback

## Before Committing
1. `pytest tests/ -q` → Must pass
2. `ruff check backend/` → Must be clean
