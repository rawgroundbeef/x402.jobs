import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ============================================================================
// Constants
// ============================================================================

const VALID_API_KEY = "test_api_key_12345";
const VALID_USER_ID = "user-123";
const OTHER_USER_ID = "user-other";

// ============================================================================
// Mocks — hoisted by vitest
// ============================================================================

// Per-call supabase mock. Each .from() call creates a FRESH chain object so
// concurrent bulk-item flows don't contaminate each other's state. Behavior
// is keyed off the filter columns seen in the chain:
//   - eq("normalized_url", X) → maybeSingle() returns scripted row by URL
//   - eq("slug", ...) → maybeSingle() always returns null (no collision)
//   - insert(...).select().single() → echoes payload + synthetic id/slug
//   - update(...).eq("id", X).select().single() → merged baseRow ∪ payload
function createChainableMock() {
  const existingByNormalizedUrl = new Map<string, any>();
  const existingById = new Map<string, any>();

  function makeChain() {
    const chain: any = {};
    const filters: Record<string, any> = {};
    let pendingInsertPayload: any = null;
    let pendingUpdatePayload: any = null;

    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn((payload: any) => {
      pendingInsertPayload = payload;
      return chain;
    });
    chain.update = vi.fn((payload: any) => {
      pendingUpdatePayload = payload;
      return chain;
    });
    chain.eq = vi.fn((column: string, value: any) => {
      filters[column] = value;
      return chain;
    });
    chain.neq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.range = vi.fn(() => chain);

    chain.maybeSingle = vi.fn(async () => {
      if (filters.normalized_url !== undefined) {
        const existing = existingByNormalizedUrl.get(filters.normalized_url);
        return { data: existing ?? null, error: null };
      }
      if (filters.slug !== undefined) {
        // Slug-collision lookup. Always return null (no collision).
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    chain.single = vi.fn(async () => {
      if (pendingInsertPayload) {
        const id =
          pendingInsertPayload.id ||
          `res-${Math.random().toString(36).slice(2, 8)}`;
        const row = {
          ...pendingInsertPayload,
          id,
          slug: pendingInsertPayload.slug || "auto-slug",
          created_at:
            pendingInsertPayload.created_at || new Date().toISOString(),
        };
        existingById.set(id, row);
        return { data: row, error: null };
      }
      if (pendingUpdatePayload) {
        const baseRow =
          (filters.id && existingById.get(filters.id)) ||
          Array.from(existingByNormalizedUrl.values())[0] ||
          {
            id: filters.id || "existing-id",
            name: "existing",
            slug: "existing-slug",
            server_id: "server-123",
            network: "solana",
            category: "api",
            resource_url: "https://example.com/api",
            created_at: new Date().toISOString(),
          };
        return {
          data: { ...baseRow, ...pendingUpdatePayload },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    return chain;
  }

  return {
    _makeChain: makeChain,
    setExistingByNormalizedUrl(normalizedUrl: string, row: any) {
      existingByNormalizedUrl.set(normalizedUrl, row);
      if (row?.id) existingById.set(row.id, row);
    },
  };
}

let supabaseMock: ReturnType<typeof createChainableMock>;

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => ({
    from: () => supabaseMock._makeChain(),
  }),
}));

vi.mock("../../middleware/apiKey", () => ({
  apiKeyMiddleware: (req: any, res: any, next: any) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "API key required",
      });
    }
    if (apiKey === "test_api_key_12345") {
      req.apiKey = {
        id: "api-key-id-123",
        name: "Test API Key",
        created_by: VALID_USER_ID,
        tier: "free",
      };
      return next();
    }
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or inactive API key",
    });
  },
}));

// Rate limiters: pass-through for the broader minute/hour buckets.
// The bulk-specific rate-limit test uses a separate file/setup so we
// keep this file's bulkResourceRateLimiter as pass-through too.
vi.mock("../../middleware/rateLimit", () => ({
  minuteRateLimiter: (_req: any, _res: any, next: any) => next(),
  hourlyRateLimiter: (_req: any, _res: any, next: any) => next(),
  bulkResourceRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Server creation mock — default returns a stable server. Tests can override.
const getOrCreateServerMock = vi.fn();
vi.mock("../servers", () => ({
  getOrCreateServer: (...args: unknown[]) =>
    getOrCreateServerMock(...(args as Parameters<typeof getOrCreateServerMock>)),
}));

// Avatar caching: stub to a fixed cached URL.
vi.mock("../resources", () => ({
  cacheImage: vi.fn((url: string) => Promise.resolve(`cached_${url}`)),
}));

// Mock the SSRF-protected http client (plan 28-09 HIGH-13). public-api.ts
// uses httpClient.get / httpClient.post for x402 metadata fetches. The real
// instance dials real sockets via request-filtering-agent; unit tests stub
// the whole instance and simulate library-shaped rejection for SSRF tests.
//
// vi.hoisted is required because vi.mock factories are hoisted above all
// imports/declarations; without hoisting the mock object, the factory would
// reference an uninitialized binding.
const { httpClientMock } = vi.hoisted(() => ({
  httpClientMock: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  },
}));
vi.mock("../../lib/http-client", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/http-client")>(
      "../../lib/http-client",
    );
  return {
    ...actual,
    httpClient: httpClientMock as any,
  };
});

// ============================================================================
// Import after mocks
// ============================================================================

import { publicApiRouter, registerOneResource } from "../public-api";

// ============================================================================
// Test App Setup
// ============================================================================

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", publicApiRouter);
  return app;
}

// Common x402 fixture: an axios-shape 402 response with a valid `accepts`
// block (response.data is the parsed JSON; response.headers is a plain object).
function makeX402AxiosResponse() {
  return {
    status: 402,
    headers: {},
    data: {
      accepts: [
        {
          network: "solana",
          payTo: "test_wallet",
          maxAmountRequired: "1000000",
          description: "Test resource",
        },
      ],
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/v1/resources/bulk", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = createChainableMock();
    app = createTestApp();

    // Default: every getOrCreateServer call returns a stable server.
    getOrCreateServerMock.mockResolvedValue({
      id: "server-123",
      slug: "example-com",
      origin_url: "https://example.com",
      name: "example.com",
      verified_owner_id: null,
      registered_by: VALID_USER_ID,
    });

    // Default: every httpClient call yields a valid 402 response.
    // SSRF-block scenarios override per-test with mockRejectedValueOnce.
    httpClientMock.get.mockResolvedValue(makeX402AxiosResponse());
    httpClientMock.post.mockResolvedValue(makeX402AxiosResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Body validation
  // ==========================================================================

  describe("Body validation", () => {
    it("rejects missing `resources` field with 400", async () => {
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid bulk request");
      expect(res.body.message).toMatch(/resources/);
    });

    it("rejects non-array `resources` with 400", async () => {
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({ resources: "not-an-array" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid bulk request");
      expect(res.body.message).toMatch(/array/i);
    });

    it("rejects empty `resources` array with 400", async () => {
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({ resources: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid bulk request");
      expect(res.body.message).toMatch(/at least/i);
    });

    it("rejects over-cap (26 items) with 400 and no per-item DB calls", async () => {
      const items = Array.from({ length: 26 }, (_, i) => ({
        name: `r${i}`,
        resource_url: `https://example.com/r${i}`,
      }));
      // Spy on cacheImage to confirm no per-item work happened.
      const { cacheImage } = await import("../resources");
      const cacheSpy = vi.spyOn({ cacheImage }, "cacheImage");

      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({ resources: items });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid bulk request");
      expect(res.body.message).toMatch(/25/);
      // No items processed → no http calls issued.
      expect(httpClientMock.get).not.toHaveBeenCalled();
      expect(httpClientMock.post).not.toHaveBeenCalled();
      cacheSpy.mockRestore();
    });

    it("accepts boundary: 1 item", async () => {
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({
          resources: [
            { name: "r1", resource_url: "https://example.com/r1" },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.summary.total).toBe(1);
    });

    it("accepts boundary: 25 items", async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        name: `r${i}`,
        resource_url: `https://example.com/r${i}`,
      }));
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({ resources: items });
      expect(res.status).toBe(200);
      expect(res.body.summary.total).toBe(25);
    });
  });

  // ==========================================================================
  // Happy path
  // ==========================================================================

  describe("Happy path", () => {
    it("creates 3 new resources and reports created=3", async () => {
      const items = [0, 1, 2].map((i) => ({
        name: `r${i}`,
        resource_url: `https://example.com/r${i}`,
      }));

      // supabaseMock has no existing entries → all 3 trigger insert path.
      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({ resources: items });

      expect(res.status).toBe(200);
      expect(res.body.summary).toEqual({
        total: 3,
        created: 3,
        updated: 0,
        skipped: 0,
        errored: 0,
      });
      expect(res.body.results).toHaveLength(3);
      for (const entry of res.body.results) {
        expect(entry.status).toBe("created");
        expect(entry.resource).toBeDefined();
        expect(typeof entry.index).toBe("number");
      }
    });
  });

  // ==========================================================================
  // Partial success
  // ==========================================================================

  describe("Partial success", () => {
    it("returns mixed created + updated + error in one batch (HTTP 200)", async () => {
      // Item 0: new (default supabase mock — no existing row for r0-url).
      // Item 1: existing owned by caller → update path.
      supabaseMock.setExistingByNormalizedUrl("example.com/r1", {
        id: "existing-r1",
        name: "Old r1",
        slug: "old-r1",
        server_id: "server-123",
        network: "solana",
        category: "api",
        resource_url: "https://example.com/r1",
        created_at: "2026-01-01T00:00:00Z",
        avatar_url: null,
        pay_to: "test_wallet",
        description: null,
        tags: [],
        capabilities: [],
        registered_by: VALID_USER_ID, // caller owns it
        verified_owner_id: null,
        server: {
          id: "server-123",
          verified_owner_id: null,
          registered_by: VALID_USER_ID,
        },
      });

      // Item 2: x402 fetch fails (returns 200 not 402) → "Invalid x402 resource".
      // public-api fetchX402Metadata calls httpClient.get first; if status !== 402
      // it falls through to httpClient.post. Configure both to return 200 for
      // item 2's URL (https://example.com/r2), 402 otherwise.
      const non402Response = {
        status: 200,
        headers: {},
        data: {},
      };
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.endsWith("/r2")) return Promise.resolve(non402Response);
        return Promise.resolve(makeX402AxiosResponse());
      });
      httpClientMock.post.mockImplementation((url: string) => {
        if (url.endsWith("/r2")) return Promise.resolve(non402Response);
        return Promise.resolve(makeX402AxiosResponse());
      });

      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({
          resources: [
            { name: "r0", resource_url: "https://example.com/r0" },
            { name: "r1 new", resource_url: "https://example.com/r1" },
            { name: "r2", resource_url: "https://example.com/r2" },
          ],
        });

      expect(res.status).toBe(200);
      // Per-item structure
      const byIndex = new Map<number, any>(
        res.body.results.map((r: any) => [r.index, r]),
      );
      expect(byIndex.get(0).status).toBe("created");
      expect(byIndex.get(1).status).toBe("updated");
      expect(byIndex.get(2).status).toBe("error");
      expect(byIndex.get(2).error).toBe("Invalid x402 resource");

      expect(res.body.summary).toEqual({
        total: 3,
        created: 1,
        updated: 1,
        skipped: 0,
        errored: 1,
      });
    });
  });

  // ==========================================================================
  // SSRF inheritance (per-item isolation)
  // ==========================================================================

  describe("SSRF inheritance", () => {
    it("isolates a 127.0.0.1 item as per-item error; other items succeed", async () => {
      // The real httpClient + request-filtering-agent rejects 127.0.0.1 at
      // connect time. In unit tests we simulate that by making the mock
      // throw the library's verbatim error message for the 127.0.0.1 URL —
      // isBlockedRequestError matches on the "is not allowed... private IP
      // address" substring. example.com URLs resolve via the default 402
      // mock so they proceed normally.
      const blockedErr = new Error(
        "DNS lookup 127.0.0.1(family:4, host:127.0.0.1) is not allowed. Because, It is private IP address.",
      );
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes("127.0.0.1")) return Promise.reject(blockedErr);
        return Promise.resolve(makeX402AxiosResponse());
      });
      httpClientMock.post.mockImplementation((url: string) => {
        if (url.includes("127.0.0.1")) return Promise.reject(blockedErr);
        return Promise.resolve(makeX402AxiosResponse());
      });

      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({
          resources: [
            { name: "good", resource_url: "https://example.com/good" },
            { name: "bad", resource_url: "https://127.0.0.1/internal" },
            { name: "alsoGood", resource_url: "https://example.com/g2" },
          ],
        });

      expect(res.status).toBe(200);
      const byIndex = new Map<number, any>(
        res.body.results.map((r: any) => [r.index, r]),
      );
      expect(byIndex.get(0).status).toBe("created");
      expect(byIndex.get(1).status).toBe("error");
      expect(byIndex.get(1).error).toBe("URL not allowed");
      expect(byIndex.get(1).message).toMatch(/private/);
      expect(byIndex.get(2).status).toBe("created");

      expect(res.body.summary.created).toBe(2);
      expect(res.body.summary.errored).toBe(1);
    });
  });

  // ==========================================================================
  // Ownership conflict (skipped, bulk-only behavior)
  // ==========================================================================

  describe("Ownership conflict", () => {
    it("returns status='skipped' with error='not_owner' for non-owner match where no fields could be filled", async () => {
      // Existing resource is owned by OTHER_USER_ID. The caller (VALID_USER_ID)
      // provides a name (but name is non-owner-immutable) and description that
      // is already present — so no fields can be filled in for the non-owner.
      // registerOneResource returns `skipped`.
      //
      // Use a minimal x402 fixture (no outputSchema/asset/mimeType/extra/
      // maxTimeoutSeconds) so the always-synced-metadata branches don't fire
      // and we exercise the "no updates" path cleanly.
      const minimalX402 = {
        status: 402,
        headers: {},
        data: {
          accepts: [{ network: "solana", payTo: "test_wallet" }],
        },
      };
      httpClientMock.get.mockResolvedValue(minimalX402);
      httpClientMock.post.mockResolvedValue(minimalX402);

      supabaseMock.setExistingByNormalizedUrl("example.com/r1", {
        id: "existing-r1",
        name: "Owned by other",
        slug: "owned-by-other",
        server_id: "server-other",
        network: "solana",
        category: "api",
        resource_url: "https://example.com/r1",
        created_at: "2026-01-01T00:00:00Z",
        avatar_url: "https://cdn/avatar.png", // already set
        pay_to: "test_wallet",
        description: "Already described", // already set
        tags: ["already"],
        capabilities: ["already"],
        registered_by: OTHER_USER_ID,
        verified_owner_id: OTHER_USER_ID,
        server: {
          id: "server-other",
          verified_owner_id: OTHER_USER_ID,
          registered_by: OTHER_USER_ID,
        },
      });

      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({
          resources: [
            {
              name: "attempted override",
              resource_url: "https://example.com/r1",
              description: "Attacker desc",
              tags: ["attacker"],
              capabilities: ["attacker"],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe("skipped");
      expect(res.body.results[0].error).toBe("not_owner");
      expect(res.body.results[0].message).toMatch(/.+/);
      expect(res.body.summary.skipped).toBe(1);
    });
  });

  // ==========================================================================
  // Per-item exception isolation
  // ==========================================================================

  describe("Exception isolation", () => {
    it("isolates a per-item throw as status='error' without aborting the batch", async () => {
      // Force getOrCreateServer to throw on the second item; the others
      // succeed normally. Counter is bumped in the mock impl.
      let callCount = 0;
      getOrCreateServerMock.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("boom from getOrCreateServer"));
        }
        return Promise.resolve({
          id: "server-123",
          slug: "example-com",
          origin_url: "https://example.com",
          name: "example.com",
          verified_owner_id: null,
          registered_by: VALID_USER_ID,
        });
      });

      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({
          resources: [
            { name: "a", resource_url: "https://example.com/a" },
            { name: "b", resource_url: "https://example.com/b" },
            { name: "c", resource_url: "https://example.com/c" },
          ],
        });

      expect(res.status).toBe(200);
      const errored = res.body.results.filter(
        (r: any) => r.status === "error",
      );
      expect(errored).toHaveLength(1);
      expect(errored[0].error).toBe("Internal error");
      expect(res.body.summary.errored).toBe(1);
      // Other two succeed (created path).
      expect(res.body.summary.created).toBe(2);
    });
  });

  // ==========================================================================
  // Concurrency cap (5)
  // ==========================================================================

  describe("Concurrency", () => {
    it("never has more than 5 registerOneResource invocations in-flight", async () => {
      // We can't easily spy on the (re-exported) registerOneResource because
      // the bulk handler imports it from the same module. Use a proxy via
      // the slowest-shared dependency: getOrCreateServer. Each call records
      // the in-flight count at start and decrements at end. Confirm the
      // observed max never exceeds 5.
      let inFlight = 0;
      let maxInFlight = 0;
      getOrCreateServerMock.mockImplementation(async () => {
        inFlight++;
        if (inFlight > maxInFlight) maxInFlight = inFlight;
        // Yield to let other tasks queue up before resolving.
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        return {
          id: "server-123",
          slug: "example-com",
          origin_url: "https://example.com",
          name: "example.com",
          verified_owner_id: null,
          registered_by: VALID_USER_ID,
        };
      });

      const items = Array.from({ length: 20 }, (_, i) => ({
        name: `r${i}`,
        resource_url: `https://example.com/r${i}`,
      }));

      const res = await request(app)
        .post("/api/v1/resources/bulk")
        .set("x-api-key", VALID_API_KEY)
        .send({ resources: items });

      expect(res.status).toBe(200);
      expect(res.body.summary.total).toBe(20);
      // p-limit(5) → max in-flight is exactly 5
      expect(maxInFlight).toBeLessThanOrEqual(5);
      // And we did actually parallelize (not serial = max 1).
      expect(maxInFlight).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // Single endpoint still maps `skipped` → "updated:false" 200 response
  // (parity assertion — single endpoint contract preserved)
  // ==========================================================================

  describe("Single endpoint parity", () => {
    it("maps a `skipped` registerOneResource result back to existing 'updated:false' response on POST /resources", async () => {
      // Same ownership-conflict setup as the bulk test, but hit the single
      // endpoint. The response must look exactly like the pre-refactor
      // "Resource already exists with all provided fields" reply.
      const minimalX402 = {
        status: 402,
        headers: {},
        data: {
          accepts: [{ network: "solana", payTo: "test_wallet" }],
        },
      };
      httpClientMock.get.mockResolvedValue(minimalX402);
      httpClientMock.post.mockResolvedValue(minimalX402);

      supabaseMock.setExistingByNormalizedUrl("example.com/r1", {
        id: "existing-r1",
        name: "Owned by other",
        slug: "owned-by-other",
        server_id: "server-other",
        network: "solana",
        category: "api",
        resource_url: "https://example.com/r1",
        created_at: "2026-01-01T00:00:00Z",
        avatar_url: "https://cdn/avatar.png",
        pay_to: "test_wallet",
        description: "Already described",
        tags: ["already"],
        capabilities: ["already"],
        registered_by: OTHER_USER_ID,
        verified_owner_id: OTHER_USER_ID,
        server: {
          id: "server-other",
          verified_owner_id: OTHER_USER_ID,
          registered_by: OTHER_USER_ID,
        },
      });

      const res = await request(app)
        .post("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY)
        .send({
          name: "attempted override",
          resource_url: "https://example.com/r1",
          description: "Attacker desc",
          tags: ["attacker"],
          capabilities: ["attacker"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updated).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
      // No `error` or `status` keys leaking from the discriminated union.
      expect(res.body.error).toBeUndefined();
      expect(res.body.status).toBeUndefined();
    });
  });
});

// ============================================================================
// Direct unit-style assertions on registerOneResource (no Express)
// ============================================================================

describe("registerOneResource (direct unit)", () => {
  const apiKeyUser = {
    id: "api-key-id-123",
    name: "Test API Key",
    created_by: VALID_USER_ID,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = createChainableMock();
    getOrCreateServerMock.mockResolvedValue({
      id: "server-123",
      slug: "example-com",
      origin_url: "https://example.com",
      name: "example.com",
      verified_owner_id: null,
      registered_by: VALID_USER_ID,
    });

    const x402Resp = {
      status: 402,
      headers: {},
      data: {
        accepts: [
          {
            network: "solana",
            payTo: "test_wallet",
            maxAmountRequired: "1000000",
          },
        ],
      },
    };
    // 127.0.0.1 path → throw the library's verbatim block error; everything
    // else → 402 fixture. isBlockedRequestError matches on the message.
    const blockedErr = new Error(
      "DNS lookup 127.0.0.1(family:4, host:127.0.0.1) is not allowed. Because, It is private IP address.",
    );
    httpClientMock.get.mockImplementation((url: string) => {
      if (url.includes("127.0.0.1")) return Promise.reject(blockedErr);
      return Promise.resolve(x402Resp);
    });
    httpClientMock.post.mockImplementation((url: string) => {
      if (url.includes("127.0.0.1")) return Promise.reject(blockedErr);
      return Promise.resolve(x402Resp);
    });
  });

  it("returns status='error' http_hint=400 for missing name", async () => {
    const result = await registerOneResource(
      { resource_url: "https://example.com/api" } as any,
      apiKeyUser,
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.http_hint).toBe(400);
      expect(result.error).toBe("Missing required fields");
    }
  });

  it("returns status='error' error='URL not allowed' for 127.0.0.1", async () => {
    const result = await registerOneResource(
      {
        name: "bad",
        resource_url: "https://127.0.0.1/internal",
      } as any,
      apiKeyUser,
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toBe("URL not allowed");
      expect(result.http_hint).toBe(400);
    }
  });

  it("returns status='created' for a new resource", async () => {
    const result = await registerOneResource(
      {
        name: "fresh",
        resource_url: "https://example.com/fresh",
      } as any,
      apiKeyUser,
    );
    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.resource.resource_url).toBe(
        "https://example.com/fresh",
      );
    }
  });
});
