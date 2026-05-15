import { Router } from "express";
import type { Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";
import { createHash, randomBytes } from "crypto";

export const apiKeysRouter: RouterType = Router();

// Generate a secure random API key (32 bytes → 43-char base64url string).
function generateApiKey(): string {
  return randomBytes(32).toString("base64url");
}

// SHA-256 hex digest of a raw API key. Same algorithm used by the
// middleware lookup and the migration 007 backfill — must stay in sync.
function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// GET /api/keys - List user's API keys (without the secret value).
// `key_prefix` is included so the UI can show "abc12345..." per key for
// disambiguation; the full raw key is never returned after creation.
apiKeysRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data: apiKeys, error } = await getSupabase()
      .from("api_keys")
      .select(
        `
        id,
        name,
        description,
        key_prefix,
        created_at,
        last_used_at,
        is_active,
        metadata
      `,
      )
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching API keys:", error);
      return res.status(500).json({
        error: "Failed to fetch API keys",
        message: "Could not retrieve API keys from database",
      });
    }

    res.json({
      success: true,
      data: apiKeys || [],
    });
  } catch (error) {
    console.error("API keys error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// POST /api/keys - Create a new API key
apiKeysRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name is required",
      });
    }

    // Generate the raw key, then store ONLY its hash + prefix. The raw key
    // is returned once in the response below and never persisted in
    // plaintext (closes CRIT-03 from the Phase 28 security review). The
    // legacy `key` column is intentionally left NULL — migration 008 will
    // drop it.
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.slice(0, 8);

    const { data: newKey, error } = await getSupabase()
      .from("api_keys")
      .insert({
        key_hash: apiKeyHash,
        key_prefix: apiKeyPrefix,
        name,
        description: description || null,
        created_by: userId,
        is_active: true,
        metadata: {
          created_at: new Date().toISOString(),
        },
      })
      .select(
        `
        id,
        name,
        description,
        key_prefix,
        created_at,
        last_used_at,
        is_active,
        metadata
      `,
      )
      .single();

    if (error) {
      console.error("Error creating API key:", error);
      return res.status(500).json({
        error: "Failed to create API key",
        message: "Could not save API key to database",
      });
    }

    console.log(
      `✅ API key created: ${newKey.id} (${newKey.name}) by user ${userId}`,
    );

    // Return the API key only once, on creation
    res.status(201).json({
      success: true,
      data: {
        ...newKey,
        key: apiKey, // Only shown once!
      },
    });
  } catch (error) {
    console.error("API keys error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// PUT /api/keys/:id - Update API key
apiKeysRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "No fields to update",
        message: "Provide name and/or description to update",
      });
    }

    const { data: apiKey, error } = await getSupabase()
      .from("api_keys")
      .update(updateData)
      .eq("id", id)
      .eq("created_by", userId)
      .select(
        `
        id,
        name,
        description,
        created_at,
        last_used_at,
        is_active,
        metadata
      `,
      )
      .single();

    if (error || !apiKey) {
      return res.status(404).json({
        error: "API key not found",
        message: "API key does not exist or you don't have access to it",
      });
    }

    console.log(
      `✅ API key updated: ${apiKey.id} (${apiKey.name}) by user ${userId}`,
    );

    res.json({
      success: true,
      data: apiKey,
    });
  } catch (error) {
    console.error("API keys error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// DELETE /api/keys/:id - Revoke API key
apiKeysRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: apiKey, error } = await getSupabase()
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", id)
      .eq("created_by", userId)
      .select(
        `
        id,
        name,
        description,
        created_at,
        last_used_at,
        is_active,
        metadata
      `,
      )
      .single();

    if (error || !apiKey) {
      return res.status(404).json({
        error: "API key not found",
        message: "API key does not exist or you don't have access to it",
      });
    }

    console.log(
      `✅ API key revoked: ${apiKey.id} (${apiKey.name}) by user ${userId}`,
    );

    res.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    console.error("API keys error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// POST /api/keys/:id/reactivate - Reactivate API key
apiKeysRouter.post("/:id/reactivate", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: apiKey, error } = await getSupabase()
      .from("api_keys")
      .update({ is_active: true })
      .eq("id", id)
      .eq("created_by", userId)
      .select(
        `
        id,
        name,
        description,
        created_at,
        last_used_at,
        is_active,
        metadata
      `,
      )
      .single();

    if (error || !apiKey) {
      return res.status(404).json({
        error: "API key not found",
        message: "API key does not exist or you don't have access to it",
      });
    }

    console.log(
      `✅ API key reactivated: ${apiKey.id} (${apiKey.name}) by user ${userId}`,
    );

    res.json({
      success: true,
      data: apiKey,
    });
  } catch (error) {
    console.error("API keys error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});
