import { z } from "zod";

// ============================================================================
// OpenRouter Configuration
// ============================================================================

/**
 * Configuration for OpenRouter model execution.
 * Stored as JSONB in openrouter_config column.
 */
export interface OpenRouterConfig {
  systemPrompt: string;
  temperature?: number; // 0-2, default 1
  maxTokens?: number; // model-specific, default 4096
  topP?: number; // 0-1
  frequencyPenalty?: number; // -2 to 2
  presencePenalty?: number; // -2 to 2
}

// ============================================================================
// OpenRouter Parameter
// ============================================================================

/**
 * Schema for a single parameter in an OpenRouter resource.
 * Parameters are placeholders in the system prompt that callers fill in.
 *
 * All parameters are string-based substitution (no type field).
 * Uses {param}{/param} syntax in the system prompt.
 */
export const openRouterParameterSchema = z.object({
  name: z.string().min(1, "Parameter name required"),
  description: z.string().default(""),
  required: z.boolean().default(true),
  default: z.string().optional(),
});

export type OpenRouterParameter = z.infer<typeof openRouterParameterSchema>;

// ============================================================================
// Creation Schema (Form Submission)
// ============================================================================

/**
 * Schema for creating a new OpenRouter instant resource.
 * Used in the creator form with react-hook-form + zod validation.
 */
export const createOpenRouterResourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only",
    ),
  description: z.string().max(500).optional(),
  category: z.string().min(1, "Category is required"),
  avatar_url: z.string().url().optional().or(z.literal("")),
  price_usdc: z
    .string()
    .refine(
      (val) => !val || parseFloat(val) >= 0.001,
      "Price must be at least $0.001",
    ),
  network: z.enum(["base", "solana"]),
  model_id: z.string().uuid("Valid model ID required"),
  system_prompt: z.string().min(1, "System prompt is required"),
  parameters: z.array(openRouterParameterSchema).default([]),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(128000).optional(),
  allows_user_message: z.boolean().default(false),
});

export type CreateOpenRouterResourceInput = z.infer<
  typeof createOpenRouterResourceSchema
>;

// ============================================================================
// OpenRouter Resource Public View (Caller View)
// ============================================================================

/**
 * Public view of an OpenRouter resource for callers.
 * SECURITY: Excludes system_prompt - callers should not see the template.
 *
 * Parameters are visible for form generation on the caller side.
 */
export interface OpenRouterResourcePublicView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: "solana" | "base";
  price_usdc: string;
  avatar_url: string | null;
  category: string | null;
  // Model info
  model_id: string;
  model_name?: string;
  // Parameters visible (for form generation)
  parameters: OpenRouterParameter[];
  max_tokens: number;
  allows_user_message: boolean;
  // Stats
  usage_count?: number;
  // Ownership info (for owner testing)
  server_verified_owner_id?: string | null;
  registered_by?: string | null;
}
