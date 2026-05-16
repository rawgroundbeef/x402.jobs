import { inngest } from "../../lib/inngest";
import { config } from "../../config";
import { chargePlatformFee } from "../utils/charge-platform-fee";
import type {
  WorkflowStep,
  WorkflowResource,
  WorkflowTransform,
  WorkflowSource,
} from "../workflow/types";
import { executeStep } from "../workflow/StepExecutor";
import { getSupabase } from "../../lib/supabase";
import { broadcastRunEvent, broadcastNotification } from "../../lib/websocket";
import { notifyLoopStoppedJobFailed } from "../../services/notifications.service";
import { postToDestinations } from "./run-workflow/post-to-destinations";
import { createEscrowRecord } from "./run-workflow/escrow";
import { EscrowRepository } from "../../repositories/EscrowRepository";
import { validateResourcesReachable } from "./run-workflow/preflight";
import { triggerChainedJob } from "./run-workflow/chain";
import { ChainRepository } from "../../repositories/ChainRepository";
import { executeWorkflowStep } from "./run-workflow/execute-step";
import { StepExecutionRepository } from "../../repositories/StepExecutionRepository";

/**
 * Inngest function to execute a workflow run
 */
export const runWorkflow = inngest.createFunction(
  {
    id: "run-workflow",
    name: "Execute X402 Workflow Run",
    retries: 0,
    // Limit concurrent workflow executions
    // Pro plan: set to 50
    concurrency: {
      limit: 50,
    },
  },
  { event: "x402/workflow.run" },
  async ({ event, step }) => {
    const {
      runId,
      jobId,
      userId,
      walletSecretKey,
      baseWalletKey,
      jobNetwork: providedJobNetwork,
      resources,
      steps,
      workflowInputs,
    } = event.data as {
      runId: string;
      jobId: string;
      userId: string;
      walletSecretKey: string;
      baseWalletKey?: string; // Optional Base wallet for Base network resources
      jobNetwork?: "solana" | "base"; // Network for platform fee (from webhook)
      resources?: WorkflowResource[]; // Legacy: just resources
      steps?: WorkflowStep[]; // New: unified steps array
      workflowInputs?: Record<string, unknown>; // Top-level inputs from trigger
    };
    const supabase = getSupabase();

    // Build unified steps array - support both old and new format
    const workflowSteps: WorkflowStep[] =
      steps ||
      (resources || []).map((r) => ({
        type: "resource" as const,
        nodeId: r.nodeId,
        data: r,
      }));

    // Count resources only (for cost tracking)
    const resourceSteps = workflowSteps.filter((s) => s.type === "resource");

    // Use provided job network, or determine from resources
    // If any resource is on Base, we consider it a Base job
    const jobNetwork: "solana" | "base" =
      providedJobNetwork ||
      (resourceSteps.some((s) => {
        const r = s.data as WorkflowResource;
        const net = r.resourceNetwork?.toLowerCase();
        return net === "base" || net === "base-mainnet";
      })
        ? "base"
        : "solana");

    // Calculate total resource cost for platform fee calculation
    const resourceCost = resourceSteps.reduce((sum, s) => {
      const r = s.data as WorkflowResource;
      return sum + (r.resourcePrice || 0);
    }, 0);

    // Step 0: Charge platform fee (before any resource execution)
    let platformFeePaid = 0;

    const feeResult = await step.run("charge-platform-fee", async () => {
      const result = await chargePlatformFee({
        solanaSecretKey: walletSecretKey,
        baseSecretKey: baseWalletKey,
        network: jobNetwork as "solana" | "base",
        resourceCost,
      });
      if (!result.success) {
        // Update run as failed
        await supabase
          .from("x402_job_runs")
          .update({
            status: "failed",
            error: `Platform fee payment failed: ${result.error}`,
            completed_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", runId);

        // Broadcast failure so frontend updates
        if (userId) {
          broadcastRunEvent(userId, runId, jobId, "run:completed", {
            status: "failed",
            error: `Platform fee payment failed: ${result.error}`,
          });
        }

        throw new Error(`Platform fee payment failed: ${result.error}`);
      }
      return result;
    });

    platformFeePaid = feeResult.amountPaid || 0;

    // Log platform fee as an event (if charged)
    if (platformFeePaid > 0) {
      await step.run("log-platform-fee", async () => {
        // Get the actual platform fee endpoint URL
        const platformFeeUrl =
          jobNetwork === "base"
            ? config.platformFee.resourceUrl.replace("/solana/", "/base/")
            : config.platformFee.resourceUrl;

        await supabase.from("x402_job_run_events").insert({
          run_id: runId,
          resource_id: null,
          resource_url: platformFeeUrl,
          resource_name: "Platform Fee",
          resource_price: platformFeePaid,
          amount_paid: platformFeePaid,
          network: jobNetwork,
          sequence: -1, // Before all other steps
          status: "completed",
          inputs: { resourceCost },
          node_id: "platform-fee",
          output: {
            transactionSignature: feeResult.transactionSignature,
            amountPaid: platformFeePaid,
            network: jobNetwork,
            feePercentage: `${(config.platformFee.percentage * 100).toFixed(1)}%`,
          },
          completed_at: new Date().toISOString(),
        });
        console.log(`📝 Logged platform fee: $${platformFeePaid.toFixed(4)}`);
      });
    }

    // Compute topological order for sequence numbers
    // This ensures events are numbered by execution order, not array order
    const topoOrder = new Map<string, number>();
    const visited = new Set<string>();
    const visiting = new Set<string>();
    let order = 0;

    function topoSort(nodeId: string) {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) return; // Cycle detected, skip
      visiting.add(nodeId);

      const step = workflowSteps.find((s) => s.nodeId === nodeId);
      const deps = step?.dependencies || [];
      for (const dep of deps) {
        topoSort(dep);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      topoOrder.set(nodeId, order++);
    }

    // Sort all steps topologically
    for (const s of workflowSteps) {
      topoSort(s.nodeId);
    }

    // Step 1: Mark run as running and create event records
    await step.run("initialize-run", async () => {
      // Mark run as running
      await supabase
        .from("x402_job_runs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          resources_total: resourceSteps.length,
        } as Record<string, unknown>)
        .eq("id", runId);

      // Pre-resolve resourceIds by URL for resources that don't have one
      // This ensures events have proper resource_id for aggregation
      const urlsToResolve = resourceSteps
        .map((s) => s.data as WorkflowResource)
        .filter(
          (r) =>
            !r.resourceId &&
            r.resourceUrl &&
            !r.resourceUrl.includes("/webhooks/"),
        )
        .map((r) => r.resourceUrl);

      const resolvedIds = new Map<string, string>();
      if (urlsToResolve.length > 0) {
        // Normalize URLs by stripping protocol for lookup
        const normalizedUrls = urlsToResolve.map((url) =>
          url.replace(/^https?:\/\//, ""),
        );
        const normalizedToOriginal = new Map<string, string>();
        for (let i = 0; i < urlsToResolve.length; i++) {
          const original = urlsToResolve[i];
          const normalized = normalizedUrls[i];
          if (original && normalized) {
            normalizedToOriginal.set(normalized, original);
          }
        }

        // Look up by normalized_url for accurate matching
        const { data: matchedResources } = await supabase
          .from("x402_resources")
          .select("id, normalized_url")
          .in("normalized_url", normalizedUrls)
          .eq("is_active", true);

        for (const res of matchedResources || []) {
          if (res.normalized_url) {
            // Map back to original URL for the resolvedIds map
            const originalUrl = normalizedToOriginal.get(res.normalized_url);
            if (originalUrl) {
              resolvedIds.set(originalUrl, res.id);
            }
          }
        }
        if (resolvedIds.size > 0) {
          console.log(
            `📍 Resolved ${resolvedIds.size} resource IDs by URL for events`,
          );
        }
      }

      // Create event records for all steps with topologically-sorted sequence numbers
      const events = workflowSteps.map((s) => {
        const sequence = topoOrder.get(s.nodeId) ?? 0;

        if (s.type === "resource") {
          const r = s.data as WorkflowResource;
          // Check if this is a job webhook (resourceId is a job ID, not a resource ID)
          // Job webhook URLs contain "/webhooks/" - they reference x402_jobs not x402_resources
          const isJobWebhook = r.resourceUrl?.includes("/webhooks/");
          // Use stored resourceId, or resolved ID from URL lookup
          const resourceId = isJobWebhook
            ? null
            : r.resourceId || resolvedIds.get(r.resourceUrl) || null;
          return {
            run_id: runId,
            resource_id: resourceId,
            resource_url: r.resourceUrl,
            resource_name: r.resourceName,
            resource_price: r.resourcePrice,
            network: r.resourceNetwork || "solana",
            sequence,
            status: "pending",
            inputs: r.inputs,
            node_id: r.nodeId,
          };
        } else if (s.type === "source") {
          // Source step - FREE data input, no payment required
          const src = s.data as WorkflowSource;
          const sourceTypeLabels: Record<string, string> = {
            job_history: "Job History",
            url_fetch: "URL Fetch",
          };
          return {
            run_id: runId,
            resource_id: null,
            resource_url: `source://${src.sourceType}`,
            resource_name: `Source (${sourceTypeLabels[src.sourceType] || src.sourceType})`,
            resource_price: 0, // Sources are FREE
            network: "solana", // Sources don't use network but need a value
            sequence,
            status: "pending",
            inputs: src.config || {},
            node_id: src.nodeId,
          };
        } else {
          // Transform step - create a minimal event record
          const t = s.data as WorkflowTransform;
          return {
            run_id: runId,
            resource_id: null,
            resource_url: `transform://${t.transformType}`, // Required NOT NULL
            resource_name: `Transform (${t.transformType})`,
            resource_price: 0,
            network: "solana", // Transforms don't use network but need a value
            sequence,
            status: "pending",
            inputs: {},
            node_id: t.nodeId,
          };
        }
      });

      console.log(
        `📝 Creating ${events.length} event records for run ${runId}`,
      );
      // Only insert if there are events (empty insert can fail)
      if (events.length > 0) {
        const { error: insertError } = await supabase
          .from("x402_job_run_events")
          .insert(events);
        if (insertError) {
          console.error("❌ Failed to create event records:", insertError);
          throw new Error(
            `Failed to create event records: ${insertError.message}`,
          );
        }
        console.log(`✅ Created ${events.length} event records`);
      } else {
        console.log(`ℹ️ No steps in workflow, skipping event creation`);
      }

      // Broadcast run started event via WebSocket
      if (userId) {
        broadcastRunEvent(userId, runId, jobId, "run:started", {
          totalSteps: workflowSteps.length,
        });
      }
    });

    // Step 1.5: Pre-flight validation (if enabled)
    // Check that all resources are reachable before executing anything
    if (config.smartRefunds.enabled && config.smartRefunds.preflightEnabled) {
      await step.run("preflight-validation", async () => {
        console.log(
          `🔍 Running pre-flight validation for ${resourceSteps.length} resources...`,
        );

        const resources = resourceSteps.map((s) => {
          const r = s.data as WorkflowResource;
          return { resourceUrl: r.resourceUrl, resourceName: r.resourceName };
        });

        const preflightResult = await validateResourcesReachable(
          resources,
          config.smartRefunds.preflightTimeoutMs,
        );

        if (!preflightResult.success) {
          const errorMsg = `Pre-flight failed: ${preflightResult.unreachable.length} resource(s) unreachable: ${preflightResult.unreachable.join(", ")}`;
          console.log(`❌ ${errorMsg}`);

          // Mark run as failed
          await supabase
            .from("x402_job_runs")
            .update({
              status: "failed",
              error: errorMsg,
              completed_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq("id", runId);

          // Broadcast failure
          if (userId) {
            broadcastRunEvent(userId, runId, jobId, "run:completed", {
              status: "failed",
              error: errorMsg,
            });
          }

          throw new Error(errorMsg);
        }

        console.log(
          `✅ Pre-flight validation passed for ${resourceSteps.length} resources`,
        );
      });
    }

    // Step 2: Execute each step sequentially
    // Store outputs from each node to pass to the next
    // Initialize with workflow inputs so resources can reference trigger inputs
    const outputs: Record<string, unknown> = {};

    // Make workflow inputs available for reference by any trigger node ID
    // The frontend stores trigger nodes with IDs like "trigger-..." or just "trigger"
    if (workflowInputs && Object.keys(workflowInputs).length > 0) {
      // Store workflow inputs under a special key that matches trigger node references
      // This allows resources to link to "Trigger Inputs" in the UI
      outputs["trigger"] = workflowInputs;
      // Also store under any trigger-prefixed ID to catch different naming conventions
      for (const key of Object.keys(workflowInputs)) {
        // Make each workflow input accessible at the top level too
        outputs[`_trigger.${key}`] = workflowInputs[key];
      }
      console.log(
        `📥 Workflow inputs available: ${Object.keys(workflowInputs).join(", ")}`,
      );
    }

    let completedCount = 0;
    let failedCount = 0;
    let totalPaid = 0;

    // Build nodeId -> sequence map for event record lookup (uses topological order)
    const nodeIdToIndex = new Map<string, number>();
    workflowSteps.forEach((s) => {
      nodeIdToIndex.set(s.nodeId, topoOrder.get(s.nodeId) ?? 0);
    });

    // Build nodeId -> WorkflowStep map for quick lookup
    const stepsByNodeId = new Map<string, WorkflowStep>();
    workflowSteps.forEach((s) => {
      stepsByNodeId.set(s.nodeId, s);
    });

    // Create step execution repository
    const stepExecutionRepository = new StepExecutionRepository(supabase);

    // Helper function to execute a single step (wraps the modular function)
    const runWorkflowStep = async (
      workflowStep: WorkflowStep,
      stepIndex: number,
    ) => {
      return executeWorkflowStep(workflowStep, stepIndex, {
        repository: stepExecutionRepository,
        stepExecutor: executeStep,
        supabase,
        broadcastRunEvent,
        runId,
        userId,
        jobId,
        walletSecretKey,
        baseWalletKey,
        outputs,
        workflowInputs: workflowInputs || {},
      });
    };

    // Parallel execution loop using DB as source of truth
    // Inngest replays from scratch on step completion, so we query DB each iteration
    let iterationCount = 0;
    const maxIterations = 1000; // Safety limit

    while (iterationCount < maxIterations) {
      iterationCount++;

      // Check for cancellation
      const { data: runStatus } = await supabase
        .from("x402_job_runs")
        .select("status")
        .eq("id", runId)
        .single();

      if (runStatus?.status === "cancelled") {
        console.log(`🛑 Run ${runId} cancelled`);
        return;
      }

      // Query DB for current status of ALL steps
      const { data: eventRecords } = await supabase
        .from("x402_job_run_events")
        .select("node_id, status, output, amount_paid")
        .eq("run_id", runId);

      const statusByNodeId = new Map<
        string,
        { status: string; output: unknown; paid: number }
      >();
      for (const event of eventRecords || []) {
        statusByNodeId.set(event.node_id, {
          status: event.status,
          output: event.output,
          paid: event.amount_paid || 0,
        });
      }

      // Categorize steps based on DB status
      const completedNodeIds = new Set<string>();
      const failedNodeIds = new Set<string>();
      const runningNodeIds = new Set<string>();
      const pendingNodeIds = new Set<string>();

      for (const ws of workflowSteps) {
        const record = statusByNodeId.get(ws.nodeId);
        const status = record?.status || "pending";

        if (status === "completed") {
          completedNodeIds.add(ws.nodeId);
          // Populate outputs from DB for completed steps
          if (record?.output !== undefined) {
            outputs[ws.nodeId] = record.output;
          }
        } else if (status === "failed") {
          failedNodeIds.add(ws.nodeId);
        } else if (status === "running") {
          runningNodeIds.add(ws.nodeId);
        } else {
          pendingNodeIds.add(ws.nodeId);
        }
      }

      // Check if we're done
      if (pendingNodeIds.size === 0 && runningNodeIds.size === 0) {
        // All done!
        completedCount = completedNodeIds.size;
        failedCount = failedNodeIds.size;

        // Calculate total paid from DB
        for (const ws of workflowSteps) {
          if (ws.type === "resource") {
            const record = statusByNodeId.get(ws.nodeId);
            totalPaid += record?.paid || 0;
          }
        }

        console.log(
          `✅ All steps processed: ${completedCount} completed, ${failedCount} failed`,
        );
        break;
      }

      // Mark blocked steps (dependency failed)
      for (const ws of workflowSteps) {
        if (!pendingNodeIds.has(ws.nodeId)) continue;
        const deps = ws.dependencies || [];
        const hasFailedDep = deps.some((depId) => failedNodeIds.has(depId));

        if (hasFailedDep) {
          console.log(`⏭️ Skipping ${ws.nodeId} - dependency failed`);
          const stepIndex = nodeIdToIndex.get(ws.nodeId);
          if (stepIndex !== undefined) {
            await supabase
              .from("x402_job_run_events")
              .update({
                status: "failed",
                error: "Skipped - upstream dependency failed",
                completed_at: new Date().toISOString(),
              } as Record<string, unknown>)
              .eq("run_id", runId)
              .eq("sequence", stepIndex);
          }
          failedNodeIds.add(ws.nodeId);
          pendingNodeIds.delete(ws.nodeId);
        }
      }

      // Find ready steps (pending with all deps completed, not already running)
      // Note: Trigger nodes (starting with "trigger") are always considered "completed"
      // since they represent the entry point and are not actual workflow steps
      const isDepCompleted = (depId: string) =>
        completedNodeIds.has(depId) || depId.startsWith("trigger");

      const readySteps = workflowSteps.filter((ws) => {
        if (!pendingNodeIds.has(ws.nodeId)) return false;
        const deps = ws.dependencies || [];
        return deps.every(isDepCompleted);
      });

      if (readySteps.length > 0) {
        console.log(
          `🚀 Starting ${readySteps.length} step(s): ${readySteps.map((s) => s.nodeId).join(", ")}`,
        );

        // Execute ready steps in parallel
        await Promise.all(
          readySteps.map((ws) => {
            const stepIndex = nodeIdToIndex.get(ws.nodeId);
            return step.run(`execute-step-${ws.nodeId}`, async () => {
              if (stepIndex === undefined) {
                return {
                  success: false,
                  error: "Step index not found",
                  nodeId: ws.nodeId,
                };
              }
              return runWorkflowStep(ws, stepIndex);
            });
          }),
        );
        continue;
      }

      // No ready steps, but some are still running - poll
      if (runningNodeIds.size > 0) {
        console.log(
          `⏳ Waiting for ${runningNodeIds.size} running step(s): ${Array.from(runningNodeIds).join(", ")}`,
        );
        await step.sleep(`poll-running-${iterationCount}`, "2s");
        continue;
      }

      // No ready steps and nothing running - we're stuck
      if (pendingNodeIds.size > 0) {
        console.error(
          `⚠️ Deadlock: ${pendingNodeIds.size} pending but none ready or running`,
        );
        // Mark remaining as failed
        for (const nodeId of pendingNodeIds) {
          const stepIndex = nodeIdToIndex.get(nodeId);
          if (stepIndex !== undefined) {
            await supabase
              .from("x402_job_run_events")
              .update({
                status: "failed",
                error: "Deadlock - dependencies not met",
                completed_at: new Date().toISOString(),
              } as Record<string, unknown>)
              .eq("run_id", runId)
              .eq("sequence", stepIndex);
          }
        }
      }
      break;
    }

    // Step 3: Mark run as completed
    await step.run("complete-run", async () => {
      // Query DB directly (outer variables may be stale due to Inngest memoization)
      const { data: eventCounts } = await supabase
        .from("x402_job_run_events")
        .select("status, error")
        .eq("run_id", runId);

      const dbCompletedCount =
        eventCounts?.filter((e) => e.status === "completed").length || 0;
      const dbFailedCount =
        eventCounts?.filter((e) => e.status === "failed").length || 0;

      // Get error message from first failed event (if any)
      const failedEvent = eventCounts?.find((e) => e.status === "failed");
      const errorMessage = failedEvent?.error || null;

      // Calculate total paid from events
      const { data: paidEvents } = await supabase
        .from("x402_job_run_events")
        .select("amount_paid")
        .eq("run_id", runId)
        .eq("status", "completed");

      const dbTotalPaid =
        paidEvents?.reduce((sum, e) => sum + (e.amount_paid || 0), 0) || 0;

      const finalStatus = dbFailedCount > 0 ? "failed" : "success";
      // dbTotalPaid now includes platform fee (logged as event), no need to add again
      const totalCostWithFee = dbTotalPaid;

      console.log(
        `🏁 Completing run ${runId}: ${dbCompletedCount} succeeded, ${dbFailedCount} failed`,
      );
      console.log(
        `   Total cost: $${totalCostWithFee.toFixed(2)} (resources: $${dbTotalPaid.toFixed(2)}, platform fee: $${platformFeePaid.toFixed(2)})`,
      );
      console.log(`   Setting status to: ${finalStatus}`);
      if (errorMessage) {
        console.log(`   Error: ${errorMessage}`);
      }

      const { error } = await supabase
        .from("x402_job_runs")
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          total_cost: totalCostWithFee,
          resources_completed: dbCompletedCount,
          resources_failed: dbFailedCount,
          ...(errorMessage ? { error: errorMessage } : {}),
        } as Record<string, unknown>)
        .eq("id", runId);

      if (error) {
        console.error(`❌ Failed to update run status:`, error);
        throw error;
      }

      console.log(`   ✅ Run marked as ${finalStatus}`);

      // Broadcast run completed via WebSocket
      if (userId) {
        broadcastRunEvent(userId, runId, jobId, "run:completed", {
          status: finalStatus,
          totalCost: totalCostWithFee,
          completedCount: dbCompletedCount,
          failedCount: dbFailedCount,
          ...(errorMessage ? { error: errorMessage } : {}),
        });
      }
    });

    // Step 3.5: Create escrow payout/refund record for x402 runs
    const escrowRepository = new EscrowRepository(supabase);
    await step.run("create-escrow-record", () =>
      createEscrowRecord({
        repository: escrowRepository,
        runId,
        jobId,
        userId,
        smartRefundsEnabled: config.smartRefunds.enabled,
      }),
    );

    // Step 4: Post to external destinations (Telegram, X, x402.storage) if configured
    await step.run("post-to-destinations", () =>
      postToDestinations({
        supabase,
        runId,
        jobId,
        outputs,
        twitterConfig: config.twitter,
        walletSecretKey,
        baseWalletKey,
        jobNetwork,
        userId,
        broadcastRunEvent,
      }),
    );

    // Step 4.5: Update final total cost (includes x402.storage if used)
    await step.run("update-final-cost", async () => {
      // Re-query all completed events to get accurate total including x402.storage
      const { data: allPaidEvents } = await supabase
        .from("x402_job_run_events")
        .select("amount_paid")
        .eq("run_id", runId)
        .eq("status", "completed");

      const finalTotalCost =
        allPaidEvents?.reduce((sum, e) => sum + (e.amount_paid || 0), 0) || 0;

      await supabase
        .from("x402_job_runs")
        .update({ total_cost: finalTotalCost } as Record<string, unknown>)
        .eq("id", runId);

      console.log(`💰 Final total cost: $${finalTotalCost.toFixed(4)}`);
    });

    // Step 5: Trigger chained job if configured (on success only)
    const chainRepository = new ChainRepository(supabase);
    await step.run("trigger-chained-job", () =>
      triggerChainedJob({
        repository: chainRepository,
        inngestSend: (event) => inngest.send(event),
        broadcastRunEvent: userId ? broadcastRunEvent : undefined,
        notifyLoopFailed: notifyLoopStoppedJobFailed,
        broadcastNotification,
        jobId,
        runId,
        userId,
      }),
    );

    return {
      runId,
      completed: completedCount,
      failed: failedCount,
      totalPaid,
    };
  },
);
