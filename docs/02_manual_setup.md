# Production-Grade Manual Setup

> **Strict Environment Replication Guide**
> This document details the exact steps to replicate the `CineRadar` production environment locally. Deviations from these versions may result in "works on my machine" issues.

## 📋 Strict Prerequisites

Unlock the repository only if you meet these exact requirements:

| Dependency | Required Version | Reason |
|------------|------------------|--------|
| **OS** | macOS (ARM64) or Linux | Playwright binary compatibility |
| **Node.js** | `v20.10.0` (LTS Iron) | Next.js 14+ App Router stability |
| **pnpm** | `v8.15.0+` | Monorepo workspace protocol |
| **Python** | `3.12.0+` | Type hinting features used in Scraper |
| **uv** | `latest` | Python package resolution speed |

---

## 🔐 Secrets & Environment Variables

The application **will not start** without these configurations. We do not mock authentication.

### 1. File Structure
Create these files in the root directory:

- `.env` (Global public config)
- `.env.local` (Secrets - DO NOT COMMIT)
- `service-account.json` (Google Cloud Credentials)

### 2. Required Variables (`.env.local`)

| Variable | Type | Description |
|----------|------|-------------|
| `FIRESTORE_CREDENTIALS` | **Path** | Absolute path to `service-account.json` |
| `TIX_JWT` | **String** | Initial TIX.id Bearer token (from browser) |
| `TIX_REFRESH_TOKEN` | **String** | 90-day refresh token for rotation |
| `NEXT_PUBLIC_API_URL` | **URL** | `http://localhost:3000/api` (Dev) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | **String** | For rendering Heatmaps |

### 3. Google Cloud Credentials
Download the Service Account key from GCP IAM console (`cineradar-prod`) and save it as:
`./service-account.json`

> **Security Note**: This file is strictly git-ignored. Never force-add it.

---

## 🛠️ Installation (Monorepo)

We use `pnpm` workspace to manage dependencies across `admin`, `web`, and `backend`.

### 1. Bootstrap Repository
```bash
# Clone
git clone https://github.com/okihita/CineRadar.git
cd CineRadar

# Install Node dependencies (Root + Workspaces)
pnpm install

# Install Python environment
uv sync
```

### 2. Install Playwright Browsers
The scraper requires specific browser binaries:
```bash
uv run playwright install chromium
```

---

## 🚀 Execution

### Backend (Scraper & API)
Run the scraper manually to verify read/write access to Firestore:
```bash
# Verify Auth
uv run python -m backend.cli.refresh_token --check

# Test Scrape (1 City)
uv run python -m backend.cli --city BANDUNG
```

### Frontend (Admin & Web)
Start the concurrent development server:
```bash
# Starts both Admin (3000) and Web (3001)
pnpm dev
```

---

## 🩺 Verification Protocol

Before pushing any code, run this strictly typed verification:

```bash
# 1. Type Check (Frontend)
pnpm type-check

# 2. Type Check (Backend)
uv run mypy backend

# 3. Linting
pnpm lint
uv run ruff check .
```

> **Definition of Done**: If `pnpm type-check` fails, the feature is not complete.
