# State: x402jobs

**Initialized:** 2026-01-19

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-30)

**Core value:** Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure.

**Current focus:** v3.0 Open Source + Agent-Native

## Current Position

**Phase:** 29 - Bulk Resource Registration (planned, ready to execute)
**Plan:** 2 plans (29-01 API in x402jobs-api, 29-02 docs+marketing in x402jobs); plan-check: PASS
**Status:** Phase 28 Criticals shipped (7/7, latest CRIT-07 SSRF merged 2026-05-13); Phase 28 Highs paused; side quest Phase 29 slotted in
**Last activity:** 2026-05-13 -- Phase 29 plans generated; v3.0 phases 29→33 renumbered (supply chain → 30, monorepo → 31, agent SDK → 32+33)

```
v3.0 Progress: [██░░░░░░░░] 1/7 phases (Phase 27 ✓, Phase 28 Criticals ✓, Phase 29 planned)
```

See `.planning/v3.0-MILESTONE-SCOPE.md` for full milestone breakdown.

## Milestone History

- **v1.0 MVP** -- Shipped 2026-01-20 (5 phases, 11 plans)
- **v1.1 Refund Badge** -- Shipped 2026-01-21 (2 phases, 3 plans)
- **v1.2 Resource Detail Redesign** -- Shipped 2026-01-22 (1 phase, 2 plans)
- **v1.3 x402.storage Output Destination** -- Shipped 2026-01-25 (2 phases, 3 plans)
- **v1.4 OpenRouter Instant Resources** -- Code complete 2026-01-28, shipped via repo migration 2026-02 (8 phases, Phases 11-18)
- **v2.0 Resource Registration Redesign** -- Shipped 2026-02-01 (8 phases, Phases 19-26)
- **v3.0 Open Source + Agent-Native** -- In progress 2026-05-12 (Phases 27-33, ~2.5 week target after Phase 29 side quest insert)

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

## Session Continuity

**Last session:** 2026-05-13
**Stopped at:** Phase 29 (bulk resource registration) plans generated and passed plan-check; ready to execute
**Resume with:** Execute Phase 29 — start with `29-01-PLAN.md` (API refactor + bulk endpoint in `~/Projects/x402jobs-api`), then `29-02-PLAN.md` (docs + marketing in `~/Projects/x402jobs`). After Phase 29 ships, resume Phase 28 Highs triage (`.planning/phases/28-security-review/HIGHS-TRIAGE.md`).

**Active context for next session:**
- v3.0 scope doc: `.planning/v3.0-MILESTONE-SCOPE.md` (renumbered 2026-05-13: bulk-register → 29, supply chain → 30, monorepo → 31, agent SDK → 32, agent SDK impl → 33)
- Phase 29 plans: `.planning/phases/29-bulk-resource-registration/29-01-PLAN.md`, `29-02-PLAN.md`, plan-check PASS in `29-PLAN-CHECK.md`
- Phase 29 PRD: `.planning/PRD-bulk-resource-registration.md` (status: approved)
- Phase 29 bootstrap: `.planning/BOOTSTRAP-bulk-register.md` (handoff doc from prior session)
- Phase 28 work-in-progress: `.planning/phases/28-security-review/HIGHS-TRIAGE.md` (deferred until Phase 29 ships)
- **Critical finding from planning:** PR #29 SSRF protection did NOT cover `public-api.ts`/`fetchX402Metadata` — still uses raw `fetch` today. Phase 29 includes migrating it to `safeFetch` as part of the refactor.
- Temporary api copy at `apps/api-audit-tmp/` (gitignored) — delete after Phase 28 Highs wrap
- Local wallet backup file at `~/Projects/x402jobs-api/wallet-backup-*.json` — delete once 1Password copy is confirmed

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
_v3.0 Phase 28 (security review) started: 2026-05-12, Criticals shipped 2026-05-13, Highs deferred_
_v3.0 Phase 29 (bulk resource registration) planned: 2026-05-13_
