# Phase 28: Structured Security Review — HIGH Remediation - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/phases/28-security-review/HIGHS-TRIAGE.md`)

<domain>
## Phase Boundary

Remediate all open HIGH-severity findings from `28-security-review/REVIEW.md` (HIGH-01..04, 06..13 — 12 findings; HIGH-05 was covered under CRIT-02). The scope is the `x402jobs-api` codebase (path prefix `apps/api-audit-tmp/` in REVIEW.md = `~/Projects/x402jobs-api/` today; will become `apps/api/` after Phase 31 merge). Each finding is fixed in code with tests; each fix lands as a small focused PR; `REVIEW.md` is updated with FIXED/ACCEPTED status per finding. Out of scope: Medium/Low/Informational findings, dep-audit follow-up, and the SECURITY.md document itself (Phase 31 finalizes that).

</domain>

<decisions>
## Implementation Decisions

### Batching (LOCKED — from HIGHS-TRIAGE.md)

The 9 batches and their findings are fixed:

- **Batch A** — "Trivial wins" (bundle into one PR): HIGH-04 + HIGH-06 + HIGH-12
- **Batch B** — Log/secret hygiene: HIGH-01
- **Batch C** — Solana payment verification: HIGH-07 + HIGH-10
- **Batch D** — Money math precision: HIGH-08
- **Batch E** — Run-status URL signing: HIGH-09
- **Batch F** — Wallet export hardening: HIGH-11
- **Batch G** — Account-deletion balance check: HIGH-03
- **Batch H** — Twitter OAuth hardening: HIGH-02
- **Batch I** — SSRF library migration: HIGH-13

Each batch corresponds to one PLAN.md. Do not split a single batch into multiple plans without strong justification; do not merge across batches.

### Recommended execution order (LOCKED)

A → B → C → D → F → E → G → H → I. Plans should be assigned to waves consistent with this order:
- Wave 1: Batches A, B, C, D, F (no inter-dependencies; can stack/parallelize)
- Wave 2: Batch E (requires frontend coordination; do after the trivial fixes ship)
- Wave 3: Batch G (touches destructive endpoint; schema-touching soft-delete)
- Wave 4: Batch H (largest; schema-touching OAuth migration)
- Wave 5: Batch I (lowest urgency; defense-in-depth on already-mitigated surface)

### Per-batch fix specifications (LOCKED — from REVIEW.md + HIGHS-TRIAGE.md)

#### Batch A — HIGH-04, HIGH-06, HIGH-12

- **HIGH-04** — `routes/upload.ts` (lines 74-110, 158-220, 282-340): stop reading `userId` from request body; always derive from `req.user!.id`. Add tests proving a cross-user `userId` in body cannot affect storage path or row ownership.
- **HIGH-06** — `routes/escrow.ts` (lines 72-80, 95-100): replace `providedSecret === expectedSecret` with `crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))` after a length pre-check. Make `webhook_secret` mandatory (no optional path). Add a timing-equality unit test.
- **HIGH-12** — `routes/runs.ts` (lines 312-405) and `routes/wallet.ts` (lines 289-371): redact `payer_address` (truncate to first 6 + last 4) and hash `payment_signature` (SHA-256 first 16 chars) in public response shapes. Internal/admin shapes keep full values. Confirm no frontend depends on full values before shipping; if it does, expose hashed lookup helper.

#### Batch B — HIGH-01

- `inngest/utils/execute-x402.ts` (lines 343-346, 374-378, 614-621) and `routes/execute.ts` (lines 343-346, 658-666): delete `console.log` of full signed Solana txns and EIP-3009 auths. Retain a structured metadata log: `{ network, amount_atomic, payer_redacted, signature_hash, route }`. Add a grep test in CI that fails on `console.log(.*x_payment|console.log(.*authorization` in those files.

#### Batch C — HIGH-07, HIGH-10

- `routes/webhooks.ts` (lines 218-311, function `verifySolanaPayment`):
  - **HIGH-07**: change signature from `_recipientWallet: string` → `recipientWallet: string`; resolve the `// TODO: Add recipient validation`. Derive the recipient's USDC ATA (Associated Token Account) via `getAssociatedTokenAddress(USDC_MINT, recipientWalletPubkey)` and require `info.destination === recipientAta`.
  - **HIGH-10**: reject `parsed.type === "transfer"` outright unless the call site can prove the mint context. Only accept `parsed.type === "transferChecked"` AND `info.mint === USDC_MINT_ADDRESS`. The legacy `transfer` branch must throw or skip the instruction (do not infer mint).
- Add integration tests against canned `parsed-tx` JSON fixtures: (a) `transferChecked` with USDC + correct ATA = valid; (b) `transferChecked` with USDC + wrong ATA = invalid; (c) `transferChecked` with wrong mint = invalid; (d) legacy `transfer` = invalid.

#### Batch D — HIGH-08

- Pre-flight: re-read `lib/usdc-transfer.ts` after CRIT-04 fix to determine if a `Usdc` bigint type was introduced. If yes, propagate it through `routes/webhooks.ts` (lines 404, 627, 1120, 1569, 1849) and `routes/instant.ts` (lines 250, 369) — replace `String(expectedAmount * 1_000_000)` with `Usdc.fromDollars(expectedAmount).toAtomicString()` (or whatever the type's API is).
- If CRIT-04 did **not** introduce a bigint type: minimum fix is `String(Math.round(expectedAmount * 1_000_000))` at all 7 call sites. File a follow-up issue for the bigint migration.
- Add a unit test asserting `expectedAmount = 0.1` produces `"100000"` (not `"99999.99999999999"`).

#### Batch E — HIGH-09

- `routes/webhooks.ts` (lines 1279-1444, 2227-2365): HMAC-sign the `statusUrl` returned in 202 responses. Format: `${baseUrl}/status/{runId}?sig=${hmacSha256(WEBHOOK_SIGNING_SECRET, runId+'.'+expiresAt)}&exp=${expiresAt}`. Reject status reads with missing/invalid signature.
- Two-step rollout: (a) API accepts both signed and unsigned URLs for one deploy cycle (transition period); (b) require signature once frontend ships.
- **Frontend coordination required** — `apps/web` polling code must thread `sig` and `exp` query params through. Plan should include the frontend file paths to update (`apps/web/src/hooks/useRunStatus.ts` or equivalent — locate via grep during execute).
- Document the new signature scheme in the SDK design (Phase 32) but do not block on it.

#### Batch F — HIGH-11

- `routes/wallet.ts` (lines 71-118, `POST /wallet/export-key`):
  - New migration: `x402_wallet_export_audit` table with columns `id (uuid pk)`, `user_id (fk)`, `exported_at (timestamptz)`, `ip (text)`, `user_agent (text)`, `wallet_network ('base'|'solana')`.
  - Insert one row per export attempt (successful or not).
  - Mount `strictRateLimiter` (per-user, 3 exports per hour).
  - Require re-auth: client sends a fresh JWT minted within the last 5 minutes (or a password re-prompt token). Reject with 401 otherwise.
  - Send an out-of-band email to the user's verified email on every successful export (template: "your wallet key was exported at {ts} from {ip}").
- Tests: rate-limit triggers at 4th request; missing fresh-auth returns 401; audit row inserted; email send queued.

#### Batch G — HIGH-03

- `routes/user.ts` (lines 211-286, `DELETE /user/me` or equivalent):
  - Block deletion if combined wallet balance (Base USDC + Solana USDC) > $0.01. Use existing balance-fetch helpers from `routes/wallet.ts` (do not duplicate).
  - Offer two paths in the error response: (a) external withdrawal address (user provides), (b) auto-sweep to a developer-provided withdrawal wallet stored on the user record.
  - Wrap the entire delete in a single DB transaction. Roll back if any step fails.
  - Soft-delete: add `deleted_at (timestamptz)` column to `users` table; on delete, set `deleted_at = now()` instead of `DELETE`. Hard-delete after 30 days via scheduled Inngest job.
  - All other routes must filter `WHERE deleted_at IS NULL` (audit and add to RLS policies / route guards).
- Tests: deletion with balance > $0.01 returns 409; with balance ≤ $0.01 sets `deleted_at`; subsequent reads exclude soft-deleted user; 30-day cleanup job hard-deletes.

#### Batch H — HIGH-02

- `routes/integrations.ts` (lines 225-342, Twitter OAuth flow):
  - Add `state` nonce on init: generate `crypto.randomBytes(32).toString('base64url')`, store in `x402_oauth_pending` table with TTL 10 minutes (or Redis equivalent if Redis is already a project dependency — verify before introducing).
  - Move `oauthRequests` Map → `x402_oauth_pending` table (or Redis with `EX 600`). The Map is process-local and unbounded today.
  - On callback: verify `state` against the stored value; reject if missing/expired/mismatched.
  - Encrypt `access_token` and `access_secret` at rest in `x402_user_x_tokens` using existing `encryptSecret` helper from `lib/instant/encrypt.ts`. Migration: re-encrypt existing tokens via a one-shot script (read-decrypt-fail-safe-encrypt-write).
- New migration files for `x402_oauth_pending` and column type changes on `x402_user_x_tokens` (or sibling ciphertext columns + drop plaintext after migration succeeds, mirroring the Phase 27 pattern).
- Tests: OAuth init returns `state`; callback without state → 400; callback with mismatched state → 400; expired state → 400; tokens encrypted at rest (DB read shows ciphertext, decrypt round-trips).

#### Batch I — HIGH-13

- Migrate three call sites from `safeFetch` to `axios` + `request-filtering-agent`:
  - `routes/upload.ts` (image proxy fetch)
  - `routes/images.ts` (image fetch)
  - `routes/instant.ts` (Claude/OpenRouter metadata fetch — coordinate with Phase 29 changes)
- Delete `lib/safe-fetch.ts` (155 LOC removed).
- Wire `request-filtering-agent` with `{ allowPrivateIPAddress: false, allowLoopbackAddress: false }`.
- axios response shape differs: replace `response.ok` → `response.status >= 200 && response.status < 300`; replace `response.text()` → `response.data` (string for text responses).
- Add a test that DNS-rebinding to RFC1918 fails at connect time (use a mock DNS resolver returning 169.254.169.254 first call then 1.1.1.1).

### Testing decisions (LOCKED)

- Every plan adds at least one test per finding fixed.
- Baseline test command: `pnpm vitest run --exclude '**/resource-registration*'` (pre-existing exclusion; do not remove without separate investigation).
- Tests run on every plan's verification step; baseline test count must not regress.
- Each plan's `must_haves` includes "REVIEW.md updated with FIXED status for the finding(s) covered."

### PR strategy (LOCKED)

- Each plan = one PR in `rawgroundbeef/x402-jobs-api` (until Phase 31 merge unifies repos; from that point, PRs target the monorepo `apps/api/` paths).
- PR titles follow conventional commits: `fix(security): HIGH-XX — <one-line summary>`.
- PR body links the REVIEW.md finding and includes "Covers HIGH-XX from Phase 28 review."

### Claude's Discretion

- Exact test file locations (mirror existing `__tests__/` colocation pattern).
- Migration filename numbering (continue from 006 or whichever is highest after Phase 27).
- Whether to use Redis vs. a Postgres table for `x402_oauth_pending` (HIGH-02) — verify if Redis is already a dependency; if not, use a Postgres table to avoid introducing a new infra component just for this.
- Whether to introduce a `Usdc` bigint type now (HIGH-08) or do the minimum `Math.round` fix and file a follow-up — depends on CRIT-04 state.
- Wave assignment within Wave 1 (Batches A/B/C/D/F): all are parallelizable; planner may stack them in any order so executor can ship in parallel.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 28 source documents
- `.planning/phases/28-security-review/REVIEW.md` — full review with exploit details, fix guidance, and line numbers for every HIGH-XX finding
- `.planning/phases/28-security-review/HIGHS-TRIAGE.md` — batching, recommended order, effort/risk per batch
- `.planning/phases/28-security-review/CRIT-07-RESUMPTION.md` — context on the just-shipped SSRF Critical fix (informs Batch I scope)
- `.planning/phases/28-security-review/dep-audit.md` — pnpm audit results (out of scope here; reference only)

### Milestone context
- `.planning/v3.0-MILESTONE-SCOPE.md` — v3.0 milestone scope, honest limitations to document in SECURITY.md (Phase 31)
- `.planning/STATE.md` — current state, prior decisions log, architecture summary
- `.planning/ROADMAP.md` (Phase 28 section) — phase goal, plan list, requirement IDs

### Target codebase
- `~/Projects/x402jobs-api/` — the actual API codebase being modified. REVIEW.md uses path prefix `apps/api-audit-tmp/` (the audit copy at commit `6d002c1`); translate to `~/Projects/x402jobs-api/` for execution. After Phase 31 merge, these become `apps/api/` in the monorepo.

### Existing security primitives (reuse, do not rebuild)
- `lib/instant/encrypt.ts` — `encryptSecret` / `decryptSecret` (AES-256-GCM, used in Phase 27 for wallet keys; reuse for HIGH-02 token encryption)
- `middleware/auth.ts` — `authMiddleware`, `req.user!.id` (HIGH-04 fix uses this)
- `crypto.timingSafeEqual` — Node built-in (HIGH-06)
- `strictRateLimiter` (existing middleware — locate during planning) (HIGH-11)

</canonical_refs>

<specifics>
## Specific Ideas

- HIGH-02 token migration: mirror the Phase 27 pattern (ciphertext columns added in parallel, plaintext columns dropped after dual-write validation). Do **not** drop plaintext in the same migration as ciphertext add.
- HIGH-09 signing: prefer `crypto.createHmac('sha256', secret).update(data).digest('hex')` — no need for a JWT library here. The signature scheme is internal-only (we sign, we verify).
- HIGH-07 USDC mint constants: USDC mainnet mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`; USDC devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Network selection must match the resource's network, not be hardcoded.
- Batch I post-fetch shape changes: `axios` returns `response.data` parsed (JSON → object, text → string based on `responseType`); explicitly set `responseType: 'text'` for the image-proxy paths or the post-fetch code will break on non-JSON content.

## Pre-flight checks (from HIGHS-TRIAGE.md, must hold before any batch starts)

- [x] PR #29 (CRIT-07) is merged to `main`. _(Confirm during execute, not at plan time.)_
- [x] All Phase 28 Critical fixes are present in `main`. _(Confirm during execute via `git pull` + grep for `lib/safe-fetch.ts` and `api_keys.key_hash`.)_
- [ ] No in-flight branch in `x402jobs-api` (`git branch -a` clean of stale CRIT branches).
- [ ] `pnpm vitest run --exclude '**/resource-registration*'` passes at baseline (~274+ tests).

Each plan's first task should be a `[BLOCKING]` "pre-flight check" verifying these still hold for that batch.

</specifics>

<deferred>
## Deferred Ideas

- 14 MEDIUM findings, 7 LOW findings, 5 INFORMATIONAL items from `REVIEW.md` — file as GitHub issues with `milestone: v3.1` after all HIGHs land.
- `resource-registration*.test.ts` typecheck failures (pre-existing test bugs, not security).
- Third-party security audit (Trail of Bits / Spearbit) — pre-revenue, deferred to post-revenue per v3.0 milestone doc.
- `SECURITY.md` content (responsible disclosure policy, bug bounty terms, honest-limitations section) — Phase 31 finalizes this; Phase 28 only updates `REVIEW.md` with FIXED/ACCEPTED status per HIGH.
- `Usdc` bigint type propagation across the codebase if HIGH-08 lands with the minimum `Math.round` fix — file as follow-up for v3.1.

</deferred>

---

*Phase: 28-security-review*
*Context gathered: 2026-05-13 via PRD Express Path*
