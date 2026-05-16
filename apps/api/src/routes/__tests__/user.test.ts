import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();
const mockDeleteUser = vi.fn();

const mockFromImpl = vi.fn(() => ({
  select: mockSelect.mockReturnThis(),
  delete: mockDelete.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
  is: vi.fn().mockReturnThis(),
}));

vi.mock("../../lib/supabase", () => ({
  getSupabase: vi.fn(() => ({
    from: mockFromImpl,
    rpc: mockRpc,
    auth: { admin: { deleteUser: mockDeleteUser } },
  })),
}));

// Mock balance helpers.
const mockGetSolanaUsdcBalance = vi.fn();
const mockGetBaseUsdcBalance = vi.fn();
vi.mock("../../lib/solana", () => ({
  getSolanaUsdcBalance: (...args: unknown[]) =>
    mockGetSolanaUsdcBalance(...args),
}));
vi.mock("../../lib/base", () => ({
  getBaseUsdcBalance: (...args: unknown[]) => mockGetBaseUsdcBalance(...args),
}));

// Mock sweep helper.
const mockSweepWalletsToAddress = vi.fn();
vi.mock("../../lib/wallet-sweep", () => ({
  sweepWalletsToAddress: (...args: unknown[]) =>
    mockSweepWalletsToAddress(...args),
}));

// Test auth middleware: pretend req.user is always the canned user.
const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";
const testAuth = (req: Request, _res: Response, next: NextFunction) => {
  req.user = { id: TEST_USER_ID, email: "test@example.com" };
  next();
};

// Import the router AFTER mocks are in place.
let userRouter: express.Router;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  // Re-mock after reset.
  vi.doMock("../../lib/supabase", () => ({
    getSupabase: vi.fn(() => ({
      from: mockFromImpl,
      rpc: mockRpc,
      auth: { admin: { deleteUser: mockDeleteUser } },
    })),
  }));
  vi.doMock("../../lib/solana", () => ({
    getSolanaUsdcBalance: (...args: unknown[]) =>
      mockGetSolanaUsdcBalance(...args),
  }));
  vi.doMock("../../lib/base", () => ({
    getBaseUsdcBalance: (...args: unknown[]) => mockGetBaseUsdcBalance(...args),
  }));
  vi.doMock("../../lib/wallet-sweep", () => ({
    sweepWalletsToAddress: (...args: unknown[]) =>
      mockSweepWalletsToAddress(...args),
  }));
  const mod = await import("../user");
  userRouter = mod.userRouter;
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(testAuth);
  app.use("/api/user", userRouter);
  return app;
};

// ─── HIGH-03 — DELETE /api/user/account hardening ───────────────────────────

describe("DELETE /api/user/account — HIGH-03 balance gate + soft-delete", () => {
  // Default: wallet lookup returns a wallet so balance helpers are called.
  beforeEach(() => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        address: "SoLwallet111",
        base_address: "0xbaseWallet111",
      },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("returns 409 wallet_has_balance when combined balance > $0.01 and no externalWithdrawalAddress", async () => {
    mockGetSolanaUsdcBalance.mockResolvedValue(0.5);
    mockGetBaseUsdcBalance.mockResolvedValue(0.0);

    const app = buildApp();
    const res = await request(app).delete("/api/user/account").send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("wallet_has_balance");
    expect(res.body.balance_usdc).toBeGreaterThan(0.01);
    expect(Array.isArray(res.body.options)).toBe(true);
    // Soft-delete RPC must NOT have been called.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("soft-deletes (200) and calls soft_delete_user_tx when combined balance ≤ $0.01", async () => {
    mockGetSolanaUsdcBalance.mockResolvedValue(0.005);
    mockGetBaseUsdcBalance.mockResolvedValue(0.001);

    const app = buildApp();
    const res = await request(app).delete("/api/user/account").send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.recoveryWindowDays).toBe(30);
    expect(mockRpc).toHaveBeenCalledWith("soft_delete_user_tx", {
      p_user_id: TEST_USER_ID,
    });
  });

  it("sweeps then soft-deletes when externalWithdrawalAddress is provided and balance > $0.01", async () => {
    mockGetSolanaUsdcBalance.mockResolvedValue(1.0);
    mockGetBaseUsdcBalance.mockResolvedValue(0.0);
    mockSweepWalletsToAddress.mockResolvedValue({ ok: true });

    const app = buildApp();
    const res = await request(app)
      .delete("/api/user/account")
      .send({ externalWithdrawalAddress: "ExternalAddress12345" });

    // Sweep must run BEFORE soft-delete.
    expect(mockSweepWalletsToAddress).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("soft_delete_user_tx", {
      p_user_id: TEST_USER_ID,
    });
    // Order: sweep call must come before rpc call.
    const sweepOrder = mockSweepWalletsToAddress.mock.invocationCallOrder[0];
    const rpcOrder = mockRpc.mock.invocationCallOrder[0];
    expect(sweepOrder).toBeLessThan(rpcOrder!);
    expect(res.status).toBe(200);
  });

  it("returns 500 sweep_failed and does NOT soft-delete when sweep throws", async () => {
    mockGetSolanaUsdcBalance.mockResolvedValue(2.5);
    mockGetBaseUsdcBalance.mockResolvedValue(0.0);
    mockSweepWalletsToAddress.mockRejectedValue(
      new Error("broadcast failed: timeout"),
    );

    const app = buildApp();
    const res = await request(app)
      .delete("/api/user/account")
      .send({ externalWithdrawalAddress: "ExternalAddress12345" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("sweep_failed");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 delete_failed when the soft-delete RPC errors out (transaction rollback)", async () => {
    mockGetSolanaUsdcBalance.mockResolvedValue(0);
    mockGetBaseUsdcBalance.mockResolvedValue(0);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "user_not_found_or_already_deleted" },
    });

    const app = buildApp();
    const res = await request(app).delete("/api/user/account").send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("delete_failed");
  });

  it("treats a missing wallet row as zero balance and proceeds to soft-delete", async () => {
    // No wallet row → balance helpers not called; combined = 0 → proceed.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const app = buildApp();
    const res = await request(app).delete("/api/user/account").send({});

    expect(res.status).toBe(200);
    expect(mockGetSolanaUsdcBalance).not.toHaveBeenCalled();
    expect(mockGetBaseUsdcBalance).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("soft_delete_user_tx", {
      p_user_id: TEST_USER_ID,
    });
  });
});
