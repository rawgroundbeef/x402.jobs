import { config } from "../../config";
import { executeX402Request } from "./execute-x402";

export interface ChargeEscrowResult {
  success: boolean;
  transactionSignature?: string;
  error?: string;
  amountPaid?: number;
}

/**
 * Charge escrow deposit for a hiring request
 *
 * Uses Escrowputer's escrow_deposit command endpoint via X402 protocol.
 * Escrow funds are kept separate from platform fee revenue (held by Escrowputer vs Jobputer).
 * 
 * This follows the standard X402 flow:
 * 1. POST to endpoint with {request_id, amount} → returns 402 with payment requirements
 * 2. Create X-PAYMENT header with signed transaction
 * 3. POST with X-PAYMENT → verifies, settles, returns 200
 *
 * Supports both Solana and Base networks - the server's 402 response determines which is used.
 */
export async function chargeEscrowDeposit(
  userSecretKey: string,
  requestId: string,
  amountUsdc: number,
  baseWalletKey?: string,
): Promise<ChargeEscrowResult> {
  if (!config.escrow.enabled) {
    console.log(`💰 Escrow payments disabled, skipping actual payment`);
    return { success: true, amountPaid: 0 };
  }

  const resourceUrl = config.escrow.depositUrl;

  console.log(`💰 Charging escrow deposit: $${amountUsdc} USDC`);
  console.log(`   Endpoint: ${resourceUrl}`);
  console.log(`   Request ID: ${requestId}`);

  try {
    // Use executeX402Request to handle the full X402 flow via Jobputer
    // The body includes request_id and amount - Jobputer will return 402 with this amount
    const result = await executeX402Request({
      resourceUrl,
      walletSecretKey: userSecretKey,
      baseWalletKey,
      body: {
        request_id: requestId,
        amount: amountUsdc,
      },
    });

    if (result.success) {
      // Verify that a payment was actually made (not just a 200 response without payment)
      if (!result.paymentSignature) {
        console.error(
          `   ❌ No payment was made - escrow_deposit command may not require payment`,
        );
        return {
          success: false,
          error:
            "Escrow deposit command is not configured to require payment. Please check Escrowputer command settings.",
        };
      }
      console.log(
        `   ✅ Escrow deposit charged! Tx: ${result.paymentSignature.substring(0, 20)}...`,
      );
      return {
        success: true,
        transactionSignature: result.paymentSignature,
        amountPaid: result.amountPaid || amountUsdc,
      };
    } else {
      console.error(`   ❌ Escrow deposit failed: ${result.error}`);
      return {
        success: false,
        error: result.error || "Escrow deposit payment failed",
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ❌ Escrow deposit error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
