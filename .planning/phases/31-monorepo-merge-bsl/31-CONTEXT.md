---
phase: 31-monorepo-merge-bsl
created: 2026-05-15
source: locked decisions captured before /gsd-plan-phase 31 ran
---

# Phase 31 — Locked Context (pre-planning)

These decisions are LOCKED before the planner runs. The planner should treat them as constraints, not options to revisit.

## Decision 1: Phase 28 Highs handling

**Locked:** Fold **Batch H (Twitter OAuth hardening)** into Phase 31 as a prerequisite sub-plan. Everything else (Batches A, B, C, D, E, F, G, I) deferred to a `SECURITY.md` "Known unfixed findings" section + filed GitHub issues.

**Why Batch H specifically:** missing `state` nonce + unbounded in-memory `oauthRequests` Map (DoS vector readable in code) + unencrypted Twitter tokens at rest. These are the only Highs that read as embarrassing for a public launch. The unbounded Map is the worst — a researcher finds it in five minutes of reading.

**Batch H source-of-truth:** `.planning/phases/28-security-review/HIGHS-TRIAGE.md` → "Batch H" section. Touches `routes/integrations.ts:225-342`, the `oauthRequests` Map, and `x402_user_x_tokens` schema (token columns need encryption migration).

**Sub-fixes in Batch H (all four required):**
1. Add `state` nonce on init; verify on callback
2. Move `oauthRequests` from in-memory `Map` → Redis OR new `x402_oauth_pending` table with TTL
3. Encrypt `access_token` + `access_secret` at rest using existing `encryptSecret` from `lib/instant/encrypt`
4. Migration path for already-connected accounts (either one-shot re-encrypt script or force re-auth)

**Other Highs path:**
- `SECURITY.md` ships with Phase 31 listing the deferred findings, severity, and tracking issue links
- Each deferred High becomes a GitHub Issue at launch time
- This is the standard public-project pattern: acknowledge + track, don't pretend they don't exist

## Decision 2: License

**Locked:** BSL 1.1 with **Sentry-style Additional Use Grant**.

**Additional Use Grant text (draft for planner — refine in plan):**
> "You may make use of the Licensed Work, provided that you do not use the Licensed Work for a Commercial Service. A 'Commercial Service' is a service that competes with the commercial product or service offered by Licensor (or its successor) that is materially similar to x402.jobs, including but not limited to a hosted service that allows third parties to create or execute paid HTTP workflow endpoints with x402 payments."

**Change date:** 4 years from initial public commit. Falls back to Apache-2.0.

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
