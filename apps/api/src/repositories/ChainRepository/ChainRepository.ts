import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IChainRepository,
  JobChainConfig,
  ChainedJobDetails,
  UserWallet,
  CreateChainedRunData,
  CreateChainedRunResult,
  WorkflowDefinition,
} from "./types";
import { loadDecryptedUserWallet } from "../../lib/wallet-keys";

/**
 * Supabase implementation of the Chain Repository
 *
 * Handles all database operations for job chaining.
 */
export class ChainRepository implements IChainRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get job chain configuration
   */
  async getJobChainConfig(jobId: string): Promise<JobChainConfig | null> {
    const { data } = await this.supabase
      .from("x402_jobs")
      .select("on_success_job_id, name")
      .eq("id", jobId)
      .single();

    if (!data) return null;

    return {
      on_success_job_id: data.on_success_job_id,
      name: data.name || "Unknown job",
    };
  }

  /**
   * Get run status
   */
  async getRunStatus(runId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("x402_job_runs")
      .select("status")
      .eq("id", runId)
      .single();

    return data?.status || null;
  }

  /**
   * Get chained job details
   */
  async getChainedJobDetails(jobId: string): Promise<ChainedJobDetails | null> {
    const { data, error } = await this.supabase
      .from("x402_jobs")
      .select(
        "id, name, user_id, workflow_definition, is_active, trigger_methods, published",
      )
      .eq("id", jobId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name || "Unknown job",
      user_id: data.user_id,
      workflow_definition:
        data.workflow_definition as WorkflowDefinition | null,
      is_active: data.is_active,
      trigger_methods: data.trigger_methods,
      published: data.published,
    };
  }

  /**
   * Get user wallet — decrypted via wallet-keys helper, ready to sign.
   */
  async getUserWallet(userId: string): Promise<UserWallet | null> {
    const w = await loadDecryptedUserWallet(userId);
    if (!w) return null;
    return {
      address: w.address,
      solanaSecretBase64: w.solanaSecretBase64,
      baseAddress: w.baseAddress,
      baseSecretBase64: w.baseSecretBase64,
    };
  }

  /**
   * Create a chained run record
   */
  async createChainedRun(
    data: CreateChainedRunData,
  ): Promise<CreateChainedRunResult | null> {
    const { data: chainedRun, error } = await this.supabase
      .from("x402_job_runs")
      .insert({
        job_id: data.jobId,
        user_id: data.userId,
        status: "pending",
        triggered_by: "chain",
        input: {
          _chainedFrom: data.parentJobId,
          _parentRunId: data.parentRunId,
        },
      })
      .select("id")
      .single();

    if (error || !chainedRun) return null;

    return { id: chainedRun.id };
  }
}
