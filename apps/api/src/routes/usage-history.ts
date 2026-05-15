import { Router } from "express";
import type { Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";

export const usageHistoryRouter: RouterType = Router();

/**
 * GET /api/v1/resources/:templateId/usage-history
 *
 * Returns the authenticated user's execution history for a prompt template.
 * Paginated with limit and offset query parameters.
 */
usageHistoryRouter.get(
  "/resources/:templateId/usage-history",
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const templateId = req.params.templateId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const supabase = getSupabase();

    // Get user's executions for this template
    const {
      data: logs,
      error,
      count,
    } = await supabase
      .from("x402_prompt_template_usage_logs")
      .select(
        "id, status, created_at, amount_paid, input_tokens, output_tokens, execution_time_ms, error_message",
        { count: "exact" },
      )
      .eq("template_id", templateId)
      .eq("caller_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[UsageHistory] Error:", error);
      return res.status(500).json({ error: "Failed to fetch history" });
    }

    return res.json({
      executions: logs || [],
      pagination: {
        total: count || 0,
        offset,
        limit,
      },
    });
  },
);
