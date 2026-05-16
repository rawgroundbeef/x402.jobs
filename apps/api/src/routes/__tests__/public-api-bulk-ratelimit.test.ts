import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ============================================================================
// Rate-limit bucket separation test.
//
// This file deliberately does NOT mock `bulkResourceRateLimiter` so the real
// rate-limit middleware runs. We mock minute/hour limiters as pass-through
// so they don't interfere. The bulk bucket caps at 6 req/min per API key; the
// 7th request should return HTTP 429.
//
// Run as a separate file so the module cache of public-api.ts sees the real
// bulkResourceRateLimiter at import time.
// ============================================================================

const VALID_API_KEY = "test_api_key_12345";

// Inline chainable supabase mock — minimal, since these tests only care about
// the 429 outcome.
function createChainableMock() {
  const mock: any = { data: null, error: null };
  mock.select = vi.fn(() => mock);
  mock.insert = vi.fn(() => mock);
  mock.update = vi.fn(() => mock);
  mock.eq = vi.fn(() => mock);
  mock.neq = vi.fn(() => mock);
  mock.order = vi.fn(() => mock);
  mock.range = vi.fn(() => mock);
  mock.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null }),
  );
  mock.single = vi.fn(() =>
    Promise.resolve({
      data: {
        id: "r1",
        name: "r1",
        slug: "r1",
        server_id: "server-123",
        network: "solana",
        category: "api",
        resource_url: "https://example.com/r1",
        created_at: new Date().toISOString(),
      },
      error: null,
    }),
  );
  return mock;
}

let supabaseMock: ReturnType<typeof createChainableMock>;

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => ({ from: () => supabaseMock }),
}));

vi.mock("../../middleware/apiKey", () => ({
  apiKeyMiddleware: (req: any, _res: any, next: any) => {
    req.apiKey = {
      id: "api-key-id-123",
      name: "Test API Key",
      created_by: "user-123",
      tier: "free",
    };
    next();
  },
}));

// Pass-through for the broader minute/hour limiters; bulk uses the REAL one.
vi.mock("../../middleware/rateLimit", async () => {
  const actual: any = await vi.importActual("../../middleware/rateLimit");
  return {
    minuteRateLimiter: (_req: any, _res: any, next: any) => next(),
    hourlyRateLimiter: (_req: any, _res: any, next: any) => next(),
    publicRateLimiter: (_req: any, _res: any, next: any) => next(),
    discoveryApiRateLimiter: (_req: any, _res: any, next: any) => next(),
    // Use the REAL bulk rate limiter (this is the whole point of this file).
    bulkResourceRateLimiter: actual.bulkResourceRateLimiter,
  };
});

vi.mock("../servers", () => ({
  getOrCreateServer: vi.fn().mockResolvedValue({
    id: "server-123",
    slug: "example-com",
    origin_url: "https://example.com",
    name: "example.com",
    verified_owner_id: null,
    registered_by: "user-123",
  }),
}));

vi.mock("../resources", () => ({
  cacheImage: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("dns", () => ({
  promises: {
    lookup: vi
      .fn()
      .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
  },
}));

import { publicApiRouter } from "../public-api";

function createTestApp() {
  const app = express();
  // express-rate-limit needs req.ip to be set; in tests the
  // app-trust-proxy default is fine since the key generator falls back
  // by API key id, which we set in the apiKey middleware mock.
  app.use(express.json());
  app.use("/api/v1", publicApiRouter);
  return app;
}

describe("POST /api/v1/resources/bulk — rate-limit bucket", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = createChainableMock();
    app = createTestApp();
    global.fetch = vi.fn().mockResolvedValue({
      status: 402,
      headers: { get: () => null },
      json: () =>
        Promise.resolve({
          accepts: [
            { network: "solana", payTo: "test_wallet", maxAmountRequired: "1" },
          ],
        }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 429 on the 7th request within a minute from the same API key", async () => {
    const body = {
      resources: [
        { name: "r1", resource_url: "https://example.com/r1" },
      ],
    };

    // First 6 requests should succeed (return 200, structurally valid).
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send(body);
      expect(res.status).toBe(200);
    }

    // 7th request → 429 from the bulk limiter.
    const res7 = await request(app)
      .post("/api/v1/resources/bulk")
      .set("x-api-key", VALID_API_KEY)
      .send(body);
    expect(res7.status).toBe(429);
    expect(res7.body.error).toBe("Too Many Requests");
    expect(res7.body.message).toMatch(/bulk/i);
  });
});
