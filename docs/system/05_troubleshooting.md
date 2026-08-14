# 🛡️ Strategic Disaster Recovery & Failure Modes

> **CTO-Level Incident Response**
> This document outlines systemic threats to the CineRadar architecture and the strategic responses required to maintain business continuity.

## 🚌 Bus Factor / Emergency Access

> **Critical**: If the Lead Maintainer is hit by a bus, use this keyset to regain control.

| Asset | Access Method | Recovery Strategy |
|-------|---------------|-------------------|
| **DNS (`cineradar.id`)** | Vercel | Contact Vercel Support with invoice proof. |
| **Database (Firestore)** | GCP Console | Use `organization-admin` service account (stored in 1Password Vault "CineRadar Ops"). |
| **TIX Account** | Phone Login | SIM card is physically located in the "Bandung Server" rack (Slot 1). |

---

## 🚨 Threat Model: TIX.id Anti-Bot Escalation

**Risk Level:** Critical (P0)
**Impact:** Total Data Loss

### Scenario 1: Login Flow Change
TIX.id frequently changes their RSA encryption keys, auth endpoints, or login payload structure.
- **Symptoms**: `403 Forbidden` or `ParseError` in `token-refresh`.
- **Strategic Fix**:
    1.  **Debug Mode**: Run `backend.cli.refresh_token` locally to inspect the HTTP API response.
    2.  **Reverse Engineer**: Check if the Public Key or encryption algorithm changed in the client bundles.
    3.  **API Upgrade**: Update the `token_refresher.py` payload to match the new format.

### Scenario 2: Cloudflare / WAF Blocking
If TIX.id introduces aggressive WAF (Cloudflare Turnstile) preventing pure HTTP requests:
- **Symptoms**: `403 Forbidden` on all API calls; Cloudflare HTML returned instead of JSON.
- **Mitigation Architecture**:
    - **Short Term**: Adjust HTTP headers (User-Agent, sec-ch-ua) to match standard browsers.
    - **Long Term**: Pivot to a **Residential Proxy Network** (e.g., BrightData).
      - *Implementation*: Inject proxy config into `httpx` clients.

---

## 📉 Threat Model: Infrastructure Limits

**Risk Level:** High (P1)
**Impact:** Partial Data Loss

### Scenario 3: Firestore Write Quota Exceeded
Free tier allows 20,000 writes/day. We operate near this limit (12k seats + 1k schedules).
- **Symptoms**: `ResourceExhausted` errors in logs.
- **Strategic Response**:
    1.  **Optimized Batching**: Ensure `populate_firestore.py` uses `batch.commit()` (max 500 writes/batch).
    2.  **Delta Compression**: Only write seat data if `status` has changed (Reducing writes by ~60%).
    3.  **Upgrade**: Enable Blaze Plan.

### Scenario 4: GitHub Actions IP Ban
B2B APIs often block data center IP ranges (Azure/AWS/GitHub).
- **Symptoms**: Consistent `403` from GitHub Actions but works locally.
- **Mitigation**:
    - **Rotate Runners**: Re-triggering the job gets a fresh IP from the GitHub pool.
    - **External Gateway**: Route requests through a cheap self-hosted proxy (DigitalOcean Droplet with static IP).

---

## 🏗️ Deployment Failure Modes

### Scenario 5: Vercel Shared Cache Corruption
Monorepo builds share `node_modules` cache. Occasionally, a dependency update breaks the cache.
- **Symptoms**: `Module not found` during build, despite `pnpm install` success.
- **Fix**:
    - **Nuke Cache**: Vercel Dashboard → Settings → Data Cache → **Purge Everything**.
    - **Re-deploy**: Force a new build without cache.

---

## 🔄 Emergency Contacts

| Service | Context | Access Level |
|---------|---------|--------------|
| **Vercel** | Hosting/DNS | Team Owner |
| **GCP** | Database/Auth | Admin |
| **TIX Support** | *Do not contact* | **N/A** (Stealth Ops) |

---

## 🐛 Debugging Seat Calculation Issues

### Problem: Occupancy shows 0% or incorrect values

**Symptoms:**
- Showtime displays 0% occupancy despite seats being sold
- Total seats calculated as 0
- Occupancy percentage seems wrong

**Root Causes:**
1. **Status code interpretation errors** (code 1 = available, 5/6 = sold)
2. **Seat type mismatches** (different seat types may have different status codes)
3. **API schema changes** (new fields or structure)
4. **Calculation logic bugs** in scraper code

**Debug Steps:**

#### 1. Inspect Raw API Response

Use the CLI tool to view the full TIX.id API response:

```bash
python backend/cli/inspect_showtime.py \
  --showtime-id <SHOWTIME_ID> \
  --movie-id <MOVIE_ID> \
  --date YYYY-MM-DD \
  --verbose
```

This shows:
- Whether `raw_api_response` exists (may be missing for legacy data)
- Seat status codes found
- Seat types detected
- Full API structure

#### 2. Access via Admin API

```http
GET /api/showtimes/[showtimeId]/raw?movieId=X&date=Y
```

Returns the complete raw response stored in Firestore.

#### 3. Check Firestore Directly

Navigate to:
```
movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}
```

Look for:
- `raw_api_response` field present?
- Status codes in the response match expected values (1, 5, 6)?
- Any unexpected seat types?

#### 4. Compare with UI

Open TIX.id website and the same showtime to visually verify:
- Does the seat layout match?
- Are sold seats marked correctly?
- Are there any maintenance/blocked seats?

#### 5. Check Cloud Logs

Filter logs for errors:
```
resource.labels.function_name="scrape-seat-jit"
severity>=WARNING
```

Look for:
- "Schema validation failed"
- "Seat type mismatch"
- "Unknown status code"

### Schema Change Detection

If the API structure changes, the schema validation will log:

```json
{
  "severity": "CRITICAL",
  "message": "seat_map is not a list - schema changed!",
  "showtime_id": "...",
  "impact": "all_scrapes_affected"
}
```

**Action Required:**
1. Update scraper logic in `backend/functions/scraper/main.py`
2. Update data models in `backend/domain/models/movie_performance.py`
3. Test with `inspect_showtime.py --verbose`
4. Deploy updated Cloud Function

### Common Issues

| Issue | Diagnosis | Fix |
|--------|------------|------|
| Total seats = 0 | Seat status codes not recognized | Check status code interpretation in `calculate_occupancy()` |
| Occupancy > 100% | Sold seats counted twice | Check status code filter logic |
| Random 0% occupancy | Some showtimes missing raw_api_response | Legacy data - re-scrape or backfill |
| All seats available | API token expired | Token refresh failed - check `auth_tokens` collection |
