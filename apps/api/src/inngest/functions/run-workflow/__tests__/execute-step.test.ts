import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeWorkflowStep,
  ExecuteWorkflowStepContext,
  BroadcastRunEventFn,
  StepExecutorFn,
} from "../execute-step";
import type { IStepExecutionRepository } from "../../../../repositories/StepExecutionRepository";
import type { WorkflowStep, StepResult } from "../../../workflow/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock repository factory
function createMockRepository(
  overrides: Partial<IStepExecutionRepository> = {},
): IStepExecutionRepository {
  return {
    getRunStatus: vi.fn().mockResolvedValue("running"),
    getEventRecordBySequence: vi.fn().mockResolvedValue({ id: "event-123" }),
    getAllEventRecords: vi.fn().mockResolvedValue([]),
    markEventRunning: vi.fn().mockResolvedValue(undefined),
    markEventCompleted: vi.fn().mockResolvedValue(undefined),
    markEventFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Mock step executor factory
function createMockStepExecutor(
  result: Partial<StepResult> = {},
): StepExecutorFn {
  return vi.fn().mockResolvedValue({
    success: true,
    nodeId: "node-1",
    output: { data: "test output" },
    paid: 0.05,
    paymentSignature: "sig-123",
    resolvedInputs: { prompt: "test" },
    ...result,
  });
}

// Mock Supabase client
const mockSupabase = {} as SupabaseClient;

// Sample workflow step
const sampleStep: WorkflowStep = {
  type: "resource",
  nodeId: "node-1",
  dependencies: [],
  data: {
    resourceId: "res-123",
    resourceUrl: "https://api.example.com/resource",
    resourceName: "Test Resource",
    resourcePrice: 0.05,
    resourceNetwork: "solana",
    nodeId: "node-1",
    inputs: { prompt: "test" },
  },
};

describe("executeWorkflowStep", () => {
  let mockBroadcast: BroadcastRunEventFn;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBroadcast = vi.fn();
  });

  describe("cancellation handling", () => {
    it("should return cancelled when run status is cancelled", async () => {
      const repository = createMockRepository({
        getRunStatus: vi.fn().mockResolvedValue("cancelled"),
      });
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        broadcastRunEvent: mockBroadcast,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      const result = await executeWorkflowStep(sampleStep, 0, ctx);

      expect(result.cancelled).toBe(true);
      expect(result.success).toBe(false);
      expect(stepExecutor).not.toHaveBeenCalled();
      expect(repository.markEventRunning).not.toHaveBeenCalled();
    });

    it("should proceed when run status is running", async () => {
      const repository = createMockRepository({
        getRunStatus: vi.fn().mockResolvedValue("running"),
      });
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      const result = await executeWorkflowStep(sampleStep, 0, ctx);

      expect(result.cancelled).toBeUndefined();
      expect(result.success).toBe(true);
      expect(stepExecutor).toHaveBeenCalled();
    });
  });

  describe("event record lookup", () => {
    it("should throw error when event record not found", async () => {
      const repository = createMockRepository({
        getEventRecordBySequence: vi.fn().mockResolvedValue(null),
        getAllEventRecords: vi
          .fn()
          .mockResolvedValue([
            { id: "other-event", sequence: 5, status: "pending" },
          ]),
      });
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await expect(executeWorkflowStep(sampleStep, 0, ctx)).rejects.toThrow(
        "Event record not found for sequence 0",
      );
      expect(repository.getAllEventRecords).toHaveBeenCalledWith("run-123");
    });

    it("should look up event by run_id and sequence", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 3, ctx);

      expect(repository.getEventRecordBySequence).toHaveBeenCalledWith(
        "run-123",
        3,
      );
    });
  });

  describe("step execution success", () => {
    it("should mark event as running before execution", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventRunning).toHaveBeenCalledWith("event-123");
    });

    it("should call step executor with correct context", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const outputs = { previousNode: { data: "prev output" } };
      const workflowInputs = { userInput: "test input" };

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        baseWalletKey: "base-wallet-key",
        outputs,
        workflowInputs,
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(stepExecutor).toHaveBeenCalledWith(sampleStep, {
        supabase: mockSupabase,
        walletSecretKey: "wallet-key",
        baseWalletKey: "base-wallet-key",
        outputs,
        workflowInputs,
        currentJobId: "job-789",
        userId: "user-456",
      });
    });

    it("should mark event as completed with output data", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        output: { result: "success data" },
        paid: 0.1,
        paymentSignature: "payment-sig-abc",
        resolvedInputs: { prompt: "resolved prompt" },
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventCompleted).toHaveBeenCalledWith("event-123", {
        output: { result: "success data" },
        outputText: '{"result":"success data"}',
        paymentSignature: "payment-sig-abc",
        amountPaid: 0.1,
        resolvedInputs: { prompt: "resolved prompt" },
      });
    });

    it("should stringify output correctly for outputText when output is string", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        output: "plain string output",
        paid: 0.05,
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventCompleted).toHaveBeenCalledWith(
        "event-123",
        expect.objectContaining({
          output: "plain string output",
          outputText: "plain string output",
        }),
      );
    });

    it("should return success result with all fields", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        nodeId: "node-1",
        output: { data: "test" },
        paid: 0.15,
        paymentSignature: "sig-xyz",
        resolvedInputs: { input: "resolved" },
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      const result = await executeWorkflowStep(sampleStep, 0, ctx);

      expect(result).toEqual({
        success: true,
        nodeId: "node-1",
        output: { data: "test" },
        paid: 0.15,
        paymentSignature: "sig-xyz",
        resolvedInputs: { input: "resolved" },
        error: undefined,
      });
    });
  });

  describe("step execution failure", () => {
    it("should mark event as failed with error message", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: false,
        error: "Resource unavailable",
        resolvedInputs: { prompt: "failed input" },
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventFailed).toHaveBeenCalledWith(
        "event-123",
        "Resource unavailable",
        { prompt: "failed input" },
      );
    });

    it("should use default error message when error is undefined", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: false,
        error: undefined,
        resolvedInputs: undefined,
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventFailed).toHaveBeenCalledWith(
        "event-123",
        "Unknown error",
        undefined,
      );
    });

    it("should return failure result with error", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: false,
        nodeId: "node-1",
        error: "Payment failed",
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      const result = await executeWorkflowStep(sampleStep, 0, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Payment failed");
    });
  });

  describe("broadcasting", () => {
    it("should broadcast running status when step starts", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        broadcastRunEvent: mockBroadcast,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(mockBroadcast).toHaveBeenCalledWith(
        "user-456",
        "run-123",
        "job-789",
        "run:step",
        {
          nodeId: "node-1",
          status: "running",
        },
      );
    });

    it("should broadcast completed status on success", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        output: { data: "completed" },
        paid: 0.05,
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        broadcastRunEvent: mockBroadcast,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(mockBroadcast).toHaveBeenCalledWith(
        "user-456",
        "run-123",
        "job-789",
        "run:step",
        {
          nodeId: "node-1",
          status: "completed",
          output: { data: "completed" },
          paid: 0.05,
        },
      );
    });

    it("should broadcast failed status on failure", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: false,
        error: "Step failed",
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        broadcastRunEvent: mockBroadcast,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(mockBroadcast).toHaveBeenCalledWith(
        "user-456",
        "run-123",
        "job-789",
        "run:step",
        {
          nodeId: "node-1",
          status: "failed",
          error: "Step failed",
        },
      );
    });

    it("should not broadcast when broadcastRunEvent is undefined", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        // broadcastRunEvent not provided
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      // Should not throw
      await expect(
        executeWorkflowStep(sampleStep, 0, ctx),
      ).resolves.toBeDefined();
    });

    it("should not broadcast when userId is empty", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        broadcastRunEvent: mockBroadcast,
        runId: "run-123",
        userId: "", // Empty userId
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle missing paymentSignature gracefully", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        paymentSignature: undefined,
        paid: 0,
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventCompleted).toHaveBeenCalledWith(
        "event-123",
        expect.objectContaining({
          paymentSignature: "",
          amountPaid: 0,
        }),
      );
    });

    it("should handle missing resolvedInputs gracefully", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        resolvedInputs: undefined,
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(repository.markEventCompleted).toHaveBeenCalledWith(
        "event-123",
        expect.objectContaining({
          resolvedInputs: undefined,
        }),
      );
    });

    it("should handle transform step type", async () => {
      const transformStep: WorkflowStep = {
        type: "transform",
        nodeId: "transform-node",
        dependencies: ["node-1"],
        data: {
          nodeId: "transform-node",
          transformType: "extract",
          config: { path: "data.result" },
          sourceNodeId: "node-1",
        },
      };

      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor({
        success: true,
        nodeId: "transform-node",
        output: "extracted value",
      });

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: {},
      };

      const result = await executeWorkflowStep(transformStep, 0, ctx);

      expect(stepExecutor).toHaveBeenCalledWith(
        transformStep,
        expect.anything(),
      );
      expect(result.success).toBe(true);
      expect(result.nodeId).toBe("transform-node");
    });

    it("should pass empty workflowInputs as empty object", async () => {
      const repository = createMockRepository();
      const stepExecutor = createMockStepExecutor();

      const ctx: ExecuteWorkflowStepContext = {
        repository,
        stepExecutor,
        supabase: mockSupabase,
        runId: "run-123",
        userId: "user-456",
        jobId: "job-789",
        walletSecretKey: "wallet-key",
        outputs: {},
        workflowInputs: undefined as unknown as Record<string, unknown>,
      };

      await executeWorkflowStep(sampleStep, 0, ctx);

      expect(stepExecutor).toHaveBeenCalledWith(
        sampleStep,
        expect.objectContaining({
          workflowInputs: {},
        }),
      );
    });
  });
});
