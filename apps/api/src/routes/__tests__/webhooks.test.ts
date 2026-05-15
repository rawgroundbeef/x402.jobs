// Tests for verifyParsedSolanaPayment — the pure parsed-tx verifier extracted
// from verifySolanaPayment as part of the HIGH-07 + HIGH-10 fix.
//
// HIGH-07: verifier must check `info.destination === recipient's USDC ATA`.
//          Before the fix, the recipient was `_recipientWallet` (ignored).
// HIGH-10: verifier must reject legacy `parsed.type === 'transfer'` (mint
//          cannot be inferred) and reject `transferChecked` with non-USDC mint.
//
// We pre-set FACILITATOR_URL because importing webhooks.ts triggers a
// module-load throw if it's unset. Setting it BEFORE the dynamic import
// satisfies the guard; the facilitator instance is never exercised here.
process.env.FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:9999";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { buildFixtures, RECIPIENT_WALLET, type SolanaParsedTxFixtures } from "./fixtures/solana-parsed-tx";
import { verifyParsedSolanaPayment } from "../webhooks";

describe("verifyParsedSolanaPayment — HIGH-07 + HIGH-10", () => {
  let fixtures: SolanaParsedTxFixtures;

  beforeAll(async () => {
    fixtures = await buildFixtures();
  });

  it("accepts transferChecked with USDC mint and correct recipient ATA", async () => {
    const result = await verifyParsedSolanaPayment(
      fixtures.validTx,
      RECIPIENT_WALLET,
      "mainnet",
      100000n,
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects transferChecked with wrong destination ATA (HIGH-07)", async () => {
    const result = await verifyParsedSolanaPayment(
      fixtures.wrongDestinationTx,
      RECIPIENT_WALLET,
      "mainnet",
      100000n,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("wrong_destination");
  });

  it("rejects transferChecked with wrong mint (HIGH-10)", async () => {
    const result = await verifyParsedSolanaPayment(
      fixtures.wrongMintTx,
      RECIPIENT_WALLET,
      "mainnet",
      100000n,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("wrong_mint");
  });

  it("rejects legacy transfer instructions outright (HIGH-10)", async () => {
    const result = await verifyParsedSolanaPayment(
      fixtures.legacyTransferTx,
      RECIPIENT_WALLET,
      "mainnet",
      100000n,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("legacy_transfer_rejected");
  });
});

// ============================================================================
// HIGH-09 (Phase 28-06) — Run-status URL signature verification on GET.
//
// Two GET handlers protect the same data behind two URL shapes:
//   1. webhooksRouter.get("/:jobId/runs/:runId/status")
//   2. jobsWebhookRouter.get("/@:username/:jobSlug/runs/:runId/status")
//
// Both must:
//   - In default (REQUIRE_STATUS_SIGNATURE unset/false) mode: accept
//     unsigned URLs (legacy compat) AND signed URLs (new flow). A present-
//     but-invalid sig still 401s — partial enforcement is real enforcement.
//   - In strict (REQUIRE_STATUS_SIGNATURE=true) mode: missing OR invalid
//     sig returns 401.
//
// We exercise only the first handler (the second is structurally identical
// and reuses the same helpers — separate tests would just re-test
// verifyStatusSignature, which already has unit coverage in
// run-status-signing.test.ts).
//
// The handler is read-only and only reads from Supabase; we stub the
// Supabase chain to return a deterministic run row so the assertion is
// purely about signature enforcement vs. response status.
// ============================================================================

const RUN_ID = "abcd1234-aaaa-bbbb-cccc-deadbeef0001";
const JOB_ID = "job-abc-001";

// Test secret (≥32 chars to satisfy getSecret()).
const TEST_SECRET = "test-secret-at-least-32-chars-long-aaaa";

// ----------------------------------------------------------------------------
// Supabase stub — every read against x402_job_runs returns the canned run;
// every read against x402_job_run_events returns an empty list.
// ----------------------------------------------------------------------------

function makeSupabaseStub() {
  const stub = {
    from: (table: string) => {
      if (table === "x402_job_runs") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          single: () =>
            Promise.resolve({
              data: {
                id: RUN_ID,
                status: "completed",
                error: null,
                total_cost: 0.5,
                resources_completed: 1,
                resources_total: 1,
                completed_at: new Date().toISOString(),
              },
              error: null,
            }),
        };
        return chain;
      }
      if (table === "x402_job_run_events") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          order: () => Promise.resolve({ data: [], error: null }),
        };
        return chain;
      }
      const fallback: any = {
        select: () => fallback,
        eq: () => fallback,
        single: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      };
      return fallback;
    },
  };
  return stub;
}

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => makeSupabaseStub(),
}));

// inngest / wallet-keys / solana — never called by the GET path, but the
// module-load side effects in webhooks.ts wire them. Stub to keep tests
// offline and fast.
vi.mock("../../lib/inngest", () => ({
  inngest: { send: vi.fn(() => Promise.resolve()) },
}));

vi.mock("../../lib/wallet-keys", () => ({
  loadDecryptedUserWallet: vi.fn(async () => null),
}));

vi.mock("../../lib/solana", () => ({
  getSolanaConnection: vi.fn(() => ({})),
}));

vi.mock("../../indexers/helius", () => ({
  processHeliusWebhook: vi.fn(async () => ({
    processed: 0,
    matched: 0,
    errors: 0,
  })),
}));

vi.mock("@openfacilitator/sdk", () => ({
  OpenFacilitator: vi.fn().mockImplementation(() => ({})),
}));

// ----------------------------------------------------------------------------
// Helpers: build a signed URL query for the test runId.
//
// The secret is read inside signStatusUrl() at call time, not at import
// time — safe to import once at the top and rely on beforeEach to set
// WEBHOOK_SIGNING_SECRET before each test.
// ----------------------------------------------------------------------------

// Import the helper directly (not a re-import inside each test) — the
// secret is read at call time, not at import time, so a top-level import
// is safe.
import { signStatusUrl } from "../../lib/run-status-signing";

function freshSignedQuery(): { sig: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sig = signStatusUrl(RUN_ID, exp);
  return { sig, exp };
}

// ----------------------------------------------------------------------------
// App factory — mount the webhooks router under /api/webhooks like prod.
// ----------------------------------------------------------------------------

async function makeApp() {
  // Import after mocks are in place.
  const { webhooksRouter } = await import("../webhooks");
  const app = express();
  app.use(express.json());
  app.use("/api/webhooks", webhooksRouter);
  return app;
}

describe("GET /api/webhooks/:jobId/runs/:runId/status — HIGH-09 signature gate", () => {
  beforeEach(() => {
    process.env.WEBHOOK_SIGNING_SECRET = TEST_SECRET;
    // Ensure the strict-mode flag is unset between tests; individual tests
    // opt in explicitly.
    delete process.env.REQUIRE_STATUS_SIGNATURE;
  });

  afterEach(() => {
    delete process.env.REQUIRE_STATUS_SIGNATURE;
  });

  it("legacy accept: no sig + REQUIRE_STATUS_SIGNATURE unset → 200", async () => {
    const app = await makeApp();
    const res = await request(app).get(
      `/api/webhooks/${JOB_ID}/runs/${RUN_ID}/status`,
    );
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(RUN_ID);
  });

  it("strict mode: no sig + REQUIRE_STATUS_SIGNATURE=true → 401 signature_required", async () => {
    process.env.REQUIRE_STATUS_SIGNATURE = "true";
    const app = await makeApp();
    const res = await request(app).get(
      `/api/webhooks/${JOB_ID}/runs/${RUN_ID}/status`,
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("signature_required");
  });

  it("valid signed URL → 200 (in either mode)", async () => {
    const { sig, exp } = freshSignedQuery();
    const app = await makeApp();
    const res = await request(app).get(
      `/api/webhooks/${JOB_ID}/runs/${RUN_ID}/status?sig=${sig}&exp=${exp}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(RUN_ID);
  });

  it("tampered sig → 401 invalid_signature (even when not strict)", async () => {
    const { sig, exp } = freshSignedQuery();
    const tampered = sig.startsWith("a")
      ? "b" + sig.slice(1)
      : "a" + sig.slice(1);
    const app = await makeApp();
    const res = await request(app).get(
      `/api/webhooks/${JOB_ID}/runs/${RUN_ID}/status?sig=${tampered}&exp=${exp}`,
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_signature");
  });

  it("expired exp → 401 invalid_signature", async () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const sig = signStatusUrl(RUN_ID, exp);
    const app = await makeApp();
    const res = await request(app).get(
      `/api/webhooks/${JOB_ID}/runs/${RUN_ID}/status?sig=${sig}&exp=${exp}`,
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_signature");
  });
});
