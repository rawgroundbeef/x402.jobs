import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  IChainRepository,
  ChainedJobDetails,
} from "../../../../repositories/ChainRepository";
import { buildChainedSteps, triggerChainedJob } from "../chain";

/**
 * Create a mock repository for testing
 */
function createMockRepository(overrides?: {
  jobChainConfig?: { on_success_job_id: string | null; name: string } | null;
  runStatus?: string | null;
  chainedJobDetails?: ChainedJobDetails | null;
  userWallet?: {
    address: string;
    solanaSecretBase64: string;
    baseAddress: string | null;
    baseSecretBase64: string | null;
  } | null;
  chainedRunId?: string | null;
}): IChainRepository {
  const config = {
    jobChainConfig: null,
    runStatus: null,
    chainedJobDetails: null,
    userWallet: null,
    chainedRunId: null,
    ...overrides,
  };

  return {
    getJobChainConfig: vi.fn().mockResolvedValue(config.jobChainConfig),
    getRunStatus: vi.fn().mockResolvedValue(config.runStatus),
    getChainedJobDetails: vi.fn().mockResolvedValue(config.chainedJobDetails),
    getUserWallet: vi.fn().mockResolvedValue(config.userWallet),
    createChainedRun: vi
      .fn()
      .mockResolvedValue(
        config.chainedRunId ? { id: config.chainedRunId } : null,
      ),
  };
}

describe("chain", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildChainedSteps", () => {
    it("should return empty array for null workflow definition", () => {
      const chainedJob: ChainedJobDetails = {
        id: "job-1",
        name: "Test Job",
        user_id: "user-1",
        workflow_definition: null,
        is_active: true,
        trigger_methods: null,
        published: false,
      };

      const steps = buildChainedSteps(chainedJob);
      expect(steps).toHaveLength(0);
    });

    it("should return empty array for empty nodes", () => {
      const chainedJob: ChainedJobDetails = {
        id: "job-1",
        name: "Test Job",
        user_id: "user-1",
        workflow_definition: { nodes: [], edges: [] },
        is_active: true,
        trigger_methods: null,
        published: false,
      };

      const steps = buildChainedSteps(chainedJob);
      expect(steps).toHaveLength(0);
    });

    it("should build resource steps correctly", () => {
      const chainedJob: ChainedJobDetails = {
        id: "job-1",
        name: "Test Job",
        user_id: "user-1",
        workflow_definition: {
          nodes: [
            {
              id: "node-1",
              type: "resource",
              data: {
                resource: {
                  id: "res-1",
                  resourceUrl: "https://api.example.com",
                  name: "Test Resource",
                  price: 0.1,
                  network: "solana",
                },
                configuredInputs: { prompt: "test" },
              },
            },
          ],
          edges: [],
        },
        is_active: true,
        trigger_methods: null,
        published: false,
      };

      const steps = buildChainedSteps(chainedJob);
      expect(steps).toHaveLength(1);
      expect(steps[0]!.type).toBe("resource");
      expect(steps[0]!.nodeId).toBe("node-1");
      expect(steps[0]!.dependencies).toHaveLength(0);
      expect((steps[0]!.data as any).resourceUrl).toBe(
        "https://api.example.com",
      );
      expect((steps[0]!.data as any).inputs).toEqual({ prompt: "test" });
    });

    it("should build transform steps correctly", () => {
      const chainedJob: ChainedJobDetails = {
        id: "job-1",
        name: "Test Job",
        user_id: "user-1",
        workflow_definition: {
          nodes: [
            {
              id: "node-1",
              type: "transform",
              data: {
                transformType: "extract",
                config: { field: "result" },
              },
            },
          ],
          edges: [],
        },
        is_active: true,
        trigger_methods: null,
        published: false,
      };

      const steps = buildChainedSteps(chainedJob);
      expect(steps).toHaveLength(1);
      expect(steps[0]!.type).toBe("transform");
      expect((steps[0]!.data as any).transformType).toBe("extract");
    });

    it("should build dependencies from edges", () => {
      const chainedJob: ChainedJobDetails = {
        id: "job-1",
        name: "Test Job",
        user_id: "user-1",
        workflow_definition: {
          nodes: [
            {
              id: "node-1",
              type: "resource",
              data: {
                resource: {
                  id: "res-1",
                  resourceUrl: "https://api1.example.com",
                },
              },
            },
            {
              id: "node-2",
              type: "resource",
              data: {
                resource: {
                  id: "res-2",
                  resourceUrl: "https://api2.example.com",
                },
              },
            },
          ],
          edges: [{ source: "node-1", target: "node-2" }],
        },
        is_active: true,
        trigger_methods: null,
        published: false,
      };

      const steps = buildChainedSteps(chainedJob);
      expect(steps).toHaveLength(2);
      expect(steps[0]!.dependencies).toHaveLength(0);
      expect(steps[1]!.dependencies).toContain("node-1");
    });

    it("should filter out non-resource/transform nodes from dependencies", () => {
      const chainedJob: ChainedJobDetails = {
        id: "job-1",
        name: "Test Job",
        user_id: "user-1",
        workflow_definition: {
          nodes: [
            { id: "trigger", type: "trigger" },
            {
              id: "node-1",
              type: "resource",
              data: {
                resource: {
                  id: "res-1",
                  resourceUrl: "https://api.example.com",
                },
              },
            },
          ],
          edges: [{ source: "trigger", target: "node-1" }],
        },
        is_active: true,
        trigger_methods: null,
        published: false,
      };

      const steps = buildChainedSteps(chainedJob);
      expect(steps).toHaveLength(1);
      expect(steps[0]!.dependencies).toHaveLength(0); // trigger filtered out
    });
  });

  describe("triggerChainedJob", () => {
    it("should return early when no chain configured", async () => {
      const repo = createMockRepository({ jobChainConfig: null });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("No chain configured");
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("should return early when on_success_job_id is null", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: null, name: "Test Job" },
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("No chain configured");
    });

    it("should skip when run status is not success", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "failed",
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("Run status is failed");
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("should notify when looping job fails", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-1", name: "Loop Job" }, // Same job = loop
        runStatus: "failed",
      });
      const mockInngestSend = vi.fn();
      const mockNotifyLoopFailed = vi.fn().mockResolvedValue({ id: "notif-1" });
      const mockBroadcastNotification = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        notifyLoopFailed: mockNotifyLoopFailed,
        broadcastNotification: mockBroadcastNotification,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(mockNotifyLoopFailed).toHaveBeenCalledWith(
        "user-1",
        "job-1",
        "Loop Job",
      );
      expect(mockBroadcastNotification).toHaveBeenCalled();
    });

    it("should skip when chained job not found", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "success",
        chainedJobDetails: null,
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("Chained job not found");
    });

    it("should skip when chained job is not active", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "success",
        chainedJobDetails: {
          id: "job-2",
          name: "Chained Job",
          user_id: "user-1",
          workflow_definition: null,
          is_active: false,
          trigger_methods: null,
          published: false,
        },
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("Chained job is not active");
    });

    it("should skip when chained job has no executable steps", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "success",
        chainedJobDetails: {
          id: "job-2",
          name: "Chained Job",
          user_id: "user-1",
          workflow_definition: { nodes: [], edges: [] },
          is_active: true,
          trigger_methods: null,
          published: false,
        },
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("No executable steps");
    });

    it("should handle failed run creation", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "success",
        chainedJobDetails: {
          id: "job-2",
          name: "Chained Job",
          user_id: "user-1",
          workflow_definition: {
            nodes: [
              {
                id: "node-1",
                type: "resource",
                data: {
                  resource: {
                    id: "res-1",
                    resourceUrl: "https://api.example.com",
                  },
                },
              },
            ],
            edges: [],
          },
          is_active: true,
          trigger_methods: null,
          published: false,
        },
        chainedRunId: null, // Run creation fails
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("Failed to create run record");
    });

    it("should handle missing wallet", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "success",
        chainedJobDetails: {
          id: "job-2",
          name: "Chained Job",
          user_id: "user-1",
          workflow_definition: {
            nodes: [
              {
                id: "node-1",
                type: "resource",
                data: {
                  resource: {
                    id: "res-1",
                    resourceUrl: "https://api.example.com",
                  },
                },
              },
            ],
            edges: [],
          },
          is_active: true,
          trigger_methods: null,
          published: false,
        },
        chainedRunId: "run-2",
        userWallet: null,
      });
      const mockInngestSend = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe("No wallet found");
    });

    it("should successfully trigger chained job", async () => {
      const repo = createMockRepository({
        jobChainConfig: { on_success_job_id: "job-2", name: "Test Job" },
        runStatus: "success",
        chainedJobDetails: {
          id: "job-2",
          name: "Chained Job",
          user_id: "user-1",
          workflow_definition: {
            nodes: [
              {
                id: "node-1",
                type: "resource",
                data: {
                  resource: {
                    id: "res-1",
                    resourceUrl: "https://api.example.com",
                    name: "Test Resource",
                  },
                },
              },
            ],
            edges: [],
          },
          is_active: true,
          trigger_methods: null,
          published: false,
        },
        chainedRunId: "run-2",
        userWallet: {
          address: "wallet-address",
          solanaSecretBase64: "secret-key",
          baseAddress: null,
          baseSecretBase64: null,
        },
      });
      const mockInngestSend = vi.fn().mockResolvedValue(undefined);
      const mockBroadcastRunEvent = vi.fn();

      const result = await triggerChainedJob({
        repository: repo,
        inngestSend: mockInngestSend,
        broadcastRunEvent: mockBroadcastRunEvent,
        jobId: "job-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(result.triggered).toBe(true);
      expect(result.chainedRunId).toBe("run-2");
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "x402/workflow.run",
          data: expect.objectContaining({
            runId: "run-2",
            jobId: "job-2",
            userId: "user-1",
          }),
        }),
      );
      expect(mockBroadcastRunEvent).toHaveBeenCalledWith(
        "user-1",
        "run-2",
        "job-2",
        "run:started",
        expect.objectContaining({
          chainedFrom: "job-1",
          parentRunId: "run-1",
        }),
      );
    });
  });
});
