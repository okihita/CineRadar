# CineRadar — AI Agent Instructions & Repository Rules

Welcome to the CineRadar repository. This document defines the engineering standards, Git workflow, monorepo protocols, and safety guidelines for all AI agents working on this codebase.

---

## 1. Monorepo Structure & Scopes

CineRadar is a monorepo consisting of three primary applications and cloud services:

* **`studio/`** (`studio`): Next.js 16 (Turbopack, Tailwind CSS v4, React 19, SWR, NextAuth) Studio Dashboard.
* **`web/`** (`web`): Next.js 16 (Turbopack, Tailwind CSS v4, React 19) Consumer Web Application.
* **`backend/`** (`backend` / `functions`): Python 3.13 (`uv`, `httpx`, `pydantic`, Google Cloud Firestore 2.28) scraping engine and Gen 2 Cloud Functions (`dispatcher`, `sweeper`, `scrape-seat-jit`).
* **`docs/`** (`docs`): Official technical manuals (01 through 13).

---

## 2. Git Branching Standard

All branches created in this repository must follow the **Monorepo Scoped Prefix** format:

```text
<type>/<scope>/<kebab-case-description>
```

### Allowed Types (`<type>`)
* `feat`: New user-facing or system feature
* `fix`: Bug fix
* `hotfix`: Urgent production hotfix
* `perf`: Performance optimization / memory reduction
* `refactor`: Code restructuring with no behavior change
* `chore`: Dependencies, build scripts, configuration, or maintenance
* `docs`: Documentation updates only
* `test`: Adding or updating test suites

### Allowed Scopes (`<scope>`)
* `studio`: Studio Dashboard (`/studio`)
* `web`: Consumer Web App (`/web`)
* `backend`: Python Scraping Engine & CLI (`/backend`)
* `functions`: Cloud Functions (`/backend/functions`)
* `infra`: GCP, Vercel, or GitHub Actions CI/CD infrastructure
* `all`: Monorepo-wide, cross-cutting, or multi-app changes

### Real-World Branch Examples
* `feat/studio/cinepoint-catalog`
* `hotfix/functions/sweeper-memory-optimization`
* `fix/web/live-seats-mobile-layout`
* `chore/all/upgrade-pnpm-dependencies`
* `docs/all/git-workflow-guidelines`

---

## 3. Conventional Commits Standard

Commit messages must reflect the same `<type>(<scope>): <description>` format:
* `feat(studio): add CinePoint tweet paste-and-parse tool`
* `fix(functions): prevent OOM crash in sweeper via select projection`
* `chore(all): update lockfiles and dependency versions`
* `deps(backend): upgrade Python packages via uv`

---

## 4. Post-Merge Branch Hygiene Rule

After any successful `--no-ff` merge into `dev` or `main`:
1. Verify the branch is fully merged: `git branch --merged <target>`
2. Safely delete the local branch: `git branch -d <branch-name>`
3. Delete the remote branch if it was published: `git push origin --delete <branch-name>`

---

## 5. Dependency Management Rules

1. **Frontend Dependencies**: Shared packages across `admin` and `web` MUST use the **PNPM Catalog (`catalog:`) protocol** defined in root `pnpm-workspace.yaml`. Do not hardcode differing framework versions in `package.json`.
2. **Backend Dependencies**: Managed exclusively via `uv` in `pyproject.toml` and locked in `uv.lock`. Run `uv sync` to update the local virtual environment.

---

## 6. Cloud Infrastructure & Cost Efficiency Rules

1. **Sweeper Frequency**: The `jit-sweeper` Cloud Scheduler job MUST remain on a **30-minute interval** (`0,30 10-23 * * *`). Do not reduce this frequency without explicit user approval, as 30m saves ~50% (~105,000 reads/day) in Firestore document read operations.
2. **Cloud Functions Isolation**: Functions in `backend/functions/` (`dispatcher`, `scraper`, `sweeper`) MUST remain 100% self-contained without imports from `backend.*`.

---

## 7. Localization & Time Formatting Standard

1. **24-Hour Time Format**: Indonesia uses the **24-hour military time system (WIB / WITA / WIT)**. All user-facing UI labels, dashboards, scheduler logs, and alerts MUST use 24-hour time notation (e.g., `11:00 WIB`, `18:00 WIB`, `23:00 WIB`, never 12-hour AM/PM formats like `11:00 AM` or `6:00 PM`).

