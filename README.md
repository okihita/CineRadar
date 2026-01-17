# CineRadar 🎬

> **Indonesia's Cinema Intelligence Platform**
> Tracking 83 cities, real-time availability, and theatre schedules.

[![CI](https://github.com/okihita/CineRadar/actions/workflows/ci.yml/badge.svg)](https://github.com/okihita/CineRadar/actions/workflows/ci.yml)
[![Admin CI](https://github.com/okihita/CineRadar/actions/workflows/admin-ci.yml/badge.svg)](https://github.com/okihita/CineRadar/actions/workflows/admin-ci.yml)

## ⚡️ Quick Start

**Prerequisites**: Node.js 20+, Python 3.11+, `uv`

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

### 2. Run Applications
- **Backend Scraper**: `uv run python -m scraper`
- **Admin Dashboard**: `cd admin && npm install && npm run dev`
- **Consumer Web**: `cd web && npm install && npm run dev`

See [Manual Setup Guide](./docs/manual_setup.md) for detailed instructions.

## 📚 Documentation

The documentation has been organized into the `docs/` directory:

- **[Architecture & Data Flow](./docs/architecture.md)**
    - System design, token authentication flow, and database schema.
- **[API & Scraper Reference](./docs/api_reference.md)**
    - User guide for the CLI, API endpoints, and data contracts.
- **[Manual Setup Guide](./docs/manual_setup.md)**
    - Detailed installation steps, server health checks, and network tools.
- **[Frontend Guidelines](./docs/frontend_guidelines.md)**
    - Configuration for regions, colors, and Next.js best practices.
- **[Troubleshooting](./docs/troubleshooting.md)**
    - Common errors, known bugs, and fix instructions.
- **[Product Roadmap](./docs/product_roadmap.md)**
    - Strategic context, future phases, and business goals.

## 🏗 Project Structure

- **`/web`**: Consumer facing movie-browser (Next.js).
- **`/admin`**: Internal dashboard for analytics (Next.js).
- **`/backend`**: Python scraper engine (Playwright).
- **`/docs`**: Project documentation.

## 📄 License

MIT License.
