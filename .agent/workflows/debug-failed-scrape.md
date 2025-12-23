---
description: How to debug a failed scrape in GitHub Actions
---

# Debug Failed Scrape Workflow

## Steps

1. **Check GitHub Actions logs**
   - Go to https://github.com/YOUR_REPO/actions
   - Find the failed run
   - Check which step failed

2. **Common failure patterns**

   | Error | Likely Cause | Fix |
   |-------|--------------|-----|
   | "Token expired" | Token TTL too short | Run token refresh manually |
   | "Auth token expired" | Seat API token invalid | Refresh token (see below) |
   | "Too few movies" | Scraper blocked or API down | Check TIX.id status |
   | "Validation failed" | Data incomplete | Re-run batch |
   | 404 on seat API | Wrong API domain | Use `api-b2b.tix.id` |
   | 401 Invalid Token | Token has extra quotes | Scraper should strip them |

---

## Seat Scraper Debugging

### Quick Test
// turbo
```bash
export $(cat .env | xargs)
python -m backend.cli.cli seats --limit 1 --use-stored-token --city AMBON
```

### Check Token Status
// turbo
```bash
python -m backend.cli.refresh_token --check
```

### Refresh Token (if expired)
```bash
python -m backend.cli.refresh_token --visible --debug-screenshots
```

### Seat API Reference
- **Endpoint**: `https://api-b2b.tix.id/v1/movies/{merchant}/layout`
- **Params**: `show_time_id=..., tz=7`
- **Status codes**: 1=sold, 5=available, 6=blocked

> **CRITICAL**: Use `api-b2b.tix.id`, NOT `api.tix.id`!

### Full Documentation
See `docs/SEAT_SCRAPER.md` for comprehensive API details, token management, and troubleshooting.

---

## Movie Scraper Debugging

### Check token status
// turbo
```bash
python -m backend.cli.refresh_token --check
```

### Run the failed batch locally
```bash
python -m backend.cli.cli movies --batch FAILED_BATCH --visible
```
(Use `--visible` to see what's happening in the browser)

### Check for API changes
- TIX.id may have changed their API
- Look for 403/401 errors in logs
- Check if selectors still match

---

## Re-running

```bash
# Re-run workflow via GitHub CLI
gh workflow run daily-scrape.yml

# Or trigger specific job
gh run rerun RUN_ID --job JOB_ID
```

## Logs Location

- Batch output: `artifacts/batch_N/`
- Merged output: `artifacts/merged/`
- Seat data: `artifacts/seats/`
