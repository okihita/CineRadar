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
   | "Too few movies" | Scraper blocked or API down | Check TIX.id status |
   | "Validation failed" | Data incomplete | Re-run batch |
   | "Playwright timeout" | Network/site slow | Increase timeout |

3. **Check token status**
   // turbo
   ```bash
   python -m backend.infrastructure.cli token --check
   ```

4. **Run the failed batch locally**
   ```bash
   python -m backend.infrastructure.cli movies --batch FAILED_BATCH --visible
   ```
   (Use `--visible` to see what's happening in the browser)

5. **Check for API changes**
   - TIX.id may have changed their API
   - Look for 403/401 errors in logs
   - Check if selectors still match

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
