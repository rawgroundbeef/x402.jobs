---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: completed
stopped_at: Phase 30 (supply chain hardening) shipped; pnpm@10.6.5 + root .npmrc release-age policy across both repos
last_updated: "2026-05-14T00:00:00.000Z"
last_activity: 2026-05-14
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 16
  completed_plans: 15
  percent: 94
---

# State: x402jobs

**Initialized:** 2026-01-19

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-30)

**Core value:** Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure.

**Current focus:** v3.0 Open Source + Agent-Native

## Current Position

**Phase:** 31
**Plan:** Not started
**Status:** Phase 30 complete; ready to plan Phase 31 (Monorepo Merge + BSL)
**Last activity:** 2026-05-14

```
v3.0 Progress: [████░░░░░░] 2/7 phases (Phase 27 ✓, Phase 28 Criticals ✓, Phase 29 ✓, Phase 30 ✓)
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

**Last session:** 2026-05-14
**Stopped at:** Phase 30 (supply chain hardening) shipped; both repos on pnpm@10.6.5; root `.npmrc` with 72h release-age policy in place; deploy lanes (Vercel + Railway) validation deferred to post-merge per project convention (Railway has no PR previews).
**Resume with:** Plan Phase 31 (Monorepo Merge + BSL) — `/gsd-plan-phase 31`. Phase 31 folds `~/Projects/x402jobs-api` into `apps/api/` of this repo; the existing root `.npmrc` then covers the merged tree.

**Active context for next session:**

- v3.0 scope doc: `.planning/v3.0-MILESTONE-SCOPE.md` (renumbered 2026-05-13: bulk-register → 29, supply chain → 30, monorepo → 31, agent SDK → 32, agent SDK impl → 33)
- **Phase 30 PRs (open as of 2026-05-14):**
  - `x402jobs` PR #20: https://github.com/rawgroundbeef/x402.jobs/pull/20 (5 commits + 5 doc commits on `plan/30-supply-chain-hardening`)
  - `x402jobs-api` PR #33: https://github.com/rawgroundbeef/x402-jobs-api/pull/33 (1 commit on `chore/phase-30-03-pnpm-10-api`)
- Phase 30 artifacts: `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md` (SC evidence map), `30-ROLLBACK.md` (commit shas + revert sequences for 5 failure symptoms)
- Phase 28 work-in-progress: `.planning/phases/28-security-review/HIGHS-TRIAGE.md` (still deferred — Phase 31 is next per ROADMAP)
- Temporary api copy at `apps/api-audit-tmp/` (gitignored) — delete after Phase 28 Highs wrap
- Local wallet backup file at `~/Projects/x402jobs-api/wallet-backup-*.json` — delete once 1Password copy is confirmed
- **Post-merge validation:** After PR #20 and PR #33 merge to main, watch Vercel + Railway build logs for `pnpm@10.6.5` and zero `Ignored build scripts`/`ENOWORKSPACES`/`ERR_PNPM_NO_MATCHING_VERSION` — see `30-CONVERGENCE.md` "Expected build-log assertions" for the full checklist. Use `30-ROLLBACK.md` if anything regresses.

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
_v3.0 Phase 30 (supply chain hardening) added to roadmap: 2026-05-14_
_v3.0 Phase 30 (supply chain hardening) complete: 2026-05-14 (PRs #20 + #33 ready to merge; pre-merge deploy validation skipped per project convention)_
