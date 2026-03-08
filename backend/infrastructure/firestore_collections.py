"""Firestore collection name constants.

Centralized collection names for consistent database access.
All non-Cloud Function code should use these constants instead of string literals.

Collection Structure:
    theatres/                    # Theatre metadata (geocoded)
    ├── {theatre_id}

    schedules/                   # V1: Daily movie schedules (uses schedule_id)
    ├── {date}/
    │   └── movies/
    │       └── {schedule_id}   # ⚠️ Changes when movie moves between cinema chains

    schedules_v2/                # V2: Daily movie schedules (uses metadata_id)
    ├── {date}/
    │   └── movies/
    │       └── {metadata_id}   # ✓ Immutable movie entity identifier
    │           └── schedule_ids: [...]  # List of associated schedule_ids

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
SCHEDULES_V2 = "schedules_v2"  # V2: Uses metadata_id as document ID
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
