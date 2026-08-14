# Git Branching & Workflow Rules

All branches in CineRadar must follow the **Monorepo Scoped Prefix** pattern:

`<type>/<scope>/<kebab-case-description>`

---

## 1. Allowed Types (`<type>`)
* `feat`: New user-facing or system feature
* `fix`: Bug fix
* `hotfix`: Urgent production hotfix
* `perf`: Performance optimization / memory reduction
* `refactor`: Code restructuring with no behavior change
* `chore`: Dependencies, build scripts, configuration, or maintenance
* `docs`: Documentation updates only
* `test`: Adding or updating test suites

---

## 2. Allowed Scopes (`<scope>`)
* `admin`: Admin Dashboard (`/admin` - Next.js 16)
* `web`: Consumer Web Application (`/web` - Next.js 16)
* `backend`: Python Scraping Engine & CLI (`/backend`)
* `functions`: Cloud Functions (`/backend/functions` or `/firebase`)
* `infra`: GCP, Vercel, or GitHub Actions CI/CD infrastructure
* `all`: Monorepo-wide, cross-cutting, or multi-app changes

---

## 3. Real-World Branch Examples
* `feat/admin/cinepoint-catalog`
* `hotfix/backend/sweeper-memory-optimization`
* `fix/web/live-seats-mobile-layout`
* `perf/functions/stream-generator-projection`
* `chore/all/upgrade-pnpm-dependencies`
* `docs/all/git-workflow-guidelines`

---

## 4. Conventional Commits Standard
Commit messages must reflect the same `<type>(<scope>): <description>` format:
* `feat(admin): add CinePoint tweet paste-and-parse tool`
* `fix(functions): prevent OOM crash in sweeper via select projection`
* `chore(all): update lockfiles and dependency versions`
