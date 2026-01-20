# Daily Summary & System Deep Dive Analysis

**Date:** 2026-01-20
**Scope:** `daily_summary.py`, `dispatcher/main.py`, `deploy.sh`

---

## 1. Daily Summary Analysis (Verified ✅)

**Status:** The implementation in `backend/cli/daily_summary.py` is **CORRECT** and robust.

### Execution Schedule
| Timezone | Execution Time | Usage |
| :--- | :--- | :--- |
| **UTC** | **17:00** | GitHub Runner Time |
| **WIB** | **00:00** | Business Logic Time (Midnight) |

### Verified Logic
- **Timezone Handling:** The script correctly uses `ZoneInfo("Asia/Jakarta")` to determine the "yesterday" date target.
- **Data Source:** Correctly filters `seat_snapshots` by `scraped_at` timestamp.
- **Output:** Correctly generates JSON summary and upserts to `scraper_logs/{date}`.

---

## 2. JIT Scraper System Deep Dive

### ✅ Verified Fixes (Ready for Prod)

#### 1. Scheduler Timezone
**Component:** Cloud Scheduler (`deploy.sh`)
**Previous Issue:** Double timezone application causing evening misses.
**Current Status:** **FIXED.**
- Schedule updated to `*/5 10-23 * * *`.
- Combined with `--time-zone="Asia/Jakarta"`, this correctly targets 10:00 AM to 11:55 PM WIB.

#### 2. Dispatcher Coverage Gaps
**Component:** Dispatcher (`main.py`)
**Previous Issue:** Narrow window causing misses on cold start delays.
**Current Status:** **FIXED.**
- Window widened: `WINDOW_END_MINUTES = 15`.
- This ensures 5-minute overlap. Since scraping is idempotent (upsert), double-scraping is safe and ensures 100% coverage.

### ⚠️ Known Deferred Items

#### Security (Authentication)
**Component:** `deploy.sh`
**Status:** **DEFERRED (User Acknowledged)**
- Dispatcher is currently deployed with `--allow-unauthenticated`.
- **Plan:** Hardening (OIDC token auth) will be applied after proving stability in production.

---

## 3. Verified OK Components
- **Dispatcher Dependencies:** `requirements.txt` is correct and minimal.
- **Deployment Structure:** `deploy.sh` correctly isolates the `dispatcher` build context.
- **Pub/Sub Logic:** Message publishing is implemented correctly.
