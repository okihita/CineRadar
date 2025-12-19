---
description: Fix package-lock.json sync issues that cause CI failures
---

# Fix Package Lock File Sync

Use this workflow when the Admin CI fails with "package-lock.json is out of sync" error.

## Steps

// turbo
1. Regenerate the lock file:
```bash
cd admin && npm install && cd ..
```

// turbo
2. Check if lock file changed:
```bash
git status admin/package-lock.json
```

3. If changed, commit and push:
```bash
git add admin/package-lock.json && git commit -m "fix: sync package-lock.json" && git push
```

4. Verify CI passes:
```bash
gh run list --workflow="Admin CI" --limit 1
```

## Common Causes

- Different npm versions between local and CI
- Installing new packages without committing lock file
- Dependabot PRs with outdated lock file

## Prevention

Always run `npm install` in `/admin` before committing package.json changes.
