---
title: Remove dead escrow + hiring-board code (5 tables, 2 columns, 4 source files, /bounties route)
created: 2026-05-17
source_phase: 32-platform-fee-replacement-announcement (discuss-phase scope reduction)
priority: MEDIUM — dead code cleanup; not blocking anything in v3.1, but the last `agents.memeputer.com` URL in `apps/api/` lives here
estimated_effort: 1 focused phase (code deletions + 1 migration + verify no external API consumers)
target_milestone: v3.2 (cleanup)
---

# Remove dead escrow + hiring-board code

## Why this exists

During Phase 32 discuss-phase (2026-05-17), the user confirmed the escrow + hiring-board feature is dead — "we don't have that feature anymore." It was originally part of a creator-bounty / hiring-request flow that paid escrowed USDC through `agents.memeputer.com/x402/solana/escrowputer/escrow_deposit`. The frontend was never wired up (web grep finds no `hiring`/`HireBoard`/`HiringModal` matches in `apps/web/src/`), and the backend code path is unreachable from the live UI.

Removing it accomplishes three things:
1. Kills the **last** `agents.memeputer.com` URL in `apps/api/src/` after Phase 32 ships (Phase 33 handles the Jobputer help bubble URLs in `apps/web/` + `routes/ask-jobputer.ts`).
2. Drops 5 unused tables (with their RLS, indexes, FKs) — reduces schema surface area for new contributors reading the DB.
3. Removes ~4 unused source files + a `/bounties` mount that's currently shipping in prod for nobody.

Deferred from Phase 32 explicitly because Phase 32's announcement-narrative was already removed (per user) and adding a 5-table migration would over-scope it.

## Surface area (mapped during Phase 32 discuss-phase grep)

### Source files to delete

- `apps/api/src/inngest/utils/charge-escrow.ts`
- `apps/api/src/inngest/utils/release-escrow.ts`
- `apps/api/src/routes/hiring.ts` (also referenced by Phase 33 UI-04 for Jobputer cleanup — check Phase 33 work hasn't started before deleting; if it has, coordinate)
- `apps/api/src/services/hiring.service.ts`

### Source files to edit

- `apps/api/src/config.ts` — delete lines 80-87 (`escrow` block).
- `apps/api/src/index.ts` — delete line 37 (`import { hiringRouter, hiringPublicRouter } from "./routes/hiring"`) and line 191 (`app.use("/bounties", authMiddleware, hiringRouter)`).
- `apps/api/env.example` — delete `ESCROW_DEPOSIT_URL` and `ESCROW_ENABLED` env var lines (if present).

### Database migration

New migration `apps/api/migrations/{NNN}_drop_dead_escrow_hiring.sql` + `_DOWN`:

- `DROP TABLE` (CASCADE — has FKs): `x402_hiring_escrow_ledger`, `x402_hiring_payouts`, `x402_hiring_requests`, `x402_hiring_reviews`, `x402_hiring_submissions`.
- `ALTER TABLE x402_job_runs DROP COLUMN escrow_deposit_tx`.
- `ALTER TABLE x402_job_runs DROP COLUMN escrow_deposit_chain`.
- `_DOWN`: restore from `001_initial_schema.sql` definitions.

### Last `agents.memeputer.com` URL removed as a side effect

`https://agents.memeputer.com/x402/solana/escrowputer/escrow_deposit` (the escrow endpoint). After this phase ships, `git grep agents.memeputer.com apps/api/src/` should return zero matches.

## Pre-work verification (must do BEFORE deleting)

1. **Confirm no external API consumers.** Query Railway / API access logs for the prior 30 days: any traffic to `/bounties/*`? If yes — those callers will break. Decide: deprecation window or hard cut.
2. **Confirm DB has no live data.** Run `SELECT count(*) FROM x402_hiring_requests` against prod. If non-zero — coordinate with the user (data export? migration to another store? confirm OK to drop).
3. **Confirm no other code reads from these tables.** `git grep -rn "x402_hiring_\|escrow_deposit_tx\|escrow_deposit_chain" apps/ packages/` — should match only the files being deleted.
4. **Check Phase 33 hasn't started touching `routes/hiring.ts` yet.** If Phase 33 is in-flight, coordinate file deletion vs Jobputer-ref edits.

## Out of scope for this phase

- Re-implementing escrow / hiring elsewhere — confirmed dead, not relocated.
- Touching anything Jobputer-persona-related — that's Phase 33 (v3.1 milestone).
- Re-purposing the freed columns or tables — pure deletion only.

## Recommended phase shape

Single-plan phase, ~3-5 atomic tasks:
1. Verify no external API consumers / live data (pre-work above)
2. Write + apply migration `{NNN}_drop_dead_escrow_hiring.sql`
3. Delete the 4 source files + `config.escrow` block + `index.ts` mounts
4. Update `env.example` (remove escrow env vars)
5. Smoke test: `pnpm dev` boots clean, `pnpm test` green, `apps/api` builds, deploy to Railway succeeds

## Why deferred (not in v3.1)

- v3.1 milestone scope is "decouple from Memeputer" — escrow IS a Memeputer-coupled surface, but the user opted to keep Phase 32 narrow (fee-only) after the announcement scope was removed.
- Phase 33 is already the largest phase in v3.1 (Jobputer removal + 8 new docs pages). Adding 5-table migration to it inflates risk.
- A dedicated v3.2 cleanup phase has cleaner PR boundaries and easier revert.

## Files to read first when picking this up fresh

- `apps/api/src/inngest/utils/charge-escrow.ts` (the dead caller)
- `apps/api/src/routes/hiring.ts` (the dead route)
- `apps/api/src/config.ts` lines 80-87 (the dead config)
- `apps/api/migrations/001_initial_schema.sql` (the 5 tables + 2 columns)
- This file (you're reading it)
- `.planning/phases/32-platform-fee-replacement-announcement/32-CONTEXT.md` `<deferred>` section (full surface area mapped)
