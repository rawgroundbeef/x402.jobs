/**
 * Run data needed for escrow processing
 */
export interface EscrowRunData {
  status: string;
  total_payment: number;
  creator_markup_earned: number;
  payer_address: string | null;
  payment_network: string;
  creator_wallet_address: string | null;
  creator_base_wallet_address: string | null;
}

/**
 * Event spend data from job run events
 */
export interface EventSpendData {
  amount_paid: number;
  status: string;
}

/**
 * Data for creating a payout record
 */
export interface PayoutData {
  runId: string;
  jobId: string;
  recipientAddress: string;
  creatorId: string;
  amount: number;
  network: string;
}

/**
 * Breakdown of refund calculation
 */
export interface RefundBreakdown {
  creator_markup: number;
  unused_resources: number;
}

/**
 * Data for creating a refund record
 */
export interface RefundData {
  runId: string;
  jobId: string;
  recipientAddress: string;
  creatorId: string;
  amount: number;
  network: string;
  refundBreakdown: RefundBreakdown | null;
}

/**
 * Result of a database operation
 */
export interface DbResult {
  error?: string;
}

/**
 * Escrow Repository Interface
 *
 * Handles all database operations for escrow payouts and refunds.
 * This interface allows for easy mocking in tests.
 */
export interface IEscrowRepository {
  /**
   * Get run data needed for escrow processing
   */
  getRunData(runId: string): Promise<EscrowRunData | null>;

  /**
   * Get total amount spent on events that ran (completed or failed)
   */
  getEventSpend(runId: string): Promise<number>;

  /**
   * Create a payout record for the creator
   */
  createPayout(data: PayoutData): Promise<DbResult>;

  /**
   * Create a refund record for the payer
   */
  createRefund(data: RefundData): Promise<DbResult>;
}
