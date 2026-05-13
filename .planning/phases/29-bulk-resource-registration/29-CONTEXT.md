# Phase 29: Bulk Resource Registration — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/PRD-bulk-resource-registration.md`)
**Milestone:** v3.0 (side quest, slotted between Phase 28 Criticals and Phase 28 Highs)

<domain>
## Phase Boundary

Ship `POST /api/v1/resources/bulk` on the public API so a single HTTP request can register up to 25 x402 resources, plus update the docs and marketing pages to describe the bulk affordance.

**In scope:**
- API: new bulk endpoint + extraction of per-item single-endpoint logic into a shared internal function
- API: per-item statuses (`created` | `updated` | `skipped` | `error`), bulk-specific rate-limit bucket, SSRF protection inherited from `safeFetch`
- API tests: existing single-endpoint suite must pass unchanged after refactor; new bulk integration tests for partial-success and SSRF inheritance
- Docs: `/docs/resources` page adds a "Bulk registration" section under the `#programmatic-registration` anchor
- Marketing: `/developers` page "Running a marketplace?" section copy + code snippet tweak
- Marketing: homepage `DiscoverSection` adds a small bulk-affordance line under the existing tagline

**Out of scope (deferred):**
- Async / job-based bulk registration
- CSV upload UI or dashboard UI for bulk register
- Bulk update/PUT or bulk delete
- Streaming response (NDJSON / SSE)
- Transactional all-or-nothing semantics

</domain>

<decisions>
## Implementation Decisions (locked 2026-05-13)

### Endpoint contract

- **Path:** `POST /api/v1/resources/bulk`
- **Auth:** Existing `apiKey` middleware; same `created_by` user resolution as single endpoint.
- **Request body:** `{ "resources": [ ...items ] }`. Each item shape identical to `POST /resources`: `name` and `resource_url` required, everything else optional (and falls back to x402 metadata fetched from the URL).
- **Response:** Always HTTP 200 on structurally valid requests. Body: `{ summary: { total, created, updated, skipped, errored }, results: [ { index, status, resource?, error?, message? }, ... ] }`.
- **Top-level HTTP codes:** 200 (structurally valid), 400 (`resources` missing/non-array/empty/over cap), 401 (auth), 429 (rate limit), 500 (unexpected).

### Per-item statuses

- `created` — new resource inserted.
- `updated` — existing resource matched by normalized URL AND caller owns it; metadata refreshed.
- `skipped` — existing resource matched by normalized URL BUT caller does NOT own it. Returns `error: "not_owner"` inline. Per-user-confirmed default 2026-05-13: lets "register everything I have, ignore conflicts" be a single call.
- `error` — validation failure, x402 fetch failure, SSRF block, etc. Returns `error` code + `message` string.

### Limits

- **Max items per request:** 25. Confirmed 2026-05-13. Timeout math: 25 × concurrency 5 × ~3s ≈ 15s wall clock, well under Railway's 60s default.
- **In-flight concurrency per request:** 5 (p-limit-style wrapper).
- **Bulk rate limit:** 6 requests/min per API key. Confirmed 2026-05-13 as a separate bucket from the single-endpoint rate limiter — orthogonal pools so one customer can't starve the other.

### Refactor (the real risk of this phase)

- The existing `POST /resources` handler at `src/routes/public-api.ts:142-~600` has its per-item body extracted into an internal function `registerOneResource(input, apiKeyUser)` returning a normalized result object (something like `{ status, resource?, error?, message? }`).
- The single-endpoint handler then unwraps that result into its existing external response shape — **its external behavior must not change**.
- The bulk handler wraps `Promise.all` with concurrency 5 over the array, catches per-item throws, maps each to `{ status: "error", ... }`, aggregates into the summary.
- **Test contract for the refactor:** the existing test suite in `src/routes/public-api.integration.test.ts` (and any other suites covering `POST /resources`) must pass unchanged before any bulk-specific tests are added. Use `pnpm vitest run --exclude '**/resource-registration*'` — the `resource-registration*` exclusion is a longstanding pre-existing bug unrelated to this work.

### SSRF (correction surfaced during planning 2026-05-13)

- **The original PRD assumed SSRF protection was inherited for free post CRIT-07. That is wrong.** PR #29 added `safeFetch` to `routes/instant.ts`, `routes/images.ts`, and `routes/upload.ts` — but NOT to `routes/public-api.ts`. The single `POST /resources` endpoint's `fetchX402Metadata` still uses raw `fetch`, so it is silently SSRF-vulnerable on the user-supplied `resource_url` today.
- **Phase 29 scope adjustment:** migrate `fetchX402Metadata` to `safeFetch` as part of the per-item refactor. Closes a pre-existing single-endpoint hole as a side effect; PR description must mention it.
- Test fixture must include at least one item with a `127.0.0.1` URL to confirm the per-item error path returns `{ status: "error", error: "URL not allowed" }` rather than failing the whole batch. Tests will need `vi.mock("dns", ...)` returning a public IP for whitelisted fixture hostnames while keeping the SSRF guard active for `127.0.0.1` lookups.

### Docs page (`apps/web/src/app/docs/resources/page.tsx`)

- Add a new section under the existing `#programmatic-registration` anchor titled **"Bulk registration"**.
- Include: a 3-item `POST /api/v1/resources/bulk` payload code example, a response example showing one `created` + one `updated` + one `error`, a limits table (max 25, concurrency, rate limit), and a one-line "when to use" callout for marketplaces.

### Marketing — `/developers` page (`apps/web/src/app/developers/page.tsx`)

- "Running a marketplace?" section (lines 302-330):
  1. Rewrite the "One call and your resources are discoverable" line to be accurate but still punchy — e.g., "Register up to 25 resources in a single API call."
  2. Add a small array-form code snippet (or third button) so the bulk shape is visible inline.
- Optional bonus (not required): swap the hero snippet for a single/bulk tabbed example. Defer unless trivial.

### Marketing — homepage `DiscoverSection` (`apps/web/src/components/DiscoverSection/DiscoverSection.tsx`)

- The homepage embeds this marketing block via `HomePage.tsx:267`. Existing tagline: *"Register yours. Find others. One API."*
- Add a short secondary line under the existing tagline — e.g., *"Up to 25 endpoints in one call."* — tonally consistent with the existing copy.
- Keep the change scoped to copy only; do **not** restructure the section, change the CTA, or touch the pricing line.

### Two PRs, two repos

- **PR 1 — `x402-jobs-api` (`~/Projects/x402jobs-api`):** refactor + bulk endpoint + tests. Branch from `main` (post-CRIT-07 merged). One commit per logical step is fine.
- **PR 2 — `x402jobs` (`~/Projects/x402jobs`):** docs page + `/developers` page + homepage `DiscoverSection`. All three frontend tweaks ship together.
- **Do not stage unrelated files** (see canonical refs for the bootstrap's "don't touch" list).

### Claude's Discretion

- Exact name of the internal helper function (`registerOneResource` is a suggestion).
- Concurrency-limit library choice (`p-limit`, hand-rolled semaphore, or pre-existing project pattern — match what's already in `src/lib/` if there's a precedent).
- Exact tone/wording of the homepage `DiscoverSection` bulk line — match the existing tagline cadence.
- Per-item logging shape (per-item wall time + total wall time is a PRD ask for the first week post-launch; format is up to the implementer).
- Whether to emit a `warning` field per item for body-vs-existing mismatch (PRD lists this as an open question; planner decides yes/no based on whether the single endpoint does it today).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec
- `.planning/PRD-bulk-resource-registration.md` — approved PRD (frontmatter `status: approved`, 2026-05-13). The contract.
- `.planning/BOOTSTRAP-bulk-register.md` — handoff doc for this side quest. Includes the don't-touch file list, repo layout, recommended workflow, gotchas.

### Code to refactor (API repo: `~/Projects/x402jobs-api`)
- `src/routes/public-api.ts` lines 1-50 (imports / setup) and 142-~600 (the `POST /resources` handler — note the PUT update at 614+ is unrelated). Extract per-item body into `registerOneResource(input, apiKeyUser)`.
- `src/lib/fetchX402Metadata.*` — already calls `safeFetch` (post-CRIT-07). Bulk inherits SSRF protection through this chain.
- `src/middleware/auth.ts` (or wherever `apiKey` middleware lives) — bulk endpoint reuses this.
- Rate-limit middleware location — TODO for the planner: locate the existing single-endpoint rate limiter and define the bulk bucket adjacent to it (separate keyspace).

### Code to modify (web repo: `~/Projects/x402jobs`)
- `apps/web/src/app/docs/resources/page.tsx` — append "Bulk registration" section under `#programmatic-registration`.
- `apps/web/src/app/developers/page.tsx` — "Running a marketplace?" section copy + snippet tweak (lines 302-330).
- `apps/web/src/components/DiscoverSection/DiscoverSection.tsx` — small bulk-affordance line under the existing "Register yours. Find others. One API." tagline.

### Tests
- `~/Projects/x402jobs-api/src/routes/public-api.integration.test.ts` — must pass unchanged after refactor.
- Existing test exclusion: `pnpm vitest run --exclude '**/resource-registration*'` — longstanding pre-existing test bugs in those files, unrelated to this work. Document but don't try to fix.

### Related phases / context
- Phase 27 (Wallet Encryption, complete 2026-05-12) — unrelated, but post-Phase-27 the API repo is hardened against key-leak concerns.
- Phase 28 (Security Review): CRIT-07 (SSRF) shipped as PR #29 of `x402-jobs-api`, merged 2026-05-13. Phase 28 Highs (`.planning/phases/28-security-review/HIGHS-TRIAGE.md`) are deferred and resume AFTER Phase 29 ships.
- Repo layout intel: `~/.claude/projects/-Users-rawgroundbeef-Projects-x402jobs/memory/repo_layout.md`.

</canonical_refs>

<specifics>
## Example payloads

### Bulk request (3 items)
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
    },
    {
      "name": "Stocks",
      "resource_url": "https://example.com/api/stocks"
    },
    {
      "name": "Bad",
      "resource_url": "https://127.0.0.1/internal"
    }
  ]
}
```

### Bulk response (partial-success example)
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
      "resource": { "id": "...", "slug": "weather-api", "name": "Weather API" }
    },
    {
      "index": 1,
      "status": "updated",
      "resource": { "id": "...", "slug": "stocks", "name": "Stocks" }
    },
    {
      "index": 2,
      "status": "error",
      "error": "URL not allowed",
      "message": "resource_url resolves to a private IP range"
    }
  ]
}
```

### Ownership-conflict response (skipped)
```json
{
  "index": 5,
  "status": "skipped",
  "error": "not_owner",
  "message": "Resource already registered by another user"
}
```

</specifics>

<deferred>
## Deferred (out of scope, file as follow-ups)

- **Async / job-based registration.** Sync only for v1 — the response carries concrete results. Revisit only if customers hit the cap.
- **CSV upload UI.** API-only for this PRD. Dashboard bulk-register UI is a separate effort.
- **Bulk update (`PUT /resources/bulk`).** Callers can still hit `PUT /resources/:id` individually.
- **Bulk delete.** Higher blast radius — keep deletes one-at-a-time.
- **Streaming response (NDJSON / SSE).** Sync flat-JSON for v1.
- **Avatar caching concurrency.** Per-item avatar fetch is sequential today; could parallelize inside `registerOneResource`. Out of scope for v1; note as a follow-up perf improvement.
- **Webhook/Inngest event emission per bulk item.** PRD open question — planner should verify whether the single endpoint emits them (via DB triggers or explicit code) and document inheritance.

</deferred>

---

*Phase: 29-bulk-resource-registration*
*Context gathered: 2026-05-13 via PRD Express Path*
