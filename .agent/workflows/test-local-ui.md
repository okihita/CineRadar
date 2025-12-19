---
description: How to test admin UI locally (check server running first)
---

# Test Local UI Workflow

> **IMPORTANT**: Always verify local server is running before testing

## Pre-flight Check

// turbo
```bash
# Check if admin server is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "ADMIN NOT RUNNING"
```

If "ADMIN NOT RUNNING", start the server first:

```bash
cd /Users/okihita/ArcaneSanctum/CineRadar/admin && npm run dev
```

Wait for "Ready" message before proceeding.

## Test Production Instead

If local server is problematic, test production:

// turbo
```bash
curl -s -o /dev/null -w "HTTP: %{http_code} | Time: %{time_total}s" https://cineradar-admin.vercel.app/api/dashboard
```

## Compare Pages

Use browser to visually compare:
- Dashboard: `/`
- Cinema Intelligence: `/cinemas`
- Movie Intelligence: `/movies`

Look for theme inconsistencies (dark/light mode, colors, card styles).
