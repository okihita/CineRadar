# Production-Grade Manual Setup

> **Strict Environment Replication Guide**
> This document details the exact steps to replicate the `CineRadar` production environment locally. Deviations from these versions may result in "works on my machine" issues.

## 📋 Strict Prerequisites

Unlock the repository only if you meet these exact requirements:

| Dependency | Required Version | Reason |
|------------|------------------|--------|
| **Hardware** | 8GB RAM minimum | Required for Next.js build and memory-intensive Python operations |
| **OS** | macOS (ARM64) or Linux | Standard dev environment compatibility |
| **Node.js** | `v24.0.0+` (LTS) | Next.js 16+ & Stability DNA |
| **pnpm** | `v10.0.0+` | Monorepo workspace & Catalog protocol |
| **Python** | `3.13.0+` | Backend scraping & typing engine |
| **uv** | `latest` | Python package & lockfile resolution |

---

## 🔐 Secrets & Environment Variables

Copy the template from `.env.example`:

### 1. File Structure
- **`./.env`**: Root environment file read by Python backend tools (`TIX_PHONE_NUMBER`, `TIX_PASSWORD`).
- **`./admin/.env.local`**: Next.js Studio Admin secrets (`AUTH_SECRET`, `FIREBASE_PRIVATE_KEY`, `GEMINI_API_KEY`, `CINEPOINT_REFRESH_TOKEN`).
- **`./web/.env.local`**: Public Consumer Web configuration (`NEXT_PUBLIC_FIREBASE_*`).

---

## 🛠️ Installation (Monorepo)

Bootstrap the entire stack with a single command:

```bash
# 1. Clone
git clone https://github.com/okihita/CineRadar.git
cd CineRadar

# 2. Bootstrap Node & Python environments
pnpm run setup
# (Runs pnpm install and uv sync)

# 3. Setup environment files
cp .env.example .env
cp .env.example admin/.env.local
```

---

## 🚀 Execution

### Development Server
Start the concurrent development servers:
```bash
pnpm dev
```
* 🌐 **Consumer Web**: [http://localhost:3000](http://localhost:3000)
* 🛡️ **Studio Dashboard**: [http://localhost:3001](http://localhost:3001)

### Backend (Scraper & API)
Run the scraper manually to verify read/write access to Firestore:
```bash
# Verify Auth
uv run python backend/cli/refresh_token.py --check

# Test Scrape (1 City)
uv run python backend/scripts/run_national_scrape.py
```

---

## 🩺 Verification Protocol

Before pushing any code, run this strictly typed verification:

```bash
# 1. Type Check & Production Build (Frontend)
pnpm -r type-check
pnpm -r build

# 2. Type Check & Lint (Backend)
uv run mypy backend
uv run ruff check
```

# 3. Linting
pnpm lint
uv run ruff check .
```

> **Definition of Done**: If `pnpm type-check` fails, the feature is not complete.
