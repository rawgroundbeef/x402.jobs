---
phase: 28-security-review
reviewer: gsd-code-reviewer
created: 2026-05-12
target_codebase: x402jobs-api @ 6d002c1
status: complete
findings:
  critical: 7
  high: 13
  medium: 14
  low: 7
  informational: 5
---

# Security Review — x402jobs API (Phase 28)

**Target:** `apps/api-audit-tmp/` (= `~/Projects/x402jobs-api/`) @ `6d002c1`
**Reviewer:** Claude (gsd-code-reviewer)
**Date:** 2026-05-12
**Depth:** Deep, single-pass adversarial
**Note:** Paths use `apps/api-audit-tmp/...` (the temp copy used for the audit). After the Phase 30 merge, find/replace to `apps/api/...`.

## Executive Summary

The x402.jobs API has a substantial first-party attack surface that needs hardening before BSL 1.1 public release. Highlights:

- An authenticated user can achieve **remote code execution** in the API process via a workflow `code` transform (`new Function(input, code)` runs server-side under Inngest with full env access, including `WALLET_ENCRYPTION_SECRET`, all Supabase service-role keys, and fee-collection wallet keys).
- `/api/webhooks/honeypot-payout` accepts a **plaintext base64 Solana private key** in the request body and treats the webhook secret as optional. Combined with non-constant-time comparison, this is an open drain hole.
- Public API keys are stored as **plaintext** in `api_keys.key` and looked up via equality — a DB-read compromise becomes a key-of-everyone compromise.
- The Helius webhook secret and escrow webhook secret are **optional in practice** AND **compared non-constant-time**; both endpoints control writes to financial data (transaction ledgers / escrow drains).
- Multiple `upload/*` endpoints accept `userId` from the **request body** without binding to the authenticated user — cross-user file planting.
- `transferUsdcFromFeeWallet` uses **floating-point USDC math** with no upper bound; combined with a single hardcoded admin email controlling refund approvals (`ben@memeputer.com`), one mailbox takeover ≈ fee wallet drain.

Every Critical and High in this report should be fixed (or explicitly accepted in `SECURITY.md`) before publishing the repo.

---

## CRITICAL

### CRIT-01: Authenticated RCE via workflow `code` transform

**File:** `apps/api-audit-tmp/src/inngest/workflow/utils.ts:155-168`, `apps/api-audit-tmp/src/inngest/workflow/TransformExecutor.ts:145-150`

`executeCode` calls `new Function("input", code)` on `transform.config.code`, which is supplied verbatim from `workflow_definition.nodes[].data.config.code` saved via `PUT /jobs/:id`. At workflow execution time, arbitrary JS runs in-process with full access to `process.env` (every secret: `WALLET_ENCRYPTION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `FEE_COLLECTION_PRIVATE_KEY`, `ESCROWPUTER_WALLET_SECRET_KEY`, `BASE_PLATFORM_WALLET_PRIVATE_KEY`, `ADMIN_TOKEN`, etc.), the service-role Supabase client, and the running user's decrypted wallet secrets.

**Exploit:** Auth → `POST /api/jobs` with `{ transformType: "code", config: { code: "return JSON.stringify(process.env);" } }` → `POST /api/runs` → exfiltrate via run output (stored in `x402_job_run_events.output`). Full server compromise — the leaked encryption secret affects every user's wallet.

**Fix:** Delete the `code` transform type for v3.0 (only `extract`, `template`, `combine` are needed), OR sandbox via `isolated-vm` in a separate worker process with no env access.
**Effort:** Medium.

### CRIT-02: Honeypot payout — plaintext private key in body + optional auth

**File:** `apps/api-audit-tmp/src/routes/honeypot.ts:17, 44-48, 84-85`

`POST /api/webhooks/honeypot-payout` takes `potWalletEncryptedKey` (misnamed — it's plaintext base64) and signs+broadcasts a transfer. Auth check is `if (HONEYPOT_WEBHOOK_SECRET && secret !== HONEYPOT_WEBHOOK_SECRET)` — if env var is unset/empty, the endpoint is fully open. Comparison is non-constant-time.

**Exploit:** Operator deploys without setting `HONEYPOT_WEBHOOK_SECRET` (default in code is `""`) → attacker POSTs `{ winnerAddress: <attacker>, amountUsdc: <pot>, potWalletEncryptedKey: <leaked> }` and drains.

**Fix:** Boot guard for the env var; store the pot key encrypted server-side (load by gameId, never accept in body); `crypto.timingSafeEqual` for secret check; server-side amount validation against `pot_balance_usdc`.
**Effort:** Medium.

### CRIT-03: API keys stored plaintext + looked up by equality

**File:** `apps/api-audit-tmp/src/routes/api-keys.ts:68-93`, `apps/api-audit-tmp/src/middleware/apiKey.ts:59-71`

`api_keys.key` is stored verbatim; `apiKeyMiddleware` does `.eq("key", providedKey)`. Any DB-read compromise (Supabase support incident, backup leak, logging misroute) hands over every API key.

**Fix:** Add `key_hash` column (SHA-256 of the key), store/lookup by hash, show key once on create. Optionally store `prefix` (first 8 chars) for UI. Migrate by backfill + drop `key` column.
**Effort:** Medium.

### CRIT-04: USDC float math in `transferUsdcFromFeeWallet` + no upper bound

**File:** `apps/api-audit-tmp/src/lib/usdc-transfer.ts:117-190`

`Math.round(amountUsdc * 1_000_000)` uses JS floats and has no per-transfer / per-day cap. Combined with the single hardcoded admin email (MED-14), one mailbox compromise drains the fee wallet.

**Fix:** Switch to `bigint` atomic-unit math end-to-end; add explicit per-call cap (e.g., $1000) and daily cumulative cap.
**Effort:** Medium.

### CRIT-05: `JWT_SECRET` defaults to `"dev-secret"`

**File:** `apps/api-audit-tmp/src/config.ts:45-47`

`jwt: { secret: process.env.JWT_SECRET || "dev-secret" }`. Currently unused but ships in the public repo. If any future PR (e.g., the Phase 32 agent SDK plan) wires up JWT signing without overriding the env, the default silently activates → trivially forgeable tokens in prod.

**Fix:** Delete the `jwt` block, or fail-fast at boot if env unset.
**Effort:** Trivial.

### CRIT-06: Helius indexer trusts unauthenticated webhook by default

**File:** `apps/api-audit-tmp/src/routes/webhooks.ts:2175-2207`, `apps/api-audit-tmp/src/indexers/helius.ts:118-240`

`HELIUS_WEBHOOK_SECRET` is optional. When set, comparison is `authHeader !== expectedAuth` (non-constant-time). Endpoint writes to `x402_transactions` and increments `x402_servers.total_earned_usdc` via RPC — these back creator earnings dashboards, leaderboards, and the $JOBS rewards distribution.

**Exploit:** Without secret set → forge inbound transfers to any server's `pay_to` to manipulate leaderboard and rewards. With secret set → timing-side-channel extraction is theoretically feasible.

**Fix:** Boot guard; `timingSafeEqual`; re-fetch each `signature` from a Solana RPC and verify the transfer before persisting.
**Effort:** Medium.

### CRIT-07: `upload/from-url` is SSRF (no internal-IP block)

**File:** `apps/api-audit-tmp/src/routes/upload.ts:157-222`; same flaw in `apps/api-audit-tmp/src/routes/images.ts:31-130` and `apps/api-audit-tmp/src/routes/instant.ts:781-857` (instant proxy resources)

`fetch(imageUrl)` with no allow/deny list — `169.254.169.254` (cloud metadata), `127.0.0.1`, `10.x`, `192.168.x`, `[::1]` all reachable. Content-type check is bypassable via attacker-controlled redirect chain.

**Fix:** Build a shared IP-block helper (`ipaddr.js` or `private-ip`), resolve host → IP → reject RFC1918/loopback/link-local/ULA, disable redirects or follow only if each hop passes the check. Apply to all 3 fetch sites.
**Effort:** Medium.

---

## HIGH

### HIGH-01: Full payment payloads logged to stdout (signed Solana txn + EIP-3009 auth)

`apps/api-audit-tmp/src/inngest/utils/execute-x402.ts:343-346, 374-378, 614-621`, `apps/api-audit-tmp/src/routes/execute.ts:343-346, 658-666` — log aggregator / Sentry / Railway logs become a replay-attack supply. Replay window is 1 hour for Base; immediate for Solana.
**Fix:** Delete the dumps, keep only metadata. **Effort:** Trivial.

### HIGH-02: Twitter OAuth — in-memory unbounded Map, no CSRF state, plaintext stored tokens

`apps/api-audit-tmp/src/routes/integrations.ts:225-342` — `oauthRequests = new Map()` never swept; no `state` param; callback is unauthenticated; `access_token`/`access_secret` stored unencrypted in `x402_user_x_tokens`. Account hijack vector + memory leak.
**Fix:** Add `state` nonce, move pending store to Redis/DB with TTL, encrypt tokens at rest (use existing `encryptSecret` from `lib/instant/encrypt`). **Effort:** Medium.

### HIGH-03: Account deletion permanently destroys custodial wallet balances

`apps/api-audit-tmp/src/routes/user.ts:211-286` — no balance check before deleting `x402_user_wallets`. User loses access to any USDC/SOL in their custodial wallet forever. Predictable support-ticket / "x402.jobs stole my money" tweet pattern.
**Fix:** Block deletion if balance > $0.01; auto-sweep or require external address; wrap in DB transaction; soft-delete with 30-day recovery window. **Effort:** Medium.

### HIGH-04: `upload/*` accepts `userId` from request body — cross-user file planting

`apps/api-audit-tmp/src/routes/upload.ts:74-110, 158-220, 282-340` — `const { userId } = req.body; ... generateFilePath(uploadType, fileName, fileType, userId || req.user?.id)`. Body wins over authenticated user.
**Fix:** Always use `req.user!.id`; never read `userId` from body. **Effort:** Trivial.

### HIGH-05: Honeypot signature non-constant-time

Covered under CRIT-02. Listed separately for the inventory.

### HIGH-06: Escrow webhook secret — direct equality + optional

`apps/api-audit-tmp/src/routes/escrow.ts:72-80, 95-100` — `providedSecret === expectedSecret`. Endpoint signs and broadcasts USDC transfers from the Escrowputer wallet. Timing-extraction of the secret = full escrow drain.
**Fix:** `crypto.timingSafeEqual` with length pre-check. **Effort:** Trivial.

### HIGH-07: Solana payment verification doesn't check recipient (TODO left in code)

`apps/api-audit-tmp/src/routes/webhooks.ts:218-311` — `_recipientWallet: string, // TODO: Add recipient validation`. Function sums any USDC transfer in the tx and returns `valid` if amount matches. Only the facilitator's signed-transaction structure prevents abuse today; a compromised facilitator could reroute.
**Fix:** Compare `info.destination` to the recipient's ATA; reject non-USDC mints in the `transfer` branch. **Effort:** Small.

### HIGH-08: `maxAmountRequired = String(expectedAmount * 1_000_000)` — produces decimal strings

`apps/api-audit-tmp/src/routes/webhooks.ts:404, 627, 1120, 1569, 1849`, `apps/api-audit-tmp/src/routes/instant.ts:250, 369` — fractional creator markups produce strings like `"123456.789"` which break facilitator BigInt parsing.
**Fix:** `String(Math.round(expectedAmount * 1_000_000))` and ideally migrate to BigInt-aware money types. **Effort:** Small.

### HIGH-09: Public run-status endpoint leaks completed-job output + step errors

`apps/api-audit-tmp/src/routes/webhooks.ts:1279-1444, 2227-2365` — `GET /api/webhooks/:jobId/runs/:runId/status` and `GET /@:username/:slug/runs/:runId/status` are unauthenticated. UUID is high-entropy but leaks via `Referer`, share links, and the 202 response. Anyone with the URL can read the paid output without paying.
**Fix:** HMAC-sign the statusUrl or require the original `X-PAYMENT` signature as a viewing token. **Effort:** Medium.

### HIGH-10: `verifySolanaPayment` accepts legacy `transfer` instructions without mint check

`apps/api-audit-tmp/src/routes/webhooks.ts:274-294` — compounds HIGH-07.
**Fix:** Reject `parsed.type === "transfer"`, only accept `transferChecked` with explicit USDC mint match. **Effort:** Small.

### HIGH-11: `/wallet/export-key` has no rate limit, no email confirmation, no audit log

`apps/api-audit-tmp/src/routes/wallet.ts:71-118` — bearer token + immediate full-private-key download. Any token leak (XSS, browser extension, leaked Referer) = wallet drain.
**Fix:** Audit row per export; out-of-band email; rate limit; require recent re-auth. **Effort:** Small-medium.

### HIGH-12: `payer_address` and `payment_signature` returned through public-facing run endpoints

`apps/api-audit-tmp/src/routes/runs.ts:312-405`, `apps/api-audit-tmp/src/routes/wallet.ts:289-371` — deanonymizes platform users vs. on-chain pseudonymity. Worse posture for the open-source release.
**Fix:** Truncate/hash payer addresses in public responses. **Effort:** Small.

### HIGH-13: Replace custom `safeFetch` with battle-tested SSRF library (close TOCTOU / DNS rebinding)

**File:** `apps/api-audit-tmp/src/lib/safe-fetch.ts` (introduced by the CRIT-07 fix in PR #29). Call sites: `routes/upload.ts`, `routes/images.ts`, `routes/instant.ts:executeProxy`.

The CRIT-07 remediation added a custom wrapper that does `dns.lookup({ all: true })` and rejects private IPs upfront before calling native `fetch`. This closes the obvious attack paths (cloud metadata, RFC1918, loopback, link-local) but leaves a **TOCTOU / DNS rebinding** window between lookup and the actual TCP connect — an attacker who controls DNS can return a public IP at lookup time and a private IP at connect time. The wrapper is also unaudited beyond our 25 unit tests, which is the kind of security primitive future readers tend to trust without re-verifying.

**Exploit (theoretical):** Attacker registers `rebind.example.com` with a 1s TTL; first response `1.1.1.1` (passes our check), second response `169.254.169.254` (what the actual `connect()` resolves to). For an authenticated attacker abusing `/upload/from-url` or a malicious creator publishing a proxy resource, the cost is low and the payoff (IAM credentials from cloud metadata) is high.

**Fix options:**
- Migrate the three call sites from native `fetch` → `axios` + `request-filtering-agent` (or `ssrf-req-filter`). These install as an `https.Agent` that filters at *connect time*, closing the TOCTOU gap. Battle-tested, many eyes.
- OR: adopt an undici `Dispatcher` with equivalent filtering (e.g., `undici-ssrf-agent`), keeping native fetch. Less mature ecosystem.

Either path removes `src/lib/safe-fetch.ts` and its test in favor of a maintained library.

**Effort:** Small-Medium. Three call sites. axios migration changes response surface (`.ok` → `.status`, `.text()`/`.json()` → `.data`), so the upload/images/instant handlers need their post-fetch code adjusted.

---

## MEDIUM

- **MED-01:** CORS `origin: true` with `credentials: true` reflects any origin in dev; operator misconfig in prod (`CORS_ORIGIN=*`) reflects credentialed CORS to attacker site. `config.ts:4-29`, `index.ts:69-84`. Reject `*` in production.
- **MED-02:** `POST /api/jobs/:id/transfer` (`routes/jobs.ts:1057-1180`) unilaterally moves ownership + future payouts; no recipient acceptance, no audit log, no email. Account-takeover amplifier.
- **MED-03:** Instant `proxy` resources (`routes/instant.ts:781-857`) — creator-controlled SSRF + `proxy_method = "PASS"` lets caller choose HTTP method. Apply IP-block from CRIT-07.
- **MED-04:** Free-resource execution stats are inflate-able via repeated unauthenticated calls (`routes/execute.ts:447-481`) — affects leaderboards and rewards. Rate-limit per (resource_id, user_id) or don't count free calls.
- **MED-05:** `release-escrow.ts:40-51` sends `webhook_secret` in JSON body — appears in Inngest dashboards, retry logs, error reports. Move to header; ideally HMAC-sign the body.
- **MED-06:** `url.searchParams.append(key, value)` in `execute-x402.ts:407-416` and `execute.ts:373-382` — keys not validated against bodyFields schema; workflow inputs can override existing query params on resource URL.
- **MED-07:** Same SSRF in `routes/images.ts:31-130` (`POST /api/images/cache`). Covered alongside CRIT-07.
- **MED-08:** `X-Owner-Test` bypass on `prompt_template` (`routes/instant.ts:540-601`) — token leak → unlimited free creator-paid LLM calls (Anthropic/OpenAI bill inflation). Rate-limit or require additional rotatable token.
- **MED-09:** Webhook `workflowInputs` not validated against the trigger's declared schema (`routes/webhooks.ts:1038-1041`) — extra fields pass through; missing-required is silently allowed. Use zod.
- **MED-10:** Pervasive `parseFloat` of `numeric` columns produces JS floats — drift potential with HIGH-08. Introduce a `Usdc` bigint type.
- **MED-11:** `chargePlatformFee` (`charge-platform-fee.ts:67-73`) and `ask-jobputer.ts` don't pass `expectedNetwork` — fee can route to wrong network if the resource lists Base first.
- **MED-12:** No CSRF tokens; safe today (bearer-only) but Phase 32 agent SDK might add cookie auth. Document and revisit.
- **MED-13:** Hardcoded `ADMIN_USER_ID = "4e4efff6-..."` in `routes/refunds.ts:9`. Move to env.
- **MED-14:** Hardcoded `ADMIN_EMAILS = ["ben@memeputer.com"]` in `routes/refunds-admin.ts:13` controls refund payouts. Combined with CRIT-04 (no payout cap), one email compromise = potentially the entire fee wallet.

---

## LOW

- **LOW-01:** EIP-3009 `validBefore = now + 3600` — generous replay window. Drop to 5min for routine payments. `execute-x402.ts:307`, `execute.ts:277`.
- **LOW-02:** `Math.random()` for slug entropy (`routes/jobs.ts:14-16`). Use `crypto.randomBytes`. Trivial.
- **LOW-03:** `GET /api/user/check-username/:username` allows username enumeration with no rate limit. Apply `publicRateLimiter`.
- **LOW-04:** `mapClaudeError` still leaks rate-limit vs. quota vs. context-length signal — competitive-intel leak. Return single generic message.
- **LOW-05:** `optionalAuthMiddleware` (`middleware/auth.ts:59-86`) silently swallows token errors. Log at warn level.
- **LOW-06:** Webhook bodies stored verbatim in `x402_job_runs.inputs._webhook.payload` (`webhooks.ts:843-859, 950-966, 2043-2059`) — PII / GDPR concern.
- **LOW-07:** `parseFloat("invalid") === NaN` propagation can cause silent NULL writes. Use `Number.isFinite(x) ? x : 0`.

---

## INFORMATIONAL

- **INFO-01:** Service-role Supabase client used globally (`lib/supabase.ts`). RLS bypassed everywhere — app-layer scoping is non-negotiable on every route. Document explicitly in `SECURITY.md` and check on every new route.
- **INFO-02:** `await import(...)` is used in `routes/jobs.ts:1314, 958` and similar — paths are literals (safe today), but never let string interpolation reach these.
- **INFO-03:** `express.json({ limit: "10mb" })` is global; consider per-route lower limits (100KB default) for non-upload routes.
- **INFO-04:** BigInt vs Number boundary at the Base contract layer (`Number(balance)`) — not realistic at user scale, but the platform fee wallet could eventually hit precision limits.
- **INFO-05:** Phase 30 merge: run `gitleaks` / `trufflehog` over `x402jobs-api`'s history before the squashed import lands public. Confirm `WALLET_ENCRYPTION_SECRET`, `FEE_COLLECTION_PRIVATE_KEY`, `ESCROWPUTER_WALLET_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` were never committed.

---

## Coverage Matrix vs. spec's high-risk surfaces

| Surface | Status | Findings |
|---|---|---|
| 1. Payment-signing paths | Fully reviewed | CRIT-01, CRIT-04, HIGH-01, HIGH-07, HIGH-08, HIGH-10, MED-06, MED-11, LOW-01 |
| 2. Auth and RLS bypass | Fully reviewed | CRIT-05, HIGH-04, MED-12, MED-13, MED-14, INFO-01 |
| 3. Webhook signature verification | Fully reviewed | CRIT-02, CRIT-06, HIGH-05, HIGH-06 |
| 4. Money math | Fully reviewed | CRIT-04, HIGH-08, MED-10, INFO-04 |
| 5. Secret leaks | Fully reviewed | HIGH-01, MED-05, INFO-05 |
| 6. Cross-user data leaks (IDOR) | Substantively reviewed | HIGH-04, HIGH-09, HIGH-12, MED-02 |
| 7. Input validation on public endpoints | Reviewed (instant, webhooks, public-api, honeypot) | CRIT-02, CRIT-07, HIGH-13, MED-03, MED-07, MED-09, INFO-03 |
| 8. Rate limiting | Reviewed | HIGH-11, MED-04, MED-08, LOW-03 |

Two findings outside the listed priorities: CRIT-01 (workflow RCE) and CRIT-03 (plaintext API keys).

---

## Limitations

1. **Single-pass adversarial.** Findings may compound or overlap; re-run after fixing CRIT/HIGH.
2. **Static-only.** Exploit scenarios were constructed by reading source; not demonstrated end-to-end.
3. **No DB schema review.** Supabase migrations not examined — RLS policies, numeric precision constraints, trigger logic may add/subtract attack surface.
4. **No on-chain protocol review** (per spec). EIP-3009 nonce semantics, Solana PDA hijacking, MEV grief, facilitator trust — out of scope.
5. **Frontend not in scope.** Token-leak paths via `apps/web` (XSS, CSP, localStorage) not covered. HIGH-11 and MED-12 assume the frontend doesn't leak.
6. **Some routes only skimmed** for surface area: full `routes/resources.ts` (3270 lines), `routes/hiring.ts` lines 400-810, `routes/servers.ts` (1180 lines), `routes/hackathons.ts`, `routes/rewards.ts` past line 200, `routes/stats.ts`, `inngest/functions/run-workflow/*` subdirectory, `lib/instant/*` encryption helpers, all test files. Spot-checks suggest no critical gaps in unreviewed routes, but the coverage isn't exhaustive.

---

## One-paragraph summary

The highest-severity findings are an authenticated workflow-driven RCE that exposes every server secret (CRIT-01), a honeypot payout endpoint that accepts plaintext keys with optional auth (CRIT-02), plaintext API key storage (CRIT-03), unbounded float-math USDC transfers controlled by a single hardcoded admin email (CRIT-04 + MED-14), and a fully optional Helius webhook secret that backs creator-earnings ledgers (CRIT-06). Counts: 7 Critical, 13 High, 14 Medium, 7 Low, 5 Informational. The CRIT and HIGH items should all be addressed (or explicitly accepted with rationale in `SECURITY.md`) before the BSL 1.1 public release in Phase 30.
