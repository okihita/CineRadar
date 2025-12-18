---
description: How to run a local movie scrape for development
---

# Run Local Scrape Workflow

## Quick Start

// turbo
```bash
cd /Users/okihita/ArcaneSanctum/CineRadar
```

## Steps

1. **Activate virtual environment**
   ```bash
   source venv/bin/activate
   ```

2. **Run scrape for a single city (fast)**
   // turbo
   ```bash
   python -m backend.infrastructure.cli movies --city JAKARTA --schedules --local
   ```

3. **Run scrape for a batch**
   ```bash
   python -m backend.infrastructure.cli movies --batch 0 --total-batches 9 --schedules
   ```

4. **Validate the output**
   // turbo
   ```bash
   python -m backend.infrastructure.cli validate --file data/movies_$(date +%Y-%m-%d).json
   ```

## Options

| Flag | Description |
|------|-------------|
| `--city CITY` | Scrape specific city only |
| `--schedules` | Include showtime data |
| `--visible` | Show browser window |
| `--local` | Save to file only, no Firestore |
| `--batch N` | Run batch N of total-batches |

## Output

- Files saved to `data/movies_YYYY-MM-DD.json`
- Batch files: `data/batch_N_YYYY-MM-DD.json`
