/**
 * Payout record from database
 */
export interface Payout {
  id: string;
  run_id: string | null;
  job_id: string | null;
  type: "creator_payout" | "payer_refund";
  recipient_address: string;
  creator_id: string | null;
  amount: number;
  network: "solana" | "base";
  status: "pending" | "processing" | "completed" | "failed";
  transaction_signature: string | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
  attempts: number;
  last_attempt_at: string | null;
  refund_breakdown: Record<string, unknown> | null;
}

/**
 * Result of a transfer operation
 */
export interface TransferResult {
  success: boolean;
  signature?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Result of processing a single payout
 */
export interface PayoutResult {
  success: boolean;
  skipped?: boolean;
  signature?: string;
  error?: string;
  willRetry?: boolean;
}

/**
 * Result of processing a batch of payouts
 */
export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  error?: string;
}

/**
 * Payout Repository Interface
 *
 * Handles all database operations for payout processing.
 */
export interface IPayoutRepository {
  /**
   * Get pending payouts ordered by creation date
   */
  getPendingPayouts(limit: number, maxAttempts: number): Promise<Payout[]>;

  /**
   * Get a single payout by ID
   */
  getPayoutById(id: string): Promise<Payout | null>;

  /**
   * Mark payout as processing (increment attempts)
   */
  markProcessing(id: string, attempts: number): Promise<void>;

  /**
   * Mark payout as completed with transaction signature
   */
  markCompleted(id: string, signature: string): Promise<void>;

  /**
   * Mark payout as failed (exhausted retries)
   */
  markFailed(id: string, error: string): Promise<void>;

  /**
   * Mark payout for retry (back to pending with error)
   */
  markRetry(id: string, error: string): Promise<void>;
}
