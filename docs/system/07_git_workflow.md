# Git Workflow & Monorepo Branching Standards

This document establishes the official branching, commit, and release conventions for the CineRadar monorepo.

---

## 1. Monorepo Architecture Context

CineRadar contains three distinct deployment targets in a single repository:
* **`admin`**: Next.js 16 Admin Dashboard (Deployed on Vercel: `cineradar-admin.vercel.app`)
* **`web`**: Next.js 16 Public Consumer App (Deployed on Vercel: `cineradar.id`)
* **`backend`**: Python 3.13 Scraper CLI & GCP Cloud Functions (Deployed on GCP `cineradar-481014`)

To isolate preview deployments and provide immediate clarity on blast radius, all branches must declare their target scope.

---

## 2. Branch Naming Convention

All branches must follow the **Scoped Prefix Pattern**:

```
<type>/<scope>/<kebab-case-description>
```

### Allowed Types (`<type>`)
| Type | Description | Example |
| :--- | :--- | :--- |
| `feat` | New feature or capability | `feat/admin/cinepoint-catalog` |
| `fix` | Bug fix in non-production or regular lifecycle | `fix/web/live-seats-mobile-layout` |
| `hotfix` | Urgent production fix (branched from `main`) | `hotfix/backend/sweeper-memory-optimization` |
| `perf` | Performance or memory optimization | `perf/functions/stream-generator-projection` |
| `refactor` | Code restructuring with no behavioral changes | `refactor/admin/decompose-god-components` |
| `chore` | Dependency updates, tooling, build scripts | `chore/all/upgrade-pnpm-dependencies` |
| `docs` | Documentation additions or updates | `docs/all/git-workflow-guidelines` |
| `test` | Unit, integration, or smoke test additions | `test/backend/sweeper-projection-unit-test` |

### Allowed Scopes (`<scope>`)
| Scope | Target Component | Typical Deployment Target |
| :--- | :--- | :--- |
| `admin` | Admin Dashboard (`/admin`) | Vercel (`cineradar-admin`) |
| `web` | Public Consumer App (`/web`) | Vercel (`cineradar-id`) |
| `backend` | Core Python Scraper (`/backend`) | GitHub Actions / Local CLI |
| `functions` | Cloud Functions (`/backend/functions`) | Google Cloud Run / Functions Gen 2 |
| `infra` | CI/CD, GCP Scheduler, Firebase Config | GCP / GitHub Actions |
| `all` | Monorepo-wide or cross-cutting changes | Full Monorepo |

---

## 3. Conventional Commits

Commit messages should reflect the same structure:

```
<type>(<scope>): <short description in imperative mood>

[optional body explaining context or rationale]
```

### Examples:
* `feat(admin): add CinePoint tweet paste-and-parse tool`
* `fix(functions): prevent OOM crash in sweeper via select projection`
* `perf(backend): replace in-memory buffer with stream generator`
* `chore(web): update tailwind and react dependencies`

---

## 4. Hotfix Workflow Protocol

When a critical bug is discovered in production:
1. **Branch off `main`**:
   ```bash
   git checkout -b hotfix/<scope>/<description> origin/main
   ```
2. **Apply Minimal Surgical Fix**: Only modify files directly related to the issue.
3. **Verify Locally & in Staging/GCP**.
4. **Merge to `main` & Active Feature Branches**:
   ```bash
   git checkout main && git merge hotfix/<scope>/<description>
   git checkout feat/<active-branch> && git merge hotfix/<scope>/<description>
   ```

---

## 5. Vercel Ignored Build Step (Optimization)

To prevent Vercel from building the Admin Dashboard when working on Web (and vice-versa), configure **Vercel Dashboard $\rightarrow$ Settings $\rightarrow$ Git $\rightarrow$ Ignored Build Step**:

```bash
# For cineradar-admin: Skip build if branch is purely for web
if [[ "$VERCEL_GIT_COMMIT_REF" =~ ^(feat|fix|hotfix|chore|perf)/web/ ]]; then exit 0; else exit 1; fi
```

---

## 6. Post-Merge Branch Cleanup Protocol

To maintain repository hygiene and prevent stale branch buildup:
1. **Verify Merge Status**: Confirm the feature/fix branch is fully incorporated into the target branch (`dev` or `main`):
   ```bash
   git branch --merged dev
   ```
2. **Delete Local Branch**: Once verified, safely delete the local branch:
   ```bash
   git branch -d <branch-name>
   ```
3. **Delete Remote Branch**: If the branch was published to GitHub, delete the remote tracking reference:
   ```bash
   git push origin --delete <branch-name>
   ```

