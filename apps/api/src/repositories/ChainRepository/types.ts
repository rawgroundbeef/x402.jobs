/**
 * Job chain configuration
 */
export interface JobChainConfig {
  on_success_job_id: string | null;
  name: string;
}

/**
 * Workflow definition node
 */
export interface WorkflowNode {
  id: string;
  type: string;
  data?: {
    resource?: {
      id: string;
      resourceUrl: string;
      name?: string;
      displayName?: string;
      price?: number;
      network?: string;
      outputSchema?: { input?: { method?: string } };
    };
    configuredInputs?: Record<string, unknown>;
    transformType?: string;
    config?: Record<string, unknown>;
  };
}

/**
 * Workflow definition edge
 */
export interface WorkflowEdge {
  source: string;
  target: string;
}

/**
 * Workflow definition structure
 */
export interface WorkflowDefinition {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

/**
 * Chained job details
 */
export interface ChainedJobDetails {
  id: string;
  name: string;
  user_id: string;
  workflow_definition: WorkflowDefinition | null;
  is_active: boolean;
  trigger_methods: string[] | null;
  published: boolean;
}

/**
 * User wallet info — values are decrypted by the repository layer, ready
 * to be passed to signing code. The `*SecretBase64` fields hold base64 of
 * the raw key material (Solana: raw 64-byte secret; Base: 0x-prefixed hex
 * string). This shape is what downstream payment-signing code expects.
 */
export interface UserWallet {
  address: string;
  solanaSecretBase64: string;
  baseAddress: string | null;
  baseSecretBase64: string | null;
}

/**
 * Data for creating a chained run
 */
export interface CreateChainedRunData {
  jobId: string;
  userId: string;
  parentJobId: string;
  parentRunId: string;
}

/**
 * Result of creating a chained run
 */
export interface CreateChainedRunResult {
  id: string;
}

/**
 * Chain Repository Interface
 *
 * Handles all database operations for job chaining.
 */
export interface IChainRepository {
  /**
   * Get job chain configuration
   */
  getJobChainConfig(jobId: string): Promise<JobChainConfig | null>;

  /**
   * Get run status
   */
  getRunStatus(runId: string): Promise<string | null>;

  /**
   * Get chained job details
   */
  getChainedJobDetails(jobId: string): Promise<ChainedJobDetails | null>;

  /**
   * Get user wallet
   */
  getUserWallet(userId: string): Promise<UserWallet | null>;

  /**
   * Create a chained run record
   */
  createChainedRun(
    data: CreateChainedRunData,
  ): Promise<CreateChainedRunResult | null>;
}
