import { Router } from "express";
import type { Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";

export const aiModelsRouter: RouterType = Router();

/**
 * GET /api/v1/ai-models
 * Public endpoint - returns all active AI models for model browser UI
 */
aiModelsRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabase();

    // Query active AI models, order by display name
    const { data: models, error } = await supabase
      .from("x402_openrouter_models")
      .select(
        `
        id,
        openrouter_id,
        display_name,
        description,
        provider,
        modality,
        is_curated,
        context_length,
        pricing_prompt,
        pricing_completion,
        vision_supported,
        web_search_supported,
        tool_calling_supported
      `,
      )
      .eq("is_active", true)
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Error fetching AI models:", error);
      return res.status(500).json({ error: "Failed to fetch AI models" });
    }

    return res.json({ models: models || [] });
  } catch (err) {
    console.error("Error in ai-models endpoint:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
