# CinePoint API Intelligence

> Reverse-engineered from CinePoint frontend (`main-XGYJIPZK.js` + `chunk-QQKKBESW.js`) and manual API exploration.
> Date: 2026-05-08

## Base URL & Auth

```
Base:   https://cinepoint.com/bff/v1
Auth:   Bearer JWT (Authorization header)
Expiry: ~24h (check `exp` claim)
Gate:   x-app-request: true header required
```

**Required headers** (all endpoints):
```
accept: application/json          (NOT msgpack — that returns encrypted blobs)
authorization: Bearer <token>
content-type: application/json
x-app-request: true
referer: https://cinepoint.com/
```

**Subscription gate**: `movies/detail` returns `CINEPOINT-MOVIE-400 "Invalid movie id"` for ALL movie IDs when subscription is expired. Requires active paid subscription. All graph endpoints (`compare-movies/graph/*`, `daily-showtime/graph`) work without subscription.

---

## Token Refresh Mechanism

Two JWT tokens issued at login (`POST /authorization/login`):

| Token | Cookie name | Expiry | Claims |
|---|---|---|---|
| Access token | `cinepoint.token` (aka `cinepoint_access_token`) | **24 hours** | Full: `sub`, `name`, `email`, `phone`, `session_id` |
| Refresh token | `cinepoint.refresh_token` (hash-named cookie) | **14 days** (336h) | Minimal: `sub` only |

### Refresh endpoint

```
POST /authorization/refresh-token
Authorization: Bearer <refresh_token>
```

**Response**:
```json
{
  "response_output": {
    "detail": {
      "access_token": "<new 24h JWT>",
      "refresh_token": "<new 14-day JWT, optional>"
    }
  }
}
```

### Refresh flow (from frontend source)

```javascript
validateRefreshToken() {
  return this.postRequestSimplified(
    REFRESH_TOKEN_URL,  // /authorization/refresh-token
    {},
    null, false,
    { Authorization: `Bearer ${this.getCurrentRefreshToken()}` }
  )
}

refreshToken() {
  return this.validateRefreshToken().pipe(
    tap(response => {
      if (response.access_token) this.storeToken(response.access_token);
      if (response.refresh_token) this.storeRefreshToken(response.refresh_token);
    }),
    switchMap(() => this.getUserProfile())
  )
}
```

### Current tokens

- **Refresh token**: Expires `2026-05-22` (13 days remaining)
- **Access token**: Refreshed successfully via refresh token
- The refresh token itself is also refreshed on each call (14-day rolling window)

### Implications for scraping

1. We can programmatically refresh the access token using the refresh token
2. Store the refresh token securely (not in git)
3. Auto-refresh before each scraping session (check `exp` claim)
4. Rolling 14-day window: must refresh at least once every 14 days to maintain access
5. With active subscription: can also access `movies/detail` for enrichment

---

## Endpoints

### 1. Movie Directory (catalog listing)

```
GET /movies/directory?limit=25&page=0
```

**Response**: Paginated list of all movies (~3,963 total).

```json
{
  "response_output": {
    "list": {
      "pagination": { "limit": 25, "page": 0, "total": 3963 },
      "content": [
        {
          "id": 3966,
          "title": "Cek Khodam",
          "image_title": "https://cinepoint-assets.s3.amazonaws.com/...",
          "movie_genre": ["Comedy"],
          "duration": 0,
          "release_date": "2026-07-16",
          "type": "local"
        }
      ]
    }
  }
}
```

**Fields returned**: `id`, `title`, `image_title`, `movie_genre`, `duration`, `release_date`, `type` (local|international).

### 2. Movie Detail

```
GET /movies/detail?movie_id=3719
```

**Note**: May require active subscription. Returned `CINEPOINT-MOVIE-400 "Invalid movie id"` with expired subscription.

**Response**: Full movie metadata.

```json
{
  "response_output": {
    "detail": {
      "id": 3719,
      "title": "Panda Plan: The Magical Tribe",
      "rating_category": ["PG-13"],
      "casts": [{ "role": "casts", "names": ["Jackie Chan", ...] }, ...],
      "user_ratings": [{ "rating": "8", "value": 41.7 }, ...],
      "comparison": [
        {
          "periode": "7_days",
          "id": 3719,
          "title": "Panda Plan: The Magical Tribe",
          "admission": 144729,
          "gross": 399773,
          "image_title": "...",
          "other_movie": { "id": 2680, "title": "Venom: The Last Dance", "admission": 1099085, "gross": 3275693 }
        },
        { "periode": "14_days", "admission": 207070, "gross": 570773, "other_movie": { ... } }
      ],
      "playing_at": [],
      "similar_movies": [...],
      "release_date": "2026-02-25",
      "trailer_url": "...",
      "type": "international",
      "language": "English",
      "movie_genre": ["Comedy", "Action"],
      "duration": 100,
      "description": "...",
      "production_status": "released",
      "score": 6.8,
      "admission": 0,
      "total_admission": 291635,
      "change": 100,
      "showtimes": 23678,
      "movie_rating": { "imdb": null, "rotten_tomatoes": null }
    }
  }
}
```

**Key fields for enrichment**:
| Field | Type | Description |
|---|---|---|
| `total_admission` | number | Lifetime cumulative admissions |
| `admission` | number | Current period admissions (0 if not playing) |
| `showtimes` | number | Total showtime count across all cinemas |
| `score` | number | User rating (0-10) |
| `change` | number | % change indicator |
| `comparison` | array | 7-day and 14-day admission/gross vs benchmark movie |
| `playing_at` | array | Theaters currently showing this movie |
| `casts` | array | Cast, director, producer, writer names |
| `user_ratings` | array | Rating distribution (1-10, percentage) |
| `language` | string | Movie language |
| `description` | string | Synopsis |
| `trailer_url` | string | YouTube trailer URL |

### 3. Compare-Movies Graph Endpoints

All share the same query parameters and response structure.

```
GET /movies/compare-movies/graph/admission?movie_ids=3901&type=all&periode_range=weekly
GET /movies/compare-movies/graph/gross?movie_ids=3901&type=all&periode_range=weekly
GET /movies/compare-movies/graph/showtimes?movie_ids=3901&type=all&periode_range=weekly
GET /movies/compare-movies/graph/demographics?movie_ids=3901&type=all&periode_range=weekly
```

**Query parameters**:

| Param | Values | Description |
|---|---|---|
| `movie_ids` | comma-separated IDs | e.g. `3901` or `3901,3933` |
| `type` | `all`, `local`, `international` | Cinema type filter |
| `periode_range` | `daily`, `weekly`, `monthly`, `yearly` | Time bucket size |
| `compare_by_week` | `1` (optional) | Aligns to release-week instead of calendar week |
| `spinneroff` | `0`, `1` | UI spinner control (no data effect) |

**`periode_range` behavior**:

| Value | Data returned | For movie 3901 (released Apr 8) |
|---|---|---|
| `daily` | Today only (1 point) | `{date: "2026-05-08", value: 0}` |
| `weekly` | Last 4 calendar weeks | Apr-06 to May-03 (4 points) |
| `monthly` | Last 12 months | May-2025 to May-2026 (13 points) |
| `yearly` | Last 2 years | 2025, 2026 (2 points) |

**`compare_by_week=1` behavior** (overrides `periode_range` to weekly):

Returns up to 12 weekly buckets aligned to the movie's release date. Works for both currently-playing AND retired movies.

```
GET /movies/compare-movies/graph/admission?movie_ids=3901&type=all&periode_range=weekly&compare_by_week=1
```

Response:
```json
{
  "detail": [{
    "id": 3901,
    "title": "Project Hail Mary",
    "data": [
      { "date": "2026-04-06 - 2026-04-12", "periode": "Week 1", "value": 270815 },
      { "date": "2026-04-13 - 2026-04-19", "periode": "Week 2", "value": 208196 },
      { "date": "2026-04-20 - 2026-04-26", "periode": "Week 3", "value": 97302 },
      { "date": "2026-04-27 - 2026-05-03", "periode": "Week 4", "value": 47205 },
      { "date": "2026-05-04 - 2026-05-10", "periode": "Week 5", "value": 6900 },
      { "date": "", "periode": "Week 6", "value": 0 },
      ...up to Week 12
    ]
  }]
}
```

Verification: Week 1-5 sum = 270815 + 208196 + 97302 + 47205 + 6900 = 630,418. Matches yearly total (630,418).

**For old movie 3719** (Panda Plan, released Feb 25):
- Week 1: 114,934 → Week 5: 20,455 → Week 6+: 0
- Total: 291,635 matches `total_admission` from details.

### 4. Daily Showtime Graph

```
GET /movies/daily-showtime/graph?movie_ids=3901
```

**This is the only endpoint that returns daily granularity.** It returns showtime count (NOT admissions) per date since the movie's release.

**No extra params needed** — no `periode_range`, `type`, or date range params. Always returns daily data.

```json
{
  "detail": [{
    "id": 3901,
    "title": "Project Hail Mary",
    "data": [
      { "date": "2026-04-08", "periode": "2026-04-08", "value": 1983 },
      { "date": "2026-04-09", "periode": "2026-04-09", "value": 1579 },
      { "date": "2026-04-10", "periode": "2026-04-10", "value": 1320 },
      ...one point per day...
      { "date": "2026-05-07", "periode": "2026-05-07", "value": 39 },
      { "date": "2026-05-08", "periode": "2026-05-08", "value": 0 }
    ]
  }]
}
```

**Behavior notes**:
- Returns ~31 data points (roughly last month), not the full run
- For old movies (e.g. 3719, released Feb 25): still returns 31 points starting from Apr 8 (not from release)
- `value` is showtime count, NOT admissions
- Multiple movies: `movie_ids=3901,3933` works, returns separate detail arrays

### 5. Complete Endpoint Map

From frontend JS source (`chunk-QQKKBESW.js`):

```
MOVIE_DIRECTORY:       /movies/directory
MOVIE_DETAIL:          /movies/detail
MOVIE_GENRES:          /movies/genres
MOVIE_RATING_CATEGORIES: /movies/rating-categories
CHART_ADMISSION:       /movies/compare-movies/graph/admission
CHART_GROSS:           /movies/compare-movies/graph/gross
CHART_SHOWTIMES:       /movies/compare-movies/graph/showtimes
CHART_DEMOGRAPHIC:     /movies/compare-movies/graph/demographics
DAILY_SHOWTIME:        /movies/daily-showtime
DAILY_SHOWTIME_CHART:  /movies/daily-showtime/graph
LATEST_MOVIES:         /home/latest-movies
SEARCH_MOVIES:         /home/search-movie
ABOUT_FAQ:             /about/faq
COUNTRIES:             /countries?limit=1000000
SIGN_IN:               /authorization/login
SIGN_UP:               /authorization/signup
REFRESH_TOKEN:         /authorization/refresh-token
PAYMENT:               /subscription/payment
GET_PLANS:             /subscription/plans
MY_SUBS:               /subscription/my-subscription
BLOG_LIST:             /articles
```

### 6. Top Box Office — THE GOLDMINE

> **This endpoint was NOT in the frontend JS endpoint map.** Discovered via browser network capture.

```
GET /movies/top-box-office/daily/detail
  ?date_start=2026-05-06
  &date_end=2026-05-06
  &type=all
  &limit=100
  &order=desc
  &sort=admission
  &page=0
```

**Also available**: `/top-box-office/weekly/detail`, `/top-box-office/monthly/detail`

#### Auth: NONE REQUIRED

Works without any Bearer token. No subscription needed. Only needs `x-app-request: true` header.

#### Query parameters

| Param | Values | Description |
|---|---|---|
| `date_start` | `YYYY-MM-DD` | Start of date range |
| `date_end` | `YYYY-MM-DD` | End of date range (same as start = daily) |
| `type` | `all`, `local`, `international` | Movie origin filter |
| `limit` | number (100 max) | Page size |
| `page` | number (0-based) | Pagination |
| `sort` | `admission` | Sort column |
| `order` | `desc`, `asc` | Sort direction |

#### Date behavior

| `date_start` | `date_end` | Result |
|---|---|---|
| Same date | Same date | **Daily data** for that date |
| Different dates | Different dates | Aggregated to weekly bucket (snaps to week boundaries) |

#### Historical depth

| Date | Has data? |
|---|---|
| 2022-01-01 | ❌ empty (0 movies) |
| 2023-01-01 | ✅ 12 movies |
| 2023-06-01 | ✅ 9 movies |
| 2024-01-01 | ✅ 6 movies |
| 2025-01-01 | ✅ 14 movies |

**Data available from ~early 2023 onwards.**

#### Response (May 6, 2026 — 14 movies)

```json
{
  "response_output": {
    "list": {
      "pagination": { "limit": 100, "page": 0, "total": 14 },
      "content": [
        {
          "id": 3965,
          "title": "Mortal Kombat II",
          "image_title": "https://cinepoint-assets.s3.amazonaws.com/...",
          "movie_genre": ["Action", "Adventure"],
          "duration": 116,
          "release_date": "2026-05-05T17:00:00.000Z",
          "type": "international",
          "admission": 80059,
          "total_admission": 80059,
          "change": 0,
          "showtimes": 2536,
          "score": 7.6,
          "rank": {
            "current_rank": 1
          }
        },
        {
          "id": 3687,
          "title": "Ghost In The Cell",
          "admission": 54839,
          "total_admission": 2780350,
          "change": -10,
          "showtimes": 58960,
          "score": 8.3,
          "rank": { "current_rank": 2, "last_rank": 170 }
        }
      ]
    },
    "meta": { "date_start": "2026-05-04", "date_end": "2026-05-10" }
  }
}
```

#### Per-movie fields

| Field | Type | Description | Example |
|---|---|---|---|
| `admission` | number | **Daily admissions** for the queried date | `80059` |
| `total_admission` | number | Lifetime cumulative admissions | `2780350` |
| `showtimes` | number | Total showtime count (lifetime or current period) | `58960` |
| `score` | number | User rating (0-10) | `8.3` |
| `change` | number | Day-over-day % change | `-10` |
| `rank.current_rank` | number | Current daily rank | `2` |
| `rank.last_rank` | number | Previous day's rank (absent if new) | `170` |
| `id` | number | CinePoint movie ID | `3687` |
| `title` | string | Movie title | `"Ghost In The Cell"` |
| `movie_genre` | string[] | Genres | `["Horror", "Comedy"]` |
| `duration` | number | Runtime in minutes | `106` |
| `release_date` | string | ISO date with TZ offset | `"2026-04-15T17:00:00.000Z"` |
| `type` | string | `"local"` or `"international"` | `"local"` |
| `image_title` | string | S3 poster URL | `"https://cinepoint-assets..."` |

#### Cross-verification

- Project Hail Mary (3901): `total_admission: 630418` matches yearly endpoint (630,418) ✓
- Opening day (Apr 8): `admission: 51209` — reasonable for a major release
- `rank.last_rank` appears to be an absolute historical rank (170, 185, etc.) — not just previous day's top-10 position

---

## Key Findings

### ✅ Daily Admissions: AVAILABLE (via Top Box Office)

The `/movies/top-box-office/daily/detail` endpoint provides **daily admissions per movie** with no authentication required.

### Best Available Data

| Granularity | Metric | Endpoint | Auth |
|---|---|---|---|
| **Daily** | **Admissions, showtimes, score, rank, change** | **`top-box-office/daily/detail`** | **None** |
| Weekly | Admissions, showtimes, score, rank | `top-box-office/weekly/detail` | None |
| Monthly | Admissions, showtimes, score, rank | `top-box-office/monthly/detail` | None |
| Daily | Showtime count only | `daily-showtime/graph` | Bearer |
| Weekly (by release) | Admissions, Gross, Showtimes | `compare-movies/graph/*` + `compare_by_week=1` | Bearer |
| Lifetime | Total admissions, score, showtimes | `movies/detail` → `total_admission` | **Subscription** |

### Rate Limiting

- Hit 429 (Too Many Requests) after ~20 rapid sequential requests
- Cooldown: ~10 seconds
- Recommended: 3s delay between requests for polite scraping
