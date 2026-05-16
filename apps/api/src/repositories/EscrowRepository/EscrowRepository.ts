import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IEscrowRepository,
  EscrowRunData,
  PayoutData,
  RefundData,
  DbResult,
} from "./types";

/**
 * Supabase implementation of the Escrow Repository
 *
 * Handles all database operations for escrow payouts and refunds.
 */
export class EscrowRepository implements IEscrowRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get run data needed for escrow processing
   */
  async getRunData(runId: string): Promise<EscrowRunData | null> {
    const { data } = await this.supabase
      .from("x402_job_runs")
      .select(
        "status, total_payment, creator_markup_earned, payer_address, payment_network, creator_wallet_address, creator_base_wallet_address",
      )
      .eq("id", runId)
      .single();

    if (!data) return null;

    return {
      status: data.status,
      total_payment: parseFloat(data.total_payment) || 0,
      creator_markup_earned: parseFloat(data.creator_markup_earned) || 0,
      payer_address: data.payer_address,
      payment_network: data.payment_network || "solana",
      creator_wallet_address: data.creator_wallet_address,
      creator_base_wallet_address: data.creator_base_wallet_address,
    };
  }

  /**
   * Get total amount spent on events that ran (completed or failed)
   */
  async getEventSpend(runId: string): Promise<number> {
    const { data: events } = await this.supabase
      .from("x402_job_run_events")
      .select("amount_paid, status")
      .eq("run_id", runId);

    if (!events) return 0;

    return events
      .filter((e) => e.status === "completed" || e.status === "failed")
      .reduce((sum, e) => sum + (parseFloat(e.amount_paid) || 0), 0);
  }

  /**
   * Create a payout record for the creator
   */
  async createPayout(data: PayoutData): Promise<DbResult> {
    const { error } = await this.supabase.from("x402_pending_payouts").insert({
      run_id: data.runId,
      job_id: data.jobId,
      type: "creator_payout",
      recipient_address: data.recipientAddress,
      creator_id: data.creatorId,
      amount: data.amount,
      network: data.network,
      status: "pending",
    });

    if (error) {
      return { error: error.message };
    }
    return {};
  }

  /**
   * Create a refund record for the payer
   */
  async createRefund(data: RefundData): Promise<DbResult> {
    const { error } = await this.supabase.from("x402_pending_payouts").insert({
      run_id: data.runId,
      job_id: data.jobId,
      type: "payer_refund",
      recipient_address: data.recipientAddress,
      creator_id: data.creatorId,
      amount: data.amount,
      network: data.network,
      status: "pending",
      refund_breakdown: data.refundBreakdown,
    });

    if (error) {
      return { error: error.message };
    }
    return {};
  }
}
