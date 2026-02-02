---
phase: 24
plan: 01
subsystem: resource-wizard
tags: [openrouter, model-browser, wizard, ui, config-flow]
dependencies:
  requires:
    - phase: 23
      plan: 01
      why: "Claude path established pattern for AI resource config pages"
    - phase: 22
      plan: 01
      why: "Proxy path required for type-specific config preservation pattern"
    - phase: 21
      plan: 02
      why: "Details page required for config preservation"
    - phase: 19
      plan: 01
      why: "Base wizard infrastructure and ModelBrowser component"
  provides:
    - "OpenRouter resource creation flow (model browser, config, publish)"
    - "Complete fourth resource type path in v2.0 wizard"
    - "Pattern for integrating ModelBrowser into wizard flow"
  affects:
    - phase: 25
      plan: 01
      why: "Cleanup phase will remove old CreateResourceModal which OpenRouter never used"
tech-stack:
  added: []
  patterns:
    - "ModelBrowser integration with wizard draft system"
    - "AI model selection with collapsed summary card UI"
    - "Temperature and max tokens configuration UI"
key-files:
  created: []
  modified:
    - path: "apps/web/src/app/dashboard/resources/new/openrouter/page.tsx"
      lines: 426
      why: "Replaced stub with full OpenRouter config page"
    - path: "apps/web/src/app/dashboard/resources/new/details/page.tsx"
      lines: 1
      why: "Added openrouterConfig preservation in onSubmit"
    - path: "apps/web/src/app/dashboard/resources/new/review/page.tsx"
      lines: 77
      why: "Added OpenRouter config display section"
decisions:
  - what: "Store modelName and provider in draft alongside modelId"
    why: "Review page displays model info without fetching; backend ignores extra fields"
    impact: "Cleaner review display, no additional API calls"
  - what: "Use useAIModelsQuery for model restoration from draft"
    why: "Hook caches models via SWR, efficient to find by ID on return-to-edit"
    impact: "Draft restoration works seamlessly, no duplicate fetches"
  - what: "Collapse selected model to summary card with Change button"
    why: "Matches user expectation pattern from research, saves vertical space"
    impact: "Cleaner UI after selection, clear path to change model"
  - what: "Hide prompt/parameter/config sections until model selected"
    why: "Progressive disclosure, can't configure prompt without knowing model capabilities"
    impact: "Reduced cognitive load, clearer step-by-step flow"
  - what: "Max tokens 1-128,000 for OpenRouter"
    why: "OpenRouter supports large context models, wider range than Claude"
    impact: "Future-proof for upcoming high-context models"
metrics:
  duration: "4 minutes"
  completed: "2026-02-01"
---

# Phase 24 Plan 01: OpenRouter Path Summary

**One-liner:** OpenRouter config wizard with ModelBrowser integration, temperature/max tokens config, and end-to-end publish flow

## What Was Built

Implemented the fourth and final resource type path in the v2.0 wizard redesign. Users can now create OpenRouter-powered AI resources by selecting a model via the existing ModelBrowser component, configuring a system prompt with `{param}{/param}` parameter syntax, defining parameters with descriptions and defaults, and setting temperature and max tokens. The flow includes API key checking with a warning banner, preserves all configuration through the details step, displays full config on review page, and publishes successfully.

**Key components:**

1. **OpenRouter config page (apps/web/src/app/dashboard/resources/new/openrouter/page.tsx):**
   - API key check via useSWR with warning banner linking to /dashboard/integrations
   - ModelBrowser integration for model selection
   - Selected model collapses to summary card with ProviderIcon and Change button
   - System prompt textarea (monospace, 200px height) with character counter
   - Parameter list using useFieldArray (add/remove, name/description/default/required)
   - Temperature slider (0-2, default 1.0) and max tokens input (1-128,000, default 4,096)
   - Continue button gated on API key presence + model selection + form validity
   - Draft restoration for form values and model selection (via useAIModelsQuery)
   - Saves modelName and provider to draft for review page display

2. **Details page preservation (apps/web/src/app/dashboard/resources/new/details/page.tsx):**
   - Added openrouterConfig to preservation block in onSubmit
   - Now preserves all four type-specific configs (link, proxy, claude, openrouter)

3. **Review page display (apps/web/src/app/dashboard/resources/new/review/page.tsx):**
   - Added OpenRouter config display section using IIFE pattern
   - Shows model name with provider (e.g., "GPT-4 Turbo by OpenAI")
   - Displays system prompt in monospace with scroll
   - Lists parameters with {param}{/param} syntax, optional/required badges, descriptions, defaults
   - Shows temperature and max tokens in 2-column grid
   - Verified publish handler passes openrouterConfig via Object.assign (already correct)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 25 (Cleanup) is ready:**
- All four resource type paths complete (link, proxy, claude, openrouter)
- Old CreateResourceModal is fully unused and can be safely removed
- No blockers for cleanup phase

**Post-cleanup readiness:**
- OpenRouter path is end-to-end functional for testing
- Can test: API key check, model selection, prompt config, parameter definition, publish
- Backend already handles OpenRouter resources (from v1.4)

## Files Changed

```
apps/web/src/app/dashboard/resources/new/openrouter/page.tsx  | +396 -7
apps/web/src/app/dashboard/resources/new/details/page.tsx     | +1
apps/web/src/app/dashboard/resources/new/review/page.tsx      | +77
```

**Total:** 3 files changed, 474 insertions(+), 7 deletions(-)

## Commits

| Commit  | Type    | Description                                           |
| ------- | ------- | ----------------------------------------------------- |
| 218f94e | feat    | Build OpenRouter config page with model browser       |
| 3a3eaa3 | feat    | Wire details preservation and review display          |
| 01655ca | chore   | Verify end-to-end build and flow                      |

## Testing Notes

**Manual testing paths:**

1. **Happy path:**
   - Start wizard, select OpenRouter type
   - Select model via ModelBrowser (e.g., GPT-4 Turbo)
   - Verify model collapses to summary card
   - Write system prompt with {param}{/param} syntax
   - Add 2-3 parameters with different required/optional/default combos
   - Set temperature to 0.7, max tokens to 8000
   - Continue to details, fill name/slug/price
   - Review page shows full config correctly
   - Publish succeeds

2. **API key gating:**
   - Without OpenRouter API key, see warning banner with link
   - Continue button disabled until API key configured
   - After adding key in Integrations, can proceed

3. **Draft restoration:**
   - Start OpenRouter resource, select model, write prompt
   - Navigate away (e.g., back to dashboard)
   - Return to wizard, verify model selection and form values restored

4. **Form validation:**
   - Continue disabled when no model selected
   - Continue disabled when system prompt empty
   - Temperature validation (0-2 range)
   - Max tokens validation (1-128,000 range)

**Edge cases:**
- Model browser with large catalog (pagination, search, filter)
- Parameter list with 10+ parameters (scroll behavior)
- Very long system prompt (textarea scroll, character counter accuracy)
- Special characters in parameter names (validation)

## Known Issues

None.

## Decisions Made

1. **Store modelName and provider in draft:** Backend only needs modelId, but review page displays name/provider for better UX without fetching. Backend ignores extra fields harmlessly.

2. **Use useAIModelsQuery for restoration:** Hook caches models via SWR, so finding by ID on return-to-edit is efficient and doesn't duplicate fetches.

3. **Collapse model to summary card:** Matches user expectation (research validated), saves vertical space, clear Change button for modification.

4. **Progressive disclosure:** Hide prompt/parameter/config sections until model selected. Can't meaningfully configure prompt without knowing model capabilities.

5. **Max tokens 1-128,000:** OpenRouter supports large context models with wider range than Claude (1-64,000), future-proofs for upcoming high-context models.

---

**Phase 24 Plan 01 complete.** OpenRouter path is fully functional end-to-end. Ready for Phase 25 cleanup.
