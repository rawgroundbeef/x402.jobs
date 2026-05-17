---
phase: 32
slug: platform-fee-replacement-announcement
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-17
last_updated: 2026-05-17
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 32-RESEARCH.md §12 Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.8 |
| **Config file** | `apps/api/vitest.config.ts` (pre-sets `FACILITATOR_URL=http://localhost:9999`) |
| **Quick run command** | `pnpm --filter x402-jobs-api typecheck && pnpm --filter x402-jobs-api lint && pnpm --filter x402-jobs-api test <touched-file-pattern>` |
| **Full suite command** | `pnpm --filter x402-jobs-api test` (no separate "full" suite — single Vitest project) |
| **Estimated runtime** | Quick run: ~5-15s; full suite: ~30-60s |

---

## Sampling Rate

- **After every task commit:** Run the quick run command on touched files.
- **After every plan wave:** Run the full suite.
- **Before `/gsd-verify-work`:** Full suite green + manual `npx x402lint` check on captured 402 response from dev server + manual CHANGELOG.md review.
- **Max feedback latency:** ~60s (full suite).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-02-T1 (failing scaffold) / 32-02-T2 (impl) / 32-02-T3 (commit + full suite) | 32-02 | 2 | FEE-01 | — | Endpoint mounts at `/x402/fees/:network/charge` and returns 402 (no payment) or 503 (no `payTo`) | unit (route registration + supertest) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "FEE-01"` | ❌ W2 | ⬜ pending |
| 32-02-T1 / 32-02-T2 | 32-02 | 2 | FEE-02 | — | `facilitator.settle()` called exactly once with the network and `payTo` matching `FEE_COLLECTION_*_ADDRESS`; verify path implicit (settle handles it) | unit (mocked `@openfacilitator/sdk`) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "FEE-02"` | ❌ W2 | ⬜ pending |
| 32-02-T1 / 32-02-T2 + manual operator step | 32-02 | 2 | FEE-03 | T-32-01 | 402 response shape matches captured fixtures and passes `npx x402lint check` against the live dev server | unit (fixture deep-equal) + manual lint | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "FEE-03"` plus `npx --yes x402lint check /tmp/402-sol.json` | ❌ W2 | ⬜ pending |
| 32-02-T1 / 32-02-T2 | 32-02 | 2 | FEE-04 | — | `:network=solana` → `solana:5eykt4UsFv8…`; `:network=base` → `eip155:8453`; `:network=eth` → 404 | unit (3 supertest cases) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "FEE-04"` | ❌ W2 | ⬜ pending |
| 32-01-T2 (config edit) + 32-04-T2 (URL flip uses 0.01 already in place) | 32-01 | 1 | FEE-05 | — | `parseFloat(process.env.PLATFORM_FEE_PERCENTAGE \|\| "0.01")` resolves to `0.01` when env unset | unit (config import in any test) | `grep -q 'PLATFORM_FEE_PERCENTAGE \|\| "0.01"' apps/api/src/config.ts` | ✅ inherited | ⬜ pending |
| STATE.md manual task + 32-05-T3 | 32-05 | — | FEE-06 | T-32-05 | `FEE_COLLECTION_{SOLANA,BASE}_ADDRESS` set in Railway prod; addresses are cold-storage / multisig; Solscan + Basescan resolve the pages | manual (Railway env inspection + browser check) | n/a — manual operator task; recorded in `STATE.md` v3.1 manual tasks + screenshots in PR description | manual | ⬜ pending |
| 32-01-T2 (config rename) + 32-05-T2 (env.example) | 32-05 | 5 | FEE-07 | — | `env.example` declares `FEE_COLLECTION_{SOLANA,BASE}_ADDRESS=` with blank values; `PLATFORM_FEE_PERCENTAGE=0.01`; `BASE_PLATFORM_WALLET=` address line removed (PRIVATE_KEY unchanged) | grep-test | `grep -E "FEE_COLLECTION_(SOLANA\|BASE)_ADDRESS" apps/api/env.example && ! grep -E "^BASE_PLATFORM_WALLET=" apps/api/env.example` | ❌ W5 | ⬜ pending |
| 32-04-T2 (URL flip + charge-platform-fee rewrite) + 32-05-T4 (grep gate) | 32-04 → 32-05 | 4 + 5 | FEE-08 | T-32-01 | No `agents.memeputer.com` in `platformFee` block of `config.ts` OR in `charge-platform-fee.ts`. STILL present in `routes/hiring.ts`, `routes/ask-jobputer.ts`, `inngest/utils/charge-escrow.ts`, and `config.ts#escrow` (D-10 strict scope, deferred to v3.2). | negative grep (in-scope) + positive grep (deferred-scope) | `! grep -q "agents.memeputer.com" apps/api/src/inngest/utils/charge-platform-fee.ts && ! grep -A 10 "platformFee:" apps/api/src/config.ts \| grep -q "agents.memeputer.com" && grep -q "agents.memeputer.com" apps/api/src/routes/hiring.ts` | ❌ W4 | ⬜ pending |
| 32-04-T4 (test creation) | 32-04 | 4 | FEE-09 | — | Failed run paid via new endpoint can be refunded `total_cost` (including fee, per D-14). Snapshot's `settled.amount_paid` is read but does NOT discount the refund. Pending-refund collision returns 400. | integration (Vitest, in-memory rowStore mock) | `pnpm --filter x402-jobs-api test src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts --run` (3 tests) | ❌ W4 | ⬜ pending |
| 32-03-T3 (scaffold as `it.todo`) → 32-04-T1 (activate to `it`) + 32-04-T2 (impl) | 32-04 | 3 + 4 | FEE-10 | T-32-03 | (a) Snapshot with old URL + old percentage routes payment to old URL at old percentage. (b) Null snapshot falls back to live config (new URL, 1%). (c) Base derivation `/solana/→/base/` works on legacy snapshot URLs. | unit (mocked `executeX402Request` + `config`) | `pnpm --filter x402-jobs-api test src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts --run` (3 tests) | ❌ W3 → W4 | ⬜ pending |
| 32-05-T1 (create) + 32-05-T3 (operator paste) + 32-05-T4 (gate) | 32-05 | 5 | OPS-01 | T-32-05 | `CHANGELOG.md` v3.1 entry exists with real `FEE_COLLECTION_SOLANA_ADDRESS` value + real `FEE_COLLECTION_BASE_ADDRESS` value AND a Solscan link AND a Basescan link. No `<solana-addr>` / `<base-addr>` / `2026-MM-DD` placeholders remain. | grep-test (placeholder absence + explorer presence) | `grep -E "FEE_COLLECTION_(SOLANA\|BASE)_ADDRESS" CHANGELOG.md && grep -E "solscan\\.io\|basescan\\.org" CHANGELOG.md && ! grep -q "<solana-addr>\|<base-addr>\|2026-MM-DD" CHANGELOG.md` | ❌ W5 | ⬜ pending |
| 32-05-T2 + 32-05-T4 | 32-05 | 5 | OPS-02 | — | `env.example` keeps `# PLATFORM_FEE_URL=https://agents.memeputer.com/...` as a commented line with `DEPRECATED v3.1, removed in v3.2` text; new defaults present (1% + minimum) | grep-test | `grep -q "DEPRECATED v3.1" apps/api/env.example && grep -q "PLATFORM_FEE_PERCENTAGE=0.01" apps/api/env.example` | ❌ W5 | ⬜ pending |
| 32-05-T4 grep gate (manual code-review pattern across all phase commits) | 32-05 | — | OPS-04 | — | No `shim` / `backwardCompat` / `legacyFee` tokens in fee code; no dual-path runtime logic anywhere in `charge-platform-fee.ts` or `x402-fees.ts` | negative grep + manual review | `! grep -iE "shim\|backward.?compat\|legacy.?fee" apps/api/src/inngest/utils/charge-platform-fee.ts apps/api/src/routes/x402-fees.ts` | manual review | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Cross-task threat dispositions (planner-assigned, see each PLAN's `<threat_model>`):**
- T-32-01 (HIGH, caller-supplied amount forgery) → **mitigate** in 32-02 (settle-time validation against published `accepts[]` + `MAX_AMOUNT_USDC=100` sanity cap)
- T-32-02 (LOW, unauthenticated DoS on fee endpoint) → **accept** in 32-02 (x402 IS the auth — RESEARCH §9 OQ-2)
- T-32-03 (MEDIUM, snapshot poisoning via INSERT bypass) → **mitigate** in 32-03 (single helper construction path) + 32-05-T4 grep gate
- T-32-04 (HIGH, migration not applied before code deploy) → **mitigate** in 32-01-T4 [BLOCKING] operator gate + fallback-to-live-config read path in 32-04
- T-32-05 (LOW, wallet env var misconfiguration / typo'd CHANGELOG address) → **mitigate** in 32-01 startup warnings + 32-02 503-on-empty handler + 32-05-T3 operator Solscan/Basescan cross-check

---

## Wave 0 Requirements

Existing test infrastructure (Vitest, mocks, fixtures, `FACILITATOR_URL` pre-set) is **sufficient**. No framework install needed.

New test files the plan creates (planted as Wave 0 dependencies for their respective requirements):

- [x] `apps/api/src/routes/__tests__/x402-fees.test.ts` — covers FEE-01..04 (Plan 32-02 Task 1 plants the failing scaffold; Plan 32-02 Task 2 makes it pass)
- [x] `apps/api/src/routes/__tests__/fixtures/x402-fee-402-response.solana.json` — fixture for FEE-03 unit assertion (Plan 32-02)
- [x] `apps/api/src/routes/__tests__/fixtures/x402-fee-402-response.base.json` — fixture for FEE-03/FEE-04 unit assertion (Plan 32-02)
- [x] `apps/api/src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts` — covers FEE-10 (Plan 32-03 Task 3 plants as `it.todo`; Plan 32-04 Task 1 activates as live `it()`)
- [x] `apps/api/src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` — covers FEE-09 (Plan 32-04 Task 4)

The optional `apps/api/src/inngest/utils/__tests__/platform-fee-snapshot.test.ts` is NOT planted — the helper is trivial (one function, no branches), and exercising it via the grandfather test + the 7 INSERT-site coverage is sufficient. Add if a future PR introduces a branch in the helper.

No new shared fixtures needed beyond the two captured 402 responses; per-test mocks suffice for everything else.

---

## Manual-Only Verifications

| Behavior | Requirement | Plan / Task | Why Manual | Test Instructions |
|----------|-------------|-------------|------------|-------------------|
| Migration 011 applied to production Supabase before Wave 3 commits ship | T-32-04 (DoS mitigation) | 32-01 Task 4 [BLOCKING] | Migrations are manually applied via Supabase Dashboard SQL Editor or `psql` per CLAUDE.md / `apps/api/migrations/README.md` — no deploy-time auto-apply | Operator pastes `011_add_platform_fee_snapshot.sql` into Supabase SQL Editor, clicks Run, then runs the `information_schema.columns` verification query and pastes the `platform_fee \| jsonb \| YES` output in the resume signal. |
| Fee-collection wallets are cold-storage or multisig (not operational hot wallets) | FEE-06 | STATE.md manual task (not in any PLAN's autonomous task list — operator side) | Wallet provisioning is out-of-band; no programmatic check can confirm "cold storage" semantics | Operator provisions wallets, populates `FEE_COLLECTION_SOLANA_ADDRESS` + `FEE_COLLECTION_BASE_ADDRESS` env vars in Railway, then confirms Solscan + Basescan pages load with balance 0 and no prior transactions (or with the documented provenance pattern). |
| Real `x402lint` validation against captured 402 from the running dev server | FEE-03 (belt + suspenders D-04) | 32-02 (operator step in PR description, after 32-02-T3) | The unit-fixture deep-equal catches regressions in `build402FeeResponse`; running `npx x402lint` against a live response catches edge cases the fixture missed (e.g., a v2 protocol field that x402lint added after the fixture was captured) | (1) `pnpm dev:api` (port 3011). (2) `curl -X POST http://localhost:3011/x402/fees/solana/charge -d '{"amount_usdc":0.01}' -H "Content-Type: application/json" > /tmp/402-sol.json`. (3) `npx --yes x402lint check /tmp/402-sol.json`. (4) Repeat for `/base/`. (5) Paste green output into the Phase 32 PR description. |
| No backward-compat shim added (manual code review beyond grep) | OPS-04 | 32-05 Task 4 + reviewer | Grep is a hint, not a proof — a contributor might write a shim with different naming | Reviewer reads `apps/api/src/inngest/utils/charge-platform-fee.ts`, `apps/api/src/routes/x402-fees.ts`, and `apps/api/src/config.ts#platformFee` end-to-end to confirm no dual-path / legacy-URL fallback logic was introduced. The `runSnapshot?.config ?? config.platformFee.*` fallback in `chargePlatformFee` is NOT a shim — it's a forward-only fallback for legacy DB rows (per D-07). |
| Real wallet addresses pasted into CHANGELOG.md (no placeholders) | OPS-01 / T-32-05 | 32-05 Task 3 [BLOCKING] | Wallet provenance is operator-side; the planner cannot supply real addresses | Operator replaces `<solana-addr>` (×2) + `<base-addr>` (×2) + `2026-MM-DD` (×1) in CHANGELOG.md, then opens Solscan + Basescan in a browser to confirm both pages load. Screenshot in PR description for audit trail. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (filled in by planner during PLAN.md generation 2026-05-17)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (verified: each PLAN's task list interleaves implementation tasks with their verify commands)
- [x] Wave 0 covers all MISSING references (3 test files + 2 fixtures planted)
- [x] No watch-mode flags in test commands (all use `--run` or no flag at all; vitest's default is single-pass when called from CI / non-tty)
- [x] Feedback latency < 60s (Vitest full suite estimated 30-60s per RESEARCH §12)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-17. Operator approval pending Plan 32-01 Task 4 + Plan 32-05 Task 3 manual gates.
