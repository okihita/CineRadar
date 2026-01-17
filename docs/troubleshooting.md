# Troubleshooting & Known Issues

This guide details common errors, known bugs, and how to resolve them.

## Troubleshooting Guide

| Error | Cause | Solution |
|-------|-------|----------|
| `401 INVALID_TOKEN` | Token has quotes | Re-run `refresh_token.py` (bug is fixed) |
| `401 EXPIRED_EVENT_DETAIL` | Showtime already started | Use fresh movie data |
| `401` after fresh login | Token not stripped | Check first/last char of token |
| Login hangs | Flutter rendering issue | Use `xvfb-run` |
| Refresh API returns 401 | Refresh token expired (~91 days) | Re-login via Playwright |
| `403 Cloud Firestore API...` | Wrong Project ID | Set `FIREBASE_SERVICE_ACCOUNT` env var |

---

## Known Bugs & Fixes

### Bug 1: Token Stored With Quotes (Fixed Dec 23, 2025)
**Symptom:** All API calls return 401 even with fresh token.
**Cause:** `localStorage.getItem()` returns tokens wrapped in quotes: `"eyJ..."` instead of `eyJ...`.
**Fix:** `refresh_token.py` now strips quotes before storing.

### Bug 2: Two Login Buttons
**Symptom:** Playwright clicks wrong button, page goes to `about:blank`.
**Cause:** TIX.id has a header login button (navs to home) and a form login button.
**Fix:** Use `.last` selector or index 5.

### Bug 3: Flutter Rendering in Headless Mode
**Symptom:** Page appears blank, elements not found.
**Fix:** Use `xvfb-run` on Linux:
```bash
xvfb-run --auto-servernum python -m backend.cli.refresh_token
```

### Issue: Showtime ID Extraction
**Problem:** CLI was reading `showtimes` array which lacks IDs.
**Fix:** Changed CLI to read from `all_showtimes` which contains the necessary `showtime_id` for seat scraping.

---

## Failure Modes

| Failure | GitHub Action Behavior |
|---------|----------------------|
| Schema validation fails | Exit with code 1, no Firestore write |
| Token expired | Seat scrape skipped, error in logs |
| Integrity assertion fails | Exit with code 1, data not uploaded |
| Token TTL < 25 min | Seat scrape job fails fast |
