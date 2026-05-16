/**
 * StepExecutor - Unified execution for workflow steps
 *
 * Wraps both resource and transform execution into a single interface.
 * This abstraction enables:
 * - Consistent step execution interface
 * - Easy parallel execution (just Promise.all on multiple executeStep calls)
 * - Centralized error handling
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkflowStep,
  WorkflowResource,
  WorkflowTransform,
  WorkflowSource,
  StepResult,
} from "./types";
import { resolveInputs } from "./InputResolver";
import { executeTransform } from "./TransformExecutor";
import { executeSource } from "./SourceExecutor";
import { executeX402Request } from "../utils/execute-x402";
import { notifyResourceOffline } from "../../services/notifications.service";

export interface StepExecutionContext {
  supabase: SupabaseClient;
  walletSecretKey: string;
  baseWalletKey?: string;
  outputs: Record<string, unknown>;
  workflowInputs: Record<string, unknown>;
  // For source execution
  currentJobId?: string;
  userId?: string;
}

/**
 * Look up resource ID by URL if not already set
 */
async function ensureResourceId(
  resource: WorkflowResource,
  ctx: StepExecutionContext,
): Promise<string | undefined> {
  // If we already have a resourceId, use it
  if (resource.resourceId) {
    return resource.resourceId;
  }

  // Try to look up by URL
  if (resource.resourceUrl) {
    const { data } = await ctx.supabase
      .from("x402_resources")
      .select("id")
      .eq("resource_url", resource.resourceUrl)
      .eq("is_active", true)
      .maybeSingle();

    if (data?.id) {
      console.log(
        `   📍 Resolved resource ID ${data.id} from URL ${resource.resourceUrl}`,
      );
      return data.id;
    }
  }

  return undefined;
}

/**
 * Execute a resource step (X402 API call)
 */
async function executeResourceStep(
  resource: WorkflowResource,
  ctx: StepExecutionContext,
): Promise<StepResult> {
  const method = resource.resourceMethod || "POST";
  const url = resource.resourceUrl;

  // Ensure we have a resource ID for stats tracking
  const resourceId = await ensureResourceId(resource, ctx);

  // Resolve inputs from previous outputs
  const { resolved: resolvedInputs, consumedWorkflowInputs } = resolveInputs(
    resource.inputs,
    {
      outputs: ctx.outputs,
      workflowInputs: ctx.workflowInputs,
    },
  );

  // Auto-pass workflow inputs that aren't already configured AND weren't consumed
  // This allows workflow inputs to flow through to resources with matching input names
  // But skips inputs that were already mapped (e.g., "message" → "body")
  for (const [key, value] of Object.entries(ctx.workflowInputs)) {
    if (
      !(key in resolvedInputs) &&
      !consumedWorkflowInputs.has(key) && // Don't auto-pass inputs that were mapped to other fields
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      console.log(`   ℹ️ Auto-passing workflow input "${key}" to resource`);
      resolvedInputs[key] = value;
    }
  }

  console.log(`🚀 Executing resource: ${resource.resourceName}`);
  console.log(
    `   Inputs:`,
    JSON.stringify(resolvedInputs, null, 2)?.substring(0, 1000),
  );

  try {
    // Execute the X402 request
    const executeResult = await executeX402Request({
      walletSecretKey: ctx.walletSecretKey,
      baseWalletKey: ctx.baseWalletKey,
      resourceUrl: url,
      method,
      body: resolvedInputs,
      expectedNetwork: resource.resourceNetwork,
    });

    console.log(`   ✅ Success!`);

    // Use actual amount paid from X402 response (may differ from stored price)
    const actualAmountPaid = executeResult.amountPaid ?? resource.resourcePrice;

    // If actual price differs from stored, update the resource
    if (actualAmountPaid !== resource.resourcePrice && resourceId) {
      console.log(
        `   ⚠️ Price mismatch: stored $${resource.resourcePrice}, actual $${actualAmountPaid}`,
      );
      await ctx.supabase
        .from("x402_resources")
        .update({ price: actualAmountPaid })
        .eq("id", resourceId);
    }

    // Resource responded successfully - mark as healthy and increment stats
    if (resourceId) {
      // Get current stats to increment
      const { data: currentResource } = await ctx.supabase
        .from("x402_resources")
        .select("call_count, total_earned_usdc, success_count_30d")
        .eq("id", resourceId)
        .single();

      await ctx.supabase
        .from("x402_resources")
        .update({
          health_status: "healthy",
          health_failure_count: 0,
          last_health_check_at: new Date().toISOString(),
          last_called_at: new Date().toISOString(),
          // Increment call count and earnings
          call_count: (currentResource?.call_count || 0) + 1,
          total_earned_usdc:
            (currentResource?.total_earned_usdc || 0) + actualAmountPaid,
          // Increment success count for 30-day rolling stats
          success_count_30d: (currentResource?.success_count_30d || 0) + 1,
        })
        .eq("id", resourceId);
    }

    return {
      success: true,
      nodeId: resource.nodeId,
      output: executeResult.response,
      paid: actualAmountPaid,
      paymentSignature: executeResult.paymentSignature,
      resolvedInputs,
      httpRequest: { method, url, body: resolvedInputs },
      httpResponse: { body: executeResult.response },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Resource error: ${errorMessage}`);
    console.log(`   ResourceId: ${resourceId || resource.resourceId}`);

    // Increment call_count and failure_count on failure
    if (resourceId) {
      const { data: currentResource } = await ctx.supabase
        .from("x402_resources")
        .select("call_count, failure_count_30d")
        .eq("id", resourceId)
        .single();

      await ctx.supabase
        .from("x402_resources")
        .update({
          call_count: (currentResource?.call_count || 0) + 1,
          last_called_at: new Date().toISOString(),
          // Increment failure count for 30-day rolling stats
          failure_count_30d: (currentResource?.failure_count_30d || 0) + 1,
        })
        .eq("id", resourceId);
    }

    // Check if this is a 404 error - mark resource as offline and notify owner
    const is404 =
      errorMessage.includes("status 404") || errorMessage.includes("404");
    console.log(`   Is 404: ${is404}`);
    if (is404 && resourceId) {
      console.log(`   ⚠️ Resource returned 404 - marking as offline`);

      // First check if resource is already offline (to avoid duplicate notifications)
      const { data: existingResource } = await ctx.supabase
        .from("x402_resources")
        .select(
          "health_status, registered_by, name, resource_url, server:x402_servers(slug)",
        )
        .eq("id", resourceId)
        .single();

      const wasAlreadyOffline = existingResource?.health_status === "offline";

      // Mark as offline
      await ctx.supabase
        .from("x402_resources")
        .update({
          health_status: "offline",
          health_offline_at: new Date().toISOString(),
          last_health_check_at: new Date().toISOString(),
        })
        .eq("id", resourceId);

      // Notify owner only if this is the first time going offline
      if (!wasAlreadyOffline && existingResource?.registered_by) {
        try {
          const serverSlug = (
            existingResource.server as { slug?: string } | null
          )?.slug;
          await notifyResourceOffline(
            existingResource.registered_by,
            resourceId,
            existingResource.name || resource.resourceName,
            existingResource.resource_url || resource.resourceUrl,
            serverSlug,
          );
          console.log(`   📧 Notified resource owner about 404`);
        } catch (notifyError) {
          console.error(`   ⚠️ Failed to notify resource owner:`, notifyError);
        }
      }
    }

    return {
      success: false,
      nodeId: resource.nodeId,
      error: errorMessage,
      resolvedInputs,
      httpRequest: { method, url, body: resolvedInputs },
    };
  }
}

/**
 * Execute a transform step (data transformation)
 */
async function executeTransformStep(
  transform: WorkflowTransform,
  ctx: StepExecutionContext,
  dependencies?: string[],
): Promise<StepResult> {
  // If transform doesn't have sourceNodeId set, use the first dependency
  // This ensures transforms get input from their connected upstream node
  const transformWithSource: WorkflowTransform = {
    ...transform,
    sourceNodeId: transform.sourceNodeId || (dependencies && dependencies[0]),
  };

  const transformResult = await executeTransform(transformWithSource, {
    outputs: ctx.outputs,
  });

  if (!transformResult.success) {
    return {
      success: false,
      nodeId: transform.nodeId,
      error: transformResult.error || "Transform failed",
    };
  }

  return {
    success: true,
    nodeId: transform.nodeId,
    output: transformResult.output,
    paid: 0,
  };
}

/**
 * Execute a single workflow step
 *
 * @param step - The workflow step to execute
 * @param ctx - Execution context with wallet, supabase, and previous outputs
 * @returns Step execution result
 */
export async function executeStep(
  step: WorkflowStep,
  ctx: StepExecutionContext,
): Promise<StepResult> {
  try {
    if (step.type === "resource") {
      return await executeResourceStep(step.data as WorkflowResource, ctx);
    } else if (step.type === "source") {
      // Source steps are FREE and don't require payment
      if (!ctx.currentJobId || !ctx.userId) {
        return {
          success: false,
          nodeId: step.nodeId,
          error: "Source execution requires currentJobId and userId in context",
        };
      }
      return await executeSource(step.data as WorkflowSource, {
        supabase: ctx.supabase,
        currentJobId: ctx.currentJobId,
        userId: ctx.userId,
        outputs: ctx.outputs,
        workflowInputs: ctx.workflowInputs,
      });
    } else {
      return await executeTransformStep(
        step.data as WorkflowTransform,
        ctx,
        step.dependencies,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Step failed: ${errorMessage}`);
    return {
      success: false,
      nodeId: step.nodeId,
      error: errorMessage,
    };
  }
}

/**
 * Execute multiple steps in parallel
 *
 * @param steps - Array of steps to execute concurrently
 * @param ctx - Execution context
 * @returns Array of step results
 */
export async function executeStepsParallel(
  steps: WorkflowStep[],
  ctx: StepExecutionContext,
): Promise<StepResult[]> {
  console.log(`\n⚡ Executing ${steps.length} steps in parallel...`);
  const results = await Promise.all(
    steps.map((step) => executeStep(step, ctx)),
  );
  return results;
}
