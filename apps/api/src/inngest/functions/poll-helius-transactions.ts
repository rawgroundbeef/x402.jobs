/**
 * Poll Helius Transactions
 *
 * DISABLED: This was polling ~30 addresses every 5 minutes, burning through
 * Helius RPC credits (~3,500 transactionHistory calls/day). The data is only
 * used for user transaction history in dashboards, which is rarely viewed.
 *
 * TODO: Implement on-demand fetching in /api/wallet/transactions instead.
 */

import { inngest } from "../../lib/inngest";
import { getSupabase } from "../../lib/supabase";
import {
  getHeliusClient,
  getServerAddresses,
  parseUsdcTransfer,
  SOLANA_USDC_MINT,
} from "../../indexers/helius";

/**
 * Poll Helius for recent transactions every 5 minutes
 */
export const pollHeliusTransactions = inngest.createFunction(
  {
    id: "poll-helius-transactions",
    retries: 2,
  },
  // DISABLED - was burning ~3,500 RPC credits/day for rarely-used feature
  // { cron: "*/5 * * * *" },
  { event: "x402/helius.poll.manual" }, // Manual trigger only
  async ({ step, logger }) => {
    const helius = getHeliusClient();
    if (!helius) {
      logger.warn("Helius client not configured - skipping transaction poll");
      return { skipped: true, reason: "No HELIUS_API_KEY" };
    }

    const supabase = getSupabase();

    // Get addresses to poll
    const addresses = await step.run("get-addresses", async () => {
      const addrs = await getServerAddresses();
      logger.info(`Found ${addrs.length} addresses to poll`);
      return addrs;
    });

    if (addresses.length === 0) {
      return { skipped: true, reason: "No addresses to poll" };
    }

    // Build lookup maps for attribution
    const { resources, facilitatorAddresses } = await step.run(
      "build-lookup-maps",
      async () => {
        const { data: resources } = await supabase
          .from("x402_resources")
          .select("id, pay_to, server_id, facilitator_id")
          .eq("is_active", true)
          .eq("network", "solana");

        const { data: facilitatorAddresses } = await supabase
          .from("x402_facilitator_addresses")
          .select("facilitator_id, address")
          .eq("is_active", true)
          .eq("network", "solana");

        return {
          resources: resources || [],
          facilitatorAddresses: facilitatorAddresses || [],
        };
      },
    );

    // Build maps
    const addressToResource = new Map<
      string,
      { serverId: string; resourceId: string; facilitatorId: string | null }
    >();
    for (const resource of resources) {
      if (resource.pay_to && resource.server_id) {
        addressToResource.set(resource.pay_to, {
          serverId: resource.server_id,
          resourceId: resource.id,
          facilitatorId: resource.facilitator_id,
        });
      }
    }

    const feePayerToFacilitator = new Map<string, string>();
    for (const fa of facilitatorAddresses) {
      if (fa.address && fa.facilitator_id) {
        feePayerToFacilitator.set(fa.address, fa.facilitator_id);
      }
    }

    // Poll each address
    const stats = { polled: 0, newTransactions: 0, errors: 0 };

    for (const address of addresses) {
      const result = await step.run(`poll-${address.slice(0, 8)}`, async () => {
        const addressStats = { transactions: 0, new: 0, errors: 0 };

        try {
          // Fetch recent transactions (last 100)
          const transactions = await helius.getTransactionHistory(address, {
            limit: 100,
          });

          addressStats.transactions = transactions.length;

          for (const tx of transactions) {
            try {
              const transfer = parseUsdcTransfer(tx);
              if (!transfer) continue;

              // Only process if this address is the receiver
              if (transfer.to !== address) continue;

              // Look up resource/server
              const resourceInfo = addressToResource.get(transfer.to);

              // Look up facilitator by feePayer
              const facilitatorId =
                resourceInfo?.facilitatorId ||
                feePayerToFacilitator.get(tx.feePayer) ||
                null;

              // Upsert transaction (signature is unique)
              const { error, data } = await supabase
                .from("x402_transactions")
                .upsert(
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
                  {
                    onConflict: "signature",
                    ignoreDuplicates: true, // Don't update existing records
                  },
                )
                .select("id")
                .maybeSingle();

              if (error) {
                // Ignore duplicate key errors (expected for already-indexed txs)
                if (error.code !== "23505") {
                  console.error(
                    `[Helius Poll] Failed to record tx ${tx.signature}:`,
                    error,
                  );
                  addressStats.errors++;
                }
                continue;
              }

              // New transaction recorded
              if (data) {
                addressStats.new++;

                // Update server stats if matched
                if (resourceInfo?.serverId) {
                  await supabase.rpc("increment_server_transaction_count", {
                    server_id_param: resourceInfo.serverId,
                    amount_param: transfer.amount,
                  });
                }
              }
            } catch (err) {
              console.error(`[Helius Poll] Error processing tx:`, err);
              addressStats.errors++;
            }
          }
        } catch (err) {
          console.error(`[Helius Poll] Error polling ${address}:`, err);
          addressStats.errors++;
        }

        return addressStats;
      });

      stats.polled++;
      stats.newTransactions += result.new;
      stats.errors += result.errors;
    }

    logger.info(
      `Polling complete: ${stats.polled} addresses, ${stats.newTransactions} new transactions, ${stats.errors} errors`,
    );

    return stats;
  },
);

/**
 * Manual trigger to poll transactions
 */
export const triggerHeliusPoll = inngest.createFunction(
  {
    id: "trigger-helius-poll",
    retries: 1,
  },
  { event: "x402/helius.poll" },
  async ({ logger }) => {
    const helius = getHeliusClient();
    if (!helius) {
      return { error: "Helius not configured" };
    }

    const addresses = await getServerAddresses();
    logger.info(`Found ${addresses.length} addresses to poll`);

    // For manual trigger, just return info - the cron job will do the actual work
    return {
      addresses: addresses.length,
      message: "Use the cron job for actual polling",
    };
  },
);
