---
phase: 31-monorepo-merge-bsl
review_date: 2026-05-15
plan_count: 5
overall_verdict: PASS (with 4 CONCERNs — none blocking)
---

# Phase 31 Plan Check

## TL;DR

Executing the 5 plans as written WILL satisfy all 8 ROADMAP success criteria for Phase 31. The plans are unusually disciplined: every locked decision in 31-CONTEXT.md has at least one explicit grep gate, every pitfall in 31-RESEARCH.md is addressed by a specific task, and the public-flip ceremony in 31-05 enforces the exact strict order from Pitfall 5 (docs → import → CI → smoke → Railway → Vercel → merge → archive → public-LAST). Pnpm@10.6.5 pin convergence is grep-audited across 5 sites; Memeputer LLC appears verbatim in 4+ places in LICENSE with a Task-1 grep gate AND a re-grep in 31-05; Phase 30 build-log assertions are explicitly re-verified post-merge.

Top 3 strengths:
1. Plan 02 (squash-import) addresses BOTH Pitfall 1 (untracked pnpm-workspace.yaml) AND Pitfall 8 (gitignore-respecting import) with two complementary mechanisms: `git read-tree --prefix` for tracked files + explicit `cp` for the one untracked file, plus pre/post-commit secret audits.
2. Plan 05 Task 5 (Railway re-point) is unusually careful about Pitfall 4 — it requires visual verification of BOTH encryption secrets in a separate browser tab BEFORE saving the source change, with the Phase 27 boot guard as the load-bearing post-deploy signal.
3. The plan set explicitly enforces SC8 by re-grepping 30-CONVERGENCE.md assertions post-merge in 31-05 Task 4 + Task 5 (pnpm@10.6.5, zero ENOWORKSPACES, zero new Ignored build scripts, no encryption-secret-not-set boot warnings, lockfile header still v9.0).

Top 3 concerns (all NON-blocking):
1. **C1** — Plan 02 Task 4 uses a defensive `if [ -f apps/api/vercel.json ]; then git rm` even though `must_haves.truths` claims the file MUST be DELETED unconditionally. The verify gate `test ! -f apps/api/vercel.json` passes either way; net cosmetic only.
2. **C2** — Plan 01 Task 4 writes README quickstart referencing `apps/web/env.example` without verifying that filename actually exists in apps/web/ today. SC3 ("clone-and-run without manual env-file plumbing beyond `.env.local.example` copy") depends on the filename matching reality. Plan 02 Task 10 partially catches this AFTER Plan 01's README is already written.
3. **C3** — Plan 03 Task 3 has the first explicit `git push`; Plans 01 and 02 do not push. Works in practice but produces an ambiguous PR-sequencing story.

## Per-SC Verdict

| SC# | Criterion | Plan(s) responsible | Verdict | Evidence |
|-----|-----------|---------------------|---------|----------|
| SC1 | Single repo, single license, single CI | 31-01 + 31-02 + 31-03 | PASS | Plan 01 Task 1 writes LICENSE; Plan 02 Task 2 imports apps/api/ via `git read-tree --prefix`; Plan 03 Task 2 writes `.github/workflows/ci.yml` with `dorny/paths-filter@v3`; Plan 05 Task 1 cross-greps all three. |
| SC2 | Both apps deploy cleanly to Vercel + Railway post-merge | 31-05 Tasks 4 + 5 | PASS | Plan 05 Task 4 watches Vercel main-deploy against 30-CONVERGENCE.md "Expected build-log assertions"; Plan 05 Task 5 re-points Railway with Pitfall 4 mitigation (visual encryption-secret verification + boot-guard check + cross-service smoke). |
| SC3 | `pnpm install && pnpm dev` works for new clone-and-run dev | 31-02 Task 10 (human checkpoint) + 31-04 Task 3 (fallback smokes) | PASS | Plan 02 Task 10 is `checkpoint:human-verify gate="blocking"` requiring approval that web 3010 + api 3011 + Inngest 8288 all bind; Plan 04 Task 3 smokes each fallback in isolation. |
| SC4 | LICENSE, README, SECURITY.md, CONTRIBUTING.md all present | 31-01 Tasks 1-4 + 31-05 Task 1 step 4 | PASS | Plan 01 creates 5 docs (incl. CLAUDE.md); Plan 05 Task 1 step 4 has explicit `test -f` for all 5 files. |
| SC5 | LICENSE names Memeputer LLC verbatim with locked grant text | 31-01 Task 1 + 31-05 Task 1 re-grep | PASS | Plan 01 Task 1 verify enforces `grep -c 'Memeputer LLC' LICENSE >= 4`, exact `^Licensor: *Memeputer LLC$` = 1, exact `Memeputer LLC, or its successor` = 1, copyright header present, `^Terms$` body marker for BSL covenant 4 compliance. Plan 05 Task 1 re-runs these gates post-merge. T-31-02 explicitly modeled. |
| SC6 | SECURITY.md release-age policy + private disclosure + EMPTY Known Unfixed | 31-01 Task 2 + 31-05 Task 1 step 2 | PASS | Plan 01 Task 2 enforces `minimum-release-age=4320`, `security/advisories/new`, `None at public launch`, NO `HIGH-NN.*OPEN` patterns. Plan 05 Task 1 step 2 re-runs with explicit exit-1 on HIGH-marked-OPEN regression. |
| SC7 | SECURITY.md externalizes release-age policy | 31-01 Task 2 (literal `minimum-release-age=4320`) | PASS | Same as SC6. 30-CONVERGENCE.md:89 deferred item retroactively satisfied. |
| SC8 | Vercel + Railway main deploys satisfy 30-CONVERGENCE.md "Expected build-log assertions" | 31-05 Tasks 4 + 5 | PASS | Task 4 enumerates Vercel assertions: pnpm@10.6.5 installed, ZERO ENOWORKSPACES, 5 BLOCKER-30-01-A accepted ignored scripts (no NEW packages), 48/48 pages. Task 5 enumerates Railway assertions: pnpm@10.6.5, zero ERR_PNPM_NO_MATCHING_VERSION, zero unexpected Ignored scripts, isolated-vm suppressed, tsup dist/index.js produced, boot guard does NOT fire. Plan 03 retroactively satisfies Phase 30 SC6. |

SC verdict count: **8 PASS, 0 CONCERN, 0 FAIL.**

## Per-Plan Verdict

### 31-01 (Wave 1, autonomous=true, 5 tasks)

| Dimension | Score | Notes |
|---|---|---|
| Goal traceability | PASS | Frontmatter `requirements: [SC1, SC4, SC5, SC6, SC7]` matches body. Every truth has a grep gate. |
| Task atomicity | PASS | 5 tasks, each 1-2 files + single commit at end. Verify blocks use grep/test/exit-code. |
| Locked-decision honor | PASS | D-02 Memeputer LLC enforced 4 ways. D-01 empty Known Unfixed enforced + negative HIGH-NN-OPEN check. BSL covenant 4 (body unmodified) via `^Terms$` body marker check. |
| Pitfall coverage | PASS | Pitfall 7 (BSL body paraphrase) addressed by `^Terms$` marker + verbatim-fetch instruction. T-31-12 (Change Date wrong reference) addressed by Task 1 step 1. |
| Verification rigor | PASS | 16 concrete grep/test gates in top-level `<verification>`. No "manually verify" prose. |
| Threat model | PASS | T-31-02, T-31-04, T-31-09, T-31-10, T-31-11, T-31-12 covered. |
| Rollback | PASS | Single `git revert <sha>` covers all 5 files. Forward-fix preferences enumerated. |
| Cross-plan deps | PASS | depends_on `[]`, wave 1. Plan 02 explicitly depends on this. |

### 31-02 (Wave 2, autonomous=false, 10 tasks including 1 human checkpoint)

| Dimension | Score | Notes |
|---|---|---|
| Goal traceability | PASS | `requirements: [SC1, SC2, SC3, SC8]` matches body. All 5 deletion targets traced. |
| Task atomicity | PASS | 10 tasks; Task 8 (lockfile regen + smoke) bounded by per-step verify. Single-squash-commit discipline: Tasks 1-8 stage, Task 9 commits. |
| Locked-decision honor | PASS | D-03 (single squash commit) enforced via subject regex. D-04 (delete apps/api/vercel.json) enforced. D-01 Batch H carry-forward verified 4 ways (Task 1 pre-flight + Task 8 step 7). |
| Pitfall coverage | PASS | Pitfall 1 (untracked workspace yaml) → Task 3 explicit `cp` + Task 5 merge-to-root + delete app-local. Pitfall 8 (cp -r leaks secrets) → Task 2 `git read-tree` + 4 test-not-exists gates (node_modules, dist, .env, wallet-backups). Pitfall 6 (migrations) DEFERRED with explicit rationale. |
| Verification rigor | PASS | 19 concrete gates. Pre-commit + post-commit secret audits (defense in depth). |
| Threat model | PASS | T-31-01, T-31-03, T-31-06, T-31-13, T-31-14 (accept), T-31-15, T-31-16, T-31-17 covered. |
| Rollback | PASS | Single `git revert <sha>` removes apps/api/ + root tooling + .gitignore + lockfile in one shot. Cross-repo concerns (Railway, archived api repo) explicitly out-of-scope. |
| Cross-plan deps | PASS | depends_on `["31-01"]`, wave 2. LICENSE must exist so import commit lands under BSL grant. |

### 31-03 (Wave 3, autonomous=false, 4 tasks including 1 human checkpoint)

| Dimension | Score | Notes |
|---|---|---|
| Goal traceability | PASS | `requirements: [SC1, SC8]`. Plan also retroactively satisfies Phase 30 SC6. |
| Task atomicity | PASS | 4 tasks; single workflow file + commit + smoke-PR. Verify uses Python `yaml.safe_load` (real parse, not just grep) plus job-graph parse check. |
| Locked-decision honor | PASS | D-04 (split deploys → split CI) enforced via web/api filter pattern. Phase 30 pnpm@10.6.5 enforced via literal `version: 10.6.5` grep. |
| Pitfall coverage | PASS | Pitfall 2 (shared-file changes skip both jobs) → `shared:` filter + `if ... || shared == 'true'` pattern. Verify enforces `needs.changes.outputs.shared` presence. Anti-patterns 522 (paths-only) and 523 (app-local workflows) explicitly avoided. |
| Verification rigor | PASS | Content grep + YAML parse + job-graph parse. Human checkpoint has concrete per-job pass/fail criteria. |
| Threat model | PASS | T-31-07, T-31-18 (accept with escape hatch), T-31-19, T-31-20, T-31-21, T-31-22 (dormant) covered. |
| Rollback | PASS | Single `git revert <sha>` removes workflow only. Forward-fix paths for 5 common failure modes. |
| Cross-plan deps | PASS | depends_on `["31-02"]`, wave 3. Task 1 pre-flight verifies Plan 01 LICENSE + Plan 02 apps/api/ exist (5 OK lines). |

### 31-04 (Wave 3, autonomous=true, 4 tasks)

| Dimension | Score | Notes |
|---|---|---|
| Goal traceability | PASS | `requirements: [SC1, SC3]`. ROADMAP Risk #3 (Inngest orchestration) explicitly addressed. |
| Task atomicity | PASS | 4 tasks. Task 2 (script additions) has 10 sub-greps. Task 3 smoke bounded by `timeout 15`/`timeout 20`. |
| Locked-decision honor | PASS | Phase 30 invariants (pnpm@10.6.5, 8-entry allow-list) preserved with multiple verify gates. CONTEXT discretion area (Inngest orchestration) resolved per RESEARCH Pattern 3. |
| Pitfall coverage | PASS | T-31-24 (dev:api accidentally spawns Inngest) → invokes `pnpm --filter x402-jobs-api dev:api` NOT `dev`; Task 3 verifies port 8288 does NOT bind during `dev:api`. |
| Verification rigor | PASS | `lsof -iTCP:PORT -sTCP:LISTEN` + log-grep for boot signals. Each fallback verified in isolation. |
| Threat model | PASS | T-31-23, T-31-24, T-31-25 covered. |
| Rollback | PASS | Single `git revert <sha>` removes 4 script additions; `pnpm dev` (unified) unaffected. |
| Cross-plan deps | PASS | depends_on `["31-02"]`, wave 3. FILE-INDEPENDENT of Plan 03 — enables wave 3 parallelism. |

### 31-05 (Wave 4, autonomous=false, 10 tasks including 4 human checkpoints)

| Dimension | Score | Notes |
|---|---|---|
| Goal traceability | PASS | `requirements: [SC1..SC8]` — covers all 8 SCs (closure plan). Explicit SC→plan→evidence map in `<interfaces>`. |
| Task atomicity | CONCERN | 10 tasks at upper bound. 4 are human checkpoints (bounded by external state); 6 autonomous tasks average 2-step ops. Complexity is in cross-environment coordination, not monolithic code. ACCEPTABLE for closure plan; flag for awareness. |
| Locked-decision honor | PASS | All 5 hard claims (D-02, D-04, D-01, D-03, plus Pitfall 5 strict order) enforced via Task 1 cross-grep audit BEFORE merge. |
| Pitfall coverage | PASS | Pitfall 4 (Railway encryption-secret loss) → Task 5 step 4 visual verification BEFORE source change + step 12 boot-guard check + step 13 cross-service decryption smoke. Pitfall 5 (premature flip) → Task 6 9-checkbox pre-flight + strict task ordering 1→2→3→4→5→6→7→8→9→10. |
| Verification rigor | PASS | Task 1 has 9 sub-steps each with 5-10 grep gates. Task 4 + Task 5 enumerate concrete Vercel/Railway assertions verbatim from 30-CONVERGENCE.md. Task 8 verify enforces `! grep -q '<sha-from-'` (no placeholder leakage). |
| Threat model | PASS | T-31-02, T-31-05, T-31-08, T-31-01 (defense-depth), T-31-26, T-31-27, T-31-28, T-31-29, T-31-30 covered. |
| Rollback | PASS | Worst-case multi-step revert documented (flip-back-to-private → un-archive → revert Railway → `git revert <merge-sha>` → STATE.md flag). 30-45min recovery. |
| Cross-plan deps | PASS | depends_on `["31-01","31-02","31-03","31-04"]`, wave 4. Task 1 pre-merge gate also verifies expected commits via `git log main..HEAD`. |

## Open Concerns

**1. [Plan 02 → C1, severity WARNING] Defensive `if [ -f apps/api/vercel.json ]` in Task 4 contradicts unconditional `must_haves.truths` claim.**
- Plan: 31-02 Task 4 step 1
- Dimension: Locked-decision honor (D-04)
- Issue: `must_haves.truths` says `"apps/api/vercel.json DELETED (D-04: Railway is the api lane)"` unconditionally, but Task 4 uses `if [ -f apps/api/vercel.json ]; then git rm ... else echo "OK: apps/api/vercel.json was absent in source"`. RESEARCH Runtime State Inventory line 206 confirms the file DOES exist in api repo working tree at `4877799`. Verify gate `test ! -f apps/api/vercel.json` passes either way.
- Fix: Cosmetic. Either drop the conditional (`git rm apps/api/vercel.json`) or update `must_haves` to say "DELETED if present". Net: NOT blocking.

**2. [Plan 01 → C2, severity WARNING] README quickstart references `apps/web/env.example` without verifying the filename exists in apps/web/.**
- Plan: 31-01 Task 4 + 31-02 Task 10
- Dimension: SC3
- Issue: README instructs `cp apps/web/env.example apps/web/.env.local` and `cp apps/api/env.example apps/api/.env`. The current apps/web/ may have `.env.local.example` instead, or no example file. If wrong, SC3 ("without manual env-file plumbing beyond `.env.local.example` copy") breaks for first-time contributors after public flip. Plan 02 Task 10 partially catches this (`test -f apps/web/env.example || test -f apps/web/env.local.example`) but AFTER Plan 01's README is already written.
- Fix: Add to Plan 01 Task 4 action block: `WEB_ENV=$(ls apps/web/env.example apps/web/.env.local.example apps/web/env.local.example 2>/dev/null | head -1)` and substitute the actual filename into the README content.

**3. [Plan 03 → C3, severity INFO] First `git push` happens in Plan 03 Task 3; Plans 01 + 02 have no explicit push.**
- Plan: 31-03 Task 3
- Dimension: Cross-plan execution flow
- Issue: Plans 01 + 02 produce commits but do not push. Plan 03 Task 3 is the first plan to push. Works in practice (single-branch flow) but ambiguous for separate-branch flow (plans suggest both are possible).
- Fix: Optional. Add a one-line note in Plan 01 Task 5 + Plan 02 Task 9 explaining whether to push or wait. Leave as-is — 31-05 Task 2 human checkpoint catches any PR-shape inconsistency.

**4. [Plan 05 → C4, severity INFO] Task 6 step A (api-repo README banner push) is not guarded against re-execution after archive.**
- Plan: 31-05 Task 6 step A
- Dimension: Idempotency / re-execution safety
- Issue: Step A pushes a chore commit to api repo's main BEFORE archiving. If a prior plan execution attempt already archived the repo, this push fails.
- Fix: Optional. Add `gh api repos/rawgroundbeef/x402-jobs-api --jq .archived` early-skip check. Step A is explicitly marked "optional but recommended" — operator can skip manually if they see the failure.

## Recommendations

**No edits required to proceed.** All 4 concerns are quality polish, not goal-blockers. Plans WILL achieve all 8 SCs as written.

Optional polish (5-10 minutes total if applied):
1. Plan 01 Task 4: substitute correct env-example filename via pre-flight `ls` check (C2).
2. Plan 02 Task 4: drop conditional in favor of unconditional `git rm` (C1).
3. Plan 05 Task 6 step A: add archive-state guard (C4).
4. Plans 01/02: add explicit push instructions for PR-sequencing clarity (C3).

Ready to `/gsd-execute-phase 31` as-is.

## Confidence

**HIGH** — rationale:
- All 8 ROADMAP success criteria have explicit plan→task→grep-gate mappings, verified end-to-end during this review.
- Every LOCKED decision in 31-CONTEXT.md (D-01..D-04) has at least one corresponding grep gate or task constraint; T-31-02 (Memeputer LLC verbatim) is enforced via 4 independent grep checks across LICENSE.
- Every pitfall in 31-RESEARCH.md relevant to in-scope plans (1, 2, 4, 5, 7, 8) is addressed by a specific task with a runnable verify command.
- Pre/post-commit secret audits in Plan 02 + Plan 05 Task 1 provide defense-in-depth against T-31-01.
- Phase 30 SC6 retroactive satisfaction is explicit (Plan 03 commit message + 31-CONVERGENCE.md doc).
- Cross-environment pnpm@10.6.5 pin convergence is grep-audited across all 5 active sites in Plan 05 Task 1 step 5.
- Pitfall 5 strict order is enforced both structurally (Wave 1→2→3→4) AND procedurally (Plan 05 Task 6 9-checkbox pre-flight).

Sources of residual uncertainty (none rise to MEDIUM):
- 4 human checkpoints in Plan 05 require external state (Railway UI, GitHub UI, Vercel dashboard) that I cannot statically verify. Plans document expected signals; correctness depends on operator following the runbook.
- api repo HEAD sha at execution time may differ from `4877799` captured at research time — Plan 02 Task 1 explicitly captures current sha and references it in commit message, so drift is handled.
- CONTRIBUTING.md uses a nested code fence (markdown inside four-backtick outer fence) which Write tools handle but is visually awkward — Plan 01 Task 3 notes this.
