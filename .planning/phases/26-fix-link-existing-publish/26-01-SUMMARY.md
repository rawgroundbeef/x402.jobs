---
phase: 26-fix-link-existing-publish
plan: 01
subsystem: ui
tags: [wizard, link-existing, external-registration, resource-creation]

# Dependency graph
requires:
  - phase: 21-link-existing-path
    provides: Link validation page with x402-verify integration
  - phase: 19-wizard-core
    provides: Wizard shell and review page structure
provides:
  - Link Existing publish routes to POST /resources endpoint
  - Full verification data saved to linkConfig for publish step
  - Instant resource types (proxy, claude, openrouter) continue using POST /resources/instant
affects: [any-future-resource-type, external-endpoint-registration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split publish paths by resource type (link vs instant)"
    - "Link type uses external registration endpoint (POST /resources)"
    - "Instant types use instant creation endpoint (POST /resources/instant)"

key-files:
  created: []
  modified:
    - apps/web/src/app/dashboard/resources/new/link/page.tsx
    - apps/web/src/app/dashboard/resources/new/review/page.tsx

key-decisions:
  - "Link Existing routes to POST /resources (external registration endpoint)"
  - "Save full verification data to linkConfig (payTo, maxAmountRequired, asset, etc.)"
  - "Link type redirects using API-generated slug from response (data.resource.slug)"
  - "Instant types unchanged, continue using POST /resources/instant with draft.slug"

patterns-established:
  - "Type-based routing: draft.type === 'link' determines endpoint and body format"
  - "External resources: backend generates slug, frontend receives in response"
  - "Instant resources: frontend generates slug, backend validates and uses it"

# Metrics
duration: 2min
completed: 2026-02-01
---

# Phase 26 Plan 01: Link Existing Publish Fix Summary

**Link Existing resources now publish successfully to POST /resources endpoint with full verification data, completing the v2.0 wizard E2E flow**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-01T18:35:40Z
- **Completed:** 2026-02-01T18:37:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Link Existing publish routed to correct backend endpoint (POST /resources)
- Full verification data (payTo, maxAmountRequired, asset, mimeType, etc.) saved to linkConfig
- Instant resource types (proxy, claude, openrouter) continue working unchanged
- Link Existing E2E flow complete: enter URL → validate → fill details → review → publish → view

## Task Commits

Each task was committed atomically:

1. **Task 1: Save full verification data to linkConfig** - `a9036d2` (feat)
2. **Task 2: Route Link Existing to POST /resources endpoint** - `93218da` (feat)

## Files Created/Modified
- `apps/web/src/app/dashboard/resources/new/link/page.tsx` - Expanded linkConfig to include payTo, maxAmountRequired, asset, mimeType, maxTimeoutSeconds, outputSchema, isA2A, supportsRefunds, description, avatarUrl
- `apps/web/src/app/dashboard/resources/new/review/page.tsx` - Split handlePublish into two paths: link type uses POST /resources, instant types use POST /resources/instant

## Decisions Made

**1. Link type routes to POST /resources (external registration endpoint)**
- Rationale: Backend rejects "external" as invalid resourceType on /resources/instant. Link Existing represents external resources that already exist, so they use the external registration endpoint.

**2. Save full verification data to linkConfig during validation**
- Rationale: The verify endpoint returns all necessary fields (payTo, maxAmountRequired, etc.) needed by POST /resources. Saving them during validation avoids re-calling the verify API during publish.

**3. Link type redirects using API-generated slug (data.resource.slug)**
- Rationale: POST /resources generates the slug from name+network on the backend. The response contains the generated slug, which we use for redirect.

**4. Instant types unchanged**
- Rationale: Proxy, Claude, and OpenRouter resources work correctly with POST /resources/instant. No changes needed to avoid regression.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four v2.0 wizard resource types now publish successfully
- Link Existing E2E flow complete and tested
- v2.0 milestone complete with all gaps closed
- Ready for production deployment

---
*Phase: 26-fix-link-existing-publish*
*Completed: 2026-02-01*
