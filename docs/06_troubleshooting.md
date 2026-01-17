# 🔧 Operational Playbook & Troubleshooting

> 🚨 **Primary Principle**: If the scraper dies, data is lost forever. Speed of recovery is critical.

## 🔴 Critical Incidents (P0)

### Scenario: TIX.id Changes Login Flow
**Symptoms**: `token-refresh.yml` fails with "Element not found" or "Timeout".
**Response**:
1.  **Immediate**: Run `uv run python -m backend.cli.refresh_token --visible` locally to observe the new flow.
2.  **Fix**: Update selector in [`backend/infrastructure/core/tix_client.py`](../backend/infrastructure/core/tix_client.py).
3.  **Deploy**: Push to `main` instantly.

### Scenario: API Returns 403 Forbidden
**Symptoms**: All seat scrapers failing.
**Response**:
1.  **Rotate IP**: The GitHub Action IP might be blacklisted. Re-trigger the workflow to pick up a new runner.
2.  **Check Headers**: TIX.id might have updated their required `User-Agent` or encryption.

---

## 🟡 Warning Incidents (P1)

### Issue: "Token Stored With Quotes" (Historic)
**Symptom**: 401 Unauthorized despite "success" login.
**Cause**: `localStorage` JSON serialization.
**Check**: Look at Firestore `auth_tokens/tix_jwt`.
**Fix**:
```python
# refresh_token.py
token = raw_token.replace('"', '') # Strip quotes
```

### Issue: Flutter Rendering Hangs
**Symptom**: Browser opens but stays white/blank.
**Fix**: Increase `waiting_time` or use `xvfb-run` on Linux systems.

---

## 🧩 Common Error Lookup

| Error Code | Likely Cause | Solution |
|------------|--------------|----------|
| `401 INVALID_TOKEN` | Token malformed/quoted | Run `refresh_token --check` |
| `401 EXPIRED` | Token old | Manually trigger `token-refresh.yml` |
| `TIMEOUT` | Slow network/TIX down | Retry with higher timeout |
| `VALIDATION_ERR` | API Schema changed | Update Pydantic models in `schemas/` |
