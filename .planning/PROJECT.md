# x402jobs

## What This Is

A marketplace for monetized API resources. Creators register or create x402-enabled endpoints — URL resources, proxied URLs, Claude prompt templates, and OpenRouter-powered models — and earn payments when callers execute them. Server handles execution, payment, and security.

## Core Value

Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure — register a URL, wrap one with payments, or create an AI-powered resource and start earning.

## Current State (v1.0 Shipped)

**Shipped:** 2026-01-20
**Stats:** 5 phases, 11 plans, ~10,000 lines TypeScript

### What's Built

- **Database:** pt\_\* columns on x402_resources, RLS view for security
- **Creator UI:** System prompt editor, parameter management, Claude API key integration
- **Execution:** Server-side with @anthropic-ai/sdk, streaming, parameter substitution
- **Caller UI:** Detail page, parameter form, payment flow, PaymentReceipt
- **Logging:** Usage tracking with x402_prompt_template_usage_logs table

### Key Architecture

- **Security Model:** Template is the IP (protected), API key is creator's (encrypted on server)
- **Data Flow:** Caller pays via x402 → Server assembles prompt → Server calls Claude → Stream to caller
- **Stack:** @anthropic-ai/sdk on server, Next.js 15 frontend, Supabase database

## Requirements

### Validated

- ✓ Creator can create prompt template resource with system prompt, parameters, and price — v1.0
- ✓ Parameter syntax uses `{param}{/param}` tags in template — v1.0
- ✓ Caller can view template name, description, params, and metrics (but not prompt) — v1.0
- ✓ Caller can fill parameter values via generated form — v1.0
- ✓ Caller can optionally provide user message (system+user mode) — v1.0
- ✓ Payment via x402 to creator before execution — v1.0
- ✓ Server-side execution with creator's encrypted API key — v1.0 (architecture pivot)
- ✓ Streaming response display for good UX — v1.0
- ✓ Usage logging (template_id, caller, success/fail, token counts) — v1.0
- ✓ Visual workflow builder with nodes/edges — existing
- ✓ Resource types (URL, Webhook) with discovery and metrics — existing
- ✓ x402 payment integration (Solana, Base) — existing
- ✓ Creator dashboard with earnings tracking — existing
- ✓ Resource detail pages with usage stats — existing
- ✓ Create Resource modal flow — existing

- ✓ Full-page wizard at `/resources/new` replaces all creation modals — v2.0
- ✓ 4-step flow: Choose Type → Configure Source → Resource Details → Review & Publish — v2.0
- ✓ Link Existing path with x402check validation and full-width results — v2.0
- ✓ Proxy path wraps non-x402 URL with x402 payments — v2.0
- ✓ Claude Prompt path (system prompt, parameters, API key check) — v2.0
- ✓ OpenRouter path (model browser, prompt template, parameter config) — v2.0
- ✓ Shared resource details step (name, slug, description, image, category, price, network) — v2.0
- ✓ Review & publish step with edit links back to relevant steps — v2.0
- ✓ URL-based routing with session storage state persistence — v2.0
- ✓ x402check components imported for validation UI — v2.0
- ✓ Old CreateResourceModal removed — v2.0
- ✓ Mobile-responsive layout (full-page stacks naturally) — v2.0
- ✓ Wallet encryption at rest (AES-256-GCM) — v3.0 Phase 27
- ✓ Structured security review (criticals + highs shipped) — v3.0 Phase 28
- ✓ Bulk resource registration UI — v3.0 Phase 29
- ✓ pnpm 10 pin + supply-chain `.npmrc` (4320min release-age) — v3.0 Phase 30
- ✓ Monorepo merge (apps/api + apps/web) + BSL 1.1 license — v3.0 Phase 31

### Active

<!-- v3.1 milestone — see Current Milestone block below for details. -->

- [ ] Self-hosted x402.jobs fee endpoint (replaces `agents.memeputer.com/x402/.../jobputer/job_fee`)
- [ ] Platform fee rate reduced (1.5% → ~1%, exact rate confirmed pre-Phase 32)
- [ ] Jobputer character + help-bubble removed from all 14 production touchpoints
- [ ] `/docs` expansion (SDK quickstart, x402 primer, common recipes, troubleshooting) fills the help-vacuum
- [ ] `x402_servers.memeputer_name` column investigation + resolution (rename vs drop)
- [ ] Decouple + fee-reduction announcement (X thread, LinkedIn, blog if surface exists)
- [ ] Operator-decouple checklist documented for self-hosters (env-var migration, fee-wallet address)

## Current Milestone: v3.1 Decouple from Memeputer / Jobputer infrastructure

**Goal:** Remove all operational + UI dependencies on Memeputer-owned services so a fork of x402.jobs is fully self-runnable. Ship a price-drop announcement at the same time. The BSL 1.1 Licensor (Memeputer LLC) is unchanged — this is operational/UI decoupling, not legal.

**Target features:**

- New x402.jobs-native fee endpoint under `api.x402.jobs/x402/fees/...` built with the OpenFacilitator SDK; 402 responses validated with x402lint. Same-network charging (Solana for Solana jobs, Base for Base jobs) preserved.
- Platform fee rate reduction (current: `max(1.5%, $0.01 min)`; target: leaning 1%, exact number confirmed before Phase 32 lands). Becomes the announcement headline.
- New fee-collection wallet address — defensibly long-term (cold storage or multisig, not an operational hot wallet).
- Refund flow audited: in-flight fee semantics + `apps/api/src/routes/refunds.ts` still work with the new endpoint.
- Jobputer persona removed from all surfaces: `JobputerChatButton.tsx`, `AskJobputerModal.tsx`, `BaseLayout.tsx`, modal contexts, JobCanvas, transform modals/panels, hire/workflow-chat/resources/ask-jobputer API routes. No replacement mascot.
- Help-bubble vacuum filled by `/docs` improvements — `getting-started`, `developer`, `resources`, `examples`, `errors`, `long-running-resources`, plus new SDK quickstart, x402 primer, common recipes, troubleshooting, and a `/docs/agents` section (sets up future agent-readable skill files).
- `x402_servers.memeputer_name` column investigated (live writer in `apps/api/src/inngest/functions/sync-openrouter-models.ts`) and resolved: rename to neutral (e.g., `external_id`) or drop after refactoring the writer. Decision made inside the schema-cleanup phase.
- Self-hosters get a migration path: env-var deltas (`PLATFORM_FEE_URL` etc.), CHANGELOG.md entry, announcement post copy.
- Combined "fee reduction + going independent" announcement.

### Out of Scope

- Save draft functionality — defer to later
- Bulk import via API — future feature
- Edit existing resource via wizard — defer, separate concern
- Template versioning — new resource = new version
- Response analytics for creators — privacy concerns
- Try-before-buy / free tier — x402 model is pay-per-use
- Changing the BSL 1.1 Licensor entity — Memeputer LLC remains Licensor (CLAUDE.md hard-lock)
- Replacing Jobputer with a new x402.jobs-native persona — explicitly chosen "docs only"
- Backfilling in-flight jobs to the new fee mechanism — fee config is snapshotted at job-creation; only new jobs use the new endpoint

## Key Decisions

| Decision                           | Rationale                                           | Outcome |
| ---------------------------------- | --------------------------------------------------- | ------- |
| Server-side API execution          | Simpler caller UX, follows existing patterns        | ✓ Good  |
| {param}{/param} syntax             | Clear delimiters, easy to parse, readable in editor | ✓ Good  |
| No versioning in v1                | Ship faster, learn usage patterns first             | ✓ Good  |
| Hardcode Sonnet model              | Simplifies pricing, can expand later                | ✓ Good  |
| User-level API key                 | Better UX than per-template, configure once         | ✓ Good  |
| Purple styling for prompt_template | Visual distinction from other resource types        | ✓ Good  |

| Decision                     | Rationale                                         | Outcome   |
| ---------------------------- | ------------------------------------------------- | --------- |
| Full-page wizard over modals | Room for validation, mobile-friendly, URL routing | ✓ Good    |
| 4-step wizard flow           | Progressive disclosure reduces overwhelm          | ✓ Good    |
| Session storage + URL hybrid | Clean URLs, survives refresh, not shareable       | ✓ Good    |
| Import x402check components  | Reuse validated components, don't rebuild         | ✓ Good    |
| Remove old modal immediately | No migration period, clean break                  | ✓ Good    |

| Decision (v3.1)                                | Rationale                                                                                       | Outcome   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| Self-host fee endpoint via OpenFacilitator SDK | Keep x402-call-chain symmetry, eliminate Memeputer dependency, reuse existing tooling           | — Pending |
| Validate fee 402 responses with x402lint       | Catch malformed accepts[] / CAIP-2 mistakes early; both skills already in the user's toolbelt   | — Pending |
| Same-network fee charging (Solana + Base)      | Match current behavior; avoid cross-chain settlement complexity                                 | — Pending |
| Fee rate locked at 1% (with $0.01 minimum)     | Confirmed 2026-05-17 — strong announcement headline, preserves more revenue than 0.5%, simple math | ✓ Locked |
| Reuse existing `FACILITATOR_URL` env var       | x402.jobs already runs an OpenFacilitator instance (used by `apps/api/src/routes/instant.ts`); no new facilitator to provision | ✓ Locked |
| Two env vars for recipient addresses           | `FEE_COLLECTION_SOLANA_ADDRESS` + `FEE_COLLECTION_BASE_ADDRESS` — simple, no shared key, custody handled out-of-band | ✓ Locked |
| Ship Solana + Base fee endpoints together     | Matches current same-network behavior; no staged rollout                                        | ✓ Locked |
| Memeputer LLC remains BSL Licensor             | Decouple is operational/UI, not legal. CLAUDE.md hard-lock.                                     | ✓ Locked  |
| Docs replace Jobputer, no new mascot           | Public OSS project needs proper dev docs more than a help character                             | — Pending |
| `memeputer_name` decision deferred to phase    | Live writer in `sync-openrouter-models.ts`; pick rename vs drop after auditing inside Phase 34  | — Pending |
| In-flight jobs grandfathered                   | Fee config snapshotted at job-creation; don't backfill, just cut over for new jobs              | — Pending |
| Announcement framing: independence + price cut | Combined narrative beats either alone; sets up future "agent runtime" positioning               | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-05-17 after v3.1 milestone start (decouple from Memeputer / Jobputer)_
