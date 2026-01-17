# Manual Setup & Verification

This guide covers the manual setup steps for developers who prefer running components individually, as well as verification and diagnostic steps.

## Quick Start (Manual)

### 1. Installation

```bash
# Clone and install
git clone https://github.com/okihita/CineRadar.git
cd CineRadar

# Install Python dependencies
uv sync

# Install Playwright browsers
uv run playwright install chromium
```

### 2. Run Admin Dashboard

```bash
cd admin
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Run Frontend (Web)

```bash
cd web
npm install
npm run dev
# Open http://localhost:3000 (or 3001 if admin is running)
```

**Note on Package Locks:**
If you modify `package.json` in either `admin/` or `web/`, always run `npm install` immediately to update `package-lock.json`. CI will fail if they are out of sync.

---

## Local Server Health Check

> [!IMPORTANT]
> Before testing on localhost, verify the dev server is running.

```bash
# Check if admin dev server is running (port 3000)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "NOT RUNNING"

# Check if web dev server is running (port 3001)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "NOT RUNNING"
```

---

## Network Diagnostics

> [!TIP]
> Before debugging production issues, check local network connectivity first.

```bash
# Quick connectivity check with timing
curl -s -o /dev/null -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | Total: %{time_total}s | HTTP: %{http_code}\n" https://cineradar-admin.vercel.app/api/dashboard

# Expected: HTTP 200, Total < 3s
# If DNS > 1s or Connect > 2s, network issue likely
```
