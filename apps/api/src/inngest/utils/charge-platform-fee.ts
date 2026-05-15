import { config } from "../../config";
import { executeX402Request } from "./execute-x402";

export interface ChargeFeeResult {
  success: boolean;
  transactionSignature?: string;
  error?: string;
  amountPaid?: number;
}

export interface ChargeFeeParams {
  solanaSecretKey: string;
  baseSecretKey?: string;
  network: "solana" | "base";
  /** Total resource cost in USDC (for percentage-based fee calculation) */
  resourceCost?: number;
}

/**
 * Calculate platform fee based on resource cost
 * Fee is 1.5% of resource cost, with a minimum of $0.01
 */
export function calculatePlatformFee(resourceCost: number): number {
  const percentage = config.platformFee.percentage;
  const minimum = config.platformFee.minimumUsdc;
  return Math.max(resourceCost * percentage, minimum);
}

/**
 * Charge the platform fee for a job run
 *
 * Charges on the same network as the job's resources via X402 protocol:
 * - Solana jobs: https://agents.memeputer.com/x402/solana/jobputer/job_fee
 * - Base jobs: https://agents.memeputer.com/x402/base/jobputer/job_fee
 *
 * Both use gasless X402 - the facilitator pays transaction fees.
 *
 * Fee is 1.5% of resource cost (with minimum of $0.01)
 */
export async function chargePlatformFee(
  params: ChargeFeeParams,
): Promise<ChargeFeeResult> {
  if (!config.platformFee.enabled) {
    console.log(`💰 Platform fee disabled, skipping`);
    return { success: true, amountPaid: 0 };
  }

  // Calculate fee: 1.5% of resource cost (minimum $0.01)
  const resourceCost = params.resourceCost || 0;
  const amountUsdc = calculatePlatformFee(resourceCost);
  const network = params.network;

  console.log(
    `💰 Charging platform fee: $${amountUsdc.toFixed(4)} USDC (${(config.platformFee.percentage * 100).toFixed(1)}% of $${resourceCost.toFixed(2)}) on ${network}`,
  );

  // Build the X402 endpoint URL for the appropriate network
  // Solana: https://agents.memeputer.com/x402/solana/jobputer/job_fee
  // Base: https://agents.memeputer.com/x402/base/jobputer/job_fee
  const resourceUrl =
    network === "base"
      ? config.platformFee.resourceUrl.replace("/solana/", "/base/")
      : config.platformFee.resourceUrl;

  console.log(`   Endpoint: ${resourceUrl}`);

  try {
    const result = await executeX402Request({
      resourceUrl,
      walletSecretKey: params.solanaSecretKey,
      baseWalletKey: params.baseSecretKey,
      body: {},
    });

    if (result.success) {
      console.log(
        `   ✅ Platform fee charged! Tx: ${result.paymentSignature?.substring(0, 20)}...`,
      );
      return {
        success: true,
        transactionSignature: result.paymentSignature,
        amountPaid: result.amountPaid || amountUsdc,
      };
    } else {
      console.error(`   ❌ Platform fee failed: ${result.error}`);
      return {
        success: false,
        error: result.error || "Platform fee payment failed",
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ❌ Platform fee error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
