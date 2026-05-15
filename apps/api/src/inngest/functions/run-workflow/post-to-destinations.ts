import type {
  PostToDestinationsContext,
  DestinationConfig,
  TelegramConfig,
  XTokens,
  WorkflowDefinition,
  ExtractedFields,
  PostResult,
} from "./types";
import { executeX402Request } from "../../utils/execute-x402";
import { decryptSecret } from "../../../lib/instant/encrypt";

// Lazy-load Twitter API
let TwitterApi: typeof import("twitter-api-v2").TwitterApi | null = null;
async function getTwitterApi() {
  if (!TwitterApi) {
    const mod = await import("twitter-api-v2");
    TwitterApi = mod.TwitterApi;
  }
  return TwitterApi;
}

/**
 * Get nested field value from an object (supports "response.imageUrl" syntax)
 */
export function getFieldValue(
  obj: Record<string, unknown>,
  field: string,
): unknown {
  const parts = field.split(".");
  let value: unknown = obj;
  for (const part of parts) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Extract image URL from a single output object
 */
function extractImageFromObject(
  output: Record<string, unknown>,
): string | undefined {
  return (
    (output.imageDataUrl as string) ||
    (output.imageUrl as string) ||
    (output.image_url as string) ||
    (output.artifactUrl as string) ||
    (output.artifact_url as string) ||
    (output.mediaUrl as string) ||
    (output.media_url as string) ||
    (output.url as string) ||
    (output.image as string) ||
    undefined
  );
}

/**
 * Extract caption/text from a single output object
 */
function extractCaptionFromObject(
  output: Record<string, unknown>,
): string | undefined {
  return (
    (output.captions as string) ||
    (output.caption as string) ||
    (output.text as string) ||
    (output.fact as string) ||
    (output.message as string) ||
    (output.content as string) ||
    (output.result as string) ||
    (output.output as string) ||
    (output.response as string) ||
    (output.tweet as string) ||
    (output.post as string) ||
    undefined
  );
}

/**
 * Extract image URL and caption from output based on configured fields or common field names.
 * Supports combined outputs from multiple sources (fan-in pattern).
 */
export function extractFields(
  sourceOutput: unknown,
  configuredImageField?: string,
  configuredCaptionField?: string,
): ExtractedFields {
  let imageUrl: string | undefined;
  let caption: string | undefined;

  if (typeof sourceOutput === "object" && sourceOutput !== null) {
    const output = sourceOutput as Record<string, unknown>;

    // Use configured field if provided
    if (configuredImageField) {
      const val = getFieldValue(output, configuredImageField);
      if (typeof val === "string") imageUrl = val;
    }
    if (configuredCaptionField) {
      const val = getFieldValue(output, configuredCaptionField);
      if (typeof val === "string") caption = val;
    }

    // Try to extract from top-level first
    if (!imageUrl) {
      imageUrl = extractImageFromObject(output);
    }
    if (!caption) {
      caption = extractCaptionFromObject(output);
    }

    // If not found at top level, search nested objects (combined outputs from multiple sources)
    if (!imageUrl || !caption) {
      for (const value of Object.values(output)) {
        if (typeof value === "object" && value !== null) {
          const nested = value as Record<string, unknown>;
          if (!imageUrl) {
            imageUrl = extractImageFromObject(nested);
          }
          if (!caption) {
            caption = extractCaptionFromObject(nested);
          }
          if (imageUrl && caption) break;
        }
      }
    }
  } else if (
    typeof sourceOutput === "string" &&
    sourceOutput.startsWith("http")
  ) {
    imageUrl = sourceOutput;
  } else if (typeof sourceOutput === "string") {
    // Plain string output becomes caption
    caption = sourceOutput;
  }

  return { imageUrl, caption };
}

/**
 * Post to Telegram
 */
export async function postToTelegram(
  botToken: string,
  chatId: string,
  fields: ExtractedFields,
): Promise<PostResult> {
  try {
    if (fields.imageUrl) {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;

      // Check if it's a base64 data URL
      if (fields.imageUrl.startsWith("data:")) {
        // Extract mime type and base64 content
        const matches = fields.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.error(`   ❌ Invalid data URL format`);
          return {
            destination: "telegram",
            success: false,
            error: "Invalid data URL format",
          };
        }

        const mimeType = matches[1] || "image/jpeg";
        const base64Data = matches[2] || "";
        if (!base64Data) {
          console.error(`   ❌ No base64 data in data URL`);
          return {
            destination: "telegram",
            success: false,
            error: "No base64 data in data URL",
          };
        }
        const buffer = Buffer.from(base64Data, "base64");

        // Determine file extension from mime type
        const extMap: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/gif": "gif",
          "image/webp": "webp",
        };
        const ext = extMap[mimeType] ?? "jpg";

        // Use FormData for multipart upload
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append(
          "photo",
          new Blob([buffer], { type: mimeType }),
          `image.${ext}`,
        );

        if (fields.caption) {
          const truncatedCaption =
            fields.caption.length > 1024
              ? fields.caption.substring(0, 1021) + "..."
              : fields.caption;
          formData.append("caption", truncatedCaption);
          formData.append("parse_mode", "HTML");
        }

        console.log(
          `   📤 Uploading base64 image to Telegram (${Math.round(buffer.length / 1024)}KB)`,
        );
        const res = await fetch(telegramUrl, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.ok) {
          console.log(`   ✅ Posted to Telegram successfully`);
          return { destination: "telegram", success: true };
        } else {
          console.error(`   ❌ Telegram error:`, data.description);
          return {
            destination: "telegram",
            success: false,
            error: data.description,
          };
        }
      }

      // Regular URL - use JSON body
      const body: Record<string, unknown> = {
        chat_id: chatId,
        photo: fields.imageUrl,
      };
      if (fields.caption) {
        // Truncate caption to Telegram's 1024 char limit
        body.caption =
          fields.caption.length > 1024
            ? fields.caption.substring(0, 1021) + "..."
            : fields.caption;
        body.parse_mode = "HTML";
      }
      const res = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        console.log(`   ✅ Posted to Telegram successfully`);
        return { destination: "telegram", success: true };
      } else {
        console.error(`   ❌ Telegram error:`, data.description);
        return {
          destination: "telegram",
          success: false,
          error: data.description,
        };
      }
    } else if (fields.caption) {
      // Just send text
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: fields.caption,
          parse_mode: "HTML",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        console.log(`   ✅ Sent message to Telegram successfully`);
        return { destination: "telegram", success: true };
      } else {
        console.error(`   ❌ Telegram error:`, data.description);
        return {
          destination: "telegram",
          success: false,
          error: data.description,
        };
      }
    }
    return {
      destination: "telegram",
      success: false,
      error: "No content to post",
    };
  } catch (err) {
    console.error(`   ❌ Failed to post to Telegram:`, err);
    return {
      destination: "telegram",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Post to X/Twitter
 */
export async function postToX(
  twitterConfig: { apiKey: string; apiSecret: string },
  xTokens: XTokens,
  fields: ExtractedFields,
): Promise<PostResult> {
  try {
    const TwitterApiClass = await getTwitterApi();
    const client = new TwitterApiClass({
      appKey: twitterConfig.apiKey,
      appSecret: twitterConfig.apiSecret,
      accessToken: xTokens.access_token,
      accessSecret: xTokens.access_secret,
    });

    // Upload media if image URL is provided
    let mediaId: string | undefined;
    if (fields.imageUrl) {
      try {
        console.log(`   📸 Uploading media to X...`);
        // Download image and upload to Twitter
        const imageResponse = await fetch(fields.imageUrl);
        if (imageResponse.ok) {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          // Use v1 API for media upload (v2 doesn't support it yet)
          mediaId = await client.v1.uploadMedia(imageBuffer, {
            mimeType: imageResponse.headers.get("content-type") || "image/png",
          });
          console.log(`   ✅ Media uploaded: ${mediaId}`);
        } else {
          console.log(`   ⚠️ Failed to fetch image: ${imageResponse.status}`);
        }
      } catch (uploadErr) {
        console.error(`   ⚠️ Media upload failed:`, uploadErr);
        // Continue without media - will post text only
      }
    }

    // Build tweet text
    const tweetText = fields.caption
      ? fields.caption.length > 280
        ? fields.caption.substring(0, 277) + "..."
        : fields.caption
      : !mediaId && fields.imageUrl
        ? fields.imageUrl // Include URL if media upload failed
        : !fields.caption && !fields.imageUrl
          ? "Check this out!"
          : undefined;

    // Need at least text or media to post
    if (tweetText || mediaId) {
      // Build tweet payload with proper types
      const tweet = await client.v2.tweet({
        text: tweetText || "",
        ...(mediaId && {
          media: { media_ids: [mediaId] as [string] },
        }),
      });
      if (tweet.data?.id) {
        console.log(
          `   ✅ Posted to X: https://x.com/i/web/status/${tweet.data.id}`,
        );
        return {
          destination: "x",
          success: true,
          details: { tweetId: tweet.data.id },
        };
      }
    }

    console.log(`   ⏭️ No content to post to X`);
    return { destination: "x", success: false, error: "No content to post" };
  } catch (err) {
    console.error(`   ❌ Failed to post to X:`, err);
    return {
      destination: "x",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Upload to x402.storage (IPFS via x402 payment)
 */
export async function uploadToX402Storage(
  walletSecretKey: string,
  baseWalletKey: string | undefined,
  content: unknown,
  network: "solana" | "base" = "solana",
  contentType?: string,
): Promise<PostResult> {
  try {
    console.log(`   📦 Uploading to x402.storage (${network})...`);

    // Serialize content to JSON string
    const contentString =
      typeof content === "string" ? content : JSON.stringify(content, null, 2);

    // Determine file extension from content type
    const extMap: Record<string, string> = {
      "text/html": "html",
      "text/css": "css",
      "text/javascript": "js",
      "application/json": "json",
      "text/plain": "txt",
      "image/svg+xml": "svg",
    };
    const ext = (contentType && extMap[contentType]) || "json";
    const filename = `job-output-${Date.now()}.${ext}`;

    // x402.storage API URL
    const storageUrl = "https://api.x402.storage/store";

    // Use the standard x402 payment flow
    // x402.storage expects "data" field
    const result = await executeX402Request({
      walletSecretKey,
      baseWalletKey,
      resourceUrl: storageUrl,
      method: "POST",
      expectedNetwork: network,
      body: {
        data: contentString,
        filename,
      },
      ...(contentType
        ? { extraHeaders: { "X-Content-Type": contentType } }
        : {}),
    });

    if (!result.success) {
      console.error(`   ❌ x402.storage upload failed:`, result.error);
      return {
        destination: "x402storage",
        success: false,
        error: result.error || "Upload failed",
      };
    }

    // Extract CID and URL from response
    const response = result.response as { cid?: string; url?: string };
    const cid = response.cid;
    const url =
      response.url || (cid ? `https://x402.storage/${cid}` : undefined);

    console.log(`   ✅ Uploaded to x402.storage: ${url}`);
    console.log(`   CID: ${cid}`);
    console.log(`   Cost: $${result.amountPaid?.toFixed(4) || "0"}`);

    return {
      destination: "x402storage",
      success: true,
      details: {
        cid,
        url,
        amountPaid: result.amountPaid,
      },
    };
  } catch (err) {
    console.error(`   ❌ Failed to upload to x402.storage:`, err);
    return {
      destination: "x402storage",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Post workflow output to configured external destinations (Telegram, X)
 *
 * This function:
 * 1. Checks if the run had any failures (skips if so)
 * 2. Gets the job's workflow definition to find output nodes
 * 3. For each output node with enabled destinations, posts the output
 */
export async function postToDestinations(
  ctx: PostToDestinationsContext,
): Promise<PostResult[]> {
  const {
    supabase,
    runId,
    jobId,
    outputs,
    twitterConfig,
    walletSecretKey,
    baseWalletKey,
    jobNetwork,
    userId,
    broadcastRunEvent,
  } = ctx;
  const results: PostResult[] = [];

  console.log(
    `📤 [POST-TO-DESTINATIONS] Starting for run ${runId}, job ${jobId}`,
  );
  console.log(`   Outputs available:`, Object.keys(outputs));

  // Check if run has failures by querying DB directly
  const { data: failedEvents } = await supabase
    .from("x402_job_run_events")
    .select("id")
    .eq("run_id", runId)
    .eq("status", "failed")
    .limit(1);

  if (failedEvents && failedEvents.length > 0) {
    console.log(`⏭️ Skipping external posts - run had failures`);
    return results;
  }

  // Get the job's workflow definition to find output nodes
  const { data: job } = await supabase
    .from("x402_jobs")
    .select("workflow_definition, user_id")
    .eq("id", jobId)
    .single();

  if (!job?.workflow_definition) {
    console.log(`⏭️ No workflow definition found`);
    return results;
  }

  const workflowDef = job.workflow_definition as WorkflowDefinition;

  // Find output nodes
  const outputNodes = (workflowDef.nodes || []).filter(
    (n) => n.type === "output",
  );

  if (outputNodes.length === 0) {
    console.log(`⏭️ No output nodes found`);
    return results;
  }

  console.log(`   Found ${outputNodes.length} output node(s)`);

  // Get user's integration configs
  const { data: telegramConfig } = (await supabase
    .from("x402_user_telegram_configs")
    .select("bot_token, default_chat_id, is_enabled")
    .eq("user_id", job.user_id)
    .single()) as { data: TelegramConfig | null };

  // Dual-read for X tokens (HIGH-02 / plan 28-08): prefer ciphertext
  // columns, fall back to plaintext for rows the backfill script hasn't
  // migrated yet. After the v3.1 plaintext-drop migration, this whole
  // block simplifies to a ciphertext-only read.
  const { data: rawXTokens } = (await supabase
    .from("x402_user_x_tokens")
    .select(
      "access_token, access_secret, access_token_ciphertext, access_secret_ciphertext",
    )
    .eq("user_id", job.user_id)
    .single()) as {
    data: {
      access_token: string | null;
      access_secret: string | null;
      access_token_ciphertext: string | null;
      access_secret_ciphertext: string | null;
    } | null;
  };

  let xTokens: XTokens | null = null;
  if (rawXTokens) {
    const accessToken = rawXTokens.access_token_ciphertext
      ? decryptSecret(rawXTokens.access_token_ciphertext)
      : rawXTokens.access_token;
    const accessSecret = rawXTokens.access_secret_ciphertext
      ? decryptSecret(rawXTokens.access_secret_ciphertext)
      : rawXTokens.access_secret;
    if (accessToken && accessSecret) {
      xTokens = { access_token: accessToken, access_secret: accessSecret };
    }
  }

  console.log(`   Telegram config:`, {
    hasToken: !!telegramConfig?.bot_token,
    isEnabled: telegramConfig?.is_enabled,
    defaultChatId: telegramConfig?.default_chat_id,
  });
  console.log(`   X tokens:`, { hasTokens: !!xTokens?.access_token });

  // For each output node, check destinations and post
  for (const outputNode of outputNodes) {
    console.log(`   Processing output node: ${outputNode.id}`);
    const destinations =
      (outputNode.data?.outputConfig?.destinations as DestinationConfig[]) ||
      [];
    console.log(
      `   Destinations:`,
      destinations.map((d) => ({ type: d.type, enabled: d.enabled })),
    );

    // Find ALL edges that feed into this output node (fan-in support)
    const incomingEdges = (workflowDef.edges || []).filter(
      (e) => e.target === outputNode.id,
    );
    const sourceNodeIds = incomingEdges.map((e) => e.source);
    console.log(
      `   Source nodes: ${sourceNodeIds.length > 0 ? sourceNodeIds.join(", ") : "none"}`,
    );

    // Collect outputs from all source nodes
    const sourceOutputs: Record<string, unknown> = {};
    for (const nodeId of sourceNodeIds) {
      if (outputs[nodeId] !== undefined) {
        sourceOutputs[nodeId] = outputs[nodeId];
      }
    }

    if (Object.keys(sourceOutputs).length === 0) {
      console.log(`⏭️ No output available for output node ${outputNode.id}`);
      continue;
    }

    // If single source, use it directly; if multiple, combine into object
    const firstSourceId = sourceNodeIds[0];
    const sourceOutput =
      sourceNodeIds.length === 1 && firstSourceId
        ? sourceOutputs[firstSourceId]
        : sourceOutputs;

    console.log(
      `   Source output keys:`,
      typeof sourceOutput === "object"
        ? Object.keys(sourceOutput as object)
        : typeof sourceOutput,
    );
    if (sourceNodeIds.length > 1) {
      console.log(
        `   Combined ${sourceNodeIds.length} sources into single output`,
      );
    }

    // Get destination configs for field mapping
    const telegramDestConfig = destinations.find(
      (d) => d.type === "telegram" && d.enabled,
    );
    const xDestConfig = destinations.find((d) => d.type === "x" && d.enabled);

    // Extract fields for Telegram (using Telegram config)
    const telegramFields = extractFields(
      sourceOutput,
      telegramDestConfig?.config?.imageField,
      telegramDestConfig?.config?.captionField,
    );

    // Extract fields for X (using X-specific config)
    const xFields = extractFields(
      sourceOutput,
      xDestConfig?.config?.imageField,
      xDestConfig?.config?.captionField,
    );

    // Post to Telegram if enabled
    const telegramDest = destinations.find(
      (d) => d.type === "telegram" && d.enabled,
    );
    if (telegramDest) {
      console.log(
        `   Telegram destination found (enabled: ${telegramDest.enabled})`,
      );
      if (!telegramConfig?.bot_token) {
        console.log(`   ⏭️ Telegram skipped: no bot token configured`);
      } else if (!telegramConfig?.is_enabled) {
        console.log(`   ⏭️ Telegram skipped: integration not enabled`);
      } else {
        const chatId =
          telegramDest.config?.chatId || telegramConfig.default_chat_id;
        if (chatId) {
          console.log(`📱 Posting to Telegram chat: ${chatId}`);
          console.log(`   Fields:`, telegramFields);
          const result = await postToTelegram(
            telegramConfig.bot_token,
            chatId,
            telegramFields,
          );
          results.push(result);
        } else {
          console.log(`   ⏭️ Telegram skipped: no chat ID configured`);
        }
      }
    } else {
      console.log(`   ⏭️ No Telegram destination in this output node`);
    }

    // Post to X if enabled
    const xDest = destinations.find((d) => d.type === "x" && d.enabled);
    if (xDest && xTokens?.access_token && xTokens?.access_secret) {
      console.log(`🐦 Posting to X...`);
      if (!twitterConfig?.apiKey || !twitterConfig?.apiSecret) {
        console.log(`   ⏭️ Twitter not configured - skipping X post`);
      } else {
        const result = await postToX(
          { apiKey: twitterConfig.apiKey, apiSecret: twitterConfig.apiSecret },
          xTokens,
          xFields,
        );
        results.push(result);
      }
    }

    // Upload to x402.storage if enabled
    const storageDest = destinations.find(
      (d) => d.type === "x402storage" && d.enabled,
    );
    if (storageDest && walletSecretKey) {
      console.log(
        `📦 Uploading to x402.storage (${jobNetwork || "solana"})...`,
      );

      // Insert "running" event first so it shows in logs immediately
      const { data: runningEvent } = await supabase
        .from("x402_job_run_events")
        .insert({
          run_id: runId,
          resource_id: null,
          resource_url: "https://api.x402.storage/store",
          resource_name: "x402.storage",
          resource_price: 0.01, // Estimated cost
          amount_paid: 0,
          network: jobNetwork || "solana",
          sequence: 9999, // After all other steps
          status: "running",
          inputs: {},
          node_id: "x402-storage",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      const storageEventId = runningEvent?.id;

      // Broadcast "running" event via WebSocket
      if (userId && broadcastRunEvent) {
        broadcastRunEvent(userId, runId, jobId, "run:step", {
          nodeId: "x402-storage",
          status: "running",
          resourceName: "x402.storage",
        });
      }

      const result = await uploadToX402Storage(
        walletSecretKey,
        baseWalletKey,
        sourceOutput,
        jobNetwork || "solana",
        storageDest.config?.contentType,
      );
      results.push(result);

      // Update the event with final status
      if (result.success && result.details?.url) {
        const storageCost = (result.details.amountPaid as number) || 0;

        // Update run record with storage URL
        await supabase
          .from("x402_job_runs")
          .update({
            x402_storage_url: result.details.url,
            x402_storage_cid: result.details.cid,
            storage_cost: storageCost,
          } as Record<string, unknown>)
          .eq("id", runId);
        console.log(`   ✅ Stored x402.storage URL in run record`);

        // Update the event to completed
        if (storageEventId) {
          await supabase
            .from("x402_job_run_events")
            .update({
              status: "completed",
              amount_paid: storageCost,
              resource_price: storageCost,
              output: { cid: result.details.cid, url: result.details.url },
              completed_at: new Date().toISOString(),
            })
            .eq("id", storageEventId);
        }

        // Broadcast completed event via WebSocket
        if (userId && broadcastRunEvent) {
          broadcastRunEvent(userId, runId, jobId, "run:step", {
            nodeId: "x402-storage",
            status: "completed",
            resourceName: "x402.storage",
            output: { cid: result.details.cid, url: result.details.url },
            paid: storageCost,
          });
        }

        console.log(
          `   📝 Logged x402.storage payment: $${storageCost.toFixed(4)}`,
        );
      } else {
        // Upload failed - update event to failed status
        if (storageEventId) {
          await supabase
            .from("x402_job_run_events")
            .update({
              status: "failed",
              error: result.error || "Storage upload failed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", storageEventId);
        }

        // Broadcast failed event via WebSocket
        if (userId && broadcastRunEvent) {
          broadcastRunEvent(userId, runId, jobId, "run:step", {
            nodeId: "x402-storage",
            status: "failed",
            resourceName: "x402.storage",
            error: result.error || "Storage upload failed",
          });
        }

        console.log(`   ❌ x402.storage upload failed: ${result.error}`);
      }
    }
  }

  console.log(`📤 [POST-TO-DESTINATIONS] Complete. Results:`, results.length);
  return results;
}
