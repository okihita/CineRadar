# CineRadar 🎬



---

![CI](https://github.com/okihita/CineRadar/actions/workflows/ci.yml/badge.svg)
![Daily Scrape](https://github.com/okihita/CineRadar/actions/workflows/daily-initial-scrape.yml/badge.svg)
![API Smoke Tests](https://github.com/okihita/CineRadar/actions/workflows/api-smoke-tests.yml/badge.svg)



## ⚡ Executive Summary

**CineRadar** is the "Bloomberg Terminal" for the Indonesian Film Industry.

It solves the "Box Office Black Box" problem by deploying a Just-In-Time (JIT) scraping engine to monitor **real-time seat occupancy** across 496+ theaters (XXI, CGV, Cinepolis) in 83 cities. This data empowers Production Houses to make data-driven decisions on marketing spend and screen allocation, moving beyond "gut feeling" and social buzz.

## 📚 Technical Manuals

Start here to understand the system.

- **[01 Architecture & Design](./docs/01_architecture_and_design.md)**: System design, Stability DNA, & token auth logic.
- **[02 Manual Setup (Production)](./docs/02_manual_setup.md)**: Strict replication guide for new engineers.
- **[03 Daily Pipeline](./docs/03_daily_pipeline.md)**: How data flows from 6 AM to Midnight (T+0).
- **[04 API Reference](./docs/04_api_reference.md)**: CLI commands & data contracts.
- **[05 Frontend Guidelines](./docs/05_frontend_guidelines.md)**: Design system & regional config.
- **[06 Troubleshooting & Recovery](./docs/06_troubleshooting.md)**: Architecture failure modes & disaster recovery.
- **[07 Product Roadmap](./docs/07_product_roadmap.md)**: Future vision & engineering "Why".
- **[08 Monitoring & Alerts](./docs/08_monitoring_and_alerts.md)**: Cloud monitoring & uptime alerts.
- **[09 Head-to-Head Comparison](./docs/09_feature_movie_comparison.md)**: Movie performance comparison feature.
- **[10 Studio Layout Specification](./docs/10_studio_layout_technical_specification.md)**: Cinema studio matrix & layout intelligence.
- **[11 Git Workflow & Branching](./docs/11_git_workflow.md)**: Monorepo scoped branching standards & hotfix protocol.
- **[12 Social Pulse Pipeline](./docs/12_social_pulse_pipeline.md)**: Social media intelligence, YouTube ingestion & AI pulse.
- **[13 Competitor Tracking & CinePoint](./docs/13_competitor_tracking_cinepoint.md)**: CinePoint scraping, matching, and benchmark engine.

### 📦 Component Guides

- **[Admin Documentation](./admin/README.md)**: Dashboard modules, Google Maps setup, & Auth.
- **[Web Documentation](./web/README.md)**: Consumer app features & Map integration.

## 🔗 Quick Access

| Environment | Application | URL |
|-------------|-------------|-----|
| **Production** | Admin Dashboard | [cineradar-admin.vercel.app](https://cineradar-admin.vercel.app) |
| **Production** | Public Web | [cineradar-id.vercel.app](https://cineradar-id.vercel.app) |
| **Staging** | *Preview Deployments* | *Check Vercel PR comments* |

---

> **Maintainer Contact**: Use the [`06_troubleshooting.md`](./docs/06_troubleshooting.md) guide for emergency protocols.
