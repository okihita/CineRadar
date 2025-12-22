# Cinepoint Spider

Comprehensive data scraper for [Cinepoint.com](https://cinepoint.com) - Indonesia's movie analytics platform.

## Data Sources

| Endpoint | Description | Storage |
|----------|-------------|---------|
| Movie Directory | All movies with metadata | `cinepoint_movies` |
| Daily Showtime | Market share rankings | `cinepoint_showtimes` |
| Box Office | Daily admissions rankings | `cinepoint_box_office` |
| Insights | Industry articles | `cinepoint_insights` |

## Setup

1. **Install dependencies:**
   ```bash
   cd cinepoint-spider
   npm install
   ```

2. **Set environment variables:**
   ```bash
   export CINEPOINT_ACCESS_TOKEN="your_jwt_token"
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-credentials.json"
   ```

3. **Get your access token:**
   - Log in to [cinepoint.com](https://cinepoint.com)
   - Open DevTools → Application → Cookies
   - Copy the JWT token from the access cookie

## Usage

### Individual Scrapers

```bash
# Scrape all movies
npm run scrape:movies

# Scrape showtimes (default: today only)
npm run scrape:showtimes
npx tsx src/scrapers/showtimes.ts 30  # Last 30 days

# Scrape box office
npm run scrape:boxoffice
npx tsx src/scrapers/boxOffice.ts 30  # Last 30 days

# Scrape insights
npm run scrape:insights
```

### Historical Backfill

```bash
# Full backfill (365 days)
npm run backfill

# Specific duration
npx tsx scripts/backfill-historical.ts 30    # 30 days
npx tsx scripts/backfill-historical.ts 90    # 90 days

# Specific type only
npx tsx scripts/backfill-historical.ts movies
npx tsx scripts/backfill-historical.ts showtimes
```

### Daily Sync

```bash
npm run sync
```

## GitHub Actions

Automated daily sync runs at 06:00 UTC (13:00 WIB).

### Required Secrets

- `CINEPOINT_ACCESS_TOKEN` - JWT token from Cinepoint
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON

## Token Refresh

The access token expires after ~24 hours. To refresh:

1. Log in to cinepoint.com
2. Copy new token from cookies
3. Update `CINEPOINT_ACCESS_TOKEN` secret in GitHub

> **Note:** Consider implementing automatic token refresh using the refresh token cookie.
