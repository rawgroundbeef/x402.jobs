import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  IEscrowRepository,
  EscrowRunData,
} from "../../../../repositories/EscrowRepository";
import {
  calculateSmartRefund,
  createCreatorPayout,
  createPayerRefund,
  createEscrowRecord,
} from "../escrow";

/**
 * Create a mock repository for testing
 */
function createMockRepository(overrides?: {
  runData?: EscrowRunData | null;
  eventSpend?: number;
  payoutError?: string;
  refundError?: string;
}): IEscrowRepository {
  const config = {
    runData: null,
    eventSpend: 0,
    payoutError: undefined,
    refundError: undefined,
    ...overrides,
  };

  return {
    getRunData: vi.fn().mockResolvedValue(config.runData),
    getEventSpend: vi.fn().mockResolvedValue(config.eventSpend),
    createPayout: vi
      .fn()
      .mockResolvedValue(
        config.payoutError ? { error: config.payoutError } : {},
      ),
    createRefund: vi
      .fn()
      .mockResolvedValue(
        config.refundError ? { error: config.refundError } : {},
      ),
  };
}

describe("escrow", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateSmartRefund", () => {
    it("should calculate refund with no spent resources", async () => {
      const repo = createMockRepository({ eventSpend: 0 });

      const result = await calculateSmartRefund(
        repo,
        "run-123",
        1.0, // totalPayment
        0.1, // creatorMarkup
        0.05, // platformFee
      );

      // With no events, all resource cost is unused
      // totalPayment (1.0) - actualSpent (0) - platformFee (0.05) - creatorMarkup (0.1) = 0.85 unused
      // refund = creatorMarkup (0.1) + unused (0.85) = 0.95
      expect(result.refundAmount).toBeCloseTo(0.95, 2);
      expect(result.breakdown.creator_markup).toBe(0.1);
      expect(result.breakdown.unused_resources).toBeCloseTo(0.85, 2);
    });

    it("should calculate refund with partial spend", async () => {
      const repo = createMockRepository({ eventSpend: 0.5 });

      const result = await calculateSmartRefund(
        repo,
        "run-123",
        1.0, // totalPayment
        0.1, // creatorMarkup
        0.05, // platformFee
      );

      // totalPayment (1.0) - actualSpent (0.5) - platformFee (0.05) - creatorMarkup (0.1) = 0.35 unused
      // refund = creatorMarkup (0.1) + unused (0.35) = 0.45
      expect(result.refundAmount).toBeCloseTo(0.45, 2);
      expect(result.breakdown.unused_resources).toBeCloseTo(0.35, 2);
    });

    it("should cap refund at totalPayment minus platformFee", async () => {
      const repo = createMockRepository({ eventSpend: 0 });

      const result = await calculateSmartRefund(
        repo,
        "run-123",
        0.1, // totalPayment (very small)
        0.5, // creatorMarkup (larger than totalPayment!)
        0.05, // platformFee
      );

      // Max refund = totalPayment - platformFee = 0.10 - 0.05 = 0.05
      expect(result.refundAmount).toBeCloseTo(0.05, 2);
    });

    it("should return 0 unused when all resources were used", async () => {
      const repo = createMockRepository({ eventSpend: 0.85 });

      const result = await calculateSmartRefund(
        repo,
        "run-123",
        1.0, // totalPayment
        0.1, // creatorMarkup
        0.05, // platformFee
      );

      // totalPayment (1.0) - actualSpent (0.85) - platformFee (0.05) - creatorMarkup (0.1) = 0 unused
      // refund = creatorMarkup only
      expect(result.refundAmount).toBeCloseTo(0.1, 2);
      expect(result.breakdown.unused_resources).toBeCloseTo(0, 2);
    });
  });

  describe("createCreatorPayout", () => {
    it("should create payout record successfully", async () => {
      const repo = createMockRepository();

      const result = await createCreatorPayout(
        repo,
        "run-123",
        "job-123",
        "user-123",
        "wallet-address",
        0.5,
        "solana",
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe("payout");
      expect(result.amount).toBe(0.5);
      expect(result.recipient).toBe("wallet-address");
      expect(repo.createPayout).toHaveBeenCalledWith({
        runId: "run-123",
        jobId: "job-123",
        recipientAddress: "wallet-address",
        creatorId: "user-123",
        amount: 0.5,
        network: "solana",
      });
    });

    it("should handle insert error", async () => {
      const repo = createMockRepository({ payoutError: "DB error" });

      const result = await createCreatorPayout(
        repo,
        "run-123",
        "job-123",
        "user-123",
        "wallet-address",
        0.5,
        "solana",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });
  });

  describe("createPayerRefund", () => {
    it("should create refund record successfully", async () => {
      const repo = createMockRepository();

      const result = await createPayerRefund(
        repo,
        "run-123",
        "job-123",
        "user-123",
        "payer-address",
        0.45,
        "solana",
        { creator_markup: 0.1, unused_resources: 0.35 },
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe("refund");
      expect(result.amount).toBe(0.45);
      expect(result.refundBreakdown?.creator_markup).toBe(0.1);
      expect(repo.createRefund).toHaveBeenCalledWith({
        runId: "run-123",
        jobId: "job-123",
        recipientAddress: "payer-address",
        creatorId: "user-123",
        amount: 0.45,
        network: "solana",
        refundBreakdown: { creator_markup: 0.1, unused_resources: 0.35 },
      });
    });

    it("should handle null breakdown", async () => {
      const repo = createMockRepository();

      const result = await createPayerRefund(
        repo,
        "run-123",
        "job-123",
        "user-123",
        "payer-address",
        0.1,
        "solana",
        null,
      );

      expect(result.success).toBe(true);
      expect(result.refundBreakdown).toBeUndefined();
    });

    it("should handle insert error", async () => {
      const repo = createMockRepository({ refundError: "DB error" });

      const result = await createPayerRefund(
        repo,
        "run-123",
        "job-123",
        "user-123",
        "payer-address",
        0.45,
        "solana",
        null,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });
  });

  describe("createEscrowRecord", () => {
    it("should skip when no run data found", async () => {
      const repo = createMockRepository({ runData: null });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.type).toBe("skipped");
      expect(result.success).toBe(true);
    });

    it("should skip when no creator markup", async () => {
      const repo = createMockRepository({
        runData: {
          status: "success",
          total_payment: 1.0,
          creator_markup_earned: 0,
          payer_address: "payer-wallet",
          payment_network: "solana",
          creator_wallet_address: "creator-wallet",
          creator_base_wallet_address: null,
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.type).toBe("skipped");
    });

    it("should skip when no payer address", async () => {
      const repo = createMockRepository({
        runData: {
          status: "success",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: null,
          payment_network: "solana",
          creator_wallet_address: "creator-wallet",
          creator_base_wallet_address: null,
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.type).toBe("skipped");
    });

    it("should create payout on success", async () => {
      const repo = createMockRepository({
        runData: {
          status: "success",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: "payer-wallet",
          payment_network: "solana",
          creator_wallet_address: "creator-wallet",
          creator_base_wallet_address: null,
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.type).toBe("payout");
      expect(result.success).toBe(true);
      expect(result.amount).toBe(0.1);
      expect(result.recipient).toBe("creator-wallet");
    });

    it("should use base wallet for base network", async () => {
      const repo = createMockRepository({
        runData: {
          status: "success",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: "payer-wallet",
          payment_network: "base",
          creator_wallet_address: "solana-wallet",
          creator_base_wallet_address: "base-wallet",
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.success).toBe(true);
      expect(result.recipient).toBe("base-wallet");
    });

    it("should skip automatic refund on failure (user must request manually)", async () => {
      const repo = createMockRepository({
        runData: {
          status: "failed",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: "payer-wallet",
          payment_network: "solana",
          creator_wallet_address: "creator-wallet",
          creator_base_wallet_address: null,
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      // Automatic refunds are disabled - users must request refunds via History page
      expect(result.type).toBe("skipped");
      expect(result.success).toBe(true);
    });

    it("should skip automatic refund on failure even with smart refunds enabled", async () => {
      const repo = createMockRepository({
        runData: {
          status: "failed",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: "payer-wallet",
          payment_network: "solana",
          creator_wallet_address: "creator-wallet",
          creator_base_wallet_address: null,
        },
        eventSpend: 0.3, // Some resources ran
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: true,
      });

      // Automatic refunds are disabled - users must request refunds via History page
      expect(result.type).toBe("skipped");
      expect(result.success).toBe(true);
    });

    it("should skip for pending/running runs", async () => {
      const repo = createMockRepository({
        runData: {
          status: "running",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: "payer-wallet",
          payment_network: "solana",
          creator_wallet_address: "creator-wallet",
          creator_base_wallet_address: null,
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.type).toBe("skipped");
    });

    it("should return error when no creator wallet on success", async () => {
      const repo = createMockRepository({
        runData: {
          status: "success",
          total_payment: 1.0,
          creator_markup_earned: 0.1,
          payer_address: "payer-wallet",
          payment_network: "solana",
          creator_wallet_address: null,
          creator_base_wallet_address: null,
        },
      });

      const result = await createEscrowRecord({
        repository: repo,
        runId: "run-123",
        jobId: "job-123",
        userId: "user-123",
        smartRefundsEnabled: false,
      });

      expect(result.type).toBe("payout");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No creator wallet found");
    });
  });
});
