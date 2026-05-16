import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processSinglePayout,
  processPendingPayouts,
  processSinglePayoutById,
  MAX_ATTEMPTS,
  ProcessPayoutContext,
  PayoutLogger,
  TransferFn,
} from "../process-payout";
import type {
  IPayoutRepository,
  Payout,
} from "../../../../repositories/PayoutRepository";

// Mock repository factory
function createMockRepository(
  overrides: Partial<IPayoutRepository> = {},
): IPayoutRepository {
  return {
    getPendingPayouts: vi.fn().mockResolvedValue([]),
    getPayoutById: vi.fn().mockResolvedValue(null),
    markProcessing: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markRetry: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Mock logger factory
function createMockLogger(): PayoutLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// Mock transfer functions
function createSuccessTransfer(signature: string = "sig-123"): TransferFn {
  return vi.fn().mockResolvedValue({ success: true, signature });
}

function createFailedTransfer(error: string = "Transfer failed"): TransferFn {
  return vi.fn().mockResolvedValue({ success: false, error });
}

function createThrowingTransfer(error: string = "Network error"): TransferFn {
  return vi.fn().mockRejectedValue(new Error(error));
}

// Sample payout factory
function createPayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "payout-123",
    run_id: "run-456",
    job_id: "job-789",
    type: "creator_payout",
    recipient_address: "recipient-wallet-address",
    creator_id: "creator-123",
    amount: 5.0,
    network: "solana",
    status: "pending",
    transaction_signature: null,
    error: null,
    created_at: new Date().toISOString(),
    processed_at: null,
    attempts: 0,
    last_attempt_at: null,
    refund_breakdown: null,
    ...overrides,
  };
}

describe("processSinglePayout", () => {
  let mockLogger: PayoutLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
  });

  describe("network validation", () => {
    it("should skip Solana payout when Solana is disabled", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ network: "solana" });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: false,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(repository.markProcessing).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should skip Base payout when Base is disabled", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ network: "base" });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: false,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(repository.markProcessing).not.toHaveBeenCalled();
    });
  });

  describe("successful transfers", () => {
    it("should process Solana payout successfully", async () => {
      const repository = createMockRepository();
      const transferSolana = createSuccessTransfer("solana-sig-abc");
      const payout = createPayout({ network: "solana", amount: 4.95 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana,
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(true);
      expect(result.signature).toBe("solana-sig-abc");
      expect(repository.markProcessing).toHaveBeenCalledWith("payout-123", 1);
      expect(repository.markCompleted).toHaveBeenCalledWith(
        "payout-123",
        "solana-sig-abc",
      );
      expect(transferSolana).toHaveBeenCalledWith(
        "recipient-wallet-address",
        4.95,
      );
    });

    it("should process Base payout successfully", async () => {
      const repository = createMockRepository();
      const transferBase = vi.fn().mockResolvedValue({
        success: true,
        transactionHash: "base-hash-xyz",
      });
      const payout = createPayout({ network: "base", amount: 10.0 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase,
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(true);
      expect(result.signature).toBe("base-hash-xyz");
      expect(repository.markCompleted).toHaveBeenCalledWith(
        "payout-123",
        "base-hash-xyz",
      );
      expect(transferBase).toHaveBeenCalledWith(
        "recipient-wallet-address",
        10.0,
      );
    });

    it("should handle payer refund type", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ type: "payer_refund" });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer("refund-sig"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("[refund:"),
      );
    });
  });

  describe("failed transfers with retries", () => {
    it("should mark for retry on first failure", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: 0 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createFailedTransfer("Insufficient funds"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.willRetry).toBe(true);
      expect(result.error).toBe("Insufficient funds");
      expect(repository.markRetry).toHaveBeenCalledWith(
        "payout-123",
        "Insufficient funds",
      );
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it("should mark for retry on second failure", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: 1 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createFailedTransfer("Network timeout"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.willRetry).toBe(true);
      expect(repository.markRetry).toHaveBeenCalled();
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it("should mark as failed after MAX_ATTEMPTS", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: MAX_ATTEMPTS - 1 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createFailedTransfer("Final failure"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.willRetry).toBeUndefined();
      expect(result.error).toBe("Final failure");
      expect(repository.markFailed).toHaveBeenCalledWith(
        "payout-123",
        "Final failure",
      );
      expect(repository.markRetry).not.toHaveBeenCalled();
    });
  });

  describe("exception handling", () => {
    it("should handle thrown errors and retry", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: 0 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createThrowingTransfer("Connection refused"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.willRetry).toBe(true);
      expect(result.error).toBe("Connection refused");
      expect(repository.markRetry).toHaveBeenCalled();
    });

    it("should mark as failed after MAX_ATTEMPTS with thrown error", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: MAX_ATTEMPTS - 1 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createThrowingTransfer("Fatal error"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.willRetry).toBeUndefined();
      expect(repository.markFailed).toHaveBeenCalledWith(
        "payout-123",
        "Fatal error",
      );
    });

    it("should handle unsupported network", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ network: "ethereum" as "solana" });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processSinglePayout(payout, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported network");
    });
  });

  describe("attempt counting", () => {
    it("should increment attempts from 0 to 1", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: 0 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
      };

      await processSinglePayout(payout, ctx);

      expect(repository.markProcessing).toHaveBeenCalledWith("payout-123", 1);
    });

    it("should increment attempts from 2 to 3", async () => {
      const repository = createMockRepository();
      const payout = createPayout({ attempts: 2 });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
      };

      await processSinglePayout(payout, ctx);

      expect(repository.markProcessing).toHaveBeenCalledWith("payout-123", 3);
    });
  });
});

describe("processPendingPayouts", () => {
  let mockLogger: PayoutLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
  });

  describe("empty/disabled scenarios", () => {
    it("should return zeros when both networks disabled", async () => {
      const repository = createMockRepository();

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: false,
        baseEnabled: false,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
      expect(repository.getPendingPayouts).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No platform wallet configured - skipping payout processing",
      );
    });

    it("should return zeros when no pending payouts", async () => {
      const repository = createMockRepository({
        getPendingPayouts: vi.fn().mockResolvedValue([]),
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it("should handle fetch error gracefully", async () => {
      const repository = createMockRepository({
        getPendingPayouts: vi
          .fn()
          .mockRejectedValue(new Error("DB connection failed")),
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result.processed).toBe(0);
      expect(result.error).toBe("DB connection failed");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("batch processing", () => {
    it("should process all payouts successfully", async () => {
      const payouts = [
        createPayout({ id: "payout-1", amount: 1.0 }),
        createPayout({ id: "payout-2", amount: 2.0 }),
        createPayout({ id: "payout-3", amount: 3.0 }),
      ];
      const repository = createMockRepository({
        getPendingPayouts: vi.fn().mockResolvedValue(payouts),
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it("should count skipped payouts correctly", async () => {
      const payouts = [
        createPayout({ id: "payout-1", network: "solana" }),
        createPayout({ id: "payout-2", network: "base" }),
      ];
      const repository = createMockRepository({
        getPendingPayouts: vi.fn().mockResolvedValue(payouts),
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: false, // Base disabled
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it("should count failed payouts correctly (after max attempts)", async () => {
      const payouts = [
        createPayout({ id: "payout-1", attempts: 0 }),
        createPayout({ id: "payout-2", attempts: MAX_ATTEMPTS - 1 }), // Will fail permanently
      ];
      const repository = createMockRepository({
        getPendingPayouts: vi.fn().mockResolvedValue(payouts),
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createFailedTransfer("Error"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1); // Only the one that exhausted retries
    });

    it("should not count retryable failures as failed", async () => {
      const payouts = [
        createPayout({ id: "payout-1", attempts: 0 }),
        createPayout({ id: "payout-2", attempts: 1 }),
      ];
      const repository = createMockRepository({
        getPendingPayouts: vi.fn().mockResolvedValue(payouts),
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createFailedTransfer("Temporary error"),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0); // Both will retry
    });

    it("should respect batch limit", async () => {
      const repository = createMockRepository();

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana: createSuccessTransfer(),
        transferBase: createSuccessTransfer(),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      await processPendingPayouts(ctx, 5);

      expect(repository.getPendingPayouts).toHaveBeenCalledWith(
        5,
        MAX_ATTEMPTS,
      );
    });

    it("should handle mixed success/failure batch", async () => {
      const payouts = [
        createPayout({ id: "payout-1", amount: 1.0 }),
        createPayout({
          id: "payout-2",
          amount: 2.0,
          attempts: MAX_ATTEMPTS - 1,
        }),
        createPayout({ id: "payout-3", amount: 3.0, network: "base" }),
      ];
      const repository = createMockRepository({
        getPendingPayouts: vi.fn().mockResolvedValue(payouts),
      });

      let callCount = 0;
      const transferSolana: TransferFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1)
          return Promise.resolve({ success: true, signature: "sig-1" });
        return Promise.resolve({ success: false, error: "Failed" });
      });

      const ctx: ProcessPayoutContext = {
        repository,
        transferSolana,
        transferBase: createSuccessTransfer("base-sig"),
        solanaEnabled: true,
        baseEnabled: true,
        logger: mockLogger,
      };

      const result = await processPendingPayouts(ctx);

      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(2); // payout-1 and payout-3
      expect(result.failed).toBe(1); // payout-2 exhausted retries
    });
  });
});

describe("processSinglePayoutById", () => {
  let mockLogger: PayoutLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
  });

  it("should return error when payout not found", async () => {
    const repository = createMockRepository({
      getPayoutById: vi.fn().mockResolvedValue(null),
    });

    const ctx: ProcessPayoutContext = {
      repository,
      transferSolana: createSuccessTransfer(),
      transferBase: createSuccessTransfer(),
      solanaEnabled: true,
      baseEnabled: true,
      logger: mockLogger,
    };

    const result = await processSinglePayoutById("non-existent", ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Payout not found");
  });

  it("should return success message for already completed payout", async () => {
    const payout = createPayout({ status: "completed" });
    const repository = createMockRepository({
      getPayoutById: vi.fn().mockResolvedValue(payout),
    });

    const ctx: ProcessPayoutContext = {
      repository,
      transferSolana: createSuccessTransfer(),
      transferBase: createSuccessTransfer(),
      solanaEnabled: true,
      baseEnabled: true,
      logger: mockLogger,
    };

    const result = await processSinglePayoutById("payout-123", ctx);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Payout already completed");
    expect(repository.markProcessing).not.toHaveBeenCalled();
  });

  it("should process pending payout", async () => {
    const payout = createPayout({ status: "pending" });
    const repository = createMockRepository({
      getPayoutById: vi.fn().mockResolvedValue(payout),
    });

    const ctx: ProcessPayoutContext = {
      repository,
      transferSolana: createSuccessTransfer("manual-sig"),
      transferBase: createSuccessTransfer(),
      solanaEnabled: true,
      baseEnabled: true,
      logger: mockLogger,
    };

    const result = await processSinglePayoutById("payout-123", ctx);

    expect(result.success).toBe(true);
    expect(result.signature).toBe("manual-sig");
    expect(repository.markCompleted).toHaveBeenCalled();
  });

  it("should process failed payout (retry)", async () => {
    const payout = createPayout({ status: "failed", attempts: 1 });
    const repository = createMockRepository({
      getPayoutById: vi.fn().mockResolvedValue(payout),
    });

    const ctx: ProcessPayoutContext = {
      repository,
      transferSolana: createSuccessTransfer("retry-sig"),
      transferBase: createSuccessTransfer(),
      solanaEnabled: true,
      baseEnabled: true,
      logger: mockLogger,
    };

    const result = await processSinglePayoutById("payout-123", ctx);

    expect(result.success).toBe(true);
    expect(result.signature).toBe("retry-sig");
  });
});
