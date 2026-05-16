/**
 * SourceExecutor - Executes source nodes (free data inputs)
 *
 * Sources are platform-native data inputs that are FREE to execute.
 * They pull data into workflows without any X402 payment.
 *
 * Supported source types:
 * - job_history: Access outputs from previous job runs
 * - url_fetch: GET any public URL
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowSource, StepResult } from "./types";

export interface SourceExecutionContext {
  supabase: SupabaseClient;
  currentJobId: string;
  userId: string;
  outputs: Record<string, unknown>;
  workflowInputs: Record<string, unknown>;
}

/**
 * Calculate the date threshold for "since" parameter
 */
function calculateSinceDate(since: string): string {
  const now = new Date();
  switch (since) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
    default:
      return new Date(0).toISOString(); // Beginning of time
  }
}

/**
 * Execute a job_history source
 */
async function executeJobHistory(
  source: WorkflowSource,
  ctx: SourceExecutionContext,
): Promise<StepResult> {
  const config = source.config;

  // Resolve "self" to current job ID
  const targetJobId = config.jobId === "self" ? ctx.currentJobId : config.jobId;

  if (!targetJobId) {
    return {
      success: false,
      nodeId: source.nodeId,
      error: "No job ID specified for job_history source",
    };
  }

  console.log(`📚 Fetching job history for job: ${targetJobId}`);

  // Access control: verify user can access this job's history
  // Public jobs (with webhooks) → anyone can pull history
  // Unlisted jobs → only owner can access
  const { data: job, error: jobError } = await ctx.supabase
    .from("x402_jobs")
    .select("id, user_id, published, webhook_url")
    .eq("id", targetJobId)
    .single();

  if (jobError || !job) {
    return {
      success: false,
      nodeId: source.nodeId,
      error: `Job not found: ${targetJobId}`,
    };
  }

  // Check access: unlisted jobs (published === false) can only be accessed by owner
  const isPublic = job.published !== false && job.webhook_url;
  const isOwner = job.user_id === ctx.userId;

  if (!isPublic && !isOwner) {
    return {
      success: false,
      nodeId: source.nodeId,
      error: "Cannot access history of unlisted job",
    };
  }

  // Build the query for job runs
  let query = ctx.supabase
    .from("x402_job_runs")
    .select("id, output, created_at")
    .eq("job_id", targetJobId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(config.limit || 100);

  // Apply time filter if specified
  if (config.since && config.since !== "all") {
    const sinceDate = calculateSinceDate(config.since);
    query = query.gte("created_at", sinceDate);
  }

  const { data: runs, error: runsError } = await query;

  if (runsError) {
    return {
      success: false,
      nodeId: source.nodeId,
      error: `Failed to fetch job history: ${runsError.message}`,
    };
  }

  const output = (runs || []).map((run) => ({
    runId: run.id,
    timestamp: run.created_at,
    output: run.output,
  }));

  console.log(`   ✅ Retrieved ${output.length} historical runs`);

  return {
    success: true,
    nodeId: source.nodeId,
    output,
    paid: 0, // Sources are FREE
  };
}

/**
 * Execute a url_fetch source
 */
async function executeUrlFetch(
  source: WorkflowSource,
  ctx: SourceExecutionContext,
): Promise<StepResult> {
  const config = source.config;

  if (!config.url) {
    return {
      success: false,
      nodeId: source.nodeId,
      error: "No URL specified for url_fetch source",
    };
  }

  // Resolve template variables in URL (e.g., {{trigger.field}})
  let resolvedUrl = config.url;
  const templateRegex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = templateRegex.exec(config.url)) !== null) {
    const path = match[1]?.trim();
    if (!path) continue;
    const parts = path.split(".");

    let value: unknown = ctx.workflowInputs;
    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    if (value !== undefined) {
      resolvedUrl = resolvedUrl.replace(match[0], String(value));
    }
  }

  console.log(`🌐 Fetching URL: ${resolvedUrl}`);

  try {
    const response = await fetch(resolvedUrl, {
      method: "GET",
      headers: config.headers || {},
    });

    const contentType = response.headers.get("content-type") || "";
    let body: unknown;

    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    const output = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };

    if (!response.ok) {
      console.log(`   ⚠️ HTTP ${response.status}: ${response.statusText}`);
      // Still return success with the error response, let user handle it
    } else {
      console.log(`   ✅ Success (${response.status})`);
    }

    return {
      success: true,
      nodeId: source.nodeId,
      output,
      paid: 0, // Sources are FREE
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Fetch error: ${errorMessage}`);

    return {
      success: false,
      nodeId: source.nodeId,
      error: `URL fetch failed: ${errorMessage}`,
    };
  }
}

/**
 * Execute a source step
 *
 * @param source - The source configuration
 * @param ctx - Execution context
 * @returns Step execution result
 */
export async function executeSource(
  source: WorkflowSource,
  ctx: SourceExecutionContext,
): Promise<StepResult> {
  console.log(`\n🔌 Executing source: ${source.sourceType}`);

  switch (source.sourceType) {
    case "job_history":
      return executeJobHistory(source, ctx);
    case "url_fetch":
      return executeUrlFetch(source, ctx);
    default:
      return {
        success: false,
        nodeId: source.nodeId,
        error: `Unknown source type: ${source.sourceType}`,
      };
  }
}
