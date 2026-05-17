---
phase: 32
slug: platform-fee-replacement-announcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
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
| TBD | TBD | 2 | FEE-01 | — | Endpoint mounts at `/x402/fees/:network/charge` and returns 402 on GET | unit (route registration) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "mounts"` | ❌ W2 | ⬜ pending |
| TBD | TBD | 2 | FEE-02 | — | `facilitator.settle()` called with correct args; verify path covered | unit (mocked facilitator) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "settle"` | ❌ W2 | ⬜ pending |
| TBD | TBD | 2 | FEE-03 | — | 402 response shape passes x402lint validation (CAIP-2, accepts[], addresses) | unit (fixture compare) + manual lint | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "402"` + `npx x402lint <captured.json>` | ❌ W2 | ⬜ pending |
| TBD | TBD | 2 | FEE-04 | — | Solana request charges Solana fee, Base charges Base; no cross-chain | unit (per-network describes) | Same file, different `describe` blocks | ❌ W2 | ⬜ pending |
| TBD | TBD | 1 | FEE-05 | — | Default rate is `0.01` (1%) with `0.01` minimum preserved | unit (config import) | Inline assert in any test importing `config` | ✅ inherited | ⬜ pending |
| TBD | TBD | — | FEE-06 | — | Wallet env vars set in Railway, addresses cold-storage / multisig | manual (Railway env inspection + on-chain check) | n/a — manual STATE.md task | manual | ⬜ pending |
| TBD | TBD | 5 | FEE-07 | — | env.example documents `FEE_COLLECTION_{SOLANA,BASE}_ADDRESS` + new defaults | grep-test | `grep -E "FEE_COLLECTION_(SOLANA\|BASE)_ADDRESS" apps/api/env.example` | ❌ W5 | ⬜ pending |
| TBD | TBD | 5 | FEE-08 | — | No `agents.memeputer.com` in `charge-platform-fee.ts` / `config.ts#platformFee` | negative grep | `! grep "agents.memeputer.com" apps/api/src/inngest/utils/charge-platform-fee.ts apps/api/src/config.ts` | ❌ W5 | ⬜ pending |
| TBD | TBD | 4 | FEE-09 | — | Refund flow works against runs whose fee was paid via new endpoint snapshot | integration (Vitest) | `pnpm --filter x402-jobs-api test src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` | ❌ W4 | ⬜ pending |
| TBD | TBD | 3 | FEE-10 | — | In-flight run with old snapshot routes to OLD URL with OLD percentage | unit (mocked `executeX402Request`) | `pnpm --filter x402-jobs-api test src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts` | ❌ W3 | ⬜ pending |
| TBD | TBD | 5 | OPS-01 | — | CHANGELOG.md v3.1 entry exists with both wallet addresses + explorer links | grep-test | `grep -E "FEE_COLLECTION_(SOLANA\|BASE)_ADDRESS" CHANGELOG.md && grep -E "solscan\\.io\|basescan\\.org" CHANGELOG.md` | ❌ W5 | ⬜ pending |
| TBD | TBD | 5 | OPS-02 | — | env.example has deprecated `PLATFORM_FEE_URL` comment and new defaults | grep-test | `grep "DEPRECATED v3.1" apps/api/env.example` | ❌ W5 | ⬜ pending |
| TBD | TBD | — | OPS-04 | — | No backward-compat shim / dual-path code added | manual code review | `! grep -E "shim\|backwardCompat\|legacyFee" apps/api/src/inngest/utils/charge-platform-fee.ts` | manual review | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Task IDs are filled in by the planner during PLAN.md generation. This file is the validation contract; the planner ensures each task ID lands a row above (or a Wave 0 dependency below).

---

## Wave 0 Requirements

Existing test infrastructure (Vitest, mocks, fixtures, `FACILITATOR_URL` pre-set) is **sufficient**. No framework install needed.

New test files the plan must create (counted as Wave 0 for their respective requirements):

- [ ] `apps/api/src/routes/__tests__/x402-fees.test.ts` — covers FEE-01..04 (Wave 2)
- [ ] `apps/api/src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` — covers FEE-09 (Wave 4)
- [ ] `apps/api/src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts` — covers FEE-10 (Wave 3)
- [ ] (optional) `apps/api/src/inngest/utils/__tests__/platform-fee-snapshot.test.ts` — covers the `buildPlatformFeeSnapshot()` helper

No new shared fixtures needed; per-test mocks suffice.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fee-collection wallet is cold-storage or multisig (not an operational hot wallet) | FEE-06 | Wallet provisioning is an operator-side task; no programmatic check can confirm "cold storage" off-chain | Operator provisions wallets out-of-band, populates `FEE_COLLECTION_SOLANA_ADDRESS` / `FEE_COLLECTION_BASE_ADDRESS` env vars in Railway; reviewer inspects Solscan/Basescan to confirm address is fresh + balance starts at 0; record in STATE.md manual tasks |
| Real x402lint validation against a captured 402 response | FEE-03 (belt + suspenders) | Unit fixture compares against a hand-built reference; running `npx x402lint` on a live response catches edge cases the fixture missed | Start dev server (`pnpm dev:api`), `curl http://localhost:3011/x402/fees/solana/charge?amount=0.01 > /tmp/402.json`, `npx x402lint /tmp/402.json`; repeat for `/base/`. Capture output in plan-checker review or PR description |
| No backward-compat shim added | OPS-04 | Manual code-review pattern; grep is a hint, not a proof | Reviewer reads `charge-platform-fee.ts`, `routes/x402-fees.ts`, and `config.ts#platformFee` end-to-end to confirm no dual-path / legacy URL fallback logic was introduced |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (filled in once PLAN.md exists)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in test commands
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
