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

### Active

- [ ] Full-page wizard at `/resources/new` replaces all creation modals
- [ ] 4-step flow: Choose Type → Configure Source → Resource Details → Review & Publish
- [ ] Link Existing path: x402check validation with full-width results
- [ ] Proxy path: Wrap non-x402 URL with x402 payments
- [ ] Claude Prompt path: System prompt, parameters, API key check
- [ ] OpenRouter path: Model browser, prompt template, parameter config
- [ ] Shared details step: name, slug, description, image, category, price, network
- [ ] Review & publish step with edit links back to relevant steps
- [ ] URL-based routing with session storage state persistence
- [ ] x402check components imported for validation UI
- [ ] Old CreateResourceModal removed after wizard ships
- [ ] Mobile-responsive layout (full-page stacks naturally)

## Current Milestone: v2.0 Resource Registration Redesign

**Goal:** Redesign the resource registration/creation flow from cramped modals to a full-page wizard at `/resources/new`. Consolidate 4 separate creation flows into one unified wizard with shared steps for resource details and review.

**Target features:**

- Full-page wizard at `/resources/new` with URL-based routing per step
- Type selector: Link Existing, Proxy, Claude Prompt, OpenRouter
- Link Existing: x402check validation with full-width results, parsed config display
- Proxy: Origin URL, HTTP method, optional headers for non-x402 URL wrapping
- Claude Prompt: System prompt editor, model selection, max tokens config
- OpenRouter: Model browser with search/filters, prompt template, parameters
- Shared resource details: name, URL slug, description, image, category, price, network
- Review & publish with inline edit links and validation summary
- Session storage + URL params hybrid for state management
- Import x402check validation components directly from package
- Remove old CreateResourceModal entirely

### Out of Scope

- Save draft functionality — defer to later
- Bulk import via API — future feature
- Edit existing resource via wizard — defer, separate concern
- Template versioning — new resource = new version
- Response analytics for creators — privacy concerns
- Try-before-buy / free tier — x402 model is pay-per-use

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
| Full-page wizard over modals | Room for validation, mobile-friendly, URL routing | — Pending |
| 4-step wizard flow           | Progressive disclosure reduces overwhelm          | — Pending |
| Session storage + URL hybrid | Clean URLs, survives refresh, not shareable       | — Pending |
| Import x402check components  | Reuse validated components, don't rebuild         | — Pending |
| Remove old modal immediately | No migration period, clean break                  | — Pending |

---

_Last updated: 2026-01-30 after v2.0 milestone start_
