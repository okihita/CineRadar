# CineRadar Scraper Specifications

## Overview

3-scraper pipeline for TIX.id movie data collection.

| Scraper | Schedule | Login | Purpose |
|---------|----------|-------|---------|
| Token Refresh | Daily 5:50 AM WIB | Yes | Capture JWT for API auth |
| Movie + Theatre | Daily 6:00 AM WIB | No | Movies, showtimes, theatres |
| JIT Seats | Every 15 min | No* | Seat occupancy via API |

*Uses token from Token Refresh

## Default Behavior

> [!IMPORTANT]
> **Every morning at 6:00 AM WIB**, the scraper automatically runs to get fresh movie showtimes for all cities in Indonesia.

### Daily Pipeline (Automatic)

```
5:50 AM WIB  → Token Refresh (login, capture JWT)
6:00 AM WIB  → Movie + Theatre Scrape (9 parallel batches)
                ├── Scrape ~90 cities
                ├── Get all movies and showtimes
                ├── Merge results
                └── Upload to Firestore (snapshots/latest)
```

### Data Flow

```
TIX.id Website → Scraper (GitHub Actions) → Firestore → 
  ├── Admin Dashboard (admin.cineradar-id.vercel.app)
  └── Public Website (cineradar-id.vercel.app)
```

### No Manual Intervention Required
- Scraper runs automatically via GitHub Actions schedule
- Data is stored in Firestore (no static files in repo)
- Website fetches from Firestore REST API with 5-min cache

### Time Display Convention

> [!IMPORTANT]
> **Database/Backend**: All timestamps stored as UTC/GMT  
> **Web/Admin Apps**: All times displayed as WIB (Jakarta time, UTC+7)

| Layer | Timezone | Example |
|-------|----------|---------|
| Firestore | UTC | `2025-12-18T00:15:08.000Z` |
| Backend/Scraper | UTC | `datetime.utcnow()` |
| Admin Dashboard | WIB | `Dec 18, 7:15 AM WIB` |
| Public Website | WIB | `Dec 18, 7:15 AM WIB` |

**Implementation:**
- Admin: Use `formatWIB()` from `@/lib/timeUtils.ts`
- Web: Use `formatWIB()` function with `timeZone: 'Asia/Jakarta'`

### Admin Dashboard Navigation

| Page | URL | Purpose |
|------|-----|---------|
| Executive Dashboard | `/` | Overview & KPIs |
| Cinema Intelligence | `/cinemas` | Theatre locations & mapping |
| Movie Intelligence | `/movies` | Showtimes & schedules |
| **Scraper Monitor** | `/scraper` | Run history & data collection status |
| Advanced Analytics | `/analytics` | Predictions & scenarios |

> [!NOTE]
> The **Scraper Monitor** is a dedicated page for tracking data collection runs.
> It shows run history, success rates, and schedule information.

---

## Scraper 1: Token Refresh

### Purpose
Login to TIX.id and capture JWT token for authenticated API calls.

### Endpoints
| Type | URL |
|------|-----|
| Web App Base | `https://app.tix.id` |
| Login Page | `https://app.tix.id/login` |

### Credentials (from `.env`)
```
TIX_PHONE_NUMBER=+62XXXXXXXXXX
TIX_PASSWORD=<your_password>
```

### Login Flow

> [!CAUTION]
> TIX.id has **TWO Login buttons** on the login page:
> - **Header button** (top) - Navigates back to home, does NOT login!
> - **Form button** (below password) - Actually calls the login API
> 
> Use `.last` or element index 5 for Playwright, NOT `.first`!

1. Navigate to `https://app.tix.id/login`
2. Wait for page load (Flutter app, may take 5-15 seconds)
3. Find input fields (Flutter renders canvas, use `get_by_placeholder`)
4. Fill phone number (strip `+62` prefix, type via keyboard)
5. Fill password (type via keyboard)
6. Click **LAST** "Login" button (`.last`, NOT `.first`) or press Enter
7. Wait for redirect (success = `/home` or URL with `login-success`)
8. Extract tokens from localStorage:
   - `authentication_token` - Access token (valid ~30 min)
   - `authentication_refresh_token` - Refresh token (valid ~91 days)

### Token Storage
- **Location**: Firestore collection `auth_tokens`, document `tix_jwt`
- **Fields**:
  - `token`: JWT string
  - `stored_at`: ISO timestamp
  - `expires_at`: ISO timestamp (TTL ~20 hours)
  - `phone`: Phone number used (masked)

### Success Criteria
- [ ] JWT token captured from localStorage
- [ ] Token stored in Firestore
- [ ] Token can authenticate API calls

### Error Handling
| Error | Action |
|-------|--------|
| Login page not loading | Retry 3 times with 5s delay |
| Input fields not found | Try placeholder text approach |
| Login failed (still on /login) | Log error, exit with code 1 |
| Token storage failed | Log error, exit with code 1 |

### CLI Usage
```bash
# Refresh token (headless)
python -m backend.scrapers.refresh_token

# Refresh token (visible browser)
python -m backend.scrapers.refresh_token --visible

# Check token status
python -m backend.scrapers.refresh_token --check
```

### GitHub Actions
- **Workflow**: `.github/workflows/token-refresh.yml`
- **Schedule**: `cron: '50 22 * * *'` (5:50 AM WIB)
- **Secrets Required**: `TIX_PHONE_NUMBER`, `TIX_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT`

---

## Scraper 2: Movie + Theatre

### Purpose
Scrape daily movie listings, showtimes, and theatre information.

### Endpoints
| Type | URL |
|------|-----|
| Web App Base | `https://app.tix.id` |
| API Base | `https://api-b2b.tix.id` |
| Cities Page | `https://app.tix.id/cities` |
| Movie Schedule | `https://app.tix.id/movies/{slug}-{id}/{date}` |

### Data Captured
- Movie: id, title, genres, poster, age_category, merchants
- Theatre: id, name, merchant, address, city
- Room: category (SATIN, GOLD CLASS, IMAX, etc.), price
- Showtime: time, `showtime_id`, status, is_available

### Output
- **File**: `data/movies_{date}.json`
- **Firestore**: `theatres` collection (deduplicated, geocoded)

### CLI Usage
```bash
python -m backend.scrapers.cli movies --city JAKARTA
python -m backend.scrapers.cli movies --batch 0 --total-batches 9
```

---

## Scraper 3: JIT Seats

### Purpose
Scrape seat availability just before showtime starts.

### Endpoints
| Type | URL |
|------|-----|
| Seat Layout API | `https://api-b2b.tix.id/v1/movies/{merchant}/layout` |

### API Parameters
```
GET /v1/movies/{merchant}/layout
  ?show_time_id={id}
  &tz=Asia/Jakarta

Headers:
  Authorization: Bearer {JWT_TOKEN}
  Accept: application/json
```

### Data Captured
- `seat_map[]`: seat_yn, seat_status (1=available, 0=sold), seat_grd_cd
- `price_group[]`: seat grades and prices
- Calculated: total_seats, sold_seats, occupancy_pct

### CLI Usage
```bash
# JIT mode (uses stored token)
python -m backend.scrapers.cli seats --mode jit --use-stored-token

# Manual mode (with login)
python -m backend.scrapers.cli seats --mode morning
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TIX_PHONE_NUMBER` | TIX.id login phone | `+62XXXXXXXXXX` |
| `TIX_PASSWORD` | TIX.id login password | `<your_password>` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase credentials JSON | `{...}` |

---

## File Structure

```
backend/
├── services/
│   ├── base_scraper.py      # Shared browser/login
│   ├── tix_client.py        # Movie scraper
│   ├── seat_scraper.py      # Seat scraper
│   └── token_storage.py     # Firestore token storage
└── scrapers/
    ├── cli.py               # Unified CLI
    ├── refresh_token.py     # Token refresh script
    └── __main__.py          # Entry point
```

---

## Token Architecture

TIX.id uses a **two-token system** for security:

| Token | localStorage Key | Duration | Purpose |
|-------|-----------------|----------|---------|
| Access | `authentication_token` | **~30 min** (verified) | Sent with every API request |
| Refresh | `authentication_refresh_token` | ~91 days | Used to get new access tokens |

### Verified Test Results (Dec 18, 2025)

```
✅ Access Token Test:
   - Captured via localStorage after login
   - Expires in exactly 30 minutes
   - Works for seat layout API calls
   - Example: Token at 04:22:08 expired at 04:52:04

✅ Seat API Test (KEDIRI MALL CGV, 10:00 showtime):
   - Total seats: 126
   - Sold seats: 1  
   - Occupancy: 0.8%
   - API: GET https://api-b2b.tix.id/v1/movies/cgv/layout?show_time_id={id}
```

### Why Two Tokens?

```
┌─────────────────────────────────────────────────────────────┐
│  If hacker steals ACCESS token → Only 30 min of access     │
│  If hacker steals REFRESH token → Can get new access tokens │
│                                                             │
│  Access tokens are exposed in every API call (higher risk)  │
│  Refresh tokens stay in localStorage (lower exposure)       │
└─────────────────────────────────────────────────────────────┘
```

### Token Flow

1. **Login** → Get both access (30 min) + refresh (91 days) tokens
2. **API Calls** → Use access token in `Authorization: Bearer {token}`
3. **Access Expires** → App automatically uses refresh token to get new access
4. **Refresh Expires** → User must login again with phone/password

### Refresh Token Investigation (Dec 18, 2025)

Tested approaches to use refresh token programmatically:

| Approach | Result | Notes |
|----------|--------|-------|
| POST to `/v1/auth/refresh` | 401 | Endpoint exists but rejected |
| POST to `/v1/auth/token/refresh` | 401 | Endpoint exists but rejected |
| POST to `/v1/refresh-token` | 401 | Endpoint exists but rejected |
| Use refresh token as Bearer | 401 | Invalid token error |

**Conclusion:** TIX.id's refresh flow is handled by Flutter client-side interceptors, not a public API. The refresh token cannot be used programmatically without reverse-engineering the Flutter app's network layer.

### Current Implementation

- Token refresh stores the **access token** in Firestore
- Runs daily at 5:50 AM WIB (before 6 AM movie scrape)
- JIT seat scraper uses stored token via `--use-stored-token`
- Token valid for ~30 minutes after capture

> [!IMPORTANT]
> Since access tokens expire in 30 min, the JIT seat scraper (every 15 min) must work within this window. The daily token refresh at 5:50 AM provides a fresh token that's valid until ~6:20 AM, enough for the morning seat scrape.

---

## Known Issues & Fixes

### Issue 1: Two Login Buttons (CRITICAL)

**Problem:** TIX.id login page has two buttons labeled "Login":
- Header button → Navigates to home (does NOT login)
- Form button → Actually submits login

**Symptom:** Playwright clicks header button, page goes to `about:blank`, no session created.

**Fix:** Use `.last` not `.first` in Playwright selector:
```python
# WRONG - clicks header button
login_button = page.get_by_role('button', name='Login').first

# CORRECT - clicks form button
login_button = page.get_by_role('button', name='Login').last
```

### Issue 2: Flutter Rendering in Headless Mode

**Problem:** Flutter canvas-based apps render differently in headless Chromium.

**Symptom:** Input fields not found, page appears blank.

**Fix:** Use `xvfb-run` on Linux (GitHub Actions):
```yaml
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" \
  python -m backend.scrapers.refresh_token
```

### Issue 3: Showtime ID Extraction

**Problem:** CLI was reading wrong field for showtime IDs.

**Data Structure:**
```json
{
  "rooms": [{
    "category": "2D",
    "showtimes": ["19:35", "20:00"],        // ❌ No IDs
    "all_showtimes": [                       // ✅ Has IDs
      {"time": "19:35", "showtime_id": "123", "is_available": true}
    ]
  }]
}
```

**Fix:** Changed CLI to read from `all_showtimes`:
```python
# WRONG
for st in room.get('showtimes', []):

# CORRECT
for st in room.get('all_showtimes', room.get('showtimes', [])):
```

### Issue 4: Local Firestore Access

**Problem:** Local development uses different Google Cloud project (kadago109 vs cineradar).

**Symptom:** `403 Cloud Firestore API has not been used in project kadago109`

**Fix:** Set `FIREBASE_SERVICE_ACCOUNT` environment variable with CineRadar service account JSON.

---

## Data Structure Reference

### Movie Data (`data/movies_{date}.json`)

```json
{
  "scraped_at": "2025-12-17 16:59:35",
  "date": "2025-12-17",
  "movies": [{
    "id": "1961889705591132160",
    "title": "AVATAR: FIRE AND ASH",
    "merchants": ["XXI", "CGV", "Cinépolis"],
    "schedules": {
      "MALANG": [{
        "theatre_id": "986744938815295488",
        "theatre_name": "ARAYA XXI",
        "merchant": "XXI",
        "rooms": [{
          "category": "2D",
          "price": "Rp35.000",
          "all_showtimes": [{
            "time": "19:35",
            "showtime_id": "2000039256042586112",
            "status": 1,
            "is_available": true
          }]
        }]
      }]
    }
  }]
}
```

### Token Storage (Firestore `auth_tokens/tix_jwt`)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "stored_at": "2025-12-17T09:06:29.115024",
  "expires_at": "2025-12-18T05:06:29.115029",
  "phone": "6285***"
}
```

---

## Data Contracts (Pydantic Schemas)

> [!IMPORTANT]
> All data passing through the pipeline is validated using Pydantic V2 schemas.
> This ensures data integrity and prevents corrupted data from reaching Firestore.

### Schema Files

| Schema | File | Purpose |
|--------|------|---------|
| `MovieSchema` | `backend/schemas/movie.py` | Complete movie with schedules |
| `DailySnapshotSchema` | `backend/schemas/movie.py` | Full daily scrape output |
| `TheatreSchema` | `backend/schemas/theatre.py` | Theatre for Firestore storage |
| `TokenSchema` | `backend/schemas/token.py` | JWT with TTL validation |
| `ScraperRunSchema` | `backend/schemas/scraper_run.py` | Scraper run logging |

### Validation Points

| Pipeline Step | Validation Applied |
|---------------|-------------------|
| Batch merge | `DailySnapshotSchema` validates merged output |
| Firestore upload | `TheatreSchema` validates each theatre |
| Token retrieval | Token expiry check before use |
| Pre-seat-scrape | Token TTL ≥ 25 minutes verified |

### Integrity Assertions

After schema validation, these assertions are checked:

```python
assert len(movies) >= 10       # At least 10 movies expected
assert len(city_stats) >= 50   # At least 50 cities expected (normally ~83)
```

### Failure Modes

| Failure | GitHub Action Behavior |
|---------|----------------------|
| Schema validation fails | Exit with code 1, no Firestore write |
| Token expired | Seat scrape skipped, error in logs |
| Integrity assertion fails | Exit with code 1, data not uploaded |
| Token TTL < 25 min | Seat scrape job fails fast |

### CLI Validation Commands

```bash
# Validate today's movie data
python -m backend.scrapers.validate

# Validate specific file
python -m backend.scrapers.validate --file data/movies_2025-12-18.json

# Check token TTL (exit 1 if < 25 min remaining)
python -m backend.scrapers.refresh_token --check-min-ttl 25
```

---

## CI/CD Pipeline

### Workflow Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to `backend/**` | Lint, test, type-check Python |
| `admin-ci.yml` | Push/PR to `admin/**` | Lint, type-check, build Next.js |
| `pr-checks.yml` | Pull requests | Unified quality gate |
| `smoke-tests.yml` | Push to `admin/**` + daily | Test production APIs |
| `security-scan.yml` | Push/PR + weekly | CodeQL security analysis |
| `failure-reporter.yml` | Workflow failures | Auto-create GitHub issues |
| `daily-scrape.yml` | Daily 6 AM WIB | Movie + seat scraping |
| `token-refresh.yml` | Daily 5:50 AM WIB | JWT token refresh |

### Quality Gates (Required for Merge)

The `PR Checks` workflow serves as a single required status check for branch protection:

```
PR Checks
├── backend-quality
│   ├── ruff lint
│   ├── mypy type check
│   └── pytest (70% coverage minimum)
└── frontend-quality
    ├── TypeScript type check
    └── Next.js build
```

### Automated Dependency Updates

Dependabot is configured for:
- **Python** (`requirements.txt`) - Weekly
- **npm** (`admin/`, `web/`) - Weekly  
- **GitHub Actions** - Weekly

### Security Scanning

CodeQL runs on:
- Every push to `main`
- Every pull request
- Weekly scheduled scan

Languages: Python, JavaScript/TypeScript

### Alerting

When critical workflows fail (`Daily Scrape`, `Token Refresh`, `Smoke Tests`):
1. GitHub issue is automatically created
2. Labeled with `workflow-failure` and `bug`
3. Contains link to failed run

### Smoke Tests

Production API endpoints are tested:
- After every `admin/**` push (with 2-min Vercel deploy delay)
- Daily at 7 AM WIB
- Manually via `workflow_dispatch`

**11 endpoints tested:**
- `/api/dashboard` (validates `kpis.revenue`)
- `/api/movies` (validates `total` or `showtimes`)
- `/api/scraper` (validates `runs`)
- All other analytics endpoints (HTTP 200 check)

### Local CI Commands

```bash
# Backend
ruff check backend/                    # Lint
mypy backend/domain/ --ignore-missing  # Type check
pytest tests/ -v --cov=backend         # Test with coverage

# Frontend (from admin/)
npm run lint                           # ESLint
npx tsc --noEmit                       # Type check
npm run build                          # Production build
```


