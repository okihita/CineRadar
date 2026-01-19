# Backend Structure Reorganization Analysis

## Goal
Reduce cognitive load by better organizing `backend/` and `functions/` code. Determine if `backend/` should be renamed to `scraper/`.

## 1. The Monolith (`backend/cloud-functions`)
Move `functions/` inside `backend/`.

```
backend/
├── app/             # Core logic
├── cloud-functions/ # New location
│   ├── dispatcher/
│   └── scraper/
└── cli/
```

- **Values**: Keeps all Python code in one place.
- **Pros**: Clear "one backend" mental model. Easy code sharing (imports).
- **Cons**: Deployment context gets messy (uploading whole `backend/` to Cloud Functions?).
- **Score**: 7/10

## 2. The Functional Split (`scraper/` + `api/`)
Rename `backend/` to `scraper/` and keep functions inside or separate.

```
scraper/           # Was backend/
├── core/          # Shared logic
├── cli/           # Local CLI
└── functions/     # Cloud Functions
    ├── dispatcher/
    └── scraper/
```

- **Values**: Accurate naming (if it only scrapes).
- **Pros**: Semantic clarity. "Scraper" is what it does.
- **Cons**: "Backend" usually implies API too. If you add an API later, `scraper/` is wrong.
- **Score**: 8/10

## 3. The Package Pattern (`backend/functions` as entrypoints)
Treat Cloud Functions just like CLI entrypoints.

```
backend/
├── src/           # Core logic (domain, transport, etc.)
├── cli/           # CLI entrypoints
└── functions/     # Cloud Function entrypoints (shim only)
    ├── main.py    # Imports from src/
    └── requirements.txt
```

- **Values**: Cloud Functions are just another interface (like CLI) to the core logic.
- **Pros**: Cleanest architecture. Max code reuse. `functions/` stays minimal.
- **Cons**: Deployment requires careful packaging (copying `src/` or setting PYTHONPATH).
- **Score**: 9/10

## 4. The Workspace (Monorepo stye)
Keep them top-level but grouped logically.

```
/
├── apps/
│   ├── admin/
│   └── web/
├── packages/
│   └── scraper-core/ # Shared python code
└── services/
    ├── dispatcher/   # Cloud Function
    └── scraper-worker/ # Cloud Function
```

- **Values**: Enterprise-grade separation.
- **Pros**: Very scalable. Clear boundaries.
- **Cons**: High overhead for a small team/one-person project. Overkill.
- **Score**: 5/10

## 5. The "Serverless First" (`backend/` IS functions)
Refactor `backend` so the top level *is* the functions structure.

```
backend/
├── dispatcher/    # Deployable unit
├── scraper/       # Deployable unit
├── shared/        # Shared lib
└── run_cli.py     # CLI Wrapper
```

- **Values**: Optimized for Cloud Run/Functions deployment.
- **Pros**: Easy deployment. Native structure for GCP.
- **Cons**: Makes local development/CLI awkward.
- **Score**: 6/10

---

## Verdict: Option 3 (The Package Pattern) within `scraper/` (Option 2)

**Decision**: 
1. Rename `backend/` to `scraper/` (since it really is just the scraping engine).
2. Move `functions/` inside `scraper/interface/functions`.
3. Treat Cloud Functions as just another interface alongside `cli`.

### New Structure

```
scraper/
├── pyproject.toml
├── src/
│   ├── domain/       # Models
│   ├── infrastructure/ # Firestone, TIX API
│   └── services/     # Scraper logic
├── interface/
│   ├── cli/          # Existing CLI
│   └── functions/    # cloud-functions (shim entrypoints)
│       ├── dispatcher/
│       └── worker/
├── deploy.sh
└── README.md
```

**Why?**
- **Semantic**: It tells you exactly what this codebase is: a Scraper.
- **Cognitive Load**: Everything related to scraping is in one folder.
- **Architecture**: Separates "Core Logic" (`src`) from "How it's run" (`cli` vs `functions`).

### Migration Plan
1. `git mv backend scraper` (Renaming)
2. `mkdir -p scraper/interface/functions`
3. Move `functions/` contents into `scraper/interface/functions`
4. Update `deploy.sh` paths.
5. Update GitHub Actions paths.
