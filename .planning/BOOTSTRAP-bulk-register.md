---
type: handoff
purpose: Context for a fresh Claude Code session taking over the bulk resource registration side quest from a previous session
created: 2026-05-13
prerequisite-pr: x402-jobs-api PR #29 (CRIT-07 SSRF — pending merge at time of handoff)
---

# Bootstrap — Bulk Resource Registration (Phase 29 side quest)

You're inheriting a side quest from a previous Claude Code session. The user has another window where their tmux got squished and wants you to take over. **Read this whole file before doing anything**, then confirm with the user before starting work.

## What you're doing

Implement a new `POST /api/v1/resources/bulk` endpoint that lets API customers register up to ~25 x402 resources in one HTTP request, instead of N round trips for N resources. The product motivation: marketplaces are the `/developers` page's target audience and the marketing page already implies bulk is supported ("One call and your resources are discoverable") — but the API today only supports single-item registration.

**Sized at ~1.5 days, 2 PRs:**
1. `x402jobs-api`: new bulk endpoint + a refactor that extracts per-item registration into a shared internal function
2. `x402jobs`: docs page (`/docs/resources` adds a "Bulk registration" section) + marketing tweak (`/developers` page)

## Read these first (in order)

1. **The PRD — your spec for this work:**
   `/Users/rawgroundbeef/Projects/x402jobs/.planning/PRD-bulk-resource-registration.md`
   Covers: problem, API contract (request/response shape), limits, auth, docs/marketing changes, decisions to confirm with user, non-goals, risks. The PRD is detailed enough that you should NOT run `/gsd-discuss-phase` — go straight to `/gsd-plan-phase` with the PRD as the input context.

2. **The single endpoint you're refactoring:**
   `/Users/rawgroundbeef/Projects/x402jobs-api/src/routes/public-api.ts` lines 1-50 (imports / setup) and 142-~600 (the `POST /resources` handler — note the second route at 614+ is the PUT update, not relevant here). The refactor extracts the per-item body into `registerOneResource(input, apiKeyUser)` so bulk and single share it. Don't change single-endpoint external behavior.

3. **The two pages that need doc/marketing edits:**
   - `/Users/rawgroundbeef/Projects/x402jobs/apps/web/src/app/developers/page.tsx` — lines 302-330 ("Running a marketplace?" section)
   - `/Users/rawgroundbeef/Projects/x402jobs/apps/web/src/app/docs/resources/page.tsx` — the `#programmatic-registration` anchor mentioned in the marketing page

## Repo layout (important — there are TWO repos)

This project is split across two directories right now:

| Path | What's there | GitHub |
|---|---|---|
| `~/Projects/x402jobs` | Turborepo monorepo: `apps/web` (frontend), `packages/sdk`, `packages/ui`, AND `.planning/` (this PRD, all phase docs) | (frontend / planning repo) |
| `~/Projects/x402jobs-api` | Express API codebase (`src/routes/`, `src/lib/`, etc.) | `github.com/rawgroundbeef/x402-jobs-api` |

API PRs go to `x402-jobs-api`. Docs/marketing/frontend PRs go to `x402jobs`. Phase 30 plans to merge them into one monorepo as `apps/api/...` but that hasn't happened yet.

There's already a memory file noting this at `~/.claude/projects/-Users-rawgroundbeef-Projects-x402jobs/memory/repo_layout.md`.

## Current state (snapshot 2026-05-13)

**Phase 28 (security review):**
- All 7 Criticals remediated. CRIT-07 (SSRF) is the last one — open as `x402-jobs-api` **PR #29** ("fix: block SSRF on user-supplied fetch targets"). Awaiting merge.
- 13 Highs triaged in `.planning/phases/28-security-review/HIGHS-TRIAGE.md`. Not yet started.

**Phase 29 (this work):**
- Newly approved by user as the bulk-register side quest, slotted BEFORE the Phase 28 Highs work.
- Previous session ran the PRD draft to clipboard handoff; user wants you to plan and execute.
- Reasoning (from previous session, confirmed by user): "marketplaces asking 'can I register 100 endpoints in one call?' is a leak in the acquisition funnel today; the security Highs are real but invisible to customers. Ship the visible win, then go heads-down on Highs."

**Uncommitted state in `~/Projects/x402jobs`** that is **NOT yours to touch**:
- `M .gitignore`
- `M .planning/MILESTONES.md`
- `M .planning/STATE.md`
- `?? .planning/phases/27-wallet-encryption/`
- `?? .planning/v2.0-MILESTONE-AUDIT.md`
- `?? .planning/v3.0-MILESTONE-SCOPE.md`

These predate this side quest. Don't `git add` them. Only stage Phase 29 work.

## Open decisions to confirm with the user before planning

Per the PRD's "Decisions to confirm" section. Ask once, batched:

1. **Cap size — 25 items per bulk request, or higher (50/100)?**
   PRD recommends 25 based on timeout math (25 × 5 concurrency × ~3s ≈ 15s wall clock, well under 60s Railway default). Higher means we need to think harder about timeouts. Confirm 25 or ask user's preference.

2. **Ownership conflicts: `skipped` or `error` status?**
   PRD recommends `skipped` with reason `not_owner` inline so a "register everything I have, ignore conflicts" flow is one call. Confirm.

3. **Rate limit bucket — separate from single endpoint, or shared?**
   PRD recommends separate (6 bulk req/min, distinct from single endpoint's existing limit). Confirm.

4. **Async escape hatch on day 1?**
   PRD says sync-only for v1, defer async. Confirm.

If user defers any of these or wants to discuss, that's fine — but get explicit answers before kicking off `/gsd-plan-phase`.

## Recommended workflow

1. **Wait for PR #29 to merge** (or get user's OK to start before — but it complicates the diff and the SSRF protection inheritance assumption).
2. **Confirm the 4 decision points above** with the user, in a single batched ask.
3. **Skip `/gsd-discuss-phase`.** The PRD covers the discuss-phase deliverables already.
4. **Run `/gsd-plan-phase`** with the PRD as input. Phase ID: `29-bulk-resource-registration`. Expect 2-3 plans inside the phase:
   - `01-api-endpoint.md` — refactor per-item logic + add bulk handler + tests
   - `02-docs.md` — update `/docs/resources` page
   - `03-marketing.md` — update `/developers` page
5. **Execute** with `/gsd-execute-phase`. The API endpoint plan lands as one PR in `x402-jobs-api`. Docs + marketing land as one PR in `x402jobs`.
6. **Verify** with `/gsd-verify-work` against the PRD's contract (per-item response shape, status codes, summary counts).

## Gotchas

1. **Don't stage unrelated untracked files.** See list above. Use specific filenames in `git add`, not `git add .` or `git add -A`.
2. **Two repos, two PRs.** Don't try to make one PR span both repos.
3. **`safeFetch` is only on `main` after PR #29 merges.** The PRD assumes the bulk endpoint inherits SSRF protection automatically via the existing `fetchX402Metadata` → `safeFetch` chain. If you start before #29 merges, that assumption is wrong and you'd need to either wait or hand-add SSRF protection.
4. **The single endpoint's existing test suite must pass unchanged after the refactor.** The refactor is the highest-risk part of this work. Run `pnpm vitest run --exclude '**/resource-registration*'` (this exclusion is a longstanding thing — pre-existing test bugs in those files, not security) and confirm the single-endpoint tests in `public-api.integration.test.ts` still pass before adding bulk-specific tests.
5. **The user prefers terse responses** and explicit confirmation before risky/visible actions (PR opens, force-pushes, etc.). They're comfortable with you proceeding autonomously on local code changes once the plan is approved.
6. **Date today is 2026-05-13.** Use absolute dates in any planning docs.

## Pre-flight checks before starting

```bash
# In ~/Projects/x402jobs-api:
cd ~/Projects/x402jobs-api
git status                           # should be clean / on main / no uncommitted changes after PR #29 merges
gh pr view 29                        # confirm CRIT-07 status
git log --oneline -5                 # confirm CRIT-07 commit is on main

# In ~/Projects/x402jobs:
cd ~/Projects/x402jobs
git status                           # confirm unrelated uncommitted files are still there (you won't touch them)
ls .planning/PRD-bulk-resource-registration.md   # confirm PRD is present
ls .planning/BOOTSTRAP-bulk-register.md          # confirm this file (you're reading it)
```

## Memory available

You have a persistent memory system at `~/.claude/projects/-Users-rawgroundbeef-Projects-x402jobs/memory/`. Existing memories:

- `project_overview.md` — what x402.jobs is at the product level
- `repo_layout.md` — the two-repo split

Update these if you learn anything project-level worth persisting. Don't duplicate facts that this bootstrap file already captures (this file is transient — the persistent stuff goes in memory).

## If you get stuck

Things that would justify pausing and asking the user:

- PR #29 has merge conflicts or unexpected review feedback
- The single-endpoint refactor turns out to be larger than expected (e.g., the per-item logic has hidden coupling that doesn't extract cleanly) — recommend smaller scope or different approach
- One of the decision points has a non-obvious tradeoff that wasn't anticipated
- You discover the bulk-register feature actually does exist somewhere and the previous session missed it (unlikely — searches for `bulk`, `batch`, `bulkRegister`, `registerMany`, `bulkResource` came up empty in `routes/`)

Good luck. The previous session's plan is sound; the PRD is detailed; the user is responsive. Ship a clean Phase 29.
