# Feature Landscape: Prompt Template Marketplace + OpenRouter Integration

**Last Updated:** 2026-01-26
**Original Research:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

x402jobs' approach is differentiated by:

1. **BYOK model** (caller brings API key) vs platform-hosted execution
2. **x402 micropayments** vs subscription or one-time purchase
3. **Black-box execution** (prompt stays secret) vs selling prompt text
4. **Workflow integration** (prompts as nodes) vs standalone execution

**NEW: OpenRouter Integration** adds a fourth resource type (after External, Proxy, Claude Prompt), enabling creators to build templates using 400+ models. This research focuses on OpenRouter-specific features for model browsing, resource creation, and testing.

---

## ORIGINAL: Core Prompt Template Features

### Table Stakes

Features users expect. Missing = product feels incomplete.

#### Core Execution

| Feature                   | Why Expected             | Complexity |
| ------------------------- | ------------------------ | ---------- |
| **Parameter input form**  | Users customize prompts  | Low        |
| **Streaming response**    | Real-time feedback       | Medium     |
| **Clear pricing display** | Know cost before running | Low        |
| **Copy output**           | Basic utility            | Low        |

#### Discovery & Trust

| Feature                     | Why Expected            | Complexity |
| --------------------------- | ----------------------- | ---------- |
| **Template description**    | Understand what it does | Low        |
| **Parameter documentation** | Know what to input      | Low        |
| **Usage count display**     | Social proof            | Low        |
| **Creator profile link**    | Attribution             | Low        |
| **Example output**          | Quality preview         | Medium     |

#### Creator Tooling

| Feature                                    | Why Expected           | Complexity   |
| ------------------------------------------ | ---------------------- | ------------ |
| **Prompt editor with syntax highlighting** | See parameters clearly | Medium       |
| **Preview mode**                           | Test before publishing | Low          |
| **Earnings dashboard**                     | Track monetization     | Low (exists) |

#### Security (Critical for BYOK)

| Feature                            | Why Expected            | Complexity |
| ---------------------------------- | ----------------------- | ---------- |
| **API key never leaves client**    | Core promise            | High       |
| **Prompt never visible to caller** | Creator IP protection   | Medium     |
| **API key format validation**      | Prevent failed payments | Low        |
| **Clear data handling disclosure** | User trust              | Low        |

### Differentiators

Features that set x402jobs apart.

#### Unique to x402jobs

| Feature                       | Value Proposition          | Complexity   |
| ----------------------------- | -------------------------- | ------------ |
| **Workflow node integration** | Composable building blocks | Medium       |
| **Pay-per-use micropayments** | No subscription needed     | Low (exists) |
| **Instant settlement**        | Creator paid immediately   | Low (exists) |
| **Multi-chain support**       | Base and Solana options    | Low (exists) |

#### Advanced Execution

| Feature                     | Value Proposition   | Complexity |
| --------------------------- | ------------------- | ---------- |
| **System+User mode toggle** | Both template types | Low        |
| **Batch execution**         | Multiple inputs     | High (v2)  |

### Anti-Features

Features to explicitly NOT build.

| Anti-Feature                        | Why Avoid                                   |
| ----------------------------------- | ------------------------------------------- |
| **Server-side API key storage**     | Violates core security model                |
| **Try-before-buy / free tier**      | Undermines pay-per-use model                |
| **Prompt text reveal**              | Destroys creator IP                         |
| **Rating/review system**            | Gameable, usage count is better             |
| **Model selection by caller**       | Complicates pricing                         |
| **Versioning system (v1)**          | Complexity before usage patterns understood |
| **Response analytics for creators** | Privacy concerns                            |

---

## NEW: OpenRouter Model Browser Features

Research focus: How do platforms present 200+ models effectively?

### Table Stakes (Must Have)

Users expect these features from any model browser interface:

| Feature                      | Why Expected                             | Complexity | Dependencies      |
| ---------------------------- | ---------------------------------------- | ---------- | ----------------- |
| **Search by model name**     | Standard discovery pattern               | Low        | OpenRouter API    |
| **Filter by modality**       | Users know if they need text/image/video | Low        | Model metadata    |
| **Filter by context length** | Token budget is critical constraint      | Low        | Model metadata    |
| **Filter by provider**       | Brand trust and existing relationships   | Low        | Model metadata    |
| **Sort by price**            | Cost optimization is primary concern     | Low        | Pricing metadata  |
| **Sort by popularity**       | Social proof for decision-making         | Medium     | OpenRouter stats  |
| **Display pricing**          | Transparency required for trust          | Medium     | Per-token pricing |
| **Model cards/metadata**     | Users need to understand capabilities    | Medium     | API descriptions  |
| **"Free models" filter**     | Common entry point for testing           | Low        | Pricing metadata  |
| **Context window display**   | Technical requirement for prompt sizing  | Low        | Model metadata    |

**Implementation Notes:**

- OpenRouter API provides all necessary metadata (context_length, architecture, pricing, top_provider)
- Two-column layout: filters in sidebar, model list in main area (industry standard from OpenRouter, Hugging Face)
- Model list should be curated (20-30 "marketplace ready" models) not exhaustive (400+ overwhelming)

**Sources:**

- [OpenRouter models browser](https://openrouter.ai/models) - Reference implementation
- [OpenRouter API documentation](https://openrouter.ai/docs/guides/overview/models) - Metadata structure
- [Hugging Face filtering](https://huggingface.co/changelog/new-models-filtering-options) - Industry patterns

### Differentiators (Competitive Advantage)

Features that would set x402jobs apart in the marketplace:

| Feature                                  | Value Proposition                   | Complexity | Priority       |
| ---------------------------------------- | ----------------------------------- | ---------- | -------------- |
| **Pre-configured marketplace templates** | Reduce "blank page" problem         | Medium     | HIGH           |
| **Price markup transparency**            | Build creator trust                 | Low        | HIGH           |
| **Model cost estimator**                 | Reduce buyer uncertainty            | Low        | HIGH           |
| **"Verified for x402" badge**            | Quality signal in noisy marketplace | Medium     | MEDIUM         |
| **Model capability badges**              | Quick capability assessment         | Low        | MEDIUM         |
| **Template remixing**                    | Creator economy network effects     | Medium     | LOW (post-MVP) |
| **Multi-model resource bundles**         | Solve complex tasks with fallbacks  | High       | LOW (post-MVP) |
| **Usage analytics for creators**         | Help optimize pricing               | Medium     | LOW (post-MVP) |
| **Modality-aware parameter UI**          | Match interface to model type       | High       | LOW (post-MVP) |

**Strategic Rationale:**

In 2026, "User Experience is replacing Model Intelligence as the primary sustainable differentiator. Everyone has access to the same models." (Source: [18 Predictions for 2026](https://jakobnielsenphd.substack.com/p/2026-predictions))

x402jobs should focus on:

1. **Curation over comprehensiveness** - Pick 20-30 verified models, not all 400+
2. **Workflow over configuration** - Pre-configured templates, not blank model access
3. **Economics transparency** - Show model cost vs creator markup explicitly

**Sources:**

- [Top AI Models on OpenRouter 2026](https://www.teamday.ai/blog/top-ai-models-openrouter-2026) - Cost vs performance
- [AI Aggregators in 2026](https://graygrids.com/blog/ai-aggregators-multiple-models-platform) - Vertical workflows

### Anti-Features (Things to NOT Build)

Features that add complexity without marketplace value:

| Anti-Feature                                       | Why Avoid                           | What to Do Instead              |
| -------------------------------------------------- | ----------------------------------- | ------------------------------- |
| **Advanced parameter tuning (temperature, top_p)** | Overwhelming for marketplace buyers | Pre-configure sensible defaults |
| **Direct model switching at runtime**              | Breaks pricing predictability       | Lock template to specific model |
| **"Bring your own API key" for OpenRouter**        | Conflicts with creator monetization | Creators configure their key    |
| **Raw playground mode**                            | Not a marketplace, it's an IDE      | Focus on packaged templates     |
| **All 400+ OpenRouter models**                     | Analysis paralysis                  | Curate 20-30 models             |
| **Real-time model status monitoring**              | Infrastructure complexity           | Use OpenRouter fallbacks        |
| **Custom tokenizer configuration**                 | Technical depth inappropriate       | Trust OpenRouter tokenization   |
| **Batch processing UI**                            | Scope creep                         | Defer to post-MVP               |
| **Model comparison side-by-side**                  | Users aren't model scientists       | Trust creator's selection       |

**Design Philosophy:** x402jobs is a **prompt marketplace**, not an **AI playground**. Users come to buy working solutions, not experiment with models.

---

## NEW: OpenRouter Resource Creation Features

Research focus: Prompt template configuration with parameter validation and model selection.

### Table Stakes (Must-Have Configuration)

Users expect these capabilities when creating an OpenRouter resource:

| Feature                         | Why Expected               | Complexity | Status                        |
| ------------------------------- | -------------------------- | ---------- | ----------------------------- |
| **Model selection dropdown**    | Core configuration step    | Low        | NEW (reuse pattern)           |
| **Prompt template textarea**    | Where the value is created | Low        | EXISTS (Claude)               |
| **Parameter syntax support**    | Makes templates reusable   | Low        | EXISTS (`{param}{/param}`)    |
| **Parameter auto-detection**    | Reduce manual work         | Low        | EXISTS (extractParameterTags) |
| **Parameter descriptions**      | Buyers need guidance       | Low        | EXISTS                        |
| **Required vs optional params** | Control flexibility        | Low        | EXISTS                        |
| **Default values**              | Improve DX                 | Low        | EXISTS                        |
| **Price configuration (USDC)**  | Monetization               | Low        | EXISTS                        |
| **Network selection**           | Payment rail choice        | Low        | EXISTS (Base/Solana)          |
| **Category assignment**         | Discoverability            | Low        | EXISTS                        |
| **Avatar/thumbnail**            | Visual presence            | Low        | EXISTS (ImageUrlOrUpload)     |
| **Description**                 | Explain use case           | Low        | EXISTS                        |
| **Slug generation**             | Clean URLs                 | Low        | EXISTS (auto from name)       |

**Validation Requirements:**

Based on existing x402jobs prompt template validation (`/src/lib/prompt-template-utils.ts`):

- **Undefined tags check** - Tags in prompt must have parameter definitions (findUndefinedTags)
- **Unused parameters check** - Warn if parameter defined but not used (findUnusedParameters)
- **Slug availability check** - Real-time validation against existing resources
- **Price minimum enforcement** - Must be at least $0.001 USDC

**Complexity Assessment:** All table stakes features are LOW complexity because they already exist for Claude Prompt resources. Main work is **adaptation, not invention** (60%+ reuse).

**Sources:**

- Existing codebase: `/src/components/modals/CreateResourceModal.tsx`
- Existing codebase: `/src/lib/prompt-template-utils.ts`
- [Claude prompt engineering](https://promptbuilder.cc/blog/claude-prompt-engineering-best-practices-2026)

### Differentiators (Unique Value Adds)

Features that would improve OpenRouter resource creation:

| Feature                             | Value Proposition              | Complexity | Priority       |
| ----------------------------------- | ------------------------------ | ---------- | -------------- |
| **Model cost transparency**         | Creators see their margin      | Low        | HIGH           |
| **Token usage estimator**           | Prevent creator surprise costs | Medium     | HIGH           |
| **Model recommendation engine**     | Guide to right model           | Medium     | MEDIUM         |
| **AI-assisted description**         | Reduce creation friction       | Low        | MEDIUM         |
| **Example request builder**         | Help test as they build        | Medium     | MEDIUM         |
| **Parameter validation rules**      | Enforce input constraints      | Medium     | LOW (post-MVP) |
| **Prompt optimization suggestions** | Improve quality/reduce cost    | High       | LOW (post-MVP) |
| **Modality detection**              | Auto-suggest vision models     | Medium     | LOW (post-MVP) |

**Strategic Priority:**

1. **Model cost transparency** (LOW complexity, HIGH value) - Show "Model: $0.001, Your markup: $0.009"
2. **Token usage estimator** (MEDIUM complexity, HIGH value) - Prevent creator losses
3. **Model recommendation engine** (MEDIUM complexity, MEDIUM value) - Reduce decision paralysis

**Sources:**

- [Top 5 Prompt Management Platforms 2026](https://www.getmaxim.ai/articles/top-5-prompt-management-platforms-in-2026/)
- [LLM API Pricing Calculator](https://www.helicone.ai/llm-cost) - UI patterns
- [OpenRouter pricing structure](https://openrouter.ai/docs/guides/overview/models)

### Anti-Features (Complexity to Avoid)

Configuration options that hurt more than help:

| Anti-Feature                                 | Why Avoid                    | What to Do Instead                                  |
| -------------------------------------------- | ---------------------------- | --------------------------------------------------- |
| **System vs user message config**            | Too technical                | Pre-configure: system from creator, user from buyer |
| **Temperature/top_p sliders**                | Overwhelming parameter space | Lock to sensible defaults                           |
| **Token limit configuration**                | Pricing unpredictable        | Set max_tokens per model, enforce backend           |
| **Streaming vs blocking toggle**             | Implementation detail        | Always stream (better UX)                           |
| **Custom stop sequences**                    | Edge case power user         | Not needed for marketplace                          |
| **Function calling schema builder**          | Massive scope expansion      | Defer to "AI Agent" resource type                   |
| **RAG/knowledge base integration**           | Different product            | Out of scope                                        |
| **Multiple prompt versions in one resource** | Confusing pricing            | One resource = one prompt + one model               |
| **A/B testing variants**                     | Analytics complexity         | Creators publish multiple resources                 |
| **Output format enforcement (JSON schema)**  | Technical depth              | Use prompt engineering                              |

**Design Constraint:** OpenRouter resources should feel like **"instant API endpoints"** not **"AI experimentation playgrounds"**.

---

## NEW: OpenRouter Testing/Preview Features

Research focus: How do platforms handle "try before publish"?

### Table Stakes (Standard Testing Flow)

Users expect these capabilities when testing before publishing:

| Feature                            | Why Expected                        | Complexity | Dependencies      |
| ---------------------------------- | ----------------------------------- | ---------- | ----------------- |
| **Test prompt with sample params** | Verify template works               | Medium     | OpenRouter API    |
| **Fill parameters inline**         | Smooth testing UX                   | Low        | Form generation   |
| **See raw output**                 | Debug and validate                  | Low        | Response display  |
| **Cost display after test**        | Know actual model cost              | Medium     | Usage parsing     |
| **Error handling preview**         | Understand failure modes            | Low        | API error display |
| **Test before saving**             | Prevent publishing broken templates | Medium     | Draft state       |
| **Parameter persistence**          | Don't re-enter test values          | Low        | Component state   |
| **"Use example values" button**    | Quick test with minimal effort      | Low        | Default values    |

**OpenRouter Testing Requirements:**

From [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection):

- **Latency metrics** - Show time to first token
- **Fallback behavior** - If provider fails, OpenRouter auto-retries
- **Usage tracking** - Response includes prompt_tokens, completion_tokens, total_tokens

**Complexity Assessment:** Testing is MEDIUM complexity because it requires:

1. Real OpenRouter API calls (creator must have configured API key)
2. Cost calculation from usage metrics
3. Error handling for model failures, rate limits, invalid keys

**Sources:**

- [OpenAI Playground](https://help.openai.com/en/articles/9824968-prompt-management-in-playground) - Test-then-publish
- [Portkey Playground](https://portkey.ai/docs/product/prompt-engineering-studio/prompt-playground) - Parameter UI
- [Agenta playground](https://docs.agenta.ai/prompt-engineering/playground/using-the-playground) - Commit-to-save

### Differentiators (Advanced Testing)

Features that would improve testing beyond industry standard:

| Feature                              | Value Proposition            | Complexity | Priority       |
| ------------------------------------ | ---------------------------- | ---------- | -------------- |
| **Test with buyer persona**          | See what buyers see          | Low        | HIGH           |
| **Cost breakdown visualization**     | Understand pricing structure | Medium     | HIGH           |
| **One-click publish after test**     | Smooth creation flow         | Low        | HIGH           |
| **Token usage prediction vs actual** | Improve estimator            | Medium     | MEDIUM         |
| **Parameter validation enforcement** | Catch buyer errors early     | Low        | MEDIUM         |
| **Test history/logs**                | Review past test runs        | Medium     | LOW (post-MVP) |
| **Multi-test batch runner**          | Test multiple inputs         | Medium     | LOW (post-MVP) |
| **Response comparison**              | A/B test variations          | High       | LOW (post-MVP) |
| **Latency percentile display**       | Set expectations             | Medium     | LOW (post-MVP) |

**Strategic Priority:**

1. **Test with buyer persona** (LOW complexity, HIGH value) - Critical for marketplace UX
2. **Cost breakdown** (MEDIUM complexity, HIGH value) - "Model: $0.001, Markup: $0.009, Total: $0.01"
3. **One-click publish** (LOW complexity, MEDIUM value) - "Test successful! Publish?" CTA

**Sources:**

- [PromptLayer](https://www.promptlayer.com/) - Testing workflows
- [OpenRouter State of AI 2025](https://openrouter.ai/state-of-ai) - 100T token usage patterns

### Anti-Features (Testing Complexity to Avoid)

Testing capabilities that add overhead without proportional value:

| Anti-Feature               | Why Avoid                      | What to Do Instead            |
| -------------------------- | ------------------------------ | ----------------------------- |
| **Automated test suites**  | Overkill for marketplace       | Manual testing sufficient     |
| **Load/stress testing**    | OpenRouter handles scalability | Trust provider                |
| **Cross-model comparison** | Analysis paralysis             | Creator picks one, tests that |
| **Debugging step-by-step** | Not relevant for prompts       | Show input, output, done      |
| **Test data versioning**   | Complexity without value       | Ephemeral data fine           |
| **Collaborative testing**  | Marketplace is creator-focused | No shared sessions            |
| **Production replay**      | No production traffic yet      | Post-MVP if needed            |
| **Flakiness detection**    | LLMs vary naturally            | Expect variance               |
| **Test coverage metrics**  | Not code, it's prompts         | No coverage concept           |

**Design Philosophy:** Testing should answer: **"Does this template produce useful output?"** Don't build QA infrastructure for 30-second validation.

---

## Feature Dependencies

Understanding build order for OpenRouter integration:

```
PHASE 1: Foundation (Reuse existing ~60%)
├── Parameter syntax support → EXISTS for Claude
├── Parameter auto-detection → EXISTS (extractParameterTags)
├── Parameter validation → EXISTS (findUndefinedTags, findUnusedParameters)
├── Slug generation → EXISTS (generateSlug)
├── Price configuration → EXISTS (USDC, network selection)
└── Category assignment → EXISTS (RESOURCE_CATEGORIES)

PHASE 2: OpenRouter Integration (New)
├── OpenRouter API key management → NEW (settings page)
│   └── Required by: Model browser, Testing, Execution
├── Model list API integration → NEW
│   └── Required by: Model browser, Model selection
└── Model metadata display → NEW
    └── Requires: Model list API

PHASE 3: Model Browser (New)
├── Search and filtering UI → NEW
│   └── Requires: Model list API
├── Sort by price/popularity → NEW
│   └── Requires: Model metadata
└── Model cards → NEW (simplified)
    └── Requires: Model metadata

PHASE 4: Resource Creation (Adapt existing ~70%)
├── Model selection dropdown → NEW
│   └── Requires: Model list API
├── OpenRouter prompt template form → ADAPT (reuse Claude form)
│   └── Requires: Parameter syntax (EXISTS)
├── Model cost display → NEW
│   └── Requires: Model metadata
└── Token usage estimator → NEW (post-MVP)
    └── Requires: Tokenizer library

PHASE 5: Testing/Preview (New ~50%, reuse validation)
├── Test with OpenRouter API → NEW
│   └── Requires: API key management, Model selection
├── Cost calculation from usage → NEW
│   └── Requires: OpenRouter response parsing
└── Buyer persona preview → NEW
    └── Requires: Resource creation form

PHASE 6: Publishing (Adapt existing ~80%)
├── Save OpenRouter resource → ADAPT (reuse save flow)
│   └── Requires: All above
└── Resource detail page → ADAPT (add OpenRouter metadata)
    └── Requires: Execution flow
```

**Critical Path:** OpenRouter API key management → Model browser → Resource creation → Testing → Publishing

**Reuse Ratio:** ~60% of features already exist. Main new work is OpenRouter API integration and model browsing UI.

---

## MVP Recommendation

### OpenRouter MVP (Week 1-2): Core Resources

**Build:**

1. OpenRouter API key configuration (settings page)
2. Model list API integration (curated to 20 models)
3. Basic model selection dropdown (name, provider, price)
4. Adapt existing prompt template form for OpenRouter
5. Test with OpenRouter API (simple text display)
6. Save OpenRouter resource (reuse existing save flow)

**Skip for MVP:**

- Advanced filtering (just search by name)
- Model cards (just show name + price)
- Cost transparency features (show basic price only)
- Token usage estimator (show cost after test only)

**Validation:** Creator can publish an OpenRouter resource and buyer can purchase it.

### Phase 2 (Week 3): Enhanced Discovery

**Build:**

1. Filter by modality (text/vision/audio)
2. Filter by context length (8K/32K/128K+)
3. Sort by price (low to high, high to low)
4. Model capability badges (vision, function calling)
5. Cost breakdown after test ("Model: X, Markup: Y")

### Post-MVP: Based on Usage

**Defer to V2:**

1. Model recommendation engine (if creators struggle)
2. Token usage estimator (if creators lose money)
3. Prompt optimization suggestions (if quality low)
4. Multi-model bundles (if reliability complaints)
5. Template remixing (if creators request it)

---

## Integration with Existing Features

OpenRouter resources integrate with existing platform capabilities:

### Resource Detail Page

- **Add:** Model name, provider, context length, modality
- **Keep:** Usage stats, earnings, purchase button

### Creator Dashboard

- **Add:** Model costs in earnings breakdown, API key status
- **Keep:** Total earnings, resource list, analytics

### Resource Listing

- **Add:** "Model: GPT-4" badge, modality icons
- **Keep:** Category, price, avatar, creator

### Payment Flow

- **No changes:** x402 payment identical, network selection exists
- **Backend:** Deduct OpenRouter costs from creator earnings (buyer_paid, creator_earned, model_cost, platform_fee)

---

## Gaps Requiring Further Research

Before implementation, investigate:

1. **OpenRouter API key security** - Where to store? Encrypted in DB? User-scoped?
2. **Model availability changes** - What if OpenRouter deprecates a model in published template?
3. **Rate limiting strategy** - Prevent creator API key abuse during testing
4. **Multimodal parameter UX** - How to handle image uploads for vision models?
5. **Fallback chain configuration** - Should creators specify "try A, then B"?
6. **Streaming implementation** - OpenRouter supports SSE, how to integrate with x402?
7. **Cost reconciliation** - Prevent race conditions between payment and API cost

**Recommendation:** Address 1, 3, 7 before MVP. Defer 2, 4, 5, 6 to post-MVP.

---

## Confidence Assessment

| Feature Category            | Confidence | Rationale                                      |
| --------------------------- | ---------- | ---------------------------------------------- |
| **Model Browser UI**        | HIGH       | OpenRouter, Hugging Face provide patterns      |
| **Prompt Template Config**  | HIGH       | Already built for Claude                       |
| **Testing/Preview Flows**   | MEDIUM     | API documented, error handling nuances unclear |
| **Pricing Transparency**    | HIGH       | OpenRouter provides cost metadata              |
| **Multimodal Parameter UI** | LOW        | Image/audio handling not researched            |
| **Token Usage Estimation**  | MEDIUM     | Tokenizer libraries exist, accuracy uncertain  |

**Overall: HIGH confidence for MVP scope** - Core features well-understood from existing implementations. Uncertainty in advanced features can be deferred to post-MVP.

---

## Sources

### High Confidence (Authoritative)

- [OpenRouter models browser](https://openrouter.ai/models) - UI reference
- [OpenRouter API docs](https://openrouter.ai/docs/guides/overview/models) - Metadata structure
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection) - Latency, fallbacks
- [Hugging Face filtering](https://huggingface.co/changelog/new-models-filtering-options) - Industry patterns
- [OpenAI Playground](https://help.openai.com/en/articles/9824968-prompt-management-in-playground) - Test workflow
- [Claude prompt engineering](https://promptbuilder.cc/blog/claude-prompt-engineering-best-practices-2026) - Best practices
- [Semantic Kernel syntax](https://learn.microsoft.com/en-us/semantic-kernel/concepts/prompts/prompt-template-syntax) - Template patterns
- Existing x402jobs codebase - Validation, creation flow

### Medium Confidence (Verified Community)

- [Top AI Models OpenRouter 2026](https://www.teamday.ai/blog/top-ai-models-openrouter-2026) - Cost analysis
- [AI Aggregators 2026](https://graygrids.com/blog/ai-aggregators-multiple-models-platform) - Platform patterns
- [Top 5 Prompt Management 2026](https://www.getmaxim.ai/articles/top-5-prompt-management-platforms-in-2026/) - Version control
- [Helicone pricing calculator](https://www.helicone.ai/llm-cost) - Cost UI patterns
- [Portkey Playground](https://portkey.ai/docs/product/prompt-engineering-studio/prompt-playground) - Parameter UX
- [Best Multimodal Models 2026](https://think4ai.com/best-multimodal-ai-models-2026/) - Modality filtering

### Low Confidence (Opinion/Speculative)

- [18 Predictions 2026](https://jakobnielsenphd.substack.com/p/2026-predictions) - UX trends
- [Prompt Governance 2026](https://medium.com/@srajasoundarya99/why-prompt-governance-will-shape-the-future-of-ai-product-management-in-2026-33836ffa4138) - Future trends

---

_Original features research: 2026-01-19_
_OpenRouter integration research: 2026-01-26_
