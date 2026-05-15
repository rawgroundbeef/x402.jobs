/**
 * Tests for Twitter OAuth hardening — HIGH-02 / plan 28-08.
 *
 * Covers:
 *  - Init handler generates a unique state and persists a pending row.
 *  - Init returns a base64url-encoded state of sufficient length (≥32 chars).
 *  - Init pending row has expires_at ≈ now + 10 minutes.
 *  - Callback rejects missing oauth_token with state_missing.
 *  - Callback rejects unknown oauth_token with state_invalid.
 *  - Callback rejects expired rows with state_expired and deletes the row.
 *  - Callback dual-writes plaintext + ciphertext on success.
 *  - Callback deletes the pending row on success (single-use).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ============================================================================
// Test crypto secret — must be set BEFORE the routes file is imported, since
// lib/instant/encrypt reads from process.env lazily but other modules at the
// import boundary may not.
// ============================================================================

process.env.INTEGRATION_ENCRYPTION_SECRET =
  process.env.INTEGRATION_ENCRYPTION_SECRET ||
  "test-integration-encryption-secret-for-vitest-only";

// ============================================================================
// Supabase mock — chainable, per-table table-name routing so we can serve
// different responses for x402_oauth_pending vs x402_user_x_tokens.
// ============================================================================

interface TableState {
  selectResponse?: { data: any; error: any };
  insertResponse?: { data: any; error: any };
  updateResponse?: { data: any; error: any };
  deleteResponse?: { data: any; error: any };
  upsertResponse?: { data: any; error: any };
  insertSpy?: ReturnType<typeof vi.fn>;
  upsertSpy?: ReturnType<typeof vi.fn>;
  deleteSpy?: ReturnType<typeof vi.fn>;
  eqSpy?: ReturnType<typeof vi.fn>;
}

const tableState: Record<string, TableState> = {};

function resetTableState() {
  for (const key of Object.keys(tableState)) {
    delete tableState[key];
  }
}

function getOrInitTable(name: string): TableState {
  if (!tableState[name]) {
    tableState[name] = {
      insertSpy: vi.fn(),
      upsertSpy: vi.fn(),
      deleteSpy: vi.fn(),
      eqSpy: vi.fn(),
    };
  }
  return tableState[name];
}

function tableBuilder(name: string): any {
  const state = getOrInitTable(name);
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: any) => {
      state.insertSpy?.(payload);
      // .insert(...) is awaitable in Supabase JS
      return Promise.resolve(
        state.insertResponse || { data: null, error: null },
      );
    }),
    upsert: vi.fn((payload: any) => {
      state.upsertSpy?.(payload);
      return Promise.resolve(
        state.upsertResponse || { data: null, error: null },
      );
    }),
    update: vi.fn(() => builder),
    delete: vi.fn(() => {
      state.deleteSpy?.();
      return builder;
    }),
    eq: vi.fn((col: string, val: any) => {
      state.eqSpy?.(col, val);
      // After .delete().eq(), the chain is awaited — so eq must be
      // awaitable too. We resolve to the delete response if the
      // delete spy was called most recently.
      const p: any = Promise.resolve(
        state.deleteResponse ||
          state.selectResponse || { data: null, error: null },
      );
      // Also expose maybeSingle / single off of the returned chain
      // for SELECT followups.
      p.maybeSingle = () =>
        Promise.resolve(
          state.selectResponse || { data: null, error: null },
        );
      p.single = () =>
        Promise.resolve(
          state.selectResponse || { data: null, error: null },
        );
      // Allow further chaining (.eq().eq())
      p.eq = builder.eq;
      return p;
    }),
    maybeSingle: vi.fn(() =>
      Promise.resolve(
        state.selectResponse || { data: null, error: null },
      ),
    ),
    single: vi.fn(() =>
      Promise.resolve(
        state.selectResponse || { data: null, error: null },
      ),
    ),
  };
  return builder;
}

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => ({
    from: (name: string) => tableBuilder(name),
  }),
}));

// ============================================================================
// Auth middleware mock — sets req.user = { id: "user-123" } unconditionally.
// (Init endpoint is auth-protected; callback is NOT auth-protected.)
// ============================================================================

vi.mock("../../middleware/auth", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: "user-123" };
    next();
  },
}));

// ============================================================================
// Config mock — Twitter API keys present so requireTwitterConfig() passes.
// ============================================================================

vi.mock("../../config", () => ({
  config: {
    twitter: {
      apiKey: "test-app-key",
      apiSecret: "test-app-secret",
      callbackUrl: "https://x402.jobs/oauth/twitter/callback",
    },
  },
}));

// ============================================================================
// Twitter API mock — generateAuthLink returns canned token+secret;
// login returns canned access_token/access_secret; v2.me returns canned user.
// ============================================================================

const twitterMockState = {
  generateAuthLinkResponse: {
    url: "https://api.twitter.com/oauth/authorize?oauth_token=twitter-token-abc",
    oauth_token: "twitter-token-abc",
    oauth_token_secret: "twitter-secret-xyz",
  },
  loginResponse: {
    accessToken: "user-access-token-123",
    accessSecret: "user-access-secret-456",
  },
  meResponse: {
    data: {
      username: "testuser",
      name: "Test User",
      profile_image_url: "https://pbs.twimg.com/foo.jpg",
    },
  },
};

vi.mock("twitter-api-v2", () => {
  class TwitterApi {
    constructor(_config: any) {}
    async generateAuthLink(_callback: string, _opts: any) {
      return twitterMockState.generateAuthLinkResponse;
    }
    async login(_verifier: string) {
      return {
        client: {
          v2: {
            me: async () => twitterMockState.meResponse,
          },
        },
        accessToken: twitterMockState.loginResponse.accessToken,
        accessSecret: twitterMockState.loginResponse.accessSecret,
      };
    }
  }
  return { TwitterApi };
});

// ============================================================================
// Import the router AFTER all mocks are set up.
// ============================================================================

import { integrationsRouter } from "../integrations";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/integrations", integrationsRouter);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe("Twitter OAuth — HIGH-02 / plan 28-08", () => {
  let app: express.Express;

  beforeEach(() => {
    resetTableState();
    app = buildApp();
  });

  describe("POST /integrations/x/oauth/initiate", () => {
    it("Test 1: returns a unique base64url state ≥ 32 chars on each call", async () => {
      const pendingTable = getOrInitTable("x402_oauth_pending");
      pendingTable.insertResponse = { data: null, error: null };

      // Note: generateAuthLink mock returns the SAME oauth_token each
      // call, but the state is generated by our handler (crypto.randomBytes).
      const r1 = await request(app)
        .post("/integrations/x/oauth/initiate")
        .send({});
      const r2 = await request(app)
        .post("/integrations/x/oauth/initiate")
        .send({});

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r1.body.state).toBeTruthy();
      expect(r2.body.state).toBeTruthy();
      expect(r1.body.state).not.toBe(r2.body.state);

      // base64url char set: A-Z a-z 0-9 - _
      expect(r1.body.state).toMatch(/^[A-Za-z0-9_-]+$/);
      // 32 random bytes → 43 base64url chars (no padding).
      expect(r1.body.state.length).toBeGreaterThanOrEqual(32);
    });

    it("Test 2: persists a pending row in x402_oauth_pending with expires_at ≈ now + 10 min", async () => {
      const pendingTable = getOrInitTable("x402_oauth_pending");
      pendingTable.insertResponse = { data: null, error: null };

      const beforeMs = Date.now();
      const res = await request(app)
        .post("/integrations/x/oauth/initiate")
        .send({});
      const afterMs = Date.now();

      expect(res.status).toBe(200);
      expect(pendingTable.insertSpy).toHaveBeenCalledTimes(1);
      const insertPayload = pendingTable.insertSpy!.mock.calls[0][0];

      expect(insertPayload.state).toBe(res.body.state);
      expect(insertPayload.user_id).toBe("user-123");
      expect(insertPayload.oauth_token).toBe("twitter-token-abc");
      expect(insertPayload.code_verifier).toBe("twitter-secret-xyz");
      expect(insertPayload.provider).toBe("twitter");

      const expiresMs = new Date(insertPayload.expires_at).getTime();
      const expectedMinMs = beforeMs + 10 * 60 * 1000 - 5000; // -5s tolerance
      const expectedMaxMs = afterMs + 10 * 60 * 1000 + 5000; // +5s tolerance
      expect(expiresMs).toBeGreaterThanOrEqual(expectedMinMs);
      expect(expiresMs).toBeLessThanOrEqual(expectedMaxMs);
    });

    it("Test 3: returns 500 oauth_init_failed if INSERT fails", async () => {
      const pendingTable = getOrInitTable("x402_oauth_pending");
      pendingTable.insertResponse = {
        data: null,
        error: { message: "boom" },
      };

      const res = await request(app)
        .post("/integrations/x/oauth/initiate")
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("oauth_init_failed");
    });
  });

  describe("GET /integrations/x/oauth/callback", () => {
    it("Test 4: missing oauth_token → 400 state_missing", async () => {
      const res = await request(app).get("/integrations/x/oauth/callback");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("state_missing");
    });

    it("Test 5: missing oauth_verifier → 400 state_missing", async () => {
      const res = await request(app).get(
        "/integrations/x/oauth/callback?oauth_token=foo",
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("state_missing");
    });

    it("Test 6: oauth_token not in DB → 400 state_invalid", async () => {
      const pendingTable = getOrInitTable("x402_oauth_pending");
      pendingTable.selectResponse = { data: null, error: null };

      const res = await request(app).get(
        "/integrations/x/oauth/callback?oauth_token=unknown&oauth_verifier=v",
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("state_invalid");
    });

    it("Test 7: expired state → 400 state_expired AND pending row is deleted", async () => {
      const pendingTable = getOrInitTable("x402_oauth_pending");
      pendingTable.selectResponse = {
        data: {
          state: "state-pk-expired",
          user_id: "user-123",
          code_verifier: "secret",
          expires_at: new Date(Date.now() - 60_000).toISOString(), // expired 1 min ago
        },
        error: null,
      };
      pendingTable.deleteResponse = { data: null, error: null };

      const res = await request(app).get(
        "/integrations/x/oauth/callback?oauth_token=expired-tok&oauth_verifier=v",
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("state_expired");
      expect(pendingTable.deleteSpy).toHaveBeenCalled();
    });

    it("Test 8: valid state stores BOTH plaintext + ciphertext columns (dual-write); pending row deleted", async () => {
      const pendingTable = getOrInitTable("x402_oauth_pending");
      pendingTable.selectResponse = {
        data: {
          state: "state-pk-valid",
          user_id: "user-123",
          code_verifier: "twitter-secret-xyz",
          expires_at: new Date(Date.now() + 60_000).toISOString(), // valid 1 min ahead
        },
        error: null,
      };
      pendingTable.deleteResponse = { data: null, error: null };

      const xTokensTable = getOrInitTable("x402_user_x_tokens");
      xTokensTable.upsertResponse = { data: null, error: null };

      const res = await request(app).get(
        "/integrations/x/oauth/callback?oauth_token=valid-tok&oauth_verifier=v",
      );

      expect(res.status).toBe(200);
      expect(xTokensTable.upsertSpy).toHaveBeenCalledTimes(1);
      const upsertPayload = xTokensTable.upsertSpy!.mock.calls[0][0];

      // Plaintext columns (legacy, dual-write):
      expect(upsertPayload.access_token).toBe("user-access-token-123");
      expect(upsertPayload.access_secret).toBe("user-access-secret-456");
      // Ciphertext columns (post-Phase-27 target):
      expect(upsertPayload.access_token_ciphertext).toBeTruthy();
      expect(upsertPayload.access_secret_ciphertext).toBeTruthy();
      // Ciphertext format from lib/instant/encrypt = "iv_hex:enc_hex"
      expect(upsertPayload.access_token_ciphertext).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      expect(upsertPayload.access_secret_ciphertext).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      // Ciphertext must NOT equal plaintext.
      expect(upsertPayload.access_token_ciphertext).not.toBe(
        upsertPayload.access_token,
      );
      expect(upsertPayload.access_secret_ciphertext).not.toBe(
        upsertPayload.access_secret,
      );

      // Single-use semantics: pending row deleted after success.
      expect(pendingTable.deleteSpy).toHaveBeenCalled();
    });
  });
});
