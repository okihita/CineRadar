# CineRadar 🎬



---

![CI](https://github.com/okihita/CineRadar/actions/workflows/ci.yml/badge.svg)
![Daily Scrape](https://github.com/okihita/CineRadar/actions/workflows/daily-initial-scrape.yml/badge.svg)
![API Smoke Tests](https://github.com/okihita/CineRadar/actions/workflows/api-smoke-tests.yml/badge.svg)



## ⚡ Executive Summary

**CineRadar** is the "Bloomberg Terminal" for the Indonesian Film Industry.

It solves the "Box Office Black Box" problem by deploying a Just-In-Time (JIT) scraping engine to monitor **real-time seat occupancy** across 496+ theaters (XXI, CGV, Cinepolis) in 83 cities. This data empowers Production Houses to make data-driven decisions on marketing spend and screen allocation, moving beyond "gut feeling" and social buzz.

## 📚 Documentation Hub

Explore the technical manuals in [`docs/`](./docs/README.md):

* **⚙️ [System & Architecture](./docs/README.md#-1-system--operations-docssystem)**:
  * [`01 Architecture & Design`](./docs/system/01_architecture.md) — High-level architecture, Stability DNA & Firestore V2.
  * [`02 Setup & Deploy`](./docs/system/02_setup_and_deploy.md) — Environment setup & GCP replication.
  * [`03 Daily Pipeline`](./docs/system/03_daily_pipeline.md) — 6 AM to Midnight (T+0) scraping dataflow.
  * [`07 Git Workflow`](./docs/system/07_git_workflow.md) — Monorepo scoped branching & release standards.
* **🎬 [Features & Intelligence](./docs/README.md#-2-feature-specifications-docsfeatures)**:
  * [`02 Studio Layout`](./docs/features/02_studio_layout.md) — Studio dashboard layout & telemetry matrix.
  * [`03 Competitor Tracking`](./docs/features/03_competitor_tracking.md) — CinePoint box office & director rankings.
  * [`04 Social Pulse`](./docs/features/04_social_pulse.md) — Viral social & YouTube sentiment intelligence.
  * [`05 Movie Comparison`](./docs/features/05_movie_comparison.md) — Multi-film occupancy benchmark engine.
* **🕵️ [Scraping Intel & Payloads](./docs/README.md#-3-scraping-intelligence-docsintel)**: [TIX ID](./docs/intel/tixid/), [Twitter](./docs/intel/twitter/), [CinePoint](./docs/intel/cinepoint/).

### 📦 Component Guides
- **[Admin Documentation](./admin/README.md)**: Studio dashboard modules, Google Maps setup & NextAuth.
- **[Web Documentation](./web/README.md)**: Consumer application features & live showtimes.

## 🔗 Quick Access

| Environment | Application | URL |
|-------------|-------------|-----|
| **Production** | Admin Dashboard | [cineradar-admin.vercel.app](https://cineradar-admin.vercel.app) |
| **Production** | Public Web | [cineradar-id.vercel.app](https://cineradar-id.vercel.app) |
| **Staging** | *Preview Deployments* | *Check Vercel PR comments* |

---

> **Emergency Protocol**: Use the [`05_troubleshooting.md`](./docs/system/05_troubleshooting.md) playbook for incident recovery.
