# Admin & Intelligence Utility Scripts 🛠️

This directory contains standalone Python CLI scripts for backfilling and enriching CinePoint box office intelligence into Firestore.

---

### 📋 Script Cheat Sheet

| Script | Purpose | Usage / Command | Safe to Run? |
| :--- | :--- | :--- | :---: |
| **`cinepoint_backfill.py`** | Backfills historical daily admissions & box office numbers from CinePoint API into `cinepoint_daily_boxoffice` and `cinepoint_movies`. | `uv run admin/scripts/cinepoint_backfill.py --from-date 2025-01-01 --to-date 2026-04-01` | ✅ **Safe** (Supports `--dry-run` and `--resume`) |
| **`cinepoint_enrich.py`** | Fetches detailed movie metadata (directors, actors, posters, genres) for CinePoint movies. | `uv run admin/scripts/cinepoint_enrich.py --all` | ✅ **Safe** (Idempotent, rate-limit aware) |

---

### 🔑 Required Environment Variables
These scripts read credentials from `admin/.env.local`:
* `CINEPOINT_REFRESH_TOKEN`: Valid CinePoint API bearer/refresh token.
* `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Service account credentials.
