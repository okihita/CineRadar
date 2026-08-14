# ⚠️ Cloud Monitoring Alert Setup - Manual Instructions

Due to CLI limitations, alerts must be created via **Google Cloud Console**.

---

## ✅ Step 1: Notification Channel (Already Created)

**Status:** Created ✅

- **Name:** CineRadar Email Alerts
- **Email:** okihita@gmail.com
- **ID:** `projects/cineradar-481014/notificationChannels/9283699487861863296`

You can verify at: https://console.cloud.google.com/monitoring/notification-channels

---

## 🔧 Step 2: Create Alert Policies (Manual Setup via Cloud Console)

### Option A: Using Logs Explorer (Recommended - Most Reliable)

1. **Go to Logs Explorer:**
   https://console.cloud.google.com/logs/query

2. **Create 3 Log-Based Metrics:**

#### Metric 1: Critical Errors
```
Metric Name: `jit_critical_errors`
Type: Counter
Log Filter:
  resource.type="cloud_function"
  AND resource.labels.function_name="scrape-seat-jit"
  AND (severity="CRITICAL" OR protoPayload.message:"CRITICAL")
```

#### Metric 2: Warnings
```
Metric Name: `jit_warnings`
Type: Counter
Log Filter:
  resource.type="cloud_function"
  AND resource.labels.function_name="scrape-seat-jit"
  AND (severity="WARNING" OR protoPayload.message:"WARNING")
```

#### Metric 3: All Errors
```
Metric Name: `jit_all_errors`
Type: Counter
Log Filter:
  resource.type="cloud_function"
  AND resource.labels.function_name="scrape-seat-jit"
  AND severity>=ERROR
```

3. **Go to Alerting:**
   https://console.cloud.google.com/monitoring/alerting

4. **Create 3 Alert Policies:**

### Alert 1: Critical Errors
```
Policy Name: JIT Critical Errors
Condition type: Log-based metric
Metric: jit_critical_errors
Aggregation: Count
Threshold: Greater than 0
Duration: 1 minute
Notification: CineRadar Email Alerts
```

### Alert 2: High Error Rate
```
Policy Name: JIT High Error Rate (>5%)
Condition type: Log-based metric
Metric: jit_all_errors
Aggregation: Fraction (Percentage)
Threshold: Greater than 5%
Duration: 5 minutes
Notification: CineRadar Email Alerts
```

### Alert 3: No Showtimes (Business Hours)
```
Policy Name: JIT No Showtimes (Business Hours)
Condition type: Log-based metric
Metric: jit_no_showtimes
Log Filter (for metric):
  resource.type="cloud_function"
  AND resource.labels.function_name="dispatch-jit-jobs"
  AND protoPayload.numericValue:0
Aggregation: Count
Threshold: Equal to 0 for 3 consecutive windows
Duration: 15 minutes per window
Notification: CineRadar Email Alerts
```

---

### Option B: Using Resource-Based Alerts (Alternative)

1. **Go to Cloud Monitoring:**
   https://console.cloud.google.com/monitoring

2. **Create Resource-based Alerts:**

#### Alert 1: Critical Errors (Function Error Rate)
```
Resource: Cloud Function: scrape-seat-jit
Metric: Execution count (errors)
Condition: Error count > 0
Duration: 1 minute
Notification: CineRadar Email Alerts
```

#### Alert 2: High Latency (>30 seconds)
```
Resource: Cloud Function: scrape-seat-jit
Metric: Execution time (latency)
Condition: Latency > 30 seconds for 5 minutes
Notification: CineRadar Email Alerts
```

---

## 🧪 Step 3: Verify Alerts

### Test Alert Delivery

1. **Trigger a Critical Error:**
   ```bash
   gcloud functions call scrape-seat-jit \
     --data='{"showtime_id":"test-invalid","theatre_name":"TEST","showtime":"00:00","merchant":"XXI"}'
   ```

2. **Wait 2-5 minutes**

3. **Check okihita@gmail.com** - You should receive an alert

4. **Verify in Monitoring:**
   https://console.cloud.google.com/monitoring/alerting

---

## 📋 Summary of What Was Implemented

### ✅ Code Changes (All Deployed)

| Component | Status | Details |
|-----------|--------|---------|
| **Domain Model** | ✅ Deployed | Added `raw_api_response` field to `ShowtimeSnapshot` |
| **JIT Cloud Function** | ✅ Deployed | Added severity logging, schema validation, raw response storage |
| **Morning Scraper** | ✅ Pushed | Added raw API response storage |
| **CLI Tool** | ✅ Pushed | Created `inspect_showtime.py` for debugging |
| **Admin API** | ✅ Pushed | Created `/api/showtimes/[showtimeId]/raw` endpoint |
| **Daily Digest Workflow** | ✅ Pushed | Creates daily digest at 11 PM WIB |
| **Alert Monitor Workflow** | ✅ Pushed | Monitors every 10 minutes, creates GitHub Issues |

### ⚠️ Alert Policies (Manual Setup Required)

Due to CLI limitations with Google Cloud Monitoring API, **please set up alerts via Console** using instructions above.

**GitHub Workflows provide secondary monitoring**:
- Daily digest (11 PM WIB)
- Alert monitoring (every 10 minutes)

These will create GitHub Issues for anomalies detected in logs.

---

## 🎯 Alternative: Use GitHub Workflows as Primary Alerting

The GitHub workflows provide robust monitoring:

### 1. Daily Digest (11 PM WIB)
- Runs daily
- Queries Cloud Logging API
- Creates GitHub Issue if critical errors detected
- **File:** `.github/workflows/scraper-daily-digest.yml`

### 2. Alert Monitor (Every 10 min)
- Runs every 10 minutes
- Queries Cloud Logging API
- Detects: High error rate, schema failures, no showtimes
- **File:** `.github/workflows/scraper-alert-monitor.yml`

**Recommendation:** Rely on GitHub workflows for now. They are fully operational and provide good coverage.

---

## ✅ Next Steps

1. **Manual:** Set up Cloud Console alerts using Option A (Logs Explorer) or Option B (Resource-based) above

2. **Verify:** Test alert delivery using test error command

3. **Monitor:** Check okihita@gmail.com for alert emails

4. **Monitor:** Watch GitHub for Issues created by alert workflows

---

## 🚀 Everything Else Is Ready!

- ✅ Code deployed
- ✅ GitHub workflows active
- ✅ CLI tool available
- ✅ Admin API endpoint ready
- ⚠️ Cloud Console alerts (manual setup needed)
