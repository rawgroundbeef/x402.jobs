# Phase 32: Platform Fee Replacement - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Scope change during discussion:** Phase scope reduced — all 5 ANNOUNCE-* requirements removed (not deferred — removed). Phase name should be renamed from "Platform Fee Replacement + Announcement" to "Platform Fee Replacement" in ROADMAP.md before planning begins. See `<deferred>` for the announcement removal note.

<domain>
## Phase Boundary

Stand up a self-hosted x402 fee-collection endpoint at `api.x402.jobs/x402/fees/{solana,base}/charge` using the OpenFacilitator SDK. Lower the platform fee from `max(1.5%, $0.01)` to `max(1%, $0.01)`. Repoint `apps/api/src/inngest/utils/charge-platform-fee.ts` (and any other production callsite) at the new endpoint. Snapshot fee config on each new job run at creation time so in-flight jobs are grandfathered. Audit + integration-test the refund flow against the new endpoint. Update CHANGELOG.md (with on-chain-verifiable fee wallet addresses) and `apps/api/env.example`. Remove all `agents.memeputer.com` URLs from the `charge-platform-fee.ts` / `config.ts#platformFee` code paths only — escrow, hiring, ask-jobputer URLs are out of Phase 32 scope.

**Explicitly out of scope (changed during discussion):**
- Public announcement (X thread, LinkedIn, blog) — removed from Phase 32, not deferred. v3.1 ships without a public announcement.
- Wallet publication in social posts — wallet addresses still go in CHANGELOG.md (OPS-01) with explorer links.
- Escrow / hiring board code removal — deferred to v3.2 cleanup milestone (see `<deferred>`).
- Jobputer UI/persona removal — Phase 33 (unchanged).
- `memeputer_name` column resolution — Phase 34 (unchanged).

</domain>

<decisions>
## Implementation Decisions

### Carry-forward from PROJECT.md Key Decisions (LOCKED — do not re-litigate)
- **D-00a:** Fee rate is 1% with $0.01 minimum preserved. Source: PROJECT.md Key Decisions v3.1 table (✓ Locked 2026-05-17).
- **D-00b:** Reuse the existing `FACILITATOR_URL` env var — x402.jobs already runs an OpenFacilitator instance for `apps/api/src/routes/instant.ts`. No new facilitator instance.
- **D-00c:** Recipient address env vars: `FEE_COLLECTION_SOLANA_ADDRESS` + `FEE_COLLECTION_BASE_ADDRESS`. Two vars, no shared key, custody handled out-of-band by the operator.
- **D-00d:** Ship Solana + Base fee endpoints together (no staged rollout). Matches current same-network charging behavior.
- **D-00e:** Same-network fee charging preserved (Solana jobs → Solana fee, Base jobs → Base fee). No cross-chain.
- **D-00f:** In-flight jobs grandfathered (mechanism specified in D-04 below).
- **D-00g:** No backward-compat shim added. Clean cut-over per project convention (OPS-04).
- **D-00h:** Memeputer LLC remains BSL Licensor — decouple is operational only, not legal (CLAUDE.md hard-lock).

### Fee endpoint surface area
- **D-01 (URL):** Fee endpoint URL: `api.x402.jobs/x402/fees/{network}/charge` where `{network}` ∈ {`solana`, `base`}. Verb is `charge` (not `job_fee`) — clearer English, no Jobputer legacy connotation.
- **D-02 (Route file):** Implemented as a single route file `apps/api/src/routes/x402-fees.ts` with a `:network` path param branching internally. Matches the `routes/instant.ts` pattern.
- **D-03 (Facilitator):** Reuse the OpenFacilitator pattern from `routes/instant.ts:36-44` verbatim — `new OpenFacilitator({ url: FACILITATOR_URL, timeout: 60000 })` at module-load, then `facilitator.verify()` + `facilitator.settle()` in the handler. Same env var, same SDK init.
- **D-04 (x402lint validation):** Use the OpenFacilitator SDK's response helper to construct the 402 payload (correct accepts[], CAIP-2 IDs, addresses by construction). PLUS add a CI smoke test that runs `x402lint` against a captured 402 response from the dev server. Belt + suspenders to guarantee FEE-03.

### In-flight job grandfathering mechanism
- **D-05 (Snapshot column):** Add a new column `platform_fee JSONB` to `x402_job_runs` via a new numbered migration (`apps/api/migrations/011_add_platform_fee_snapshot.sql` + `_DOWN`). Schema:
  ```jsonc
  {
    "config":  { "url": "...", "percentage": 0.01, "minimum_usdc": 0.01 },
    "settled": { "tx_hash": "...", "amount_paid": 0.123, "settled_at": "2026-..." }
  }
  ```
  `config` is populated when the run row is INSERTed (by `apps/api/src/inngest/functions/run-scheduled-jobs.ts` and any other run-creation site). `settled` is updated when `chargePlatformFee` succeeds in `apps/api/src/inngest/functions/run-workflow.ts`.
- **D-06 (Snapshot scope):** Per-run only (on `x402_job_runs`). NOT job-level. No `platform_fee_baseline` on `x402_jobs`. Matches the literal reading of "fee config snapshotted at job-creation" — run-creation IS job-execution-creation in this codebase.
- **D-07 (Read path):** `apps/api/src/inngest/utils/charge-platform-fee.ts` and `apps/api/src/inngest/functions/run-workflow.ts:132-135` read fee config from `run.platform_fee.config` instead of `config.platformFee.*`. Fallback to `config.platformFee.*` only if `run.platform_fee` is null (for runs predating the migration).
- **D-08 (Grandfathering test):** Vitest integration test against in-memory Inngest harness. Test name: "grandfathers in-flight job: run with old fee snapshot routes payment to old URL with old percentage". Co-located at `apps/api/src/inngest/functions/__tests__/grandfather-fee.test.ts`. Models the same pattern as `apps/api/src/inngest/functions/run-workflow/__tests__/escrow.test.ts`.
- **D-09 (Old URL retirement):** `agents.memeputer.com` is removed from `apps/api/src/config.ts#platformFee.resourceUrl` (default flips to `api.x402.jobs/x402/fees/solana/charge`) and from any production code path in Phase 32 with a clean cut-over. `apps/api/env.example` keeps a commented `# PLATFORM_FEE_URL=https://agents.memeputer.com/... (DEPRECATED v3.1, removed in v3.2)` line for one release per OPS-02.

### Memeputer-URL cut-over scope
- **D-10 (Strict scope):** Phase 32 removes `agents.memeputer.com` references ONLY from `apps/api/src/inngest/utils/charge-platform-fee.ts` and `apps/api/src/config.ts#platformFee.resourceUrl`. Other production callsites (`apps/api/src/inngest/utils/charge-escrow.ts`, `apps/api/src/routes/hiring.ts`, `apps/api/src/routes/ask-jobputer.ts`, `apps/api/src/config.ts#escrow.depositUrl`) are NOT touched in Phase 32.
- **D-11 (BASE_PLATFORM_WALLET):** `apps/api/src/config.ts:53-54` hardcoded `BASE_PLATFORM_WALLET` default (`0xAEB58049d3C266D55595a596Fae249C10764a031`, "Jobputer's Base wallet") is removed entirely. The env var is renamed to `FEE_COLLECTION_BASE_ADDRESS` to align with D-00c. Default is empty string. Startup warns if unset (same pattern as `SUPABASE_URL` at `config.ts:128-133`).
- **D-12 (Researcher re-grep):** The gsd-phase-researcher MUST do a wider grep before planning to confirm no other callsite reads `config.platformFee.resourceUrl` or `PLATFORM_FEE_URL` beyond the two already identified (`charge-platform-fee.ts` + `run-workflow.ts:132-135` logging path). Scope: `apps/**/*.ts`, `apps/**/*.tsx`, `packages/**/*.ts`, `scripts/**/*.ts` (and same for `BASE_PLATFORM_WALLET`).
- **D-13 (Escrow breadcrumb):** No source change to `config.ts#escrow.depositUrl` in Phase 32 (no deprecation comment, no removal). Full removal is tracked as a deferred v3.2 cleanup item — see `<deferred>` for the full surface area mapped during discussion.

### Refund flow fee semantics
- **D-14 (Refund policy):** Refund full `total_cost` INCLUDING the platform fee. Caller is made whole on a failed-job refund. Matches current behavior in `apps/api/src/routes/refunds.ts:72`. x402.jobs eats the on-chain settlement cost of the fee transaction without recouping it.
- **D-15 (No production code change to refunds.ts):** `routes/refunds.ts` is not modified in Phase 32 (the chosen policy matches existing behavior). BUT FEE-09 is satisfied by adding an integration test (D-16).
- **D-16 (Refund integration test):** Vitest integration test in `apps/api/src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` that proves: "a job run that paid platform fee via the new `api.x402.jobs/x402/fees/{net}/charge` endpoint, then failed, can be refunded its full `total_cost`." Test must read the snapshot from `x402_job_runs.platform_fee.settled` to confirm the fee was actually charged before the refund is requested. Catches regressions if the snapshot read path breaks the refund flow.
- **D-17 (Refund snapshot reference):** The snapshot column from D-05 includes `settled.amount_paid` so any future refund-policy change can deduct fees accurately. Adding the field now is cheap; the data path is ready when policy changes.

### Announcement-related decisions (REMOVED from Phase 32)
- **D-18 (No announcement):** All 5 ANNOUNCE-* requirements (ANNOUNCE-01 X thread, -02 LinkedIn, -03 blog, -04 wallet publication in announcement, -05 publish-trigger) are REMOVED from Phase 32 — not deferred to a future phase. v3.1 ships without a public announcement. `ROADMAP.md` and `REQUIREMENTS.md` need to be updated to reflect this before planning (see "Required ROADMAP/REQUIREMENTS updates" at the bottom of this file).
- **D-19 (Wallet documentation redirected to CHANGELOG):** FEE-06's "documented on-chain-verifiably in the announcement" semantic is re-pointed to CHANGELOG.md (OPS-01). The CHANGELOG v3.1 entry MUST include both fee wallet addresses (`FEE_COLLECTION_SOLANA_ADDRESS` value, `FEE_COLLECTION_BASE_ADDRESS` value) AND their Solscan + Basescan explorer links so any reader can verify the on-chain balance. Phase 32 Success Criterion #5 is rewritten accordingly.
- **D-20 (Phase 32 is backend-only):** With announcements removed, Phase 32 has zero `apps/web` changes. Pure backend work: `apps/api/src/`, `apps/api/migrations/`, `apps/api/env.example`, `CHANGELOG.md`.

### Folded Todos
- **`decouple-x402jobs-from-memeputer.md`** (score 0.6) folded into context.
  - Original problem: x402.jobs is now public OSS but still has hard operational dependencies on Memeputer-owned infrastructure (platform fee endpoint, UI character, schema column).
  - How it fits Phase 32: directly informs D-1 (fee endpoint replacement). The todo's "things the user might not be thinking about" section called out refund-path semantics and in-flight job migration — both addressed by D-08/D-14/D-15/D-16/D-17 above. The wallet-defensibility note (cold storage / multisig) is already locked in PROJECT.md.
  - Action: move `.planning/todos/pending/decouple-x402jobs-from-memeputer.md` → `.planning/todos/done/decouple-x402jobs-from-memeputer.md` after Phase 32 ships (the todo's `resolves_phases: [32, 33, 34]` covers all of v3.1).

### Claude's Discretion
- Exact text of CHANGELOG.md v3.1 entry (within the constraints of OPS-01 + D-19) — planner / executor drafts it from the decisions above.
- Exact wording of the comment lines added to `apps/api/env.example` for the deprecated `PLATFORM_FEE_URL` and the new `FEE_COLLECTION_SOLANA_ADDRESS` / `FEE_COLLECTION_BASE_ADDRESS` env vars.
- Numbered migration file name (e.g., `011_add_platform_fee_snapshot.sql`) — follow `apps/api/migrations/README.md` convention; planner picks the next free number.
- Test file naming / structure within the established `__tests__` directories.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 32 source-of-truth code (READ FIRST)
- `apps/api/src/config.ts` — current `platformFee` block (lines 65-77), hardcoded `BASE_PLATFORM_WALLET` default (line 53-54), `escrow.depositUrl` (lines 80-87 — NOT in Phase 32 scope, see D-10/D-13).
- `apps/api/src/inngest/utils/charge-platform-fee.ts` — the file being replaced. `chargePlatformFee` function + `calculatePlatformFee`. Hardcoded `/solana/` → `/base/` string replace at line 62 also needs updating.
- `apps/api/src/inngest/functions/run-workflow.ts` (lines 75-159) — fee charging callsite + logging path that reads `config.platformFee.resourceUrl` (lines 132-135).
- `apps/api/src/inngest/functions/run-scheduled-jobs.ts` — run-creation site that must populate the new `platform_fee.config` snapshot when INSERTing a run.
- `apps/api/src/routes/refunds.ts` — refund flow being audited (D-15). Lines 72-78 set refund amount from `run.total_cost`.
- `apps/api/src/routes/instant.ts` (lines 36-44, 357-431) — the OpenFacilitator SDK pattern being reused verbatim in the new `routes/x402-fees.ts` (D-03).
- `apps/api/env.example` — env vars being updated (OPS-02).
- `apps/api/migrations/001_initial_schema.sql` — `x402_job_runs` schema being augmented with the `platform_fee` column.
- `apps/api/migrations/README.md` — numbered migration convention (`{NNN}_description.sql` + `_DOWN`).

### Phase 32 decision sources (READ FOR LOCKED CONTEXT)
- `.planning/PROJECT.md` (Key Decisions v3.1 table) — D-00a through D-00h are sourced from here.
- `.planning/ROADMAP.md` (Phase 32 section) — current 18 reqs + 5 success criteria. Will be amended per D-18.
- `.planning/REQUIREMENTS.md` (v3.1 Requirements §FEE, §OPS, §ANNOUNCE) — will be amended per D-18.
- `.planning/todos/pending/decouple-x402jobs-from-memeputer.md` — folded into context (see Folded Todos).
- `.planning/STATE.md` (v3.1 manual tasks) — wallet provisioning task is the operator-side pre-req.

### Project hard locks (READ ALWAYS — non-negotiable)
- `CLAUDE.md` — pnpm@10.6.5 pin, `.npmrc#minimum-release-age=4320`, BSL 1.1 with Memeputer LLC as Licensor (unchanged for v3.1).

### Related external/skill references
- `.planning/codebase/STACK.md` — OpenFacilitator SDK 0.3.0 is the canonical x402 lib in this repo.
- `.planning/codebase/ARCHITECTURE.md` — Inngest functions + Express routes architecture.
- `~/.claude/skills/x402lint/SKILL.md` — `x402lint` validator used for FEE-03 CI smoke test (D-04).
- `~/.claude/skills/openfacilitator/SKILL.md` — OpenFacilitator SDK reference for the verify/settle pattern.

### Cross-phase context (for the planner)
- `.planning/phases/31-monorepo-merge-bsl/31-CONVERGENCE.md` — Phase 31 ship state; pnpm/Docker/Vercel/Railway invariants Phase 32 must preserve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **OpenFacilitator pattern in `routes/instant.ts:36-44`** — exact init code reused verbatim in the new `routes/x402-fees.ts` (D-03). One line of imports, two lines of guarded constructor, one warning log. ~10 lines total to replicate.
- **`executeX402Request` in `inngest/utils/execute-x402.ts`** — the existing client-side x402 caller that `charge-platform-fee.ts:68` uses. The new endpoint must respond in a way this caller can consume (the existing facilitator settle path will Just Work because we reuse FACILITATOR_URL).
- **Migration `_DOWN` convention** — see `apps/api/migrations/README.md`. The new `011_add_platform_fee_snapshot.sql` + `011_add_platform_fee_snapshot_DOWN.sql` follow the flat-numbered pattern documented in CLAUDE.md.
- **Test harness pattern** — `apps/api/src/inngest/functions/run-workflow/__tests__/escrow.test.ts` is the closest analog for the new grandfathering test (D-08).

### Established Patterns
- **`max(percentage, minimum)` fee math** — preserved verbatim from `calculatePlatformFee` (`charge-platform-fee.ts:23-27`). Only the percentage value changes (0.015 → 0.01). The minimum stays at 0.01.
- **Network branching via string replace** — `charge-platform-fee.ts:60-63` does `solana → base` string replace on the URL. New code stores both URLs in the snapshot to avoid this fragile transform.
- **JSONB columns on `x402_job_runs`** — `payments`, `execution_trace` are existing JSONB columns. The new `platform_fee` column follows the same pattern.
- **Run-event logging for fee payments** — `run-workflow.ts:137-156` writes a synthetic `x402_job_run_events` row with `node_id='platform-fee'`, `sequence=-1`. Phase 32 keeps this logging path; reads come from `run.platform_fee.config.url` going forward instead of `config.platformFee.resourceUrl`.

### Integration Points
- **Inngest step boundary** — `step.run("charge-platform-fee", ...)` at `run-workflow.ts:95` is the Inngest-managed atomic boundary. Phase 32 changes what happens INSIDE the step (read from snapshot, route to new URL) but not the step shape itself.
- **`config.ts` env loading** — `dotenv/config` import at line 1 means all env vars are read once at startup. Tests must either mock `config` or set env vars before importing.
- **`apps/api/src/index.ts` route mount** — new `routes/x402-fees.ts` mounts at `/x402/fees` (or wherever — exact mount path picked by planner to land on the FEE-01 URL).

</code_context>

<specifics>
## Specific Ideas

- The chosen URL `api.x402.jobs/x402/fees/{network}/charge` must round-trip cleanly through `x402lint` — researcher should verify the CAIP-2 IDs (`solana:mainnet`, `eip155:8453`) and accept[] schema before planning.
- The snapshot JSONB `{config, settled}` shape was chosen specifically so refund logic can be made fee-aware later without another migration (D-17).
- The grandfathering test should INSERT a synthetic `x402_job_run` row with `platform_fee.config.url = "https://agents.memeputer.com/..."` and `platform_fee.config.percentage = 0.015`, then assert the workflow charges the OLD url with the OLD percentage. This proves the snapshot is honored, not the live config.
- Phase 32 PR title / commit format: `feat(32): platform fee replacement` per CLAUDE.md commit convention.

</specifics>

<deferred>
## Deferred Ideas

### Removed from Phase 32 (per user decision 2026-05-17)

- **All 5 ANNOUNCE-* requirements REMOVED (not deferred — removed).** No X thread, no LinkedIn post, no blog post, no wallet publication via social, no announce-trigger gate. v3.1 ships without a public announcement.
  - Wallet documentation responsibility moves to CHANGELOG.md (OPS-01) per D-19.
  - Phase 32 name should be renamed in ROADMAP.md from "Platform Fee Replacement + Announcement" to "Platform Fee Replacement".
  - REQUIREMENTS.md §ANNOUNCE block (ANNOUNCE-01..05) should be moved to a new top-level "Removed from milestone" section with a 1-line note: "Removed 2026-05-17 during Phase 32 discuss-phase per user decision."
  - **ROADMAP coverage drops from 39/39 to 34/34 — v3.1 coverage stays at 100% of remaining reqs but the absolute count changes.**

### Deferred to v3.2 cleanup milestone

- **Remove dead escrow + hiring-board code** (confirmed dead by user 2026-05-17). Full surface area mapped during discussion:
  - **API source (delete):** `apps/api/src/inngest/utils/charge-escrow.ts`, `apps/api/src/inngest/utils/release-escrow.ts`, `apps/api/src/routes/hiring.ts`, `apps/api/src/services/hiring.service.ts`, `apps/api/src/config.ts` lines 80-87 (`escrow` block).
  - **API mount (delete):** `apps/api/src/index.ts` lines 37 (`import { hiringRouter, hiringPublicRouter } from "./routes/hiring"`) and 191 (`app.use("/bounties", authMiddleware, hiringRouter)`).
  - **Database migration (drop):** 5 tables — `x402_hiring_escrow_ledger`, `x402_hiring_payouts`, `x402_hiring_requests`, `x402_hiring_reviews`, `x402_hiring_submissions`. PLUS 2 columns on `x402_job_runs`: `escrow_deposit_tx`, `escrow_deposit_chain`.
  - **Memeputer URL removed as a side effect:** `agents.memeputer.com/x402/solana/escrowputer/escrow_deposit` (the last remaining backend Memeputer dependency after Phase 32 ships).
  - **Recommended action:** create a new pending todo `.planning/todos/pending/remove-dead-escrow-hiring-code.md` (will be created as part of CONTEXT.md commit). Open as a v3.2 milestone candidate.
  - **Why not Phase 33:** Phase 33 already touches `routes/hiring.ts` (UI-04 for Jobputer ref removal). Could fold there but Phase 33 is already the largest phase; user opted for a dedicated v3.2 cleanup phase instead.

### Reviewed Todos (not folded)
- *(None — the only matching todo, `decouple-x402jobs-from-memeputer.md`, was folded.)*

### Out-of-scope per ROADMAP (unchanged)
- Cross-chain fee settlement, backfilling in-flight jobs (handled via snapshot grandfathering), backward-compat shim, BSL Licensor change, /blog infrastructure.

</deferred>

---

## Required ROADMAP / REQUIREMENTS updates before planning

The scope changes captured above mean `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` need amendments BEFORE `/gsd-plan-phase 32` runs (otherwise the requirements-coverage gate will flag ANNOUNCE-01..05 as uncovered).

1. **Rename Phase 32:** `Platform Fee Replacement + Announcement` → `Platform Fee Replacement` (both ROADMAP.md `### Phase 32:` heading and the Phases bullet list).
2. **Delete ANNOUNCE-01 through ANNOUNCE-05** from ROADMAP.md Phase 32 §Requirements block. Update the count from "Requirements (18)" to "Requirements (13)".
3. **Rewrite ROADMAP.md Phase 32 Success Criterion #5** to: "The fee-collection wallet addresses (Solana + Base) are published in `CHANGELOG.md` v3.1 entry with Solscan and Basescan explorer links; on-chain balances verifiable by anyone reading the CHANGELOG."
4. **Delete or relocate `### Announcement (ANNOUNCE)` block** in REQUIREMENTS.md (ANNOUNCE-01..05). Suggested: move under a new "## Removed during milestone" section with a note "Removed 2026-05-17 during Phase 32 discuss-phase per user decision."
5. **Update milestone summary in REQUIREMENTS.md** if a total count appears anywhere.
6. **Update STATE.md** `v3.1 manual tasks` block — remove "Confirm `/blog` surface availability (ANNOUNCE-03 deferred if no blog exists)" since the entire announcement is gone.
7. **Update ROADMAP.md Phase 32 Notes:** the existing note about "Announcement copy lives in Phase 32 artifacts (drafts) and only goes live once SC1-4 are green in prod (gated by ANNOUNCE-05)" should be deleted.

**Suggested mechanism:** Either edit manually (small, focused edits) OR run `/gsd-phase 32 --edit` to amend the phase definition. After updates land, re-run `/gsd-plan-phase 32`.

---

*Phase: 32-platform-fee-replacement-announcement (directory name retained — phase name change does not rename git directory per workflow Git Branch Invariant)*
*Context gathered: 2026-05-17*
