/**
 * Sync OpenRouter Models to x402_openrouter_models Table
 *
 * Daily cron job that fetches all models from OpenRouter API and
 * syncs them to the x402_openrouter_models table with modality categorization
 * and capability detection. Preserves manual is_curated flags.
 */

import { inngest } from "../../lib/inngest";
import { getSupabase } from "../../lib/supabase";

// ============================================================================
// Types from OpenRouter API
// ============================================================================

interface OpenRouterAPIModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    name?: string;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    web_search?: string;
  };
}

interface OpenRouterAPIResponse {
  data?: OpenRouterAPIModel[];
}

// ============================================================================
// Helper Functions (ported from packages/services/scripts/update-openrouter-models.ts)
// ============================================================================

/**
 * Format provider name for display
 */
function formatProviderName(provider: string): string {
  const providerMap: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    "x-ai": "X.AI",
    "meta-llama": "Meta",
    mistralai: "Mistral AI",
    deepseek: "DeepSeek",
    perplexity: "Perplexity",
    cohere: "Cohere",
    "01-ai": "01.AI",
    qwen: "Qwen",
    together: "Together AI",
    anyscale: "Anyscale",
    fireworks: "Fireworks",
    groq: "Groq",
  };

  return providerMap[provider.toLowerCase()] || provider;
}

/**
 * Format model name for display
 */
function formatModelName(modelId: string, apiName?: string): string {
  // Use API name if available and looks good
  if (apiName && apiName.length < 50) {
    return apiName;
  }

  // Extract model name from ID (e.g., "openai/gpt-4o" -> "GPT-4o")
  const parts = modelId.split("/");
  if (parts.length < 2) return modelId;

  const modelPart = parts[1];
  if (!modelPart || modelPart.trim() === "") {
    return modelId;
  }

  // Clean up model name
  let name = modelPart
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, "-");

  // Handle special cases
  if (name.includes("Gpt")) name = name.replace(/Gpt/g, "GPT");
  if (name.includes("Claude")) name = name.replace(/Claude/g, "Claude");
  if (name.includes("Gemini")) name = name.replace(/Gemini/g, "Gemini");
  if (name.includes("Grok")) name = name.replace(/Grok/g, "Grok");
  if (name.includes("Llama")) name = name.replace(/Llama/g, "Llama");

  return name;
}

/**
 * Check if model supports vision from architecture data
 */
function detectVisionSupport(model: OpenRouterAPIModel): boolean {
  // Check input_modalities array for "image"
  const inputModalities = model.architecture?.input_modalities || [];
  if (inputModalities.includes("image")) {
    return true;
  }

  // Check modality string
  const modality = model.architecture?.modality?.toLowerCase() || "";
  if (
    modality.includes("vision") ||
    modality.includes("image") ||
    modality.includes("multimodal")
  ) {
    return true;
  }

  // Check model ID for common vision model patterns
  const modelId = model.id.toLowerCase();
  if (
    modelId.includes("vision") ||
    modelId.includes("gpt-4o") ||
    modelId.includes("gpt-4-vision") ||
    modelId.includes("grok") ||
    modelId.includes("gemini") ||
    modelId.includes("claude-3") ||
    modelId.includes("pixtral") ||
    modelId.includes("qwen2.5-vl")
  ) {
    return true;
  }

  return false;
}

/**
 * Check if model supports web search
 */
function detectWebSearchSupport(model: OpenRouterAPIModel): boolean {
  // Check if pricing.web_search exists and is not "0"
  const webSearchPricing = model.pricing?.web_search;
  if (
    webSearchPricing &&
    webSearchPricing !== "0" &&
    webSearchPricing !== "-1"
  ) {
    return true;
  }

  // Check model ID for search variants
  if (model.id.includes("search")) {
    return true;
  }

  return false;
}

/**
 * Check if model supports tool/function calling
 * Only mark as true if we have positive evidence - be conservative
 */
function detectToolCallingSupport(model: OpenRouterAPIModel): boolean {
  // Exclude embedding models and image-only models first
  const modelId = model.id.toLowerCase();
  if (
    modelId.includes("embedding") ||
    modelId.includes("image-generation") ||
    modelId.includes("text-to-image") ||
    modelId.includes("image-to-text") ||
    modelId.includes("tts") || // Text-to-speech
    modelId.includes("stt") || // Speech-to-text
    modelId.includes("audio") ||
    modelId.includes("-rp-") || // Roleplay models
    modelId.includes("roleplay") || // Roleplay models
    modelId.includes("uncensored") || // Uncensored/fine-tuned models
    modelId.includes("nsfw") || // NSFW models
    modelId.includes("chatml") || // ChatML format models (often don't support tools)
    (modelId.includes("instruct") && modelId.includes("fine")) // Fine-tuned instruct models
  ) {
    return false;
  }

  // Check architecture for function calling support indicators
  const instructType = model.architecture?.instruct_type?.toLowerCase() || "";

  // Chat/instruct models typically support function calling
  if (
    instructType.includes("chat") ||
    instructType.includes("instruct") ||
    instructType.includes("function")
  ) {
    return true;
  }

  // Check model ID for known function-calling model families
  const functionCallingModels = [
    "gpt-", // OpenAI GPT models
    "claude-", // Anthropic Claude
    "gemini-", // Google Gemini
    "grok-", // X.AI Grok
    "llama-3", // Meta Llama 3+
    "llama-3.1", // Meta Llama 3.1+
    "mistral", // Mistral AI models
    "mixtral", // Mixtral models
    "deepseek", // DeepSeek models
    "qwen", // Qwen models
    "command-r", // Cohere Command R
    "command-r-plus", // Cohere Command R+
    "sonar", // Perplexity Sonar
    "pixtral", // Mistral Pixtral
    "o1", // OpenAI O1 models
    "o3", // OpenAI O3 models
  ];

  if (functionCallingModels.some((pattern) => modelId.includes(pattern))) {
    return true;
  }

  // Check if it's a completion model (these typically don't support function calling)
  if (
    modelId.includes("completion") ||
    modelId.includes("base") ||
    modelId.includes("pretrained")
  ) {
    return false;
  }

  // Default: conservative - assume false unless we have evidence
  return false;
}

/**
 * Detect modality from OpenRouter architecture data
 * NEW: Categorizes models into text/image/video/audio/embedding/multimodal
 */
function detectModality(model: OpenRouterAPIModel): string {
  const outputModalities = model.architecture?.output_modalities || [];
  const inputModalities = model.architecture?.input_modalities || [];

  // Check output modality first (what the model produces)
  if (outputModalities.includes("image")) return "image";
  if (outputModalities.includes("video")) return "video";
  if (outputModalities.includes("audio")) return "audio";

  // Check if embedding model
  const modality = model.architecture?.modality?.toLowerCase() || "";
  if (modality.includes("embedding") || model.id.includes("embedding"))
    return "embedding";

  // Check if multimodal input (can process images/audio but outputs text)
  if (inputModalities.includes("image") || inputModalities.includes("audio"))
    return "multimodal";

  // Default to text for chat/completion models
  return "text";
}

// ============================================================================
// Shared Sync Logic
// ============================================================================

async function performModelSync(logger: any) {
  // Step 1: Fetch models from OpenRouter
  const models = await (async () => {
    logger.info("Fetching models from OpenRouter API...");
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok)
      throw new Error(`OpenRouter API error: ${response.status}`);
    const data: OpenRouterAPIResponse = await response.json();
    if (!data.data) throw new Error("Invalid response format");
    logger.info(`Fetched ${data.data.length} models`);
    return data.data;
  })();

  // Step 2: Transform and upsert
  const result = await (async () => {
    const supabase = getSupabase();

    // Filter and transform models
    const modelsToUpsert = models
      .filter((model) => {
        // Only include text generation models (exclude embeddings, image-only, etc.)
        const modality = model.architecture?.modality;
        const inputModalities = model.architecture?.input_modalities || [];

        // Include if it has text input or text+image input
        const hasTextInput =
          !modality ||
          modality.includes("text") ||
          inputModalities.includes("text");

        // Exclude embeddings
        const isEmbedding =
          modality?.includes("embedding") || model.id.includes("embedding");

        return hasTextInput && !isEmbedding;
      })
      .map((model) => {
        // Extract provider from model ID
        const parts = model.id.split("/");
        const provider = parts[0];
        if (!provider || provider.trim() === "") {
          throw new Error(`Invalid model ID format: ${model.id}`);
        }
        const providerName = formatProviderName(provider);

        // Generate display names
        const memeputerName = formatModelName(model.id, model.name);
        const displayName = formatModelName(model.id, model.name);

        // Estimate max tokens from context length
        const maxTokens = model.context_length
          ? Math.min(Math.floor(model.context_length * 0.8), 8000)
          : 4000;

        // Detect capabilities
        const visionSupported = detectVisionSupport(model);
        const webSearchSupported = detectWebSearchSupport(model);
        const toolCallingSupported = detectToolCallingSupport(model);

        // NEW: Detect modality
        const modality = detectModality(model);

        // MODL-02 Required Field Mappings:
        return {
          openrouter_id: model.id, // id - unique identifier
          memeputer_name: memeputerName, // name - display name
          display_name: displayName,
          description:
            model.description || model.name || `${providerName} model`,
          provider: providerName, // provider - extracted from model.id
          modality: modality, // modality - text/image/video/audio/embedding/multimodal
          input_cost_per_million: model.pricing?.prompt // input pricing
            ? parseFloat(model.pricing.prompt) * 1000000
            : null,
          output_cost_per_million: model.pricing?.completion // output pricing
            ? parseFloat(model.pricing.completion) * 1000000
            : null,
          context_length: model.context_length || null, // context length
          max_tokens: maxTokens,
          capabilities: {
            // capabilities object
            vision: visionSupported,
            web_search: webSearchSupported,
            tool_calling: toolCallingSupported,
          },
          // Legacy fields (kept for backward compatibility)
          web_search_supported: webSearchSupported,
          vision_supported: visionSupported,
          tool_calling_supported: toolCallingSupported,
          pricing_prompt: model.pricing?.prompt || null,
          pricing_completion: model.pricing?.completion || null,
          pricing_image: model.pricing?.image || null,
          pricing_web_search: model.pricing?.web_search || null,
          is_active: true,
          last_synced_at: new Date().toISOString(),
          // NOTE: Do NOT include is_curated - preserve manual curation
        };
      });

    // Upsert with onConflict
    const { error } = await supabase.from("x402_openrouter_models").upsert(modelsToUpsert, {
      onConflict: "openrouter_id",
      ignoreDuplicates: false,
    });

    if (error) throw error;

    // Calculate stats
    return {
      total: modelsToUpsert.length,
      text: modelsToUpsert.filter((m) => m.modality === "text").length,
      image: modelsToUpsert.filter((m) => m.modality === "image").length,
      video: modelsToUpsert.filter((m) => m.modality === "video").length,
      audio: modelsToUpsert.filter((m) => m.modality === "audio").length,
      embedding: modelsToUpsert.filter((m) => m.modality === "embedding")
        .length,
      multimodal: modelsToUpsert.filter((m) => m.modality === "multimodal")
        .length,
    };
  })();

  logger.info("Sync complete", result);
  return result;
}

// ============================================================================
// Cron Function - Daily sync at 3am UTC
// ============================================================================

export const syncOpenRouterModels = inngest.createFunction(
  {
    id: "sync-openrouter-models",
    retries: 2,
  },
  { cron: "0 3 * * *" }, // 3am UTC daily
  async ({ step, logger }) => {
    // Step 1: Fetch models from OpenRouter
    const models = await step.run("fetch-openrouter-models", async () => {
      logger.info("Fetching models from OpenRouter API...");
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok)
        throw new Error(`OpenRouter API error: ${response.status}`);
      const data: OpenRouterAPIResponse = await response.json();
      if (!data.data) throw new Error("Invalid response format");
      logger.info(`Fetched ${data.data.length} models`);
      return data.data;
    });

    // Step 2: Transform and upsert
    const result = await step.run("upsert-models", async () => {
      const supabase = getSupabase();

      // Filter and transform models
      const modelsToUpsert = models
        .filter((model) => {
          // Only include text generation models (exclude embeddings, image-only, etc.)
          const modality = model.architecture?.modality;
          const inputModalities = model.architecture?.input_modalities || [];

          // Include if it has text input or text+image input
          const hasTextInput =
            !modality ||
            modality.includes("text") ||
            inputModalities.includes("text");

          // Exclude embeddings
          const isEmbedding =
            modality?.includes("embedding") || model.id.includes("embedding");

          return hasTextInput && !isEmbedding;
        })
        .map((model) => {
          // Extract provider from model ID
          const parts = model.id.split("/");
          const provider = parts[0];
          if (!provider || provider.trim() === "") {
            throw new Error(`Invalid model ID format: ${model.id}`);
          }
          const providerName = formatProviderName(provider);

          // Generate display names
          const memeputerName = formatModelName(model.id, model.name);
          const displayName = formatModelName(model.id, model.name);

          // Estimate max tokens from context length
          const maxTokens = model.context_length
            ? Math.min(Math.floor(model.context_length * 0.8), 8000)
            : 4000;

          // Detect capabilities
          const visionSupported = detectVisionSupport(model);
          const webSearchSupported = detectWebSearchSupport(model);
          const toolCallingSupported = detectToolCallingSupport(model);

          // NEW: Detect modality
          const modality = detectModality(model);

          // MODL-02 Required Field Mappings:
          return {
            openrouter_id: model.id, // id - unique identifier
            memeputer_name: memeputerName, // name - display name
            display_name: displayName,
            description:
              model.description || model.name || `${providerName} model`,
            provider: providerName, // provider - extracted from model.id
            modality: modality, // modality - text/image/video/audio/embedding/multimodal
            input_cost_per_million: model.pricing?.prompt // input pricing
              ? parseFloat(model.pricing.prompt) * 1000000
              : null,
            output_cost_per_million: model.pricing?.completion // output pricing
              ? parseFloat(model.pricing.completion) * 1000000
              : null,
            context_length: model.context_length || null, // context length
            max_tokens: maxTokens,
            capabilities: {
              // capabilities object
              vision: visionSupported,
              web_search: webSearchSupported,
              tool_calling: toolCallingSupported,
            },
            // Legacy fields (kept for backward compatibility)
            web_search_supported: webSearchSupported,
            vision_supported: visionSupported,
            tool_calling_supported: toolCallingSupported,
            pricing_prompt: model.pricing?.prompt || null,
            pricing_completion: model.pricing?.completion || null,
            pricing_image: model.pricing?.image || null,
            pricing_web_search: model.pricing?.web_search || null,
            is_active: true,
            last_synced_at: new Date().toISOString(),
            // NOTE: Do NOT include is_curated - preserve manual curation
          };
        });

      // Upsert with onConflict
      const { error } = await supabase
        .from("x402_openrouter_models")
        .upsert(modelsToUpsert, {
          onConflict: "openrouter_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Calculate stats
      return {
        total: modelsToUpsert.length,
        text: modelsToUpsert.filter((m) => m.modality === "text").length,
        image: modelsToUpsert.filter((m) => m.modality === "image").length,
        video: modelsToUpsert.filter((m) => m.modality === "video").length,
        audio: modelsToUpsert.filter((m) => m.modality === "audio").length,
        embedding: modelsToUpsert.filter((m) => m.modality === "embedding")
          .length,
        multimodal: modelsToUpsert.filter((m) => m.modality === "multimodal")
          .length,
      };
    });

    // Step 3: Deactivate models no longer on OpenRouter
    const deactivated = await step.run("deactivate-removed-models", async () => {
      const supabase = getSupabase();
      const syncedIds = models.map((m) => m.id);

      // Find active models not in the latest fetch
      const { data: staleModels, error: fetchError } = await supabase
        .from("x402_openrouter_models")
        .select("openrouter_id")
        .eq("is_active", true)
        .not("openrouter_id", "in", `(${syncedIds.map((id) => `"${id}"`).join(",")})`);

      if (fetchError) {
        logger.error("Failed to find stale models", fetchError);
        return { deactivated: 0 };
      }

      if (!staleModels || staleModels.length === 0) {
        return { deactivated: 0 };
      }

      const staleIds = staleModels.map((m) => m.openrouter_id);

      const { error: updateError } = await supabase
        .from("x402_openrouter_models")
        .update({ is_active: false })
        .in("openrouter_id", staleIds);

      if (updateError) {
        logger.error("Failed to deactivate stale models", updateError);
        return { deactivated: 0 };
      }

      logger.info(`Deactivated ${staleIds.length} removed models`, { staleIds });
      return { deactivated: staleIds.length };
    });

    logger.info("Sync complete", { ...result, ...deactivated });
    return { ...result, ...deactivated };
  },
);

// ============================================================================
// Manual Trigger Function
// ============================================================================

export const triggerModelSync = inngest.createFunction(
  {
    id: "trigger-model-sync",
    retries: 1,
  },
  { event: "x402/models.sync" },
  async ({ logger }) => {
    logger.info("Manual model sync triggered");
    return performModelSync(logger);
  },
);
