# JIT Seat Scraper: Cloud Functions Architecture

**Final Decision**: Use **GCP Cloud Functions + Pub/Sub** for T-8 precision scraping at near-zero cost.

---

## 1. The Problem

We need to scrape **11,721 showtimes/day**, capturing seat data **5-10 minutes before each show starts** (T-8).

### Traffic Distribution (15-Min Windows)

```text
Time  | Count | Load (1 char ≈ 22 showtimes)
10:00 | 5     | .
11:30 | 33    | #
11:45 | 54    | ##
12:00 | 528   | #######################
12:30 | 540   | ########################
14:15 | 525   | #######################
14:30 | 462   | ####################
16:30 | 663   | ############################## (PEAK)
16:45 | 477   | #####################
18:30 | 513   | #######################
18:45 | 568   | #########################
20:45 | 385   | #################
21:00 | 471   | #####################
```

**Peak Load**: **663 showtimes** in 15 minutes (16:30-16:45)

### Constraints
1. **Precision**: Must scrape at T-8 (not T-60)
2. **Cost**: Minimize monthly spend
3. **Safety**: Max 1-2 req/s to TIX.id (avoid blocking)

---

## 2. The Math

### Scrape Speed
- **1.3 seconds** per showtime (1.0s rate limit + 0.3s overhead)

### Why GitHub Actions Fails
- **Required**: ~6,000 mins/month for hourly + parallel batches
- **Free Tier**: 2,000 mins/month
- **Overage Cost**: ~$32/month
- **Granularity**: Only T-60 (hourly runs)

### Why Cloud Functions Wins
- **Invocations**: 351,630/month (well within 2M free tier)
- **Cost**: **~$0.20/month** (GHz-seconds overage only)
- **Granularity**: **Perfect T-8** (event-driven per showtime)
- **Safety**: Built-in concurrency control

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUD SCHEDULER                         │
│              Runs every 5 minutes (6 AM - 11 PM)            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Trigger
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              DISPATCHER FUNCTION (Python)                   │
│  1. Query Firestore: schedules/{today}/movies               │
│  2. Filter showtimes starting in [now+8, now+13] mins       │
│  3. Publish message per showtime to Pub/Sub                 │
└────────────────────────┬────────────────────────────────────┘
                         │ Pub/Sub Messages
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    PUB/SUB TOPIC                            │
│                   "scrape-seat-jit"                         │
│              (Queue with retry policy)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ Event Trigger (max 5 concurrent)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              SCRAPER FUNCTION (Python)                      │
│  1. Receive showtime_id from Pub/Sub                        │
│  2. Call TIX.id API (with stored token)                     │
│  3. Parse seat layout                                       │
│  4. Save to Firestore: movie_performance/.../showtimes/     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow

### Step 1: Scheduler Triggers (Every 5 Minutes)
```
Cloud Scheduler → POST /dispatch-jobs
```

### Step 2: Dispatcher Queries & Publishes
```python
# Pseudo-code
now = datetime.now()
window_start = now + timedelta(minutes=8)
window_end = now + timedelta(minutes=13)

for movie in firestore.collection('schedules/{today}/movies'):
    for showtime in movie.all_showtimes:
        if window_start <= showtime.time <= window_end:
            pubsub.publish('scrape-seat-jit', {
                'showtime_id': showtime.id,
                'movie_id': movie.id,
                'time': showtime.time
            })
```

**Output**: ~50-100 messages per 5-min run (varies by time of day)

### Step 3: Pub/Sub Fans Out
- Messages queued
- Cloud Functions auto-scales (max 5 concurrent instances)
- Each instance processes 1 showtime

### Step 4: Scraper Executes
```python
def scrape_seat(event, context):
    data = json.loads(base64.b64decode(event['data']))
    showtime_id = data['showtime_id']
    
    # Call TIX.id API
    token = get_stored_token()
    layout = tix_api.get_seat_layout(showtime_id, token)
    
    # Save to Firestore
    snapshot = ShowtimeSnapshot(
        showtime_id=showtime_id,
        occupancy_pct=calculate_occupancy(layout),
        sold_seats=count_sold(layout),
        total_seats=count_total(layout),
        scraped_at=datetime.now()
    )
    firestore.save(f'movie_performance/{movie_id}/days/{date}/showtimes/{showtime_id}', snapshot)
```

---

## 5. Cost Breakdown (Monthly)

| Resource | Usage | Free Tier | Overage | Cost |
|----------|-------|-----------|---------|------|
| **Invocations** | 351,630 | 2,000,000 | 0 | $0.00 |
| **GB-Seconds** | 175,815 | 400,000 | 0 | $0.00 |
| **GHz-Seconds** | 281,000 | 200,000 | 81,000 | **$0.19** |
| **Networking** | 3.5 GB | 5 GB | 0 | $0.00 |
| **Pub/Sub** | 3.5 MB | 10 GB | 0 | $0.00 |
| **Scheduler** | 1 Job | 3 Jobs | 0 | $0.00 |

**Total: ~$0.20/month**

### Calculation Details
- **Invocations**: 11,721/day × 30 = 351,630
- **Duration**: 2s avg (startup + API call)
- **Memory**: 256 MB
- **CPU**: 0.4 GHz (default for 256MB)
- **GHz-Seconds**: 351,630 × 2s × 0.4 = 281,304
- **Overage**: 281,304 - 200,000 = 81,304 × $0.0000024 = **$0.19**

---

## 6. Safety: Rate Limiting

### Concurrency Control
```yaml
# function.yaml
runtime: python312
entry_point: scrape_seat
max_instances: 5  # ← KEY: Limits to 5 concurrent scrapers
timeout: 10s
```

**Result**: Max 5 req/s to TIX.id (well within safe limits)

### Peak Load Handling
- **16:30 Peak**: 663 showtimes in 15 mins
- **With max_instances=5**: 663 / 5 = 133 seconds = **2.2 minutes**
- **Safety Buffer**: 15 min window - 2.2 min = **12.8 min buffer** ✅

---

## 7. Implementation Checklist

- [ ] Create Pub/Sub topic: `scrape-seat-jit`
- [ ] Deploy `dispatcher` function (HTTP trigger)
- [ ] Deploy `scraper` function (Pub/Sub trigger, max_instances=5)
- [ ] Create Cloud Scheduler job (every 5 mins, 6 AM - 11 PM WIB)
- [ ] Test with 1-hour window first
- [ ] Monitor logs for rate limit errors
- [ ] Gradually reduce window to 5 mins

---

## 8. Comparison Table

| Approach | Cost/Mo | Granularity | DDoS Risk | Maintenance |
|----------|---------|-------------|-----------|-------------|
| GitHub Actions (Hourly) | $0 | T-60 | Low | None |
| GitHub Actions (30-min) | $34 | T-30 | Low | None |
| **Cloud Functions** | **$0.20** | **T-8** ✅ | **Very Low** | **Minimal** |
| Self-Hosted VPS | $5 | T-8 | Low | High |
| Cloud Run (Jobs) | $4.10 | T-60 | Low | Low |

**Winner**: Cloud Functions for best cost/precision/safety balance.
