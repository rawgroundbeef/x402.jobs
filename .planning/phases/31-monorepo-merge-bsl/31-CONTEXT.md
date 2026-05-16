---
phase: 31-monorepo-merge-bsl
created: 2026-05-15
source: locked decisions captured before /gsd-plan-phase 31 ran
---

# Phase 31 — Locked Context (pre-planning)

These decisions are LOCKED before the planner runs. The planner should treat them as constraints, not options to revisit.

## Decision 1: Phase 28 Highs handling — SUPERSEDED 2026-05-15

**Original framing (2026-05-15 09:30):** Fold Batch H (Twitter OAuth hardening) into Phase 31 as a prerequisite sub-plan; defer everything else to a `SECURITY.md` "Known unfixed findings" section.

**Updated reality (2026-05-15 10:30, after Phase 31 research):** ALL 12 outstanding HIGHs were shipped together in **x402jobs-api PR #32 (commit `c751857`) on 2026-05-14** — before Phase 30 even merged. Verified via direct file reads: migration 009 (`x402_oauth_pending` table + `access_token_ciphertext` columns), rewritten `src/routes/integrations.ts:230-411` (state nonce + DB-backed pending + dual-write encryption), `scripts/migrate-encrypt-x-tokens.ts` (idempotent backfill). The PR also touches every file mentioned across batches A–I (`routes/upload.ts`, `routes/escrow.ts`, `routes/webhooks.ts`, `routes/user.ts`, `routes/wallet.ts`, `routes/runs.ts`, new `src/lib/run-status-signing.ts`, deletion of `src/lib/safe-fetch.ts`).

**Locked replacement (2026-05-15):**
- Phase 31 has NO pre-merge OAuth hardening sub-plan. The work is already in the api repo; it rides along in the squashed import as already-done code.
- `SECURITY.md` "Known unfixed findings" section is **empty** at launch. Document only: (a) the Phase 30 release-age policy externally, (b) the private security-disclosure contact, (c) the link to historical security review artifacts in `.planning/phases/28-security-review/` for transparency.
- `STATE.md` and `.planning/phases/28-security-review/HIGHS-TRIAGE.md` were stale on this point; updated as part of the Phase 31 planning cleanup commit.

## Decision 2: License

**Locked:** BSL 1.1 with **Sentry-style Additional Use Grant**.

**Licensor entity (locked 2026-05-15):** **Memeputer LLC** — use verbatim in the BSL 1.1 Licensor field, copyright notice header, and grant attribution. NOT "Ben Tatum" personally; NOT "x402.jobs" (the project) — the legal owner is the LLC.

**Copyright notice (verbatim for LICENSE header):**
> `Copyright © 2026 Memeputer LLC. All rights reserved.`

**Additional Use Grant text (locked verbatim from CONTEXT, user confirmed 2026-05-15):**
> "You may make use of the Licensed Work, provided that you do not use the Licensed Work for a Commercial Service. A 'Commercial Service' is a service that competes with the commercial product or service offered by Licensor (Memeputer LLC, or its successor) that is materially similar to x402.jobs, including but not limited to a hosted service that allows third parties to create or execute paid HTTP workflow endpoints with x402 payments."

(Difference from initial draft: licensor named explicitly as Memeputer LLC inside the parenthetical, replacing the bare "Licensor (or its successor)".)

**Change date:** 4 years from initial public commit (target: 2030-05-19 if open-source flip lands 2026-05-19; planner picks the exact date at LICENSE-creation time). Falls back to Apache-2.0.

**Internal commercial use is allowed.** Self-hosting for internal company use is allowed. The grant only forbids re-offering x402.jobs (or a substantially similar workflow-with-x402-payments hosted product) as a commercial service to third parties.

## Decision 3: Git history strategy

**Locked:** Squashed import of `x402jobs-api` working tree → `apps/api/`.

**Why:** Cleaner public starting point; closed-repo commit history is preserved in the **archived `rawgroundbeef/x402-jobs-api`** remote (kept private, not deleted). A future contributor with legitimate need can reference the archive.

**Squash commit message:** single commit `feat(monorepo): import x402jobs-api at <archived-commit-sha> into apps/api/`. Reference the archived repo URL + commit sha for provenance.

## Decision 4: Deploy lanes

**Locked:** Stay split. Vercel for `apps/web`, Railway for `apps/api`. Path-filtered triggers so only the affected app redeploys on a PR.

**Why:** No reason to consolidate deploy infra in Phase 31. Both work; both have Phase 30's pnpm@10.6.5 baseline. Moving deploys is its own phase if ever needed.

## Decision 5: Timing pressure

**Note (not locked):** User has tweeted publicly that open-source ships "tomorrow" (relative to 2026-05-14). The planner should NOT assume a literal 24h scope-fit — the user has explicitly said "it's gonna get done when it gets done." Plan the right scope, not the minimum-viable-tweet-honoring scope.

## Decisions NOT locked (planner can decide)

- Whether Batch H lives as `31-01-PLAN` (single plan) or sub-tasks inside the larger merge plan
- Exact CI scope (which test/lint commands fire, which Node version matrix)
- README structure (the planner can propose)
- Migration folder consolidation specifics (planner audits both `supabase/migrations/` and `migrations/`)
- Whether to add `apps/api/CLAUDE.md` or just merge api-specific instructions into root `CLAUDE.md`
- Inngest dev server orchestration — `pnpm dev` should spin up web (3010) + api (3011) + Inngest in a single command; planner picks the mechanism (concurrently, turbo run dev, etc.)

## Source documents the planner should read

- `.planning/v3.0-MILESTONE-SCOPE.md` — Phase 31 section is the authoritative scope source
- `.planning/ROADMAP.md` — Phase 31 entry
- `.planning/phases/28-security-review/HIGHS-TRIAGE.md` — Batch H source-of-truth
- `.planning/phases/28-security-review/REVIEW.md` — for context on the other deferred Highs (so the SECURITY.md "Known unfixed" section captures them accurately)
- `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md` — pnpm 10.6.5 baseline that Phase 31's unified CI must use
- `/Users/rawgroundbeef/Projects/x402jobs-api/` — the source tree being merged in
- `/Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml` — the `ignoredBuiltDependencies: [isolated-vm]` invariant must be preserved during merge
