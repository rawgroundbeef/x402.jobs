# Project Research Summary

**Project:** x402jobs v1.4 - OpenRouter Instant Resources
**Domain:** AI model marketplace integration
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

OpenRouter instant resources extend x402jobs' existing Claude-only AI capabilities to 200+ models via OpenRouter's aggregation platform. Research shows this is a straightforward integration using the official OpenAI SDK (with baseURL override) rather than beta-quality OpenRouter SDKs. The existing x402jobs architecture already supports similar patterns: API key encryption, server-side execution, resource polymorphism, and model catalog syncing via Inngest cron jobs. Approximately 60-70% of required UI components and backend patterns already exist for Claude prompt templates and can be adapted.

The recommended approach is server-side execution using user-provided OpenRouter API keys (BYOK model), stored encrypted in a new `user_openrouter_integrations` table following the existing Discord/Telegram integration pattern. Resources are stored as a new `resource_type = 'openrouter_instant'` in the existing `x402_resources` table with model configuration in JSONB. The platform already has an `ai_models` table synced from OpenRouter that serves as the authoritative model catalog.

Critical risks center on API key security (must be encrypted server-side, never client-exposed), credit exhaustion (users need separate OpenRouter credits beyond x402jobs subscription), and output format inconsistency across models (requires normalization layer). Secondary concerns include model availability changes, rate limiting per OpenRouter account tiers, and pricing volatility. All risks have clear mitigation strategies documented in PITFALLS.md.

## Key Findings

### Recommended Stack

Use the official OpenAI SDK (v6.16.0) configured with OpenRouter's base URL instead of the beta `@openrouter/sdk`. This leverages battle-tested tooling and avoids breaking changes risk. OpenRouter is OpenAI API-compatible, making this a drop-in replacement pattern that works identically to existing Anthropic SDK usage.

**Core technologies:**

- `openai` npm package (^6.16.0): OpenRouter client via baseURL override — stable, well-documented, matches existing Claude SDK pattern
- Native Node.js `crypto` module: API key encryption — reuse existing `encrypt.ts` (AES-256-CBC), proven with Claude keys
- Native `fetch`: Model catalog sync — no library needed for OpenRouter `/api/v1/models` endpoint
- Existing `ai_models` table: Model metadata storage — already synced from OpenRouter, contains 200+ models

**What NOT to add:**

- `@openrouter/sdk` (beta, v0.3.14): Breaking changes risk, rapid iteration, no clear benefit over OpenAI SDK
- `@openrouter/ai-sdk-provider`: Requires Vercel AI SDK peer dependency, adds unnecessary abstraction layer
- Separate encryption libraries: Node.js crypto is sufficient, existing pattern works
- Image processing libraries (Sharp, Jimp): Defer to v2, pass through base64 data URLs

### Expected Features

OpenRouter integration is about extending existing patterns, not building greenfield features. Model browsing requires new UI, but resource creation/execution reuses 60-70% of existing Claude template code.

**Must have (table stakes):**

- Model selection from catalog (search, filter by modality/provider/price, sort by popularity)
- API key configuration page (settings card matching Discord/Telegram pattern)
- Resource creation form (adapt Claude template form with model dropdown)
- Server-side execution (BYOK with user's encrypted key, streaming responses)
- Basic testing/preview (test before publish, show actual costs)
- Cost transparency (display per-execution cost from OpenRouter usage metadata)

**Should have (competitive):**

- Curated model list (20-30 "marketplace ready" models, not all 400+)
- Model cost estimator (prevent creator surprise costs, show markup vs model cost)
- Model capability badges (vision, tools, web search)
- Price breakdown after test ("Model: $0.001, Your markup: $0.009, Total: $0.01")
- Buyer persona preview (see what buyers see before publishing)

**Defer (v2+):**

- Advanced parameter tuning (temperature, top_p) — use sensible defaults
- Multi-model fallback chains — single model per resource initially
- Batch execution — single execution only for MVP
- Token usage prediction — show actual costs only
- Prompt optimization suggestions — creators handle prompt engineering
- RAG/knowledge base integration — different product scope

### Architecture Approach

Integration extends existing x402jobs patterns rather than creating parallel systems. The platform already handles polymorphic resource types (`x402`, `prompt_template`), server-side execution with encrypted keys, JSONB configuration storage, Inngest cron jobs, and workflow orchestration. OpenRouter adds a third resource type using identical patterns.

**Major components:**

1. **user_openrouter_integrations table** — Stores encrypted API keys per user, follows Discord/Telegram integration pattern with RLS policies, one-per-user constraint
2. **x402_resources extensions** — Add `resource_type = 'openrouter_instant'`, `openrouter_config` JSONB (modelId, temperature, maxTokens), foreign key to existing `ai_models` table
3. **executeOpenRouterResource() handler** — New execution path in existing `/api/execute` endpoint, initializes OpenAI SDK with OpenRouter baseURL, handles streaming and multimodal outputs
4. **Model catalog sync (Inngest)** — Daily cron at 3am UTC fetches `/api/v1/models`, upserts to existing `ai_models` table (pattern may already exist as `update-openrouter-models` script)
5. **CreateResourceModal extensions** — Add model selection dropdown, config inputs (temperature, maxTokens), reuse 70% of existing Claude form components
6. **Image output handling** — Upload generated images to existing `x402_cached_images` table, return URLs instead of base64 for consistent caching/CDN patterns

**Anti-patterns to avoid:**

- Separate model table (use existing `ai_models`)
- New execution endpoint (extend existing `/api/execute`)
- Client-side API keys (server-side only, encrypted)
- Storing base64 images in JSONB (use `x402_cached_images`)
- Manual model updates (automated daily sync)

### Critical Pitfalls

1. **API Key Security (CRITICAL)** — User OpenRouter keys stored insecurely expose them to theft. Prevention: Encrypt with per-user keys (not single master), route ALL requests through backend proxy (never client-direct), implement rate limiting per-user-key, add key patterns to .gitignore and pre-commit hooks. Phase 1 priority.

2. **Credit Exhaustion (HIGH)** — When user's OpenRouter credits hit zero, resources fail with 402 errors. Users assume flat-fee x402jobs subscription covers everything. Prevention: Clear 402 error messaging with "add credits" link, onboarding explains separate OpenRouter credit requirement, proactive balance checking if using platform credits (not recommended for flat-fee). Phase 1 priority for error messaging.

3. **Output Format Inconsistency (HIGH)** — Different models return incompatible formats (Claude: `content[0].text`, others: plain string). Prevention: Response normalization layer that standardizes text/image/video/audio outputs, test resources with 3+ diverse models, store media as URLs not base64. Phase 2 priority.

4. **Model Availability (MEDIUM)** — Models deprecate with short notice (e.g., Gemini 2.5 Flash Feb 17, 2026), breaking published resources. Prevention: Validate model exists at creation, store deprecation date if available, implement fallback chains (optional for MVP), daily availability checks. Phase 2 priority.

5. **Rate Limiting (MEDIUM)** — OpenRouter limits are account-level (20 req/min free, dynamic RPS = balance for paid). Prevention: BYOK isolates user limits, retry with exponential backoff for 429 errors, concurrency controls (5 concurrent per user), user education about adding credits = more RPS. Phase 2 priority.

## Implications for Roadmap

Based on research, suggested 6-phase structure following natural dependency order and pitfall prevention:

### Phase 1: Database Foundation (1-2 days)

**Rationale:** Schema changes block all other work. Must establish data model before building integration.
**Delivers:** Migrations for `user_openrouter_integrations` table (encrypted keys, RLS), extensions to `x402_resources` (resource_type enum, openrouter_config JSONB, ai_model_id FK), verification that `ai_models` table exists and syncs.
**Addresses:** API Key Security pitfall (encrypted storage architecture), Credit Exhaustion (data model for tracking).
**Avoids:** Retrofitting security, schema changes after UI built.
**Research flag:** Skip research (standard Postgres patterns, existing codebase examples).

### Phase 2: Model Catalog Sync (1 day)

**Rationale:** UI needs populated catalog before users can select models.
**Delivers:** Inngest function `sync-openrouter-models` (daily cron at 3am), manual trigger endpoint, OpenRouter API integration, upsert logic to `ai_models`.
**Uses:** Native fetch (no SDK needed), Inngest cron pattern (from existing `poll-bazaar-discovery.ts`).
**Addresses:** Model Availability pitfall (authoritative catalog), enables model browsing.
**Avoids:** Building UI with empty/stale data.
**Research flag:** Skip research (Inngest pattern exists, OpenRouter API documented).

### Phase 3: Execution Backend (2-3 days)

**Rationale:** Backend must work before UI can test integration.
**Delivers:** Install `openai` SDK, `executeOpenRouterResource()` handler, integration into `/api/execute` endpoint, StepExecutor workflow support, text/image output handling, stats tracking.
**Uses:** OpenAI SDK with baseURL override, existing encryption pattern, x402_cached_images table.
**Implements:** Server-side execution architecture, response normalization (text-only MVP).
**Addresses:** Output Format Inconsistency (normalization layer), Error Handling (categorization).
**Avoids:** Client-side API calls, plaintext keys.
**Research flag:** Skip research (OpenRouter SDK well-documented, execution patterns exist).

### Phase 4: Settings UI (1-2 days, parallel with Phase 3)

**Rationale:** Users must configure keys before creating resources.
**Delivers:** OpenRouterSettingsCard component, API endpoints (save/fetch/test key), credit display (optional), settings page integration.
**Uses:** Existing Discord/Telegram card pattern, form validation patterns.
**Addresses:** API Key Security (user-friendly configuration), Credit Exhaustion (user education).
**Avoids:** Building resource UI without key configuration.
**Research flag:** Skip research (existing settings patterns clear).

### Phase 5: Resource Creation UI (2 days)

**Rationale:** Users need to create resources after configuring keys.
**Delivers:** ModelSelector component (search, filter, model cards), CreateResourceModal extensions (openrouter_instant type, model dropdown, config inputs), backend POST `/api/resources` updates.
**Uses:** Existing resource creation flow (70% reuse), `ai_models` API endpoint.
**Addresses:** Table stakes features (model selection, configuration), Cost transparency (show model pricing).
**Avoids:** Overwhelming users with 400+ models (curate 20-30).
**Research flag:** Skip research (form patterns exist, model API documented).

### Phase 6: Resource Display & Testing UI (2-3 days)

**Rationale:** Users need to view/test resources after creation.
**Delivers:** ResourceDetailPage extensions (model metadata, config display, capability badges), TryResourceModal enhancements (multimodal inputs optional), execution flow testing, image output display.
**Uses:** Existing resource detail patterns, execution modal patterns.
**Addresses:** Table stakes features (testing, preview), Error Handling (user-friendly messages).
**Avoids:** Shipping without testing capability.
**Research flag:** Skip research (UI patterns straightforward).

### Phase Ordering Rationale

- **Security first:** Phase 1 establishes encrypted storage before any API integration
- **Data before UI:** Phase 2 populates catalog before building model selection UI
- **Backend before frontend:** Phase 3 execution works before building UI to test it
- **Parallel UI work:** Phase 3 (backend) and Phase 4 (settings) can run simultaneously
- **Progressive enhancement:** Phase 5-6 build user-facing features after infrastructure solid
- **Pitfall prevention:** Phases 1-3 address critical pitfalls (security, credits, errors) before user-facing features

**Total estimated time:** 9-13 days (2-3 weeks) with 60% code reuse.

### Research Flags

All phases use standard patterns with existing codebase examples and well-documented APIs:

**Skip research-phase (all phases):**

- **Phase 1:** Standard Postgres migrations, existing integration table examples (`agent_discord_integrations`)
- **Phase 2:** Inngest cron pattern exists (`poll-bazaar-discovery.ts`), OpenRouter API documented
- **Phase 3:** OpenRouter SDK documented, execution pattern matches Claude
- **Phase 4:** Settings UI pattern matches Discord/Telegram cards
- **Phase 5:** Form patterns exist in CreateResourceModal
- **Phase 6:** Resource detail patterns exist, execution modal established

**Defer to implementation phase:**

- Model availability monitoring (actual deprecation patterns need production data)
- Rate limiting thresholds (test with real usage)
- Cost tracking anomaly detection (need baseline usage data)
- Multimodal format edge cases (test with 10+ models in production)

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | OpenRouter officially supports OpenAI SDK, existing codebase has proven patterns                     |
| Features     | HIGH       | Existing Claude templates provide 60-70% reuse, OpenRouter model browser patterns documented         |
| Architecture | HIGH       | All patterns exist in codebase (resource polymorphism, integrations, cron), minimal new abstractions |
| Pitfalls     | HIGH       | Official OpenRouter docs cover errors/limits/security, community sources confirm patterns            |

**Overall confidence:** HIGH

All research backed by official documentation (OpenRouter API, OpenAI SDK) and verified against existing x402jobs codebase patterns. No speculative architecture needed.

### Gaps to Address

Minor gaps requiring validation during implementation (not blockers):

- **Performance benchmarking:** How fast are OpenRouter API calls compared to Claude? Test in Phase 3 execution development to set timeout expectations.
- **Streaming SSE format:** Does OpenAI SDK handle OpenRouter streaming identically to OpenAI? Verify during Phase 3, may need adapter layer.
- **Model-specific quirks:** Which models have output format edge cases? Test 5-10 diverse models (text, vision, cheap, expensive) during Phase 6.
- **Credit balance API:** Can we query user's OpenRouter balance proactively? Check OpenRouter API during Phase 4, may only be reactive via 402 errors.
- **Cost reconciliation timing:** Race condition between payment settlement and OpenRouter charges? Test during Phase 3, may need transaction isolation.

All gaps have fallback strategies and don't block MVP:

- Slow API calls → increase timeouts, add loading states
- Streaming format differences → wrap in adapter, normalize early
- Model quirks → document per-model, normalize aggressively
- No balance API → rely on 402 error messaging, user self-service
- Cost timing issues → optimistic settlement, reconcile async

## Sources

### Primary (HIGH confidence)

**Official OpenRouter documentation:**

- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) - API structure, authentication
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models) - Catalog endpoint, metadata schema
- [OpenRouter Multimodal](https://openrouter.ai/docs/guides/overview/multimodal/overview) - Input/output formats
- [OpenRouter Image Generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) - Base64 response format
- [OpenRouter Rate Limits](https://openrouter.ai/docs/api/reference/limits) - Account tiers, RPS calculation
- [OpenRouter Error Handling](https://openrouter.ai/docs/api/reference/errors-and-debugging) - Status codes, retry strategies
- [OpenRouter Pricing](https://openrouter.ai/pricing) - Pass-through costs, credit model

**Official SDK documentation:**

- [OpenAI SDK npm](https://www.npmjs.com/package/openai) - v6.16.0, stable release
- [OpenRouter with OpenAI SDK](https://openrouter.ai/docs/guides/community/openai-sdk) - BaseURL override pattern

**x402jobs codebase (verified):**

- `/apps/x402-jobs-api/src/routes/execute.ts` - Existing execution flow
- `/supabase/migrations/20250120_create_ai_models_table.sql` - Model catalog schema
- `/supabase/migrations/20251218_add_discord_integration.sql` - Integration table pattern
- `/apps/x402-jobs-api/src/inngest/functions/poll-bazaar-discovery.ts` - Cron pattern
- `/packages/services/src/services/ModelService/ModelService.ts` - Model service

### Secondary (MEDIUM confidence)

**Integration patterns:**

- [x402-OpenRouter Integration Example](https://github.com/ekailabs/x402-openrouter) - Reference implementation
- [OpenRouter Structured Outputs](https://python.useinstructor.com/integrations/openrouter/) - JSON schema support
- [AI Aggregators 2026](https://graygrids.com/blog/ai-aggregators-multiple-models-platform) - Platform patterns

**Security best practices:**

- [Claude API Key Best Practices](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure) - Key storage patterns
- [Strac API Key Security](https://www.strac.io/blog/sharing-and-storing-api-keys-securely) - Encryption strategies

**Cost/pricing analysis:**

- [OpenRouter Pricing Breakdown](https://zenmux.ai/blog/openrouter-api-pricing-2026-full-breakdown-of-rates-tiers-and-usage-costs) - Pass-through model
- [Top AI Models OpenRouter 2026](https://www.teamday.ai/blog/top-ai-models-openrouter-2026) - Cost vs performance

### Tertiary (LOW confidence)

- [18 Predictions for 2026](https://jakobnielsenphd.substack.com/p/2026-predictions) - UX trend (curation over complexity)
- [AI SaaS Pricing Models 2026](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models) - Subscription strategies

---

_Research completed: 2026-01-26_
_Ready for roadmap: YES_
