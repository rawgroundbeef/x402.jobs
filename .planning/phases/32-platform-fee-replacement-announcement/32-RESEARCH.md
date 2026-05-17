# Phase 32: Platform Fee Replacement - Research

**Researched:** 2026-05-17
**Domain:** x402 server-side fee endpoint (OpenFacilitator SDK + Supabase JSONB snapshot + Inngest workflow read-path rewire)
**Confidence:** HIGH

## Executive Summary

The planner needs five facts that don't show up in CONTEXT.md and one that contradicts CONTEXT.md:

1. **CONTEXT.md D-12 is INCOMPLETE.** Two additional production callsites read `config.platformFee.percentage` / `config.platformFee.minimumUsdc` (pricing math, not URL): `apps/api/src/routes/jobs.ts:131,289` and `apps/api/src/routes/user.ts:717,1048` and `apps/api/src/routes/webhooks.ts:104-108`. None reads `resourceUrl` directly, so D-12's "no other URL callsite" finding is confirmed — but these pricing sites still need to honour the new 1% percentage, which they will automatically via `config.platformFee.percentage` once the default flips. Flag for the planner: these sites do NOT need to read the per-run snapshot (they compute pre-run quotes); they only need the new default. Verified by grep at `[VERIFIED: ripgrep apps/**/*.ts]`.
2. **CONTEXT.md says "5 x402_job_runs INSERT sites; the run-creation site is `run-scheduled-jobs.ts`".** Reality: there are **6 INSERT sites** (counted: 1 in run-scheduled-jobs, 3 in webhooks.ts, 1 in jobs.ts, 1 in runs.ts, 1 in ChainRepository). Each must populate `platform_fee.config` snapshot at INSERT — full table in §4. `[VERIFIED: ripgrep apps/api/src/**/*.ts]`
3. **OpenFacilitator SDK version is @^1.0.0 (latest 1.0.0, published 2026-02-01)** — `.planning/codebase/STACK.md` says 0.3.0 which is stale. `apps/api/package.json` already pins `@openfacilitator/sdk: ^1.0.0`. No upgrade needed. `[VERIFIED: npm view @openfacilitator/sdk version]` + `[VERIFIED: apps/api/package.json]`.
4. **Express route mount is `app.use("/", instantRouter)` style** — no path rewriting, no reverse proxy. New router mounts as `app.use("/x402/fees", x402FeesRouter)` and the public URL `api.x402.jobs/x402/fees/{network}/charge` works directly. `apps/api` deploys via **Railway-only** (no `apps/api/vercel.json`). `[VERIFIED: apps/api/src/index.ts:121-126 + ls apps/api]`.
5. **The grandfathering test's intended path `apps/api/src/inngest/functions/__tests__/grandfather-fee.test.ts` does NOT yet exist** — the directory `apps/api/src/inngest/functions/__tests__/` itself does not exist. The closest analog `escrow.test.ts` lives at `apps/api/src/inngest/functions/run-workflow/__tests__/escrow.test.ts`. The planner should either (a) create the new `__tests__/` directory under `functions/`, or (b) co-locate the grandfather test under `functions/run-workflow/__tests__/grandfather-fee.test.ts` next to escrow.test.ts. Recommend (b): matches existing pattern, lower scaffolding risk. `[VERIFIED: filesystem]`.

**Primary recommendation:** Build Phase 32 in **5 waves**: (1) migration 011 + env.example skeleton; (2) new `routes/x402-fees.ts` route file + mount; (3) snapshot writes at all 6 INSERT sites + grandfather test; (4) charge-platform-fee.ts + run-workflow.ts read-path rewire + refund integration test + x402lint CI smoke test; (5) CHANGELOG.md + config.ts default flip + BASE_PLATFORM_WALLET rename + commented deprecation in env.example. Wave 5 is the cut-over and MUST land last in a single commit so deploys never have the old default with the new snapshot reader (or vice versa).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carry-forward from PROJECT.md Key Decisions (LOCKED — do not re-litigate)**
- **D-00a:** Fee rate is 1% with $0.01 minimum preserved. Source: PROJECT.md Key Decisions v3.1 table (✓ Locked 2026-05-17).
- **D-00b:** Reuse the existing `FACILITATOR_URL` env var — x402.jobs already runs an OpenFacilitator instance for `apps/api/src/routes/instant.ts`. No new facilitator instance.
- **D-00c:** Recipient address env vars: `FEE_COLLECTION_SOLANA_ADDRESS` + `FEE_COLLECTION_BASE_ADDRESS`. Two vars, no shared key, custody handled out-of-band by the operator.
- **D-00d:** Ship Solana + Base fee endpoints together (no staged rollout). Matches current same-network charging behavior.
- **D-00e:** Same-network fee charging preserved (Solana jobs → Solana fee, Base jobs → Base fee). No cross-chain.
- **D-00f:** In-flight jobs grandfathered (mechanism specified in D-04 below).
- **D-00g:** No backward-compat shim added. Clean cut-over per project convention (OPS-04).
- **D-00h:** Memeputer LLC remains BSL Licensor — decouple is operational only, not legal (CLAUDE.md hard-lock).

**Fee endpoint surface area**
- **D-01 (URL):** `api.x402.jobs/x402/fees/{network}/charge` where `{network}` ∈ {`solana`, `base`}. Verb `charge`.
- **D-02 (Route file):** Single route file `apps/api/src/routes/x402-fees.ts` with a `:network` path param.
- **D-03 (Facilitator):** Reuse the OpenFacilitator pattern from `routes/instant.ts:36-44` verbatim — `new OpenFacilitator({ url: FACILITATOR_URL, timeout: 60000 })` at module-load, then `facilitator.verify()` + `facilitator.settle()` in the handler.
- **D-04 (x402lint validation):** Use the OpenFacilitator SDK's response helper to construct the 402 payload + CI smoke test that runs `x402lint` against a captured 402 response.

**In-flight job grandfathering mechanism**
- **D-05 (Snapshot column):** Add column `platform_fee JSONB` to `x402_job_runs` via migration `011_add_platform_fee_snapshot.sql` + `_DOWN`.
- **D-06 (Snapshot scope):** Per-run only (on `x402_job_runs`). NOT job-level.
- **D-07 (Read path):** `charge-platform-fee.ts` and `run-workflow.ts:132-135` read from `run.platform_fee.config`; fallback to `config.platformFee.*` if null.
- **D-08 (Grandfathering test):** Vitest in-memory harness. Test name: "grandfathers in-flight job: run with old fee snapshot routes payment to old URL with old percentage".
- **D-09 (Old URL retirement):** `agents.memeputer.com` removed from `config.ts#platformFee.resourceUrl` + production code path; `env.example` keeps commented deprecated line for one release.

**Memeputer-URL cut-over scope**
- **D-10 (Strict scope):** Phase 32 removes `agents.memeputer.com` ONLY from `charge-platform-fee.ts` + `config.ts#platformFee.resourceUrl`. Other sites untouched.
- **D-11 (BASE_PLATFORM_WALLET):** Hardcoded default removed; env var renamed to `FEE_COLLECTION_BASE_ADDRESS`; default empty; startup warns if unset.
- **D-12 (Researcher re-grep):** Confirmed below in §2.
- **D-13 (Escrow breadcrumb):** No change to `config.ts#escrow.depositUrl` in Phase 32.

**Refund flow fee semantics**
- **D-14 (Refund policy):** Refund full `total_cost` INCLUDING platform fee. Caller is made whole.
- **D-15 (No production code change to refunds.ts):** Existing behavior matches policy.
- **D-16 (Refund integration test):** New `apps/api/src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` proving refund flow works against snapshot.
- **D-17 (Refund snapshot reference):** `settled.amount_paid` in snapshot for future fee-aware refund policy changes.

**Announcement-related decisions (REMOVED from Phase 32)**
- **D-18 (No announcement):** All 5 ANNOUNCE-* requirements REMOVED. Not deferred.
- **D-19 (Wallet documentation):** Moved to CHANGELOG.md (OPS-01) with Solscan/Basescan links.
- **D-20 (Phase 32 is backend-only):** Zero `apps/web` changes.

### Claude's Discretion
- Exact text of CHANGELOG.md v3.1 entry (within OPS-01 + D-19 constraints).
- Exact wording of comment lines added to `apps/api/env.example`.
- Numbered migration file name (`011_add_platform_fee_snapshot.sql` — confirmed free in §4).
- Test file naming / structure within established `__tests__` directories.

### Deferred Ideas (OUT OF SCOPE)

**Removed from Phase 32 (per user decision 2026-05-17)**
- All 5 ANNOUNCE-* requirements REMOVED — not deferred. v3.1 ships without a public announcement.
- Phase 32 name in ROADMAP.md: "Platform Fee Replacement + Announcement" → "Platform Fee Replacement".
- REQUIREMENTS.md §ANNOUNCE block moved to "Removed from milestone" section.

**Deferred to v3.2 cleanup milestone**
- Remove dead escrow + hiring-board code (`apps/api/src/inngest/utils/charge-escrow.ts`, `release-escrow.ts`, `routes/hiring.ts`, `services/hiring.service.ts`, `config.ts:80-87`, mounts in `index.ts:37,191`, 5 hiring tables + 2 columns on x402_job_runs).
- Memeputer URL `agents.memeputer.com/x402/solana/escrowputer/escrow_deposit` removed as side effect.
- Tracked at `.planning/todos/pending/remove-dead-escrow-hiring-code.md`.

**Out-of-scope per ROADMAP (unchanged)**
- Cross-chain fee settlement, backfilling in-flight jobs, backward-compat shim, BSL Licensor change, /blog infrastructure.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEE-01 | Self-hosted endpoint under api.x402.jobs/x402/fees/{solana,base}/... | §7 — mount at `app.use("/x402/fees", x402FeesRouter)` in `index.ts`, no proxy rewriting needed |
| FEE-02 | OpenFacilitator SDK (verify + settle) | §3 — verbatim pattern from `routes/instant.ts:36-44 + 357-431`; SDK v1.0.0 verified |
| FEE-03 | 402 response validates against x402lint | §3 — paste-ready CAIP-2 + v2 schema; x402lint skill loaded |
| FEE-04 | Same-network charging preserved | §3 — `:network` param branches to per-network recipient env var |
| FEE-05 | Rate reduced to 1% with $0.01 minimum | §10 — config.ts default flip `0.015 → 0.01`; minimumUsdc stays `0.01` |
| FEE-06 | New fee-collection wallet (cold-storage or multisig) | §10 — addresses come from operator-provisioning manual task in STATE.md |
| FEE-07 | Env var defaults updated; new fee-wallet env vars documented | §10 — env.example deltas captured below |
| FEE-08 | All agents.memeputer.com URLs removed from charge-platform-fee.ts + config.ts#platformFee | §2 + §10 — only TWO file edits in Phase 32 (per D-10 strict scope) |
| FEE-09 | Refund flow audited with new endpoint | §5 — refund test plan + mocks listed |
| FEE-10 | In-flight jobs grandfathered via snapshot | §4 — JSONB column + 6 INSERT sites + grandfather test |
| OPS-01 | CHANGELOG.md v3.1 entry | §10 — CHANGELOG.md does not yet exist at repo root; planner creates it |
| OPS-02 | env.example reflects new defaults; old PLATFORM_FEE_URL commented as deprecated | §10 — exact env.example diff in this section |
| OPS-04 | No backward-compat shim | §1 — clean cut-over via wave 5 atomic commit |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives are non-negotiable hard locks. The plan MUST NOT contradict them:

- **pnpm pin: `pnpm@10.6.5` exact** — all 5 pin sites stay locked. No package upgrades that require `pnpm@>=10.7.0` (Next.js ENOWORKSPACES bug). Phase 32 only touches `apps/api/package.json` if at all — `@openfacilitator/sdk` is already pinned to `^1.0.0` and 1.0.0 is the latest, so no new install is required.
- **`.npmrc#minimum-release-age=4320`** — any new dependency added in Phase 32 must be at least 3 days old. The planner does NOT need any new dependency; the OpenFacilitator SDK and `x402check` are both already installed.
- **License: BSL 1.1 with Memeputer LLC as Licensor** — Phase 32 does NOT modify `LICENSE` or copyright headers. The "decouple from Memeputer" framing is operational, not legal (CONTEXT.md D-00h).
- **`pnpm-workspace.yaml#ignoredBuiltDependencies: [isolated-vm]`** — Phase 32 does not touch this file.
- **Commit format:** Conventional Commits with phase scope `feat(32): …`, `chore(32): …`, `docs(32): …`. Migration files commit as `chore(32): add migration 011_add_platform_fee_snapshot`.
- **Migrations are flat-numbered with UP + `_DOWN` variants** under `apps/api/migrations/`. Apply via Supabase Dashboard SQL Editor (manual; not automated). Next free number is **011** (verified §4).
- **Encryption secrets are load-bearing** — Phase 32 does NOT touch `WALLET_ENCRYPTION_SECRET` or `INTEGRATION_ENCRYPTION_SECRET`. New env vars are addresses (public), not secrets.

## Architectural Responsibility Map

Phase 32 capabilities sorted by tier ownership. This catches misassignment risks before planning.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Self-hosted x402 fee endpoint (FEE-01/02/03) | API / Backend (Express route) | — | x402 server protocol is an HTTP 402 + verify/settle on the API tier; no client involvement |
| Fee charging from job runs (FEE-04/05/08) | API / Backend (Inngest function) | — | Background workflow execution; `executeX402Request` is the *client* of the new endpoint, lives in `inngest/utils` |
| In-flight job snapshot (FEE-10) | Database / Storage + API / Backend | — | New JSONB column on `x402_job_runs`; INSERT logic at API tier |
| Refund flow (FEE-09) | API / Backend (Express route + test) | — | `routes/refunds.ts` is API tier; no UI changes |
| Wallet provisioning (FEE-06) | Operator / out-of-band | — | Manual task in STATE.md; not code, not in-phase |
| Documentation (OPS-01/02) | Repo (CHANGELOG.md, env.example) | — | No tier — flat repo files |

## 2. Wider-grep Audit Results (D-12 Mandate)

### Scope: `apps/**/*.ts`, `apps/**/*.tsx`, `packages/**/*.ts`, `scripts/**/*.ts`

`scripts/` does not exist at repo root. `packages/` exists (`packages/sdk/`, `packages/ui/`) but contains zero matches for any of the four search patterns. `[VERIFIED: ls + ripgrep]`

### Search 1: `config.platformFee.resourceUrl` and `PLATFORM_FEE_URL`

| File:Line | Symbol | Verdict |
|-----------|--------|---------|
| `apps/api/src/config.ts:69` | `process.env.PLATFORM_FEE_URL \|\| "https://agents.memeputer.com/..."` | **EDIT IN PHASE 32** — D-09 / FEE-08 |
| `apps/api/src/inngest/utils/charge-platform-fee.ts:62-63` | `config.platformFee.resourceUrl.replace("/solana/", "/base/")` and direct read | **EDIT IN PHASE 32** — D-07 (read from snapshot) |
| `apps/api/src/inngest/functions/run-workflow.ts:134-135` | Same string-replace pattern, logging-only | **EDIT IN PHASE 32** — D-07 (read from snapshot) |

**Verdict: D-12 finding holds.** No OTHER callsite reads `config.platformFee.resourceUrl` or `PLATFORM_FEE_URL` outside the three sites CONTEXT.md identified. The planner can safely cut over the URL in only those three files.

### Search 2: `config.platformFee.percentage` and `config.platformFee.minimumUsdc` (related read paths)

These read the *percentage* not the *URL* — they were NOT flagged in CONTEXT.md and the planner needs to understand whether they need the snapshot too.

| File:Line | Symbol | Verdict |
|-----------|--------|---------|
| `apps/api/src/inngest/utils/charge-platform-fee.ts:24-25,43,54` | `config.platformFee.percentage` / `.minimumUsdc` / `.enabled` | **EDIT IN PHASE 32** — read from snapshot per D-07 |
| `apps/api/src/inngest/functions/run-workflow.ts:153` | `config.platformFee.percentage` (logging only) | **EDIT IN PHASE 32** — read from snapshot per D-07 |
| `apps/api/src/inngest/functions/run-scheduled-jobs.ts:200,12 (import)` | `calculatePlatformFee(totalResourceCost)` (called from `charge-platform-fee.ts`) | **POPULATES SNAPSHOT** — see §4 |
| `apps/api/src/routes/jobs.ts:131,289` | `config.platformFee.percentage` + `.minimumUsdc` — quote math for `calculateJobPrice` | **NO SNAPSHOT NEEDED** — runs *before* a job_run row exists; reads live config to compute quote |
| `apps/api/src/routes/user.ts:717,1048` | Same — pre-run quote math | **NO SNAPSHOT NEEDED** — same rationale |
| `apps/api/src/routes/webhooks.ts:104-108` | Same — pre-run quote math (`calculateJobPrice` helper) | **NO SNAPSHOT NEEDED** — same rationale |

**This is critical for the planner.** Pre-run quote math is allowed to read live config and SHOULD reflect the new 1% rate immediately on cut-over. The snapshot mechanism (D-05..D-08) is specifically for the *execution* of a charge against an already-created run.

### Search 3: `BASE_PLATFORM_WALLET` (renamed to `FEE_COLLECTION_BASE_ADDRESS` per D-11)

| File:Line | Symbol | Verdict |
|-----------|--------|---------|
| `apps/api/src/config.ts:53-54` | `process.env.BASE_PLATFORM_WALLET \|\| "0xAEB58049d3C266D55595a596Fae249C10764a031"` | **EDIT IN PHASE 32** — D-11 (rename + drop default) |
| `apps/api/env.example:18` | `BASE_PLATFORM_WALLET=0xAEB58049d3C266D55595a596Fae249C10764a031` | **EDIT IN PHASE 32** — D-11 + OPS-02 |
| `apps/api/src/lib/base.ts:69,71,93,184` | `BASE_PLATFORM_WALLET_PRIVATE_KEY` — DIFFERENT env var (private key, not address) | **DO NOT TOUCH** — out of Phase 32 scope (this is the *payout* wallet's private key, not the fee-collection address) |
| `apps/api/src/config.ts:98,100` | `BASE_PLATFORM_WALLET_PRIVATE_KEY` (same as above) | **DO NOT TOUCH** |

**Critical disambiguation for the planner:** `BASE_PLATFORM_WALLET` (the address) and `BASE_PLATFORM_WALLET_PRIVATE_KEY` (the key for *payouts*, used by `lib/base.ts`) are TWO different env vars. D-11 only renames the address. Touching `_PRIVATE_KEY` would break payouts and is outside Phase 32 scope (escrow/payout cleanup is v3.2).

### Search 4: `agents.memeputer.com` (broader exhaustion check)

In-scope removals (Phase 32):
| File:Line | Verdict |
|-----------|---------|
| `apps/api/src/config.ts:70` | EDIT |
| `apps/api/src/inngest/utils/charge-platform-fee.ts:33-34,58-59` | EDIT (comments + URL builder) |

Out-of-scope (per D-10, D-13, deferred v3.2):
| File:Line | Verdict |
|-----------|---------|
| `apps/api/src/routes/ask-jobputer.ts:10` | LEAVE — Phase 33 |
| `apps/api/src/routes/hiring.ts:35` | LEAVE — v3.2 (dead code) |
| `apps/api/src/config.ts:84` (escrow.depositUrl) | LEAVE — v3.2 (dead code) |
| `apps/web/src/lib/config.ts:12,14` (JOBPUTER_HELP_URL, JOBPUTER_POST_JOB_REQUEST_URL) | LEAVE — Phase 33 |

**Verdict:** The planner can rely on the exact two-file edit scope per D-10. The CHANGELOG.md OPS-01 entry should say "removed `agents.memeputer.com/x402/solana/jobputer/job_fee` from production fee path; other `agents.memeputer.com` URLs remain in dead escrow/hiring code (tracked for v3.2 cleanup)."

## 3. OpenFacilitator + x402lint Findings (D-03 / D-04 / FEE-02 / FEE-03)

### SDK Version Verification

- **Installed:** `@openfacilitator/sdk@1.0.0` (verified at `apps/api/node_modules/@openfacilitator/sdk/package.json`)
- **Pinned:** `^1.0.0` (verified at `apps/api/package.json:24`)
- **Latest on npm:** `1.0.0` published 2026-02-01 `[VERIFIED: npm view @openfacilitator/sdk version, time]`
- **`.planning/codebase/STACK.md:73` says `0.3.0`** — STALE. The planner should not trust STACK.md for SDK versions.
- **`x402check` is at `^0.2.0`** (installed and pinned). Used by `executeX402Request` for client-side response parsing. Not strictly required by Phase 32 implementation, but x402check is the user's helper skill — see §3.4 below for whether to invoke `x402lint` programmatically (we can't — see note).

### Canonical Reuse Pattern (verbatim from `routes/instant.ts`)

**Module-level facilitator init** — paste into `apps/api/src/routes/x402-fees.ts`:

```typescript
import { Router } from "express";
import type { Router as RouterType } from "express";
import { OpenFacilitator } from "@openfacilitator/sdk";
import { config } from "../config";
import { dollarsToAtomicString } from "../lib/usdc-amount";

export const x402FeesRouter: RouterType = Router();

// Reuse the same FACILITATOR_URL the rest of the API (instant.ts, webhooks.ts)
// already uses. No new env var per D-00b.
const FACILITATOR_URL = process.env.FACILITATOR_URL;
if (!FACILITATOR_URL) {
  console.warn(
    "FACILITATOR_URL not configured — fee endpoint will not work",
  );
}

const facilitator = FACILITATOR_URL
  ? new OpenFacilitator({ url: FACILITATOR_URL, timeout: 60000 })
  : null;

// CAIP-2 network identifiers — copied from instant.ts:238-241
const CAIP2_NETWORK_IDS = {
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  base: "eip155:8453",
} as const;

// USDC addresses — copied from instant.ts:30-33
const USDC_ADDRESSES = {
  solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
} as const;

type Network = "solana" | "base";
```

**Settle pattern** — paste into the handler:

```typescript
// Mirrors instant.ts:359-436 verifyAndSettlePayment
async function verifyAndSettleFeePayment(
  paymentHeader: string,
  amountUsdc: number, // e.g. 0.01 for 1¢
  payTo: string,
  network: Network,
  resourceUrl: string,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (!facilitator) {
    return { success: false, error: "Facilitator not configured" };
  }
  try {
    const priceAtomic = dollarsToAtomicString(amountUsdc);

    let paymentPayload: any;
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );
    } catch {
      return { success: false, error: "Invalid payment header format" };
    }

    const payment = {
      x402Version: paymentPayload.x402Version || 1,
      scheme: paymentPayload.scheme || "exact",
      network,
      payload: paymentPayload.payload,
    };

    const paymentRequirements = {
      scheme: "exact" as const,
      network,
      maxAmountRequired: priceAtomic,
      resource: resourceUrl,
      description: `x402.jobs platform fee (${network})`,
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: 300,
      asset: USDC_ADDRESSES[network],
    };

    // settle() handles verify internally — same as instant.ts:408
    const result = await facilitator.settle(payment, paymentRequirements);

    if (!result.success) {
      return {
        success: false,
        error:
          result.errorReason ||
          (result as any).error ||
          (result as any).message ||
          "Payment settlement failed",
      };
    }

    return { success: true, txHash: result.transaction || "facilitator-settled" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

**Caveats from the existing code:**
- `OpenFacilitator` constructor accepts `{ url, timeout }`. The skill SKILL.md says no constructor args needed (defaults to `pay.openfacilitator.io`), but the codebase pattern always supplies the URL — keep that pattern (matches D-00b).
- The current `instant.ts` calls `settle()` directly and skips an explicit `verify()` call (settle handles verify internally per `[CITED: ~/.claude/skills/openfacilitator/SKILL.md L101-114]`). Reuse this pattern.
- `dollarsToAtomicString()` is at `apps/api/src/lib/usdc-amount.ts` — already in use, just import.

### 402 Response Shape (FEE-03 — x402lint compatible)

The current `instant.ts:306-353` `build402Response()` produces a dual v1+v2 payload that already validates with x402lint (verified empirically — `instant.ts` is live and x402check parses its responses). Reuse this shape verbatim:

```typescript
function build402FeeResponse(
  network: Network,
  amountUsdc: number, // dollars
  payTo: string,
  resourceUrl: string,
) {
  const priceAtomic = dollarsToAtomicString(amountUsdc);
  return {
    x402Version: 2,
    error: "Payment required",
    service: { name: "x402.jobs", url: "https://x402.jobs" },
    accepts: [
      {
        scheme: "exact",
        network: CAIP2_NETWORK_IDS[network], // v2 uses CAIP-2 format
        amount: priceAtomic, // v2 'amount'
        maxAmountRequired: priceAtomic, // v1 compat
        resource: resourceUrl,
        description: `x402.jobs platform fee (${network})`,
        mimeType: "application/json",
        payTo,
        maxTimeoutSeconds: 300,
        asset: USDC_ADDRESSES[network],
        outputSchema: {
          input: { type: "http", method: "POST", bodyType: "json", bodyFields: {} },
          output: {},
        },
        extra: {
          resourceType: "platform-fee",
          serviceName: "x402.jobs",
          serviceUrl: "https://x402.jobs",
          ...(network === "solana"
            ? {
                feePayer:
                  process.env.SOLANA_FACILITATOR_ADDRESS ||
                  "561oabzy81vXYYbs1ZHR1bvpiEr6Nbfd6PGTxPshoz4p",
              }
            : {}),
        },
      },
    ],
  };
}
```

**Three load-bearing details for x402lint validity (per `[CITED: ~/.claude/skills/x402lint/SKILL.md]` §Critical rules):**
1. **`amount`** must be a string of digits in atomic units (6 decimals for USDC). `dollarsToAtomicString(0.01)` → `"10000"` — correct.
2. **`network`** must be CAIP-2 format. `"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"` and `"eip155:8453"` — correct.
3. **`payTo`** — for Base, must be EIP-55 checksummed mixed-case. The operator-supplied `FEE_COLLECTION_BASE_ADDRESS` SHOULD be the checksummed form. The planner should add a note in env.example: "Address MUST be EIP-55 checksummed (mixed-case 0xAbCd…) — uppercase-only or lowercase-only addresses validate but are not best practice."

### x402lint CI Smoke Test (D-04 — Belt + Suspenders)

The `x402lint` skill is documented at `~/.claude/skills/x402lint/SKILL.md` and references a npm package the user installs via `npx x402lint@latest install` (per MEMORY.md `x402_skills_install.md`). **Important caveat:** The current repo does NOT contain `packages/x402lint/` (the SKILL.md sample import). The integration test approach should be:

1. **Unit-test path (recommended, no network):** Capture the literal 402 JSON response object (from `build402FeeResponse()` called with deterministic inputs) and assert it matches a saved fixture. The fixture is hand-validated through x402lint by the executor during plan time.
2. **CI smoke test path (optional, network-free):** Add a Vitest test that calls `build402FeeResponse()` with both `solana` and `base` and asserts the shape against the saved fixture file checked into `apps/api/src/routes/__tests__/fixtures/x402-fee-402-response.{solana,base}.json`. This catches regressions if anyone refactors `build402FeeResponse()` and accidentally drops a field.

The simpler interpretation of "FEE-03 validates against x402lint" is: **before the PR merges, the executor runs `npx x402lint check < (captured 402 from dev server)` manually and pastes the green output into the PR description.** This is the lowest-cost approach and matches the "belt + suspenders" framing of D-04.

**Planner recommendation:** Both — add the unit-test fixture (deterministic, automatable) AND require a manual `x402lint` check captured in the PR. Document the manual step as a STATE.md manual task: "Run `x402lint` against captured 402 from `/x402/fees/solana/charge` and `/x402/fees/base/charge` dev-server response; paste green output into Phase 32 PR description."

## 4. Snapshot Column Migration (FEE-10 / D-05 / D-06 / D-07)

### Migration File Numbering

`apps/api/migrations/` last numbered file is **`010_add_users_soft_delete.sql`** (UP) + `010_add_users_soft_delete_DOWN.sql`. **Next free number is 011.** Confirmed via `ls`. `[VERIFIED: filesystem]`

### Current `x402_job_runs` Schema (from `001_initial_schema.sql:947-983`)

Key existing JSONB columns (the pattern the new column matches):
- `payments jsonb DEFAULT '[]'::jsonb` — line 955
- `execution_trace jsonb DEFAULT '[]'::jsonb` — line 956
- `input jsonb DEFAULT '{}'::jsonb` — line 951
- `inputs jsonb DEFAULT '{}'::jsonb` — line 962

The new `platform_fee` column follows the same `jsonb` DDL form.

### UP Migration — `011_add_platform_fee_snapshot.sql`

```sql
-- Migration 011: Snapshot platform fee config on each x402_job_run row.
--
-- Phase 32 cut-over: the fee endpoint URL, percentage, and minimum are
-- captured at run-creation time so in-flight jobs continue charging the
-- OLD fee config after the deploy that flips defaults to 1% / new URL.
-- This is the load-bearing column for FEE-10 grandfathering — without it
-- we would need a compatibility shim (OPS-04 prohibits shims) or a backfill
-- (PROJECT.md Out of Scope prohibits backfills).
--
-- Shape (matches CONTEXT.md D-05):
--   {
--     "config":  { "url": "...", "percentage": 0.01, "minimum_usdc": 0.01 },
--     "settled": { "tx_hash": "...", "amount_paid": 0.123, "settled_at": "2026-..." }
--   }
--
-- `config` is populated at INSERT time by all 6 run-creation sites (run-scheduled-jobs,
-- routes/runs, routes/jobs, routes/webhooks 3 sites, ChainRepository).
-- `settled` is updated by step.run("charge-platform-fee", ...) in
-- apps/api/src/inngest/functions/run-workflow.ts after chargePlatformFee succeeds.
--
-- Backwards compat: rows predating this migration have platform_fee = NULL.
-- chargePlatformFee() falls back to config.platformFee.* when the snapshot is
-- null (read path in apps/api/src/inngest/utils/charge-platform-fee.ts).

ALTER TABLE public.x402_job_runs
  ADD COLUMN IF NOT EXISTS platform_fee JSONB;

COMMENT ON COLUMN public.x402_job_runs.platform_fee IS
  'Snapshot of platform fee config + settled tx. Shape: { "config": { "url", "percentage", "minimum_usdc" }, "settled": { "tx_hash", "amount_paid", "settled_at" } }. Populated at INSERT (config) and after charge-platform-fee step (settled). NULL for rows predating Phase 32 migration — chargePlatformFee falls back to live config.platformFee.* in that case.';
```

No index needed — there are no read queries that filter on `platform_fee.*`. The column is read by primary-key `runId` lookups only.

### DOWN Migration — `011_add_platform_fee_snapshot_DOWN.sql`

```sql
-- Rollback for migration 011: drop platform_fee column.
--
-- WARNING: rolling this back loses the grandfathering data for any runs
-- already created post-migration. If the rollback happens while v3.1
-- code is deployed, chargePlatformFee() will fall back to live config —
-- which by then has already flipped to the new URL/percentage — so
-- in-flight runs will charge the NEW fee config. This is acceptable for
-- a rollback scenario (which already implies cut-over reversal).

ALTER TABLE public.x402_job_runs
  DROP COLUMN IF EXISTS platform_fee;
```

### Six INSERT Sites — Each Must Populate `platform_fee.config`

The planner needs to touch each of these. Verified via `[VERIFIED: ripgrep \.from\(.x402_job_runs.\)\s*\.insert apps/api/src/]`:

| # | File:Line | Trigger | Currently Inserts | Add |
|---|-----------|---------|-------------------|-----|
| 1 | `apps/api/src/inngest/functions/run-scheduled-jobs.ts:457-465` | Scheduled cron run | `job_id, user_id, status="pending", input` | `platform_fee: { config: snapshotFromConfig() }` |
| 2 | `apps/api/src/routes/runs.ts:55-64` | User-triggered manual run | `job_id, user_id, status="pending", inputs, resources_total` | Same |
| 3 | `apps/api/src/routes/jobs.ts:1227-1235` | Legacy job-run start endpoint | `job_id, user_id, status="pending", input` | Same |
| 4 | `apps/api/src/routes/webhooks.ts:965-996` | Payment-collector job webhook (instant-complete) | Many fields incl. `status="completed"` | Same (still snapshot — protects future refunds) |
| 5 | `apps/api/src/routes/webhooks.ts:1072-1095` | Standard job webhook | Many fields incl. `status="pending"` | Same |
| 6 | `apps/api/src/routes/webhooks.ts:2195-onwards` | Webhook variant (helius-style, payment-already-confirmed) | Many fields | Same |
| 7 | `apps/api/src/repositories/ChainRepository/ChainRepository.ts:99-111` | Chained job run | `job_id, user_id, status="pending", triggered_by="chain", input` | Same |

**That's 7 sites, not 6** — re-counted from grep output. The CONTEXT.md "5 sites" estimate is undercounted. Planner: budget tasks for all 7.

**Helper function recommendation:** Add `apps/api/src/inngest/utils/platform-fee-snapshot.ts`:

```typescript
import { config } from "../../config";

/**
 * Build the platform_fee.config snapshot from the current live config.
 * Called at x402_job_runs INSERT time so in-flight runs are grandfathered
 * to the fee config that was active when the run was created (FEE-10).
 */
export function buildPlatformFeeSnapshot() {
  return {
    config: {
      url: config.platformFee.resourceUrl,
      percentage: config.platformFee.percentage,
      minimum_usdc: config.platformFee.minimumUsdc,
    },
    // `settled` is filled in later by chargePlatformFee — leave undefined here.
  };
}
```

Then every INSERT site adds `platform_fee: buildPlatformFeeSnapshot()`. Centralising avoids drift across 7 sites.

### Read-path rewire (D-07)

In `apps/api/src/inngest/utils/charge-platform-fee.ts`, add a `run` parameter (or pre-load it inside the function from `runId`):

```typescript
export async function chargePlatformFee(
  params: ChargeFeeParams & { runSnapshot?: PlatformFeeSnapshot | null },
): Promise<ChargeFeeResult> {
  // Read fee config from snapshot first; fall back to live config (for rows predating migration)
  const fee = params.runSnapshot?.config ?? {
    url: config.platformFee.resourceUrl,
    percentage: config.platformFee.percentage,
    minimum_usdc: config.platformFee.minimumUsdc,
  };

  if (!config.platformFee.enabled) {  // still gate on live `enabled`
    return { success: true, amountPaid: 0 };
  }

  const resourceCost = params.resourceCost || 0;
  const amountUsdc = Math.max(resourceCost * fee.percentage, fee.minimum_usdc);

  // URL is now grandfathered — no more string-replace on /solana/ → /base/
  // because the snapshot stores the FULL url per network. NEW snapshots from
  // Phase 32 onwards will have URLs that already contain /solana/charge or
  // /base/charge correctly. OLD snapshots (rows predating migration; fallback
  // to live config) hit the /solana/ → /base/ replace path one last time.
  const resourceUrl =
    params.network === "base" && fee.url.includes("/solana/")
      ? fee.url.replace("/solana/", "/base/")
      : fee.url;
  // ... rest as before
}
```

**Caller change in `run-workflow.ts`:** Before the `step.run("charge-platform-fee", ...)` block (~line 95), load `run.platform_fee` from supabase and pass it in:

```typescript
// Load the run's snapshot — null for runs predating Phase 32 migration
const { data: runRow } = await supabase
  .from("x402_job_runs")
  .select("platform_fee")
  .eq("id", runId)
  .single();
const runSnapshot = (runRow as { platform_fee?: PlatformFeeSnapshot | null } | null)?.platform_fee ?? null;

const feeResult = await step.run("charge-platform-fee", async () => {
  const result = await chargePlatformFee({
    solanaSecretKey: walletSecretKey,
    baseSecretKey: baseWalletKey,
    network: jobNetwork,
    resourceCost,
    runSnapshot, // NEW
  });
  // ... rest unchanged
});

// After successful charge, write `settled` back to the snapshot:
if (feeResult.success && feeResult.amountPaid && feeResult.amountPaid > 0) {
  await supabase
    .from("x402_job_runs")
    .update({
      platform_fee: {
        ...(runSnapshot ?? {}),
        config: runSnapshot?.config ?? buildPlatformFeeSnapshot().config,
        settled: {
          tx_hash: feeResult.transactionSignature ?? null,
          amount_paid: feeResult.amountPaid,
          settled_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", runId);
}
```

And in the logging block at `run-workflow.ts:130-159`, swap `config.platformFee.resourceUrl` → `runSnapshot?.config?.url ?? config.platformFee.resourceUrl`, same fallback chain.

## 5. Refund Flow Audit (FEE-09 / D-14 / D-15 / D-16)

### Current behaviour (verified `apps/api/src/routes/refunds.ts:1-265`)

- `POST /refunds` (line 14-158):
  - Looks up the run (line 26-35), verifies ownership (line 42), verifies `status === "failed"` (line 47).
  - **Line 72:** `const refundAmount = parseFloat(run.total_cost || "0");` — refund amount is the full `total_cost` of the run.
  - `total_cost` (per `run-workflow.ts:655,673`) includes the platform fee (logged as a synthetic `x402_job_run_event` with `node_id='platform-fee'`, `sequence=-1`, included in the `dbTotalPaid` sum at line 651).
  - Inserts a `pending` refund row in `x402_refunds` (line 90-102) and notifies admin (line 123-138).
  - **Does NOT actually transfer USDC back** — admin must resolve the refund manually (this is the operator-driven refund flow from Phase 28).
- `GET /refunds/:run_id/status` (line 200-265): same `total_cost`-based eligibility math.

**Verdict:** D-14 holds. The current behaviour refunds the full `total_cost` (resources + platform fee). No code change required in `refunds.ts` — D-15 confirmed.

### D-16 Integration Test Plan

**File:** `apps/api/src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts`

**Test name:** `"refunds full total_cost (including platform fee charged via new x402.jobs fee endpoint)"`

**What it must prove:**
1. A run completed against the new `/x402/fees/{net}/charge` endpoint (i.e. `platform_fee.settled.tx_hash` is populated, snapshot URL points at `api.x402.jobs/x402/fees/{net}/charge`).
2. That run failed (`status = "failed"`, `total_cost > 0`).
3. The refund POST returns success with `amount === run.total_cost` (which already includes the fee).
4. The refund record's `amount` equals `run.total_cost`, NOT `run.total_cost - platform_fee.settled.amount_paid`.

**Minimum set of mocks (modelled on `apps/api/src/routes/__tests__/runs.test.ts:1-80` rowStore pattern):**
- Mock `@/lib/supabase` with an in-memory rowStore containing one fake `x402_job_runs` row (status=failed, total_cost=0.5, platform_fee=`{ config: { url: "https://api.x402.jobs/x402/fees/solana/charge", percentage: 0.01, minimum_usdc: 0.01 }, settled: { tx_hash: "fake-tx", amount_paid: 0.01, settled_at: "..." } }`).
- Mock `@/services/notifications.service.notifyRefundRequested` to be a no-op.
- Pre-set `FACILITATOR_URL = "http://localhost:9999"` (matches existing test pattern at `apps/api/vitest.config.ts:14`).

**Optional bonus assertions:**
- `existingRefund` path: insert a `pending` refund for the same run_id, assert second POST returns 400 with `error: "A refund request is already pending..."`.
- Status-not-failed path: change row to `status="running"`, assert POST returns 400.

The test must NOT depend on a real Supabase, OpenFacilitator, or facilitator URL — pure in-memory mocks. This matches the established `apps/api/src/routes/__tests__/` pattern.

## 6. Grandfathering Test Pattern (D-08)

### File location decision

CONTEXT.md says `apps/api/src/inngest/functions/__tests__/grandfather-fee.test.ts`. **That directory does not exist.** Closest analogs:
- `apps/api/src/inngest/functions/run-workflow/__tests__/escrow.test.ts` (D-08 references this as the closest analog)
- `apps/api/src/inngest/utils/__tests__/execute-x402.test.ts`

**Recommendation:** Place at `apps/api/src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts` (next to escrow.test.ts). The function under test (`chargePlatformFee` + `run-workflow.ts` step) is the run-workflow concern — co-locating with `escrow.test.ts` matches semantic grouping. CONTEXT.md's listed path is approximate; the planner has discretion per the "Test file naming / structure" claim under §Claude's Discretion.

### Vitest skeleton (paste-ready, modelled on escrow.test.ts:1-50)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chargePlatformFee } from "../../../utils/charge-platform-fee";
import type { PlatformFeeSnapshot } from "../../../utils/platform-fee-snapshot";

// Mock executeX402Request — we don't make real network calls
vi.mock("../../../utils/execute-x402", () => ({
  executeX402Request: vi.fn(),
}));
import { executeX402Request } from "../../../utils/execute-x402";

// Mock config — its current value is "new" (post-cut-over). Tests verify that
// the SNAPSHOT (which represents the OLD config from when the run was created)
// wins over the live config.
vi.mock("../../../../config", () => ({
  config: {
    platformFee: {
      resourceUrl: "https://api.x402.jobs/x402/fees/solana/charge", // NEW
      percentage: 0.01, // NEW 1%
      minimumUsdc: 0.01,
      enabled: true,
    },
  },
}));

describe("chargePlatformFee — FEE-10 grandfathering (D-08)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(executeX402Request).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("grandfathers in-flight job: run with old fee snapshot routes payment to old URL with old percentage", async () => {
    // Snapshot captured at run-creation (BEFORE Phase 32 cut-over)
    const oldSnapshot: PlatformFeeSnapshot = {
      config: {
        url: "https://agents.memeputer.com/x402/solana/jobputer/job_fee", // OLD URL
        percentage: 0.015, // OLD 1.5%
        minimum_usdc: 0.01,
      },
    };

    vi.mocked(executeX402Request).mockResolvedValue({
      success: true,
      response: {},
      responseText: "",
      paymentSignature: "fake-tx-sig",
      amountPaid: 0.015,
    });

    const result = await chargePlatformFee({
      solanaSecretKey: "fake-key-base64",
      network: "solana",
      resourceCost: 1.0, // 1.5% of $1 = $0.015
      runSnapshot: oldSnapshot,
    });

    expect(result.success).toBe(true);
    expect(result.amountPaid).toBe(0.015);

    // CRITICAL: payment was routed to OLD URL, charged at OLD percentage
    expect(executeX402Request).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceUrl: "https://agents.memeputer.com/x402/solana/jobputer/job_fee",
      }),
    );
  });

  it("uses new live config when snapshot is null (legacy row predating migration)", async () => {
    vi.mocked(executeX402Request).mockResolvedValue({
      success: true,
      response: {},
      responseText: "",
      paymentSignature: "fake-tx-sig",
      amountPaid: 0.01,
    });

    const result = await chargePlatformFee({
      solanaSecretKey: "fake-key-base64",
      network: "solana",
      resourceCost: 1.0, // 1% of $1 = $0.01
      runSnapshot: null, // legacy row → fall back to live config
    });

    expect(result.success).toBe(true);
    expect(executeX402Request).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceUrl: "https://api.x402.jobs/x402/fees/solana/charge", // NEW
      }),
    );
  });

  it("charges Base on the Base endpoint when network=base and snapshot stored a Solana URL (string-replace fallback for legacy snapshots)", async () => {
    const oldSnapshot: PlatformFeeSnapshot = {
      config: {
        url: "https://agents.memeputer.com/x402/solana/jobputer/job_fee", // pre-migration always stored solana URL
        percentage: 0.015,
        minimum_usdc: 0.01,
      },
    };

    vi.mocked(executeX402Request).mockResolvedValue({
      success: true,
      response: {},
      responseText: "",
      paymentSignature: "fake-tx-sig",
      amountPaid: 0.015,
    });

    await chargePlatformFee({
      solanaSecretKey: "fake-key-base64",
      baseSecretKey: "fake-base-key",
      network: "base",
      resourceCost: 1.0,
      runSnapshot: oldSnapshot,
    });

    expect(executeX402Request).toHaveBeenCalledWith(
      expect.objectContaining({
        // Legacy snapshot URL was Solana — same /solana/→/base/ replace logic kicks in
        resourceUrl: "https://agents.memeputer.com/x402/base/jobputer/job_fee",
      }),
    );
  });
});
```

This test is **pure-unit** (no Supabase, no Inngest, no real network). Vitest runs it in <1s. Matches `escrow.test.ts` pattern.

## 7. Route Mount + Proxy/Path-Rewrite Confirmation (FEE-01)

### Express mount point

`apps/api/src/index.ts` mounts routes in a flat top-level pattern. The instant router uses `app.use("/", instantRouter)` to catch the catch-all `/@username/slug` paths. For `/x402/fees/...` we want a more-specific mount BEFORE the catch-all instant router:

```typescript
// In apps/api/src/index.ts, near line 46 (after instantRouter import)
import { x402FeesRouter } from "./routes/x402-fees";

// ... near line 117 (BEFORE app.use("/", instantRouter) on line 122)
// Platform fee endpoint — public (x402 payment handles auth)
app.use("/x402/fees", x402FeesRouter);
```

**Order matters.** Place `app.use("/x402/fees", x402FeesRouter)` BEFORE `app.use("/", instantRouter)` (line 122) so the more-specific path matches first. Express matches in mount order.

### Path translation: `api.x402.jobs/x402/fees/{network}/charge`

| Public URL | Express path | Handler |
|------------|--------------|---------|
| `https://api.x402.jobs/x402/fees/solana/charge` | mount `/x402/fees` + route `/:network/charge` with `:network="solana"` | inside `x402-fees.ts` |
| `https://api.x402.jobs/x402/fees/base/charge` | mount `/x402/fees` + route `/:network/charge` with `:network="base"` | inside `x402-fees.ts` |

### Route file skeleton

```typescript
// apps/api/src/routes/x402-fees.ts
x402FeesRouter.post("/:network/charge", async (req, res) => {
  const network = req.params.network as "solana" | "base";
  if (network !== "solana" && network !== "base") {
    return res.status(404).json({ error: `Unsupported network: ${network}` });
  }

  const payTo =
    network === "solana"
      ? process.env.FEE_COLLECTION_SOLANA_ADDRESS
      : process.env.FEE_COLLECTION_BASE_ADDRESS;
  if (!payTo) {
    return res.status(503).json({
      error: `Fee collection address not configured for ${network}`,
    });
  }

  const resourceUrl = `${config.publicUrl}/x402/fees/${network}/charge`;
  // ^^ uses config.publicUrl ("http://localhost:3011" dev / "https://api.x402.jobs" prod via PUBLIC_URL env var)
  // matches the pattern at instant.ts where resource URL echoes back the request URL

  // Amount — caller-driven. The fee endpoint accepts the amount the caller computed
  // on their side (chargePlatformFee.calculatePlatformFee). We require the body to
  // include an `amount_usdc` field so the 402 advertises the right price.
  // Alternative: charge a fixed micro-fee and rely on the client to call repeatedly.
  // Decision: caller-supplied is simpler and matches the existing /job_fee pattern.
  const amountUsdcRaw = (req.body && req.body.amount_usdc) ?? 0.01;
  const amountUsdc = Math.max(parseFloat(amountUsdcRaw) || 0.01, 0.01);

  const paymentHeader =
    (req.headers["x-payment"] as string) ||
    (req.headers["payment-signature"] as string);

  if (!paymentHeader) {
    return res
      .status(402)
      .json(build402FeeResponse(network, amountUsdc, payTo, resourceUrl));
  }

  const result = await verifyAndSettleFeePayment(
    paymentHeader,
    amountUsdc,
    payTo,
    network,
    resourceUrl,
  );

  if (!result.success) {
    return res.status(402).json({
      x402Version: 1,
      error: result.error || "Payment failed",
      accepts: build402FeeResponse(network, amountUsdc, payTo, resourceUrl).accepts,
    });
  }

  // Settled — return 200 with the receipt
  return res.status(200).json({
    success: true,
    transactionSignature: result.txHash,
    amountPaid: amountUsdc,
    network,
  });
});
```

**Note for planner:** This handler intentionally mirrors the `instant.ts:582-620` shape — body parsing, 402-without-header, 402-with-error, 200 settlement. The `chargePlatformFee` caller side already handles this exact response shape via `executeX402Request` (no client changes needed; `executeX402Request` is reused verbatim).

### Reverse proxy / path rewriting

- `apps/api` is deployed on **Railway** (no `apps/api/vercel.json` exists). Verified via `ls apps/api/`.
- Railway routes traffic to the container's `EXPOSE 3011` port directly with no path rewriting (verified `apps/api/Dockerfile:50`).
- The DNS `api.x402.jobs` → Railway service does NOT introduce any path rewriting.
- **Conclusion:** Public URL `https://api.x402.jobs/x402/fees/{network}/charge` maps 1:1 to Express route `/x402/fees/{network}/charge`. No proxy work needed.

## 8. Migration Sequencing (D-05)

### Numbered migration convention (verified `apps/api/migrations/README.md` + actual files)

- Format: `{NNN}_description.sql` (UP) + `{NNN}_description_DOWN.sql` (rollback).
- Apply manually via Supabase Dashboard SQL Editor or `psql` (per CLAUDE.md). NOT automated.
- Existing files 001-010. **Next free: 011.** No conflicts.
- The README only documents up to 004 — it's stale. Migrations 005-010 are present on disk and applied to production (per CLAUDE.md "single source of truth — reflects what's applied to production").

### Manual step the planner must capture

Add to STATE.md "v3.1 manual tasks":

```markdown
- [ ] Apply migration `011_add_platform_fee_snapshot.sql` to production Supabase
  via Dashboard SQL Editor (before deploying Phase 32 code that reads/writes
  the `platform_fee` column). Reading from a non-existent column would 500
  every job run.
```

The migration is **forward-safe to apply BEFORE code deploy** (adding a nullable JSONB column is non-breaking). The planner should require migration applied BEFORE the wave-5 cut-over commit.

## 9. Risks + Open Questions

### Risks (planner should plan around)

1. **6 → 7 INSERT site count discrepancy.** CONTEXT.md / D-12 enumeration is 1 short. The planner MUST plan tasks for all 7 sites (§4 table). Missing one means new runs from that path silently use null snapshots → fall back to live config → in-flight jobs created during the deploy window get the NEW fee config, not the OLD. **This is a silent grandfathering failure.** Mitigation: route every INSERT through a single helper (`buildPlatformFeeSnapshot()` in §4) and grep-test the absence of bare `.from("x402_job_runs").insert({` in CI.
2. **`__tests__/` directory mismatch.** CONTEXT.md says `apps/api/src/inngest/functions/__tests__/`. Doesn't exist. Recommend placing the grandfather test at `run-workflow/__tests__/grandfather-fee.test.ts` (§6). Planner needs to acknowledge the path divergence in PLAN.md so the executor doesn't try to create a non-standard directory.
3. **`amount_usdc` request-body design choice (§7).** The new endpoint is "caller-supplied amount" — the client sends `{ "amount_usdc": 0.015 }` and the 402 advertises that price. **The old Memeputer endpoint did the same** (verified by reading `chargePlatformFee` calls — no `body` field used; relies on the endpoint advertising whatever price it wants and `executeX402Request` paying it). **DIVERGENCE FROM OLD BEHAVIOR:** the old endpoint likely advertised a fixed price; the new caller-supplied design lets the caller dictate the amount. This is acceptable because the fee endpoint is private-by-convention (only `chargePlatformFee` calls it; not publicly discovered). The planner should add a deny-list check: reject `amount_usdc > 100` or similar sanity cap to prevent a buggy caller from auto-charging huge fees. Open question: does the planner want a fixed-price design instead? Default recommendation: caller-supplied with cap.
4. **`SOLANA_FACILITATOR_ADDRESS` env var** (referenced in `instant.ts:346`). The fee endpoint's 402 response includes `extra.feePayer` on Solana (paste-ready snippet in §3). If this env var isn't set in Railway prod, the hardcoded default `"561oabzy81vXYYbs1ZHR1bvpiEr6Nbfd6PGTxPshoz4p"` kicks in — same as `instant.ts`. **Verify this default is the production OpenFacilitator's actual fee payer**, not a placeholder. If wrong, Solana fee charges will fail.
5. **CHANGELOG.md does not exist at repo root.** `[VERIFIED: ls /Users/.../x402jobs/CHANGELOG.md → does not exist]`. OPS-01 implies "if not present, create". The planner must include a task to create CHANGELOG.md with a header pattern and the v3.1 entry.
6. **Wallet provisioning is a blocking manual task.** `STATE.md` already tracks it: "Provision new fee-collection wallets (cold storage or multisig) for Solana + Base before Phase 32 implementation lands". The planner cannot ship without those addresses populated in Railway env (`FEE_COLLECTION_SOLANA_ADDRESS`, `FEE_COLLECTION_BASE_ADDRESS`). Without them, the fee endpoint returns 503 and every job run fails its fee step → every workflow run fails. **Block the cut-over commit on this manual task.**
7. **STACK.md is stale on SDK version.** The planner should not trust STACK.md (`@openfacilitator/sdk 0.3.0`). The actual installed version is `1.0.0`. Treat STACK.md as a hint, not a fact. No code change implied — just don't let STACK.md mislead any executor or human reviewer reading the plan.

### Open Questions (need user confirmation OR Claude's discretion)

| # | Question | Recommended default | Why |
|---|----------|---------------------|-----|
| OQ-1 | Caller-supplied vs fixed-price fee endpoint? | Caller-supplied with cap (§9 risk 3) | Matches existing call pattern (`chargePlatformFee` already calculates the amount locally); fixed-price would require a duplicated rate table |
| OQ-2 | Should the fee endpoint require an auth header (e.g. internal API key) to prevent random callers from "settling" fees and inflating the wallet? | NO auth — x402 IS the auth (the 402-then-pay round-trip means the caller pays REAL USDC; randos can't drain the wallet, only DONATE to it) | Lowest-complexity design; matches `instant.ts` posture |
| OQ-3 | Place grandfather test at `functions/__tests__/` (CONTEXT.md path) or `run-workflow/__tests__/` (existing pattern)? | `run-workflow/__tests__/grandfather-fee.test.ts` | Matches existing pattern; CONTEXT.md path was approximate |
| OQ-4 | x402lint validation: unit fixture only, manual `npx x402lint` only, or both? | Both (§3.4) | Belt + suspenders per D-04 |
| OQ-5 | Should the `settled` snapshot update be in the same `step.run()` block as the charge, or a separate one? | Separate `step.run("snapshot-fee-settled", ...)` block | Keeps the charge step atomically retryable; snapshot write is bookkeeping |
| OQ-6 | Helper file location for `buildPlatformFeeSnapshot()`? | `apps/api/src/inngest/utils/platform-fee-snapshot.ts` (new) | Co-locates with `charge-platform-fee.ts` |

None of the above contradict CONTEXT.md decisions. They're all Claude's-discretion expansion of the locked frame. If the user wants different defaults, they can override during plan-checker / discuss-phase review.

## 10. Implementation Recipes (paste-ready)

### env.example diff (OPS-02)

Replace existing lines 15-44 with:

```bash
# Base
BASE_RPC_URL=https://mainnet.base.org

# Fee Collection Addresses (operator-managed, public on-chain)
# These receive the platform fee charged on each job run. They MUST NOT be
# operational hot wallets — use a cold-storage or multisig address you control.
# Document the chosen addresses in CHANGELOG.md with Solscan/Basescan links so
# users can verify the fee rate on-chain (FEE-06 / OPS-01 / D-19).
#
# Solana (base58 address):
FEE_COLLECTION_SOLANA_ADDRESS=
# Base (EIP-55 checksummed mixed-case 0x… address):
FEE_COLLECTION_BASE_ADDRESS=

# Deprecated v3.1 — was used to override the agents.memeputer.com platform fee
# endpoint. Phase 32 replaced this with a self-hosted endpoint at
# {PUBLIC_URL}/x402/fees/{network}/charge. Kept commented for one release so
# operators upgrading from v3.0 see the migration trail. Removed in v3.2.
# PLATFORM_FEE_URL=https://agents.memeputer.com/x402/solana/jobputer/job_fee

# Platform Fee Configuration
# Fee as percentage of job resource cost (v3.1: 1% = 0.01; was 1.5% in v3.0)
PLATFORM_FEE_PERCENTAGE=0.01
# Minimum fee in USDC (default $0.01, unchanged from v3.0)
PLATFORM_FEE_MINIMUM=0.01
```

### config.ts diff (FEE-05 / FEE-07 / FEE-08 / D-11)

Replace `config.ts:49-77`:

```typescript
  base: {
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    // Fee collection address for platform fees on Base. Operator-provisioned —
    // see CHANGELOG.md v3.1 for the production-deployed address.
    platformWallet: process.env.FEE_COLLECTION_BASE_ADDRESS || "",
  },

  // ... (twitter unchanged) ...

  // Platform fee configuration — self-hosted x402 fee endpoint (v3.1+).
  // Replaces the v3.0 agents.memeputer.com endpoint. Per-run snapshot in
  // x402_job_runs.platform_fee grandfathers in-flight jobs.
  platformFee: {
    resourceUrl:
      process.env.PLATFORM_FEE_URL ||
      `${process.env.PUBLIC_URL || "http://localhost:3011"}/x402/fees/solana/charge`,
    // Fee as percentage of job resource cost (v3.1: 1% = 0.01)
    percentage: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || "0.01"),
    // Minimum fee in USDC (to ensure small jobs still pay something)
    minimumUsdc: parseFloat(process.env.PLATFORM_FEE_MINIMUM || "0.01"),
    // Enable platform fee
    enabled: process.env.PLATFORM_FEE_ENABLED !== "false",
  },
```

Plus add to the startup validation block (`config.ts:128-133`):

```typescript
// Warn (don't fail) if fee collection addresses are unset — needed for any
// new job run; the fee endpoint returns 503 without them.
if (!process.env.FEE_COLLECTION_SOLANA_ADDRESS) {
  console.warn("⚠️  Warning: FEE_COLLECTION_SOLANA_ADDRESS is not set");
}
if (!process.env.FEE_COLLECTION_BASE_ADDRESS) {
  console.warn("⚠️  Warning: FEE_COLLECTION_BASE_ADDRESS is not set");
}
```

**Note for executor:** The old `BASE_PLATFORM_WALLET` env var is GONE from config.ts. `apps/api/src/lib/base.ts` reads `BASE_PLATFORM_WALLET_PRIVATE_KEY` (a DIFFERENT env var, the payout wallet's secret key) — that stays untouched. Don't conflate them.

### CHANGELOG.md skeleton (OPS-01 / D-19) — Claude's discretion on exact prose

```markdown
# Changelog

All notable changes to x402.jobs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] — 2026-MM-DD — Decouple from Memeputer infrastructure

### Changed

- **Platform fee rate reduced** from `max(1.5%, $0.01)` to `max(1%, $0.01)`. The
  `$0.01` minimum is preserved.
- **Self-hosted x402 fee endpoint.** The platform fee was previously charged
  via `agents.memeputer.com/x402/{network}/jobputer/job_fee`. As of v3.1 it is
  charged via `api.x402.jobs/x402/fees/{network}/charge`, operated by the same
  OpenFacilitator instance that powers `api.x402.jobs/@username/slug` instant
  resources. Same-network charging is preserved (Solana → Solana, Base → Base).

### Added

- New env vars:
  - `FEE_COLLECTION_SOLANA_ADDRESS` — Solana base58 address that receives
    Solana-network platform fees. Production value: `<solana-addr>` —
    [Solscan](https://solscan.io/account/<solana-addr>).
  - `FEE_COLLECTION_BASE_ADDRESS` — Base EIP-55 checksummed address that
    receives Base-network platform fees. Production value: `<base-addr>` —
    [Basescan](https://basescan.org/address/<base-addr>).
- New database column `x402_job_runs.platform_fee` (JSONB) — snapshots the fee
  config + settled tx for each run. Grandfathers in-flight jobs so the cut-over
  doesn't double-charge or miss-charge runs that were created before the deploy.

### Removed

- Hardcoded default for `BASE_PLATFORM_WALLET` (formerly
  `0xAEB58049d3C266D55595a596Fae249C10764a031`). The env var has been renamed
  to `FEE_COLLECTION_BASE_ADDRESS`. Self-hosters MUST set this to their own
  fee-collection address; there is no fallback.
- `agents.memeputer.com` URLs from the platform fee code path
  (`apps/api/src/inngest/utils/charge-platform-fee.ts` +
  `apps/api/src/config.ts#platformFee.resourceUrl`). Other `agents.memeputer.com`
  URLs remain in the dead escrow / hiring-board code paths; full removal is
  tracked for a v3.2 cleanup milestone.

### Migration notes for self-hosters

- **No backward-compatibility shim.** v3.0 → v3.1 is a clean cut-over (per the
  project's `OPS-04` convention).
- Apply database migration `011_add_platform_fee_snapshot.sql` BEFORE deploying
  the v3.1 code (it adds a nullable JSONB column — forward-safe).
- Replace `BASE_PLATFORM_WALLET=…` with `FEE_COLLECTION_BASE_ADDRESS=…` in your
  env. Add `FEE_COLLECTION_SOLANA_ADDRESS=…`. The `PLATFORM_FEE_URL` env var is
  no longer needed (it now defaults to `${PUBLIC_URL}/x402/fees/solana/charge`)
  but is commented as deprecated in `apps/api/env.example` for one release.
- In-flight jobs created BEFORE the migration land have `platform_fee = NULL`
  and continue charging the new (1%) live config — there is no
  pre-cut-over snapshot for them. Jobs created AFTER the migration but BEFORE
  the deploy flips defaults snapshot the old 1.5% config and continue charging
  that until they complete.
```

Sources for the v3.1 entry: this RESEARCH.md + CONTEXT.md. Wallet addresses come from the operator's manual provisioning task.

## 11. State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@openfacilitator/sdk@0.3.0` | `@openfacilitator/sdk@1.0.0` | 2026-02-01 (npm published) | Already installed in apps/api; SKILL.md docs match v1.0.0 |
| `OpenFacilitator` with v1-only `verify()` then `settle()` | `settle()` handles verify internally (matches instant.ts usage) | v1.0.0 | Simpler call site; one less round-trip |
| x402 v1-only responses (`maxAmountRequired`) | x402 v2 responses (CAIP-2 `network`, `amount`) with v1 compat fields retained | Sometime pre-2026 | Reuse instant.ts dual-format pattern verbatim |

## 12. Validation Architecture

Nyquist validation is enabled for this project (`.planning/config.json` has no `workflow.nyquist_validation` key — treat as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.8 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter x402-jobs-api test` (from repo root) — runs all `src/**/*.test.ts` |
| Full suite command | Same — there's no separate "full" suite; Vitest scope is one project |
| Pre-set env var | `FACILITATOR_URL=http://localhost:9999` (vitest.config.ts:14) — already in place; new tests inherit |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FEE-01 | Endpoint mounts at `/x402/fees/:network/charge` | unit (route registration) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "mounts"` | ❌ Wave 2 |
| FEE-02 | OpenFacilitator settle() called correctly | unit (mocked facilitator) | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "settle"` | ❌ Wave 2 |
| FEE-03 | 402 response is x402lint-valid | unit (fixture comparison) + manual lint check | `pnpm --filter x402-jobs-api test src/routes/__tests__/x402-fees.test.ts -t "402"` | ❌ Wave 2 |
| FEE-04 | Solana request charges Solana fee, Base charges Base | unit (per-network branches) | Same test file, different describes | ❌ Wave 2 |
| FEE-05 | Default rate is 1% | unit (config.ts test or grep-test) | Inline assert in any test that imports config | ✅ inherited |
| FEE-06 | Wallet env vars validated at startup | manual (Railway env var inspection) | n/a — manual STATE.md task | manual |
| FEE-07 | env.example reflects new defaults | manual or grep-test | `grep -E "FEE_COLLECTION_(SOLANA\|BASE)_ADDRESS" apps/api/env.example` | manual |
| FEE-08 | No `agents.memeputer.com` in `charge-platform-fee.ts`/`config.ts#platformFee` | grep-test | `! grep "agents.memeputer.com" apps/api/src/inngest/utils/charge-platform-fee.ts apps/api/src/config.ts` (negative grep) | ❌ Wave 5 |
| FEE-09 | Refund flow works with new fee endpoint snapshot | integration | `pnpm --filter x402-jobs-api test src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` | ❌ Wave 4 |
| FEE-10 | In-flight job snapshot routes to OLD URL | unit (mocked executeX402Request) | `pnpm --filter x402-jobs-api test src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts` | ❌ Wave 3 |
| OPS-01 | CHANGELOG.md v3.1 entry exists with both wallet addresses | grep-test | `grep -E "FEE_COLLECTION_(SOLANA\|BASE)_ADDRESS" CHANGELOG.md` | ❌ Wave 5 |
| OPS-02 | env.example reflects new defaults + deprecated PLATFORM_FEE_URL comment | grep-test | `grep "DEPRECATED v3.1" apps/api/env.example` | ❌ Wave 5 |
| OPS-04 | No shim added | code review / grep | `! grep -E "shim\|compat" apps/api/src/inngest/utils/charge-platform-fee.ts` | manual review |

### Sampling Rate
- **Per task commit:** `pnpm --filter x402-jobs-api typecheck && pnpm --filter x402-jobs-api lint && pnpm --filter x402-jobs-api test <touched-file-pattern>`
- **Per wave merge:** `pnpm --filter x402-jobs-api test` (full suite)
- **Phase gate:** Full suite green + manual `npx x402lint` check on captured 402 + manual CHANGELOG.md review before `/gsd-verify-work`

### Wave 0 Gaps

The existing test infrastructure (Vitest, mocks, fixtures, `FACILITATOR_URL` pre-set) is **sufficient**. No framework install needed.

- [ ] `apps/api/src/routes/__tests__/x402-fees.test.ts` — covers FEE-01..04 (Wave 2)
- [ ] `apps/api/src/routes/__tests__/refunds-with-new-fee-endpoint.test.ts` — covers FEE-09 (Wave 4)
- [ ] `apps/api/src/inngest/functions/run-workflow/__tests__/grandfather-fee.test.ts` — covers FEE-10 (Wave 3)
- [ ] (optional) `apps/api/src/inngest/utils/__tests__/platform-fee-snapshot.test.ts` — covers the new `buildPlatformFeeSnapshot()` helper

No new test framework, no new shared fixtures needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SOLANA_FACILITATOR_ADDRESS` default `561oabzy81vXYYbs1ZHR1bvpiEr6Nbfd6PGTxPshoz4p` is the production facilitator's actual fee payer | §9 risk 4 | If wrong, Solana fee transactions fail with "wrong fee payer" — surfaces as 500 from `executeX402Request` |
| A2 | The new `/x402/fees/{net}/charge` endpoint should accept caller-supplied `amount_usdc` (vs. fixed price) | §7, §9 OQ-1 | If user wants fixed price, plan needs a server-side fee-amount lookup table; not load-bearing for Phase 32 SC |
| A3 | Grandfather test placement under `run-workflow/__tests__/` is acceptable to user (CONTEXT.md said different path) | §6, §9 OQ-3 | Low — Claude's-discretion area |
| A4 | x402lint validation can be split: unit fixture + manual PR-time `npx x402lint` check (no programmatic SDK in repo) | §3.4 | If user wants only programmatic CI gating, the planner must wire `npx x402lint` into the CI workflow (one additional step in `.github/workflows/ci.yml`) |
| A5 | Caller-supplied amount on the fee endpoint is safe without auth because x402 is the auth (anyone can pay, no one can drain) | §9 OQ-2 | Low — matches `instant.ts` posture |

If the user wants any of these flipped, surface during discuss-phase or plan-checker before the wave-2 commit lands.

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: ripgrep apps/**/*.ts]` — All grep claims for D-12 audit
- `[VERIFIED: apps/api/package.json:24]` — SDK version pin `@openfacilitator/sdk: ^1.0.0`
- `[VERIFIED: apps/api/node_modules/@openfacilitator/sdk/package.json]` — Installed version `1.0.0`
- `[VERIFIED: npm view @openfacilitator/sdk version, time]` — Latest 1.0.0 published 2026-02-01
- `[VERIFIED: apps/api/src/routes/instant.ts:30-44, 238-241, 246-353, 357-436]` — OpenFacilitator + 402-response reuse pattern
- `[VERIFIED: apps/api/migrations/001_initial_schema.sql:947-983]` — `x402_job_runs` current schema
- `[VERIFIED: filesystem ls apps/api/migrations/]` — migration 010 is highest; 011 is next free
- `[VERIFIED: apps/api/src/index.ts]` — Route mount order; no proxy
- `[VERIFIED: apps/api/Dockerfile]` — Railway-only deploy, no path rewriting
- `[VERIFIED: apps/api/vitest.config.ts]` — Vitest config + FACILITATOR_URL pre-set
- `[CITED: ~/.claude/skills/x402lint/SKILL.md]` — v2 schema, CAIP-2 rules, error codes
- `[CITED: ~/.claude/skills/openfacilitator/SKILL.md]` — SDK API, settle/verify pattern, USDC asset addresses
- `[VERIFIED: apps/api/src/routes/refunds.ts:1-265]` — Refund flow current behaviour
- `[VERIFIED: apps/api/src/inngest/functions/run-workflow/__tests__/escrow.test.ts]` — Test pattern analog

### Secondary (MEDIUM confidence)
- `[CITED: .planning/codebase/STACK.md:73]` — STALE on SDK version; flagged in §11

### Tertiary (LOW confidence)
- None. All findings in this research are sourced from the codebase, official skill files, or npm registry. No WebSearch was needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All versions verified against npm + installed
- Architecture (route mount, snapshot column, migration): HIGH — Codebase has matching precedent in 5+ places
- Wider-grep findings (D-12): HIGH — Exhaustive ripgrep with multiple patterns
- Test patterns: HIGH — Direct analog (escrow.test.ts) read verbatim
- Refund audit: HIGH — File read end-to-end
- Risks / open questions: MEDIUM — Reasoned from code shape; some user-discretion items (OQ-1, OQ-2)

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stable backend stack; refresh if `@openfacilitator/sdk` or `x402check` ships a major version)

## RESEARCH COMPLETE
