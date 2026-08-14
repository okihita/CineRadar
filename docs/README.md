# CineRadar Documentation Hub 📚

Welcome to the CineRadar technical documentation library. All documentation is structured into four focused domains to keep cognitive load low and information easily accessible.

---

## 🧭 Documentation Map

```text
docs/
├── system/     # ⚙️ Core architecture, cloud functions, pipelines, deployment & ops
├── features/   # 🎬 Studio dashboard modules, competitor tracking & intelligence
├── intel/      # 🕵️ Reverse-engineered scraping APIs, schema definitions & payloads
└── archive/    # 📦 Historical implementation plans, migration logs & forensic audits
```

---

## ⚙️ 1. System & Operations (`docs/system/`)
Foundational system design, backend scraping pipelines, deployment, and developer workflow:

* **[`01_architecture.md`](./system/01_architecture.md)** — High-level architecture, Firestore V2 schema design, and Stability DNA.
* **[`02_setup_and_deploy.md`](./system/02_setup_and_deploy.md)** — Local environment setup, environment keys, and GCP deployment.
* **[`03_daily_pipeline.md`](./system/03_daily_pipeline.md)** — The 6:00 AM $\rightarrow$ Midnight daily data pipeline and Cloud Scheduler cron jobs.
* **[`04_api_reference.md`](./system/04_api_reference.md)** — Backend scraping CLI commands and data contracts.
* **[`05_troubleshooting.md`](./system/05_troubleshooting.md)** — Disaster recovery, token refresh errors, and operational playbook.
* **[`06_monitoring_and_alerts.md`](./system/06_monitoring_and_alerts.md)** — Cloud monitoring, uptime alerts, and telemetry.
* **[`07_git_workflow.md`](./system/07_git_workflow.md)** — Monorepo Scoped Branching (`<type>/<scope>/<name>`) & Conventional Commits.
* **[`08_roadmap.md`](./system/08_roadmap.md)** — Product roadmap and technical evolution milestones.

---

## 🎬 2. Feature Specifications (`docs/features/`)
Deep-dive specifications for consumer and studio intelligence features:

* **[`01_frontend_guidelines.md`](./features/01_frontend_guidelines.md)** — Design system tokens, Tailwind CSS styling, and regional configurations.
* **[`02_studio_layout.md`](./features/02_studio_layout.md)** — Studio dashboard layout, responsive matrix, and component hierarchy.
* **[`03_competitor_tracking.md`](./features/03_competitor_tracking.md)** — CinePoint integration, daily box office, admissions backfill & director rankings.
* **[`04_social_pulse.md`](./features/04_social_pulse.md)** — Viral Twitter/X & YouTube data ingestion, summarization, and sentiment pulse.
* **[`05_movie_comparison.md`](./features/05_movie_comparison.md)** — Head-to-head film occupancy comparisons and multi-film benchmark engine.

---

## 🕵️ 3. Scraping Intelligence (`docs/intel/`)
Reverse-engineering network captures, endpoint definitions, and schema structures:

* **[`intel/tixid/`](./intel/tixid/)** — TIX ID API reverse-engineering payloads, schema models, and request definitions.
* **[`intel/twitter/`](./intel/twitter/)** — Twitter/X scraper network requests and JSON sample datasets.
* **[`intel/cinepoint/`](./intel/cinepoint/)** — CinePoint API network requests, authentication responses, and endpoint intelligence.

---

## 📦 4. Archive (`docs/archive/`)
Historical blueprints, forensic investigation reports, and migration logs:

* **[`archive/plans/`](./archive/plans/)** — Completed implementation plans (Predictor UX, Movie Details, CinePoint Backfill).
* **[`archive/audits/`](./archive/audits/)** — Historical forensic audits (e.g. 2026-04-11 CGV identity collision).
* **[`archive/v1_migration/`](./archive/v1_migration/)** — Historical V1 $\rightarrow$ V2 database schema migration blueprints and forensics.
