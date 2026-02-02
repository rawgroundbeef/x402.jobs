---
phase: 13
plan: 01
subsystem: integrations
tags: [openrouter, api-key, settings, encryption, crud]
dependency_graph:
  requires: [11-01]
  provides:
    [
      openrouter-config-endpoints,
      openrouter-card-ui,
      getCreatorOpenRouterApiKey,
    ]
  affects: [16-execution]
tech_stack:
  added: []
  patterns: [integration-card, encrypted-secrets, delete-confirmation-dialog]
key_files:
  created:
    - apps/x402-jobs/src/components/pages/AccountIntegrationsPage/components/OpenRouterCard.tsx
  modified:
    - apps/x402-jobs-api/src/routes/integrations.ts
    - apps/x402-jobs/src/components/pages/AccountIntegrationsPage/AccountIntegrationsPage.tsx
decisions:
  - id: openrouter-icon-network
    choice: Network icon from lucide-react with indigo color
    rationale: Represents routing/connectivity, distinct from Claude's coral Sparkles
metrics:
  duration: 3 minutes
  completed: 2026-01-26
---

# Phase 13 Plan 01: OpenRouter API Key Integration UI Summary

OpenRouter integration card with full CRUD for Settings -> Integrations, following Claude integration pattern.

## What Was Built

### Backend (integrations.ts)

1. **GET /integrations/openrouter/config** - Returns `{ hasApiKey, isEnabled }` without exposing key
2. **PUT /integrations/openrouter/config** - Encrypts API key with `encryptSecret()` and upserts to database
3. **DELETE /integrations/openrouter/config** - Removes integration, returns affected resource count
4. **GET /integrations/openrouter/affected-resources** - Returns count of `openrouter_instant` resources
5. **getCreatorOpenRouterApiKey()** - Exported function for Phase 16 execution to retrieve decrypted key

### Frontend (OpenRouterCard.tsx)

- 262-line component following ClaudeCard pattern
- Network icon in indigo (#6366F1) for brand distinction
- Collapsed state: shows status, Configure/Update button, Delete Integration button (when configured)
- Expanded state: API key input with password masking, helper text, Cancel/Save buttons
- Delete flow: fetches affected count -> shows confirmation dialog -> executes DELETE -> mutates SWR cache
- Link to openrouter.ai/keys for key retrieval

### Integration (AccountIntegrationsPage.tsx)

- OpenRouterCard added between ClaudeCard and TelegramCard
- AI providers grouped together before social integrations

## Commits

| Hash     | Message                                                       |
| -------- | ------------------------------------------------------------- |
| 92448e28 | feat(13-01): add OpenRouter backend routes to integrations.ts |
| b01461be | feat(13-01): create OpenRouterCard component                  |
| 08faff6f | feat(13-01): add OpenRouterCard to AccountIntegrationsPage    |

## Key Files

**Created:**

- `apps/x402-jobs/src/components/pages/AccountIntegrationsPage/components/OpenRouterCard.tsx` (262 lines)

**Modified:**

- `apps/x402-jobs-api/src/routes/integrations.ts` (+192 lines)
- `apps/x402-jobs/src/components/pages/AccountIntegrationsPage/AccountIntegrationsPage.tsx` (+2 lines)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision                          | Rationale                                                                 |
| --------------------------------- | ------------------------------------------------------------------------- |
| Network icon with #6366F1         | Represents routing/connectivity; indigo distinguishes from Claude's coral |
| sk-or-v1-... placeholder          | Matches OpenRouter API key format                                         |
| Delete button only when hasApiKey | Prevents unnecessary delete prompt for unconfigured state                 |

## Verification Completed

- [x] TypeScript compiles without errors (both API and frontend)
- [x] All 4 OpenRouter endpoints exist in integrations.ts
- [x] getCreatorOpenRouterApiKey function exported
- [x] Delete flow wired: handleDeleteClick -> fetch count -> dialog -> handleConfirmedDelete -> DELETE -> mutate
- [x] OpenRouterCard has 262 lines (exceeds 150 min requirement)
- [x] Build succeeds

## Next Phase Readiness

**Ready for Phase 14:** Model Selection UI - no blockers identified.

**Dependencies satisfied:**

- Database schema ready (migration 005)
- Backend endpoints for API key management complete
- getCreatorOpenRouterApiKey() exported for execution phase
