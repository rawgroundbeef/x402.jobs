---
phase: 25-cleanup-and-migration
plan: 01
subsystem: ui
tags: [react, next.js, modal-cleanup, refactoring]

# Dependency graph
requires:
  - phase: 19-wizard-foundation
    provides: Full-page wizard at /dashboard/resources/new
  - phase: 20-link-path
    provides: Link resource type implementation
  - phase: 21-proxy-path
    provides: Proxy resource type implementation
  - phase: 22-claude-path
    provides: Claude prompt template implementation
  - phase: 24-openrouter-path
    provides: OpenRouter instant resource implementation
provides:
  - Clean codebase with old modals removed
  - ResourceEditModal as sole edit interface for basic fields
  - Simplified ModalContext with no register resource state
affects: [future-edit-flow, modal-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [resource-edit-modal-pattern]

key-files:
  created: []
  modified:
    - apps/web/src/app/dashboard/resources/page.tsx
    - apps/web/src/components/GlobalModals.tsx
    - apps/web/src/contexts/ModalContext.tsx
  deleted:
    - apps/web/src/components/modals/CreateResourceModal.tsx
    - apps/web/src/components/modals/RegisterResourceModal.tsx

key-decisions:
  - "Use ResourceEditModal for basic field editing (name, slug, description, avatar)"
  - "Accept temporary limitation: complex field editing unavailable until EDIT-01/EDIT-02"

patterns-established:
  - "Resource editing uses lightweight ResourceEditModal for basic metadata changes"
  - "Creation uses full-page wizard at /dashboard/resources/new"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 25 Plan 01: Cleanup and Migration Summary

**Removed 3,646 lines of dead code by deleting CreateResourceModal and RegisterResourceModal, switching dashboard edit to ResourceEditModal**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T00:37:07Z
- **Completed:** 2026-02-01T00:40:06Z
- **Tasks:** 2
- **Files modified:** 3
- **Files deleted:** 2

## Accomplishments
- Removed CreateResourceModal (3,024 lines, 117KB) and RegisterResourceModal (622 lines, 23KB)
- Cleaned up ModalContext by removing register resource state and callbacks
- Switched dashboard edit flow to ResourceEditModal for basic field editing
- Verified zero remaining references to old modals in codebase

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch dashboard edit to ResourceEditModal and remove CreateResourceModal imports** - `df3db1c` (refactor)
2. **Task 2: Delete old modal files and verify clean codebase** - `5d5a15c` (chore)

## Files Created/Modified

**Modified:**
- `apps/web/src/app/dashboard/resources/page.tsx` - Replaced CreateResourceModal with ResourceEditModal for edit flow
- `apps/web/src/components/GlobalModals.tsx` - Removed CreateResourceModal import and render
- `apps/web/src/contexts/ModalContext.tsx` - Removed register resource state, callbacks, and interface members

**Deleted:**
- `apps/web/src/components/modals/CreateResourceModal.tsx` - Old creation/edit modal (3,024 lines)
- `apps/web/src/components/modals/RegisterResourceModal.tsx` - Dead code, no imports (622 lines)

## Decisions Made

**Use ResourceEditModal for basic editing**
- ResourceEditModal handles: name, slug, description, avatar_url
- Does not handle: resource type changes, proxy config, prompt templates, model selection
- Rationale: Simple modal sufficient for basic metadata edits. Complex edits deferred to EDIT-01/EDIT-02 (wizard-based edit flow)

**Clean break, no migration period**
- Deleted modals immediately after switching edit flow
- No backwards compatibility, no dual-implementation period
- Rationale: Wizard proven complete in Phases 19-24, no reason to maintain old code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward cleanup with no unexpected dependencies.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**v2.0 Resource Registration Redesign complete:**
- Creation flow: Full-page wizard (Phases 19-24)
- Edit flow: ResourceEditModal for basic fields
- Old modal code: Removed (Phase 25)

**Known limitation:**
- Complex resource edits (proxy headers, prompt templates, model selection) temporarily unavailable
- EDIT-01/EDIT-02 requirements deferred to future work
- Users can edit basic metadata but cannot reconfigure resource-specific fields

**Recommendation for future work:**
- Implement wizard-based edit flow similar to creation flow
- Allow editing all resource configuration, not just metadata
- See .planning/REQUIREMENTS.md EDIT-01 and EDIT-02

---
*Phase: 25-cleanup-and-migration*
*Completed: 2026-02-01*
