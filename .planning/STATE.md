---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Decouple from Memeputer / Jobputer infrastructure
status: planning
last_updated: "2026-05-17T13:30:00.000Z"
last_activity: 2026-05-17
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State: x402jobs

**Initialized:** 2026-01-19

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17)

**Core value:** Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure.

**Current focus:** v3.1 — decouple operational + UI dependencies from Memeputer / Jobputer infrastructure

## Current Position

Phase: 32 — Platform Fee Replacement + Announcement (ready to plan)
Plan: —
Status: Roadmap created (3 phases mapped, 39/39 requirements covered). Phase 32 is the next phase to discuss + plan.
Last activity: 2026-05-17 — v3.1 ROADMAP.md created; v3.0 ROADMAP archived to `.planning/milestones/v3.0-ROADMAP.md`.

**Resume with:** `/gsd-discuss-phase 32` (the discuss step must lock the final fee % per FEE-05 before plan generation begins; see PROJECT.md D-1 / Key Decisions for context).

## Milestone History

- **v1.0 MVP** -- Shipped 2026-01-20 (5 phases, 11 plans)
- **v1.1 Refund Badge** -- Shipped 2026-01-21 (2 phases, 3 plans)
- **v1.2 Resource Detail Redesign** -- Shipped 2026-01-22 (1 phase, 2 plans)
- **v1.3 x402.storage Output Destination** -- Shipped 2026-01-25 (2 phases, 3 plans)
- **v1.4 OpenRouter Instant Resources** -- Code complete 2026-01-28, shipped via repo migration 2026-02 (8 phases, Phases 11-18)
- **v2.0 Resource Registration Redesign** -- Shipped 2026-02-01 (8 phases, Phases 19-26)
- **v3.0 Open Source + Agent-Native** -- Phases 27-31 shipped 2026-05-12 → 2026-05-16 (wallet encryption, security review, bulk register, supply chain, monorepo merge + BSL). Phases 32-33 (Agent SDK + skill.md) deferred to a later milestone (v3.2+).
- **v3.1 Decouple from Memeputer / Jobputer** -- Started 2026-05-17; roadmap created with 3 phases (32-34) covering 39 requirements.

## v1.4 Deployment Blocker — RESOLVED

**Issue (historical):** x402-jobs shared Supabase with memeputer; OpenRouter tables conflicted with existing `ai_models` table.

**Resolution:** Standalone repo migration completed. `x402-jobs-api` runs against its own Supabase project (`mgvojndnifjbxvdxkdyd.supabase.co`). OpenRouter migrations applied. Model sync running.

## Architecture Summary

| Component    | Implementation                                                   |
| ------------ | ---------------------------------------------------------------- |
| Database     | pt\_\* columns on x402_resources, public_x402_resources view     |
| Creator UI   | Full-page wizard at /dashboard/resources/new (v2.0)              |
| API Key      | User-level integration (Dashboard > Integrations > Claude)       |
| Execution    | Server-side via instant.ts with @anthropic-ai/sdk and openai SDK |
| Caller UI    | ResourceDetailPage with inline prompt_template handling          |
| Payment      | /api/execute with x402 facilitator                               |
| Logging      | x402_prompt_template_usage_logs table                            |
| x402.storage | OutputConfigPanel checkbox + useJobPrice integration             |

## Key Decisions

| Decision                             | Rationale                                                 | Date       |
| ------------------------------------ | --------------------------------------------------------- | ---------- |
| Server-side execution                | Simpler caller UX, follows existing patterns              | 2026-01-19 |
| User-level API key                   | Better UX than per-template                               | 2026-01-20 |
| Inline ResourceDetailPage            | Consolidated from separate PromptTemplateDetailPage       | 2026-01-20 |
| Full-page wizard over modals         | Room for validation, mobile-friendly, URL routing         | 2026-01-30 |
| 4-step wizard flow                   | Progressive disclosure reduces overwhelm                  | 2026-01-30 |
| Session storage + URL hybrid         | Clean URLs, survives refresh                              | 2026-01-30 |
| Import x402check components          | Reuse validated components, don't rebuild                 | 2026-01-30 |
| Remove old modal immediately         | No migration period, clean break                          | 2026-01-30 |
| ResourceEditModal for basic edits    | Lightweight modal sufficient for metadata changes         | 2026-02-01 |
| Details/Review before paths          | Each path phase is immediately end-to-end testable        | 2026-01-30 |
| Session storage key x402jobs:newResource | Consistent with project naming convention             | 2026-01-31 |
| Type-only draft not meaningful       | User can easily re-select, only ask confirmation for name+ | 2026-01-31 |
| Confirmation dialog as div overlay   | Lightweight implementation vs importing Radix Dialog      | 2026-01-31 |
| Category required                    | Per research recommendation, improves discoverability     | 2026-01-31 |
| 4-step wizard (details + review)     | Details and review are now separate visible steps         | 2026-01-31 |
| Minimum price $0.01                  | Matches plan requirement, enforced in Zod schema          | 2026-01-31 |
| Plain fetch for public verify API    | /api/v1/resources/verify is public, no auth needed       | 2026-02-01 |
| Clear validation on URL/method change | Prevents stale validation results                        | 2026-02-01 |
| Pre-filled fields with lock flags    | Auto-detected network/price saved with preFilled flags    | 2026-02-01 |
| Action button right of Cancel        | Per user feedback, wizard footer renders Cancel then action | 2026-02-01 |
| Max tokens 1-64,000 for Claude       | Future-proof for larger context models                    | 2026-02-01 |
| field.id as parameter key            | Proper React tracking when reordering/removing parameters | 2026-02-01 |
| Warning banner conditional render    | Prevent flash with !isLoadingConfig && !hasApiKey check   | 2026-02-01 |
| Store modelName in draft             | Review displays without fetch; backend ignores extra      | 2026-02-01 |
| Collapsed model summary card         | Saves space, clear Change button                          | 2026-02-01 |
| Progressive disclosure for OpenRouter | Hide prompt/params until model selected                   | 2026-02-01 |
| Max tokens 1-128K for OpenRouter     | Wider range than Claude for large context models          | 2026-02-01 |
| Link type routes to POST /resources  | Backend rejects "external" resourceType on /instant       | 2026-02-01 |
| Save verification data to linkConfig | Avoid re-calling verify API during publish                | 2026-02-01 |
| Link redirects use API-generated slug | POST /resources generates slug from name+network          | 2026-02-01 |
| Instant types continue using /instant | Proxy/Claude/OpenRouter work correctly, avoid regression  | 2026-02-01 |
| Self-host fee endpoint (OpenFacilitator SDK) | Eliminate Memeputer dependency, keep x402-call-chain symmetry | 2026-05-17 |
| x402lint validates fee 402 response  | Catch malformed accepts[] / CAIP-2 mistakes early         | 2026-05-17 |
| Same-network fee charging preserved  | Match current behavior; avoid cross-chain settlement      | 2026-05-17 |
| Docs replace Jobputer (no mascot)    | Public OSS project needs dev docs more than a help character | 2026-05-17 |
| memeputer_name decision deferred to Phase 34 | Live writer in sync-openrouter-models.ts; audit before deciding | 2026-05-17 |
| In-flight jobs grandfathered at cut-over | Fee config snapshotted at job-creation; clean cut-over | 2026-05-17 |
| Announcement: independence + price cut combined | Single narrative beats either alone | 2026-05-17 |

## v3.1 Roadmap (3 phases, 39 requirements)

| Phase | Name | Goal | Requirements | Status |
|-------|------|------|--------------|--------|
| 32 | Platform Fee Replacement + Announcement | Self-hosted fee endpoint live, rate lowered, announcement shipped | FEE-01..10, OPS-01/02/04, ANNOUNCE-01..05 (18) | Not started |
| 33 | Jobputer Removal + Docs Investment | Persona stripped from prod; `/docs` fills the help-vacuum | UI-01..07, DOCS-01..08, OPS-03 (16) | Not started |
| 34 | Schema Cleanup | `memeputer_name` audited and resolved via migration | SCHEMA-01..05 (5) | Not started |

## Remaining Manual Tasks

**Current (shared Supabase):**

- [ ] Apply migration 002_add_claude_integration.sql to Supabase
- [ ] Apply migration 003_add_usage_logs.sql to Supabase
- [ ] Apply migration 004_add_supports_refunds.sql to Supabase
- [ ] Update external backend API to accept and store supportsRefunds field
- [ ] Set ADMIN_API_KEY env variable for backfill endpoint

**After repo migration (new Supabase):**

- [ ] Create x402_openrouter_models table (schema in 006 preamble)
- [ ] Apply migration 005_add_openrouter_integration.sql (creates x402_user_openrouter_integrations)
- [ ] Apply migration 006_add_ai_models_curation.sql (adds modality/is_curated to x402_openrouter_models)
- [ ] Run model sync to populate `x402_openrouter_models`

**v3.1 manual tasks (pending phase work):**

- [ ] Lock final platform fee percentage (Phase 32 discuss step) — target 1%, $0.01 minimum preserved
- [ ] Provision new fee-collection wallet (cold storage or multisig) before Phase 32 implementation lands
- [ ] Confirm `/blog` surface availability (ANNOUNCE-03 deferred if no blog exists)

## Session Continuity

**Last session:** 2026-05-17
**Stopped at:** v3.1 roadmap created. 3 phases (32-34) mapped to all 39 requirements. Previous v3.0 ROADMAP.md archived to `.planning/milestones/v3.0-ROADMAP.md` via `git mv`.
**Resume with:** `/gsd-discuss-phase 32` — Platform Fee Replacement + Announcement. The discuss step must lock FEE-05's final fee percentage (target 1%) before plan generation. Source of truth: `.planning/ROADMAP.md` Phase 32 section + `.planning/todos/pending/decouple-x402jobs-from-memeputer.md`.

**Active context for next session:**

- v3.1 roadmap: `.planning/ROADMAP.md` (just created)
- v3.0 archived: `.planning/milestones/v3.0-ROADMAP.md`
- Milestone scoping doc / "why this matters" context: `.planning/todos/pending/decouple-x402jobs-from-memeputer.md` (D-1/D-2/D-3 decision context, files-to-read list, suggested sequencing)
- Locked decisions (do not re-litigate): PROJECT.md "Key Decisions" v3.1 table
- Hard locks: CLAUDE.md (pnpm@10.6.5 exact, .npmrc release-age=4320, BSL 1.1 with Memeputer LLC as Licensor — unchanged for v3.1)
- Files to read first for Phase 32: `apps/api/src/config.ts`, `apps/api/src/inngest/utils/charge-platform-fee.ts`, `apps/api/src/routes/refunds.ts`, `apps/api/env.example`

---

_State initialized: 2026-01-19_
_v1.0 complete: 2026-01-20_
_v1.1 complete: 2026-01-21_
_v1.2 complete: 2026-01-22_
_v1.3 complete: 2026-01-25_
_v1.4 complete: 2026-01-28_
_v2.0 started: 2026-01-30_
_v2.0 roadmap created: 2026-01-30_
_v2.0 19-01 complete: 2026-01-31_
_v2.0 20-01 complete: 2026-01-31_
_v2.0 20-02 complete: 2026-01-31_
_v2.0 21-01 complete: 2026-02-01_
_v2.0 21-02 complete: 2026-02-01_
_v2.0 22-01 complete: 2026-02-01_
_v2.0 23-01 complete: 2026-02-01_
_v2.0 24-01 complete: 2026-02-01_
_v2.0 25-01 complete: 2026-02-01_
_v2.0 26-01 complete: 2026-02-01_
_v2.0 complete: 2026-02-01_
_v3.0 started: 2026-05-12_
_v3.0 Phase 27 (wallet encryption) complete: 2026-05-12_
_v3.0 Phase 28 (security review) started: 2026-05-12, Criticals shipped 2026-05-13, ALL 12 HIGHs shipped 2026-05-14 (api repo PR #32, commit c751857)_
_v3.0 Phase 29 (bulk resource registration) planned: 2026-05-13_
_v3.0 Phase 30 (supply chain hardening) added to roadmap: 2026-05-14_
_v3.0 Phase 30 (supply chain hardening) complete: 2026-05-14 (PRs #20 + #33 ready to merge; pre-merge deploy validation skipped per project convention)_
_v3.0 Phase 31 (monorepo merge + BSL) complete: 2026-05-16_
_v3.1 started: 2026-05-17_
_v3.1 roadmap created: 2026-05-17 (3 phases 32-34, 39/39 requirements mapped)_
