---
phase: 16-execution-backend
plan: 01
subsystem: api
tags: [openrouter, openai-sdk, instant-resources, llm-execution]

# Dependency graph
requires:
  - phase: 11-database-foundation
    provides: openrouter_model_id and openrouter_config fields on x402_resources
  - phase: 12-model-catalog-sync
    provides: ai_models table with OpenRouter model catalog
provides:
  - Server-side execution of openrouter_instant resources via OpenRouter API
  - OpenAI SDK integration with OpenRouter baseURL override
  - Payment-gated OpenRouter API calls with creator API key decryption
  - Usage logging to x402_prompt_template_usage_logs
  - Generic error handling ("Resource unavailable" for all failures)
affects: [17-resource-discovery, 18-end-to-end-testing]

# Tech tracking
tech-stack:
  added: [openai@6.16.0]
  patterns:
    - OpenAI SDK with baseURL override for OpenRouter compatibility
    - LRO pattern (no streaming) for OpenRouter instant resources
    - Reuse prompt_template validation and logging infrastructure

key-files:
  created: []
  modified:
    - apps/x402-jobs-api/package.json
    - apps/x402-jobs-api/src/routes/instant.ts

key-decisions:
  - "No streaming for OpenRouter instant resources (LRO pattern) per CONTEXT.md"
  - "Generic 'Resource unavailable' error for all OpenRouter failures (security)"
  - "Reuse prompt_template parameter validation and usage logging"
  - "Look up model name from ai_models table (OpenRouter uses 'openai/gpt-4o' format)"

patterns-established:
  - "OpenRouter integration via OpenAI SDK with baseURL: 'https://openrouter.ai/api/v1'"
  - "HTTP-Referer and X-Title headers for OpenRouter attribution"
  - "Owner test mode bypass for openrouter_instant resources"
  - "executeOpenRouterInstant follows executePromptTemplate patterns"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 16 Plan 01: OpenRouter Instant Executor Summary

**Server-side OpenRouter execution with payment gating, API key decryption, and usage logging via OpenAI SDK**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T23:29:31Z
- **Completed:** 2026-01-27T23:32:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added openai package and executeOpenRouterInstant function with parameter substitution
- Wired openrouter_instant into route handler with payment flow and owner test mode
- Implemented usage logging and generic error handling per security requirements
- Extended InstantResource interface with openrouter_model_id and openrouter_config fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Install openai package and add OpenRouter executor function** - `fefbd72d` (feat)
2. **Task 2: Wire openrouter_instant into route handler** - `6549a0dd` (feat)

## Files Created/Modified
- `apps/x402-jobs-api/package.json` - Added openai@6.16.0 dependency
- `apps/x402-jobs-api/src/routes/instant.ts` - Added executeOpenRouterInstant function, extended InstantResource interface, added openrouter_instant handling to build402Response, owner test mode, and switch statement

## Decisions Made
- No streaming for OpenRouter (LRO pattern) per CONTEXT.md - simpler client integration, avoids SSE complexity
- Generic "Resource unavailable" error for all failures - security-first approach, don't expose API key/credit issues to callers
- Reuse prompt_template validation and logging infrastructure - consistency across instant resource types
- Look up model name from ai_models table - OpenRouter uses provider/model format (e.g., "openai/gpt-4o")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed existing prompt_template patterns closely.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 17 (Resource Discovery):
- OpenRouter instant resources can be executed via instant.ts
- Payment gating, usage logging, and error handling in place
- Creator API key decryption working
- Owner test mode allows testing without payment

No blockers. Phase 17 can add resource discovery UI showing openrouter_instant resources in catalog.

---
*Phase: 16-execution-backend*
*Completed: 2026-01-27*
