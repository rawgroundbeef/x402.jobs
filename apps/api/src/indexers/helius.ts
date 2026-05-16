/**
 * Helius Solana Indexer
 *
 * Uses Helius webhooks and APIs to index on-chain x402 transactions
 * (USDC transfers to known server addresses).
 */

import { getSupabase } from "../lib/supabase";

// Solana USDC token mint
export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// USDC decimals
export const USDC_DECIMALS = 6;

// Helius enhanced transaction types
interface HeliusEnhancedTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  type: string;
  fee: number;
  feePayer: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
  }>;
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: Array<{
      userAccount: string;
      tokenAccount: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      mint: string;
    }>;
  }>;
}

interface HeliusWebhookPayload {
  webhookId?: string;
  webhookURL?: string;
  type?: string;
  data?: HeliusEnhancedTransaction[];
  // Sometimes payload is directly an array of transactions
  [index: number]: HeliusEnhancedTransaction;
}

/**
 * Parse a USDC transfer from Helius enhanced transaction data
 */
export function parseUsdcTransfer(tx: HeliusEnhancedTransaction): {
  from: string;
  to: string;
  amount: number;
  amountRaw: string;
} | null {
  // Look for USDC token transfers
  const usdcTransfer = tx.tokenTransfers?.find(
    (t) => t.mint === SOLANA_USDC_MINT,
  );

  if (usdcTransfer) {
    // Helius tokenAmount is already in human-readable format (e.g., 0.1 = $0.10)
    // NOT in raw/base units, so don't divide by decimals
    const amount = usdcTransfer.tokenAmount;
    // Store raw amount as base units for consistency (multiply back)
    const amountRaw = String(Math.round(amount * Math.pow(10, USDC_DECIMALS)));

    return {
      from: usdcTransfer.fromUserAccount,
      to: usdcTransfer.toUserAccount,
      amount,
      amountRaw,
    };
  }

  // Also check account data for token balance changes
  for (const account of tx.accountData || []) {
    const usdcChange = account.tokenBalanceChanges?.find(
      (c) => c.mint === SOLANA_USDC_MINT,
    );
    if (usdcChange) {
      const rawAmount = usdcChange.rawTokenAmount.tokenAmount;
      const amount =
        parseInt(rawAmount) / Math.pow(10, usdcChange.rawTokenAmount.decimals);

      // Positive change means receiving
      if (parseInt(rawAmount) > 0) {
        return {
          from: tx.feePayer, // Best guess - the fee payer is often the sender
          to: usdcChange.userAccount,
          amount,
          amountRaw: rawAmount,
        };
      }
    }
  }

  return null;
}

/**
 * Process a Helius webhook payload
 */
export async function processHeliusWebhook(
  payload: HeliusWebhookPayload | HeliusEnhancedTransaction[],
): Promise<{
  processed: number;
  matched: number;
  errors: number;
}> {
  const supabase = getSupabase();
  const stats = { processed: 0, matched: 0, errors: 0 };

  // Normalize payload to array of transactions
  let transactions: HeliusEnhancedTransaction[];
  if (Array.isArray(payload)) {
    transactions = payload;
  } else if (payload.data && Array.isArray(payload.data)) {
    transactions = payload.data;
  } else {
    // Payload might be an array-like object
    transactions = Object.values(payload).filter(
      (v): v is HeliusEnhancedTransaction =>
        typeof v === "object" && v !== null && "signature" in v,
    );
  }

  // Build map of pay_to addresses to server/resource IDs
  const { data: resources } = await supabase
    .from("x402_resources")
    .select("id, pay_to, server_id, facilitator_id")
    .eq("is_active", true)
    .eq("network", "solana");

  const addressToResource = new Map<
    string,
    { serverId: string; resourceId: string; facilitatorId: string | null }
  >();
  for (const resource of resources || []) {
    if (resource.pay_to && resource.server_id) {
      addressToResource.set(resource.pay_to, {
        serverId: resource.server_id,
        resourceId: resource.id,
        facilitatorId: resource.facilitator_id,
      });
    }
  }

  // Build map of facilitator feePayer addresses (from separate table)
  // The feePayer is the facilitator's address that sponsors transactions
  const { data: facilitatorAddresses } = await supabase
    .from("x402_facilitator_addresses")
    .select("facilitator_id, address")
    .eq("is_active", true)
    .eq("network", "solana");

  const feePayerToFacilitator = new Map<string, string>();
  for (const fa of facilitatorAddresses || []) {
    if (fa.address && fa.facilitator_id) {
      feePayerToFacilitator.set(fa.address, fa.facilitator_id);
    }
  }

  // Process each transaction
  for (const tx of transactions) {
    stats.processed++;

    try {
      const transfer = parseUsdcTransfer(tx);
      if (!transfer) continue;

      // Look up resource/server by pay_to address (receiver)
      const resourceInfo = addressToResource.get(transfer.to);

      // Look up facilitator by feePayer address (the facilitator sponsors the tx)
      // tx.feePayer is the address that paid the transaction fees
      const facilitatorId =
        resourceInfo?.facilitatorId ||
        feePayerToFacilitator.get(tx.feePayer) ||
        null;

      // Record the transaction
      const { error } = await supabase.from("x402_transactions").upsert(
        {
          signature: tx.signature,
          server_id: resourceInfo?.serverId || null,
          resource_id: resourceInfo?.resourceId || null,
          facilitator_id: facilitatorId,
          sender_address: transfer.from,
          receiver_address: transfer.to,
          amount_raw: transfer.amountRaw,
          amount_usdc: transfer.amount,
          asset: SOLANA_USDC_MINT,
          network: "solana",
          block_time: new Date(tx.timestamp * 1000).toISOString(),
          slot: tx.slot,
          status: "confirmed",
          raw_data: tx,
        },
        { onConflict: "signature" },
      );

      if (error) {
        console.error(`[Helius] Failed to record tx ${tx.signature}:`, error);
        stats.errors++;
        continue;
      }

      if (resourceInfo?.serverId) {
        stats.matched++;

        // Update server stats
        await supabase.rpc("increment_server_transaction_count", {
          server_id_param: resourceInfo.serverId,
          amount_param: transfer.amount,
        });
      }
    } catch (error) {
      console.error(`[Helius] Error processing tx:`, error);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Platform wallet for collecting fees
 */
const PLATFORM_WALLET = "6Yw8BnPU6sadbsZtB6LykxTVfhj8qmEVL2cyjdh5ChKh";

/**
 * Get all addresses to poll for transactions:
 * - Resource pay_to addresses (incoming payments to resources)
 * - Job owner wallet addresses (incoming payments/payouts to job creators)
 * - Platform wallet (incoming platform fees)
 */
export async function getServerAddresses(): Promise<string[]> {
  const supabase = getSupabase();

  const addresses = new Set<string>();

  // Add platform wallet
  addresses.add(PLATFORM_WALLET);

  // Get resource pay_to addresses
  const { data: resources } = await supabase
    .from("x402_resources")
    .select("pay_to")
    .eq("is_active", true)
    .eq("network", "solana")
    .not("pay_to", "is", null);

  for (const r of resources || []) {
    if (r.pay_to) {
      addresses.add(r.pay_to);
    }
  }

  // Get job owner wallet addresses (for webhook jobs on Solana)
  const { data: jobOwnerWallets } = await supabase
    .from("x402_jobs")
    .select("owner:x402_user_wallets!x402_jobs_owner_id_fkey(address)")
    .eq("is_active", true)
    .eq("network", "solana")
    .eq("trigger_type", "webhook");

  for (const job of jobOwnerWallets || []) {
    // Supabase joins can return array or single object
    const ownerData = job.owner;
    const wallet = Array.isArray(ownerData) ? ownerData[0] : ownerData;
    if (wallet?.address) {
      addresses.add(wallet.address);
    }
  }

  return Array.from(addresses);
}

/**
 * Helius SDK wrapper for webhook management
 * Requires helius-sdk package to be installed
 */
export class HeliusClient {
  private apiKey: string;
  private baseUrl = "https://api.helius.xyz";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a webhook for monitoring addresses
   */
  async createWebhook(params: {
    accountAddresses: string[];
    webhookURL: string;
    transactionTypes?: string[];
    webhookType?: "enhanced" | "raw";
  }): Promise<{ webhookId: string } | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v0/webhooks?api-key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookURL: params.webhookURL,
            transactionTypes: params.transactionTypes || ["TRANSFER"],
            accountAddresses: params.accountAddresses,
            webhookType: params.webhookType || "enhanced",
          }),
        },
      );

      if (!response.ok) {
        console.error(`[Helius] Create webhook failed:`, await response.text());
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`[Helius] Create webhook error:`, error);
      return null;
    }
  }

  /**
   * List all webhooks
   */
  async listWebhooks(): Promise<
    Array<{
      webhookId: string;
      webhookURL: string;
      accountAddresses: string[];
    }>
  > {
    try {
      const response = await fetch(
        `${this.baseUrl}/v0/webhooks?api-key=${this.apiKey}`,
      );

      if (!response.ok) return [];

      return await response.json();
    } catch {
      return [];
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v0/webhooks/${webhookId}?api-key=${this.apiKey}`,
        { method: "DELETE" },
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update webhook addresses
   */
  async updateWebhookAddresses(
    webhookId: string,
    addresses: string[],
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v0/webhooks/${webhookId}?api-key=${this.apiKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountAddresses: addresses }),
        },
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get historical transactions for an address
   */
  async getTransactionHistory(
    address: string,
    options?: { before?: string; limit?: number },
  ): Promise<HeliusEnhancedTransaction[]> {
    try {
      const url = new URL(
        `${this.baseUrl}/v0/addresses/${address}/transactions`,
      );
      url.searchParams.set("api-key", this.apiKey);
      if (options?.before) url.searchParams.set("before", options.before);
      if (options?.limit) url.searchParams.set("limit", String(options.limit));

      const response = await fetch(url.toString());

      if (!response.ok) return [];

      return await response.json();
    } catch {
      return [];
    }
  }
}

/**
 * Get Helius client instance
 */
export function getHeliusClient(): HeliusClient | null {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.warn("[Helius] HELIUS_API_KEY not set");
    return null;
  }
  return new HeliusClient(apiKey);
}
