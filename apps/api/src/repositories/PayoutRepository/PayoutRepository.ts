import type { SupabaseClient } from "@supabase/supabase-js";
import type { IPayoutRepository, Payout } from "./types";

/**
 * Supabase implementation of the Payout Repository
 *
 * Handles all database operations for payout processing.
 */
export class PayoutRepository implements IPayoutRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get pending payouts ordered by creation date
   */
  async getPendingPayouts(
    limit: number,
    maxAttempts: number,
  ): Promise<Payout[]> {
    const { data, error } = await this.supabase
      .from("x402_pending_payouts")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", maxAttempts)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch pending payouts: ${error.message}`);
    }

    return (data || []) as Payout[];
  }

  /**
   * Get a single payout by ID
   */
  async getPayoutById(id: string): Promise<Payout | null> {
    const { data, error } = await this.supabase
      .from("x402_pending_payouts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch payout: ${error.message}`);
    }

    return data as Payout;
  }

  /**
   * Mark payout as processing (increment attempts)
   */
  async markProcessing(id: string, attempts: number): Promise<void> {
    const { error } = await this.supabase
      .from("x402_pending_payouts")
      .update({
        status: "processing",
        attempts,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to mark payout as processing: ${error.message}`);
    }
  }

  /**
   * Mark payout as completed with transaction signature
   */
  async markCompleted(id: string, signature: string): Promise<void> {
    const { error } = await this.supabase
      .from("x402_pending_payouts")
      .update({
        status: "completed",
        transaction_signature: signature,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to mark payout as completed: ${error.message}`);
    }
  }

  /**
   * Mark payout as failed (exhausted retries)
   */
  async markFailed(id: string, error: string): Promise<void> {
    const { error: dbError } = await this.supabase
      .from("x402_pending_payouts")
      .update({
        status: "failed",
        error,
      })
      .eq("id", id);

    if (dbError) {
      throw new Error(`Failed to mark payout as failed: ${dbError.message}`);
    }
  }

  /**
   * Mark payout for retry (back to pending with error)
   */
  async markRetry(id: string, error: string): Promise<void> {
    const { error: dbError } = await this.supabase
      .from("x402_pending_payouts")
      .update({
        status: "pending",
        error,
      })
      .eq("id", id);

    if (dbError) {
      throw new Error(`Failed to mark payout for retry: ${dbError.message}`);
    }
  }
}
