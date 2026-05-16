import type {
  IChainRepository,
  ChainedJobDetails,
  WorkflowNode,
  WorkflowEdge,
} from "../../../repositories/ChainRepository";

/**
 * Inngest event for triggering a workflow run
 */
export interface WorkflowRunEvent {
  name: "x402/workflow.run";
  data: {
    runId: string;
    jobId: string;
    userId: string;
    walletPublicKey: string;
    walletSecretKey: string;
    baseWalletAddress: string | null;
    baseWalletKey: string | null;
    steps: WorkflowStep[];
    workflowInputs: Record<string, unknown>;
  };
}

/**
 * Workflow step for chained execution
 */
export interface WorkflowStep {
  type: "resource" | "transform";
  nodeId: string;
  dependencies: string[];
  data: ResourceStepData | TransformStepData;
}

interface ResourceStepData {
  resourceId: string;
  resourceUrl: string;
  resourceName: string;
  resourcePrice: number;
  resourceNetwork: string;
  resourceMethod: string;
  nodeId: string;
  inputs: Record<string, unknown>;
}

interface TransformStepData {
  nodeId: string;
  transformType: string;
  config: Record<string, unknown>;
  sourceNodeId: string | null;
}

/**
 * Broadcast function type (local to this module, also exported from execute-step.ts)
 */
type BroadcastRunEventFn = (
  userId: string,
  runId: string,
  jobId: string,
  event: "run:started" | "run:step" | "run:completed",
  data?: Record<string, unknown>,
) => void;

/**
 * Notification function type
 */
export type NotifyLoopFailedFn = (
  userId: string,
  jobId: string,
  jobName: string,
) => Promise<{ id: string }>;

/**
 * Broadcast notification function type
 */
export type BroadcastNotificationFn = (
  userId: string,
  notification: Record<string, unknown>,
) => void;

/**
 * Context for triggerChainedJob function
 */
export interface TriggerChainedJobContext {
  repository: IChainRepository;
  inngestSend: (event: WorkflowRunEvent) => Promise<unknown>;
  broadcastRunEvent?: BroadcastRunEventFn;
  notifyLoopFailed?: NotifyLoopFailedFn;
  broadcastNotification?: BroadcastNotificationFn;
  jobId: string;
  runId: string;
  userId: string;
}

/**
 * Result of triggerChainedJob function
 */
export interface TriggerChainedJobResult {
  triggered: boolean;
  chainedRunId?: string;
  reason?: string;
}

/**
 * Build workflow steps from a chained job's workflow definition
 */
export function buildChainedSteps(
  chainedJob: ChainedJobDetails,
): WorkflowStep[] {
  const workflowDef = chainedJob.workflow_definition;
  if (!workflowDef) return [];

  const nodes: WorkflowNode[] = workflowDef.nodes || [];
  const edges: WorkflowEdge[] = workflowDef.edges || [];

  // Build dependency map from edges
  const dependencyMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!dependencyMap.has(edge.target)) {
      dependencyMap.set(edge.target, []);
    }
    dependencyMap.get(edge.target)!.push(edge.source);
  }

  // Build proper steps with full resource data
  const steps: WorkflowStep[] = nodes
    .filter((node) => node.type === "resource" || node.type === "transform")
    .map((node) => {
      // Filter dependencies to only include resource/transform nodes
      const deps = (dependencyMap.get(node.id) || []).filter((depId) =>
        nodes.some(
          (n) =>
            n.id === depId && (n.type === "resource" || n.type === "transform"),
        ),
      );

      if (node.type === "resource" && node.data?.resource) {
        const r = node.data.resource;
        return {
          type: "resource" as const,
          nodeId: node.id,
          dependencies: deps,
          data: {
            resourceId: r.id,
            resourceUrl: r.resourceUrl,
            resourceName: r.name || r.displayName || "Resource",
            resourcePrice: r.price || 0,
            resourceNetwork: r.network || "solana",
            resourceMethod: r.outputSchema?.input?.method || "POST",
            nodeId: node.id,
            inputs: node.data.configuredInputs || {},
          },
        };
      } else {
        // Transform node
        return {
          type: "transform" as const,
          nodeId: node.id,
          dependencies: deps,
          data: {
            nodeId: node.id,
            transformType: node.data?.transformType || "extract",
            config: node.data?.config || {},
            sourceNodeId: deps[0] || null,
          },
        };
      }
    });

  return steps;
}

/**
 * Trigger a chained job if configured
 *
 * This function:
 * 1. Checks if the job has on_success_job_id configured
 * 2. Verifies the current run was successful
 * 3. If it's a loop and failed, sends notification
 * 4. Builds steps from the chained job's workflow
 * 5. Creates a new run record and triggers via Inngest
 */
export async function triggerChainedJob(
  ctx: TriggerChainedJobContext,
): Promise<TriggerChainedJobResult> {
  const {
    repository,
    inngestSend,
    broadcastRunEvent,
    notifyLoopFailed,
    broadcastNotification,
    jobId,
    runId,
    userId,
  } = ctx;

  // Get job's chain configuration
  const jobConfig = await repository.getJobChainConfig(jobId);
  if (!jobConfig?.on_success_job_id) {
    return { triggered: false, reason: "No chain configured" };
  }

  const isLoop = jobConfig.on_success_job_id === jobId;

  // Check if run was successful
  const runStatus = await repository.getRunStatus(runId);
  if (runStatus !== "success") {
    console.log(`⏭️ Skipping chained job - run status is ${runStatus}`);

    // If this was a looping job and it failed, notify the user
    if (isLoop && runStatus === "failed") {
      console.log(`🔔 Notifying user about failed loop for job ${jobId}`);
      try {
        if (notifyLoopFailed && broadcastNotification) {
          const notification = await notifyLoopFailed(
            userId,
            jobId,
            jobConfig.name,
          );
          broadcastNotification(userId, { ...notification });
        }
      } catch (notifyErr) {
        console.error(
          `❌ Failed to send loop failure notification:`,
          notifyErr,
        );
      }
    }

    return { triggered: false, reason: `Run status is ${runStatus}` };
  }

  const chainedJobId = jobConfig.on_success_job_id;
  console.log(`🔗 Triggering chained job ${chainedJobId}`);

  // Get chained job details
  const chainedJob = await repository.getChainedJobDetails(chainedJobId);
  if (!chainedJob) {
    console.error(`❌ Chained job not found`);
    return { triggered: false, reason: "Chained job not found" };
  }

  if (!chainedJob.is_active) {
    console.log(`⏭️ Chained job is not active, skipping`);
    return { triggered: false, reason: "Chained job is not active" };
  }

  // Build workflow steps
  const chainedSteps = buildChainedSteps(chainedJob);
  if (chainedSteps.length === 0) {
    console.log(`⏭️ Chained job has no executable steps`);
    return { triggered: false, reason: "No executable steps" };
  }

  // Create a run record for the chained job
  const chainedRun = await repository.createChainedRun({
    jobId: chainedJobId,
    userId,
    parentJobId: jobId,
    parentRunId: runId,
  });

  if (!chainedRun) {
    console.error(`❌ Failed to create chained run`);
    return { triggered: false, reason: "Failed to create run record" };
  }

  // Get wallet info for the chained run
  const wallet = await repository.getUserWallet(userId);
  if (!wallet) {
    console.error(`❌ No wallet found for user ${userId}`);
    return { triggered: false, reason: "No wallet found" };
  }

  // Trigger the chained workflow
  await inngestSend({
    name: "x402/workflow.run",
    data: {
      runId: chainedRun.id,
      jobId: chainedJobId,
      userId,
      walletPublicKey: wallet.address,
      walletSecretKey: wallet.solanaSecretBase64,
      baseWalletAddress: wallet.baseAddress,
      baseWalletKey: wallet.baseSecretBase64,
      steps: chainedSteps,
      workflowInputs: {
        _chainedRun: true,
        _parentJobId: jobId,
        _parentRunId: runId,
      },
    },
  });

  console.log(
    `✅ Chained job triggered: ${chainedJob.name} (run: ${chainedRun.id})`,
  );

  // Broadcast chained job started via WebSocket
  if (broadcastRunEvent) {
    broadcastRunEvent(userId, chainedRun.id, chainedJobId, "run:started", {
      chainedFrom: jobId,
      parentRunId: runId,
    });
  }

  return {
    triggered: true,
    chainedRunId: chainedRun.id,
  };
}
