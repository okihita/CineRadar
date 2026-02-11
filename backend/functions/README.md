# JIT Seat Scraper - Cloud Functions

Event-driven seat scraper using GCP Cloud Functions + Pub/Sub for T-8 precision at ~$0.81/month.

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
    Scraper Function (max 5 concurrent)
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
   - Queries Firestore for showtimes starting in the next 8-15 minutes.
   - Publishes **one message per showtime** to Pub/Sub.
   - *Example*: 10:00 AM might have 0 tasks; 7:00 PM might have 200 tasks.
3. **Scraper (Worker Pool)**:
   - Triggered by Pub/Sub messages.
   - **Auto-scales** based on queue depth, up to `max-instances`.
   - **Current Limit**: 10 concurrent instances.

## Functions

### Dispatcher (`dispatch-jit-jobs`)
- **Trigger**: HTTP (Cloud Scheduler)
- **Schedule**: Every 5 minutes, 10 AM - 11 PM WIB
- **Purpose**: Find showtimes in T+8 to T+13 window, publish to Pub/Sub

### Scraper (`scrape-seat-jit`)
- **Trigger**: Pub/Sub (`scrape-seat-jit` topic)
- **Max Instances**: 10 (rate limiting)
- **Timeout**: 60s
- **Memory**: 512MB
- **Purpose**: Scrape one showtime, save compressed layout to Firestore

## Token Management

The scraper reads the TIX.id auth token from Firestore:
```
tokens/current → { token: "...", stored_at: "..." }
```

Token refresh is handled by existing GitHub Actions workflow (`token-refresh.yml`) which runs every 30 minutes. The scraper also implements a **collaborative locking mechanism** to refresh expired tokens on-demand if the background job fails.

## Cost Estimate (Updated Feb 2026)

| Resource | Monthly Usage | Cost |
|----------|---------------|------|
| Cloud Functions (Invocations) | ~350,000 | $0.00 |
| Cloud Functions (GHz-seconds) | ~560,000 | $0.38 |
| Firestore Storage | ~1.1 GB | $0.02 |
| Firestore Writes | ~360,000 | $0.90 |
| **Total** | | **~$1.30** |

## Performance Analysis

With `max-instances=10` and an estimated processing time of 2s per scrape, the system throughput is ~**300 showtimes/minute**.

| Scenario | Showtimes | Estimated Time | Status |
|----------|-----------|----------------|--------|
| **Typical** | 30 | ~6s | ✅ Fast |
| **Peak** | 100 | ~20s | ✅ Fast |
| **Extreme** | 400+ | ~80s | ✅ Safe (< 5 min) |

Even under extreme load (e.g., Saturday night blockbuster), the batch completes in roughly 1.5 minutes, leaving ample headroom before the next 5-minute trigger.

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
