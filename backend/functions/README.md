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

## Functions

### Dispatcher (`dispatch-jit-jobs`)
- **Trigger**: HTTP (Cloud Scheduler)
- **Schedule**: Every 5 minutes, 10 AM - 11 PM WIB
- **Purpose**: Find showtimes in T+8 to T+13 window, publish to Pub/Sub

### Scraper (`scrape-seat-jit`)
- **Trigger**: Pub/Sub (`scrape-seat-jit` topic)
- **Max Instances**: 5 (rate limiting)
- **Purpose**: Scrape one showtime, save compressed layout to Firestore

## Token Management

The scraper reads the TIX.id auth token from Firestore:
```
tokens/current → { token: "...", stored_at: "..." }
```

Token refresh is handled by existing GitHub Actions workflow (`token-refresh.yml`) which runs every 30 minutes.

## Cost Estimate

| Resource | Monthly Usage | Cost |
|----------|---------------|------|
| Cloud Functions (Invocations) | ~350,000 | $0.00 |
| Cloud Functions (GHz-seconds) | ~280,000 | $0.19 |
| Firestore Storage | ~1.1 GB | $0.02 |
| Firestore Writes | ~350,000 | $0.60 |
| **Total** | | **~$0.81** |

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
