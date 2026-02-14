# JIT Seat Scraper - Cloud Functions

Event-driven seat scraper using GCP Cloud Functions + Pub/Sub for T-15 precision at ~$1.30/month.

## Architecture

```
Cloud Scheduler (every 5 min)
         │
         ▼
    Dispatcher Function
         │ (HTTP trigger)
         ▼
    Pub/Sub Topic
         │
         ▼
    Scraper Function (max 1 instance)
         │
         ▼
    Firestore (movie_performance)
```

## Deployment

### Prerequisites
- `gcloud` CLI installed and authenticated
- Project: `cineradar-481014`

### Deploy All Components
```bash
cd backend/functions
./deploy.sh all
```

### Deploy Individual Components
```bash
./deploy.sh pubsub      # Create Pub/Sub topic
./deploy.sh dispatcher  # Deploy dispatcher function
./deploy.sh scraper     # Deploy scraper function
./deploy.sh scheduler   # Create Cloud Scheduler job
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT` | cineradar-481014 | GCP project ID |
| `REGION` | asia-southeast1 | Deployment region |
| `PUBSUB_TOPIC` | scrape-seat-jit | Pub/Sub topic name |

## Architecture & Scaling

The system uses a **Fan-out** pattern to handle variable load:

1. **Scheduler (Timer)**: Triggers the Dispatcher every 5 minutes.
2. **Dispatcher (Brain)**:
   - Queries Firestore for showtimes starting in the [T+15, T+20) minute window.
   - Example: Dispatch at 12:00 → captures showtimes from 12:15 to 12:19.
   - Publishes **one message per showtime** to Pub/Sub.
3. **Scraper (Sequential Worker)**:
   - Triggered by Pub/Sub messages.
   - **Processes sequentially** with `max-instances=1`.
   - This ensures token refresh doesn't race and avoids API rate limiting.

### Timing Precision

The T-15 window means we scrape showtimes **15 minutes before they start**:
- Early enough to capture seat availability before showtime
- Late enough to get meaningful occupancy data
- 5-minute buckets ensure no overlap or missed showtimes

## Functions

### Dispatcher (`dispatch-jit-jobs`)
- **Trigger**: HTTP (Cloud Scheduler)
- **Schedule**: Every 5 minutes, 9 AM - 11 PM WIB
- **Purpose**: Find showtimes in T+15 to T+20 window, publish to Pub/Sub

### Scraper (`scrape-seat-jit`)
- **Trigger**: Pub/Sub (`scrape-seat-jit` topic)
- **Max Instances**: 1 (sequential processing)
- **Timeout**: 60s
- **Memory**: 512MB
- **Purpose**: Scrape one showtime, save compressed layout to Firestore

## Token Management

The scraper reads the TIX.id auth token from Firestore:
```
auth_tokens/tix_jwt → { token: "...", refresh_token: "...", stored_at: "..." }
```

### Token Refresh Strategy

Token refresh is handled **exclusively by the scraper function**:

1. **Primary**: GitHub Actions workflow (`token-refresh.yml`) runs every 30 minutes
2. **Fallback**: Scraper auto-refreshes on-demand when token expires (with distributed locking)

**Note**: The dispatcher does NOT handle token refresh. It only finds and publishes showtimes to Pub/Sub. Since the dispatcher doesn't call the TIX API directly, it has no need for token management. This eliminates code duplication and prevents race conditions between dispatcher and scraper.

### Why No Token Refresh in Dispatcher

Previously, both dispatcher and scraper had token refresh logic, causing:
- Code duplication (same `TokenRefreshLock` class in both files)
- Potential race conditions when both try to refresh simultaneously
- Inconsistent retry behavior (dispatcher had no retries, scraper had 10)

Now, only the scraper handles refresh because:
- It's the only function that calls the TIX API
- It runs with `max_instances=1`, avoiding concurrent refresh attempts
- It has robust retry logic with token validation between attempts

## Cost Estimate (Updated Feb 2026)

| Resource | Monthly Usage | Cost |
|----------|---------------|------|
| Cloud Functions (Invocations) | ~350,000 | $0.00 |
| Cloud Functions (GHz-seconds) | ~560,000 | $0.38 |
| Firestore Storage | ~1.1 GB | $0.02 |
| Firestore Writes | ~360,000 | $0.90 |
| **Total** | | **~$1.30** |

## Performance Analysis

With `max-instances=1` and an estimated processing time of 2s per scrape, the system throughput is ~**30 showtimes/minute**.

| Scenario | Showtimes | Estimated Time | Status |
|----------|-----------|----------------|--------|
| **Typical** | 30 | ~1 min | ✅ Fast |
| **Peak** | 100 | ~3 min | ✅ Safe |
| **Extreme** | 200+ | ~7 min | ⚠️ May overlap |

With sequential processing (`max-instances=1`), extreme loads may overlap with the next 5-minute dispatch window. This is acceptable because:
- The dispatcher publishes to Pub/Sub, which buffers messages
- Overlapping batches have unique `batch_id`s for tracking
- Token refresh is handled within the scraper without race conditions

## Local Testing

### Dispatcher
```bash
cd dispatcher
pip install -r requirements.txt
functions-framework --target=dispatch_jobs --debug
curl -X POST http://localhost:8080
```

### Scraper
```bash
cd scraper
pip install -r requirements.txt
# Requires mock Pub/Sub message
```
