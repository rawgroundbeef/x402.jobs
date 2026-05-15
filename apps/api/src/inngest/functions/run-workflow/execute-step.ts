import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowStep, StepResult } from "../../workflow/types";
import type { IStepExecutionRepository } from "../../../repositories/StepExecutionRepository";

/**
 * Broadcast function type for WebSocket events
 */
export type BroadcastRunEventFn = (
  userId: string,
  runId: string,
  jobId: string,
  type: "run:started" | "run:step" | "run:completed",
  data?: Record<string, unknown>,
) => void;

/**
 * Step executor function type (matches executeStep signature)
 */
export type StepExecutorFn = (
  step: WorkflowStep,
  ctx: {
    supabase: SupabaseClient;
    walletSecretKey: string;
    baseWalletKey?: string;
    outputs: Record<string, unknown>;
    workflowInputs: Record<string, unknown>;
    // For source execution
    currentJobId?: string;
    userId?: string;
  },
) => Promise<StepResult>;

/**
 * Context for executeWorkflowStep function
 */
export interface ExecuteWorkflowStepContext {
  repository: IStepExecutionRepository;
  stepExecutor: StepExecutorFn;
  supabase: SupabaseClient;
  broadcastRunEvent?: BroadcastRunEventFn;
  runId: string;
  userId: string;
  jobId: string;
  walletSecretKey: string;
  baseWalletKey?: string;
  outputs: Record<string, unknown>;
  workflowInputs: Record<string, unknown>;
}

/**
 * Result of executeWorkflowStep
 */
export interface ExecuteWorkflowStepResult {
  success: boolean;
  cancelled?: boolean;
  nodeId: string;
  output?: unknown;
  error?: string;
  paid?: number;
  paymentSignature?: string;
  resolvedInputs?: Record<string, unknown>;
}

/**
 * Execute a single workflow step with proper database tracking and broadcasting.
 *
 * This function:
 * 1. Checks if run was cancelled
 * 2. Gets the event record from DB
 * 3. Marks it as running
 * 4. Executes the step via StepExecutor
 * 5. Updates the event record with result
 * 6. Broadcasts progress via WebSocket
 *
 * @param workflowStep - The workflow step to execute
 * @param stepIndex - The sequence number of this step
 * @param ctx - Execution context with repository, executor, and config
 * @returns Step execution result
 */
export async function executeWorkflowStep(
  workflowStep: WorkflowStep,
  stepIndex: number,
  ctx: ExecuteWorkflowStepContext,
): Promise<ExecuteWorkflowStepResult> {
  const {
    repository,
    stepExecutor,
    supabase,
    broadcastRunEvent,
    runId,
    userId,
    jobId,
    walletSecretKey,
    baseWalletKey,
    outputs,
    workflowInputs,
  } = ctx;

  // Check if run was cancelled before executing this step
  const runStatus = await repository.getRunStatus(runId);

  if (runStatus === "cancelled") {
    console.log(`🛑 Run ${runId} was cancelled, stopping execution`);
    return { success: false, cancelled: true, nodeId: workflowStep.nodeId };
  }

  // Get the event record
  console.log(
    `🔍 Looking for event record: run_id=${runId}, sequence=${stepIndex}`,
  );
  const eventRecord = await repository.getEventRecordBySequence(
    runId,
    stepIndex,
  );

  if (!eventRecord) {
    // List all events for this run to debug
    const allEvents = await repository.getAllEventRecords(runId);
    console.error(`❌ Event record not found. All events for run:`, allEvents);
    throw new Error(`Event record not found for sequence ${stepIndex}`);
  }
  console.log(`✅ Found event record: ${eventRecord.id}`);

  // Mark as running
  await repository.markEventRunning(eventRecord.id);

  // Broadcast step running via WebSocket
  if (userId && broadcastRunEvent) {
    broadcastRunEvent(userId, runId, jobId, "run:step", {
      nodeId: workflowStep.nodeId,
      status: "running",
    });
  }

  // Execute the step using unified StepExecutor
  const stepResult = await stepExecutor(workflowStep, {
    supabase,
    walletSecretKey,
    baseWalletKey,
    outputs,
    workflowInputs: workflowInputs || {},
    // Pass job context for source execution
    currentJobId: jobId,
    userId,
  });

  // Update event record based on result
  if (stepResult.success) {
    await repository.markEventCompleted(eventRecord.id, {
      output: stepResult.output,
      outputText:
        typeof stepResult.output === "string"
          ? stepResult.output
          : JSON.stringify(stepResult.output),
      paymentSignature: stepResult.paymentSignature || "",
      amountPaid: stepResult.paid || 0,
      resolvedInputs: stepResult.resolvedInputs,
    });

    // Broadcast step completed via WebSocket
    if (userId && broadcastRunEvent) {
      broadcastRunEvent(userId, runId, jobId, "run:step", {
        nodeId: workflowStep.nodeId,
        status: "completed",
        output: stepResult.output,
        paid: stepResult.paid,
      });
    }
  } else {
    await repository.markEventFailed(
      eventRecord.id,
      stepResult.error || "Unknown error",
      stepResult.resolvedInputs,
    );

    // Broadcast step failed via WebSocket
    if (userId && broadcastRunEvent) {
      broadcastRunEvent(userId, runId, jobId, "run:step", {
        nodeId: workflowStep.nodeId,
        status: "failed",
        error: stepResult.error,
      });
    }
  }

  return {
    success: stepResult.success,
    nodeId: stepResult.nodeId,
    output: stepResult.output,
    error: stepResult.error,
    paid: stepResult.paid,
    paymentSignature: stepResult.paymentSignature,
    resolvedInputs: stepResult.resolvedInputs,
  };
}
