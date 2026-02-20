# TIX Token Refresh System

## Overview

This document explains how the TIX.id authentication system works and why we need token validation.

## The Problem

TIX uses JWT tokens for authentication. When we refresh a token via their API, there's a race condition:

```
Timeline:
─────────
T+0.5s: TIX generates new JWT (valid for 30 min)
T+0.5s: TIX writes session to Redis (async replication)
T+0.5s: TIX returns token to us
T+0.6s: We call layout API with the new token
T+0.7s: Layout API checks Redis ──► SESSION NOT FOUND (replication lag!)
T+0.7s: Layout API returns 401
```

The session hasn't propagated to all Redis nodes yet.

## Evidence from Feb 18, 2026

| Metric | Value |
|--------|-------|
| Jobs with refreshed token | 132 |
| Jobs where refreshed token got 401 | **119 (90%)** |
| Jobs where refreshed token worked | 13 (10%) |

The JWT itself is valid (correct `exp` claim), but the session doesn't exist in Redis yet.

## TIX Infrastructure

### How TIX Session Store Works

```
┌──────────────────────────────────────────────────────────────────┐
│                      TIX INFRASTRUCTURE                          │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Refresh API  │    │   Redis      │    │  Layout API  │       │
│  │ Server       │───►│  Session DB  │───►│  Server      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                             │                                    │
│                             │ Async replication                  │
│                             │ (can take 1-10 seconds)            │
│                             ▼                                    │
│                      Other Redis nodes                          │
└──────────────────────────────────────────────────────────────────┘
```

### Why They Use Redis Sessions

1. **Security** - Can revoke tokens instantly by deleting from Redis
2. **Context** - Store user permissions, rate limits
3. **Analytics** - Track active sessions

This is standard practice (Twitter, Instagram, GitHub all use Redis sessions).

### Why Their Implementation Has Lag

- They use async replication (fire-and-forget)
- They return the token immediately without waiting for propagation
- Their Redis cluster may span multiple data centers

## Our Solution

### State Machine

```
START → Load token → Need refresh?
              │           │
              │          Yes
              │           │
              │           ▼
              │     Acquire lock
              │           │
              │           ▼
              │     Call TIX refresh API
              │           │
              │           ▼
              │     Test token with layout API ◄─────┐
              │           │                          │
              │     ┌─────┴─────┐                    │
              │    401        200                    │
              │     │          │                     │
              │     ▼          │                     │
              │   Wait 2s      │                     │
              │     │          │                     │
              │     ▼          │                     │
              │   Retry ───────┴─────────────────────┘
              │   (max 5x)
              │     │
              │   All fail ──► Keep old token
              │     │
              │   Works ──► Save to Firestore
              │     │
              └─────┴──────► Use token for API call
```

### Implementation

In [`backend/functions/scraper/main.py`](functions/scraper/main.py), the `refresh_access_token()` function should:

1. Acquire distributed lock
2. Call TIX refresh API
3. **NEW:** Test the token with a layout API call
4. If 401, wait 2 seconds and retry (max 5 times)
5. Only save to Firestore after successful test
6. Release lock

### Why This Works

| Before | After |
|--------|-------|
| Refresh → Save → Use → 401 | Refresh → Test → Wait → Test → Works → Save → Use |
| Token maybe bad | Token always validated |
| Other scrapers affected | Other scrapers get good token |

## Configuration

- **max_instances**: 5 (from [`deploy.sh`](functions/deploy.sh))
- **Distributed lock timeout**: 60 seconds
- **Lock Wait max\_retries**: 20 attempts (with 2.0s sleep = up to 40s wait, matching token propagation time)
- **Token refresh threshold**: 25 minutes (emergency)
- **JWT validity**: 30 minutes

## Related Files

- [`functions/scraper/main.py`](functions/scraper/main.py) - Token refresh logic
- [`functions/deploy.sh`](functions/deploy.sh) - Cloud Function deployment
- [`infrastructure/token_refresher.py`](infrastructure/token_refresher.py) - CLI token refresh

## Monitoring

Watch for these metrics:
- Token propagation delay (time from refresh to first successful API call)
- 401 error rate (should be <1% after fix)
- Lock contention (should be minimal)
