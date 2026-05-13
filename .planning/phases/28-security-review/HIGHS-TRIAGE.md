---
phase: 28-security-review
scope: 13 HIGH findings from REVIEW.md
status: triage
created: 2026-05-12
purpose: Batch the 13 Highs into PR-sized clusters with recommended order so we can ship them efficiently after CRIT-07 (PR #29) merges.
---

# Phase 28 — HIGH Triage

## Where we are

All 7 Criticals are remediated (CRIT-07 in flight as PR #29). The remaining backlog from `REVIEW.md` is 13 HIGH-severity findings. They cluster naturally by theme, which lets us ship roughly **7 PRs** instead of 13.

This document is **planning only**. No code changes proposed here — only the batching and the order.

## Batches

### Batch A: "Trivial wins" — bundle into one PR

Three independent one-or-two-line fixes that don't need their own PR overhead. All are isolated, all have tests easy to add inline, all are zero-risk to ship together.

| Finding | File | Fix |
|---|---|---|
| **HIGH-04** | `routes/upload.ts:74-110, 158-220, 282-340` | Stop reading `userId` from request body; always use `req.user!.id`. Cross-user file planting prevention. |
| **HIGH-06** | `routes/escrow.ts:72-80, 95-100` | `===` → `crypto.timingSafeEqual` with length pre-check on `webhook_secret`. |
| **HIGH-12** | `routes/runs.ts:312-405`, `routes/wallet.ts:289-371` | Truncate/hash `payer_address` and `payment_signature` in public response shapes. |

**Why bundle:** all trivial, no shared files, but conceptually the "obvious one-liners we shouldn't ship to public-release without". Single PR keeps reviewer overhead low.
**Effort:** ~1-2 hours total.
**Risk:** Low. HIGH-12 has a small API-shape change — confirm no frontend code depends on full payer addresses.

### Batch B: "Log/secret hygiene" — single PR

| Finding | File | Fix |
|---|---|---|
| **HIGH-01** | `inngest/utils/execute-x402.ts:343-346, 374-378, 614-621`, `routes/execute.ts:343-346, 658-666` | Delete `console.log` of full payment payloads (signed Solana txns + EIP-3009 auths). Keep only metadata (signature hash, network, amount). |

Could fold into Batch A if we want a single hygiene PR. My instinct: keep separate because it's a different file set and a different reviewer concern (log retention vs. auth).
**Effort:** Trivial.
**Risk:** None — pure deletion.

### Batch C: "Solana payment verification" — single PR

| Finding | File | Fix |
|---|---|---|
| **HIGH-07** | `routes/webhooks.ts:218-311` | Add recipient validation — compare `info.destination` to recipient ATA. Resolve the existing `// TODO: Add recipient validation`. |
| **HIGH-10** | `routes/webhooks.ts:274-294` | Reject legacy `parsed.type === "transfer"` without explicit mint check; only accept `transferChecked` with USDC mint match. |

**Why bundle:** same function (`verifySolanaPayment`), interlocking logic. Doing them separately would mean touching the same lines twice.
**Effort:** Small.
**Risk:** Medium-low. Need a couple of integration tests against real Solana txn fixtures (or carefully crafted parsed-tx mocks) to confirm we don't break legitimate USDC transfers. The function is on a hot path (every Solana payment verification).

### Batch D: "Money math precision" — single PR (or fold into a CRIT-04 follow-up)

| Finding | File | Fix |
|---|---|---|
| **HIGH-08** | `routes/webhooks.ts:404, 627, 1120, 1569, 1849`, `routes/instant.ts:250, 369` | `String(expectedAmount * 1_000_000)` → `String(Math.round(expectedAmount * 1_000_000))` at minimum; ideally introduce a `Usdc` bigint type and propagate. |

**Status to confirm before starting:** CRIT-04 was the "USDC float math + no upper bound" Critical and may have already introduced bigint atomic-unit money types. If so, HIGH-08 is partially or fully resolved already — verify against `lib/usdc-transfer.ts` post-merge before doing redundant work.
**Effort:** Small if just the `Math.round` fix; Medium if we do the bigint migration properly.
**Risk:** Low.

### Batch E: "Run-status URL signing" — single PR

| Finding | File | Fix |
|---|---|---|
| **HIGH-09** | `routes/webhooks.ts:1279-1444, 2227-2365` | HMAC-sign the `statusUrl` returned in 202 responses (or require the original `X-PAYMENT` signature as a viewing token). Public run-status endpoints currently leak paid output + step errors to anyone with the high-entropy URL. |

**Why standalone:** introduces a new signing scheme, needs corresponding frontend changes to include the signature when polling.
**Effort:** Medium.
**Risk:** Medium. **Frontend coordination required** — the `apps/web` polling code that reads `/status` needs to thread the signature through. If we ship API-only first, polling breaks. Either bundle FE+BE in one cycle, or add a feature flag.

### Batch F: "Wallet export hardening" — single PR

| Finding | File | Fix |
|---|---|---|
| **HIGH-11** | `routes/wallet.ts:71-118` | Audit row per export to a new `x402_wallet_export_audit` table; out-of-band email confirmation; rate limit (`strictRateLimiter` per user); require recent re-auth (e.g., password re-prompt or fresh token within 5min). |

**Effort:** Small-Medium. Migration for audit table + email template + rate limit config + auth helper.
**Risk:** Low — additive guardrails on an existing endpoint.

### Batch G: "Account-deletion balance check" — single PR

| Finding | File | Fix |
|---|---|---|
| **HIGH-03** | `routes/user.ts:211-286` | Block deletion if wallet balance > $0.01; auto-sweep or require external withdrawal address; wrap in DB transaction; soft-delete with 30-day recovery window. |

**Effort:** Medium. Needs balance-fetch logic (already exists in `wallet.ts`), a transactional delete path, and probably a new `deleted_at` column for soft-delete.
**Risk:** Medium. Touches a destructive endpoint; needs careful testing. Soft-delete is an API contract change too (existing "deleted" users would need backfill or it stays new-only).

### Batch H: "Twitter OAuth hardening" — single PR (largest)

| Finding | File | Fix |
|---|---|---|
| **HIGH-02** | `routes/integrations.ts:225-342` | (a) add `state` nonce on init; (b) move `oauthRequests` from in-memory unbounded `Map` → Redis or `x402_oauth_pending` table with TTL; (c) encrypt `access_token`/`access_secret` at rest in `x402_user_x_tokens` using existing `encryptSecret` from `lib/instant/encrypt`; (d) verify state on callback. |

**Effort:** Medium-Large. Four sub-fixes, two of them schema-touching (new table + column encryption migration for existing tokens).
**Risk:** Medium. Existing connected accounts need a migration path — either re-encrypt existing tokens in a one-shot script or force re-auth.

### Batch I: "SSRF library migration" — single PR (lowest priority)

| Finding | File | Fix |
|---|---|---|
| **HIGH-13** | `lib/safe-fetch.ts` (delete), `routes/upload.ts`, `routes/images.ts`, `routes/instant.ts` | Migrate three call sites from `safeFetch` (native fetch wrapper) → `axios` + `request-filtering-agent`. Filters at *connect time*, closing the TOCTOU/DNS-rebinding window the custom wrapper leaves open. Removes 155 LOC of custom security code in favor of a maintained library. |

**Why last:** the CRIT-07 fix already closes the obvious attack paths (cloud metadata, RFC1918, loopback). HIGH-13 closes the residual DNS-rebinding window, which requires attacker DNS infra + timing. Lower urgency than the items above.
**Effort:** Small-Medium. axios response shape change (`.ok`/`.text()` → `.status`/`.data`) means the three handlers need their post-fetch code adjusted.
**Risk:** Low — strictly stronger than current behavior.

## Recommended order

The principle: ship trivial-fix PRs first to build merge momentum and clear the surface, then tackle the medium items in dependency order, leave the largest (Twitter OAuth) and the lowest-urgency (SSRF library swap) for last.

1. **Batch A** — three one-liners. Fastest possible win. (~half a day)
2. **Batch B** — log hygiene. Trivial.
3. **Batch C** — Solana payment validation. Most security-meaningful of the small items.
4. **Batch D** — money math (after verifying CRIT-04 didn't already solve it).
5. **Batch F** — wallet export hardening.
6. **Batch E** — run-status URL signing. Coordinate FE+BE.
7. **Batch G** — account-deletion balance check.
8. **Batch H** — Twitter OAuth. Largest, schema-touching.
9. **Batch I** — SSRF library migration. Defense-in-depth on already-mitigated surface.

If we want to be aggressive about parallelization: Batches A, B, C, D, F have no inter-dependencies and could be worked in any order or stacked branches. E and H both touch schema/contracts and are best done sequentially after the smaller items land.

## Pre-flight checks before starting

Before opening Batch A, confirm:

- [ ] PR #29 (CRIT-07) is merged to `main`.
- [ ] All Phase 28 Critical fixes are present in `main` (re-clone or `git pull` `x402jobs-api` and verify `lib/safe-fetch.ts`, hashed `api_keys.key_hash`, etc. are there).
- [ ] No in-flight branch in `x402jobs-api` (`git branch -a` shows main + maybe stale CRIT branches that should be deleted).
- [ ] `pnpm vitest run --exclude '**/resource-registration*'` passes at baseline (~274+ tests, exact number depending on what CRIT-04 added).

## Out of scope (still)

These remain UNFIXED on purpose pending separate decisions:

- 14 MEDIUM findings (`REVIEW.md` MEDIUM section).
- 7 LOW findings.
- 5 INFORMATIONAL items.
- The `resource-registration*.test.ts` typecheck failures (pre-existing test bugs, not security).

After all HIGHs are remediated, the next decision point is whether to remediate MEDs before BSL 1.1 release or document the acceptances in `SECURITY.md`.
