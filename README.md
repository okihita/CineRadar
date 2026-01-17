# CineRadar 🎬

> **Private Corporate Intelligence Platform** (Rekreasi.co)
> *Strictly confidential. For internal use only.*

## 🎯 Project Goals

**CineRadar** is a specialized cinema intelligence platform designed for **Rekreasi.co**. Our primary mission is to decode the Indonesian film market by bridging the gap between digital buzz and actual ticket sales.

### Core Objectives
1.  **Granular Data Collection**: Scrape real-time seat availability from `app.tix.id` for every single showtime across 83 cities.
2.  **Cross-Dimensional Analysis**: Correlate box office performance with external marketing signals:
    -   **Google Trends**: Search volume spikes vs. ticket sales.
    -   **TikTok/Social Trends**: Viral momentum vs. theatre occupancy.
    -   **Regional Nuances**: City-level performance disparities.
3.  **Data-Driven Decisions**: Empower production houses and marketers to optimize screen allocation and ad spend based on hard occupancy data, not just "buzz".

## 🌟 Key Features

### 🕷️ Per-Showtime Seat Scraping
Unlike generic scrapers that only track movie availability, CineRadar performs a **JIT (Just-In-Time) Deep Scrape**:
-   **Granularity**: Tracks every individual seat (Available vs. Sold/Blocked).
-   **Coverage**: 83 Cities, 480+ Theatres (XXI, CGV, Cinepolis).
-   **Frequency**: 15-minute intervals for high-velocity releases.

### 📊 Corporate Intelligence Dashboard
-   **Live Occupancy Heatmaps**: Visualize hot/cold regions in real-time.
-   **Competitor Analysis**: Track rival film performance side-by-side.
-   **Trend Correlation**: Overlay marketing campaign timestamps on sales graphs.

## 🏗 Architecture & Tech Stack

This project uses a high-performance scraping engine feeding a modern analytics dashboard.

-   **Backend**: Python 3.11+ (Playwright, Pydantic)
-   **Database**: Google Cloud Firestore (NoSQL)
-   **Frontend**: Next.js 16 / React 19 (Admin Dashboard & Consumer Web)
-   **Infrastructure**: GitHub Actions (CI/CD & Cron Jobs), Vercel (Hosting)
-   **More Info**: [Architecture & Data Flow](./docs/01_architecture_and_design.md)

[![CI](https://github.com/okihita/CineRadar/actions/workflows/ci.yml/badge.svg)](https://github.com/okihita/CineRadar/actions/workflows/ci.yml)

---

## ⚡️ Quick Start (Dev)

**Prerequisites**: Node.js 20+, Python 3.11+, `uv`

### 1. Installation
```bash
git clone https://github.com/okihita/CineRadar.git
cd CineRadar

# Install Python dependencies
uv sync

# Install Playwright browsers
uv run playwright install chromium
```

### 2. Run Applications
-   **Backend Scraper**: `uv run python -m scraper`
-   **Admin Dashboard**: `cd admin && npm install && npm run dev`
-   **Consumer Web**: `cd web && npm install && npm run dev`

See [Manual Setup Guide](./docs/02_manual_setup.md) for detailed instructions.

---

## 📚 Documentation Index

-   **[Architecture & Data Flow](./docs/01_architecture_and_design.md)**: System design & token auth.
-   **[Manual Setup Guide](./docs/02_manual_setup.md)**: Detailed installation & verification.
-   **[Daily Pipeline](./docs/03_daily_pipeline.md)**: How data flows from 6 AM to Midnight.
-   **[API & Scraper Reference](./docs/04_api_reference.md)**: CLI usage & contracts.
-   **[Frontend Guidelines](./docs/05_frontend_guidelines.md)**: UI/UX standards & regions.
-   **[Troubleshooting](./docs/06_troubleshooting.md)**: Fixes for common issues.
-   **[Product Roadmap](./docs/07_product_roadmap.md)**: Strategic vision & future phases.
