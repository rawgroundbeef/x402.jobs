/**
 * Verify Servers
 *
 * Health checker that cross-references Bazaar discovery data with on-chain
 * activity to flag discrepancies and verify server responsiveness.
 */

import { inngest } from "../../lib/inngest";
import { getSupabase } from "../../lib/supabase";

// Flag types for server discrepancies
export const SERVER_FLAGS = {
  NO_ONCHAIN_ACTIVITY: "NO_ONCHAIN_ACTIVITY", // In Bazaar but no transactions
  NOT_IN_BAZAAR: "NOT_IN_BAZAAR", // Has transactions but not in any Bazaar
  UNRESPONSIVE: "UNRESPONSIVE", // Does not respond to requests
  INVALID_402: "INVALID_402", // Responds but not with valid 402
} as const;

/**
 * Check if a server endpoint responds with 402
 */
async function checkServerHealth(
  originUrl: string,
): Promise<{ responsive: boolean; valid402: boolean }> {
  try {
    // Try to fetch the root - many x402 servers respond with 402 on root
    const response = await fetch(originUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    // Any response means server is responsive
    const responsive = true;

    // Check if it's a valid 402 response
    const valid402 = response.status === 402;

    return { responsive, valid402 };
  } catch {
    return { responsive: false, valid402: false };
  }
}

/**
 * Verify all servers - runs every 10 minutes
 */
export const verifyServers = inngest.createFunction(
  {
    id: "verify-servers",
    retries: 1,
    concurrency: { limit: 1 }, // Only one instance at a time
  },
  // Run every 10 minutes
  { cron: "*/10 * * * *" },
  async ({ step, logger }) => {
    const supabase = getSupabase();

    // Get all servers
    const { data: servers, error } = await supabase
      .from("x402_servers")
      .select("id, origin_url, discovered_via, transaction_count, flags")
      .order("last_health_check_at", { ascending: true, nullsFirst: true })
      .limit(50); // Process 50 at a time

    if (error || !servers) {
      logger.error("Failed to fetch servers", error);
      return { error: "Failed to fetch servers" };
    }

    logger.info(`Verifying ${servers.length} servers`);

    const results = {
      checked: 0,
      responsive: 0,
      valid402: 0,
      flagged: 0,
    };

    // Check each server
    for (const server of servers) {
      await step.run(`check-${server.id}`, async () => {
        results.checked++;

        const health = await checkServerHealth(server.origin_url);
        const newFlags: string[] = [];

        // Determine flags based on health check and data
        if (!health.responsive) {
          newFlags.push(SERVER_FLAGS.UNRESPONSIVE);
        } else {
          results.responsive++;

          if (!health.valid402) {
            // Server is up but doesn't return 402 on root - not necessarily a problem
            // as 402 might only be on specific endpoints
          }
        }

        // Check for on-chain activity discrepancy
        const hasTransactions = (server.transaction_count || 0) > 0;
        const fromBazaar = server.discovered_via === "bazaar";

        if (fromBazaar && !hasTransactions) {
          newFlags.push(SERVER_FLAGS.NO_ONCHAIN_ACTIVITY);
        }

        if (hasTransactions && !fromBazaar) {
          newFlags.push(SERVER_FLAGS.NOT_IN_BAZAAR);
        }

        // Update server with health check results
        const updateData: Record<string, unknown> = {
          is_responsive: health.responsive,
          last_health_check_at: new Date().toISOString(),
        };

        // Only update flags if they changed
        const currentFlags = server.flags || [];
        const flagsChanged =
          newFlags.length !== currentFlags.length ||
          !newFlags.every((f) => currentFlags.includes(f));

        if (flagsChanged) {
          updateData.flags = newFlags;
          results.flagged += newFlags.length > 0 ? 1 : 0;
        }

        await supabase
          .from("x402_servers")
          .update(updateData)
          .eq("id", server.id);

        if (health.valid402) {
          results.valid402++;
        }
      });
    }

    logger.info("Server verification complete", results);
    return results;
  },
);

/**
 * Get servers with discrepancy flags
 */
export async function getDiscrepancies(): Promise<
  Array<{
    id: string;
    origin_url: string;
    name: string;
    flags: string[];
    transaction_count: number;
    discovered_via: string;
  }>
> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("x402_servers")
    .select("id, origin_url, name, flags, transaction_count, discovered_via")
    .not("flags", "eq", "{}");

  return data || [];
}
