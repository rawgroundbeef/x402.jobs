import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Input value type - can be a static value or reference to another node's output
 */
export interface InputReference {
  type: "reference";
  sourceNodeId: string;
  sourceField?: string;
}

export type InputValue = string | InputReference;

/**
 * Resource step data - represents an X402 resource to call
 */
export interface WorkflowResource {
  resourceId: string;
  resourceUrl: string;
  resourceName: string;
  resourcePrice: number;
  resourceNetwork?: string;
  resourceMethod?: "GET" | "POST"; // HTTP method, defaults to POST
  nodeId: string;
  inputs: Record<string, InputValue>;
}

/**
 * Combine field mapping - used in combine transforms
 */
export interface CombineField {
  fieldName: string;
  sourceNodeId: string;
  sourcePath?: string;
}

/**
 * Transform step data - represents a data transformation
 */
export interface WorkflowTransform {
  nodeId: string;
  transformType: "extract" | "template" | "code" | "combine";
  config: {
    path?: string;
    template?: string;
    code?: string;
    combineFields?: CombineField[];
  };
  sourceNodeId?: string; // Node whose output to transform
}

/**
 * Source step data - represents a free data input source
 */
export interface WorkflowSource {
  nodeId: string;
  sourceType: "job_history" | "url_fetch";
  config: {
    // job_history
    jobId?: string; // Job ID or "self" for current job
    limit?: number; // Max results (default: 100)
    since?: string; // "1h" | "24h" | "7d" | "30d" | "all"
    // url_fetch
    url?: string;
    headers?: Record<string, string>;
  };
}

/**
 * Unified step type - resource, transform, or source
 */
export interface WorkflowStep {
  type: "resource" | "transform" | "source";
  nodeId: string;
  dependencies?: string[]; // Node IDs that must complete before this step runs
  data: WorkflowResource | WorkflowTransform | WorkflowSource;
}

/**
 * Result from executing a single step
 */
export interface StepResult {
  success: boolean;
  nodeId: string;
  output?: unknown;
  paid?: number;
  error?: string;
  paymentSignature?: string;
  cancelled?: boolean;
  /** The resolved inputs that were actually sent in the request */
  resolvedInputs?: Record<string, unknown>;
  /** HTTP request details for debugging */
  httpRequest?: {
    method: string;
    url: string;
    body?: unknown;
  };
  /** HTTP response details for debugging */
  httpResponse?: {
    status?: number;
    body?: unknown;
  };
}

/**
 * Shared execution context passed to all executors
 */
export interface ExecutionContext {
  runId: string;
  supabase: SupabaseClient;
  walletSecretKey: string;
  baseWalletKey?: string;
  workflowInputs: Record<string, unknown>;
  outputs: Record<string, unknown>; // Shared mutable state for node outputs
}

/**
 * Event record for tracking step execution in the database
 */
export interface EventRecord {
  id: string;
  run_id: string;
  sequence: number;
  status: "pending" | "running" | "completed" | "failed";
}

/**
 * Workflow run event data sent to Inngest
 */
export interface WorkflowRunEventData {
  runId: string;
  walletSecretKey: string;
  baseWalletKey?: string;
  resources?: WorkflowResource[]; // Legacy format
  steps?: WorkflowStep[]; // Sequential format
  stepLevels?: WorkflowStep[][]; // Parallel format (grouped by level)
  workflowInputs?: Record<string, unknown>;
}
