---
phase: 31-monorepo-merge-bsl
plan: "05"
subsystem: closure
tags: [closure, public, archive, convergence, rollback]
dependency_graph:
  requires: ["31-01", "31-02", "31-03", "31-04"]
  provides: ["public OSS repo state", "convergence evidence", "rollback runbook"]
  affects: [".planning/STATE.md", ".planning/ROADMAP.md"]
status: complete
---

# Plan 31-05 SUMMARY — Public-flip closure ceremony

Executed inline by the orchestrator (not via a spawned executor agent) because the task involved multi-platform dashboard actions, user-driven merge timing, and several discoveries that reshaped the plan as it ran.

## What was done

### Step 1 — Pre-merge audit
All 31-01 must_have invariants verified via direct grep on the merged tree:
- BSL invariants (Licensor=Memeputer LLC verbatim, grant text verbatim, Change Date 2030-05-15, Change License Apache 2.0, body marker preserved)
- SECURITY.md externalizations (release-age policy, encryption secrets named, PVR link, empty Known Unfixed)
- README structure (no MIT, BSL link, apps/api/, cross-links)
- All 5 public docs present
- pnpm@10.6.5 pinned in 5+ tracked code files (32 total counting `.planning/` references)
- No pnpm@9 stragglers in code paths
- isolated-vm invariant at root pnpm-workspace.yaml
- 8-entry onlyBuiltDependencies union
- History audit: no real secrets (3 grep-pattern false positives in `.planning/` plan files only)
- CI workflow valid YAML with `dorny/paths-filter@v3` + pnpm 10.6.5 pin

### Steps 2-3 — PR review + merge
- PR #21 reviewed for CI green, LICENSE preview, SECURITY.md readability
- User merged PR #21 to main as commit `6b9dc7a` at 2026-05-16 ~10:43 EDT

### Step 4 — Vercel main-branch deploy verification
First main-branch Vercel deploy of the merged monorepo **failed**:
```
Error: The Next.js output directory "apps/web/.next" was not found
at "/vercel/path0/apps/web/apps/web/.next"
```
The build itself succeeded; the post-build outputDirectory lookup failed because Vercel project dashboard rootDirectory is `apps/web/` and the root vercel.json had `outputDirectory: "apps/web/.next"` (resolved relative to rootDirectory → doubled path).

Three-iteration fix train:
1. `b642594` — change `outputDirectory` to `.next` — Vercel canceled by ignoreCommand filter (vercel.json wasn't in the filter)
2. `cac7dc5` — add vercel.json + .npmrc to ignoreCommand filter — still canceled (Vercel likely runs ignoreCommand against shallow-clone HEAD^ which doesn't behave as expected)
3. `22b7d37` — drop ignoreCommand entirely — Vercel deploys cleanly

`https://x402.jobs` HTTP 307 confirmed live on `22b7d37`.

### Step 5 — Railway re-point + encryption-secret survival
First Railway deploy of the merged monorepo **failed** at `pnpm install --frozen-lockfile` because the old `apps/api/Dockerfile` was written for the standalone api repo and assumed build context = repo root with lockfile present.

Three-iteration fix train:
1. `ea4672b` — rewrite Dockerfile as monorepo-aware (copies workspace manifests, runs pnpm install, then copies api source). Required Railway dashboard Root Directory change from `apps/api` → `.`.
2. `08a9652` — add root-level `railway.json` with `dockerfilePath: "apps/api/Dockerfile"`; delete `apps/api/railway.json` (vestigial).
3. After user changed Railway dashboard Root Directory to `.`, deploy succeeded.

`https://api.x402.jobs/health` HTTP 200 confirmed live; `/api/v1/resources` returns 200 with real DB data.
Both encryption secrets (`WALLET_ENCRYPTION_SECRET`, `INTEGRATION_ENCRYPTION_SECRET`) survived the Railway service re-point (Pitfall 4 mitigation).

### Step 6 — Archive ceremony + visibility flip
Important discovery: **`rawgroundbeef/x402.jobs` was already PUBLIC since 2026-01-08** (its creation date). The Phase 31 plan's "flip to PUBLIC" step was conceptual rather than a real dashboard action. The repo never needed flipping; it had always been public.

Implication: the squash-imported backend code (commit `4fe9e27`) was publicly visible on the `plan/31-monorepo-merge-bsl` branch from the moment it was pushed (~2026-05-15 16:36) through the major public-readiness scrubs (~2026-05-16 07:24). Roughly 15 hours of exposure for: admin email, hardcoded admin UUID, two Supabase project IDs, a third-party Gmail used as a script default, the personal `apps/api/scripts/` directory, one macOS-username path. NO cryptographic secrets, API keys, signing keys, or wallet keys were ever in the repo at any point (verified via full-history grep). Treated as footprint-info exposure; precautionary `SUPABASE_SERVICE_ROLE_KEY` rotation recommended.

`rawgroundbeef/x402-jobs-api` archived (read-only, stays private) via `gh repo archive` at 2026-05-16 ~11:35 EDT.

### Step 7 — `31-CONVERGENCE.md`
Written. Maps all 8 SCs to evidence; documents the deviation from original "flip to public" framing; tabulates pin sites + invariants + deferred items.

### Step 8 — `31-ROLLBACK.md`
Single-page runbook covering: Vercel rollback, Railway rollback, single-commit revert on main, full PR #21 revert (un-monorepo), license rollback edge case; explicit list of what's NOT recoverable post-merge; encryption-secret reminder.

### Step 9 — STATE.md + ROADMAP.md tracking
Via `gsd-sdk query roadmap.update-plan-progress 31 31-05 complete` + this SUMMARY (which makes summary_count == plan_count, triggering phase completion in the index).

### Step 10 — Closure docs commit
Final commit (`docs(phase-31): close phase 31 — CONVERGENCE + ROLLBACK + tracking updates`) bundles CONVERGENCE.md, ROLLBACK.md, this SUMMARY, STATE.md updates, ROADMAP.md updates.

## Deviations from original Plan 31-05

1. **"Flip to PUBLIC" was a no-op.** Repo was already public.
2. **Vercel deploy required 3 iterations** (outputDirectory, ignoreCommand filter, drop ignoreCommand) before going green.
3. **Railway deploy required 3 iterations** (monorepo-aware Dockerfile, root-level railway.json, dashboard Root Directory change). The "Pitfall 4 — verify encryption secrets" survived without intervention since Railway env vars persist across service re-points.
4. **Pre-public scrub expanded scope** mid-execution to include 15 personal scripts deletion + Supabase URL placeholder swap + admin UUID env-var refactor — none of these were in the original 31-05 task list but were surfaced by user-requested "one more security pass" iterations and remained pre-merge to minimize public-history exposure.
5. **README rewrite** beyond original 31-01 scope (proper OSS front door with badges, hero, community links, doc deep-links).
6. **Two follow-up todos filed** (`.planning/todos/pending/`): lint cleanup, zod/hookform typing.
7. **One large strategic todo filed**: decouple-x402jobs-from-memeputer.

## Self-Check

- 31-CONVERGENCE.md present ✅
- 31-ROLLBACK.md present ✅
- Vercel main deploy SUCCESS (`22b7d37`) ✅
- Railway api deploy SUCCESS (`08a9652`) ✅
- `https://x402.jobs` HTTP 307 ✅
- `https://api.x402.jobs/health` HTTP 200 ✅
- Old api repo archived (`isArchived: true`, `visibility: PRIVATE`) ✅
- Both encryption secrets confirmed surviving Railway re-point ✅

## Self-Check: PASSED
