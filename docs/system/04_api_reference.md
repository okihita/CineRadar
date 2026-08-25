# API & Scraper Reference

> Technical reference for CLI commands, API endpoints, and Data Contracts.

## 🛠 Scraper Pipelines

| Pipeline | Schedule | Login Required | Output |
|----------|----------|----------------|--------|
| **Token Refresh** | Monthly / Dynamic JIT | Yes (RSA / API) | `auth_tokens/tix_jwt` in Firestore |
| **Movie + Schedules** | Daily 05:30 & 09:00 WIB | No | `schedules_v2/{date}/movies/*`, `theatres/*` |
| **JIT Seats** | Every 5-10 min (T-30,20,10) | Yes (Token) | `movie_performance_v2/{metadataId}/days/{date}/showtimes/*` |
| **CinePoint Box Office** | Daily Morning / Backfill | Yes (CinePoint Bearer) | `cinepoint_daily_boxoffice/*`, `cinepoint_movies/*` |

---

## 💻 Command Line Interface (CLI)

The backend is managed via Python CLI tools in `backend/` and `admin/scripts/`.

### Nationwide Movie Scraper
**Entry Point:** [`backend/scripts/run_national_scrape.py`](../../backend/scripts/run_national_scrape.py)

```bash
# Full nationwide scrape (all 83 cities)
uv run python backend/scripts/run_national_scrape.py

# Post-processing rollup & theatre indexing
uv run python backend/scripts/post_process.py
```

### Token Refresh & Auth Check
**Entry Point:** [`backend/cli/refresh_token.py`](../../backend/cli/refresh_token.py)

```bash
# Refresh token via RSA login
uv run python backend/cli/refresh_token.py

# Check current JWT token validity
uv run python backend/cli/refresh_token.py --check
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
| **MovieSchema** | [`backend/schemas/movie.py`](../../backend/schemas/movie.py) | Complete movie object with optional schedules |
| **TheatreSchema** | [`backend/schemas/theatre.py`](../../backend/schemas/theatre.py) | Geocoded theatre location data |
| **TokenSchema** | [`backend/schemas/token.py`](../../backend/schemas/token.py) | JWT payload structure and TTL validation |
| **MovieDetailsResponseSchema** | [`backend/schemas/movie_details.py`](../../backend/schemas/movie_details.py) | Movie details (cast, synopsis, ratings) |

### Quick Import Snippet
For testing in `ipython` or scripts:

```python
from backend.schemas.movie import MovieSchema
from backend.schemas.token import TokenSchema

# Validate a raw dictionary
movie = MovieSchema.model_validate(raw_data)
```
