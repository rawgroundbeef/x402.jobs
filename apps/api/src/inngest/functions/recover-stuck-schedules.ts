import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { getNextRunTime } from "../../lib/timezone";

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

// A schedule is considered "stuck" if:
// - trigger_methods.schedule = true AND is_active = true
// - AND (schedule_next_run_at is NULL OR schedule_next_run_at is more than 10 minutes in the past)
// - This means the sleepUntil chain broke at some point
const STUCK_THRESHOLD_MINUTES = 10;

/**
 * Recover stuck scheduled jobs.
 *
 * The schedule system uses Inngest sleepUntil chains, which can break
 * due to deploys, errors, or other issues. This watchdog runs every 5 minutes
 * to find and re-initialize any stuck schedules.
 */
export const recoverStuckSchedules = inngest.createFunction(
  {
    id: "recover-stuck-schedules",
    retries: 2,
  },
  // Run every 5 minutes
  { cron: "*/5 * * * *" },
  async ({ step, logger }) => {
    const result = await step.run("find-and-recover-schedules", async () => {
      const cutoffTime = new Date(
        Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000,
      ).toISOString();

      // Find jobs with enabled schedules that appear stuck:
      // - trigger_methods contains {"schedule": true}
      // - is_active = true
      // - has a cron expression
      // - schedule_next_run_at is either NULL or in the past (beyond threshold)
      const { data: stuckJobs, error: fetchError } = await supabase
        .from("x402_jobs")
        .select(
          "id, user_id, name, schedule_cron, schedule_timezone, schedule_next_run_at, trigger_methods",
        )
        .eq("is_active", true)
        .not("schedule_cron", "is", null)
        .contains("trigger_methods", { schedule: true });

      if (fetchError) {
        logger.error("Failed to fetch scheduled jobs:", fetchError);
        return { recovered: 0, errors: 1 };
      }

      if (!stuckJobs || stuckJobs.length === 0) {
        logger.info("No scheduled jobs found");
        return { recovered: 0, errors: 0 };
      }

      // Filter to only stuck jobs (next_run_at is null or past cutoff)
      const jobsToRecover = stuckJobs.filter((job) => {
        if (!job.schedule_next_run_at) {
          // No next run time set - definitely stuck
          return true;
        }
        const nextRun = new Date(job.schedule_next_run_at);
        // If next run is more than STUCK_THRESHOLD_MINUTES in the past, it's stuck
        return nextRun < new Date(cutoffTime);
      });

      if (jobsToRecover.length === 0) {
        logger.info(
          `All ${stuckJobs.length} scheduled jobs have valid next run times`,
        );
        return { recovered: 0, errors: 0 };
      }

      logger.info(
        `Found ${jobsToRecover.length} stuck scheduled jobs to recover`,
      );

      let recovered = 0;
      let errors = 0;

      for (const job of jobsToRecover) {
        try {
          // Calculate the next run time
          const nextRun = getNextRunTime(
            job.schedule_cron,
            job.schedule_timezone || "UTC",
          );

          if (!nextRun) {
            logger.warn(
              `Invalid cron expression for job ${job.id}: ${job.schedule_cron}`,
            );
            errors++;
            continue;
          }

          logger.info(
            `🔧 Recovering stuck schedule for job ${job.id} (${job.name}), next run: ${nextRun.toISOString()}`,
          );

          // Update the job with the new next run time
          await supabase
            .from("x402_jobs")
            .update({
              schedule_next_run_at: nextRun.toISOString(),
            })
            .eq("id", job.id);

          // Send the schedule.run event to restart the chain
          await inngest.send({
            name: "x402/schedule.run",
            data: {
              jobId: job.id,
              scheduledFor: nextRun.toISOString(),
            },
          });

          recovered++;
          logger.info(
            `✅ Recovered schedule for job ${job.id}, next run: ${nextRun.toISOString()}`,
          );
        } catch (err) {
          logger.error(`Failed to recover schedule for job ${job.id}:`, err);
          errors++;
        }
      }

      return { recovered, errors, total: stuckJobs.length };
    });

    logger.info("Stuck schedule recovery complete", result);

    return result;
  },
);
