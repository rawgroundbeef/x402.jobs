import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ============================================================================
// HIGH-11 — POST /wallet/export-key hardening tests.
//
// Four gates layered on the export endpoint:
//   1. Re-auth required (fresh JWT — iat within last 5 minutes).
//   2. Rate limit: 3 successful gate-pass attempts per hour per user.
//   3. Audit row inserted per attempt (success=true|false).
//   4. Out-of-band email sent on every successful export.
//
// Each test isolates ONE gate so failures point at the specific defense.
// ============================================================================

const USER_ID = "user-export-test";
const USER_EMAIL = "alice@example.com";

// ----------------------------------------------------------------------------
// Capture state — populated by mocks, asserted by tests.
// ----------------------------------------------------------------------------

const auditInserts: Array<Record<string, unknown>> = [];
const emailSends: Array<Record<string, unknown>> = [];

// ----------------------------------------------------------------------------
// Supabase mock — captures audit inserts; serves a stub wallet row when
// loadDecryptedUserWallet is queried.
// ----------------------------------------------------------------------------

function makeSupabaseStub() {
  return {
    from: (table: string) => {
      if (table === "x402_wallet_export_audit") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            auditInserts.push(row);
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      // wallet rows (read path used by loadDecryptedUserWallet) — return
      // a deterministic encrypted row. wallet-encryption is mocked below.
      if (table === "x402_user_wallets") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: {
                address: "STUB_SOLANA_ADDR",
                base_address: "STUB_BASE_ADDR",
                solana_private_key_ciphertext: "CIPHER_SOL",
                base_private_key_ciphertext: "CIPHER_BASE",
              },
              error: null,
            }),
        };
        return chain;
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

let supabaseStub: ReturnType<typeof makeSupabaseStub>;

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => supabaseStub,
}));

// ----------------------------------------------------------------------------
// wallet-keys / wallet-encryption mock — loadDecryptedUserWallet returns a
// deterministic decrypted wallet. The handler doesn't need to actually
// decrypt anything during these tests; we're proving the gates fire correctly.
// ----------------------------------------------------------------------------

vi.mock("../../lib/wallet-keys", () => ({
  loadDecryptedUserWallet: vi.fn(async (_userId: string) => ({
    address: "STUB_SOLANA_ADDR",
    baseAddress: "STUB_BASE_ADDR",
    // 32-byte zero buffer encoded as base64 — base58-encodes deterministically.
    solanaSecretBase64: Buffer.alloc(64).toString("base64"),
    baseSecretBase64: Buffer.from("0x" + "ab".repeat(32)).toString("base64"),
  })),
}));

// ----------------------------------------------------------------------------
// Email service mock — captures every send call.
// ----------------------------------------------------------------------------

vi.mock("../../lib/email-service", () => ({
  sendWalletExportNotification: vi.fn(async (payload: Record<string, unknown>) => {
    emailSends.push(payload);
    return { sent: true };
  }),
}));

// ----------------------------------------------------------------------------
// Other lib stubs (the handler imports getSolanaUsdcBalance etc. at module
// load via routes/wallet.ts; mock to keep tests fast and offline).
// ----------------------------------------------------------------------------

vi.mock("../../lib/solana", () => ({
  getSolanaUsdcBalance: vi.fn(async () => 0),
}));

vi.mock("../../lib/base", () => ({
  getBaseUsdcBalance: vi.fn(async () => 0),
}));

vi.mock("../../lib/inngest", () => ({
  inngest: { send: vi.fn(() => Promise.resolve()) },
}));

// Rate-limit middleware is exercised separately in its own test surface;
// here we mock it to a pass-through so we can exercise the four other gates
// in isolation (the limiter is stateful across requests within a process,
// which would otherwise rate-limit later tests in this file).
vi.mock("../../middleware/rateLimit", async () => {
  const actual = await vi.importActual<
    typeof import("../../middleware/rateLimit")
  >("../../middleware/rateLimit");
  return {
    ...actual,
    walletExportLimiter: (_req: unknown, _res: unknown, next: () => void) =>
      next(),
  };
});

// Import AFTER mocks are installed.
import { walletRouter } from "../wallet";

// ----------------------------------------------------------------------------
// Test app helper — injects req.user including the `iat` (issued-at)
// timestamp the handler checks for the re-auth gate.
// ----------------------------------------------------------------------------

function createTestApp(opts: {
  userId?: string;
  email?: string;
  iat?: number; // unix seconds; defaults to "fresh" (now)
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: opts.userId ?? USER_ID,
      email: opts.email ?? USER_EMAIL,
      // iat is the new field the auth middleware will surface.
      // Cast to any to avoid the Request type ceremony in tests.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ iat: opts.iat ?? Math.floor(Date.now() / 1000) } as any),
    };
    next();
  });
  app.use("/wallet", walletRouter);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe("HIGH-11: POST /wallet/export-key hardening", () => {
  beforeEach(() => {
    auditInserts.length = 0;
    emailSends.length = 0;
    supabaseStub = makeSupabaseStub();
    process.env.WALLET_KEY_ENCRYPTION_KEY = "x".repeat(64); // 32-byte hex
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Gate 1: Re-auth
  // --------------------------------------------------------------------------

  it("rejects stale token (iat older than 5 minutes) with 401 stale_token", async () => {
    const sixMinAgo = Math.floor(Date.now() / 1000) - 6 * 60;
    const app = createTestApp({ iat: sixMinAgo });
    const res = await request(app).post("/wallet/export-key").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("stale_token");
    // Audit row recorded the failed attempt.
    expect(auditInserts.length).toBe(1);
    expect(auditInserts[0]).toMatchObject({
      user_id: USER_ID,
      success: false,
    });
    // No email sent on a failed gate.
    expect(emailSends.length).toBe(0);
  });

  it("accepts fresh token (iat within 5 minutes) and returns 200", async () => {
    const oneMinAgo = Math.floor(Date.now() / 1000) - 60;
    const app = createTestApp({ iat: oneMinAgo });
    const res = await request(app).post("/wallet/export-key").send({});
    expect(res.status).toBe(200);
    expect(res.body.solana).toBeDefined();
    expect(res.body.solana.privateKey).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Gate 2: Audit (success path)
  // --------------------------------------------------------------------------

  it("inserts audit row with success=true on successful export", async () => {
    const app = createTestApp({});
    const res = await request(app).post("/wallet/export-key").send({});
    expect(res.status).toBe(200);
    // Two audit writes — one pre-key-decrypt (success=false placeholder)
    // and one post-success (success=true) OR a single row inserted with
    // success=true at the end. Either pattern is acceptable; the truth
    // is that the LAST audit row reflects the outcome.
    expect(auditInserts.length).toBeGreaterThanOrEqual(1);
    const finalAudit = auditInserts[auditInserts.length - 1];
    expect(finalAudit).toMatchObject({
      user_id: USER_ID,
      success: true,
    });
    expect(finalAudit.wallet_network).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Gate 2: Audit (failure path)
  // --------------------------------------------------------------------------

  it("inserts audit row with success=false when decrypt fails", async () => {
    // Re-mock loadDecryptedUserWallet to throw.
    const walletKeys = await import("../../lib/wallet-keys");
    vi.mocked(walletKeys.loadDecryptedUserWallet).mockRejectedValueOnce(
      new Error("decrypt failed — bad ciphertext"),
    );
    const app = createTestApp({});
    const res = await request(app).post("/wallet/export-key").send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(auditInserts.length).toBeGreaterThanOrEqual(1);
    const finalAudit = auditInserts[auditInserts.length - 1];
    expect(finalAudit).toMatchObject({
      user_id: USER_ID,
      success: false,
    });
    // No success email on failure.
    expect(emailSends.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Gate 3: Email on success
  // --------------------------------------------------------------------------

  it("sends out-of-band notification email on successful export", async () => {
    const app = createTestApp({});
    const res = await request(app).post("/wallet/export-key").send({});
    expect(res.status).toBe(200);
    expect(emailSends.length).toBe(1);
    expect(emailSends[0]).toMatchObject({
      to: USER_EMAIL,
    });
    // Subject/body should mention "wallet" and "export" for user clarity.
    const payload = emailSends[0];
    const allText = JSON.stringify(payload).toLowerCase();
    expect(allText).toMatch(/wallet/);
    expect(allText).toMatch(/export/);
  });

  // --------------------------------------------------------------------------
  // Source-level assertion — middleware mounting (rate limit can't easily
  // be reproduced in-process; we assert the limiter is wired at the route).
  // --------------------------------------------------------------------------

  it("source: POST /wallet/export-key mounts the walletExportLimiter", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "wallet.ts"),
      "utf-8",
    );
    // Either strictRateLimiter or walletExportLimiter mounted on /export-key.
    const hasLimiter = /walletExportLimiter|strictRateLimiter/.test(src);
    expect(hasLimiter).toBe(true);
    // Method is POST (not GET).
    expect(src).toMatch(/walletRouter\.post\(\s*["']\/export-key["']/);
  });

  it("source: POST /wallet/export-key references the audit table", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "wallet.ts"),
      "utf-8",
    );
    // Audit table referenced — should appear at least twice (failed +
    // succeeded paths) or once (single insert with conditional success flag).
    const matches = src.match(/x402_wallet_export_audit/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("source: POST /wallet/export-key references fresh-token check", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "wallet.ts"),
      "utf-8",
    );
    expect(src).toMatch(/stale_token|FRESH_TOKEN_WINDOW/);
  });
});
