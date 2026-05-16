import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ============================================================================
// HIGH-12 — Public run-shape redaction integration test.
//
// Proves that the public GET /api/runs endpoint redacts `payer_address`
// (truncated 6+4) and hashes `payment_signature` (16 hex chars) before
// returning the response.
// ============================================================================

const TEST_USER_ID = "user-A";
const FULL_ADDR = "0xabcdef1234567890abcdef1234567890abcdef12";
const FULL_SIG =
  "5KQwrPbwdL6PhXujxW37FSSQZ1JiCwjN9wQDfn3ePyTHr8gKLYHmGB1HVZdyZ" +
  "GxV9p9Sv9d4P3xMqYvb9q4hWp1Z";

// ============================================================================
// Mocks
// ============================================================================

// Single mutable row store + builder used by all paths in routes/runs.ts.
type Row = Record<string, unknown>;
const rowStore: Record<string, Row[]> = {};

function makeBuilder(table: string) {
  const rows: Row[] = rowStore[table] || [];
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() =>
      Promise.resolve({
        data: rows[0] || null,
        error: rows[0] ? null : new Error("not found"),
      }),
    ),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: rows[0] || null, error: null }),
    ),
    then: undefined,
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
  };
  // Make builder "thenable" for `await query` usage in /runs handler.
  builder.then = (resolve: any) =>
    resolve({ data: rows, error: null, count: rows.length });
  return builder;
}

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

vi.mock("../../lib/inngest", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("../../lib/wallet-keys", () => ({
  loadDecryptedUserWallet: vi.fn(() => Promise.resolve(null)),
}));

import { runsRouter } from "../runs";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: TEST_USER_ID, email: "a@example.com" };
    next();
  });
  app.use("/api/runs", runsRouter);
  return app;
}

describe("HIGH-12: public run shapes redact payer + hash signature", () => {
  beforeEach(() => {
    // Pre-populate the run-list query with a row that contains the full
    // payer_address and payment_signature.
    rowStore["x402_job_runs"] = [
      {
        id: "run-1",
        status: "completed",
        inputs: {},
        total_cost: 0.01,
        resources_total: 1,
        resources_completed: 1,
        resources_failed: 0,
        error: null,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-01T00:00:01Z",
        total_payment: "0.01",
        payment_signature: FULL_SIG,
        creator_markup_earned: "0",
        payer_address: FULL_ADDR,
        payment_network: "solana",
        triggered_by: "manual",
        job: null,
        refund: null,
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of Object.keys(rowStore)) delete rowStore[k];
  });

  it("GET /api/runs returns redacted payer_address and 16-hex payment_signature", async () => {
    const app = createTestApp();
    const res = await request(app).get("/api/runs");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
    const run = res.body.runs[0];

    // Redacted payer_address: 6 + '...' + 4
    expect(run.payer_address).toBeDefined();
    expect(run.payer_address).not.toBe(FULL_ADDR);
    expect(run.payer_address).toContain("...");
    // Must start with first-6 and end with last-4 of the original.
    expect(run.payer_address.startsWith(FULL_ADDR.slice(0, 6))).toBe(true);
    expect(run.payer_address.endsWith(FULL_ADDR.slice(-4))).toBe(true);

    // Hashed payment_signature: 16 lowercase hex chars, not the original.
    expect(run.payment_signature).toBeDefined();
    expect(run.payment_signature).not.toBe(FULL_SIG);
    expect(run.payment_signature).toMatch(/^[0-9a-f]{16}$/);
  });
});
