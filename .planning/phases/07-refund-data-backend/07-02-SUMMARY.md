---
phase: 07-refund-data-backend
plan: 02
subsystem: admin-api
tags: [admin, backfill, supports-refunds, x402]
dependency-graph:
  requires: [07-01]
  provides: [admin backfill endpoint]
  affects: []
tech-stack:
  added: []
  patterns: [admin API key auth, batch processing with rate limiting]
key-files:
  created:
    - src/app/api/admin/backfill-refunds/route.ts
  modified:
    - migrations/004_add_supports_refunds.sql
decisions: []
metrics:
  duration: ~3 minutes
  completed: 2026-01-21
---

# Phase 07 Plan 02: Admin Backfill Endpoint Summary

Admin endpoint to backfill supports_refunds for existing resources via x402 re-verification.

## What Was Done

### Task 1: Admin Backfill Endpoint

Created `src/app/api/admin/backfill-refunds/route.ts` with:

- **Authentication:** Validates `x-admin-key` header against `ADMIN_API_KEY` env variable
- **Batch fetching:** Queries resources via external API with limit/offset pagination
- **Re-verification:** Fetches 402 response from each resource URL
- **Extract supportsRefunds:** Checks `accepts[].extra.supportsRefunds === true`
- **Rate limiting:** 500ms delay between requests to avoid overwhelming endpoints
- **Error handling:** Individual failures don't stop the batch
- **Response:** Returns `{ processed, updated, failed, results, errors }`

```typescript
// Extract pattern
const supportsRefunds =
  verifyData.accepts?.some(
    (accept: { extra?: Record<string, unknown> }) =>
      accept.extra?.supportsRefunds === true,
  ) ?? false;
```

### Task 2: Migration Documentation

Added backfill instructions to `migrations/004_add_supports_refunds.sql`:

- How to call the endpoint
- Pagination guidance for large datasets
- Authentication requirement note

## Commits

| Hash    | Type | Description                            |
| ------- | ---- | -------------------------------------- |
| 4643d74 | feat | add admin backfill-refunds endpoint    |
| 247e620 | docs | add backfill instructions to migration |

## Deviations from Plan

None - plan executed exactly as written.

## Manual Steps Required

1. **Set ADMIN_API_KEY env variable:** Add to `.env` and Vercel environment
2. **Update external backend API:** Must support:
   - `GET /api/v1/resources?needs_refund_backfill=true` (optional filter)
   - `PATCH /api/v1/resources/:id` with `{ supportsRefunds }` body

## Usage Example

```bash
# Backfill first 50 resources
curl -X POST "https://x402.jobs/api/admin/backfill-refunds?limit=50" \
  -H "x-admin-key: your-admin-key"

# Continue with next batch
curl -X POST "https://x402.jobs/api/admin/backfill-refunds?limit=50&offset=50" \
  -H "x-admin-key: your-admin-key"
```

## Verification

- [x] Admin endpoint exists at src/app/api/admin/backfill-refunds/route.ts
- [x] Build passes without errors
- [x] Migration file includes backfill documentation
- [x] Endpoint exports POST handler

## Phase 07 Complete

This completes Phase 07: Refund Data Backend. The full data flow is now:

1. **Registration:** Frontend extracts `supportsRefunds` from x402 response (07-01)
2. **Storage:** Backend API stores in `supports_refunds` column (manual step)
3. **Display:** Badge component shows refund status (06-01)
4. **Backfill:** Admin can update existing resources (07-02)
