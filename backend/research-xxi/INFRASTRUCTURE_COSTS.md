# Infrastructure Analysis: GitHub Actions vs GCP Cloud Functions

This document analyzes the cost, performance, and strategic viability of hosting the new M-Tix scraper on GitHub Actions versus Google Cloud Platform (GCP) Cloud Functions (or Cloud Run).

## 1. Current State: The TIX ID GitHub Actions Scraper
The existing `daily-initial-scrape.yml` uses a single runner strategy:
- **Frequency:** Once daily (06:00 WIB).
- **Concurrency:** Single Ubuntu runner.
- **Dependencies:** Installs Python 3.12 and `uv` (fast initialization).
- **Timeout Limit:** 30 minutes per job.

### 1.1 GitHub Actions Quota Analysis
- **Free Tier:** GitHub provides **2,000 minutes/month** of free Ubuntu runner time for private repositories.
- **Current Burn Rate (Estimated):**
  - The single job takes ~10-15 minutes to run.
  - **Monthly Total:** ~450 minutes/month.
- **Conclusion:** The current TIX ID scraper comfortably fits within the GitHub free tier.

## 2. Workload Estimation for the M-Tix Scraper
Unlike previous browser-based scrapers, the M-Tix scraper requires **Zero Browser Overhead**. It is purely making AES-encrypted HTTP `GET`/`POST` requests.

### 2.1 Performance Profile
- **Phase 1 & 2 (Now Playing + Details):** ~100 HTTP requests. Execution time: < 30 seconds.
- **Phase 3 (Schedules):** ~150-300 HTTP requests. Execution time: < 2 minutes.
- **Phase 4 (Live Seats - Optional):** Variable, but purely REST APIs.

Because the bottleneck is purely network I/O and M-Tix API rate limiting, the execution time is incredibly fast, meaning a simple single runner on GitHub Actions is more than sufficient.

## 3. Cost & Architecture Comparison

### Option A: Hosting on GitHub Actions
**Pros:**
- **Zero Configuration:** Native to the existing monolithic repo setup.
- **Unified Alerting:** Can reuse the existing `failure-reporter.yml`.
- **Free (Subject to Quota):** Adding a 3-minute M-Tix job to the daily run only consumes ~90 minutes/month.

**Cons:**
- **Inflexible Scheduling:** Actions cron jobs can be delayed by up to 30-60 minutes during peak GitHub load.
- **Poor for Real-Time (Seats):** If we want to scrape seats every 30 minutes, GitHub Actions will quickly exhaust the 2,000-minute quota.

### Option B: Hosting on GCP Cloud Functions (Gen 2) / Cloud Run
**Pros:**
- **Free Tier is Massive:** GCP allows **2,000,000 invocations** and **400,000 GB-seconds** per month for *free*.
- **Perfect Fit for REST APIs:** Since M-Tix doesn't require a browser, a lightweight Python/Node wrapper will cold-start in < 1 second.
- **Micro-Scheduling:** Cloud Scheduler can trigger the function every 15 minutes perfectly for live-seat tracking.
- **Cost:** Practically $0.00 indefinitely for this specific workload.

**Cons:**
- **Infrastructure Overhead:** Requires deploying outside the GitHub mono-repo flow (though CI/CD can be set up via Actions pushing to GCP).
- **Secrets Management:** Must manage the `FIREBASE_SERVICE_ACCOUNT` securely in Google Secret Manager rather than GitHub Secrets.

## 4. Final Recommendation

### 1. For the Baseline Scrape (Schedules & Metadata)
**Verdict: Stay on GitHub Actions.**
Since we are only scraping baseline schedules once or twice a day, append a new workflow (`mtix-daily-scrape.yml`) next to the existing TIX ID action. Because it's pure HTTP, it will resolve in < 3 minutes on a single runner (no 9-batch matrix needed), meaning it will barely dent the quota limit.

### 2. For the Live-Seat Occupancy Polling
**Verdict: Move to GCP Cloud Functions.**
If the goal is to track opening weekend capacities by polling `getSeatsLayout` every 15–30 minutes, GitHub Actions is the wrong tool. Polling 48 times a day on Actions will destroy the 2,000-minute free tier. 
A GCP Cloud Function triggered by Cloud Scheduler is perfectly designed for this. It costs $0 under the generous free tier, handles network bound I/O excellently, and doesn't require the massive browser overhead that the older scrapers demand.
