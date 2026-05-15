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
// Mocks - vi.mock calls are hoisted by vitest
// ============================================================================

// Create a chainable mock for Supabase queries
function createChainableMock() {
  const mock: any = {
    data: null,
    error: null,
  };

  // All methods return the mock itself for chaining
  mock.select = vi.fn(() => mock);
  mock.insert = vi.fn(() => mock);
  mock.update = vi.fn(() => mock);
  mock.eq = vi.fn(() => mock);
  mock.neq = vi.fn(() => mock);
  mock.order = vi.fn(() => mock);
  mock.range = vi.fn(() => mock);
  mock.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: mock.data, error: mock.error }),
  );
  mock.single = vi.fn(() =>
    Promise.resolve({ data: mock.data, error: mock.error }),
  );

  // Helper to set the mock response
  mock.setResponse = (data: any, error: any = null) => {
    mock.data = data;
    mock.error = error;
  };

  return mock;
}

// Global chainable mock instance
let supabaseMock: ReturnType<typeof createChainableMock>;

// Mock Supabase client
vi.mock("../../lib/supabase", () => ({
  getSupabase: () => ({
    from: () => supabaseMock,
  }),
}));

// Mock API key middleware
vi.mock("../../middleware/apiKey", () => ({
  apiKeyMiddleware: (req: any, res: any, next: any) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message:
          "API key required. Provide via x-api-key header or Authorization: Bearer header",
      });
    }
    if (apiKey === "test_api_key_12345") {
      req.apiKey = {
        id: "api-key-id-123",
        name: "Test API Key",
        created_by: "user-123",
      };
      return next();
    }
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or inactive API key",
    });
  },
}));

// Mock rate limiters - just pass through
vi.mock("../../middleware/rateLimit", () => ({
  minuteRateLimiter: (_req: any, _res: any, next: any) => next(),
  hourlyRateLimiter: (_req: any, _res: any, next: any) => next(),
  bulkResourceRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Mock the SSRF-protected http client (plan 28-09 HIGH-13). public-api.ts
// imports httpClient from ../../lib/http-client and uses it to fetch x402
// metadata. The real instance dials real sockets via request-filtering-agent,
// which would either time out (DNS resolution of example.com fixtures) or
// reject (127.0.0.1) — unit tests stub the entire instance.
//
// vi.hoisted is required because vi.mock factories are hoisted above all
// imports/declarations; without hoisting the mock object, the factory would
// reference an uninitialized binding (ReferenceError at module-init time).
//
// Per-test override: `httpClientMock.get.mockResolvedValueOnce(...)` or
// `httpClientMock.get.mockRejectedValueOnce(new Error("...is not allowed...
// private IP address"))` to simulate a request-filtering-agent block. The
// message substring is what `isBlockedRequestError` matches.
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

// Mock server creation
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

// Mock image caching
vi.mock("../resources", () => ({
  cacheImage: vi.fn((url: string) => Promise.resolve(`cached_${url}`)),
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { publicApiRouter } from "../public-api";

// ============================================================================
// Test App Setup
// ============================================================================

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", publicApiRouter);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe("Public API Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the supabase mock
    supabaseMock = createChainableMock();

    app = createTestApp();

    // Default mock: httpClient.get returns a valid x402 (402) metadata
    // response. Per-test overrides via httpClientMock.get.mockResolvedValueOnce.
    // axios responses have .status, .data, .headers — public-api code reads
    // those keys directly (no .json() / .text() consumption).
    httpClientMock.get.mockResolvedValue({
      status: 402,
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
      headers: {},
    });
    httpClientMock.post.mockResolvedValue({
      status: 402,
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
      headers: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe("Authentication", () => {
    it("should reject requests without API key", async () => {
      const res = await request(app).get("/api/v1/resources");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
      expect(res.body.message).toContain("API key required");
    });

    it("should reject requests with invalid API key", async () => {
      const res = await request(app)
        .get("/api/v1/resources")
        .set("x-api-key", "invalid_key");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
      expect(res.body.message).toContain("Invalid or inactive");
    });

    it("should accept requests with valid API key", async () => {
      // Set up mock to return empty array
      supabaseMock.setResponse([]);

      const res = await request(app)
        .get("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // POST /resources Validation Tests
  // ==========================================================================

  describe("POST /api/v1/resources - Validation", () => {
    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Missing required fields");
    });

    it("should reject missing name", async () => {
      const res = await request(app)
        .post("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY)
        .send({ resource_url: "https://example.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("name");
    });

    it("should reject invalid network", async () => {
      const res = await request(app)
        .post("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY)
        .send({
          name: "Test",
          resource_url: "https://example.com",
          network: "invalid-network",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid network");
    });

    it("should reject invalid URL format", async () => {
      const res = await request(app)
        .post("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY)
        .send({
          name: "Test",
          resource_url: "not-a-valid-url",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid URL");
    });

    it("should reject URLs that don't return 402", async () => {
      // Override httpClient mocks for this test: both GET and POST return 200
      // so fetchX402Metadata yields null and registerOneResource returns
      // "Invalid x402 resource".
      httpClientMock.get.mockResolvedValueOnce({
        status: 200,
        data: { data: "regular response" },
        headers: {},
      });
      httpClientMock.post.mockResolvedValueOnce({
        status: 200,
        data: { data: "regular response" },
        headers: {},
      });

      const res = await request(app)
        .post("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY)
        .send({
          name: "Test",
          resource_url: "https://example.com/api",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid x402 resource");
    });
  });

  // ==========================================================================
  // Response Structure Tests
  // ==========================================================================

  describe("Response Structure", () => {
    it("should return pagination info for list endpoint", async () => {
      supabaseMock.setResponse([]);

      const res = await request(app)
        .get("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.pagination).toHaveProperty("page");
      expect(res.body.pagination).toHaveProperty("limit");
      expect(res.body.pagination).toHaveProperty("has_more");
    });

    it("should support custom pagination parameters", async () => {
      supabaseMock.setResponse([]);

      const res = await request(app)
        .get("/api/v1/resources?page=2&limit=5")
        .set("x-api-key", VALID_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(5);
    });

    it("should return has_more=false when results less than limit", async () => {
      supabaseMock.setResponse([{ id: "1" }, { id: "2" }]); // 2 results, less than default 20

      const res = await request(app)
        .get("/api/v1/resources")
        .set("x-api-key", VALID_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body.pagination.has_more).toBe(false);
    });
  });
});

// ============================================================================
// Ownership Logic Unit Tests (no supertest, just logic)
// ============================================================================

describe("Ownership Logic Unit Tests", () => {
  interface Resource {
    registered_by: string | null;
    verified_owner_id: string | null;
    server?: {
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;
  }

  function canUpdateOrDelete(userId: string, resource: Resource): boolean {
    const isResourceVerifiedOwner = resource.verified_owner_id === userId;
    const isResourceRegistrant = resource.registered_by === userId;
    const isServerVerifiedOwner = resource.server?.verified_owner_id === userId;
    const isServerRegistrant = resource.server?.registered_by === userId;

    const resourceIsClaimed = !!resource.verified_owner_id;
    const serverIsClaimed = !!resource.server?.verified_owner_id;

    return (
      isResourceVerifiedOwner ||
      isServerVerifiedOwner ||
      (isResourceRegistrant && !resourceIsClaimed && !serverIsClaimed) ||
      (isServerRegistrant && !serverIsClaimed)
    );
  }

  it("should allow resource verified owner to update", () => {
    const resource: Resource = {
      registered_by: OTHER_USER_ID,
      verified_owner_id: VALID_USER_ID,
      server: { verified_owner_id: null, registered_by: OTHER_USER_ID },
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(true);
  });

  it("should allow server verified owner to update any resource", () => {
    const resource: Resource = {
      registered_by: OTHER_USER_ID,
      verified_owner_id: OTHER_USER_ID,
      server: {
        verified_owner_id: VALID_USER_ID,
        registered_by: OTHER_USER_ID,
      },
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(true);
  });

  it("should allow registrant to update unclaimed resource", () => {
    const resource: Resource = {
      registered_by: VALID_USER_ID,
      verified_owner_id: null,
      server: { verified_owner_id: null, registered_by: VALID_USER_ID },
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(true);
  });

  it("should block non-owner from updating claimed resource", () => {
    const resource: Resource = {
      registered_by: OTHER_USER_ID,
      verified_owner_id: OTHER_USER_ID,
      server: {
        verified_owner_id: OTHER_USER_ID,
        registered_by: OTHER_USER_ID,
      },
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(false);
  });

  it("should block registrant when server is claimed by another", () => {
    const resource: Resource = {
      registered_by: VALID_USER_ID, // We registered it
      verified_owner_id: null,
      server: {
        verified_owner_id: OTHER_USER_ID,
        registered_by: OTHER_USER_ID,
      }, // But server claimed
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(false);
  });

  it("should handle resource without server", () => {
    const resource: Resource = {
      registered_by: VALID_USER_ID,
      verified_owner_id: null,
      server: null,
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(true);
  });

  it("should block random user from unclaimed resource without registration", () => {
    const resource: Resource = {
      registered_by: OTHER_USER_ID,
      verified_owner_id: null,
      server: { verified_owner_id: null, registered_by: OTHER_USER_ID },
    };
    expect(canUpdateOrDelete(VALID_USER_ID, resource)).toBe(false);
  });
});
