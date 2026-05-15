import type { IEscrowRepository } from "../../../repositories/EscrowRepository";
import type {
  CreateEscrowRecordContext,
  EscrowResult,
  RefundBreakdown,
} from "./types";

/**
 * Calculate smart refund amount based on actual resource spend
 *
 * Formula:
 * - actualSpent = sum of amount_paid for events that ran (completed or failed)
 * - unusedResourceCost = totalPayment - actualSpent - platformFee - creatorMarkup
 * - refundAmount = creatorMarkup + unusedResourceCost
 * - Safety cap: never refund more than totalPayment - platformFee
 */
export async function calculateSmartRefund(
  repository: IEscrowRepository,
  runId: string,
  totalPayment: number,
  creatorMarkup: number,
  platformFee: number = 0.05,
): Promise<{ refundAmount: number; breakdown: RefundBreakdown }> {
  // Calculate actual spend from events that ran (completed or failed)
  const actualSpent = await repository.getEventSpend(runId);

  // unused = total paid - actual spent - platform fee - creator markup
  // Note: We only refund unused resources, not resources that ran and failed
  const unusedResourceCost = Math.max(
    0,
    totalPayment - actualSpent - platformFee - creatorMarkup,
  );

  // Smart refund = creator markup + unused resource costs
  let refundAmount = creatorMarkup + unusedResourceCost;

  // Safety cap: never refund more than total payment minus platform fee
  const maxRefund = Math.max(0, totalPayment - platformFee);
  refundAmount = Math.min(refundAmount, maxRefund);

  const breakdown: RefundBreakdown = {
    creator_markup: creatorMarkup,
    unused_resources: unusedResourceCost,
  };

  console.log(`📊 Smart refund calculation:`);
  console.log(`   Total payment: $${totalPayment.toFixed(2)}`);
  console.log(`   Actual spent on resources: $${actualSpent.toFixed(2)}`);
  console.log(`   Platform fee (kept): $${platformFee.toFixed(2)}`);
  console.log(`   Creator markup: $${creatorMarkup.toFixed(2)}`);
  console.log(`   Unused resources: $${unusedResourceCost.toFixed(2)}`);
  console.log(`   Total refund: $${refundAmount.toFixed(2)}`);

  return { refundAmount, breakdown };
}

/**
 * Create a creator payout record for successful runs
 */
export async function createCreatorPayout(
  repository: IEscrowRepository,
  runId: string,
  jobId: string,
  userId: string,
  creatorWallet: string,
  amount: number,
  network: string,
): Promise<EscrowResult> {
  const result = await repository.createPayout({
    runId,
    jobId,
    recipientAddress: creatorWallet,
    creatorId: userId,
    amount,
    network,
  });

  if (result.error) {
    console.error(`❌ Failed to create payout record:`, result.error);
    return {
      type: "payout",
      success: false,
      error: result.error,
    };
  }

  console.log(`📤 Created escrow payout: $${amount} to ${creatorWallet}`);
  return {
    type: "payout",
    success: true,
    amount,
    recipient: creatorWallet,
  };
}

/**
 * Create a payer refund record for failed runs
 */
export async function createPayerRefund(
  repository: IEscrowRepository,
  runId: string,
  jobId: string,
  userId: string,
  payerAddress: string,
  amount: number,
  network: string,
  refundBreakdown: RefundBreakdown | null,
): Promise<EscrowResult> {
  const result = await repository.createRefund({
    runId,
    jobId,
    recipientAddress: payerAddress,
    creatorId: userId,
    amount,
    network,
    refundBreakdown,
  });

  if (result.error) {
    console.error(`❌ Failed to create refund record:`, result.error);
    return {
      type: "refund",
      success: false,
      error: result.error,
    };
  }

  console.log(
    `📤 Created escrow refund: $${amount.toFixed(2)} to ${payerAddress}`,
  );
  return {
    type: "refund",
    success: true,
    amount,
    recipient: payerAddress,
    refundBreakdown: refundBreakdown || undefined,
  };
}

/**
 * Create escrow payout/refund record for x402 runs
 *
 * On success: Creates a creator_payout record to pay the job creator their markup
 * On failure: Creates a payer_refund record to refund the caller
 *   - If smart refunds enabled: refunds creator markup + unused resource costs
 *   - If smart refunds disabled: refunds only creator markup
 */
export async function createEscrowRecord(
  ctx: CreateEscrowRecordContext,
): Promise<EscrowResult> {
  const { repository, runId, jobId, userId } = ctx;

  // Get the run details to check if this was an x402 payment
  const runData = await repository.getRunData(runId);

  if (!runData) {
    console.log(`⏭️ No run data found for escrow record`);
    return { type: "skipped", success: true };
  }

  const creatorMarkup = runData.creator_markup_earned || 0;
  const totalPayment = runData.total_payment || 0;

  // Only process x402 runs with markup
  if (creatorMarkup <= 0 || !runData.payer_address) {
    console.log(`⏭️ Not an x402 run or no markup - skipping escrow record`);
    return { type: "skipped", success: true };
  }

  const network = runData.payment_network || "solana";

  if (runData.status === "success") {
    // Job succeeded - pay creator their markup
    const creatorWallet =
      network === "base"
        ? runData.creator_base_wallet_address
        : runData.creator_wallet_address;

    if (!creatorWallet) {
      console.error(`❌ No creator wallet found for payout`);
      return {
        type: "payout",
        success: false,
        error: "No creator wallet found",
      };
    }

    return createCreatorPayout(
      repository,
      runId,
      jobId,
      userId,
      creatorWallet,
      creatorMarkup,
      network,
    );
  } else if (runData.status === "failed") {
    // Job failed - skip automatic refund, use manual refund system instead
    // Users can request refunds via /account/history which go through admin approval
    console.log(
      `⏭️ Job failed - skipping automatic refund (manual refund system enabled)`,
    );
    console.log(
      `   User can request refund via History page (total_payment: $${totalPayment.toFixed(2)}, creator_markup: $${creatorMarkup.toFixed(2)})`,
    );
    return { type: "skipped", success: true };
  }

  // Run is in some other state (pending, running, etc.)
  return { type: "skipped", success: true };
}
