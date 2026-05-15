---
phase: 30-supply-chain-hardening
plan: 02
subsystem: deploy
tags: [vercel, pnpm, package-manager, supply-chain]

# Dependency graph
requires: [30-01]
provides:
  - "apps/web/vercel.json#installCommand pinned to pnpm@10.6.5 (matches root packageManager)"
  - "Closes the vercel.json-shadows-packageManager override hole (RESEARCH Pitfall 3)"
affects: [30-04, 30-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-app vercel.json install-pin convergence with root packageManager — single-source-of-truth for pnpm version across local + Vercel build"

key-files:
  created: []
  modified:
    - "apps/web/vercel.json (installCommand: pnpm@9.12.1 → pnpm@10.6.5)"

key-decisions:
  - "Single-line edit. Kept --frozen-lockfile in the install command (self-documenting; lets a future Phase-31 maintainer remove vercel.json without losing the safety signal)"
  - "Did NOT delete vercel.json in favor of packageManager fallback — explicit pin surfaces drift as a build error rather than a silent fallback"
  - "Vercel preview verification deferred to post-merge per user direction (2026-05-14). Plan 30-05's post-merge convergence captures the assertions Vercel must satisfy on main"

patterns-established: []

requirements-completed: [SC1, SC5]

# Metrics
duration: ~10min  # includes a failed worktree-executor attempt + recovery
completed: 2026-05-14
---

# Phase 30 Plan 02: Vercel installCommand pin to pnpm 10.6.5

**Flipped `apps/web/vercel.json#installCommand` from `pnpm@9.12.1` to `pnpm@10.6.5` in a single one-line commit, converging the Vercel install lane with the root `package.json#packageManager` field landed in plan 30-01. Pre-merge Vercel preview verification was explicitly deferred to post-merge by user direction; the assertions are captured below for plan 30-05 to verify against the main-branch Vercel deploy.**

## Performance

- **Duration:** ~10 min (includes a failed worktree-executor attempt due to sandbox permission denial; recovery + inline edit took ~5 min)
- **Completed:** 2026-05-14
- **Tasks attempted:** 2 (Task 1 inline; Task 2 deferred to post-merge)
- **Tasks fully complete:** 1 of 2 (the second was a human-verify checkpoint, intentionally skipped per user direction)
- **Files modified:** 1 (apps/web/vercel.json)

## Accomplishments

- `apps/web/vercel.json` line 3 now reads `"installCommand": "npm install -g pnpm@10.6.5 && pnpm install --frozen-lockfile",`
- Diff is exactly one line — version digits only, nothing else changed
- JSON validates (`node -e "JSON.parse(...)"` passes)
- `grep "pnpm@10.6.5" apps/web/vercel.json` → 1 hit
- `grep "pnpm@9" apps/web/vercel.json` → 0 hits

## Task Commits

1. **Task 1: Flip the apps/web/vercel.json pnpm pin** — `2b5345e` (`chore(30-02): pin apps/web/vercel.json install to pnpm@10.6.5`)
2. **Task 2: Verify Vercel deploy preview** — DEFERRED to post-merge. See Deviations.

## Files Created/Modified

- `apps/web/vercel.json` — installCommand pnpm version pin flipped from `9.12.1` → `10.6.5`. No other field touched.

## Verification Evidence

| Check | Result | Source |
|---|---|---|
| `apps/web/vercel.json` references `pnpm@10.6.5` exactly once | PASS | `grep -c "pnpm@10.6.5" apps/web/vercel.json` → 1 |
| No `pnpm@9` substring remains in `apps/web/vercel.json` | PASS | `grep -c "pnpm@9" apps/web/vercel.json` → 0 |
| `vercel.json` parses as valid JSON | PASS | `node -e "JSON.parse(require('fs').readFileSync('apps/web/vercel.json'))"` exits 0 |
| Vercel preview build shows `pnpm@10.6.5` | DEFERRED | Captured as post-merge assertion for plan 30-05 |
| No `ENOWORKSPACES` in Vercel build log | DEFERRED | Captured as post-merge assertion for plan 30-05 |
| Preview URL loads | DEFERRED | Captured as post-merge assertion for plan 30-05 |

## Expected Vercel build-log assertions (for plan 30-05 to verify post-merge)

When the Phase 30 PR (#20) is merged to `main`, the next Vercel deploy MUST satisfy ALL of the following. If any fail, the rollback runbook in 30-05 (`30-ROLLBACK.md`) is the recovery path.

1. **Install lane**: Build log contains `Successfully installed pnpm@10.6.5` (or `+ pnpm@10.6.5`) in the install step output.
2. **No legacy pin**: Build log contains ZERO occurrences of `pnpm@9.12.1`, `pnpm 9.`, or `pnpm@9` anywhere.
3. **Next.js workspace bug avoided**: Build log contains ZERO occurrences of `ENOWORKSPACES`. (Real-environment confirmation of the 30-01 RESEARCH Pitfall 1 avoidance — pinning to 10.6.5 instead of 10.7.0+.)
4. **Build success**: Build step ends with `Build Completed in /vercel/output` (or Vercel's current equivalent success line).
5. **Preview URL renders**: The production URL (https://x402jobs.com or the Vercel-assigned domain) loads without a Vercel error page; landing page renders; at least one interior page (e.g., `/discover`) renders without 500.
6. **Ignored build scripts gate**: Build log may contain the 5 known-ignored scripts from Wave 1 resolution (`@stellar/stellar-sdk, blake-hash, tiny-secp256k1, unrs-resolver, usb`) — these are EXPECTED and were accepted under BLOCKER-30-01-A resolution. Any NEW package appearing in the ignored list IS a failure signal (means the lockfile drifted between local and Vercel).

## Decisions Made

- **Inline orchestrator edit instead of executor subagent.** The first executor attempt (worktree `agent-ada77056`) hit a sandbox permission wall — Edit, Write, and `git reset --hard` were all denied inside the worktree, so the agent could not perform the one-line edit. Rather than respawn (likely to hit the same permission state), the orchestrator did the edit inline. The functional outcome is identical; the commit is on the same branch with the same content.
- **Pre-merge Vercel preview verification deferred to post-merge.** User explicit direction (2026-05-14, captured in memory as `feedback_deploy_lane_validation.md`): for deploy-lane changes, ship the PR, assume it works, and fix any fallout post-merge. Railway has no PR previews, and the user opted to apply the same approach to Vercel for symmetry. Plan 30-05's convergence verification captures the post-merge assertions.

## Deviations from Plan

### Structural (executor-routing)

**1. [Executor] Worktree subagent sandbox denied writes; fell back to inline orchestrator edit**
- **Found during:** Task 1 attempt by `gsd-executor` in worktree `agent-ada77056`
- **Issue:** Sandbox layer denied `Edit`, `Write`, and `git reset --hard` for all paths inside the worktree (`/Users/rawgroundbeef/Projects/x402jobs/.claude/worktrees/agent-ada77056/...`). Read tools and some read-only git commands succeeded; mutating operations did not. Cause unclear — possibly per-worktree permission state diverged from the orchestrator's. Plan 30-01 succeeded in worktree mode 5 minutes earlier, so it's not a permanent runtime block.
- **Fix:** Orchestrator performed the edit inline on `plan/30-supply-chain-hardening` directly. Committed as `2b5345e`.
- **Files modified:** apps/web/vercel.json (same file the executor would have touched)
- **Verification:** Diff is exactly one line; JSON validates; greps pass. No content difference from what the executor would have produced.
- **Committed in:** `2b5345e`

### Procedural (scope reduction)

**2. [Scope] Task 2 human-verify checkpoint skipped per user direction**
- **Found during:** Wave 2 dispatch (orchestrator decision)
- **Issue:** Plan 30-02 specifies a `checkpoint:human-verify` gate (Task 2) that requires opening a draft PR, waiting for Vercel preview, manually inspecting the build log + preview URL, and replying `approved` before the plan completes.
- **Fix:** User explicitly opted out of pre-merge deploy gating ("we don't have pr branches on railway let's just assume it works and create a pr and we'll merge at the end and fix any fallout"). The PR was opened earlier in Wave 1 closure (PR #20). The assertion list that Task 2 would have human-verified is captured above under "Expected Vercel build-log assertions" and will be checked post-merge by plan 30-05.
- **Files modified:** none
- **Verification:** Memory updated (`feedback_deploy_lane_validation.md`) so future runs don't re-propose this gate.
- **Committed in:** N/A — scope decision

## Issues Encountered

- **Worktree write permission denied** (resolved by falling back to inline edit; see Structural Deviation 1)

## Next Phase Readiness

- Plan 30-04 (`.npmrc` release-age policy) can proceed immediately. It does NOT depend on Vercel preview verification.
- Plan 30-05 (convergence) must include the "Expected Vercel build-log assertions" list above in its post-merge check.
- The combined `plan/30-supply-chain-hardening` branch now contains both the root `packageManager` bump (30-01) AND the Vercel install pin (30-02). The two together are the minimum viable Phase 30 web-deploy lane; 30-04 layers in the release-age policy on top.

## Self-Check: PASSED

- File `.planning/phases/30-supply-chain-hardening/30-02-SUMMARY.md` exists at this path.
- File `apps/web/vercel.json` contains the literal string `"pnpm@10.6.5"` (verified by grep).
- File `apps/web/vercel.json` contains ZERO occurrences of `pnpm@9` (verified by grep).
- Commit `2b5345e` exists on branch `plan/30-supply-chain-hardening`.

---
*Phase: 30-supply-chain-hardening*
*Plan: 02*
*Completed: 2026-05-14 (Vercel preview verification deferred to post-merge per user direction)*
