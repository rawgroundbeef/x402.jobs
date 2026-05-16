import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { notifyResourceLowSuccessRate } from "../../services/notifications.service";

// Threshold below which resources are hidden from workflow builder
const LOW_SUCCESS_RATE_THRESHOLD = 0.7;
// Minimum calls before we consider success rate meaningful
const MIN_CALLS_FOR_NOTIFICATION = 5;

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

/**
 * Aggregate 30-day rolling success rates for all resources and jobs.
 *
 * This cron job runs hourly to keep reliability metrics up-to-date.
 * Success rate = successful_runs / total_runs over the last 30 days.
 */
export const aggregateResourceSuccessRates = inngest.createFunction(
  {
    id: "aggregate-resource-success-rates",
    retries: 2,
  },
  // Run every hour at minute 30 (offset from server stats which runs at minute 0)
  { cron: "30 * * * *" },
  async ({ step, logger }) => {
    // Step 1: Aggregate resource success rates
    const resourceStats = await step.run(
      "aggregate-resource-success-rates",
      async () => {
        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Aggregate success/failure counts per resource from events in last 30 days
        // Using raw SQL via RPC for the FILTER clause which Supabase JS doesn't support directly
        const { data: aggregatedStats, error: aggError } = await supabase.rpc(
          "aggregate_resource_success_stats",
          { cutoff_date: thirtyDaysAgo.toISOString() },
        );

        // If the RPC doesn't exist, fall back to manual approach
        if (aggError) {
          logger.warn(
            "RPC not available, using fallback aggregation:",
            aggError.message,
          );
          return await fallbackAggregation(thirtyDaysAgo, logger);
        }

        if (!aggregatedStats || aggregatedStats.length === 0) {
          logger.info("No resource stats to update");
          return { processed: 0, errors: 0 };
        }

        logger.info(
          `Updating success rates for ${aggregatedStats.length} resources`,
        );

        let updated = 0;
        let errors = 0;

        // Update each resource with its stats
        for (const stat of aggregatedStats) {
          const { error: updateError } = await supabase
            .from("x402_resources")
            .update({
              success_count_30d: stat.success_count || 0,
              failure_count_30d: stat.failure_count || 0,
              success_rate_updated_at: new Date().toISOString(),
            })
            .eq("id", stat.resource_id);

          if (updateError) {
            logger.error(
              `Failed to update resource ${stat.resource_id}:`,
              updateError,
            );
            errors++;
          } else {
            updated++;
          }
        }

        // Also reset stats for resources that had no events in the last 30 days
        // (they should show 0 calls, not stale data)
        const resourceIdsWithStats = aggregatedStats.map(
          (s: { resource_id: string }) => s.resource_id,
        );

        if (resourceIdsWithStats.length > 0) {
          const { error: resetError } = await supabase
            .from("x402_resources")
            .update({
              success_count_30d: 0,
              failure_count_30d: 0,
              success_rate_updated_at: new Date().toISOString(),
            })
            .eq("is_active", true)
            .not("id", "in", `(${resourceIdsWithStats.join(",")})`);

          if (resetError) {
            logger.warn("Failed to reset stale resource stats:", resetError);
          }
        }

        return { processed: updated, errors };
      },
    );

    // Step 2: Aggregate job success rates
    const jobStats = await step.run("aggregate-job-success-rates", async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch all job runs from the last 30 days
      const { data: runs, error: runsError } = await supabase
        .from("x402_job_runs")
        .select("job_id, status")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .in("status", ["success", "failed"]);

      if (runsError) {
        logger.error("Failed to fetch job runs:", runsError);
        return { processed: 0, errors: 1 };
      }

      if (!runs || runs.length === 0) {
        logger.info("No job runs found in the last 30 days");
        return { processed: 0, errors: 0 };
      }

      // Aggregate in memory
      const jobStatsMap = new Map<
        string,
        { success_count: number; failure_count: number }
      >();

      for (const run of runs) {
        if (!run.job_id) continue;

        const current = jobStatsMap.get(run.job_id) || {
          success_count: 0,
          failure_count: 0,
        };

        if (run.status === "success") {
          current.success_count++;
        } else if (run.status === "failed") {
          current.failure_count++;
        }

        jobStatsMap.set(run.job_id, current);
      }

      logger.info(`Aggregated stats for ${jobStatsMap.size} jobs`);

      let updated = 0;
      let errors = 0;

      // Update each job
      for (const [jobId, stat] of jobStatsMap) {
        const { error: updateError } = await supabase
          .from("x402_jobs")
          .update({
            success_count_30d: stat.success_count,
            failure_count_30d: stat.failure_count,
            success_rate_updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        if (updateError) {
          logger.error(`Failed to update job ${jobId}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      // Reset jobs with no recent runs
      const jobIdsWithStats = Array.from(jobStatsMap.keys());
      if (jobIdsWithStats.length > 0) {
        await supabase
          .from("x402_jobs")
          .update({
            success_count_30d: 0,
            failure_count_30d: 0,
            success_rate_updated_at: new Date().toISOString(),
          })
          .eq("is_active", true)
          .not("id", "in", `(${jobIdsWithStats.join(",")})`);
      }

      return { processed: updated, errors };
    });

    // Step 3: Notify owners of resources with low success rates
    const notificationStats = await step.run(
      "notify-low-success-rate-owners",
      async () => {
        // Find resources with low success rates that have meaningful usage
        const { data: lowSuccessResources, error: queryError } = await supabase
          .from("x402_resources")
          .select(
            "id, name, registered_by, success_count_30d, failure_count_30d, server:x402_servers(slug)",
          )
          .eq("is_active", true)
          .not("registered_by", "is", null);

        if (queryError) {
          logger.error("Failed to query low success resources:", queryError);
          return { notified: 0, errors: 1 };
        }

        let notified = 0;
        let errors = 0;

        // Check 7 days ago for notification throttling
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        for (const resource of lowSuccessResources || []) {
          const successCount = resource.success_count_30d || 0;
          const failureCount = resource.failure_count_30d || 0;
          const totalCalls = successCount + failureCount;

          // Skip if not enough data
          if (totalCalls < MIN_CALLS_FOR_NOTIFICATION) continue;

          const successRate = successCount / totalCalls;

          // Skip if above threshold
          if (successRate >= LOW_SUCCESS_RATE_THRESHOLD) continue;

          // Check if we already notified this owner about this resource recently
          const { count: recentNotifications } = await supabase
            .from("x402_notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", resource.registered_by)
            .eq("type", "resource_low_success_rate")
            .contains("metadata", { resource_id: resource.id })
            .gte("created_at", sevenDaysAgo.toISOString());

          if (recentNotifications && recentNotifications > 0) {
            // Already notified recently, skip
            continue;
          }

          // Send notification
          try {
            const serverSlug = (resource.server as { slug?: string } | null)
              ?.slug;
            await notifyResourceLowSuccessRate(
              resource.registered_by,
              resource.id,
              resource.name,
              serverSlug,
              successRate,
              successCount,
              failureCount,
            );
            notified++;
            logger.info(
              `Notified owner of low success rate resource: ${resource.name} (${Math.round(successRate * 100)}%)`,
            );
          } catch (notifyError) {
            logger.error(
              `Failed to notify owner for ${resource.name}:`,
              notifyError,
            );
            errors++;
          }
        }

        return { notified, errors };
      },
    );

    logger.info("Success rate aggregation complete", {
      resources: resourceStats,
      jobs: jobStats,
      notifications: notificationStats,
    });

    return {
      resources: resourceStats,
      jobs: jobStats,
      notifications: notificationStats,
    };
  },
);

/**
 * Fallback aggregation when RPC is not available.
 * Fetches events from both job_run_events AND resource_executions,
 * then aggregates in application code.
 */
async function fallbackAggregation(
  cutoffDate: Date,
  logger: {
    info: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
  },
): Promise<{ processed: number; errors: number }> {
  // Aggregate in memory
  const statsMap = new Map<
    string,
    { success_count: number; failure_count: number }
  >();

  // Source 1: Job run events (workflow executions)
  const { data: events, error: eventsError } = await supabase
    .from("x402_job_run_events")
    .select("resource_id, status")
    .gte("created_at", cutoffDate.toISOString())
    .not("resource_id", "is", null)
    .in("status", ["completed", "success", "failed"]);

  if (eventsError) {
    logger.error("Failed to fetch job run events:", eventsError);
  } else if (events) {
    for (const event of events) {
      if (!event.resource_id) continue;

      const current = statsMap.get(event.resource_id) || {
        success_count: 0,
        failure_count: 0,
      };

      if (event.status === "completed" || event.status === "success") {
        current.success_count++;
      } else if (event.status === "failed") {
        current.failure_count++;
      }

      statsMap.set(event.resource_id, current);
    }
    logger.info(`Processed ${events.length} job run events`);
  }

  // Source 2: Direct resource executions (from resource detail page)
  const { data: executions, error: execError } = await supabase
    .from("x402_resource_executions")
    .select("resource_id, success")
    .gte("executed_at", cutoffDate.toISOString());

  if (execError) {
    logger.warn("Failed to fetch resource executions:", execError);
  } else if (executions) {
    for (const exec of executions) {
      if (!exec.resource_id) continue;

      const current = statsMap.get(exec.resource_id) || {
        success_count: 0,
        failure_count: 0,
      };

      if (exec.success) {
        current.success_count++;
      } else {
        current.failure_count++;
      }

      statsMap.set(exec.resource_id, current);
    }
    logger.info(`Processed ${executions.length} direct resource executions`);
  }

  if (statsMap.size === 0) {
    logger.info("No events or executions found in the last 30 days");
    return { processed: 0, errors: 0 };
  }

  logger.info(`Aggregated stats for ${statsMap.size} resources total`);

  let updated = 0;
  let errors = 0;

  // Update each resource
  for (const [resourceId, stat] of statsMap) {
    const { error: updateError } = await supabase
      .from("x402_resources")
      .update({
        success_count_30d: stat.success_count,
        failure_count_30d: stat.failure_count,
        success_rate_updated_at: new Date().toISOString(),
      })
      .eq("id", resourceId);

    if (updateError) {
      logger.error(`Failed to update resource ${resourceId}:`, updateError);
      errors++;
    } else {
      updated++;
    }
  }

  // Reset resources with no recent events
  const resourceIdsWithStats = Array.from(statsMap.keys());
  if (resourceIdsWithStats.length > 0) {
    await supabase
      .from("x402_resources")
      .update({
        success_count_30d: 0,
        failure_count_30d: 0,
        success_rate_updated_at: new Date().toISOString(),
      })
      .eq("is_active", true)
      .not("id", "in", `(${resourceIdsWithStats.join(",")})`);
  }

  return { processed: updated, errors };
}
