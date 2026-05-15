import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

/**
 * Aggregate server statistics from their resources.
 *
 * This cron job runs every 6 hours to keep server rankings up-to-date
 * based on actual usage (earnings, calls) rather than just resource count.
 */
export const aggregateServerStats = inngest.createFunction(
  {
    id: "aggregate-server-stats-v2",
    retries: 2,
  },
  // Run every 6 hours (at minute 0 of hours 0, 6, 12, 18)
  { cron: "0 */6 * * *" },
  async ({ step, logger }) => {
    const stats = await step.run("aggregate-stats", async () => {
      // Get all servers
      const { data: servers, error: serversError } = await supabase
        .from("x402_servers")
        .select("id");

      if (serversError) {
        logger.error("Failed to fetch servers:", serversError);
        return { processed: 0, errors: 1 };
      }

      if (!servers || servers.length === 0) {
        logger.info("No servers to update");
        return { processed: 0, errors: 0 };
      }

      logger.info(`Aggregating stats for ${servers.length} servers`);

      let updated = 0;
      let errors = 0;

      for (const server of servers) {
        // Aggregate stats from all active resources for this server
        const { data: aggregation, error: aggError } = await supabase
          .from("x402_resources")
          .select("total_earned_usdc, call_count")
          .eq("server_id", server.id)
          .eq("is_active", true);

        if (aggError) {
          logger.error(
            `Failed to aggregate for server ${server.id}:`,
            aggError,
          );
          errors++;
          continue;
        }

        // Sum up the totals and count active resources
        let totalEarned = 0;
        let totalCalls = 0;
        const resourceCount = aggregation?.length || 0;
        for (const resource of aggregation || []) {
          totalEarned += parseFloat(resource.total_earned_usdc) || 0;
          totalCalls += resource.call_count || 0;
        }

        // Update server with aggregated stats (including resource_count)
        const { error: updateError } = await supabase
          .from("x402_servers")
          .update({
            resource_count: resourceCount,
            total_earned_usdc: totalEarned,
            total_calls: totalCalls,
            stats_updated_at: new Date().toISOString(),
          })
          .eq("id", server.id);

        if (updateError) {
          logger.error(`Failed to update server ${server.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      return { processed: updated, errors };
    });

    // Also update platform-wide stats
    const platformStats = await step.run("update-platform-stats", async () => {
      try {
        // Total volume from resources
        const { data: volumeData } = await supabase
          .from("x402_resources")
          .select("total_earned_usdc")
          .eq("is_active", true);

        const totalVolume = (volumeData || []).reduce(
          (sum, r) => sum + (parseFloat(r.total_earned_usdc) || 0),
          0,
        );

        // Total resources count (excluding offline, deduplicated by URL)
        const { data: allResources } = await supabase
          .from("x402_resources")
          .select("resource_url")
          .eq("is_active", true)
          .or("health_status.is.null,health_status.neq.offline");

        // Deduplicate by resource_url
        const uniqueUrls = new Set(
          (allResources || []).map((r) => r.resource_url),
        );
        const resourceCount = uniqueUrls.size;

        // Total jobs run
        const { data: jobsData } = await supabase
          .from("x402_jobs")
          .select("run_count")
          .eq("is_active", true);

        const totalJobsRun = (jobsData || []).reduce(
          (sum, j) => sum + (j.run_count || 0),
          0,
        );

        // Active jobs = runs currently executing (pending or running)
        const { count: activeJobsCount } = await supabase
          .from("x402_job_runs")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "running"]);

        // Upsert platform stats
        const statsToUpdate = [
          { id: "total_volume_usdc", value: totalVolume.toString(), count: 0 },
          { id: "total_resources", value: "0", count: resourceCount || 0 },
          { id: "total_jobs_run", value: "0", count: totalJobsRun },
          { id: "active_jobs", value: "0", count: activeJobsCount || 0 },
        ];

        for (const stat of statsToUpdate) {
          await supabase
            .from("x402_platform_stats")
            .upsert(stat, { onConflict: "id" });
        }

        return { updated: true };
      } catch (error) {
        logger.error("Failed to update platform stats:", error);
        return { updated: false, error: String(error) };
      }
    });

    logger.info("Server stats aggregation complete", {
      servers: stats,
      platform: platformStats,
    });

    return {
      servers: stats,
      platform: platformStats,
    };
  },
);
