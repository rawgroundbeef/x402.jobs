---
phase: 30-supply-chain-hardening
plan: 03
subsystem: infra
tags: [pnpm, supply-chain, dockerfile, railway, vercel, x402jobs-api]

# Dependency graph
requires:
  - phase: 28-security-review
    provides: Phase 28 HIGH remediations landed in api repo (commit c751857); api repo is stable baseline for pnpm 10 upgrade
provides:
  - api repo (sibling) Dockerfile pinned to pnpm@10.6.5 (was floating pnpm@9)
  - api repo vercel.json install pin updated to pnpm@10.6.5 (was pnpm@9.12.1)
  - api repo package.json now has packageManager field "pnpm@10.6.5"
  - api repo pnpm.onlyBuiltDependencies expanded to 6 vetted entries (was [isolated-vm])
  - Railway-deploy verification gate (Task 4 checkpoint) — PENDING USER
affects: [30-04 (.npmrc + release-age policy in web repo), 30-05 (cross-repo convergence verification), 31-monorepo-merge]

# Tech tracking
tech-stack:
  added: [pnpm@10.6.5]
  patterns:
    - "Cross-repo lockstep pnpm pin: api Dockerfile + vercel.json + package.json all reference the same version string"
    - "onlyBuiltDependencies as the explicit allow-list: every transitive package with a lifecycle script must be vetted and listed; install must produce zero 'Ignored build scripts' warnings"

key-files:
  created: []
  modified:
    - "~/Projects/x402jobs-api/Dockerfile (pnpm@9 -> pnpm@10.6.5)"
    - "~/Projects/x402jobs-api/vercel.json (pnpm@9.12.1 -> pnpm@10.6.5)"
    - "~/Projects/x402jobs-api/package.json (NEW packageManager field; onlyBuiltDependencies expanded)"

key-decisions:
  - "Expanded api-repo onlyBuiltDependencies from plan's [esbuild, isolated-vm] to [bigint-buffer, bufferutil, esbuild, isolated-vm, protobufjs, utf-8-validate] — Rule 2 auto-fix to honour 'ZERO Ignored build scripts warnings' success criterion after first pnpm 10 install surfaced four additional transitive deps with lifecycle scripts."
  - "Did NOT push branch or open PR — plan's `autonomous: false` flag + operator's explicit 'Do NOT push to remote without confirmation' instruction. Halted at Task 4 (checkpoint:human-verify) for user to decide push/Railway timing."
  - "pnpm-lock.yaml was NOT regenerated — pnpm 10.6.5 read the existing lockfileVersion: '9.0' lockfile byte-for-byte. Minimal supply-chain churn; this is the desired outcome for a same-major-format upgrade."
  - "pnpm-workspace.yaml (ignoredBuiltDependencies: [isolated-vm]) is untracked / gitignored in api repo today — left untouched. The 'preserve invariant' goal is satisfied trivially (no modification possible to an untracked file)."

patterns-established:
  - "Pattern: First pnpm 10 install must be empirically inspected for 'Ignored build scripts' before claiming success — the allow-list cannot be pre-computed from plan templates because every repo has a different transitive-dep tree."
  - "Pattern: Cross-repo plans halt at checkpoint with branch un-pushed when `autonomous: false` and pushing to a deploy-coupled remote (Railway watches the api repo)."

requirements-completed: [SC1, SC3, SC4]

# Metrics
duration: 8min
completed: 2026-05-14
---

# Phase 30 Plan 03: Supply Chain Hardening — API Repo (pnpm 10.6.5) Summary

**Bumped sibling x402jobs-api repo from pnpm 9 to pnpm 10.6.5 across Dockerfile + vercel.json + package.json; expanded onlyBuiltDependencies to six vetted entries so first pnpm-10 install runs with zero ignored-script warnings; deploy verification pending Railway gate.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-14T14:32:00Z (approximate, baseline test run start)
- **Completed:** 2026-05-14T14:40:00Z (commit `4877799`)
- **Tasks:** 3 of 4 (Task 4 is a checkpoint:human-verify Railway gate — halted, awaiting user)
- **Files modified:** 3 in api repo (sibling); 0 lockfile delta

## Accomplishments

- Single atomic commit `4877799` in `~/Projects/x402jobs-api` on branch `chore/phase-30-03-pnpm-10-api`:
  - Dockerfile: `RUN npm install -g pnpm@9` → `RUN npm install -g pnpm@10.6.5` (exact pin; replaces floating major)
  - vercel.json: `pnpm@9.12.1` → `pnpm@10.6.5` (kept in lockstep though Railway is the real deploy lane)
  - package.json: NEW `packageManager: "pnpm@10.6.5"` field + expanded `onlyBuiltDependencies` to alphabetical `[bigint-buffer, bufferutil, esbuild, isolated-vm, protobufjs, utf-8-validate]`
- Local install + build + test all clean under pnpm 10.6.5:
  - `pnpm install`: completes in 5.2s, **zero** "Ignored build scripts" warnings (after allow-list expansion)
  - `pnpm build` (tsup): `dist/index.js` 880 KB, build success in 41 ms
  - `pnpm vitest run`: 30 files passed / 1 file failed / 388 tests pass / 1 test fails — exact baseline match (pre-existing failure in `resource-registration-full.test.ts`, NOT introduced by Phase 30)
- pnpm-lock.yaml was not modified — the existing `lockfileVersion: '9.0'` lockfile is read byte-for-byte by pnpm 10.6.5

## Task Commits

Each task committed atomically in the sibling api repo (NOT in this x402jobs repo):

1. **Task 1: Pre-flight** — no commit (snapshot artifacts only at `/tmp/30-03-*`)
2. **Task 2 + Task 3 (combined into single commit per plan instructions): Apply all three edits + regenerate** — `4877799` (chore) in `~/Projects/x402jobs-api`
3. **Task 4: Railway deploy verification** — HALTED, awaiting user (see Issues Encountered)

**This-repo metadata commit:** SUMMARY.md commit on `plan/30-supply-chain-hardening` branch in x402jobs (after this Write).

## Files Created/Modified

**In sibling repo (`~/Projects/x402jobs-api`), committed under `4877799`:**

- `Dockerfile` — pnpm pin bumped + multi-line explanatory comment added (3 inserts, 1 delete net)
- `vercel.json` — single-line install-command pin bumped (1 insert, 1 delete)
- `package.json` — `packageManager` field added; `onlyBuiltDependencies` array reflowed to 6 entries alphabetically (5 inserts, 1 delete net, JSON still validates)

**In this repo (`/Users/rawgroundbeef/Projects/x402jobs`):**

- `.planning/phases/30-supply-chain-hardening/30-03-SUMMARY.md` — this file
- `.planning/phases/30-supply-chain-hardening/deferred-items.md` — logs the pre-existing typecheck failures in two api-repo test files (Rule scope-boundary out-of-scope)

## Decisions Made

1. **Allow-list expanded beyond plan's projection.** Plan 30-03 anticipated only `esbuild` would join `isolated-vm` in the api repo's `onlyBuiltDependencies`. First `pnpm install` under 10.6.5 surfaced four additional transitive-dep lifecycle scripts: `bigint-buffer` (Solana SPL token native bigint helper), `bufferutil` / `utf-8-validate` (optional WebSocket native extensions, also in plan 30-01's projected web allow-list), and `protobufjs` (no-op postinstall shim per RESEARCH Assumption A2). All four are well-understood, low-risk, and required to satisfy the plan's hard "ZERO Ignored build scripts" success criterion. Applied as Rule 2 auto-fix.

2. **No push, no PR.** The plan is `autonomous: false` and Task 4 is a `checkpoint:human-verify` for the Railway deploy. Pushing the branch would trigger a Railway preview build (a user-visible side-effect) before the user has signed off. Per operator's explicit "Do NOT push to remote without confirmation" — halted before `git push` and `gh pr create`. The branch `chore/phase-30-03-pnpm-10-api` exists locally only.

3. **pnpm-workspace.yaml left untouched.** The file exists at `~/Projects/x402jobs-api/pnpm-workspace.yaml` but is UNTRACKED in git (verified via `git status` — listed under `??`). The plan's "preserve invariant" instruction is satisfied without action.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Expanded `pnpm.onlyBuiltDependencies` from the plan's projected `[esbuild, isolated-vm]` to the empirically-required `[bigint-buffer, bufferutil, esbuild, isolated-vm, protobufjs, utf-8-validate]`**

- **Found during:** Task 3 (first `pnpm install` after Task 2 edits)
- **Issue:** Plan assumed only `esbuild` needed to join `isolated-vm`. First install surfaced four additional transitive-dep lifecycle scripts: `bigint-buffer, bufferutil, protobufjs, utf-8-validate`. Plan's hard success criterion is "ZERO Ignored build scripts warnings"; the projected allow-list would have failed verification.
- **Fix:** Added all four to the alphabetical array. Re-ran `rm -rf node_modules && pnpm install` — completed in 5.2s with zero warnings.
- **Files modified:** `~/Projects/x402jobs-api/package.json` (one extra edit on top of the plan's snippet)
- **Verification:** `grep -c "Ignored build scripts" /tmp/30-03-install.log` returns 0
- **Committed in:** `4877799` (rolled into the single Task 2+3 commit)

**Delta vs plan 30-01 (web repo) projected allow-list:**

| Package | api repo (this plan, 30-03) | web repo (plan 30-01, projected per PATTERNS) | Notes |
|---|---|---|---|
| `bigint-buffer` | YES (Solana SPL token uses it) | NO (not in web deps tree) | API-only |
| `bufferutil` | YES (ws optional dep, surfaced via inngest/twitter-api-v2) | YES (Next.js websocket optional dep) | Overlap |
| `esbuild` | YES (tsup uses it) | YES (Next.js + tsup tooling) | Overlap |
| `fsevents` | NO (not surfaced in install log on linux/macOS install — likely not in api deps tree) | YES (macOS file watcher) | Web-only per plan 30-01 |
| `isolated-vm` | YES (existing) | NO | API-only sandbox |
| `protobufjs` | YES (surfaced via Solana web3.js) | YES (also surfaced via web's Solana deps) | Overlap |
| `sharp` | NO (no image processing in api) | YES (Next.js Image) | Web-only |
| `utf-8-validate` | YES (ws optional dep) | YES (Next.js websocket optional) | Overlap |

This delta exists because the api repo runs Solana + isolated-vm; the web repo runs Next.js + sharp. The vetting decision is identical (allow proven, well-maintained native-binding lifecycle scripts), but the package set differs.

---

**Total deviations:** 1 auto-fixed (1 missing critical — onlyBuiltDependencies allow-list expanded beyond plan projection).
**Impact on plan:** Required to honour the "ZERO Ignored build scripts" success criterion; not scope creep. The plan's interface block (lines 138-149) projected a smaller list because the planner could not run `pnpm install` to surface the actual flagged set at plan-write time.

## Issues Encountered

**1. Volta-managed pnpm masked the `npm install -g` upgrade path.** Local pnpm was 9.15.0 via Volta. Initial `npm install -g pnpm@10.6.5` had no effect because Volta shims override `npm install -g`. Switched to `volta install pnpm@10.6.5`, which then activated under `~/Projects/x402jobs-api` (the api repo has no `packageManager` field today, so Volta picks the newest installed version). From inside the api repo, `pnpm --version` correctly returned `10.6.5`. The web repo still pins `pnpm@9.15.0` via `packageManager`, so `pnpm` invoked from the x402jobs root still resolves to 9.15.0 — that's an artifact of plan 30-01 not having run yet and will resolve when 30-01 lands.

**2. Plan-vs-current state drift in api `package.json`.** Plan 30-03 was written when the api `package.json` had `axios` / `request-filtering-agent` absent and fewer scripts. Between plan-write and execution, commit `c751857` (Phase 28 HIGH remediations) landed on api `main` and modified `package.json`. The Edit tool surfaced this drift on first attempt; re-read + re-edit succeeded immediately. No semantic conflict — both edits target disjoint blocks (`pnpm.*` block at file tail vs. dependency/script additions in the middle).

**3. Pre-existing typecheck failures in two api-repo test files.** `pnpm typecheck` exits 1 with TS2339 errors in `src/routes/__tests__/resource-registration.test.ts` and `resource-registration-full.test.ts`. Confirmed pre-existing via `git stash && pnpm typecheck` against main — same errors plus one extra (TS2367 in resource-registration-full at line 150). Out of scope per executor's scope boundary ("only auto-fix issues DIRECTLY caused by the current task's changes"). Logged in `.planning/phases/30-supply-chain-hardening/deferred-items.md`. Test-runtime impact is zero (vitest still passes the same way — 388/389 tests pass; the same single test was failing on main before this plan).

**4. Branch pushed = NO. PR = NO. Railway deploy verification = PENDING USER.** Per operator instruction. See "User Setup Required" below for the unblock path.

## User Setup Required

**Manual gate at Task 4 (`checkpoint:human-verify`). Two-step unblock:**

### Step 1 — Push the api branch and open the draft PR

The branch `chore/phase-30-03-pnpm-10-api` exists locally in `~/Projects/x402jobs-api` only. To trigger the Railway preview build, push it:

```bash
cd ~/Projects/x402jobs-api
git push -u origin chore/phase-30-03-pnpm-10-api
gh pr create --draft \
  --title "chore(phase-30): pnpm 10.6.5 — api repo (Dockerfile + Railway)" \
  --body "Phase 30 (Supply Chain Hardening) — cross-repo plan 30-03 on the api side. Coordinated with x402jobs repo PR for plans 30-01/30-02. Draft until Railway deploy is green and a developer verifies the dashboard."
```

### Step 2 — Verify the Railway build log

Open the Railway dashboard for the `x402-jobs-api` service and inspect the build triggered by the just-pushed branch. EXPECTED in the build log:

- `+ pnpm@10.6.5` (or `Successfully installed pnpm@10.6.5`) in the `RUN npm install -g pnpm@10.6.5` Dockerfile layer
- NO occurrence of `pnpm@9` anywhere in the build output
- NO `Ignored build scripts:` warning line
- `pnpm build` step completes; tsup output appears (`dist/index.js` line)
- Final image builds; container starts; healthcheck passes (service shows "Active" in Railway dashboard)

If ALL of the above hold → reply `approved` to the orchestrator to unblock plan 30-04. If any fail → capture the failing log snippet + which expectation failed; the planner can revise. DO NOT merge the PR until plan 30-05's convergence verification gate.

### Common failure modes (per plan 30-03 lines 384-388)

- `Ignored build scripts: <pkg>` → the `pnpm.onlyBuiltDependencies` edit didn't land; check commit diff `git show 4877799 -- package.json`. **Expected to be solved by this plan's deviation #1.**
- `isolated-vm` build failure during `pnpm install` in Docker → likely missing apt-get system package. Confirm Dockerfile's `apt-get install -y` line still includes `python3 make g++ pkg-config libudev-dev`. If yes, surface the actual error — may indicate isolated-vm 6.1.2 doesn't ship a prebuilt linux-x64 binary for Node 22.
- Container starts but healthcheck fails → unrelated to pnpm version; capture the runtime error and surface.

## Next Phase Readiness

- **Plan 30-04 (`.npmrc` + release-age policy in x402jobs web repo)** is unblocked when the Railway gate above flips green. Plan 30-04 does NOT touch the api repo and does not depend on the Railway deploy succeeding for its OWN execution — but the convergence-verification plan 30-05 will assume both lanes (Vercel for web, Railway for api) are confirmed green on pnpm 10.6.5.
- **Plan 30-05 (cross-repo convergence verification)** needs the api-repo commit sha for its rollback reference doc. That sha is `4877799` (Phase 30, plan 30-03 commit in `~/Projects/x402jobs-api`).
- **Phase 31 (monorepo merge)** inherits a clean api-repo state where `packageManager: pnpm@10.6.5` is already in `package.json`. The merge can lift the api repo's `onlyBuiltDependencies` into the root array as-is.

## Self-Check: PASSED

Verified after writing this SUMMARY (commit hashes and files exist):

- **api repo commit `4877799`:** `cd ~/Projects/x402jobs-api && git log --oneline -1 4877799` returns `4877799 chore(phase-30): bump pnpm to 10.6.5 in api repo (Dockerfile + vercel.json + package.json)` — FOUND.
- **`~/Projects/x402jobs-api/Dockerfile`:** contains `RUN npm install -g pnpm@10.6.5` — FOUND (single grep hit, zero `pnpm@9` hits).
- **`~/Projects/x402jobs-api/vercel.json`:** contains `pnpm@10.6.5` — FOUND.
- **`~/Projects/x402jobs-api/package.json#pnpm.onlyBuiltDependencies`:** contains `esbuild` AND `isolated-vm` AND four additional vetted entries — FOUND.
- **`~/Projects/x402jobs-api/package.json#packageManager`:** equals `"pnpm@10.6.5"` — FOUND.
- **`~/Projects/x402jobs-api/pnpm-workspace.yaml`:** untracked / gitignored, NOT modified — confirmed via `git status --short` shows it under `??` with no changes since pre-plan.
- **api-repo lockfile header:** `lockfileVersion: '9.0'` preserved — FOUND.
- **`/tmp/30-03-install.log`:** zero `Ignored build scripts` matches — FOUND.
- **`dist/index.js` in api repo:** built successfully — FOUND.
- **No edits to `apps/api-audit-tmp/` in this repo** (RESEARCH Pitfall 6): confirmed — `git status` in x402jobs shows only `.planning/phases/30-supply-chain-hardening/30-03-SUMMARY.md` and `deferred-items.md` as new.
- **No edits to `.planning/STATE.md` or `.planning/ROADMAP.md`:** confirmed — both untouched (verified by absence from `git status`).

---

*Phase: 30-supply-chain-hardening*
*Plan: 03*
*Completed: 2026-05-14 (code commit + summary), Railway-gate verification pending user*
