import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { getSupabase } from "../lib/supabase";

/**
 * Hash an API key for lookup. SHA-256 hex — same algorithm used by the
 * backfill in migration 007. If you change this, you must re-backfill.
 */
function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// Extend Express Request to include API key info
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        name: string;
        created_by: string;
        tier: "free" | "paid";
      };
    }
  }
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  created_at: string;
  created_by?: string | null;
  last_used_at?: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
}

/**
 * API key middleware for x402jobs public API.
 * - Reads API key from header: `x-api-key` or `Authorization: Bearer <key>`
 * - Validates against api_keys table in database
 * - Tracks last_used_at timestamp for each key
 * - Attaches API key info to request object
 */
export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const providedKey =
    (req.headers["x-api-key"] as string | undefined) ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.substring(7)
      : undefined);

  if (!providedKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message:
        "API key required. Provide via x-api-key header or Authorization: Bearer header",
    });
  }

  try {
    // Look up by SHA-256 of the provided key. The plaintext `key` column
    // exists for the transition window only — it'll be dropped in migration
    // 008. Never store or compare plaintext keys.
    const providedKeyHash = hashApiKey(providedKey);

    const { data, error } = await getSupabase()
      .from("api_keys")
      .select("*")
      .eq("key_hash", providedKeyHash)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or inactive API key",
      });
    }

    const apiKey: ApiKey = data;

    // Update last_used_at (fire and forget)
    getSupabase()
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id)
      .then(
        () => {},
        () => {},
      );

    // Read tier from metadata, default to "paid" for existing keys
    const tier = (apiKey.metadata as Record<string, unknown>)?.tier as
      | "free"
      | "paid"
      | undefined;

    // Attach API key info to request
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      created_by: apiKey.created_by || "",
      tier: tier || "paid", // Default to paid for backwards compatibility
    };

    next();
  } catch (error) {
    console.error("API key validation error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to validate API key",
    });
  }
}
