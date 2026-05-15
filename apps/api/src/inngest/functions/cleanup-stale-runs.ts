import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

// A run is considered stale if it's been "running" or "pending" for more than 15 minutes
const STALE_THRESHOLD_MINUTES = 15;

/**
 * Clean up stale job runs.
 *
 * Runs that have been in "running" or "pending" status for too long
 * are marked as "failed" with a timeout error.
 *
 * This prevents stuck runs from polluting stats and the UI.
 */
export const cleanupStaleRuns = inngest.createFunction(
  {
    id: "cleanup-stale-runs",
    retries: 2,
  },
  // Run every 5 minutes
  { cron: "*/5 * * * *" },
  async ({ step, logger }) => {
    const result = await step.run("cleanup-stale-runs", async () => {
      const cutoffTime = new Date(
        Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
      ).toISOString();

      // Find stale runs (running or pending for too long)
      // Include payment fields for escrow refund processing
      const { data: staleRuns, error: fetchError } = await supabase
        .from("x402_job_runs")
        .select(
          "id, job_id, user_id, status, created_at, started_at, creator_markup_earned, payer_address, payment_network",
        )
        .in("status", ["running", "pending"])
        .lt("created_at", cutoffTime);

      if (fetchError) {
        logger.error("Failed to fetch stale runs:", fetchError);
        return { cleaned: 0, errors: 1 };
      }

      if (!staleRuns || staleRuns.length === 0) {
        logger.info("No stale runs found");
        return { cleaned: 0, errors: 0 };
      }

      logger.info(`Found ${staleRuns.length} stale runs to clean up`);

      let cleaned = 0;
      let errors = 0;

      for (const run of staleRuns) {
        // Update the run to failed status
        const { error: updateError } = await supabase
          .from("x402_job_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        if (updateError) {
          logger.error(`Failed to update run ${run.id}:`, updateError);
          errors++;
          continue;
        }

        // Also mark any running/pending events as failed
        const { error: eventsError } = await supabase
          .from("x402_job_run_events")
          .update({
            status: "failed",
            error: `Run timed out after ${STALE_THRESHOLD_MINUTES} minutes`,
            completed_at: new Date().toISOString(),
          })
          .eq("run_id", run.id)
          .in("status", ["running", "pending"]);

        if (eventsError) {
          logger.error(
            `Failed to update events for run ${run.id}:`,
            eventsError,
          );
          // Don't increment errors - the run was still cleaned up
        }

        // ESCROW: Skip automatic refunds - use manual refund system instead
        // Users can request refunds via /account/history which go through admin approval
        const creatorMarkup = parseFloat(run.creator_markup_earned) || 0;
        if (creatorMarkup > 0 && run.payer_address) {
          logger.info(
            `Stale run ${run.id} - skipping automatic refund (manual refund system enabled). User can request refund via History page.`,
          );
        }

        cleaned++;
        logger.info(`Cleaned up stale run ${run.id} (was ${run.status})`);
      }

      return { cleaned, errors };
    });

    logger.info("Stale run cleanup complete", result);

    return result;
  },
);
