# Technical Debt

## TD-001: Old Movie Data Files in Git

**Status:** Open  
**Priority:** Low  
**Created:** 2025-12-23

### Problem

Old `movies_*.json` files are committed to Git. When the daily scrape workflow runs:

1. `actions/checkout` clones the repo → includes old `data/movies_2025-12-19.json`
2. Scraper creates new `data/movies_2025-12-23.json`
3. Artifact upload uses `path: data/movies_*.json` → grabs **both files**

This causes artifacts to contain stale data alongside fresh data.

### Evidence

```
scrape-data-20447571575/
├── movies_2025-12-19.json  ← OLD (from Git)
└── movies_2025-12-23.json  ← NEW (freshly scraped)
```

### Solution

1. Remove old data files from Git:
   ```bash
   git rm data/movies_*.json
   git commit -m "Remove old movie data from repo"
   ```

2. Add to `.gitignore`:
   ```
   data/movies_*.json
   data/seats_*.json
   data/batch_*.json
   ```

---

## TD-002: Web App Missing Showtimes

**Status:** Open  
**Priority:** High  
**Created:** 2025-12-23

### Problem

The web app shows "Run scraper with --schedules flag to get detailed showtimes" instead of actual showtimes.

### Root Cause

`save_daily_snapshot()` in `firebase_client.py` intentionally strips full schedules to stay under Firestore's 1 MB document limit. Only `theatre_counts` are saved.

### Solution Options

1. **Store per-city:** `schedules/{date}/{city}` documents
2. **Store per-movie:** `schedules/{date}/{movie_id}` documents  
3. **Use Cloud Storage:** Upload full JSON to GCS

---

## TD-003: Seat Scraper Returns Empty Data

**Status:** Open  
**Priority:** Medium  
**Created:** 2025-12-23

### Problem

All seat scraper batches return `seats: []` with `total_scraped: 0`.

### Possible Causes

1. Token expired before seat scrape runs
2. TIX.id API changed
3. Timing issue (no morning showtimes at scrape time)
4. Bug in seat scraper logic

### Next Steps

- Check seat scraper logs for errors
- Verify token TTL at scrape time
- Test seat API endpoint manually
