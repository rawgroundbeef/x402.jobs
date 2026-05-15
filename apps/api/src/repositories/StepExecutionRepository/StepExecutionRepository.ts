import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IStepExecutionRepository,
  EventRecord,
  EventCompletedData,
} from "./types";

/**
 * Supabase implementation of the Step Execution Repository
 *
 * Handles all database operations for workflow step execution.
 */
export class StepExecutionRepository implements IStepExecutionRepository {
  constructor(private supabase: SupabaseClient) {}

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
   * Get event record by run_id and sequence number
   */
  async getEventRecordBySequence(
    runId: string,
    sequence: number,
  ): Promise<EventRecord | null> {
    const { data } = await this.supabase
      .from("x402_job_run_events")
      .select("id")
      .eq("run_id", runId)
      .eq("sequence", sequence)
      .single();

    if (!data) return null;

    return { id: data.id };
  }

  /**
   * Get all event records for a run (for debugging)
   */
  async getAllEventRecords(runId: string): Promise<EventRecord[]> {
    const { data } = await this.supabase
      .from("x402_job_run_events")
      .select("id, sequence, status")
      .eq("run_id", runId);

    return (data || []).map((e) => ({
      id: e.id,
      sequence: e.sequence,
      status: e.status,
    }));
  }

  /**
   * Mark event as running
   */
  async markEventRunning(eventId: string): Promise<void> {
    await this.supabase
      .from("x402_job_run_events")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", eventId);
  }

  /**
   * Mark event as completed with output data
   */
  async markEventCompleted(
    eventId: string,
    data: EventCompletedData,
  ): Promise<void> {
    // Update the event status
    await this.supabase
      .from("x402_job_run_events")
      .update({
        status: "completed",
        output: data.output,
        output_text: data.outputText,
        payment_signature: data.paymentSignature,
        amount_paid: data.amountPaid,
        completed_at: new Date().toISOString(),
        resolved_inputs: data.resolvedInputs || null,
      } as Record<string, unknown>)
      .eq("id", eventId);

    // Real-time update: increment resource success count
    // Fetch the event to get resource_id
    const { data: event } = await this.supabase
      .from("x402_job_run_events")
      .select("resource_id")
      .eq("id", eventId)
      .single();

    if (event?.resource_id) {
      // Real-time increment of success_count_30d via RPC
      // This provides immediate feedback; hourly cron is the backup
      try {
        const { error: rpcError } = await this.supabase.rpc(
          "increment_resource_success_count",
          { p_resource_id: event.resource_id },
        );
        if (rpcError) {
          console.warn(
            `[StepExecution] RPC increment_resource_success_count failed for ${event.resource_id}:`,
            rpcError.message,
          );
        }
      } catch (err) {
        // Don't fail the main operation if stats update fails
        console.warn(
          `[StepExecution] Failed to update success stats for resource ${event.resource_id}:`,
          err,
        );
      }
    }
  }

  /**
   * Mark event as failed with error message
   */
  async markEventFailed(
    eventId: string,
    error: string,
    resolvedInputs?: unknown,
  ): Promise<void> {
    // Update the event status
    await this.supabase
      .from("x402_job_run_events")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
        resolved_inputs: resolvedInputs || null,
      } as Record<string, unknown>)
      .eq("id", eventId);

    // Real-time update: increment resource failure count
    // Fetch the event to get resource_id
    const { data: event } = await this.supabase
      .from("x402_job_run_events")
      .select("resource_id")
      .eq("id", eventId)
      .single();

    if (event?.resource_id) {
      // Real-time increment of failure_count_30d via RPC
      // This provides immediate feedback; hourly cron is the backup
      try {
        const { error: rpcError } = await this.supabase.rpc(
          "increment_resource_failure_count",
          { p_resource_id: event.resource_id },
        );
        if (rpcError) {
          console.warn(
            `[StepExecution] RPC increment_resource_failure_count failed for ${event.resource_id}:`,
            rpcError.message,
          );
        }
      } catch (err) {
        // Don't fail the main operation if stats update fails
        console.warn(
          `[StepExecution] Failed to update failure stats for resource ${event.resource_id}:`,
          err,
        );
      }
    }
  }
}
