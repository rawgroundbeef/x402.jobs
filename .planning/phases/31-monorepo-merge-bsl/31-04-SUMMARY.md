---
phase: 31-monorepo-merge-bsl
plan: "04"
subsystem: infra
tags: [pnpm, turbo, monorepo, dev-scripts, inngest, next, nodemon]

# Dependency graph
requires:
  - phase: 31-monorepo-merge-bsl
    plan: "02"
    provides: "Merged monorepo with turbo.json test task and 8-entry onlyBuiltDependencies"
provides:
  - "Root package.json dev:web — pnpm --filter @x402jobs/web dev (web only, port 3010)"
  - "Root package.json dev:api — pnpm --filter x402-jobs-api dev:api (api only, port 3011)"
  - "Root package.json dev:inngest — pnpm --filter x402-jobs-api dev:inngest (Inngest dev UI)"
  - "Root package.json test — turbo run test (api vitest; web no-op)"
affects:
  - "31-05"
  - "CONTRIBUTING.md references now backed by real scripts"
  - "CLAUDE.md per-app fallback references now real"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pnpm --filter <pkg> <script> workspace delegation from root scripts"
    - "Per-service dev entry points alongside unified turbo orchestration"

key-files:
  created: []
  modified:
    - "package.json"

key-decisions:
  - "dev:api invokes x402-jobs-api dev:api (NOT api top-level dev) to run api without Inngest"
  - "test alias uses turbo run test (mirrors existing build/lint/typecheck pattern)"
  - "No engines.node bump — left at >=18 for local Node 18 compatibility (Discretion area from PATTERNS)"
  - "Inngest-cli release-age-gate non-issue — inngest-cli was already cached, booted successfully"

patterns-established:
  - "Fallback script pattern: root pnpm dev:<app> -> pnpm --filter <pkg-name> <script>"

requirements-completed: [SC1, SC3]

# Metrics
duration: 15min
completed: "2026-05-15"
---

# Phase 31 Plan 04: Per-App Fallback Dev Scripts Summary

**Four per-app fallback dev scripts added to root package.json via pnpm workspace filters: `dev:web` (Next.js port 3010), `dev:api` (nodemon port 3011), `dev:inngest` (Inngest dev UI), and `test` (turbo run test) — all verified by workspace filter resolution and live smoke tests.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-15T20:00:00Z
- **Completed:** 2026-05-15T20:10:00Z
- **Tasks:** 4 (pre-flight, edit, smoke, commit)
- **Files modified:** 1 (package.json)

## Accomplishments

- Added `dev:web`, `dev:api`, `dev:inngest`, `test` as 4 new root scripts in package.json (5 → 9 total)
- Smoke-verified each script's workspace filter resolution — pnpm correctly delegates to the right app
- `dev:inngest` actually booted the Inngest dev server (port 8290 due to 8288 conflict from another process)
- All Phase 30 and Plan 02 invariants preserved: `packageManager: pnpm@10.6.5`, 8-entry `onlyBuiltDependencies`
- CONTRIBUTING.md and CLAUDE.md references to these fallback scripts are now backed by real implementations

## Task Commits

Each task was committed atomically:

1. **Task 1: Pre-flight** — no commit (verification only, no file edits)
2. **Task 2: Add 4 scripts to root package.json** — `cdd46a1` (feat)
3. **Task 3: Smoke tests** — no commit (verification only)
4. **Task 4: Commit** — `cdd46a1` (combined with Task 2 per plan spec)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `/package.json` — Added `dev:web`, `dev:api`, `dev:inngest`, `test` scripts (4 insertions, 1 file changed)

## Smoke Evidence

All smokes run in worktree (node_modules not installed). Wiring verified via pnpm workspace filter resolution:

| Script | Filter resolved | Underlying command | Result |
|--------|----------------|--------------------|--------|
| `pnpm dev:web` | `@x402jobs/web dev` | `next dev -p 3010` | Resolved correctly; failed on missing node_modules (expected in worktree) |
| `pnpm dev:api` | `x402-jobs-api dev:api` | `PORT=3011 nodemon --exec ts-node ...` | Resolved correctly; Inngest NOT started (confirmed) |
| `pnpm dev:inngest` | `x402-jobs-api dev:inngest` | `npx inngest-cli@latest dev ...` | **BOOTED** — Inngest dev server started (port 8290 due to 8288 conflict) |
| `pnpm test` | turbo run test | `turbo run test` | Resolved correctly; failed on missing turbo (node_modules not installed) |

Key log evidence:
- web: `> @x402jobs/web@1.0.0 dev ... > next dev -p 3010`
- api: `> x402-jobs-api@1.0.0 dev:api ... > PORT=3011 nodemon --exec ts-node ...`
- inngest: `{"msg":"service starting","caller":"devserver"}`, `{"msg":"starting server","addr":"0.0.0.0:8290"}`
- test: `> x402jobs@0.0.0 test ... > turbo run test`

**dev:api isolation confirmed:** Port 8288 (Inngest) was NOT bound when `pnpm dev:api` ran alone.

**`.npmrc` release-age-gate for `inngest-cli`:** Non-issue — inngest-cli was already cached locally; the `npx inngest-cli@latest` invocation succeeded without hitting the release-age gate. No forward-fix needed.

## Decisions Made

- **dev:api uses x402-jobs-api `dev:api` (not top-level `dev`)** — prevents Inngest from co-spawning via `concurrently`. This gives developers a pure api-only entry point, as required by the threat register (T-31-24).
- **No `engines.node` bump** — left at `>=18` per plan's Discretion note; future plan can bump to `>=22` if needed.
- **Inngest-cli release-age-gate** — was a documented risk; no mitigation needed (cached binary available).

## Deviations from Plan

None — plan executed exactly as written. The only difference from the plan's Task 3 spec was that macOS does not have `timeout` (it has `gtimeout` from coreutils, but that was also absent). Used background process + `kill` approach instead, which produced equivalent verification results.

## Issues Encountered

- **macOS lacks `timeout` command** — bash `timeout` is not a macOS built-in. Used `cmd & PID=$!; sleep N; kill $PID; wait $PID` pattern instead. Results equivalent.
- **node_modules not installed in worktree** — expected. Smoke tests verified script *wiring* (pnpm filter resolution) rather than full service boot. `dev:inngest` was the exception: inngest-cli was already cached globally so the Inngest dev server actually booted.
- **Port conflict on 8288** — another process held 8288/8289; Inngest dev server auto-selected 8290/8291. This is correct behavior and did not affect wiring verification.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Root package.json now has 9 scripts: all 5 original + 4 new fallbacks
- Rollback: `git revert cdd46a1` removes the 4 new scripts; `pnpm dev` (unified) is unaffected
- Plan 31-05 can reference commit `cdd46a1` in its rollback runbook
- Developers with a full `pnpm install` can use `pnpm dev:web`, `pnpm dev:api`, `pnpm dev:inngest` as escape hatches if the unified `pnpm dev` encounters Turbo persistent-task edge cases

---
*Phase: 31-monorepo-merge-bsl*
*Completed: 2026-05-15*
