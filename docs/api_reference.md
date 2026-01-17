# API & Scraper Reference

This document covers the CLI usage, scraper pipelines, and API endpoints used by CineRadar.

## Scraper Pipelines

CineRadar uses a 3-scraper pipeline for TIX.id data collection.

| Scraper | Schedule | Login | Purpose |
|---------|----------|-------|---------|
| **Token Refresh** | Daily 5:50 AM WIB | Yes | Capture JWT for API auth |
| **Movie + Theatre** | Daily 6:00 AM WIB | No | Movies, showtimes, theatres |
| **JIT Seats** | Every 15 min | No* | Seat occupancy via API |

*Uses token from Token Refresh pipeline.

---

## Command Line Interface (CLI)

The backend is managed via a unified CLI.

### Movie Scraper

```bash
# Basic scrape (all 83 cities, no showtimes)
python -m scraper

# Include detailed showtimes (slower, ~45-75 min)
python -m scraper --schedules

# Scrape single city with showtimes
python -m scraper --city JAKARTA --schedules

# Show browser window (for debugging)
python -m scraper --visible

# Limit to first N cities (for testing)
python -m scraper --limit 5
```

### Token Refresh

```bash
# Refresh token (headless)
python -m backend.cli.refresh_token

# Refresh token (visible browser)
python -m backend.cli.refresh_token --visible

# Check token status
python -m backend.cli.refresh_token --check
```

### Seat Scraper (JIT)

```bash
# JIT mode (uses stored token)
python -m backend.cli.cli seats --mode jit --use-stored-token

# Manual mode (with login)
python -m backend.cli.cli seats --mode morning
```

### Validation Tools

```bash
# Validate today's movie data
python -m backend.cli.validate

# Validate specific file
python -m backend.cli.validate --file data/movies_2025-12-18.json

# Check token TTL (exit 1 if < 25 min remaining)
python -m backend.cli.refresh_token --check-min-ttl 25
```

### CLI Options Reference

| Option | Description |
|--------|-------------|
| `--schedules` | Fetch detailed theatre showtimes (~45-75 min for all cities) |
| `--city NAME` | Scrape specific city only (e.g., `JAKARTA`) |
| `--limit N` | Limit to first N cities (for testing) |
| `--visible` | Show browser window (default: headless) |
| `--output DIR` | Output directory (default: `data/`) |

---

## Environment Variables

| Variable | Description | Example |
|--------|-------------|---------|
| `TIX_PHONE_NUMBER` | TIX.id login phone | `+62XXXXXXXXXX` |
| `TIX_PASSWORD` | TIX.id login password | `<your_password>` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase credentials JSON | `{...}` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | `AIza...` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client API Key | `AIza...` |

---

## Seat Scraper Reference

### API Endpoint

```
GET https://api-b2b.tix.id/v1/movies/{merchant}/layout
    ?show_time_id={id}
    &tz=7
```
> ⚠️ Use `tz=7`, NOT `Asia/Jakarta`!

**Merchant Paths:**
- XXI: `xxi`
- CGV: `cgv`
- Cinépolis: `cinepolis`

### Data Codes

| Code | Status | Meaning |
|------|--------|---------|
| `1` | **Available** | Can be purchased |
| `5` | **Unavailable** | Sold or Blocked (cannot distinguish) |
| `6` | **Unavailable** | Sold or Blocked (cannot distinguish) |

> [!IMPORTANT]
> The API does not distinguish between "sold" and "under maintenance/blocked". Occupancy estimates should be treated as upper bounds.

---

## Data Contracts (Pydantic Schemas)

All data passing through the pipeline is validated using Pydantic V2 schemas.

| Schema | File | Purpose |
|--------|------|---------|
| `MovieSchema` | `backend/schemas/movie.py` | Complete movie with schedules |
| `DailySnapshotSchema` | `backend/schemas/movie.py` | Full daily scrape output |
| `TheatreSchema` | `backend/schemas/theatre.py` | Theatre for Firestore storage |
| `TokenSchema` | `backend/schemas/token.py` | JWT with TTL validation |
| `ScraperRunSchema` | `backend/schemas/scraper_run.py` | Scraper run logging |

**Integrity Assertions:**
- At least 10 movies expected per scrape.
- At least 50 cities expected (normally ~83).
