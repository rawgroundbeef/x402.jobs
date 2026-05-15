import type {
  IPayoutRepository,
  Payout,
  TransferResult,
  PayoutResult,
  BatchResult,
} from "../../../repositories/PayoutRepository";

/**
 * Maximum retry attempts before marking as failed
 */
export const MAX_ATTEMPTS = 3;

/**
 * Default batch size for processing payouts
 */
export const DEFAULT_BATCH_SIZE = 10;

/**
 * Transfer function type
 */
export type TransferFn = (
  address: string,
  amount: number,
) => Promise<TransferResult>;

/**
 * Logger interface for payout processing
 */
export interface PayoutLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Context for payout processing
 */
export interface ProcessPayoutContext {
  repository: IPayoutRepository;
  transferSolana: TransferFn;
  transferBase: TransferFn;
  solanaEnabled: boolean;
  baseEnabled: boolean;
  logger?: PayoutLogger;
}

/**
 * Process a single payout.
 *
 * @param payout - The payout record to process
 * @param ctx - Processing context with repository and transfer functions
 * @returns Result of the payout attempt
 */
export async function processSinglePayout(
  payout: Payout,
  ctx: ProcessPayoutContext,
): Promise<PayoutResult> {
  const {
    repository,
    transferSolana,
    transferBase,
    solanaEnabled,
    baseEnabled,
    logger,
  } = ctx;
  const payoutType = payout.type === "creator_payout" ? "payout" : "refund";
  const logPrefix = `[${payoutType}:${payout.id.substring(0, 8)}]`;

  logger?.info(
    `${logPrefix} Processing $${payout.amount} to ${payout.recipient_address} on ${payout.network}`,
  );

  // Check if network is supported
  if (payout.network === "solana" && !solanaEnabled) {
    logger?.warn(`${logPrefix} Solana transfers not enabled - skipping`);
    return { success: false, skipped: true };
  }

  if (payout.network === "base" && !baseEnabled) {
    logger?.warn(`${logPrefix} Base transfers not enabled - skipping`);
    return { success: false, skipped: true };
  }

  // Mark as processing
  const newAttempts = payout.attempts + 1;
  await repository.markProcessing(payout.id, newAttempts);

  try {
    let transferResult: TransferResult;

    if (payout.network === "solana") {
      transferResult = await transferSolana(
        payout.recipient_address,
        payout.amount,
      );
    } else if (payout.network === "base") {
      const baseResult = await transferBase(
        payout.recipient_address,
        payout.amount,
      );
      // Normalize result format
      transferResult = {
        success: baseResult.success,
        signature: baseResult.transactionHash || baseResult.signature,
        error: baseResult.error,
      };
    } else {
      throw new Error(`Unsupported network: ${payout.network}`);
    }

    if (transferResult.success) {
      const signature =
        transferResult.signature || transferResult.transactionHash || "";
      await repository.markCompleted(payout.id, signature);
      logger?.info(`${logPrefix} ✅ Success! Signature: ${signature}`);
      return { success: true, signature };
    } else {
      // Check if we've exhausted retries
      if (newAttempts >= MAX_ATTEMPTS) {
        await repository.markFailed(
          payout.id,
          transferResult.error || "Unknown error",
        );
        logger?.error(
          `${logPrefix} ❌ Failed after ${MAX_ATTEMPTS} attempts: ${transferResult.error}`,
        );
        return { success: false, error: transferResult.error };
      } else {
        await repository.markRetry(
          payout.id,
          transferResult.error || "Unknown error",
        );
        logger?.warn(
          `${logPrefix} ⚠️ Attempt ${newAttempts} failed, will retry: ${transferResult.error}`,
        );
        return { success: false, error: transferResult.error, willRetry: true };
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if we've exhausted retries
    if (newAttempts >= MAX_ATTEMPTS) {
      await repository.markFailed(payout.id, errorMessage);
      logger?.error(`${logPrefix} ❌ Failed with error: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } else {
      await repository.markRetry(payout.id, errorMessage);
      logger?.warn(
        `${logPrefix} ⚠️ Error on attempt ${newAttempts}, will retry: ${errorMessage}`,
      );
      return { success: false, error: errorMessage, willRetry: true };
    }
  }
}

/**
 * Process all pending payouts in a batch.
 *
 * @param ctx - Processing context
 * @param limit - Maximum payouts to process
 * @returns Batch processing results
 */
export async function processPendingPayouts(
  ctx: ProcessPayoutContext,
  limit: number = DEFAULT_BATCH_SIZE,
): Promise<BatchResult> {
  const { repository, solanaEnabled, baseEnabled, logger } = ctx;

  // Check if transfer is enabled for either network
  if (!solanaEnabled && !baseEnabled) {
    logger?.warn("No platform wallet configured - skipping payout processing");
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  // Fetch pending payouts
  let pendingPayouts: Payout[];
  try {
    pendingPayouts = await repository.getPendingPayouts(limit, MAX_ATTEMPTS);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger?.error(`Failed to fetch pending payouts: ${errorMessage}`);
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      error: errorMessage,
    };
  }

  if (pendingPayouts.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  logger?.info(`Processing ${pendingPayouts.length} pending payouts`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const payout of pendingPayouts) {
    const result = await processSinglePayout(payout, ctx);

    if (result.skipped) {
      skipped++;
    } else if (result.success) {
      succeeded++;
    } else if (!result.willRetry) {
      // Only count as failed if not retrying
      failed++;
    }
  }

  return {
    processed: pendingPayouts.length,
    succeeded,
    failed,
    skipped,
  };
}

/**
 * Process a single payout by ID (for manual triggers).
 *
 * @param payoutId - ID of the payout to process
 * @param ctx - Processing context
 * @returns Result of the payout attempt
 */
export async function processSinglePayoutById(
  payoutId: string,
  ctx: ProcessPayoutContext,
): Promise<PayoutResult & { message?: string }> {
  const { repository, logger } = ctx;

  // Fetch the payout
  const payout = await repository.getPayoutById(payoutId);

  if (!payout) {
    return { success: false, error: "Payout not found" };
  }

  if (payout.status === "completed") {
    return { success: true, message: "Payout already completed" };
  }

  logger?.info(
    `Manually triggering payout ${payoutId}: $${payout.amount} to ${payout.recipient_address}`,
  );

  return processSinglePayout(payout, ctx);
}
