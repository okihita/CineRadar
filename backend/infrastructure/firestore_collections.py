"""Firestore collection name constants.

Centralized collection names for consistent database access.
All non-Cloud Function code should use these constants instead of string literals.

Collection Structure:
    theatres/                    # Theatre metadata (geocoded)
    ├── {theatre_id}

    schedules/                   # Daily movie schedules
    ├── {date}/
    │   └── movies/
    │       └── {movie_id}

    movie_performance/           # Seat occupancy tracking
    ├── {movie_id}/
    │   └── days/
    │       └── {date}/
    │           └── showtimes/
    │               └── {showtime_id}

    scraper_logs/               # Daily scraper monitoring
    ├── {date}/
    │   └── dispatches/
    │       └── {dispatch_slot}/
    │           ├── jobs/{showtime_id}
    │           └── errors/{error_id}

    snapshots/                  # Daily data snapshots
    ├── latest
    └── {date}/

    auth_tokens/                # Authentication tokens
    ├── tix_jwt
    └── refresh_lock
"""

# Root collections
THEATRES = "theatres"
SCHEDULES = "schedules"
SCHEDULES_V2 = "schedules_v2"  # V2 API-only scraper collection
MOVIE_PERFORMANCE = "movie_performance"
SCRAPER_LOGS = "scraper_logs"
SNAPSHOTS = "snapshots"
AUTH_TOKENS = "auth_tokens"

# Subcollection names (used within parent documents)
MOVIES = "movies"
DAYS = "days"
SHOWTIMES = "showtimes"
DISPATCHES = "dispatches"
JOBS = "jobs"
ERRORS = "errors"
