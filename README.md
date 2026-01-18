# CineRadar 🎬

> **Corporate Intelligence Platform**
> *Strictly confidential. Internal operational use only.*

---

## ⚡ Executive Summary

**CineRadar** is the "Bloomberg Terminal" for the Indonesian Film Industry.

It solves the "Box Office Black Box" problem by deploying a Just-In-Time (JIT) scraping engine to monitor **real-time seat occupancy** across 480+ theaters (XXI, CGV, Cinepolis) in 83 cities. This data empowers Production Houses to make data-driven decisions on marketing spend and screen allocation, moving beyond "gut feeling" and social buzz.

## 💰 Operational Profile

| Component | Service | Tier | Est. Cost |
|-----------|---------|------|-----------|
| **Hosting** | Vercel (Pro) | Business | $20/mo |
| **Database** | Firestore | Blaze (Pay-as-you-go) | ~$5/mo |
| **Proxies** | Residential IPs | Metered | ~$50/mo |
| **CI/CD** | GitHub Actions | Free Tier | $0 |
| **Total** | | | **~$75/mo** |

## 📚 Technical Manuals

Start here to understand the system.

- **[01 Architecture & Design](./docs/01_architecture_and_design.md)**: System design, Stability DNA, & token auth logic.
- **[02 Manual Setup (Production)](./docs/02_manual_setup.md)**: Strict replication guide for new engineers.
- **[03 Daily Pipeline](./docs/03_daily_pipeline.md)**: How data flows from 6 AM to Midnight (T+0).
- **[04 API Reference](./docs/04_api_reference.md)**: CLI commands & data contracts.
- **[05 Frontend Guidelines](./docs/05_frontend_guidelines.md)**: Design system & regional config.
- **[06 Troubleshooting (Strategic)](./docs/06_troubleshooting.md)**: Architecture failure modes & recovery.
- **[07 Product Roadmap](./docs/07_product_roadmap.md)**: Future vision & engineering "Why".

### 📦 Component Guides

- **[Admin Documentation](./admin/README.md)**: Dashboard modules, Google Maps setup, & Auth.
- **[Web Documentation](./web/README.md)**: Consumer app features & Leaflet integration.

## 🔗 Quick Access

| Environment | Application | URL |
|-------------|-------------|-----|
| **Production** | Admin Dashboard | [cineradar-admin.vercel.app](https://cineradar-admin.vercel.app) |
| **Production** | Public Web | [cineradar-id.vercel.app](https://cineradar-id.vercel.app) |
| **Staging** | *Preview Deployments* | *Check Vercel PR comments* |

---

> **Maintainer Contact**: Use the [`06_troubleshooting.md`](./docs/06_troubleshooting.md) guide for emergency protocols.
