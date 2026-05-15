import { config } from "../../config";

export interface ReleaseEscrowResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Release escrow funds to a recipient
 *
 * Calls the /escrow/release endpoint which uses Escrowputer's wallet
 * to transfer USDC to the builder.
 */
export async function releaseEscrowPayout(
  recipientAddress: string,
  amountUsdc: number,
  requestId: string,
): Promise<ReleaseEscrowResult> {
  if (!config.escrow.enabled) {
    console.log(`💸 Escrow payments disabled, skipping actual payout`);
    return { success: true };
  }

  const webhookSecret = process.env.ESCROW_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(`❌ ESCROW_WEBHOOK_SECRET not configured`);
    return { success: false, error: "Escrow webhook secret not configured" };
  }

  const releaseUrl = `${config.publicUrl}/escrow/release`;

  console.log(
    `💸 Releasing escrow: $${amountUsdc} USDC to ${recipientAddress}`,
  );
  console.log(`   Endpoint: ${releaseUrl}`);
  console.log(`   Request ID: ${requestId}`);

  try {
    const response = await fetch(releaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient_address: recipientAddress,
        amount: amountUsdc,
        request_id: requestId,
        webhook_secret: webhookSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        `   ❌ Escrow release failed: ${data.error || response.statusText}`,
      );
      return {
        success: false,
        error: data.error || "Failed to release escrow",
      };
    }

    console.log(`   ✅ Escrow released! Tx: ${data.transaction_hash}`);
    return {
      success: true,
      transactionHash: data.transaction_hash,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ❌ Escrow release error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
