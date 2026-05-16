---
title: Fix 14 pre-existing lint errors + re-enable lint in CI
created: 2026-05-15
source_phase: 31-monorepo-merge-bsl
priority: medium
estimated_effort: 1-2 hours
---

# Background

Phase 31 added the first CI workflow to the repo (`.github/workflows/ci.yml`). The first run on PR #21 surfaced 14 pre-existing lint errors that nobody was looking for:

**apps/web (6 errors):**
- `src/components/HackathonBanner/HackathonBottomSheet.tsx:93-94` — `no-useless-assignment` ×2
- `src/components/panels/JobPanel.tsx:633` — `no-useless-assignment`
- `src/components/panels/TriggerConfigPanel.tsx:654` — `no-useless-assignment`
- (and ~2 more — re-run `pnpm --filter @x402jobs/web lint` to enumerate)

**apps/api (8 errors):**
- 5 `no-useless-assignment` errors
- 3 `@typescript-eslint/no-unused-vars` errors (variables not prefixed with `_`)

# What's currently in place (temporary workarounds)

1. `.github/workflows/ci.yml` — `lint` step was REMOVED from both web and api jobs
2. `apps/web/next.config.js` — `eslint: { ignoreDuringBuilds: true }` added so `next build` doesn't fail in CI

# What needs to be done

1. Run `pnpm --filter @x402jobs/web lint` locally; fix each error manually (the auto-fix `--fix` does correct some but inappropriately removes load-bearing `eslint-disable-next-line` comments — see api wallet.test.ts case)
2. Run `pnpm --filter x402-jobs-api lint` locally; fix each error manually
3. Restore the `lint` step in `.github/workflows/ci.yml`:
   ```yaml
   - run: pnpm --filter @x402jobs/web lint    # in web job
   - run: pnpm --filter x402-jobs-api lint    # in api job
   ```
4. Remove `eslint: { ignoreDuringBuilds: true }` from `apps/web/next.config.js`
5. PR + verify CI green

# Why this was deferred

Phase 31 (monorepo merge + BSL license switch) was about structural / legal change, not code quality. Fixing 14 lint errors during Phase 31 would have been scope creep and risked introducing real bugs.
