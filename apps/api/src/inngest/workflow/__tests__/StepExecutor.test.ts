import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeStep } from "../StepExecutor";
import type {
  WorkflowStep,
  WorkflowTransform,
  ExecutionContext,
} from "../types";

// Mock supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

describe("StepExecutor", () => {
  // Silence console output during tests
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe("executeStep for transforms", () => {
    const baseCtx: ExecutionContext = {
      runId: "test-run-id",
      supabase: mockSupabase as any,
      walletSecretKey: "test-key",
      outputs: {},
      workflowInputs: {},
    };

    it("should use step dependencies to set transform sourceNodeId", async () => {
      // This tests the fix we made - transforms should get input from their dependencies
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "transform-extract",
        dependencies: ["resource-pfpputer"],
        data: {
          nodeId: "transform-extract",
          transformType: "extract",
          config: { path: "artifactUrl" },
          // Note: sourceNodeId is NOT set in the data
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          "resource-pfpputer": {
            jobId: "job-123",
            artifactUrl: "https://example.com/image.png",
            response: "Your PFP is ready!",
          },
          "transform-previous": "Some other string output",
        },
      };

      const result = await executeStep(step, ctx);

      // The transform should extract from resource-pfpputer (first dependency)
      // NOT from transform-previous (which was the bug)
      expect(result.success).toBe(true);
      expect(result.output).toBe("https://example.com/image.png");
    });

    it("should prefer explicit sourceNodeId over dependencies", async () => {
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "transform-extract",
        dependencies: ["resource-1"],
        data: {
          nodeId: "transform-extract",
          transformType: "extract",
          sourceNodeId: "resource-2", // Explicitly set
          config: { path: "value" },
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          "resource-1": { value: "from-dependency" },
          "resource-2": { value: "from-explicit-source" },
        },
      };

      const result = await executeStep(step, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("from-explicit-source");
    });

    it("should handle empty dependencies gracefully", async () => {
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "transform-1",
        dependencies: [],
        data: {
          nodeId: "transform-1",
          transformType: "extract",
          config: { path: "value" },
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          "some-node": { value: "test" },
        },
      };

      const result = await executeStep(step, ctx);

      // Should fall back to using the last output
      expect(result.success).toBe(true);
    });

    it("should handle undefined dependencies gracefully", async () => {
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "transform-1",
        // dependencies is undefined
        data: {
          nodeId: "transform-1",
          transformType: "extract",
          config: { path: "value" },
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          "some-node": { value: "test" },
        },
      };

      const result = await executeStep(step, ctx);

      // Should not crash
      expect(result.success).toBe(true);
    });
  });

  describe("transform result handling", () => {
    const baseCtx: ExecutionContext = {
      runId: "test-run-id",
      supabase: mockSupabase as any,
      walletSecretKey: "test-key",
      outputs: {},
      workflowInputs: {},
    };

    it("should return nodeId in result", async () => {
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "my-transform-id",
        dependencies: ["source"],
        data: {
          nodeId: "my-transform-id",
          transformType: "extract",
          config: { path: "value" },
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          source: { value: "test" },
        },
      };

      const result = await executeStep(step, ctx);

      expect(result.nodeId).toBe("my-transform-id");
    });

    it("should return paid: 0 for transforms", async () => {
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "transform-1",
        dependencies: ["source"],
        data: {
          nodeId: "transform-1",
          transformType: "extract",
          config: { path: "value" },
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          source: { value: "test" },
        },
      };

      const result = await executeStep(step, ctx);

      expect(result.paid).toBe(0);
    });

    it("should propagate transform errors correctly", async () => {
      const step: WorkflowStep = {
        type: "transform",
        nodeId: "transform-1",
        dependencies: ["source"],
        data: {
          nodeId: "transform-1",
          transformType: "code",
          config: { code: "throw new Error('Test error');" },
        } as WorkflowTransform,
      };

      const ctx: ExecutionContext = {
        ...baseCtx,
        outputs: {
          source: { value: "test" },
        },
      };

      const result = await executeStep(step, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Test error");
    });
  });
});
