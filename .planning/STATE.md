# State: x402jobs

**Initialized:** 2026-01-19

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-30)

**Core value:** Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure.

**Current focus:** v2.0 Resource Registration Redesign

## Current Position

**Phase:** 24 - OpenRouter Path (6 of 7 v2.0 phases)
**Plan:** 24-01 of 1 complete
**Status:** Phase complete, verified (11/11 must-haves)
**Last activity:** 2026-02-01 -- Phase 24 complete: OpenRouter config with model browser

```
v2.0 Progress: [████████] 8/14 plans (57%)
Phase 24:      [█] 1/1 plan (100%)
```

## Milestone History

- **v1.0 MVP** -- Shipped 2026-01-20 (5 phases, 11 plans)
- **v1.1 Refund Badge** -- Shipped 2026-01-21 (2 phases, 3 plans)
- **v1.2 Resource Detail Redesign** -- Shipped 2026-01-22 (1 phase, 2 plans)
- **v1.3 x402.storage Output Destination** -- Shipped 2026-01-25 (2 phases, 3 plans)
- **v1.4 OpenRouter Instant Resources** -- Code complete 2026-01-28, deployment paused (8 phases, Phases 11-18)
- **v2.0 Resource Registration Redesign** -- Started 2026-01-30 (7 phases, Phases 19-25)

## v1.4 Deployment Blocker

**Issue:** x402-jobs shares Supabase with memeputer. OpenRouter tables conflict with existing `ai_models` table.

**Resolution:** Migrate x402-jobs to standalone repo with its own Supabase project.

**To resume v1.4 deployment:**

1. Create standalone x402-jobs repo (frontend open source, backend private)
2. Set up new Supabase project
3. Apply migrations 005 and 006 (tables already namespaced with `x402_` prefix)
4. Uncomment OpenRouter option in CreateResourceModal.tsx
5. Run model sync to populate `x402_openrouter_models`

## Architecture Summary

| Component    | Implementation                                                   |
| ------------ | ---------------------------------------------------------------- |
| Database     | pt\_\* columns on x402_resources, public_x402_resources view     |
| Creator UI   | CreateResourceModal with prompt template type                    |
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

**Last session:** 2026-02-01
**Stopped at:** Completed 24-01-PLAN.md
**Resume with:** `/gsd:discuss-phase 25` (start Phase 25: Cleanup)

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
