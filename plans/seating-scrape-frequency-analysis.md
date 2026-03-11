# Seating Scrape Frequency Analysis

## 1. Executive Summary

This document analyzes the impact of changing the Just-In-Time (JIT) seating scrape schedule from the current two phases (`T-30`, `T-15`) to a three-phase schedule (`T-30`, `T-20`, `T-10`). The goal is to provide more granular, closer-to-showtime occupancy data without overloading our infrastructure or the target API (TIX.id).

**Key Findings (Based on Production Data from March 10, 2026):**
- **Job Volume:** Daily scraper jobs will increase by 50%, from approximately `14,938` to `22,407` jobs per day (based on ~7,469 daily showtimes).
- **Peak Load:** The maximum expected overlap in a single 5-minute dispatch window during peak hours could reach ~600-800 jobs.
- **Processing Time:** With the current configuration of `max_instances=5` on the scraper Cloud Function, peak bursts of 800 jobs would take ~10 minutes to process. This exceeds the 5-minute dispatch cycle and will cause minor queuing delays. We may need to slightly increase `max_instances` to `10` to ensure peak bursts drain within 5 minutes.
- **TIX API Load:** Peak API request rate will remain very low at ~1.3 requests per second (RPS) or ~80 RPM, which is negligible for a national ticketing service.

---

## 2. Current vs. Proposed State

### Current Schedule (March 10 Baseline)
- **Phases:** 2 (`T-30`, `T-15`)
- **Daily Showtimes Scraped:** ~7,469
- **Daily API Hits (Scrapes):** ~14,938
- **Monthly API Hits:** ~448,140
- **Success Rate:** 99.7%

### Proposed Schedule
- **Phases:** 3 (`T-30`, `T-20`, `T-10`)
- **Daily Showtimes Scraped:** ~7,469
- **Daily API Hits (Scrapes):** ~22,407
- **Monthly API Hits:** ~672,210

---

## 3. Server Load & Infrastructure Impact

### Concurrency and Dispatch Overlap
Showtimes generally cluster at the top (`:00`), quarter (`:15`), and half-hour (`:30`) marks. Moving to a `T-30`, `T-20`, `T-10` schedule means a single 5-minute dispatch window might pull jobs from multiple overlapping showtime clusters.

For example, a dispatch at 14:00 evaluates:
- **T-30 window** (14:30 shows)
- **T-20 window** (14:20 shows)
- **T-10 window** (14:10 shows)

If showtimes exist for all three slots simultaneously during evening peak hours, the dispatch could queue up to **600-800 jobs** into Pub/Sub at once.

### Cloud Function Processing Capacity
Based on system performance metrics:
- **Average processing time per scrape:** ~3.9 seconds.
- **Capacity with `max_instances=5`:** ~76.9 jobs per minute.
- **Estimated time to process peak burst (800 jobs):** ~10.4 minutes.

Because 10.4 minutes is greater than the 5-minute dispatch interval, the queue will build up during peak evening hours. The current `max_instances=5` configuration will cause scrape jobs to execute later than intended (e.g., a `T-10` scrape executing at `T-5`). 

**Recommendation:** Increase `max_instances` to `10` for the `scrape-seat-jit` Cloud Function. This doubles throughput to ~153 jobs/minute, allowing peak bursts of 800 jobs to clear in ~5.2 minutes, preserving the accuracy of our time windows.

---

## 4. TIX.id Target Server Load

It is critical to ensure we do not cause disruption to the TIX.id API. Our architecture naturally limits the maximum requests per second (RPS) using GCP Cloud Functions' concurrency controls (`--max-instances`). 

Because each scrape execution takes an average of ~3.9 seconds, limiting the maximum concurrent function instances puts a hard ceiling on our RPS and RPM (Requests Per Minute). 

Here is the deployment code snippet from `backend/functions/deploy.sh` that enforces this limit:

```bash
gcloud functions deploy scrape-seat-jit \
    --gen2 \
    --runtime=python312 \
    --region=$REGION \
    --source=. \
    --entry-point=scrape_seat \
    --trigger-topic=$PUBSUB_TOPIC \
    --max-instances=10 \  # <-- HARD LIMIT: Max 10 concurrent requests (~2.6 RPS / ~153 RPM)
    --memory=512MB \
    --timeout=180s \
    --project=$PROJECT_ID
```

- **Average Load:** 22,407 requests / 86,400 seconds = **~0.25 RPS**
- **Peak Load (Hard Capped):** With `max-instances=10`, our absolute maximum burst rate is 10 concurrent requests. 10 requests / 3.9 seconds = **~2.6 RPS (or ~153 RPM)**.

**Conclusion on API Load:**
Even at the increased rate, a hard-capped maximum of 2.6 requests per second is extremely lightweight and will not trigger rate limits or impact their platform stability.

---

## 5. Cost Implications (GCP)

Google Cloud Platform costs will increase slightly but remain within or very close to the free tier limits:
- **Cloud Function Invocations:** ~672,210/month (Free tier: 2 million/month) -> **$0.00**
- **Firestore Writes:** ~672,210/month (Free tier: 1.5 million/month or 50k/day) -> **$0.00**
- **Compute Time (GHz-seconds):** The increase to 3 phases and potentially 10 instances will increase compute time, but monthly costs are estimated to remain < $3.00/month.

**Overall estimated increase in cost:** < $1.00/month.

---

## 6. Action Plan

To implement this change, the following components will need modification:
1. **`backend/functions/dispatcher/main.py`**: Update the `get_windows()` function to yield the new three phases (`T-30`, `T-20`, `T-10`).
2. **`backend/functions/deploy.sh`**: Increase `--max-instances` to `10` for the scraper deployment.
3. **`backend/functions/scraper/main.py`**: Ensure any phase-specific fallback logic (like the graceful HTTP 400 handling for passed showtimes currently isolated to `T-15`) is extended appropriately to `T-20` and `T-10`.
4. **Firestore Schemas/Consumers**: Ensure that downstream processors (like the `sweeper` or frontend charts) can handle or expect the new phase keys (`T-30`, `T-20`, `T-10`).