import { z } from "zod";

// ============================================================================
// Resource Type Union
// ============================================================================

/**
 * All available resource types in the system.
 * 'prompt_template' is the new AI prompt monetization type.
 */
export type ResourceType =
  | "external"
  | "proxy"
  | "prompt"
  | "static"
  | "prompt_template";

// ============================================================================
// Prompt Template Parameter
// ============================================================================

/**
 * Schema for a single parameter in a prompt template.
 * Parameters are placeholders in the system prompt that callers fill in.
 *
 * All parameters are string-based substitution (no type field).
 * Uses {param}{/param} syntax in the system prompt.
 */
export const promptTemplateParameterSchema = z.object({
  name: z.string().min(1, "Parameter name required"),
  description: z.string().default(""),
  required: z.boolean().default(true),
  default: z.string().optional(),
});

export type PromptTemplateParameter = z.infer<
  typeof promptTemplateParameterSchema
>;

// ============================================================================
// Prompt Template Core
// ============================================================================

/**
 * Schema for the core prompt template configuration.
 * This is the AI prompt that gets assembled with parameters.
 */
export const promptTemplateSchema = z.object({
  system_prompt: z.string().min(1, "System prompt required"),
  parameters: z.array(promptTemplateParameterSchema).default([]),
  model: z.string().default("claude-sonnet-4-20250514"),
  max_tokens: z.number().int().min(1).max(8192).default(4096),
  allows_user_message: z.boolean().default(false),
});

export type PromptTemplate = z.infer<typeof promptTemplateSchema>;

// ============================================================================
// Prompt Template Resource (Full Creator View)
// ============================================================================

/**
 * Full prompt template resource as stored in the database.
 * Used in creator dashboard and editing interfaces.
 *
 * Database fields are prefixed with pt_ for prompt template specific data.
 */
export interface PromptTemplateResource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: "solana" | "base";
  price_usdc: string;
  resource_type: "prompt_template";
  avatar_url: string | null;
  category: string | null;
  created_at: string;
  is_active: boolean;
  call_count: number;
  total_earned_usdc: number;
  // Prompt template specific fields (prefixed with pt_)
  pt_system_prompt: string;
  pt_parameters: PromptTemplateParameter[];
  pt_model: string;
  pt_max_tokens: number;
  pt_allows_user_message: boolean;
  // Indicates if an API key is stored (never expose actual key to frontend)
  pt_has_api_key?: boolean;
}

// ============================================================================
// Prompt Template Public View (Caller View)
// ============================================================================

/**
 * Public view of a prompt template for callers.
 * SECURITY: Excludes system_prompt - callers should not see the template.
 *
 * Parameters are visible for form generation on the caller side.
 */
export interface PromptTemplatePublicView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: "solana" | "base";
  price_usdc: string;
  avatar_url: string | null;
  category: string | null;
  // Parameters visible (for form generation)
  parameters: PromptTemplateParameter[];
  model: string;
  max_tokens: number;
  allows_user_message: boolean;
  // Stats
  usage_count?: number;
  // Ownership info (for owner testing)
  server_verified_owner_id?: string | null;
  registered_by?: string | null;
}

// ============================================================================
// Creation Schema (Form Submission)
// ============================================================================

/**
 * Schema for creating a new prompt template resource.
 * Used in the creator form with react-hook-form + zod validation.
 */
export const createPromptTemplateSchema = z.object({
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
  system_prompt: z.string().min(1, "System prompt is required"),
  parameters: z.array(promptTemplateParameterSchema).default([]),
  max_tokens: z.number().int().min(1).max(8192).default(4096),
  allows_user_message: z.boolean().default(false),
  // API key is now managed at user-level via Claude integration (Dashboard > Integrations)
});

export type CreatePromptTemplateInput = z.infer<
  typeof createPromptTemplateSchema
>;
