import { Request, Response, NextFunction } from "express";
import { getSupabase } from "../lib/supabase";

// Note: Request.apiKey type is defined in ./apiKey.ts

/**
 * Optional API key middleware for discovery API endpoints.
 *
 * Unlike apiKeyMiddleware, this does NOT require an API key.
 * - If no key provided: continues (free tier with rate limits)
 * - If valid key provided: attaches apiKey info including tier
 * - If invalid key provided: returns 401
 *
 * Tier is read from metadata.tier, defaulting to "paid" for backwards compatibility.
 */
export async function optionalApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const providedKey =
    (req.headers["x-api-key"] as string | undefined) ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.substring(7)
      : undefined);

  // No key provided - continue as free tier (will be rate limited)
  if (!providedKey) {
    return next();
  }

  try {
    // Validate API key against database
    const { data, error } = await getSupabase()
      .from("api_keys")
      .select("id, name, created_by, is_active, metadata")
      .eq("key", providedKey)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or inactive API key",
      });
    }

    // Update last_used_at (fire and forget)
    getSupabase()
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(
        () => {},
        () => {},
      );

    // Read tier from metadata, default to "paid" for existing keys
    const tier = (data.metadata as Record<string, unknown>)?.tier as
      | "free"
      | "paid"
      | undefined;

    // Attach API key info to request with tier
    req.apiKey = {
      id: data.id,
      name: data.name,
      created_by: data.created_by || "",
      tier: tier || "paid", // Default to paid for backwards compatibility
    };

    next();
  } catch (error) {
    console.error("Optional API key validation error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to validate API key",
    });
  }
}
