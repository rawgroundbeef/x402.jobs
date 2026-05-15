import { inngest } from "../../lib/inngest";
import { getSupabase } from "../../lib/supabase";
import { getSolanaUsdcBalance } from "../../lib/solana";
import { getBaseUsdcBalance } from "../../lib/base";
import { getNextRunTime } from "../../lib/timezone";
import { notifySchedulePausedLowBalance } from "../../services/notifications.service";
import {
  broadcastScheduleEvent,
  broadcastNotification,
  broadcastToUser,
} from "../../lib/websocket";
import { calculatePlatformFee } from "../utils/charge-platform-fee";
import { loadDecryptedUserWallet } from "../../lib/wallet-keys";

// Minimum fallback balance (used when job cost can't be calculated)
const MIN_BALANCE_FALLBACK = 0.05;

/**
 * Inngest function to execute a scheduled job run.
 *
 * Uses step.sleepUntil() to wait until the scheduled time,
 * then executes the job and schedules the next run.
 */
export const runScheduledJob = inngest.createFunction(
  {
    id: "run-scheduled-job",
    retries: 2,
    // Only allow ONE scheduled run per job at a time
    // This prevents duplicate chains when schedule is re-saved
    concurrency: {
      limit: 1,
      key: "event.data.jobId",
    },
  },
  { event: "x402/schedule.run" },
  async ({ event, step, logger }) => {
    const { jobId, scheduledFor } = event.data as {
      jobId: string;
      scheduledFor: string; // ISO timestamp
    };

    console.log(
      `⏰ [SCHEDULE] runScheduledJob triggered for job ${jobId}, scheduledFor: ${scheduledFor}`,
    );
    logger.info(
      `⏰ [SCHEDULE] runScheduledJob triggered for job ${jobId}, scheduledFor: ${scheduledFor}`,
    );

    const supabase = getSupabase();

    // Sleep until the scheduled time
    logger.info(`⏰ [SCHEDULE] Sleeping until ${scheduledFor}...`);
    await step.sleepUntil("wait-for-schedule", new Date(scheduledFor));
    logger.info(`⏰ [SCHEDULE] Woke up! Time to execute job ${jobId}`);

    // IMPORTANT: Check schedule status FRESH (not memoized) to catch disabled schedules
    // This runs on every execution/replay to get the latest DB state
    const scheduleCheck = await step.run("check-schedule-enabled", async () => {
      const { data, error } = await supabase
        .from("x402_jobs")
        .select("trigger_methods, is_active")
        .eq("id", jobId)
        .single();

      // Check if we already ran for this exact scheduledFor time (dedup check)
      const { data: existingRuns } = await supabase
        .from("x402_scheduled_runs")
        .select("id, status, triggered_at")
        .eq("job_id", jobId)
        .eq("scheduled_for", scheduledFor)
        .eq("status", "triggered");

      if (error) {
        logger.error(
          `Failed to check schedule status for job ${jobId}:`,
          error,
        );
        return { enabled: false, active: false, alreadyRan: false };
      }

      // DEDUPLICATION: Check if we already executed for this exact scheduledFor time
      // This prevents duplicate chains from creating multiple runs
      const alreadyRan = (existingRuns?.length || 0) > 0;

      // Use trigger_methods.schedule as the source of truth
      const triggerMethods = data?.trigger_methods as {
        schedule?: boolean;
      } | null;

      return {
        enabled: triggerMethods?.schedule ?? false,
        active: data?.is_active ?? false,
        alreadyRan,
      };
    });

    logger.info(
      `⏰ [SCHEDULE] Job ${jobId} status: trigger_methods.schedule=${scheduleCheck.enabled}, is_active=${scheduleCheck.active}, alreadyRan=${scheduleCheck.alreadyRan}`,
    );

    // DEDUPLICATION: If this scheduledFor time was already executed, skip
    // This handles the case where multiple schedule chains exist for the same time
    if (scheduleCheck.alreadyRan) {
      logger.info(
        `⏰ [SCHEDULE] Job ${jobId} already ran for scheduledFor=${scheduledFor}, SKIPPING (duplicate chain)`,
      );
      return {
        success: false,
        error: "Already ran (duplicate chain)",
        skipped: true,
      };
    }

    if (!scheduleCheck.enabled || !scheduleCheck.active) {
      logger.info(
        `⏰ [SCHEDULE] Job ${jobId} is no longer scheduled or active, STOPPING`,
      );
      return { success: false, error: "Job disabled" };
    }

    // Fetch full job details for execution
    const job = await step.run("fetch-job", async () => {
      const { data, error } = await supabase
        .from("x402_jobs")
        .select(
          `
          id,
          user_id,
          name,
          workflow_definition,
          schedule_cron,
          schedule_timezone,
          trigger_methods,
          is_active
        `,
        )
        .eq("id", jobId)
        .single();

      if (error) {
        logger.error(`Failed to fetch job ${jobId}:`, error);
        return null;
      }
      return data;
    });

    if (!job) {
      logger.error(`Job ${jobId} not found`);
      return { success: false, error: "Job not found" };
    }

    // Check wallet balance before executing
    // IMPORTANT: Check the correct network (Solana vs Base) and verify against actual job cost
    const balanceCheck = await step.run("check-wallet-balance", async () => {
      console.log(
        `💰 [BALANCE CHECK] Starting balance check for user ${job.user_id}`,
      );
      logger.info(
        `💰 [BALANCE CHECK] Starting balance check for user ${job.user_id}`,
      );

      // Get user's wallet — decrypted.
      const wallet = await loadDecryptedUserWallet(job.user_id);

      if (!wallet) {
        logger.error(`No wallet found for user ${job.user_id}`);
        return {
          hasWallet: false,
          hasSufficientBalance: false,
          balance: 0,
          wallet: null,
          requiredBalance: 0,
          jobNetwork: "solana" as const,
        };
      }

      // Determine job network and calculate total cost from workflow definition
      const workflowDef = job.workflow_definition;
      const nodes = workflowDef?.nodes || [];
      const resourceNodes = nodes.filter((n: any) => n.type === "resource");

      // Check if any resource is on Base network
      const hasBaseResource = resourceNodes.some((node: any) => {
        const resource = node.data.resource || node.data;
        const net = resource.network?.toLowerCase();
        return net === "base" || net === "base-mainnet";
      });
      const jobNetwork: "solana" | "base" = hasBaseResource ? "base" : "solana";

      // Calculate total resource cost
      const totalResourceCost = resourceNodes.reduce(
        (sum: number, node: any) => {
          const resource = node.data.resource || node.data;
          return sum + (resource.price || 0);
        },
        0,
      );

      // Calculate platform fee (1.5% of resource cost, min $0.01)
      const platformFee = calculatePlatformFee(totalResourceCost);

      // Total required = platform fee + resource costs
      const requiredBalance = platformFee + totalResourceCost;
      const minRequired = Math.max(requiredBalance, MIN_BALANCE_FALLBACK);

      console.log(
        `💰 [BALANCE CHECK] Job network: ${jobNetwork}, Resources: ${resourceNodes.length}, Total cost: $${totalResourceCost.toFixed(4)} + $${platformFee.toFixed(4)} fee = $${requiredBalance.toFixed(4)}`,
      );
      logger.info(
        `💰 [BALANCE CHECK] Job network: ${jobNetwork}, Required: $${minRequired.toFixed(4)}`,
      );

      // Check balance on the correct network
      let balance: number;
      let walletAddress: string;

      if (jobNetwork === "base") {
        // For Base jobs, check Base wallet balance
        if (!wallet.baseAddress) {
          logger.error(`No Base wallet found for user ${job.user_id}`);
          return {
            hasWallet: false,
            hasSufficientBalance: false,
            balance: 0,
            wallet,
            requiredBalance: minRequired,
            jobNetwork,
          };
        }
        walletAddress = wallet.baseAddress;
        balance = await getBaseUsdcBalance(walletAddress);
      } else {
        // For Solana jobs, check Solana wallet balance
        walletAddress = wallet.address;
        balance = await getSolanaUsdcBalance(walletAddress);
      }

      console.log(
        `💰 [BALANCE CHECK] ${jobNetwork.toUpperCase()} wallet ${walletAddress}: $${balance.toFixed(6)} USDC (required: $${minRequired.toFixed(4)})`,
      );
      logger.info(
        `💰 [BALANCE CHECK] ${jobNetwork.toUpperCase()} balance: $${balance.toFixed(6)} USDC`,
      );

      if (balance < minRequired) {
        logger.warn(
          `⚠️ [BALANCE CHECK] INSUFFICIENT! $${balance.toFixed(6)} < $${minRequired.toFixed(4)} on ${jobNetwork.toUpperCase()} - will disable schedule`,
        );
        return {
          hasWallet: true,
          hasSufficientBalance: false,
          balance,
          wallet,
          requiredBalance: minRequired,
          jobNetwork,
        };
      }

      console.log(
        `✅ [BALANCE CHECK] Sufficient ${jobNetwork.toUpperCase()} balance ($${balance.toFixed(4)} >= $${minRequired.toFixed(4)}) - proceeding with job execution`,
      );
      logger.info(
        `✅ [BALANCE CHECK] Sufficient balance - proceeding with job execution`,
      );
      return {
        hasWallet: true,
        hasSufficientBalance: true,
        balance,
        wallet,
        requiredBalance: minRequired,
        jobNetwork,
      };
    });

    // If insufficient balance, disable schedule and notify user
    if (!balanceCheck.hasSufficientBalance) {
      const networkLabel = balanceCheck.jobNetwork?.toUpperCase() || "SOLANA";
      const requiredStr = balanceCheck.requiredBalance?.toFixed(4) || "0.05";
      const balanceStr = balanceCheck.balance.toFixed(4);

      console.log(
        `🛑 [LOW BALANCE] ${networkLabel} balance $${balanceStr} < required $${requiredStr}`,
      );
      logger.warn(
        `🛑 [LOW BALANCE] Entering low balance handler for job ${jobId} on ${networkLabel}`,
      );

      await step.run("disable-schedule-low-balance", async () => {
        logger.info(
          `📴 [LOW BALANCE] Disabling trigger_methods.schedule for job ${jobId}...`,
        );

        // Disable the schedule by updating trigger_methods
        const currentTriggerMethods =
          (job.trigger_methods as Record<string, unknown>) || {};
        const updatedTriggerMethods = {
          ...currentTriggerMethods,
          schedule: false,
        };

        const { error: updateError } = await supabase
          .from("x402_jobs")
          .update({
            trigger_methods: updatedTriggerMethods,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        if (updateError) {
          logger.error(
            `❌ [LOW BALANCE] Failed to disable schedule:`,
            updateError,
          );
        } else {
          logger.info(`✅ [LOW BALANCE] Schedule disabled for job ${jobId}`);

          // Broadcast schedule disabled event via WebSocket
          broadcastScheduleEvent(
            job.user_id,
            jobId,
            "schedule:disabled",
            `Insufficient ${networkLabel} USDC: $${balanceStr} (need $${requiredStr})`,
          );

          // Also broadcast job update for UI refresh
          broadcastToUser(job.user_id, {
            type: "job:updated",
            jobId,
            changes: { trigger_methods: updatedTriggerMethods },
          });
        }

        // Send notification to user
        logger.info(
          `📬 [LOW BALANCE] Sending notification to user ${job.user_id}...`,
        );
        try {
          const notification = await notifySchedulePausedLowBalance(
            job.user_id,
            jobId,
            job.name,
            balanceCheck.balance,
          );
          logger.info(
            `✅ [LOW BALANCE] Notification sent to user ${job.user_id}`,
          );

          // Broadcast notification via WebSocket for real-time update
          broadcastNotification(
            job.user_id,
            notification as unknown as Record<string, unknown>,
          );
        } catch (notifError) {
          logger.error(
            `❌ [LOW BALANCE] Failed to send notification:`,
            notifError,
          );
        }
      });

      logger.info(
        `🛑 [LOW BALANCE] Returning early - schedule paused, no next run scheduled`,
      );
      return {
        success: false,
        error: `Insufficient ${networkLabel} USDC: $${balanceStr} (need $${requiredStr}). Schedule has been paused.`,
        schedulePaused: true,
      };
    }

    if (!balanceCheck.wallet) {
      return { success: false, error: "No wallet found" };
    }

    // Execute the job
    const result = await step.run("execute-job", async () => {
      try {
        const wallet = balanceCheck.wallet!;

        // Parse workflow definition
        const workflowDef = job.workflow_definition;
        const nodes = workflowDef?.nodes || [];
        const edges = workflowDef?.edges || [];

        // Build steps array
        const resourceNodes = nodes.filter((n: any) => n.type === "resource");
        const transformNodes = nodes.filter((n: any) => n.type === "transform");
        const sourceNodes = nodes.filter((n: any) => n.type === "source");

        // Build dependency map
        const dependencyMap = new Map<string, string[]>();
        for (const edge of edges) {
          const deps = dependencyMap.get(edge.target) || [];
          deps.push(edge.source);
          dependencyMap.set(edge.target, deps);
        }

        // Build Inngest steps
        const inngestSteps = [
          ...resourceNodes.map((node: any) => {
            const resource = node.data.resource || node.data;
            const resourceMethod =
              resource.outputSchema?.input?.method || "POST";
            return {
              type: "resource" as const,
              nodeId: node.id,
              dependencies: dependencyMap.get(node.id) || [],
              data: {
                resourceId: resource.id,
                resourceUrl: resource.resourceUrl,
                resourceName: resource.name,
                resourcePrice: resource.price || 0,
                resourceNetwork: resource.network || "solana",
                resourceMethod: resourceMethod,
                nodeId: node.id,
                inputs: node.data.configuredInputs || {},
              },
            };
          }),
          ...transformNodes.map((node: any) => ({
            type: "transform" as const,
            nodeId: node.id,
            dependencies: dependencyMap.get(node.id) || [],
            data: {
              nodeId: node.id,
              transformType: node.data.transformType,
              sourceNodeId: node.data.sourceNodeId,
              config: node.data.config || {},
            },
          })),
          ...sourceNodes.map((node: any) => ({
            type: "source" as const,
            nodeId: node.id,
            dependencies: dependencyMap.get(node.id) || [],
            data: {
              nodeId: node.id,
              sourceType: node.data.sourceType,
              config: node.data.config || {},
            },
          })),
        ];

        if (inngestSteps.length === 0) {
          return { success: false, error: "No steps to execute" };
        }

        // Determine job network from resources
        const jobNetwork = resourceNodes.some((node: any) => {
          const resource = node.data.resource || node.data;
          return resource.network === "base";
        })
          ? "base"
          : "solana";

        // Create job run record
        const { data: run, error: runError } = await supabase
          .from("x402_job_runs")
          .insert({
            job_id: job.id,
            user_id: job.user_id,
            status: "pending",
            input: { _scheduledRun: true, _scheduledFor: scheduledFor },
          })
          .select()
          .single();

        if (runError || !run) {
          logger.error(
            `Failed to create run record for job ${job.id}:`,
            runError,
          );
          return {
            success: false,
            error: `Failed to create run record: ${runError?.message || "unknown"}`,
          };
        }

        // Record in scheduled_runs
        await supabase.from("x402_scheduled_runs").insert({
          job_id: job.id,
          job_run_id: run.id,
          scheduled_for: scheduledFor,
          cron_expression: job.schedule_cron,
          timezone: job.schedule_timezone || "UTC",
          status: "triggered",
          triggered_at: new Date().toISOString(),
        });

        // Trigger the workflow
        await inngest.send({
          name: "x402/workflow.run",
          data: {
            runId: run.id,
            jobId: job.id,
            userId: job.user_id,
            walletPublicKey: wallet.address,
            walletSecretKey: wallet.solanaSecretBase64,
            baseWalletAddress: wallet.baseAddress || null,
            baseWalletKey: wallet.baseSecretBase64 || null,
            jobNetwork: jobNetwork, // Network for platform fee
            steps: inngestSteps,
            triggeredBy: "schedule",
            workflowInputs: {
              _scheduledRun: true,
              _scheduledFor: scheduledFor,
            },
          },
        });

        return { success: true, runId: run.id };
      } catch (error) {
        logger.error(`Error executing scheduled job ${jobId}:`, error);
        return { success: false, error: String(error) };
      }
    });

    // Schedule the next run
    // IMPORTANT: Fetch fresh cron from DB, not cached job data!
    // When user changes schedule, old chains have stale cron cached.
    if (result.success) {
      await step.run("schedule-next-run", async () => {
        // Fetch CURRENT schedule settings from database
        // This ensures we use the updated cron if user changed it
        const { data: currentJob } = await supabase
          .from("x402_jobs")
          .select("schedule_cron, schedule_timezone, trigger_methods")
          .eq("id", job.id)
          .single();

        // If schedule was disabled or no cron, stop the chain
        const triggerMethods = currentJob?.trigger_methods as {
          schedule?: boolean;
        } | null;
        if (!triggerMethods?.schedule || !currentJob?.schedule_cron) {
          logger.info(
            `Schedule disabled or no cron for job ${jobId}, stopping chain`,
          );
          return;
        }

        const nextRun = getNextRunTime(
          currentJob.schedule_cron,
          currentJob.schedule_timezone || "UTC",
        );

        if (nextRun) {
          // Update job with next run time
          await supabase
            .from("x402_jobs")
            .update({
              schedule_last_run_at: new Date().toISOString(),
              schedule_next_run_at: nextRun.toISOString(),
            })
            .eq("id", job.id);

          // Broadcast to frontend via websocket
          broadcastToUser(job.user_id, {
            type: "schedule:updated",
            jobId: job.id,
            schedule_next_run_at: nextRun.toISOString(),
          });

          // Schedule the next run via Inngest
          await inngest.send({
            name: "x402/schedule.run",
            data: {
              jobId: job.id,
              scheduledFor: nextRun.toISOString(),
            },
          });

          logger.info(
            `Scheduled next run for job ${jobId}: ${nextRun.toISOString()} (cron: ${currentJob.schedule_cron})`,
          );
        }
      });
    }

    logger.info(`Scheduled job ${jobId} execution complete:`, result);
    return result;
  },
);

/**
 * Inngest function to initialize a schedule when enabled.
 * Calculates the first run time and sends the schedule.run event.
 */
export const initializeSchedule = inngest.createFunction(
  {
    id: "initialize-schedule",
    retries: 2,
    // Only allow ONE initialization per job at a time
    concurrency: {
      limit: 1,
      key: "event.data.jobId",
    },
  },
  { event: "x402/schedule.enabled" },
  async ({ event, step, logger }) => {
    const { jobId, cron, timezone } = event.data as {
      jobId: string;
      cron: string;
      timezone: string;
    };

    logger.info(`🗓️ [SCHEDULE] Initializing schedule for job ${jobId}`, {
      cron,
      timezone,
    });

    const supabase = getSupabase();

    await step.run("schedule-first-run", async () => {
      logger.info(
        `🗓️ [SCHEDULE] Calculating next run for cron: "${cron}" in timezone: ${timezone}`,
      );
      const nextRun = getNextRunTime(cron, timezone);

      if (!nextRun) {
        logger.error(
          `❌ [SCHEDULE] Failed to calculate next run for job ${jobId} with cron "${cron}" - is it a valid 5-field cron expression?`,
        );
        return { success: false, error: `Invalid cron expression: ${cron}` };
      }

      logger.info(
        `✅ [SCHEDULE] Next run calculated: ${nextRun.toISOString()}`,
      );

      // Update job with next run time and get user_id for broadcast
      const { data: job, error } = await supabase
        .from("x402_jobs")
        .update({
          schedule_next_run_at: nextRun.toISOString(),
        })
        .eq("id", jobId)
        .select("user_id")
        .single();

      if (error) {
        logger.error(`Failed to update next run for job ${jobId}:`, error);
        return { success: false };
      }

      // Broadcast to frontend via websocket
      if (job?.user_id) {
        broadcastToUser(job.user_id, {
          type: "schedule:updated",
          jobId,
          schedule_next_run_at: nextRun.toISOString(),
        });
      }

      // DEDUPLICATION: Check if there's already an active scheduled_run for this exact time
      // Only skip if there's a recent "triggered" record (within last few minutes)
      // This prevents multiple rapid saves from creating duplicate chains, but allows
      // re-enabling after the previous chain was disabled
      const { data: existingRecent } = await supabase
        .from("x402_scheduled_runs")
        .select("id, status, triggered_at")
        .eq("job_id", jobId)
        .eq("scheduled_for", nextRun.toISOString())
        .eq("status", "triggered")
        .gte("triggered_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Within last 5 mins
        .limit(1);

      if (existingRecent && existingRecent.length > 0) {
        logger.info(
          `🗓️ [SCHEDULE] Schedule recently triggered for ${nextRun.toISOString()}, not creating duplicate chain`,
        );
        return { success: true, nextRun: nextRun.toISOString(), skipped: true };
      }

      // Send the scheduled run event
      await inngest.send({
        name: "x402/schedule.run",
        data: {
          jobId,
          scheduledFor: nextRun.toISOString(),
        },
      });

      logger.info(
        `Initialized schedule for job ${jobId}, first run: ${nextRun.toISOString()}`,
      );
      return { success: true, nextRun: nextRun.toISOString() };
    });
  },
);
