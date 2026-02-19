# API & Scraper Reference

> Technical reference for CLI commands, API endpoints, and Data Contracts.

## 🛠 Scraper Pipelines

| Pipeline | Schedule | Login Required | Output |
|----------|----------|----------------|--------|
| **Token Refresh** | Daily 5:50 AM | Yes (Headless) | `auth_token` in Firestore |
| **Movie + Theatre** | Daily 6:00 AM | No | `snapshots/latest`, `schedules/*` |
| **JIT Seats** | Every 15 min | No* | `seat_snapshots/*` |

*Uses valid token stored by Token Refresh pipeline.

---

## 💻 Command Line Interface (CLI)

The backend is managed via a unified CLI.

### Movie Scraper
**Entry Point:** [`backend/cli/cli.py`](../backend/cli/cli.py)

```bash
# Basic scrape (all 83 cities, no showtimes)
uv run python -m backend.cli

# Include detailed showtimes (slower, ~45-75 min)
uv run python -m backend.cli --schedules

# Scrape single city with showtimes
uv run python -m backend.cli --city JAKARTA --schedules

# Show browser window (for debugging)
uv run python -m backend.cli --visible
```

### Inspect Showtime (Raw API Response)
**Entry Point:** [`backend/cli/inspect_showtime.py`](../backend/cli/inspect_showtime.py)

```bash
# Inspect a specific showtime's raw API response
python backend/cli/inspect_showtime.py \
  --showtime-id <SHOWTIME_ID> \
  --movie-id <MOVIE_ID> \
  --date YYYY-MM-DD

# Show full JSON output
python backend/cli/inspect_showtime.py \
  --showtime-id <SHOWTIME_ID> \
  --movie-id <MOVIE_ID> \
  --date YYYY-MM-DD \
  --verbose
```

### Token Refresh
**Entry Point:** [`backend/cli/refresh_token.py`](../backend/cli/refresh_token.py)

```bash
# Refresh token (headless)
uv run python -m backend.cli.refresh_token

# Check token status
uv run python -m backend.cli.refresh_token --check
```

---

## 💺 Seat Scraper Reference

### API Endpoint

```http
GET https://api-b2b.tix.id/v1/movies/{merchant}/layout
    ?show_time_id={id}
    &tz=7
Authorization: Bearer {JWT_TOKEN}
```

### Response Example

```json
{
  "code": 1000,
  "data": {
    "site_codes": [
      {
        "row": "A",
        "column": "1",
        "status": {
          "code": "1" // Available
        }
      },
      {
        "row": "E",
        "column": "5",
        "status": {
          "code": "5" // Sold/Reserved
        }
      }
    ]
  }
}
```

### Data Codes

| Code | Status | Meaning |
|------|--------|---------|
| `1` | **Available** | Can be purchased |
| `5` | **Unavailable** | Sold or Blocked (cannot distinguish) |
| `6` | **Unavailable** | Sold or Blocked (cannot distinguish) |

> 🚨 **Important**
> The API does not distinguish between "sold" and "under maintenance/blocked". Occupancy estimates should be treated as **maximum upper bounds**.

---

## 🌐 Admin API Reference

### Raw Showtime Data

**Entry Point:** `admin/src/app/api/showtimes/[showtimeId]/raw/route.ts`

**Purpose:** Retrieve raw TIX.id API response for debugging and audit.

**Endpoint:**
```http
GET /api/showtimes/{showtimeId}/raw?movieId={movieId}&date={YYYY-MM-DD}
```

**Response Example:**
```json
{
  "showtimeId": "2014057575301070848",
  "movieTitle": "PRIMATE",
  "theatreName": "AGORA MALL XXI",
  "city": "JAKARTA",
  "roomCategory": "2D",
  "merchant": "XXI",
  "showtime": "20:30",
  "date": "2026-01-22",
  "occupancyPct": 16.3,
  "totalSeats": 135,
  "soldSeats": 22,
  "scrapedAt": "2026-01-22T20:23:45+07:00",
  "rawApiResponse": {
    "success": true,
    "data": {
      "user_seat_purchased": 0,
      "user_seat_daily_limit": 10,
      "max_horizontal_seat": 15,
      "max_vertical_seat": 9,
      "seat_rule_config": { ... },
      "seat_rules": { ... },
      "price": 45000,
      "seat_map": [ ... ]
    }
  }
}
```

**Error Responses:**
| Status | Error |
|--------|--------|
| 400 | `movieId` and `date` query parameters required |
| 404 | Showtime not found in Firestore |

---

## 📜 Data Contracts (Pydantic Schemas)

All data passing through the pipeline is validated using Pydantic V2 schemas.

| Schema | Source File | Purpose |
|--------|-------------|---------|
| **MovieSchema** | [`backend/schemas/movie.py`](../backend/schemas/movie.py) | Complete movie object with optional schedules |
| **TheatreSchema** | [`backend/schemas/theatre.py`](../backend/schemas/theatre.py) | Geocoded theatre location data |
| **TokenSchema** | [`backend/schemas/token.py`](../backend/schemas/token.py) | JWT payload structure and TTL validation |
| **MovieDetailsResponseSchema** | [`backend/schemas/movie_details.py`](../backend/schemas/movie_details.py) | Movie details (cast, synopsis, ratings) |

### Quick Import Snippet
For testing in `ipython` or scripts:

```python
from backend.schemas.movie import MovieSchema
from backend.schemas.token import TokenSchema

# Validate a raw dictionary
movie = MovieSchema.model_validate(raw_data)
```
