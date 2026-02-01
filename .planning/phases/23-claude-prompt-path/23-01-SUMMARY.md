---
phase: 23-claude-prompt-path
plan: 01
subsystem: ui
tags: [react, claude, wizard, react-hook-form, zod, swr]

# Dependency graph
requires:
  - phase: 20-details-review
    provides: Shared details and review pages for all resource types
  - phase: 22-proxy-path
    provides: Proxy path pattern showing type-specific config preservation
provides:
  - Claude prompt template config page with API key check and warning banner
  - System prompt textarea with parameter syntax helper and character counter
  - Dynamic parameter editor with useFieldArray (name, description, default, required)
  - Max tokens input (1-64,000 range)
  - Claude config preservation through details page
  - Claude config display on review page
affects: [24-openrouter-path, future-prompt-template-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "API key check pattern with useSWR for integration status"
    - "Warning banner with conditional rendering (!isLoadingConfig && !hasApiKey)"
    - "useFieldArray for dynamic parameter management with field.id keys"
    - "Type-specific config display in review page using IIFE pattern"

key-files:
  created: []
  modified:
    - apps/web/src/app/dashboard/resources/new/claude/page.tsx
    - apps/web/src/app/dashboard/resources/new/details/page.tsx
    - apps/web/src/app/dashboard/resources/new/review/page.tsx

key-decisions:
  - "Link to /dashboard/integrations (not /dashboard/settings/integrations) in warning banner"
  - "Max tokens range 1-64,000 (vs backend's 1-8,192) to support future Claude models"
  - "Use field.id as key for parameter list items (not array index) for proper React tracking"
  - "Continue button gated on both hasApiKey AND form.isValid"
  - "Warning banner only shows when !isLoadingConfig && !hasApiKey to prevent flash"

patterns-established:
  - "Pattern: API key check with useSWR('/integrations/claude/config', authenticatedFetcher)"
  - "Pattern: Alert variant='warning' with AlertCircle icon and Link to integrations"
  - "Pattern: Preserve type-specific config in details onSubmit with spread operator"
  - "Pattern: Display type-specific config in review page with IIFE and type assertion"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 23 Plan 01: Claude Prompt Path Summary

**Working Claude prompt template wizard with API key checking, system prompt editor, dynamic parameters, and end-to-end draft persistence**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T15:58:54Z
- **Completed:** 2026-02-01T16:02:05Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Users can now configure Claude prompt templates with full validation and API key checking
- System prompt textarea with `{param}{/param}` syntax helper and character counter
- Dynamic parameter management with add/remove, name/description/default/required fields
- Claude config persists through details and displays on review page
- Full end-to-end Claude resource creation flow functional

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Claude prompt config page** - `42503e1` (feat)
   - Replaced stub with working form
   - API key check with warning banner
   - System prompt textarea, useFieldArray parameters, max tokens input
   - Draft restoration on page load

2. **Task 2: Wire details preservation and review display** - `9dbb83f` (feat)
   - Added claudeConfig preservation in details onSubmit
   - Added Claude config display block in review page
   - System prompt preview, parameter list, max tokens display

3. **Task 3: Verify end-to-end build and flow** - `1dd1556` (chore)
   - Full project builds cleanly
   - No TypeScript or lint errors
   - Verified no regressions to link/proxy paths

**Plan metadata:** (will be committed next)

## Files Created/Modified

- `apps/web/src/app/dashboard/resources/new/claude/page.tsx` - Full Claude config form with API key check, system prompt textarea, useFieldArray parameters, max tokens input, and Continue button gating
- `apps/web/src/app/dashboard/resources/new/details/page.tsx` - Added claudeConfig preservation in onSubmit
- `apps/web/src/app/dashboard/resources/new/review/page.tsx` - Added Claude config display block with system prompt preview, parameter list, and max tokens

## Decisions Made

**Max tokens range 1-64,000 vs backend 1-8,192:**
- Used wider range to future-proof for Claude models with larger context windows
- Backend validation will enforce actual limits per model

**Link target /dashboard/integrations:**
- Confirmed correct path (not /dashboard/settings/integrations)
- Matches Phase 02 integrations page location

**Warning banner conditional rendering:**
- Only show when `!isLoadingConfig && !hasApiKey`
- Prevents flash of warning during initial load

**Continue button gating:**
- `canContinue = hasApiKey && isValid`
- Double-gated to enforce both API key presence and form validity

**Parameter list key:**
- Use `field.id` from useFieldArray (not array index)
- Prevents React key errors when reordering/removing parameters

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations worked as specified.

## User Setup Required

None - no external service configuration required. Users must add Claude API key via Dashboard > Integrations (already implemented in Phase 02).

## Next Phase Readiness

- Claude prompt path complete and functional end-to-end
- Ready for Phase 24: OpenRouter Path (final resource type)
- Pattern established for API key checking can be reused in OpenRouter implementation
- Review page IIFE pattern can be followed for OpenRouter config display

---
*Phase: 23-claude-prompt-path*
*Completed: 2026-02-01*
