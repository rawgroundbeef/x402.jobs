# Phase 29 — Plan Check

**Reviewer:** plan-checker (adversarial pre-execution review)
**Date:** 2026-05-13
**Verdict:** **PASS** (with 2 small WARNINGs the executor should heed; no BLOCKERs)

---

## TL;DR

Both plans deliver the phase goal end-to-end. The SSRF correction is genuinely necessary (verified against live code), the two-repo discipline is enforced, the four locked PRD decisions are all implemented literally, and PR-creation gates are explicit. Two warnings worth fixing inline during execution but neither blocks kicking off.

---

## Verification by dimension

### 1. Goal coverage — PASS

Phase goal: ship `POST /api/v1/resources/bulk` (up to 25), plus docs + marketing.

| PRD deliverable | Where delivered | Status |
|---|---|---|
| New bulk endpoint accepting up to 25 items | 29-01 task 2 | covered |
| Per-item statuses (`created`/`updated`/`skipped`/`error`) | 29-01 task 1 (`RegisterResult`) + task 2 (mapper) | covered |
| `summary` object aggregation | 29-01 task 2 implementation block | covered |
| HTTP 200 on partial failure; 400 on structural | 29-01 task 2 behavior bullets + impl | covered |
| Concurrency 5 via p-limit | 29-01 task 1 (dep) + task 2 (pLimit usage) | covered |
| Separate 6 req/min rate-limit bucket | 29-01 task 1 (`bulkResourceRateLimiter`) + task 2 (mount) | covered |
| SSRF inheritance (the real fix) | 29-01 task 1 (migrate `fetchX402Metadata` to `safeFetch`) | covered |
| Existing single-endpoint test suite passes unchanged | 29-01 task 1 `done` + verify | covered |
| Bulk-specific integration tests | 29-01 task 2 (9 test areas enumerated) | covered |
| `/docs/resources` adds Bulk registration section under `#programmatic-registration` | 29-02 task 1 | covered |
| `/developers` "Running a marketplace?" copy rewrite + inline snippet | 29-02 task 2 | covered |
| Homepage `DiscoverSection` bulk-affordance line | 29-02 task 3 | covered |

No PRD requirement is silently dropped.

### 2. Locked decision compliance — PASS

| PRD locked decision | Plan implementation | Verdict |
|---|---|---|
| Cap = 25 items | `BULK_MAX_ITEMS = 25` (29-01 task 2 impl); over-cap test for 26 → 400 (task 2 behavior); docs reflect "max 25" | literal |
| Conflict = `skipped` with `error: "not_owner"` | 29-01 task 1 RegisterResult union includes `skipped`; task 2 ownership-conflict test verifies the `not_owner` shape; PRD example payload mirrored in docs | literal |
| Rate-limit = separate bucket, 6 req/min | `bulkResourceRateLimiter` with `bulk:` keyspace prefix; rate-limit-bucket-separation integration test; orthogonal to existing limiters explicitly called out | literal |
| Sync-only for v1 | No job queue / async hatch anywhere in either plan; bulk handler is straight `Promise.all` | literal |

### 3. SSRF correction — PASS (the most important check)

**Verified against live code:**

`x402jobs-api/src/routes/public-api.ts:91-139` — `fetchX402Metadata` uses **raw `fetch`** (lines 94 and 100). It does NOT import or call `safeFetch`. The plans' premise is correct: the Phase 28 CRIT-07 work did not cover this code path.

`x402jobs-api/src/lib/safe-fetch.ts` exists and exports both `safeFetch` and `SSRFError` — what 29-01 task 1 imports.

The fix is **scoped correctly**: 29-01 only modifies `fetchX402Metadata` to use `safeFetch`. It does not touch `cacheImage` (the avatar fetch — explicitly noted as out of scope in T-29-08 of the threat model with a recommendation to verify-and-defer, which is the right call given the PRD's "no scope creep" stance).

**SSRF test will actually trigger** on `127.0.0.1`: `assertPublicHost` in `safe-fetch.ts:121-132` short-circuits IP literals via `isPrivateIp` *before* `dns.lookup`. So a `https://127.0.0.1/internal` URL throws `SSRFError` without needing a DNS mock. 29-01 task 2's SSRF test comments correctly note this (line 437 of the plan: "actually `127.0.0.1` will be recognized as an IP literal and rejected directly via `isPrivateIp` without hitting `dns.lookup`. So no mock override needed for that hostname").

The `dns/promises` mock strategy for the *happy-path* test is also correct: `safe-fetch.ts:1` imports `{ promises as dns } from "dns"`, so mocking `"dns"` with `promises.lookup` returning a public IP is exactly right.

One small WARNING below about the mock shape — not a blocker.

### 4. Refactor risk — PASS

PRD calls the per-item refactor the dominant risk. Plan 29-01 task 1's `<behavior>` block explicitly states:

> "All existing tests in `src/routes/__tests__/public-api.integration.test.ts` still pass unchanged ... All existing tests in `src/routes/__tests__/public-api-ownership.test.ts` still pass unchanged."

The `<action>` block runs `pnpm vitest run --exclude '**/resource-registration*'` **after** the refactor and **before** task 2 adds the bulk handler. Task 1's `<done>` block explicitly requires the existing suite to be green before task 2 can start.

Ordering is correct: refactor (with safeFetch migration) → green tests → add bulk → green tests + green new tests.

### 5. Two-repo discipline — PASS

| Plan | `repo` field | All `files_modified` paths | Verdict |
|---|---|---|---|
| 29-01 | `x402jobs-api` | All 5 paths under `/Users/rawgroundbeef/Projects/x402jobs-api` | clean |
| 29-02 | `x402jobs` | All 3 paths under `/Users/rawgroundbeef/Projects/x402jobs/apps/web` | clean |

No cross-contamination. Each plan's `<objective>` block also explicitly forbids touching the other repo. The dependency direction (29-02 depends on 29-01 conceptually, declared via `depends_on: ["29-01"]` and the "merge API PR first" guidance) is right.

### 6. Don't-stage discipline — PASS

29-01 task 1 stages explicitly: `git add package.json pnpm-lock.yaml src/routes/public-api.ts src/middleware/rateLimit.ts src/routes/__tests__/public-api.integration.test.ts`.
29-01 task 2 stages explicitly: `git add src/routes/public-api.ts src/routes/__tests__/public-api-bulk.integration.test.ts`.
29-02 task 4 stages all 3 frontend files by full path.

No `git add .` or `git add -A` anywhere. Both plans list the known unrelated dirty files in their gotchas blocks. The 29-01 pre-flight has an explicit "STOP and ask user if anything else is dirty" instruction beyond the 3 known files.

### 7. Test exclusion gotcha — PASS

`pnpm vitest run --exclude '**/resource-registration*'` appears in:

- 29-01 task 1 `<behavior>` (line 289), `<action>` step 1E (line 344), `<verify><automated>` (line 384)
- 29-01 task 2 `<action>` (line 531), `<verify><automated>` (line 576)
- 29-01 task 3 checkpoint verify (line 601)
- 29-01 `<verification>` (line 765)

The flag is consistently applied at every API test run. No bare `pnpm test` slip-ups.

### 8. Threat model adequacy — PASS

29-01's STRIDE table covers:

| STRIDE concern from review brief | Threat ID | Coverage |
|---|---|---|
| Amplified rate-limit abuse (25x) | T-29-02 | mitigated via cap-25 + concurrency-5 + separate-bucket-6/min |
| SSRF amplification (pre-existing single hole now exposed) | T-29-01 | mitigated via `fetchX402Metadata` → `safeFetch` migration |
| Memory pressure from 25 concurrent fetches | T-29-04 | mitigated via concurrency 5 (caps in-flight to 5 not 25) |
| Timeout risk if one item hangs | T-29-03 | explicitly **accepted with TODO** — no AbortSignal today, logged for week-1 monitoring, out of scope per PRD |
| Information disclosure via per-item errors | T-29-06 | mitigated (sanitized messages, no stack leaks) |
| Spoofing / ownership confusion | T-29-05 | mitigated via existing ownership check + skipped status |

**`p-limit` supply-chain risk:** Not explicitly enumerated in the STRIDE table. The gotchas block does discuss v5 (CJS-safe) vs v6 (ESM-only) compat, which is the right call surface for tsconfig fit, but doesn't address supply chain. **WARNING-1 below.**

29-02's STRIDE table is minimal but appropriate — the changes are static JSX/Tailwind, no user input, no XSS surface introduced.

### 9. PR confirmation gates — PASS

| Plan | Checkpoint task | Resume-signal |
|---|---|---|
| 29-01 | Task 3 (`checkpoint:human-verify`, `gate="blocking"`) — "Local sanity check + push branch + USER APPROVAL before opening PR" | "Type 'approved' (or 'open the PR') to authorize PR creation" |
| 29-02 | Task 4 (`checkpoint:human-verify`, `gate="blocking"`) — same pattern | "Type 'approved' (or 'open the PR') to authorize PR creation" |

Both plans split PR opening into a separate task (29-01 task 4, 29-02 task 5) that is gated behind explicit approval. No autonomous PR open. Matches the stated user preference exactly.

### 10. Marketing copy scope — PASS

29-02 task 3 (DiscoverSection) action block is explicit:

> "Do NOT change the pricing line, the CTAs, the headline, or anything else in this file."

It's a copy-only insertion of one `<br />` + one line. The `<files>` field is a single file. The before/after diff in the action block (lines 281-298 of the plan) shows exactly the surgical change: insert two lines (`Up to 25 endpoints in one call.` + a `<br />`) between the existing tagline and the pricing line. The pricing line `$50/month or pay per lookup.` is preserved verbatim. No restructure.

### 11. CLAUDE.md compliance — N/A

No `CLAUDE.md` in `/Users/rawgroundbeef/Projects/x402jobs/.planning/phases/29-bulk-resource-registration/`. SKIPPED.

---

## WARNINGs (not blockers — fix inline during execution)

**WARNING-1: `p-limit` supply-chain not in threat model.**
The STRIDE table in 29-01 doesn't enumerate dependency-supply-chain risk for the new `p-limit` dep. `p-limit` is Sindre Sorhus's package — well-maintained, widely used, low risk in practice — but the threat model would be more honest if T-29-09 (or similar) called it out and dispositioned as `accept` with the rationale "well-known author, used by ~50k packages, no native bindings." Not a blocker; just consistency with the rest of the threat register.

**Action:** Add one row to 29-01's STRIDE table during execution, or note in the PR description that `p-limit@^5` was chosen for CJS compat and is a single tiny pure-JS module.

**WARNING-2: `dns/promises` vs `dns` mock shape — confirm before committing.**
29-01 task 1 step 1D mocks `dns` with a `promises.lookup` property:

```typescript
vi.mock("dns", () => ({
  promises: {
    lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
  },
}));
```

This matches `safe-fetch.ts:1` which does `import { promises as dns } from "dns"`. **Verified correct.** But vitest's module mocking can be finicky here — if the test fails because the mock doesn't satisfy ESM's `import { promises as dns }` destructuring, the executor should fall back to mocking the deeper `"dns/promises"` specifier, or mock the `safe-fetch` module directly per gotcha #6 Option B. Either is acceptable; just don't burn time fighting the mock shape if it doesn't snap together on the first try.

**Action:** If the mock fails on first run, immediately switch to Option B (`vi.mock("../../lib/safe-fetch", ...)`) rather than chasing dns-mock variants. Note the choice in the PR description so the SSRF integration coverage gap is explicit.

---

## Issues structured

```yaml
issues:
  - dimension: threat_model_adequacy
    severity: warning
    description: "p-limit dependency-supply-chain risk not enumerated in 29-01 STRIDE table"
    plan: "29-01"
    fix_hint: "Add T-29-09 row dispositioned 'accept' with rationale (well-known author, pure JS, no native bindings)"
  - dimension: task_completeness
    severity: warning
    description: "dns module mock shape may not satisfy vitest ESM destructuring on first attempt"
    plan: "29-01"
    task: 1
    fix_hint: "If mock fails, fall back to mocking ../../lib/safe-fetch directly per gotcha #6 Option B; don't burn time on dns-mock variants"
```

No blockers.

---

## Reality-check confirmations

The following claims in the plans were verified against live code (not assumed):

1. **`fetchX402Metadata` uses raw `fetch`, not `safeFetch`.** Confirmed at `x402jobs-api/src/routes/public-api.ts:94` and `:100`. Plans' SSRF correction premise is sound.

2. **`safeFetch` and `SSRFError` are exported from `src/lib/safe-fetch.ts`.** Confirmed at lines 114 and 165 of that file. The IP-literal short-circuit at `assertPublicHost:125-131` makes `127.0.0.1` test work without a DNS mock for that specific URL.

3. **Rate-limit middleware location is `src/middleware/rateLimit.ts`.** Confirmed. Existing pattern (per-key-prefix keyGenerator, custom handler, both per-minute and per-hour exports) gives the bulk limiter a template to follow. The plan's proposed `bulkResourceRateLimiter` shape (lines 204-224 of 29-01) is a clean structural match.

4. **Existing integration test mocks `global.fetch`** at `public-api.integration.test.ts:140` and `:250`. Confirmed. The plan's strategy of leaving these mocks in place and adding a `dns` mock so `safeFetch` is satisfied is correct.

5. **`/developers` page lines 302-330** — confirmed at the exact lines cited. The current body text on lines 306-310 reads exactly as the plan's "before" snippet. The "via API →" link at line 322 does target `/docs/resources#programmatic-registration`.

6. **`DiscoverSection.tsx` lines 93-97** — confirmed. The tagline block matches the plan's "current state" snippet byte-for-byte (`"Register yours. Find others. One API."` on line 94, `"$50/month or pay per lookup."` on line 96).

7. **`#programmatic-registration` anchor genuinely missing.** A grep for `id="programmatic-registration"` in `apps/web/src/app/docs/resources/page.tsx` returned nothing during my read. Adding it (as 29-02 task 1 does) genuinely fixes a latent broken link.

---

## Final verdict

**PASS** — execution can begin. The two warnings are quality-of-life inline fixes, not pre-execution revisions. The plans will deliver the phase goal end-to-end.

Recommended execution order:
1. Run 29-01 task 1 → task 2 → task 3 (checkpoint). Get user approval. Run task 4.
2. After 29-01 PR is opened (and ideally merged), run 29-02 tasks 1-3, then task 4 (checkpoint). Get user approval. Run task 5.

The 29-02 plan correctly notes the dependency direction is one-way and offers the user the option to ship both simultaneously if they prefer.
