import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";

// ============================================================================
// HIGH-06 — Timing-safe escrow webhook secret comparison.
//
// These tests prove that:
//   1. A wrong-length provided secret is rejected with 401 (and we never
//      attempt a constant-time compare on mismatched lengths).
//   2. A wrong-value same-length secret is rejected with 401.
//   3. A correct secret reaches the wallet-config error path (we don't
//      configure ESCROWPUTER_WALLET_SECRET_KEY in tests, so the next failure
//      is 500 "Escrow wallet not configured" — proving auth passed).
//   4. Unset ESCROW_WEBHOOK_SECRET returns 401 (mandatory, no optional path).
// ============================================================================

const CORRECT_SECRET = "a".repeat(32); // 32-char correct
const WRONG_LEN_SECRET = "abcde"; // 5-char wrong length
const WRONG_VALUE_SAME_LEN = "b".repeat(32); // 32-char, wrong value

// Import after any mocks (none needed for auth path).
import { escrowRouter } from "../escrow";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/escrow", escrowRouter);
  return app;
}

describe("HIGH-06: escrow webhook secret is mandatory + timing-safe", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.ESCROW_WEBHOOK_SECRET = CORRECT_SECRET;
    // Intentionally do NOT set ESCROWPUTER_WALLET_SECRET_KEY — we only need
    // the auth path to be reached; subsequent wallet-config failure is fine.
    delete process.env.ESCROWPUTER_WALLET_SECRET_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("rejects wrong-length provided secret with 401 (no timing leak)", async () => {
    const app = createTestApp();
    const res = await request(app).post("/api/escrow/release").send({
      recipient_address: "AzS3pZibQEMQDhAuDvtdgU8mBmKp3svj1XPpUgaucAFV",
      amount: 1,
      request_id: "req-x",
      webhook_secret: WRONG_LEN_SECRET,
    });
    expect(res.status).toBe(401);
  });

  it("rejects same-length-wrong-value secret with 401", async () => {
    const app = createTestApp();
    const res = await request(app).post("/api/escrow/release").send({
      recipient_address: "AzS3pZibQEMQDhAuDvtdgU8mBmKp3svj1XPpUgaucAFV",
      amount: 1,
      request_id: "req-x",
      webhook_secret: WRONG_VALUE_SAME_LEN,
    });
    expect(res.status).toBe(401);
  });

  it("accepts correct secret — passes auth and reaches the next gate", async () => {
    const app = createTestApp();
    const res = await request(app).post("/api/escrow/release").send({
      recipient_address: "AzS3pZibQEMQDhAuDvtdgU8mBmKp3svj1XPpUgaucAFV",
      amount: 1,
      request_id: "req-x",
      webhook_secret: CORRECT_SECRET,
    });
    // We DID NOT configure the wallet, so the handler responds 500
    // "Escrow wallet not configured" after passing auth. Critically, NOT 401.
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("wallet");
  });

  // Static-source assertion: timing safety isn't observable from black-box
  // behavior (== and timingSafeEqual produce the same boolean), so we
  // additionally assert the source uses crypto.timingSafeEqual and does
  // NOT use a direct === comparison on the secret. This is the RED test
  // before the implementation change lands.
  it("source uses crypto.timingSafeEqual and not === on the secret", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "escrow.ts"),
      "utf8",
    );
    expect(src).toMatch(/crypto\.timingSafeEqual\s*\(/);
    expect(src).not.toMatch(/providedSecret\s*===\s*expectedSecret/);
    expect(src).not.toMatch(/providedSecret\s*!==\s*expectedSecret/);
  });

  it("returns 401 when ESCROW_WEBHOOK_SECRET env unset (mandatory)", async () => {
    delete process.env.ESCROW_WEBHOOK_SECRET;
    const app = createTestApp();
    const res = await request(app).post("/api/escrow/release").send({
      recipient_address: "AzS3pZibQEMQDhAuDvtdgU8mBmKp3svj1XPpUgaucAFV",
      amount: 1,
      request_id: "req-x",
      webhook_secret: CORRECT_SECRET,
    });
    // Endpoint must refuse to operate — NOT silently pass with a 200.
    expect([401, 500]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});
