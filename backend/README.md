# CineRadar Backend 🐍

> **The Scraper & API Engine**
> Powered by Python 3.12, Playwright, and Firestore.

## ⚡ Quick Start

We use `uv` for lightning-fast package management.

### 1. Install Environment
```bash
uv sync
uv run playwright install chromium
```

### 2. Run Scraper (Test Mode)
Scrape a single city to verify the pipeline:
```bash
uv run python -m backend.cli --city BANDUNG
```

### 3. Check Auth Status
Verify your TIX.id token is valid:
```bash
uv run python -m backend.cli.refresh_token --check
```

---

## 📚 Documentation Index

- **[API & commands Reference](../docs/04_api_reference.md)**: Full list of CLI arguments and flags.
- **[Architecture](../docs/01_architecture_and_design.md)**: Understanding the data flow.
- **[Troubleshooting](../docs/06_troubleshooting.md)**: What to do if TIX.id blocks us.

## 🛠 Development

### Linting & Typing
Strict typing is enforced.

```bash
# Type check
uv run mypy backend

# Linter
uv run ruff check .
```

### Folder Structure
- `cli/`: Entry points for all commands.
- `infrastructure/`: Core logic (Scraper, Firestore adapter).
- `schemas/`: Pydantic models (Data Contracts).
- `domain/`: Business logic.
