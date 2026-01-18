# 🛡️ Strategic Disaster Recovery & Failure Modes

> **CTO-Level Incident Response**
> This document outlines systemic threats to the CineRadar architecture and the strategic responses required to maintain business continuity.

## 🚨 Threat Model: TIX.id Anti-Bot Escalation

**Risk Level:** Critical (P0)
**Impact:** Total Data Loss

### Scenario 1: Login Flow Change
TIX.id frequently changes their React hydration logic or login DOM structure to break scrapers.
- **Symptoms**: `ElementHandle.click: Timeout` in `token-refresh`.
- **Strategic Fix**:
    1.  **Debug Mode**: Run `backend.cli.refresh_token --visible` to visually inspect the new flow.
    2.  **Selector Strategy**: Shift from CSS classes (brittle) to XPath or Text selectors (resilient).
    3.  **Playwright Upgrade**: Update `browser_context` user-agent strings.

### Scenario 2: Cloudflare / WAF Blocking
If TIX.id introduces aggressive WAF (Cloudflare Turnstile):
- **Symptoms**: `403 Forbidden` on all API calls; "Verify you are human" in screenshots.
- **Mitigation Architecture**:
    - **Short Term**: Implement `stealth-plugin` for Playwright.
    - **Long Term**: Pivot to a **Residential Proxy Network** (e.g., BrightData).
      - *Estimated Cost*: $50/mo.
      - *Implementation*: Inject proxy config into `tix_client.py`.

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
    3.  **Upgrade**: Enable Blaze Plan (Budget Cap: $5/mo).

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
