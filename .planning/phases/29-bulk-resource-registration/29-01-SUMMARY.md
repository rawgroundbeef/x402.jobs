---
phase: 29-bulk-resource-registration
plan: 01
status: complete
branch: feat/bulk-resource-registration
repo: x402jobs-api
pr_url: https://github.com/rawgroundbeef/x402-jobs-api/pull/30
pr_number: 30
created: 2026-05-13
subsystem: api
tags: [express, x402, bulk-registration, ssrf, rate-limit, p-limit, safefetch]

# Dependency graph
requires:
  - phase: 28-security-review
    provides: "safeFetch SSRF guard (CRIT-07, merged in PR #29 / commit 991d370)"
provides:
  - "POST /api/v1/resources/bulk endpoint (up to 25 resources/request)"
  - "registerOneResource(input, apiKeyUser) shared helper + RegisterResult discriminated union"
  - "bulkResourceRateLimiter (6 req/min/API-key, independent keyspace)"
  - "SSRF protection on single-endpoint fetchX402Metadata (side-effect fix; CRIT-07 didn't cover this code path)"
affects: [29-02-docs-and-marketing, public-api-consumers, sdk-clients, developer-marketing-page]

# Tech tracking
tech-stack:
  added: [p-limit@^5]
  patterns:
    - "Per-item registration via shared helper returning a RegisterResult discriminated union (created/updated/skipped/error)"
    - "Bulk endpoint = body validation -> p-limit(5) fan-out -> summary+results envelope, HTTP 200 on partial failure"
    - "Per-item SSRF isolation: a bad URL fails that item only, batch continues"
    - "Dedicated rate-limit bucket per endpoint class (single vs bulk) keyed by API key, separate keyspace"

key-files:
  created:
    - /Users/rawgroundbeef/Projects/x402jobs-api/src/routes/__tests__/public-api-bulk.integration.test.ts
    - /Users/rawgroundbeef/Projects/x402jobs-api/src/routes/__tests__/public-api-bulk-ratelimit.test.ts
  modified:
    - /Users/rawgroundbeef/Projects/x402jobs-api/src/routes/public-api.ts
    - /Users/rawgroundbeef/Projects/x402jobs-api/src/middleware/rateLimit.ts
    - /Users/rawgroundbeef/Projects/x402jobs-api/src/routes/__tests__/public-api.integration.test.ts
    - /Users/rawgroundbeef/Projects/x402jobs-api/package.json
    - /Users/rawgroundbeef/Projects/x402jobs-api/pnpm-lock.yaml

key-decisions:
  - "p-limit@^5 (not ^6) for CJS interop safety (gotcha #5 in plan)"
  - "HTTP 200 on partial-failure bulk responses; 400 only for structurally invalid bodies"
  - "Per-item statuses limited to {created, updated, skipped, error} — skipped reserved for ownership conflict so callers can distinguish 'we did nothing on purpose' from 'genuinely broken'"
  - "Bulk rate-limit uses a separate Map keyspace from the existing minute/hour limiters — bulk consumption does NOT drain the single-endpoint budget, and vice versa"
  - "Migrated fetchX402Metadata to safeFetch as part of the refactor — closes a CRIT-07 gap on the single endpoint that wasn't covered by PR #29"
  - "Did NOT migrate cacheImage to safeFetch — pre-existing exposure on single endpoint; bulk inherits it; tracked as T-29-08 with disposition 'accept with TODO' (out of scope for this plan)"

patterns-established:
  - "RegisterResult discriminated union: { status: 'created'|'updated'|'skipped'|'error', resource_id?, error?, message? } — shared between single and bulk handlers"
  - "Bulk envelope: { summary: { total, created, updated, skipped, errored }, results: [...] } — reusable for future bulk endpoints (PUT/DELETE)"
  - "p-limit(5) per request as the standard concurrency cap for fan-out endpoints"

requirements-completed:
  - PHASE-29-API-REFACTOR
  - PHASE-29-BULK-ENDPOINT
  - PHASE-29-BULK-TESTS
  - PHASE-29-SSRF-INHERITANCE

# Metrics
duration: ~3h (across two sessions, including human-verify checkpoint)
completed: 2026-05-13
---

# Phase 29 Plan 01: Bulk Resource Registration Summary

**`POST /api/v1/resources/bulk` (up to 25 items, p-limit(5), dedicated 6/min rate-limit bucket, per-item SSRF isolation) on top of a shared `registerOneResource` helper. Side-effect: closes CRIT-07 SSRF gap on the single-endpoint metadata fetch.**

## Performance

- **Duration:** ~3h wall clock across two sessions (refactor + bulk + tests in session 1, PR in session 2)
- **Tasks:** 4/4 (refactor, bulk endpoint, tests + verification checkpoint, open PR)
- **Files created:** 2 (both test files)
- **Files modified:** 5 (public-api.ts, rateLimit.ts, existing integration test, package.json, pnpm-lock.yaml)
- **Net code change:** ~+730/-90 lines (estimate from PR diff)
- **Tests delta:** baseline 15 files / 274 tests → after 17 files / 291 tests (+17 tests, all green)

## Accomplishments

- **`POST /api/v1/resources/bulk` endpoint shipped.** Accepts `{ resources: [...up to 25] }`. Returns `{ summary, results }` envelope. HTTP 200 on partial failure (per-item status reflects per-item outcome); HTTP 400 only for structurally invalid bodies (missing/non-array/empty/over-cap).
- **`registerOneResource(input, apiKeyUser)` helper extracted.** Single-endpoint behavior unchanged — verified by the existing test suite running green against the refactored handler.
- **`fetchX402Metadata` migrated to `safeFetch`.** Side-effect security fix: the Phase 28 CRIT-07 PR (#29 on `main`, commit 991d370) did not cover this code path, so the single endpoint was silently SSRF-vulnerable on the user-supplied `resource_url`. Now SSRF errors return 400 "URL not allowed" on both the single endpoint and per-item in bulk.
- **Dedicated `bulkResourceRateLimiter`** (6 req/min per API key, separate Map keyspace from the existing minute/hour limiters in `middleware/rateLimit.ts`). Bulk traffic does not drain the single-endpoint budget.
- **Per-item SSRF isolation** verified: a 127.0.0.1 URL in a 3-item batch fails that item only; the other two are processed normally.
- **Concurrency cap** verified: p-limit(5) ensures ≤5 fetches in-flight at any time.
- **PR opened:** [#30 on rawgroundbeef/x402-jobs-api](https://github.com/rawgroundbeef/x402-jobs-api/pull/30).

## Task Commits

Each task was committed atomically on the API repo branch `feat/bulk-resource-registration`:

1. **Task 1 — Refactor: extract `registerOneResource` + adopt `safeFetch` in metadata fetch** — `221a6ce` (refactor)
   - Carries the `safeFetch` migration of `fetchX402Metadata` (CRIT-07 closure on the single endpoint).
   - Adds `bulkResourceRateLimiter` to `middleware/rateLimit.ts`.
   - Adds `p-limit@^5` to `package.json` + lockfile.
   - Single-endpoint external contract unchanged (existing tests pass unmodified).

2. **Task 2 — Feat: add `POST /api/v1/resources/bulk`** — `fe74ea4` (feat)
   - Body validation (missing/non-array/empty/over-cap).
   - p-limit(5) fan-out to `registerOneResource` per item.
   - `{ summary, results }` response envelope.
   - New test files: `public-api-bulk.integration.test.ts` and `public-api-bulk-ratelimit.test.ts`.

3. **Task 3 — Verification + human-verify checkpoint.** No code commit; was a verification gate (`pnpm vitest run --exclude '**/resource-registration*'` → 17 files / 291 passing; `pnpm typecheck` → 0 new errors). User approved.

4. **Task 4 — Open PR.** No code commit in the API repo. PR #30 opened against `main`.

**Plan metadata commit:** in the planning repo (separate from the API repo) — captures this SUMMARY.md.

## Files Created/Modified

### API repo (`/Users/rawgroundbeef/Projects/x402jobs-api`)

Created:
- `src/routes/__tests__/public-api-bulk.integration.test.ts` — 8 test cases covering body validation, happy path, partial success, SSRF per-item isolation, ownership conflict (`skipped` + `not_owner`), per-item exception isolation, concurrency cap (≤5 in-flight), and single-endpoint `skipped`→`updated:false` parity.
- `src/routes/__tests__/public-api-bulk-ratelimit.test.ts` — verifies the 7th request from the same API key in a minute returns 429 from the dedicated bulk bucket (not the single-endpoint bucket).

Modified:
- `src/routes/public-api.ts` — added `registerOneResource`, `RegisterResult` type, `POST /api/v1/resources/bulk` handler; refactored `POST /resources` to call the helper; migrated `fetchX402Metadata` to `safeFetch`.
- `src/middleware/rateLimit.ts` — added `bulkResourceRateLimiter` with its own `Map<apiKey, { count, resetAt }>` keyspace.
- `src/routes/__tests__/public-api.integration.test.ts` — adjusted DNS-mock setup to be robust under `vi.clearAllMocks()` (cosmetic; no behavior change in tests).
- `package.json` — added `p-limit@^5`.
- `pnpm-lock.yaml` — corresponding lockfile updates.

### Planning repo (`/Users/rawgroundbeef/Projects/x402jobs`)

Created:
- `.planning/phases/29-bulk-resource-registration/29-01-SUMMARY.md` (this file).

## Decisions Made

1. **`p-limit@^5` (not `^6`).** The plan flagged in gotcha #5 that `p-limit@6` is ESM-only and the API repo still has CJS interop in places. `^5` is dual-published.
2. **HTTP 200 on partial-failure bulk responses.** Aligns with stripe/segment/algolia bulk-style APIs — the request itself succeeded; per-item failures live in `results[i].status`. HTTP 400 is reserved for "the request body itself was malformed."
3. **Four explicit per-item statuses.** `created` / `updated` / `skipped` / `error`. `skipped` is reserved for the ownership-conflict case (`error: 'not_owner'`) so callers can distinguish "we deliberately did nothing because someone else owns this URL" from "genuinely broken".
4. **Bulk rate-limit gets its own Map keyspace, not just its own limit.** The minute/hour limiters in `middleware/rateLimit.ts` already use one Map keyed by API key; bulk uses a separate Map. This was a deliberate plan choice: bulk consumption should not drain the single-endpoint budget, and conversely a noisy single-endpoint caller shouldn't lock out their own bulk traffic.
5. **Migrate `fetchX402Metadata` to `safeFetch` in this PR, NOT `cacheImage`.** Single-endpoint metadata fetch was the actual gap CRIT-07 missed; closing it is in-scope as a side-effect of the refactor. `cacheImage` is a separate pre-existing exposure on the single endpoint — bulk inherits it but doesn't *add* new exposure. Tracked as T-29-08 in the threat register with disposition "accept with TODO". Filed as follow-up work, not blocking this PR.
6. **Rate-limit test split into a dedicated file.** Plan task 2 allowed this as an explicit alternative. Keeps the main integration test file focused on functional cases; the rate-limit file uses faketime so it doesn't leak global state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Made DNS mock setup robust to `vi.clearAllMocks()` between tests**
- **Found during:** Task 2 (writing `public-api-bulk.integration.test.ts`)
- **Issue:** Calling `vi.clearAllMocks()` in `beforeEach` blew away the SSRF DNS mocks that need to be in place for the whole file, causing intermittent unhandled-rejection noise in stderr.
- **Fix:** Switched to per-test `vi.spyOn(...).mockImplementation(...)` re-application in `beforeEach`. No behavior change in test assertions.
- **Files modified:** `src/routes/__tests__/public-api.integration.test.ts` (existing file — change is cosmetic/stderr-cleanup)
- **Verification:** Test suite green; stderr quieter.
- **Committed in:** `fe74ea4` (Task 2 commit)

**2. [Rule 2 — Missing critical functionality] Used `p-limit@^5` instead of `^6` per gotcha #5**
- **Found during:** Task 1 (adding dependency)
- **Issue:** Plan gotcha #5 explicitly flagged that `p-limit@6` is ESM-only and would break CJS interop. Plan body still said `^6` in the action block (gotchas had the override but the action didn't).
- **Fix:** Pinned `^5`; verified `require('p-limit')` works.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Committed in:** `221a6ce` (Task 1 commit)

### Out-of-Scope Items Logged (not fixed in this plan)

- **`cacheImage` still uses raw `fetch`** — pre-existing SSRF exposure on the single endpoint, inherited by bulk per-item. Tracked as threat-register entry T-29-08 with disposition "accept with TODO". Filed as follow-up work for a future security pass; not in this PR's scope.
- **`pnpm lint` infrastructure is broken on `main`** — eslint binary is not installed in the workspace. Pre-existing condition; reproducing it on `main` confirms this isn't a regression from this branch. Left as-is.
- **`pnpm typecheck` has 19 pre-existing errors** — all inside `resource-registration*.test.ts` files which are already excluded from vitest per the plan's task 3 directive. 0 new typecheck errors introduced by this branch.
- **Stale gotcha #2** — referenced local commit `80656fe` for the CRIT-07 fix, but the actual fix on `main` is `991d370` via PR #29. Didn't affect execution; flagging for plan hygiene only.

---

**Total deviations:** 2 auto-fixed (1 bug fix in test setup, 1 dependency-version override per plan gotcha)
**Impact on plan:** None on contract or behavior. Both deviations were per-plan-guidance (`p-limit@^5` override) or test-suite hygiene (DNS mock robustness).

## safeFetch Coverage Status

- **`fetchX402Metadata`**: migrated to `safeFetch` in this PR (closes CRIT-07 gap on single endpoint as a side-effect; bulk inherits the fix).
- **`cacheImage`**: NOT migrated. Still uses raw `fetch` in `src/routes/resources.ts`. Pre-existing exposure on the single endpoint — bulk does not add new exposure, only inherits the existing one. Threat-register disposition: T-29-08 "accept with TODO". File this as a follow-up plan rather than expanding scope here.

## Performance / Wall-Clock Smoke Notes

- **Local curl smoke test was SKIPPED.** `TEST_API_KEY` is not set in the local env. The integration tests cover equivalent paths against the real Express router (`supertest` on the mounted router), so the contract is exercised — but no real-network wall-clock numbers were captured.
- **Recommended follow-up after merge:** run a 25-item bulk request against a staging deployment to capture real wall-clock numbers (expected: ~5× faster than 25 sequential single requests thanks to p-limit(5), modulo external x402 endpoint latency).

## Issues Encountered

- **Test stderr noise from cleared DNS mocks** — fixed inline (deviation #1 above).
- **`pnpm lint` runs but fails because eslint isn't installed** — verified pre-existing on `main`. Out of scope.
- **`pnpm typecheck` reports 19 errors in excluded test files** — verified pre-existing; 0 new errors from this branch. Out of scope.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: ssrf (resolved on single endpoint) | `src/routes/public-api.ts` | `fetchX402Metadata` migrated to `safeFetch`; closes CRIT-07 gap that PR #29 didn't cover. |
| threat_flag: ssrf (deferred — T-29-08) | `src/routes/resources.ts` (`cacheImage`) | Pre-existing raw-`fetch` exposure on single endpoint; bulk inherits per-item. Disposition: accept with TODO; track in follow-up plan. |
| threat_flag: rate-limit-bypass (mitigated) | `src/middleware/rateLimit.ts` | New bulk endpoint has its own bucket (6/min/API-key). Bulk and single-endpoint budgets are independent — neither can drain the other. |
| threat_flag: input-amplification (mitigated) | `src/routes/public-api.ts` (bulk handler) | Per-request cap of 25 items + p-limit(5) concurrency cap + dedicated 6/min/API-key rate limit bound the amplification factor a single attacker can achieve. |

## Self-Check: PASSED

- API repo commits exist on branch `feat/bulk-resource-registration`:
  - `221a6ce` (refactor) — verified via `git log --oneline -5` at handoff.
  - `fe74ea4` (feat) — verified via `git log --oneline -5` at handoff and `git ls-remote origin feat/bulk-resource-registration` returns `fe74ea4b5a578071c70fc152a3755477e67594df`.
- PR #30 created and URL captured: https://github.com/rawgroundbeef/x402-jobs-api/pull/30
- SUMMARY.md written at `/Users/rawgroundbeef/Projects/x402jobs/.planning/phases/29-bulk-resource-registration/29-01-SUMMARY.md`.

## Next Phase Readiness

- **Plan 29-02 (docs + marketing) is now unblocked.** It can reference PR #30 / the merged endpoint contract for the OpenAPI / docs / `/developers` page update.
- **Follow-up plan candidate (security):** migrate `cacheImage` to `safeFetch` to close T-29-08. Small scope; can be folded into the next security pass.
- **Follow-up plan candidate (observability):** capture real wall-clock numbers from a staging bulk-register run; if p-limit(5) is too aggressive or too conservative, tune it.
- **Phase 30 (merge x402jobs + x402jobs-api repos):** the PR layout (planning commit lives in `x402jobs`, code commits live in `x402jobs-api`) will collapse to a single repo. No structural impact from this plan.

---
*Phase: 29-bulk-resource-registration*
*Plan: 01*
*Completed: 2026-05-13*
*PR: https://github.com/rawgroundbeef/x402-jobs-api/pull/30*
