"use strict";

import crypto from "crypto";
import { Router, Request, Response } from "express";
import { TwitterApi } from "twitter-api-v2";
import { config } from "../config";
import { authMiddleware } from "../middleware/auth";
import { getSupabase } from "../lib/supabase";
import { encryptSecret, decryptSecret } from "../lib/instant/encrypt";
import { getDecryptedXTokens } from "../lib/x-tokens";

// Twitter OAuth pending-state TTL. Twitter's authorize page typically
// completes well inside 10 minutes; expired rows trip state_expired.
const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;

export const integrationsRouter: Router = Router();

// === Telegram helpers ===
function truncateCaption(caption: string): string {
  const max = 1024;
  if (caption.length <= max) return caption;
  return caption.slice(0, max - 3) + "...";
}

async function sendTelegramPhoto(
  botToken: string,
  chatId: string,
  imageUrl: string,
  caption?: string,
) {
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: imageUrl,
  };

  if (caption) {
    body.caption = truncateCaption(caption);
    body.parse_mode = "HTML";
  }

  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };
  return data;
}

// === Telegram routes ===
integrationsRouter.get(
  "/telegram/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { data, error } = await getSupabase()
        .from("x402_user_telegram_configs")
        .select("default_chat_id, is_enabled, bot_token")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching telegram config", error);
        return res
          .status(500)
          .json({ error: "Failed to load Telegram settings" });
      }

      res.json({
        hasBotToken: Boolean(data?.bot_token),
        defaultChatId: data?.default_chat_id || null,
        isEnabled: data?.is_enabled ?? false,
      });
    } catch (err) {
      console.error("Telegram config error", err);
      res.status(500).json({ error: "Failed to load Telegram settings" });
    }
  },
);

integrationsRouter.put(
  "/telegram/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { botToken, defaultChatId, isEnabled } = req.body || {};

      // Check if user already has a config
      const { data: existing } = await getSupabase()
        .from("x402_user_telegram_configs")
        .select("bot_token")
        .eq("user_id", userId)
        .single();

      // If no botToken provided and no existing token, error
      if (!botToken && !existing?.bot_token) {
        return res.status(400).json({ error: "botToken is required" });
      }

      // Use new token if provided, otherwise keep existing
      const finalBotToken = botToken || existing?.bot_token;

      const { error } = await getSupabase()
        .from("x402_user_telegram_configs")
        .upsert({
          user_id: userId,
          bot_token: finalBotToken,
          default_chat_id: defaultChatId || null,
          is_enabled: isEnabled ?? true,
        });

      if (error) {
        console.error("Error saving telegram config", error);
        return res
          .status(500)
          .json({ error: "Failed to save Telegram settings" });
      }

      res.json({
        success: true,
        hasBotToken: true,
        defaultChatId: defaultChatId || null,
        isEnabled: isEnabled ?? true,
      });
    } catch (err) {
      console.error("Telegram config save error", err);
      res.status(500).json({ error: "Failed to save Telegram settings" });
    }
  },
);

/**
 * DELETE /integrations/telegram/config
 * Remove Telegram integration for the current user
 */
integrationsRouter.delete(
  "/telegram/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { error } = await getSupabase()
        .from("x402_user_telegram_configs")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting Telegram config", error);
        return res
          .status(500)
          .json({ error: "Failed to delete Telegram settings" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Telegram config delete error", err);
      res.status(500).json({ error: "Failed to delete Telegram settings" });
    }
  },
);

integrationsRouter.post(
  "/telegram/post",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { chatId, imageUrl, caption, botToken } = req.body || {};

      if (!imageUrl) {
        return res
          .status(400)
          .json({ error: "imageUrl is required to post to Telegram" });
      }

      // Load stored config if token/chatId not provided
      let finalBotToken = botToken as string | undefined;
      let finalChatId = chatId as string | undefined;

      if (!finalBotToken || !finalChatId) {
        const { data } = await getSupabase()
          .from("x402_user_telegram_configs")
          .select("bot_token, default_chat_id")
          .eq("user_id", userId)
          .single();

        finalBotToken = finalBotToken || data?.bot_token || undefined;
        finalChatId = finalChatId || data?.default_chat_id || undefined;
      }

      if (!finalBotToken) {
        return res.status(400).json({
          error:
            "botToken is required. Provide one in the request or save it in your Telegram settings.",
        });
      }
      if (!finalChatId) {
        return res.status(400).json({
          error:
            "chatId is required. Provide one in the request or set a default chat id in settings.",
        });
      }

      const result = await sendTelegramPhoto(
        finalBotToken,
        finalChatId,
        imageUrl,
        caption,
      );

      if (!result.ok) {
        return res.status(400).json({
          success: false,
          error: result.description || "Telegram API rejected the request",
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Telegram post error", err);
      res.status(500).json({ error: "Failed to post to Telegram" });
    }
  },
);

// === X (Twitter) helpers ===
// Pending OAuth state is persisted in the x402_oauth_pending Postgres table
// (HIGH-02 / plan 28-08). Replaces the legacy in-memory cache that leaked
// memory across deploys and provided no CSRF nonce.

function requireTwitterConfig(res: Response): boolean {
  if (!config.twitter.apiKey || !config.twitter.apiSecret) {
    res
      .status(500)
      .json({ error: "Twitter API keys are not configured on the server" });
    return false;
  }
  return true;
}

integrationsRouter.post(
  "/x/oauth/initiate",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      if (!requireTwitterConfig(res)) return;

      const userId = req.user!.id;
      const callbackUrl = config.twitter.callbackUrl;

      const twitterClient = new TwitterApi({
        appKey: config.twitter.apiKey,
        appSecret: config.twitter.apiSecret,
      });

      const authLink = await twitterClient.generateAuthLink(callbackUrl, {
        linkMode: "authorize",
      });

      // CSRF nonce — 256 bits of entropy, base64url-encoded (~43 chars).
      // Stored as PK of x402_oauth_pending; collisions are 2^-256.
      const state = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + OAUTH_PENDING_TTL_MS).toISOString();

      // Persist pending row. We store both `state` (CSRF nonce / PK) and
      // `oauth_token` (Twitter's token, used as the callback lookup key —
      // Twitter OAuth1.0a does NOT echo `state` back). `code_verifier`
      // column holds Twitter's oauth_token_secret for this flow.
      const { error: insertErr } = await getSupabase()
        .from("x402_oauth_pending")
        .insert({
          state,
          user_id: userId,
          oauth_token: authLink.oauth_token,
          code_verifier: authLink.oauth_token_secret,
          provider: "twitter",
          expires_at: expiresAt,
        });

      if (insertErr) {
        console.error(
          "[integrations/x/oauth/initiate] failed to persist oauth state",
          insertErr,
        );
        return res.status(500).json({ error: "oauth_init_failed" });
      }

      res.json({
        success: true,
        oauthUrl: authLink.url,
        oauthToken: authLink.oauth_token,
        state,
      });
    } catch (err) {
      console.error("Twitter OAuth initiate error", err);
      res.status(500).json({ error: "Failed to start Twitter OAuth" });
    }
  },
);

integrationsRouter.get(
  "/x/oauth/callback",
  async (req: Request, res: Response) => {
    try {
      const { oauth_token, oauth_verifier } = req.query;

      // state_missing — Twitter OAuth1.0a callbacks always carry
      // oauth_token + oauth_verifier; their absence means a malformed
      // / forged callback (no row to look up).
      if (!oauth_token || !oauth_verifier) {
        return res.status(400).json({ error: "state_missing" });
      }

      // Look up pending row by oauth_token (Twitter's lookup key — Twitter
      // does not echo our `state` PK back through OAuth1.0a callbacks).
      // The CSRF guarantee here is that oauth_token was generated by
      // Twitter inside the originating request's response — an attacker
      // cannot guess a valid oauth_token without intercepting the init
      // response.
      const { data: pending, error: fetchErr } = await getSupabase()
        .from("x402_oauth_pending")
        .select("state, user_id, code_verifier, expires_at")
        .eq("oauth_token", oauth_token as string)
        .maybeSingle();

      if (fetchErr) {
        console.error(
          "[integrations/x/oauth/callback] pending fetch failed",
          fetchErr,
        );
        return res.status(500).json({ error: "oauth_lookup_failed" });
      }

      // state_invalid — no row matches. Either the state was forged or
      // the pending row was already consumed (single-use semantics) or
      // a sweeper deleted it.
      if (!pending) {
        return res.status(400).json({ error: "state_invalid" });
      }

      // state_expired — past TTL. Delete the row to avoid replay attempts
      // (a future request with the same oauth_token would otherwise hit
      // state_invalid which is indistinguishable from a never-existed
      // row; deleting here makes the semantics consistent).
      if (Date.now() > new Date(pending.expires_at as string).getTime()) {
        await getSupabase()
          .from("x402_oauth_pending")
          .delete()
          .eq("state", pending.state as string);
        return res.status(400).json({ error: "state_expired" });
      }

      if (!config.twitter.apiKey || !config.twitter.apiSecret) {
        return res.status(500).send("Twitter API keys not configured.");
      }

      const tempClient = new TwitterApi({
        appKey: config.twitter.apiKey,
        appSecret: config.twitter.apiSecret,
        accessToken: oauth_token as string,
        accessSecret: pending.code_verifier as string,
      });

      const {
        client: userClient,
        accessToken,
        accessSecret,
      } = await tempClient.login(oauth_verifier as string);

      const me = await userClient.v2.me({
        "user.fields": ["profile_image_url", "name", "username"],
      });

      // Dual-write: ship both plaintext (legacy) and ciphertext (target)
      // columns. After dual-write proves stable in production for 24+
      // hours, a follow-up v3.1 migration will DROP the plaintext columns
      // and this code can switch to ciphertext-only writes.
      const accessTokenCiphertext = encryptSecret(accessToken);
      const accessSecretCiphertext = encryptSecret(accessSecret);

      const { error: upsertErr } = await getSupabase()
        .from("x402_user_x_tokens")
        .upsert({
          user_id: pending.user_id,
          access_token: accessToken,
          access_secret: accessSecret,
          access_token_ciphertext: accessTokenCiphertext,
          access_secret_ciphertext: accessSecretCiphertext,
          username: me.data.username,
          display_name: me.data.name,
          profile_image_url: me.data.profile_image_url,
        });

      if (upsertErr) {
        console.error(
          "[integrations/x/oauth/callback] token store failed",
          upsertErr,
        );
        return res.status(500).json({ error: "token_store_failed" });
      }

      // Single-use: delete pending row by state PK (more specific than
      // by oauth_token in case of races / duplicate auth-links).
      await getSupabase()
        .from("x402_oauth_pending")
        .delete()
        .eq("state", pending.state as string);

      res.send(
        `<html><body style="font-family: sans-serif; background: #000; color: #fff; text-align: center; padding: 32px;">
          <h2>✅ X account connected</h2>
          <p>You can close this window and return to x402.jobs.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body></html>`,
      );
    } catch (err) {
      console.error("Twitter OAuth callback error", err);
      res
        .status(500)
        .send("Failed to complete Twitter OAuth. Please try again later.");
    }
  },
);

integrationsRouter.get(
  "/x/status",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { data, error } = await getSupabase()
        .from("x402_user_x_tokens")
        .select(
          "username, display_name, profile_image_url, created_at, updated_at",
        )
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching x status", error);
        return res.status(500).json({ error: "Failed to load X status" });
      }

      res.json({
        connected: Boolean(data),
        profile: data || null,
      });
    } catch (err) {
      console.error("X status error", err);
      res.status(500).json({ error: "Failed to load X status" });
    }
  },
);

integrationsRouter.post(
  "/x/disconnect",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { error } = await getSupabase()
        .from("x402_user_x_tokens")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error disconnecting X", error);
        return res.status(500).json({ error: "Failed to disconnect X" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("X disconnect error", err);
      res.status(500).json({ error: "Failed to disconnect X" });
    }
  },
);

integrationsRouter.post(
  "/x/post",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      if (!requireTwitterConfig(res)) return;

      const userId = req.user!.id;
      const { text } = req.body || {};

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }

      const tokens = await getDecryptedXTokens(getSupabase(), userId);

      if (!tokens) {
        return res
          .status(400)
          .json({ error: "Connect your X account before posting." });
      }

      const client = new TwitterApi({
        appKey: config.twitter.apiKey,
        appSecret: config.twitter.apiSecret,
        accessToken: tokens.accessToken,
        accessSecret: tokens.accessSecret,
      });

      const tweet = await client.v2.tweet({ text });

      res.json({
        success: true,
        tweetId: tweet.data?.id,
        tweetUrl: tweet.data?.id
          ? `https://x.com/i/web/status/${tweet.data.id}`
          : undefined,
      });
    } catch (err) {
      console.error("X post error", err);
      res.status(500).json({ error: "Failed to post to X" });
    }
  },
);

// === Claude integration routes ===

/**
 * GET /integrations/claude/config
 * Returns Claude integration status (never the actual API key)
 */
integrationsRouter.get(
  "/claude/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { data, error } = await getSupabase()
        .from("x402_user_claude_configs")
        .select("is_enabled")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching Claude config", error);
        return res
          .status(500)
          .json({ error: "Failed to load Claude settings" });
      }

      res.json({
        hasApiKey: Boolean(data),
        isEnabled: data?.is_enabled ?? false,
      });
    } catch (err) {
      console.error("Claude config error", err);
      res.status(500).json({ error: "Failed to load Claude settings" });
    }
  },
);

/**
 * PUT /integrations/claude/config
 * Save or update Claude API key (encrypted) and settings
 */
integrationsRouter.put(
  "/claude/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { apiKey, isEnabled } = req.body || {};

      // Build upsert payload
      const payload: Record<string, unknown> = { user_id: userId };

      if (apiKey !== undefined) {
        // Encrypt API key before storage
        payload.api_key_encrypted = encryptSecret(apiKey);
      }

      if (isEnabled !== undefined) {
        payload.is_enabled = isEnabled;
      }

      // If no apiKey provided, check if user already has one (for enable/disable toggle)
      if (apiKey === undefined) {
        const { data: existing } = await getSupabase()
          .from("x402_user_claude_configs")
          .select("api_key_encrypted")
          .eq("user_id", userId)
          .single();

        if (!existing?.api_key_encrypted) {
          return res.status(400).json({ error: "apiKey is required" });
        }
      }

      const { error } = await getSupabase()
        .from("x402_user_claude_configs")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("Error saving Claude config", error);
        return res
          .status(500)
          .json({ error: "Failed to save Claude settings" });
      }

      res.json({
        success: true,
        hasApiKey: apiKey !== undefined ? true : undefined,
        isEnabled: isEnabled ?? true,
      });
    } catch (err) {
      console.error("Claude config save error", err);
      res.status(500).json({ error: "Failed to save Claude settings" });
    }
  },
);

/**
 * DELETE /integrations/claude/config
 * Remove Claude integration for the current user
 */
integrationsRouter.delete(
  "/claude/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { error } = await getSupabase()
        .from("x402_user_claude_configs")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting Claude config", error);
        return res
          .status(500)
          .json({ error: "Failed to delete Claude settings" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Claude config delete error", err);
      res.status(500).json({ error: "Failed to delete Claude settings" });
    }
  },
);

/**
 * Get a user's decrypted Claude API key for execution.
 * Used by prompt_template executor in instant.ts.
 *
 * @param userId - The user ID (resource owner)
 * @returns Decrypted API key or null if not configured/disabled
 */
export async function getCreatorClaudeApiKey(
  userId: string,
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("x402_user_claude_configs")
    .select("api_key_encrypted, is_enabled")
    .eq("user_id", userId)
    .single();

  if (error || !data?.api_key_encrypted || !data.is_enabled) {
    return null;
  }

  return decryptSecret(data.api_key_encrypted);
}

// === OpenRouter integration routes ===

/**
 * GET /integrations/openrouter/config
 * Returns OpenRouter integration status (never the actual API key)
 */
integrationsRouter.get(
  "/openrouter/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { data, error } = await getSupabase()
        .from("x402_user_openrouter_integrations")
        .select("is_enabled, encrypted_api_key")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching OpenRouter config", error);
        return res
          .status(500)
          .json({ error: "Failed to load OpenRouter settings" });
      }

      res.json({
        hasApiKey: Boolean(data?.encrypted_api_key),
        isEnabled: data?.is_enabled ?? false,
      });
    } catch (err) {
      console.error("OpenRouter config error", err);
      res.status(500).json({ error: "Failed to load OpenRouter settings" });
    }
  },
);

/**
 * PUT /integrations/openrouter/config
 * Save or update OpenRouter API key (encrypted) and settings
 */
integrationsRouter.put(
  "/openrouter/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { apiKey, isEnabled } = req.body || {};

      // Build upsert payload
      const payload: Record<string, unknown> = { user_id: userId };

      if (apiKey !== undefined) {
        // Encrypt API key before storage
        payload.encrypted_api_key = encryptSecret(apiKey);
      }

      if (isEnabled !== undefined) {
        payload.is_enabled = isEnabled;
      }

      // If no apiKey provided, check if user already has one (for enable/disable toggle)
      if (apiKey === undefined) {
        const { data: existing } = await getSupabase()
          .from("x402_user_openrouter_integrations")
          .select("encrypted_api_key")
          .eq("user_id", userId)
          .single();

        if (!existing?.encrypted_api_key) {
          return res.status(400).json({ error: "apiKey is required" });
        }
      }

      const { error } = await getSupabase()
        .from("x402_user_openrouter_integrations")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("Error saving OpenRouter config", error);
        return res
          .status(500)
          .json({ error: "Failed to save OpenRouter settings" });
      }

      res.json({
        success: true,
        hasApiKey: apiKey !== undefined ? true : undefined,
        isEnabled: isEnabled ?? true,
      });
    } catch (err) {
      console.error("OpenRouter config save error", err);
      res.status(500).json({ error: "Failed to save OpenRouter settings" });
    }
  },
);

/**
 * GET /integrations/openrouter/affected-resources
 * Returns count of resources using this OpenRouter integration
 */
integrationsRouter.get(
  "/openrouter/affected-resources",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { count, error } = await getSupabase()
        .from("x402_resources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("resource_type", "openrouter_instant");

      if (error) {
        console.error("Error counting affected resources", error);
        return res
          .status(500)
          .json({ error: "Failed to count affected resources" });
      }

      res.json({ count: count || 0 });
    } catch (err) {
      console.error("OpenRouter affected resources error", err);
      res.status(500).json({ error: "Failed to count affected resources" });
    }
  },
);

/**
 * DELETE /integrations/openrouter/config
 * Delete OpenRouter integration and return count of affected resources
 */
integrationsRouter.delete(
  "/openrouter/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Count affected resources before deletion
      const { count: affectedResources } = await getSupabase()
        .from("x402_resources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("resource_type", "openrouter_instant");

      // Delete the integration
      const { error } = await getSupabase()
        .from("x402_user_openrouter_integrations")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting OpenRouter config", error);
        return res
          .status(500)
          .json({ error: "Failed to delete OpenRouter settings" });
      }

      res.json({
        success: true,
        affectedResources: affectedResources || 0,
      });
    } catch (err) {
      console.error("OpenRouter config delete error", err);
      res.status(500).json({ error: "Failed to delete OpenRouter settings" });
    }
  },
);

/**
 * Get a user's decrypted OpenRouter API key for execution.
 * Used by openrouter_instant resource executor.
 *
 * @param userId - The user ID (resource owner)
 * @returns Decrypted API key or null if not configured/disabled
 */
export async function getCreatorOpenRouterApiKey(
  userId: string,
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("x402_user_openrouter_integrations")
    .select("encrypted_api_key, is_enabled")
    .eq("user_id", userId)
    .single();

  if (error || !data?.encrypted_api_key || !data.is_enabled) {
    return null;
  }

  return decryptSecret(data.encrypted_api_key);
}

/**
 * Check if user has OpenRouter API key configured.
 * Returns { hasApiKey: boolean } - does NOT return the actual key.
 */
export async function hasCreatorOpenRouterApiKey(
  userId: string,
): Promise<{ hasApiKey: boolean }> {
  const { data } = await getSupabase()
    .from("x402_user_openrouter_integrations")
    .select("encrypted_api_key, is_enabled")
    .eq("user_id", userId)
    .single();

  return {
    hasApiKey: Boolean(data?.encrypted_api_key && data?.is_enabled),
  };
}
