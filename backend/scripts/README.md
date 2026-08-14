# Backend & Scraping Utility Scripts 🛠️

This directory contains standalone Python CLI tools for manual scrape runs, studio hall discovery, and data post-processing.

---

### 📋 Script Cheat Sheet

| Script | Purpose | Usage / Command | Safe to Run? |
| :--- | :--- | :--- | :---: |
| **`run_national_scrape.py`** | Manually triggers a nationwide scraping run across all 496+ theatres in 83 cities. | `uv run backend/scripts/run_national_scrape.py` | ✅ **Safe** (Appends to today's schedule) |
| **`post_process.py`** | Runs the end-of-day aggregator to compute total admissions, revenue estimates, and occupancy percentages. | `uv run backend/scripts/post_process.py --date YYYY-MM-DD` | ✅ **Safe** (Idempotent rollup) |
| **`discover_studios.py`** | Scans active schedules to identify newly opened cinema halls not yet in the `theatres` catalog. | `uv run backend/scripts/discover_studios.py` | ✅ **Safe** (Read-only or appends new halls) |
| **`scrape_initial_layouts.py`** | Fetches seat layout grid maps for newly discovered cinema halls. | `uv run backend/scripts/scrape_initial_layouts.py` | ✅ **Safe** |
| **`bootstrap_studio_v3.py`** | Initializes studio seat capacity matrices for Studio V3 intelligence. | `uv run backend/scripts/bootstrap_studio_v3.py` | ⚠️ **Admin Only** |
| **`backfill_v1_to_v2.py`** | Historical migration tool used to convert V1 database collections into V2. | `uv run backend/scripts/backfill_v1_to_v2.py` | 🛑 **Legacy Migration Only** |

---

### 🔑 Required Environment Variables
These scripts read credentials from `/.env`:
* `TIX_PHONE_NUMBER`: TIX ID bot phone number.
* `TIX_PASSWORD`: TIX ID bot account password.
