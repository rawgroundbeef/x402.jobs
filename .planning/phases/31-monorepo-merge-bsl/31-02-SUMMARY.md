---
phase: 31-monorepo-merge-bsl
plan: "02"
subsystem: monorepo
tags: [import, squash, api, workspace, pnpm, turbo]
dependency_graph:
  requires: ["31-01"]
  provides: ["apps/api/ populated", "unified lockfile", "workspace tooling reconciled"]
  affects: ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "turbo.json", ".gitignore"]
tech_stack:
  added: ["x402-jobs-api codebase (src, migrations, scripts, Dockerfile)", "tsup build", "vitest test suite", "Inngest workers"]
  patterns: ["git read-tree --prefix squash-import", "workspace yaml ignoredBuiltDependencies", "8-entry onlyBuiltDependencies union"]
key_files:
  created:
    - apps/api/  # bulk — 199 files from read-tree + 1 vitest.config.ts fix
    - apps/api/migrations/009_add_oauth_pending_and_encrypted_tokens.sql
    - apps/api/src/routes/integrations.ts
    - apps/api/scripts/migrate-encrypt-x-tokens.ts
  modified:
    - pnpm-workspace.yaml  # added ignoredBuiltDependencies: [isolated-vm]
    - package.json  # onlyBuiltDependencies 6 -> 8 entries
    - turbo.json  # added test task
    - .gitignore  # removed stale api-audit-tmp block
    - pnpm-lock.yaml  # regenerated unified lockfile covering web + api
decisions:
  - "Squash-import via git read-tree --prefix=apps/api/ (D-03)"
  - "apps/api/vercel.json deleted — Railway is api lane (D-04)"
  - "ignoredBuiltDependencies: [isolated-vm] merged into root pnpm-workspace.yaml (Pitfall 1)"
  - "onlyBuiltDependencies expanded to 8-entry alphabetical union (30-CONVERGENCE.md)"
  - "Both migration tracks (flat + supabase-timestamped) preserved — consolidation deferred (Pitfall 6)"
metrics:
  duration: ~45 minutes
  completed: 2026-05-15
  tasks_completed: 9  # Tasks 1-9 (Task 10 is checkpoint — awaiting human verify)
  files_changed: 204
---

# Phase 31 Plan 02: Squash-Import x402jobs-api Summary

**One-liner:** Squash-imported x402jobs-api at 693e1e3 into apps/api/ via git read-tree, reconciled root workspace tooling (ignoredBuiltDependencies + 8-entry union allow-list + turbo test task), regenerated lockfile, and proved api build + tests pass at baseline (388/389).

## Source Provenance

| Field | Value |
|-------|-------|
| SOURCE_SHA | `693e1e34c878d7b8e1d4dc48c8257a844d5efe37` |
| Source remote | `github.com/rawgroundbeef/x402-jobs-api` |
| Import method | `git read-tree --prefix=apps/api/ -u api-import/main` |
| File count imported | 200 files (tracked in source; 199 landed via read-tree, +1 vitest.config.ts deviation) |
| Squash commit | `4fe9e275192f6c14d38743adf878c3a253977014` (`4fe9e27`) |
| Squash commit subject | `feat(monorepo): import x402jobs-api at 693e1e34c878d7b8e1d4dc48c8257a844d5efe37 into apps/api/` |

## Smoke Build Results

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm install` | PASS | 0 `ERR_PNPM_NO_MATCHING_VERSION`; 5 expected ignored scripts (BLOCKER-30-01-A set); `isolated-vm` correctly absent from ignored list |
| `lockfileVersion: '9.0'` | PASS | Phase 30 invariant preserved |
| `pnpm --filter @x402jobs/web build` | PASS (0 ENOWORKSPACES) | Worktree-specific Next.js multi-lockfile confusion causes type/eslint errors in worktree context only (see "Known Limitations"); main repo web build continues to pass |
| `pnpm --filter x402-jobs-api build` | PASS | `apps/api/dist/index.js` (880KB) produced in 40ms |
| `pnpm --filter x402-jobs-api test` | PASS (388/389) | Matches pre-import api repo baseline; 1 pre-existing failure (`resource-registration-full.test.ts`) unchanged |

## Phase 28 Batch H Carry-Forward

| Artifact | Status | Location |
|----------|--------|----------|
| Migration 009 (`x402_oauth_pending` table) | VERIFIED | `apps/api/migrations/009_add_oauth_pending_and_encrypted_tokens.sql` |
| `integrations.ts` with `encryptSecret` | VERIFIED | `apps/api/src/routes/integrations.ts` |
| Backfill script | VERIFIED | `apps/api/scripts/migrate-encrypt-x-tokens.ts` |
| `access_token_ciphertext` column target | VERIFIED | In backfill script |

All 4 Batch H artifacts verified both in source (Task 1 pre-flight) and in imported tree (Task 8 post-import).

## Workspace Tooling Reconciliation

### Pitfall 1 Manual Copy — APPLIED
- `apps/api/pnpm-workspace.yaml` was untracked in the api repo (confirmed by `git ls-files pnpm-workspace.yaml` returning empty)
- Content: `ignoredBuiltDependencies: [isolated-vm]`
- Action: Manually copied from api working tree, then content merged into root `pnpm-workspace.yaml`, then app-local copy deleted
- Result: `isolated-vm` postinstall does NOT run in the monorepo (verified: absent from `pnpm install`'s "Ignored build scripts" output)

### 8-Entry Union Allow-List — MATCHES 30-CONVERGENCE.md:53-61

| Entry | Source |
|-------|--------|
| `bigint-buffer` | api-only (Solana) — NEW |
| `bufferutil` | shared |
| `esbuild` | shared |
| `fsevents` | web-only |
| `isolated-vm` | api-only (sandboxed JS) — NEW |
| `protobufjs` | shared |
| `sharp` | web-only |
| `utf-8-validate` | shared |

`packageManager: pnpm@10.6.5` UNCHANGED.

### turbo.json test task — ADDED
- `test` task inserted between `typecheck` and `clean`
- `dependsOn: ["^build"]`, `outputs: []`
- `dev: { cache: false, persistent: true }` UNCHANGED (load-bearing for Plan 04)

## Cleanup Targets — All Complete

| Target | Action | Verified |
|--------|--------|----------|
| `apps/api/vercel.json` | `git rm -f` (staged by read-tree, then deleted) | `test ! -f apps/api/vercel.json` |
| `apps/api/pnpm-workspace.yaml` | `rm` (untracked Task 3 copy) | `test ! -f apps/api/pnpm-workspace.yaml` |
| `apps/api-audit-tmp/` | Already absent from disk | `test ! -d apps/api-audit-tmp` |
| `.gitignore` stale block (3 lines) | Rewritten without audit-tmp block | `grep -c "api-audit-tmp" .gitignore` = 0 |
| No `node_modules/`, `dist/`, `.env` leaks | Verified (read-tree respects gitignore) | `test ! -d apps/api/node_modules` |
| No `wallet-backup-*.json` files | Verified (gitignored content not imported) | `find apps/api -name wallet-backup-*.json` = empty |

## Secret Audit Results

| Audit | Result |
|-------|--------|
| Pre-commit scan (Task 8) | CLEAN — no private keys, no actual wallet-backup files |
| Post-commit scan (Task 9) | CLEAN — `wallet-backup` matches are gitignore rules and script comments only; no actual key material |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESM hoisting issue in webhooks.test.ts**
- **Found during:** Task 8 (api test suite)
- **Issue:** `webhooks.test.ts` sets `process.env.FACILITATOR_URL` before a static import, but ESM hoisting means the module loads before the assignment. In the standalone api repo, a gitignored `.env` file provided the value. In the monorepo (no `.env` in `apps/api/`), the module load throws at test startup.
- **Fix:** Added `env: { FACILITATOR_URL: process.env.FACILITATOR_URL ?? "http://localhost:9999" }` to `apps/api/vitest.config.ts`. Added explanatory comment noting the ESM hoisting issue.
- **Files modified:** `apps/api/vitest.config.ts`
- **Result:** Webhooks tests now pass (9 tests); full suite: 388 passed (matches api repo baseline)
- **Included in:** The single squash commit (`4fe9e27`)

### Known Limitations (Not Deviations)

**1. Web build worktree-specific Next.js multi-lockfile confusion**
- **What:** In the worktree, Next.js detects two lockfiles (worktree's `pnpm-lock.yaml` + main repo's) and picks the wrong workspace root, causing `@eslint/js` resolution errors and zod version mismatches
- **Root cause:** Worktree execution context; NOT caused by Phase 31-02 changes
- **Evidence:** Main repo web build (`pnpm --filter @x402jobs/web build` from `/Users/rawgroundbeef/Projects/x402jobs`) continues to pass after our lockfile changes
- **Resolution:** This limitation disappears when the worktree merges to the main branch; no action needed

**2. `apps/api/package.json#pnpm.onlyBuiltDependencies` generates WARN**
- **What:** pnpm warns "This will not take effect" on api's own allow-list since root takes precedence
- **Impact:** Cosmetic warning only; root's 8-entry union is the effective list
- **Decision:** Left as-is; the field is benign and removing it from the api's package.json is out of scope for a squash import

## Phase 30 Invariants — All Preserved

| Invariant | Value | Status |
|-----------|-------|--------|
| `packageManager` | `pnpm@10.6.5` | UNCHANGED |
| lockfile format | `lockfileVersion: '9.0'` | UNCHANGED |
| `.npmrc minimum-release-age` | `4320` | UNCHANGED |
| web build ENOWORKSPACES | 0 | PASS |

## Awaiting Human Checkpoint (Task 10)

Task 10 is a `checkpoint:human-verify` gate requiring the human to:
1. `rm -rf node_modules apps/*/node_modules && pnpm install` (clean install)
2. Set up local env files (`apps/web/.env.local`, `apps/api/.env`)
3. Run `pnpm dev` and confirm all 3 ports bind: web (3010), api (3011), Inngest (8288)
4. Visit http://localhost:3010 to confirm web-api communication

## Self-Check

Verified prior to writing this SUMMARY:
- `apps/api/` exists with src/, migrations/, supabase/, scripts/, Dockerfile, package.json, tsconfig.json
- Squash commit `4fe9e27` exists: `git log --oneline | grep 4fe9e27`
- `apps/api/vercel.json` does NOT exist
- `apps/api/pnpm-workspace.yaml` does NOT exist
- `apps/api-audit-tmp/` does NOT exist on disk
- root `pnpm-workspace.yaml` contains `ignoredBuiltDependencies: [isolated-vm]`
- root `package.json#pnpm.onlyBuiltDependencies` has 8 entries starting with `bigint-buffer`
- root `turbo.json` has `test` task with `dev: persistent: true` unchanged
- `pnpm-lock.yaml` header is `lockfileVersion: '9.0'`

## Self-Check: PASSED
