import { Router } from "express";
import type {
  Router as RouterType,
  Request,
  Response,
  NextFunction,
} from "express";
import { OpenFacilitator } from "@openfacilitator/sdk";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getSupabase } from "../lib/supabase";
import { httpClient, isBlockedRequestError } from "../lib/http-client";
import { dollarsToAtomicString } from "../lib/usdc-amount";
import { config } from "../config";
import {
  getCreatorClaudeApiKey,
  getCreatorOpenRouterApiKey,
} from "./integrations";
import { optionalAuthMiddleware } from "../middleware/auth";
import {
  createJob,
  completeJob,
  failJob,
  getJob,
} from "../lib/instant-jobs";

export const instantRouter: RouterType = Router();

// USDC addresses
const USDC_ADDRESSES = {
  solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// Initialize OpenFacilitator
const FACILITATOR_URL = process.env.FACILITATOR_URL;
if (!FACILITATOR_URL) {
  console.warn(
    "FACILITATOR_URL not configured - instant resources will not work",
  );
}

const facilitator = FACILITATOR_URL
  ? new OpenFacilitator({ url: FACILITATOR_URL, timeout: 60000 })
  : null;

interface InstantResource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_usdc: string;
  resource_type:
    | "proxy"
    | "prompt"
    | "static"
    | "prompt_template"
    | "openrouter_instant";
  // Proxy fields
  proxy_origin_url: string | null;
  proxy_method: "GET" | "POST" | "PASS" | null;
  proxy_auth_header_encrypted: string | null;
  proxy_timeout_ms: number | null;
  // Prompt fields (legacy - server holds API key)
  prompt_provider: "anthropic" | "openai" | null;
  prompt_api_key_encrypted: string | null;
  prompt_model: string | null;
  prompt_system_prompt: string | null;
  prompt_parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: unknown;
    description?: string;
  }> | null;
  prompt_output_format: "raw" | "json" | "transform" | null;
  prompt_output_transform: string | null;
  // Static fields
  static_content: string | null;
  static_content_type: string | null;
  // Prompt template fields (caller provides API key)
  pt_system_prompt: string | null;
  pt_parameters: Array<{
    name: string;
    description?: string;
    required: boolean;
    default?: string;
  }> | null;
  pt_model: string | null;
  pt_max_tokens: number | null;
  pt_allows_user_message: boolean | null;
  // OpenRouter instant fields
  openrouter_model_id: string | null;
  openrouter_config: {
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  } | null;
  // Platform fee
  platform_fee_percent: string | null;
  // Server info
  server: {
    registered_by: string;
  };
}

interface OpenRouterInstantResult {
  response: string;
  modality: "text" | "image" | "audio" | "video";
  usage: {
    input_tokens?: number;
    output_tokens?: number;
  };
  images?: Array<{
    url: string; // Base64 data URL (data:image/png;base64,...)
  }>;
}

/**
 * Load an instant resource by username and slug
 */
async function loadResource(
  username: string,
  slug: string,
): Promise<InstantResource | null> {
  const supabase = getSupabase();

  console.log(`[Instant] loadResource: username=${username}, slug=${slug}`);

  // First, find the user by username (skip soft-deleted users — HIGH-03)
  const { data: user, error: userError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    console.log(`[Instant] User not found: ${username}`, userError);
    return null;
  }
  console.log(`[Instant] Found user: ${user.id}`);

  // Find the hosted server for this user
  const { data: server, error: serverError } = await supabase
    .from("x402_servers")
    .select("id, registered_by")
    .eq("registered_by", user.id)
    .eq("is_hosted", true)
    .maybeSingle();

  if (!server) {
    console.log(
      `[Instant] Hosted server not found for user ${user.id}`,
      serverError,
    );
    return null;
  }
  console.log(`[Instant] Found hosted server: ${server.id}`);

  // Find the resource
  const { data: resource, error } = await supabase
    .from("x402_resources")
    .select(
      `
      id,
      slug,
      name,
      description,
      price_usdc,
      resource_type,
      proxy_origin_url,
      proxy_method,
      proxy_auth_header_encrypted,
      proxy_timeout_ms,
      prompt_provider,
      prompt_api_key_encrypted,
      prompt_model,
      prompt_system_prompt,
      prompt_parameters,
      prompt_output_format,
      prompt_output_transform,
      static_content,
      static_content_type,
      platform_fee_percent,
      pt_system_prompt,
      pt_parameters,
      pt_model,
      pt_max_tokens,
      pt_allows_user_message,
      openrouter_model_id,
      openrouter_config
    `,
    )
    .eq("server_id", server.id)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !resource) {
    console.log(
      `[Instant] Resource not found: server_id=${server.id}, slug=${slug}`,
      error,
    );
    return null;
  }
  console.log(`[Instant] Found resource: ${resource.id}`);

  return {
    ...resource,
    server: { registered_by: server.registered_by },
  } as InstantResource;
}

/**
 * Get user's wallet address for receiving payments
 */
async function getUserWallet(
  userId: string,
  network: "solana" | "base",
): Promise<string | null> {
  const supabase = getSupabase();
  const { data: wallet } = await supabase
    .from("x402_user_wallets")
    .select("address, base_address")
    .eq("user_id", userId)
    .maybeSingle();

  if (!wallet) return null;

  return network === "base" ? wallet.base_address : wallet.address;
}

// CAIP-2 network identifiers
const CAIP2_NETWORK_IDS = {
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // Solana mainnet
  base: "eip155:8453", // Base mainnet
};

/**
 * Build 402 Payment Required response (x402 v2 format)
 */
function build402Response(
  resource: InstantResource,
  payTo: string,
  network: "solana" | "base",
  resourceUrl: string,
) {
  const priceUsdc = parseFloat(resource.price_usdc) || 0.01;
  const priceAtomic = dollarsToAtomicString(priceUsdc);

  // Build input schema based on resource type
  const bodyFields: Record<string, any> = {};

  if (resource.resource_type === "prompt" && resource.prompt_parameters) {
    for (const param of resource.prompt_parameters) {
      bodyFields[param.name] = {
        type: param.type === "number" ? "number" : "string",
        required: param.required,
        description: param.description || `Parameter: ${param.name}`,
        ...(param.default !== undefined ? { default: param.default } : {}),
      };
    }
  }

  // Prompt template parameters (Claude prompts with caller-provided API key)
  if (resource.resource_type === "prompt_template" && resource.pt_parameters) {
    for (const param of resource.pt_parameters as Array<{
      name: string;
      description?: string;
      required: boolean;
      default?: string;
    }>) {
      bodyFields[param.name] = {
        type: "string",
        required: param.required,
        description: param.description || `Parameter: ${param.name}`,
        ...(param.default !== undefined ? { default: param.default } : {}),
      };
    }
  }

  // OpenRouter instant parameters (follows same pattern as prompt_template)
  if (
    resource.resource_type === "openrouter_instant" &&
    resource.pt_parameters
  ) {
    for (const param of resource.pt_parameters as Array<{
      name: string;
      description?: string;
      required: boolean;
      default?: string;
    }>) {
      bodyFields[param.name] = {
        type: "string",
        required: param.required,
        description: param.description || `Parameter: ${param.name}`,
        ...(param.default !== undefined ? { default: param.default } : {}),
      };
    }
  }

  return {
    x402Version: 2,
    error: "Payment required",
    // v2 service metadata
    service: {
      name: "x402.jobs",
      url: "https://x402.jobs",
    },
    accepts: [
      {
        scheme: "exact",
        network: CAIP2_NETWORK_IDS[network], // v2 uses CAIP-2 format
        amount: priceAtomic, // v2 uses 'amount'
        maxAmountRequired: priceAtomic, // Keep for v1 compatibility
        resource: resourceUrl,
        description: resource.description || resource.name,
        mimeType:
          resource.resource_type === "static"
            ? resource.static_content_type || "application/json"
            : "application/json",
        payTo,
        maxTimeoutSeconds: 300,
        asset: USDC_ADDRESSES[network],
        outputSchema: {
          input: {
            type: "http",
            method: resource.proxy_method === "GET" ? "GET" : "POST",
            bodyType: "json",
            bodyFields,
          },
          output: {},
        },
        extra: {
          resourceType: resource.resource_type,
          // v1 compat fields in extra
          serviceName: "x402.jobs",
          serviceUrl: "https://x402.jobs",
          ...(network === "solana"
            ? {
                feePayer:
                  process.env.SOLANA_FACILITATOR_ADDRESS ||
                  "561oabzy81vXYYbs1ZHR1bvpiEr6Nbfd6PGTxPshoz4p",
              }
            : {}),
        },
      },
    ],
  };
}

/**
 * Verify and settle payment via facilitator
 */
async function verifyAndSettlePayment(
  paymentHeader: string,
  resource: InstantResource,
  payTo: string,
  network: "solana" | "base",
  resourceUrl: string,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (!facilitator) {
    return { success: false, error: "Facilitator not configured" };
  }

  try {
    const priceUsdc = parseFloat(resource.price_usdc) || 0.01;
    const priceAtomic = dollarsToAtomicString(priceUsdc);

    // Decode payment header
    let paymentPayload: any;
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );
    } catch {
      return { success: false, error: "Invalid payment header format" };
    }

    // Build payment object for the SDK
    const payment = {
      x402Version: paymentPayload.x402Version || 1,
      scheme: paymentPayload.scheme || "exact",
      network,
      payload: paymentPayload.payload,
    };

    // Build payment requirements
    const paymentRequirements = {
      scheme: "exact" as const,
      network,
      maxAmountRequired: priceAtomic,
      resource: resourceUrl,
      description: resource.description || resource.name,
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: 300,
      asset: USDC_ADDRESSES[network],
    };

    console.log(`[Instant] Settling payment for ${resource.slug}...`);

    // Use settle directly (it handles verification internally)
    const result = await facilitator.settle(payment, paymentRequirements);
    console.log(
      `[Instant] Settlement result:`,
      JSON.stringify(result, null, 2),
    );

    if (!result.success) {
      console.error(
        `[Instant] Settlement failed:`,
        result.errorReason || result,
      );
      return {
        success: false,
        error:
          result.errorReason ||
          (result as any).error ||
          (result as any).message ||
          "Payment settlement failed",
      };
    }

    const txHash = result.transaction;
    console.log(`[Instant] Payment settled: ${txHash?.substring(0, 20)}...`);
    return { success: true, txHash: txHash || "facilitator-settled" };
  } catch (error: any) {
    console.error(`[Instant] Payment error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Update resource stats after successful call
 */
async function updateResourceStats(
  resourceId: string,
  amountUsdc: number,
  platformFeePercent: number,
) {
  const supabase = getSupabase();

  const { data: resource } = await supabase
    .from("x402_resources")
    .select("call_count, total_earned_usdc")
    .eq("id", resourceId)
    .single();

  if (resource) {
    const creatorEarnings = amountUsdc * (1 - platformFeePercent);
    await supabase
      .from("x402_resources")
      .update({
        call_count: (resource.call_count || 0) + 1,
        total_earned_usdc: (resource.total_earned_usdc || 0) + creatorEarnings,
      })
      .eq("id", resourceId);
  }
}

// GET /@:username/:slug/status/:jobId - Poll for async job status
instantRouter.get(
  "/@:username/:slug/status/:jobId",
  async (req: Request, res: Response) => {
    const jobId = req.params.jobId;
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found or expired" });
    }

    if (job.status === "processing") {
      return res.json({ state: "processing" });
    }

    if (job.status === "failed") {
      return res.json({ state: "failed", error: job.error });
    }

    // succeeded — spread result fields at top level alongside state
    return res.json({ state: "succeeded", ...job.result });
  },
);

// GET/POST /@:username/:slug - Execute instant resource
instantRouter.all(
  "/@:username/:slug",
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = req.params.username as string;
      const slug = req.params.slug as string;
      const paymentHeader = req.headers["x-payment"] as string | undefined;

      if (!username || !slug) {
        return res
          .status(400)
          .json({ error: "Username and slug are required" });
      }

      // Determine network from query or default to base
      const network = (req.query.network as "solana" | "base") || "base";

      console.log(`[Instant] Request: ${username}/${slug} (${network})`);
      console.log(`[Instant] Method: ${req.method}`);
      console.log(`[Instant] Has payment: ${!!paymentHeader}`);

      // Load resource
      const resource = await loadResource(username, slug);

      if (!resource) {
        // Resource not found - pass to next handler (might be a job)
        return next();
      }

      // Check resource type is instant (not external)
      if (resource.resource_type === ("external" as any)) {
        return res.status(400).json({
          error: "Not an instant resource",
          message: "This resource is externally hosted",
        });
      }

      // Get user's wallet for payment
      const payTo = await getUserWallet(resource.server.registered_by, network);
      if (!payTo) {
        return res.status(503).json({
          error: "Resource not ready",
          message: "Creator wallet not configured for this network",
        });
      }

      const resourceUrl = `${config.publicUrl}/@${username}/${slug}`;
      const priceUsdc = parseFloat(resource.price_usdc) || 0.01;
      const platformFeePercent = parseFloat(
        resource.platform_fee_percent || "0.10",
      );

      // Check for owner test mode (bypass payment for prompt_template)
      const isOwnerTest =
        req.headers["x-owner-test"] === "true" &&
        req.user?.id === resource.server?.registered_by;

      // Check for non-streaming mode (used by workflow executor)
      const noStream = req.headers["x-no-stream"] === "true";
      if (noStream) {
        console.log(
          `[Instant] Non-streaming mode enabled for ${resource.slug}`,
        );
      }

      // Handle prompt_template with owner test mode - bypass payment
      if (resource.resource_type === "prompt_template" && isOwnerTest) {
        console.log(
          `[Instant] Owner test mode for prompt_template: ${resource.slug}`,
        );
        const ptResult = await executePromptTemplate(
          resource,
          req.body,
          res,
          true,
          {
            callerId: req.user?.id,
            amountPaid: 0,
            network,
          },
          noStream,
        );
        if ("error" in ptResult) {
          return res.status(ptResult.status).json({ error: ptResult.error });
        }
        if ("json" in ptResult) {
          return res.json(ptResult.response);
        }
        // Response already sent via streaming - no stats for test mode
        return;
      }

      // Handle openrouter_instant with owner test mode - bypass payment (LRO)
      if (resource.resource_type === "openrouter_instant" && isOwnerTest) {
        console.log(
          `[Instant] Owner test mode for openrouter_instant (LRO): ${resource.slug}`,
        );
        const jobId = createJob();
        const statusUrl = `${config.publicUrl}/@${username}/${slug}/status/${jobId}`;

        // Fire-and-forget async execution
        startOpenRouterInstantAsync(jobId, resource, req.body, true, {
          callerId: req.user?.id,
          amountPaid: 0,
          network,
        });

        return res.status(202).json({
          jobId,
          statusUrl,
          retryAfterSeconds: 2,
        });
      }

      // No payment header - return 402
      if (!paymentHeader) {
        return res
          .status(402)
          .json(build402Response(resource, payTo, network, resourceUrl));
      }

      // Verify and settle payment
      const paymentResult = await verifyAndSettlePayment(
        paymentHeader,
        resource,
        payTo,
        network,
        resourceUrl,
      );

      if (!paymentResult.success) {
        return res.status(402).json({
          x402Version: 1,
          error: paymentResult.error || "Payment failed",
          accepts: build402Response(resource, payTo, network, resourceUrl)
            .accepts,
        });
      }

      // Execute based on resource type
      let result: any;

      try {
        switch (resource.resource_type) {
          case "static":
            result = await executeStatic(resource);
            break;
          case "proxy":
            result = await executeProxy(resource, req);
            break;
          case "prompt":
            result = await executePrompt(resource, req.body);
            break;
          case "prompt_template": {
            // prompt_template - streaming or JSON based on X-NO-STREAM header
            const ptResult = await executePromptTemplate(
              resource,
              req.body,
              res,
              isOwnerTest,
              {
                callerId: req.user?.id,
                amountPaid: priceUsdc,
                paymentSignature: paymentResult.txHash,
                network,
              },
              noStream,
            );
            if ("error" in ptResult) {
              return res
                .status(ptResult.status)
                .json({ error: ptResult.error });
            }
            // Update stats
            await updateResourceStats(
              resource.id,
              priceUsdc,
              platformFeePercent,
            );
            if ("json" in ptResult) {
              // Non-streaming mode - return JSON response
              return res.json(ptResult.response);
            }
            return; // Streaming mode - response already sent via SSE
          }
          case "openrouter_instant": {
            // Update stats immediately (payment already settled)
            await updateResourceStats(
              resource.id,
              priceUsdc,
              platformFeePercent,
            );

            const jobId = createJob();
            const statusUrl = `${config.publicUrl}/@${username}/${slug}/status/${jobId}`;

            // Fire-and-forget async execution
            startOpenRouterInstantAsync(
              jobId,
              resource,
              req.body,
              isOwnerTest,
              {
                callerId: req.user?.id,
                amountPaid: priceUsdc,
                paymentSignature: paymentResult.txHash,
                network,
              },
              {
                transaction: paymentResult.txHash!,
                paidUsdc: priceUsdc,
              },
            );

            return res.status(202).json({
              jobId,
              statusUrl,
              retryAfterSeconds: 2,
              receipt: {
                transaction: paymentResult.txHash,
                paidUsdc: priceUsdc,
              },
            });
          }
          default:
            throw new Error(`Unknown resource type: ${resource.resource_type}`);
        }
      } catch (execError: any) {
        console.error(`[Instant] Execution error:`, execError);
        return res.status(500).json({
          error: "Execution failed",
          message: execError.message,
          receipt: {
            transaction: paymentResult.txHash,
            paidUsdc: priceUsdc,
          },
        });
      }

      // Update stats
      await updateResourceStats(resource.id, priceUsdc, platformFeePercent);

      // Return result with receipt
      if (resource.resource_type === "static") {
        // For static, set content-type and return raw
        res.setHeader(
          "Content-Type",
          resource.static_content_type || "application/json",
        );
        res.setHeader(
          "X-Payment-Receipt",
          JSON.stringify({
            transaction: paymentResult.txHash,
            paidUsdc: priceUsdc,
          }),
        );
        return res.send(result);
      }

      return res.json({
        ...result,
        receipt: {
          transaction: paymentResult.txHash,
          paidUsdc: priceUsdc,
        },
      });
    } catch (error: any) {
      console.error(`[Instant] Error:`, error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  },
);

// ============================================================================
// Executors (will be moved to separate files)
// ============================================================================

import { decryptSecret } from "../lib/instant/encrypt";

/**
 * Execute a static resource - just return the content
 */
async function executeStatic(resource: InstantResource): Promise<string> {
  return resource.static_content || "";
}

/**
 * Execute a proxy resource - forward request to origin
 */
async function executeProxy(
  resource: InstantResource,
  req: Request,
): Promise<any> {
  if (!resource.proxy_origin_url) {
    throw new Error("Proxy origin URL not configured");
  }

  const method =
    resource.proxy_method === "PASS"
      ? req.method
      : resource.proxy_method || "POST";
  const timeout = resource.proxy_timeout_ms || 30000;

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "x402.jobs/1.0",
  };

  // Add encrypted auth header if present
  if (resource.proxy_auth_header_encrypted) {
    try {
      const authHeader = decryptSecret(resource.proxy_auth_header_encrypted);
      // Auth header format: "Header-Name: value"
      const [headerName, ...valueParts] = authHeader.split(":");
      if (headerName && valueParts.length > 0) {
        headers[headerName.trim()] = valueParts.join(":").trim();
      }
    } catch (err) {
      console.error("[Proxy] Failed to decrypt auth header:", err);
    }
  }

  // Make request to origin (SSRF-safe at connect time via request-filtering-agent).
  // We use axios's built-in timeout; the AbortController is kept for symmetry
  // with the prior fetch-based contract but axios honors `timeout` directly.
  try {
    // Two-phase fetch: first do a HEAD/peek would change semantics, so instead
    // fetch as arraybuffer always and decode based on content-type. This
    // matches the prior behavior — both image/* and JSON paths previously
    // consumed the full body before branching.
    const response = await httpClient.request<ArrayBuffer>({
      url: resource.proxy_origin_url,
      method,
      headers,
      data: method !== "GET" ? req.body : undefined,
      timeout,
      responseType: "arraybuffer",
    });

    const contentTypeHeader = response.headers["content-type"];
    const contentType =
      typeof contentTypeHeader === "string" ? contentTypeHeader : "";

    if (contentType.startsWith("image/")) {
      const base64 = Buffer.from(response.data as ArrayBuffer).toString(
        "base64",
      );
      const mimeType = contentType.split(";")[0]?.trim() || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;
      console.log(
        `[Proxy] Converted binary image to base64 (${base64.length} chars)`,
      );
      return { imageDataUrl: dataUrl, contentType: mimeType };
    }

    // Handle text/JSON response. Decode the arraybuffer to a string and parse.
    const text = Buffer.from(response.data as ArrayBuffer).toString("utf-8");
    try {
      return JSON.parse(text);
    } catch {
      return { data: text };
    }
  } catch (error: any) {
    if (isBlockedRequestError(error)) {
      const msg = (error as Error).message;
      console.warn(`[Proxy] SSRF blocked: ${msg}`);
      throw new Error("Proxy origin URL not allowed", { cause: error });
    }
    if (
      error?.code === "ECONNABORTED" ||
      error?.name === "AbortError" ||
      /timeout/i.test(error?.message || "")
    ) {
      throw new Error(`Proxy timeout after ${timeout}ms`, { cause: error });
    }
    throw error;
  }
}

/**
 * Execute a prompt resource - call LLM API
 */
async function executePrompt(
  resource: InstantResource,
  body: Record<string, any>,
): Promise<any> {
  if (!resource.prompt_api_key_encrypted) {
    throw new Error("Prompt API key not configured");
  }
  if (!resource.prompt_system_prompt) {
    throw new Error("Prompt system prompt not configured");
  }

  // Decrypt API key
  let apiKey: string;
  try {
    apiKey = decryptSecret(resource.prompt_api_key_encrypted);
  } catch {
    throw new Error("Failed to decrypt API key");
  }

  // Build user message from parameters
  let userMessage: string;
  if (resource.prompt_parameters) {
    // Interpolate parameters into a message
    const parts: string[] = [];
    for (const param of resource.prompt_parameters) {
      const value = body[param.name];
      if (value !== undefined && value !== null && value !== "") {
        parts.push(`${param.name}: ${value}`);
      } else if (param.required) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
    }
    userMessage = parts.join("\n");
  } else {
    // Use message field if no parameters defined
    userMessage = body.message || body.input || JSON.stringify(body);
  }

  // Call LLM API
  const provider = resource.prompt_provider || "anthropic";
  const model = resource.prompt_model || "claude-3-haiku-20240307";

  let response: string;

  if (provider === "anthropic") {
    response = await callAnthropic(
      apiKey,
      model,
      resource.prompt_system_prompt,
      userMessage,
    );
  } else if (provider === "openai") {
    response = await callOpenAI(
      apiKey,
      model,
      resource.prompt_system_prompt,
      userMessage,
    );
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // Format output
  const outputFormat = resource.prompt_output_format || "raw";

  if (outputFormat === "raw") {
    return { response };
  } else if (outputFormat === "json") {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch {
      return { response };
    }
  } else if (outputFormat === "transform") {
    // Transform not implemented yet - return raw
    return { response };
  }

  return { response };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================================
// Usage Logging
// ============================================================================

interface UsageLogParams {
  templateId: string;
  callerId: string;
  status: "success" | "failed";
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
  amountPaid?: number;
  paymentSignature?: string;
  network?: string;
  executionTimeMs?: number;
}

/**
 * Log prompt template usage to database.
 * Failures are logged but don't break execution.
 */
async function logPromptTemplateUsage(params: UsageLogParams): Promise<void> {
  const supabase = getSupabase();

  try {
    await supabase.from("x402_prompt_template_usage_logs").insert({
      template_id: params.templateId,
      caller_id: params.callerId,
      status: params.status,
      error_message: params.errorMessage,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      amount_paid: params.amountPaid,
      payment_signature: params.paymentSignature,
      network: params.network,
      execution_time_ms: params.executionTimeMs,
      created_at: new Date().toISOString(),
    });
    console.log(
      `[Instant] Usage logged: template=${params.templateId}, status=${params.status}`,
    );
  } catch (err) {
    // Log but don't fail execution if logging fails
    console.error("[Instant] Failed to log usage:", err);
  }
}

// ============================================================================
// Prompt Template Execution (Claude with creator's API key)
// ============================================================================

/**
 * Substitute {param}{/param} tags with provided values.
 * Does NOT substitute tags without matching values (leaves them as-is for validation).
 */
function substituteParameters(
  systemPrompt: string,
  parameters: Array<{ name: string; required: boolean; default?: string }>,
  providedValues: Record<string, string>,
): string {
  let result = systemPrompt;

  for (const param of parameters) {
    const value = providedValues[param.name] ?? param.default;
    if (value !== undefined) {
      // Replace {name}{/name} with the value
      const regex = new RegExp(`\\{${param.name}\\}\\{/${param.name}\\}`, "g");
      result = result.replace(regex, value);
    }
  }

  return result;
}

/**
 * Validate request parameters before execution (and payment).
 * Returns error message if invalid, null if valid.
 */
function validatePromptTemplateRequest(
  resource: {
    pt_parameters?: Array<{
      name: string;
      required: boolean;
      default?: string;
    }> | null;
    pt_allows_user_message?: boolean | null;
  },
  body: Record<string, unknown>,
): string | null {
  if (resource.pt_parameters) {
    for (const param of resource.pt_parameters) {
      const value = body[param.name];
      if (
        param.required &&
        (value === undefined || value === null || value === "")
      ) {
        if (!param.default) {
          return `Missing required parameter: ${param.name}`;
        }
      }
      // Validate type is string if provided
      if (value !== undefined && typeof value !== "string") {
        return `Parameter '${param.name}' must be a string`;
      }
    }
  }

  // Validate user_message if provided
  if (body.user_message !== undefined) {
    if (!resource.pt_allows_user_message) {
      return "This template does not accept user messages";
    }
    if (typeof body.user_message !== "string") {
      return "user_message must be a string";
    }
  }

  return null;
}

/**
 * Map Claude API errors to user-friendly messages.
 */
function mapClaudeError(errorMessage: string): string {
  if (
    errorMessage.includes("invalid_api_key") ||
    errorMessage.includes("401")
  ) {
    return "The creator's API key is invalid. Please contact the template creator.";
  }
  if (errorMessage.includes("rate_limit") || errorMessage.includes("429")) {
    return "Rate limit exceeded. Please try again in a moment.";
  }
  if (errorMessage.includes("overloaded") || errorMessage.includes("529")) {
    return "Claude is currently overloaded. Please try again shortly.";
  }
  if (
    errorMessage.includes("context_length") ||
    errorMessage.includes("too long")
  ) {
    return "Input too long for this template. Please reduce your input size.";
  }
  // Generic error - don't expose internal details
  return "Execution failed. Please try again.";
}

interface StreamingResult {
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
}

/**
 * Execute prompt_template with streaming response via SSE.
 * Returns usage data for logging.
 */
async function executePromptTemplateStreaming(
  res: Response,
  apiKey: string,
  systemPrompt: string,
  userMessage: string | undefined,
  maxTokens: number,
  model: string,
): Promise<StreamingResult> {
  const client = new Anthropic({ apiKey });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Build messages array - Claude requires at least one user message
  const messages: Anthropic.MessageParam[] = userMessage
    ? [{ role: "user", content: userMessage }]
    : [
        {
          role: "user",
          content: "Please respond based on the system instructions.",
        },
      ];

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      // Enable web search tool for real-time information
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });

    // Stream text deltas to client
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === "text_delta" && delta.text) {
          res.write(
            `data: ${JSON.stringify({ type: "text", content: delta.text })}\n\n`,
          );
        }
      }
    }

    // Send final message with token usage
    const finalMessage = await stream.finalMessage();
    res.write(
      `data: ${JSON.stringify({
        type: "done",
        usage: finalMessage.usage,
      })}\n\n`,
    );

    res.end();

    return {
      success: true,
      inputTokens: finalMessage.usage?.input_tokens,
      outputTokens: finalMessage.usage?.output_tokens,
    };
  } catch (error) {
    // Send error event via SSE
    const message = error instanceof Error ? error.message : "Execution failed";
    console.error(`[Instant] Streaming Claude error:`, error);
    res.write(
      `data: ${JSON.stringify({ type: "error", message: mapClaudeError(message) })}\n\n`,
    );
    res.end();

    return {
      success: false,
      errorMessage: message,
    };
  }
}

/**
 * Execute prompt template WITHOUT streaming - returns complete JSON response
 * Used by workflow executor which doesn't handle SSE
 */
async function executePromptTemplateNonStreaming(
  apiKey: string,
  systemPrompt: string,
  userMessage: string | undefined,
  maxTokens: number,
  model: string,
): Promise<StreamingResult & { content?: string }> {
  const client = new Anthropic({ apiKey });

  // Build messages array - Claude requires at least one user message
  const messages: Anthropic.MessageParam[] = userMessage
    ? [{ role: "user", content: userMessage }]
    : [
        {
          role: "user",
          content: "Please respond based on the system instructions.",
        },
      ];

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      // Enable web search tool for real-time information
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });

    // Extract text content from response
    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    return {
      success: true,
      content: textContent,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    console.error(`[Instant] Non-streaming Claude error:`, error);
    return {
      success: false,
      errorMessage: mapClaudeError(message),
    };
  }
}

interface ExecutePromptTemplateContext {
  callerId?: string;
  amountPaid?: number;
  paymentSignature?: string;
  network?: string;
}

/**
 * Execute a prompt_template resource - call Claude with creator's API key
 * @param noStream - If true, returns complete JSON response instead of SSE streaming
 */
async function executePromptTemplate(
  resource: InstantResource,
  body: Record<string, unknown>,
  res: Response,
  isOwnerTest: boolean,
  context: ExecutePromptTemplateContext = {},
  noStream: boolean = false,
): Promise<
  | { streamed: true }
  | { json: true; response: unknown }
  | { error: string; status: number }
> {
  const startTime = Date.now();

  // Validate parameters BEFORE execution
  const validationError = validatePromptTemplateRequest(resource, body);
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  // Get creator's Claude API key
  const creatorId = resource.server?.registered_by;
  if (!creatorId) {
    return { error: "Resource configuration error", status: 500 };
  }

  const apiKey = await getCreatorClaudeApiKey(creatorId);
  if (!apiKey) {
    return {
      error: "Template creator has not configured their Claude API key",
      status: 500,
    };
  }

  // Substitute parameters
  const substitutedPrompt = substituteParameters(
    resource.pt_system_prompt || "",
    resource.pt_parameters || [],
    body as Record<string, string>,
  );

  let result: StreamingResult & { content?: string };

  if (noStream) {
    // Non-streaming mode - return complete JSON response
    result = await executePromptTemplateNonStreaming(
      apiKey,
      substitutedPrompt,
      body.user_message as string | undefined,
      resource.pt_max_tokens || 4096,
      resource.pt_model || "claude-sonnet-4-20250514",
    );
  } else {
    // Streaming mode - SSE response
    result = await executePromptTemplateStreaming(
      res,
      apiKey,
      substitutedPrompt,
      body.user_message as string | undefined,
      resource.pt_max_tokens || 4096,
      resource.pt_model || "claude-sonnet-4-20250514",
    );
  }

  const executionTimeMs = Date.now() - startTime;

  // Log usage (only if we have a caller - skip for anonymous)
  if (context.callerId) {
    await logPromptTemplateUsage({
      templateId: resource.id,
      callerId: context.callerId,
      status: result.success ? "success" : "failed",
      errorMessage: result.errorMessage,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      amountPaid: isOwnerTest ? 0 : context.amountPaid,
      paymentSignature: context.paymentSignature,
      network: context.network,
      executionTimeMs,
    });
  }

  if (noStream) {
    // Return JSON response for non-streaming mode
    if (!result.success) {
      return { error: result.errorMessage || "Execution failed", status: 500 };
    }
    return {
      json: true,
      response: {
        response: result.content,
        usage: {
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
        },
      },
    };
  }

  return { streamed: true };
}

/**
 * Extract media content from OpenRouter response.
 * OpenRouter returns images in message.images array (not standard OpenAI format).
 */
function extractMediaFromResponse(
  response: OpenAI.Chat.Completions.ChatCompletion,
  _modelModality: string,
): {
  type: "text" | "image";
  content: string;
  images?: Array<{ url: string }>;
} {
  const message = response.choices[0]?.message;
  const textContent = message?.content || "";

  // Check for images in response (OpenRouter-specific field)
  const images = (message as any)?.images;

  if (images && Array.isArray(images) && images.length > 0) {
    return {
      type: "image",
      content: textContent,
      images: images
        .map((img: any) => ({
          url: img.image_url?.url || img.url || "",
        }))
        .filter((img: { url: string }) => img.url),
    };
  }

  return {
    type: "text",
    content: textContent,
  };
}

/**
 * Fire-and-forget wrapper: runs executeOpenRouterInstant in the background
 * and writes the result into the in-memory job store.
 */
function startOpenRouterInstantAsync(
  jobId: string,
  resource: InstantResource,
  body: Record<string, unknown>,
  isOwnerTest: boolean,
  context: ExecutePromptTemplateContext,
  receipt?: { transaction: string; paidUsdc: number },
): void {
  executeOpenRouterInstant(resource, body, isOwnerTest, context)
    .then((orResult) => {
      if ("error" in orResult) {
        failJob(jobId, orResult.error);
        return;
      }

      const data = orResult.response as OpenRouterInstantResult;

      // Normalize images from [{url}] to string[] and extract imageDataUrl
      let images: string[] | undefined;
      let imageDataUrl: string | undefined;
      if (data.images && data.images.length > 0) {
        images = data.images.map((img) =>
          typeof img === "string" ? img : (img as { url: string }).url,
        );
        imageDataUrl = images[0];
      }

      completeJob(jobId, {
        response: data.response,
        modality: data.modality,
        usage: data.usage,
        ...(images ? { images } : {}),
        ...(imageDataUrl ? { imageDataUrl, artifactUrl: imageDataUrl } : {}),
        ...(receipt ? { receipt } : {}),
      });
    })
    .catch((err) => {
      console.error(`[Instant] Async job ${jobId} failed:`, err);
      failJob(jobId, err instanceof Error ? err.message : "Execution failed");
    });
}

/**
 * Execute an openrouter_instant resource using OpenAI SDK with OpenRouter baseURL.
 * No streaming per CONTEXT.md - waits for full response (LRO pattern).
 */
async function executeOpenRouterInstant(
  resource: InstantResource,
  body: Record<string, unknown>,
  isOwnerTest: boolean,
  context: ExecutePromptTemplateContext = {},
): Promise<
  { json: true; response: unknown } | { error: string; status: number }
> {
  const startTime = Date.now();

  // Validate parameters (reuse existing validation)
  const validationError = validatePromptTemplateRequest(
    {
      pt_parameters: resource.pt_parameters,
      pt_allows_user_message: resource.pt_allows_user_message,
    },
    body,
  );
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  // Get creator's OpenRouter API key
  const creatorId = resource.server?.registered_by;
  if (!creatorId) {
    return { error: "Resource configuration error", status: 500 };
  }

  const apiKey = await getCreatorOpenRouterApiKey(creatorId);
  if (!apiKey) {
    return {
      error: "Resource unavailable",
      status: 500,
    };
  }

  // Get model ID from openrouter_config or ai_models FK
  const config = resource.openrouter_config;
  if (!config?.systemPrompt) {
    return { error: "Resource configuration error", status: 500 };
  }

  // Substitute parameters into system prompt
  const substitutedPrompt = substituteParameters(
    config.systemPrompt,
    resource.pt_parameters || [],
    body as Record<string, string>,
  );

  // Get model ID - need to look up from ai_models table
  let modelId: string;
  let modelModality: string | null;
  if (resource.openrouter_model_id) {
    // Look up the actual model name from ai_models table
    const { data: model } = await getSupabase()
      .from("x402_openrouter_models")
      .select("openrouter_id, modality")
      .eq("id", resource.openrouter_model_id)
      .single();

    if (!model?.openrouter_id) {
      return { error: "Resource unavailable", status: 500 };
    }
    modelId = model.openrouter_id; // OpenRouter uses openrouter_id like "openai/gpt-4o"
    modelModality = model.modality;
  } else {
    return { error: "Resource configuration error", status: 500 };
  }

  // Create OpenAI client with OpenRouter baseURL
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://x402.jobs",
      "X-Title": "x402.jobs",
    },
  });

  try {
    // Build messages array
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (substitutedPrompt) {
      messages.push({ role: "system", content: substitutedPrompt });
    }

    const userMessage = body.user_message as string | undefined;
    messages.push({
      role: "user",
      content:
        userMessage || "Please respond based on the system instructions.",
    });

    // Build base request
    const requestBody: Record<string, unknown> = {
      model: modelId,
      messages,
      temperature: config.temperature ?? 1.0,
      max_tokens: config.maxTokens ?? 4096,
      top_p: config.topP ?? 1.0,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
      stream: false,
    };

    // Enable image generation for image models (required by OpenRouter)
    if (modelModality === "image") {
      requestBody.modalities = ["image", "text"];
    }

    // Warn for video/audio models (not widely supported on OpenRouter)
    if (modelModality === "video" || modelModality === "audio") {
      console.warn(
        `[Instant] Model ${modelId} has ${modelModality} modality - output may be text-only`,
      );
    }

    // Call OpenRouter API (no streaming per CONTEXT.md)
    const response = await client.chat.completions.create(requestBody as any);

    // Extract media from response
    const mediaResult = extractMediaFromResponse(
      response,
      modelModality || "text",
    );

    const inputTokens = response.usage?.prompt_tokens;
    const outputTokens = response.usage?.completion_tokens;

    const executionTimeMs = Date.now() - startTime;

    // Log usage
    if (context.callerId) {
      await logPromptTemplateUsage({
        templateId: resource.id,
        callerId: context.callerId,
        status: "success",
        inputTokens,
        outputTokens,
        amountPaid: isOwnerTest ? 0 : context.amountPaid,
        paymentSignature: context.paymentSignature,
        network: context.network,
        executionTimeMs,
      });
    }

    // Build structured response
    const result: OpenRouterInstantResult = {
      response: mediaResult.content,
      modality: mediaResult.type,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    };

    // Add images if present
    if (mediaResult.images && mediaResult.images.length > 0) {
      result.images = mediaResult.images;
    }

    return {
      json: true,
      response: result,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Execution failed";

    console.error(`[Instant] OpenRouter execution error:`, error);

    // Log failed usage
    if (context.callerId) {
      await logPromptTemplateUsage({
        templateId: resource.id,
        callerId: context.callerId,
        status: "failed",
        errorMessage,
        amountPaid: isOwnerTest ? 0 : context.amountPaid,
        paymentSignature: context.paymentSignature,
        network: context.network,
        executionTimeMs,
      });
    }

    // Return generic error per CONTEXT.md - don't expose 401/402/etc details
    return {
      error: "Resource unavailable",
      status: 500,
    };
  }
}
