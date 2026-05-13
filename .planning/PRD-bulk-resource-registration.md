---
type: PRD
title: Bulk resource registration via public API
status: approved
phase: 29
created: 2026-05-13
approved: 2026-05-13
author: ben + claude
context: Side quest surfaced 2026-05-13 — user thought feature existed; it doesn't.
---

# PRD — Bulk Resource Registration

## Problem

The public API exposes `POST /api/v1/resources` for registering a single x402 resource. Marketplaces and platforms whose users create x402 resources (the target audience of the `/developers` page) typically have N resources to register, not one — so they end up making N round trips with N rate-limit slots consumed, each doing an independent x402 metadata fetch + avatar cache + DB write.

**Compounding the gap:** the `/developers` marketing page already pitches at this exact audience —

> *"Running a marketplace? Auto-register your endpoints. **One call** and your resources are discoverable by agents worldwide."*

— but "one call" is per-resource today, which is misleading. The CTA links to `/docs/resources#programmatic-registration`, which only documents the single-item endpoint.

## Goals

1. Let an API caller register up to N resources in one HTTP request.
2. Return per-item results so partial failures are explicit (some created, some updated, some errored).
3. Update the docs and the `/developers` marketing copy to make the bulk path discoverable.
4. Inherit existing safety guarantees automatically: SSRF protection (post-CRIT-07), x402 metadata validation, dedup-by-normalized-URL, ownership checks.

## Non-goals

- **Async / job-based registration.** Sync only for v1 — the response carries concrete results. If customers hit the cap, we'll revisit with an async escape hatch.
- **CSV upload UI.** API-only for this PRD. Dashboard UI for bulk-register is a follow-up.
- **Delete bulk endpoint.** Only create/update bulk. DELETE is rarer and the blast radius is higher; keep it one-at-a-time.
- **Transactional all-or-nothing semantics.** Per-item results, partial success allowed. Customers can retry just the failed items.

## Proposed solution

### New endpoint: `POST /api/v1/resources/bulk`

**Request:**
```json
{
  "resources": [
    {
      "name": "Weather API",
      "resource_url": "https://example.com/api/weather",
      "description": "Real-time weather",
      "category": "data",
      "tags": ["weather", "data"],
      "capabilities": ["query"],
      "network": "solana",
      "pay_to": "...",
      "avatar_url": "https://..."
    }
  ]
}
```

Field shape identical to the single endpoint per item (`name`, `resource_url` required; everything else optional and falls back to x402 metadata from the URL).

**Response (HTTP 200, even on partial failure):**
```json
{
  "summary": {
    "total": 3,
    "created": 1,
    "updated": 1,
    "skipped": 0,
    "errored": 1
  },
  "results": [
    {
      "index": 0,
      "status": "created",
      "resource": { "id": "...", "slug": "...", "name": "..." }
    },
    {
      "index": 1,
      "status": "updated",
      "resource": { "id": "...", "slug": "...", "name": "..." }
    },
    {
      "index": 2,
      "status": "error",
      "error": "Invalid x402 resource",
      "message": "resource_url did not return 402: 200"
    }
  ]
}
```

Statuses: `created`, `updated` (existing resource matched by normalized URL + caller owns it), `skipped` (matched but caller doesn't own it), `error` (validation or fetch failure).

**HTTP status codes:**
- `200` — request was structurally valid; check per-item `results`.
- `400` — request body itself malformed (`resources` not an array, empty, or > size cap).
- `401` — missing/invalid API key (existing middleware).
- `429` — bulk rate limit exceeded (separate bucket — see below).
- `500` — unexpected (DB connection, etc.).

### Limits

| Parameter | Value | Rationale |
|---|---|---|
| Max items per request | **25** | Each item ≈ 1-3s of work (x402 fetch + avatar cache + DB). 25 × concurrency 5 ≈ 15s wall clock — comfortably under Railway/proxy 60s default. |
| In-flight concurrency per request | **5** | Balance throughput vs. memory + outbound socket pressure. |
| Bulk rate limit per API key | **6 requests/min** (= 150 resources/min) | Separate bucket from the single endpoint so one customer can't starve the worker pool. |

### Code shape

New file `src/routes/public-api.ts` gets a second handler that:
1. Validates the array (size, shape).
2. Spawns a `Promise.all` with a `p-limit`-style concurrency wrapper around the same per-item logic the single endpoint runs today. Refactor the per-item body into an internal function (`registerOneResource(input, apiKeyUser)`) so single and bulk share it.
3. Catches per-item errors → maps to `{ status: "error", error, message }` instead of throwing.
4. Returns the aggregated response.

**Refactor scope:** the existing `POST /resources` route at `public-api.ts:142-~600` should be extracted into a shared function that returns a normalized result object (the single endpoint then unwraps that for its own response shape). This is a non-trivial but isolated refactor that's required to keep behavior consistent.

### Auth & ownership

- Existing `apiKey` middleware applies — same key, same `created_by` user.
- For each item: ownership check matches the single endpoint. If the resource already exists and the API key's user doesn't own it, return `{ status: "skipped", error: "not_owner" }` instead of erroring.

### SSRF (correction surfaced during planning, 2026-05-13)

**The original PRD claimed `fetchX402Metadata` already calls `safeFetch` post CRIT-07. That is incorrect.** Verification during the planning pass showed PR #29 only added `safeFetch` to `routes/instant.ts`, `routes/images.ts`, and `routes/upload.ts`. The public API's `fetchX402Metadata` in `src/routes/public-api.ts` still uses raw `fetch`, so the single `POST /resources` endpoint is silently SSRF-vulnerable on the user-supplied `resource_url` today — and bulk would be a 25x amplifier.

**Scope adjustment:** Phase 29 migrates `fetchX402Metadata` to `safeFetch` as part of the per-item refactor. This closes the pre-existing single-endpoint hole as a side-effect; the PR description should call it out. Threat model gains: prevents SSRF amplification (the original concern) AND remediates a latent issue on the existing endpoint.

Test fixture must include at least one item with a `127.0.0.1` URL to confirm the per-item error path returns `{ status: "error", error: "URL not allowed" }` rather than failing the whole batch. Mock strategy: `vi.mock("dns", ...)` returning a public IP for whitelisted fixture hostnames while keeping the SSRF guard active for `127.0.0.1` lookups.

## Docs & marketing changes

### `/docs/resources` page

Add a new section under the existing `#programmatic-registration` anchor:

- **Heading:** "Bulk registration"
- **Code example:** `POST /api/v1/resources/bulk` with a 3-item payload
- **Response example** showing one `created`, one `updated`, one `error`
- **Limits table** (max 25 items, concurrency, rate limit)
- **When to use:** "Marketplaces and platforms with many endpoints to register at once."

### `/developers` marketing page

Two tweaks to the "Running a marketplace?" section (lines 302-310 in `apps/web/src/app/developers/page.tsx`):

1. Adjust the copy from "One call and your resources are discoverable" to something accurate but still concise — e.g., "Register up to 25 resources in a single API call."
2. Add a third button or sub-line: a small code snippet showing the array form (the existing snippet shows the single-call form on the hero).

Optional bonus: swap the existing single-call snippet on the hero for a side-by-side single/bulk tabbed code example.

### Homepage `DiscoverSection` (added 2026-05-13)

The homepage embeds a marketing block at `apps/web/src/components/DiscoverSection/DiscoverSection.tsx` titled **"x402 Registry API"** with the tagline *"Register yours. Find others. One API."* and a `Get API Access` CTA pointing to `/developers`.

Add a short bulk hint as a secondary line beneath the existing tagline — e.g., *"Up to 25 endpoints in one call."* Keep the change small and tonally consistent with the existing copy; do not restructure the section. The goal is parity with the `/developers` page so a visitor landing on the home page (the higher-traffic surface) sees the bulk affordance immediately.

## Locked decisions (confirmed 2026-05-13)

1. **Cap size: 25 items per request.** Timeout math: 25 × concurrency 5 × ~3s ≈ 15s wall clock — comfortably under Railway's 60s default. Revisit only if real usage demands it.
2. **Ownership conflicts return `status: "skipped"` with `error: "not_owner"` inline.** Lets "register everything I have, ignore conflicts" be a single call. Overall request still returns 200 with per-item statuses.
3. **Separate rate-limit bucket: 6 bulk req/min, distinct from the single endpoint's existing limit.** Orthogonal pools; one customer can't starve the other.
4. **Sync-only for v1, defer async.** Single round-trip, returns when all items processed. Async/job-based escape hatch deferred until real customer demand surfaces.

## Out-of-scope follow-ups

- **Avatar caching concurrency.** Currently sequential per-item. Inside `registerOneResource`, the avatar cache fetch and the x402 metadata fetch could parallelize. Not v1 scope.

## Out of scope (explicitly)

- Async bulk via job queue.
- Bulk update/PUT (caller can still hit `PUT /resources/:id` individually).
- Bulk delete.
- CSV / dashboard UI for bulk register.
- Streaming response (NDJSON / SSE) — sync flat-JSON for v1.

## Estimated effort

- **API endpoint + refactor + tests:** 1 PR in `x402jobs-api`, ~1 day. Includes the per-item refactor (the bulk handler is small once the refactor lands; the refactor itself is the real work).
- **Docs + marketing tweaks:** 1 PR in `x402jobs`, ~half a day.
- **Total:** ~1.5 days of focused work.

## Risk

- **Refactor risk on the single endpoint.** Extracting the per-item logic touches a route with existing tests. Mitigation: don't change the single endpoint's external behavior; have the refactor pass the existing test suite unchanged before adding the bulk handler.
- **Timeout risk if 25 turns out to be too high in production.** Mitigation: log per-item wall time + total wall time on every bulk call for the first week post-launch; tune cap if p95 wall time approaches 30s.
- **Customer surprise** if `status: "skipped"` (ownership conflict) is mistaken for `status: "created"`. Mitigation: docs make the `summary` field prominent so customers see counts at a glance.

## Open questions

- Should we emit per-item webhook/Inngest events for downstream indexing, the same way the single endpoint does today? Likely yes, but verify the single endpoint actually does — if it just relies on DB triggers, bulk inherits automatically.
- Should bulk responses include the same `existing_resource` warning the single endpoint emits when a URL matches but the body fields differ? Probably yes, surfaced as a `warning` field per item.

## Next steps if approved

1. Sanity-check the refactor scope by re-reading `public-api.ts:142-~600` end-to-end — confirm no hidden coupling that complicates extraction.
2. Spec out the exact internal `registerOneResource(input, apiKeyUser)` signature.
3. Open `/gsd-discuss-phase` or skip straight to plan if the contract above is enough.
4. Implement on a feature branch off `main` (after CRIT-07 merges).
