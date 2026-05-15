-- Migration 009: Twitter OAuth state nonce + token encryption at rest (HIGH-02 / plan 28-08).
-- Plaintext columns NOT dropped here — follow-up v3.1 migration drops them after dual-write validates.
--
-- Context:
-- Two interlocking fixes for HIGH-02:
--   1. Add `x402_oauth_pending` table to replace the in-memory `oauthRequests` Map
--      in routes/integrations.ts. The Map is process-local, unbounded, and never
--      swept. A DB-backed pending store (with TTL via expires_at + index) gives us
--      durability across restarts and a single-use semantic on the OAuth state nonce.
--   2. Add ciphertext columns to `x402_user_x_tokens` alongside the existing plaintext
--      `access_token` / `access_secret` columns. Mirrors Phase 27 wallet encryption
--      pattern (migration 005 added ciphertext; migration 006 dropped plaintext after
--      dual-write proved stable). A follow-up v3.1 migration will DROP the plaintext
--      columns once production has run dual-write for 24+ hours.
--
-- Rollout order (this is step 1 of 2 for the encryption half):
--   1. Apply this migration.  (you are here)
--   2. Deploy app changes that:
--        - generate `state` on OAuth init, INSERT into x402_oauth_pending,
--        - verify `state` on callback (reject missing/expired/mismatched),
--        - write tokens to BOTH plaintext + ciphertext columns (dual-write),
--        - read from ciphertext preferentially, fall back to plaintext.
--   3. Run scripts/migrate-encrypt-x-tokens.ts to backfill ciphertext for existing rows.
--   4. Monitor 24h.
--   5. Apply follow-up v3.1 migration to drop access_token + access_secret plaintext columns.

-- ===========================================================================
-- 1. x402_oauth_pending table — replaces in-memory `oauthRequests` Map
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.x402_oauth_pending (
    state         text        PRIMARY KEY,
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_verifier text,
    oauth_token   text,
    provider      text        NOT NULL DEFAULT 'twitter',
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL
);

COMMENT ON TABLE public.x402_oauth_pending IS
  'Short-lived OAuth state nonces (CSRF protection). Rows are single-use: deleted on callback success and after expires_at by sweeper or on-callback cleanup. Replaces the in-memory oauthRequests Map (HIGH-02 / plan 28-08).';

COMMENT ON COLUMN public.x402_oauth_pending.state IS
  'CSRF nonce — crypto.randomBytes(32).toString(''base64url''). Primary key; collisions astronomically unlikely (2^256 space).';

COMMENT ON COLUMN public.x402_oauth_pending.code_verifier IS
  'Optional PKCE code_verifier (OAuth2) or provider-specific token-secret. For Twitter OAuth1.0a this stores oauth_token_secret. NULL when not applicable.';

COMMENT ON COLUMN public.x402_oauth_pending.oauth_token IS
  'Provider-issued lookup token. Twitter OAuth1.0a does NOT echo our `state` back on callback — only `oauth_token` and `oauth_verifier`. We look up the row by oauth_token, but the `state` PK still ensures CSRF protection (state-generation entropy is what binds the auth-link URL to the originating session). NULL for providers that do echo state.';

COMMENT ON COLUMN public.x402_oauth_pending.provider IS
  'OAuth provider name. Defaults to ''twitter''. Extensible for future providers (github, discord, etc.).';

COMMENT ON COLUMN public.x402_oauth_pending.expires_at IS
  'TTL — set to NOW() + 10 minutes on insert. Callbacks past this point return 400 state_expired.';

-- Sweep index — supports periodic deletion of expired rows.
CREATE INDEX IF NOT EXISTS idx_oauth_pending_expires_at
  ON public.x402_oauth_pending (expires_at);

-- Twitter callback lookup index — Twitter OAuth1.0a callbacks identify the
-- pending row by oauth_token (not state), so we need an index for that path.
CREATE INDEX IF NOT EXISTS idx_oauth_pending_oauth_token
  ON public.x402_oauth_pending (oauth_token)
  WHERE oauth_token IS NOT NULL;

-- ===========================================================================
-- 2. Ciphertext columns on x402_user_x_tokens — encryption at rest
-- ===========================================================================

ALTER TABLE public.x402_user_x_tokens
  ADD COLUMN IF NOT EXISTS access_token_ciphertext  text,
  ADD COLUMN IF NOT EXISTS access_secret_ciphertext text;

COMMENT ON COLUMN public.x402_user_x_tokens.access_token_ciphertext IS
  'AES-256-CBC ciphertext of access_token. Format: iv_hex:encrypted_hex. Encrypted with INTEGRATION_ENCRYPTION_SECRET via lib/instant/encrypt.encryptSecret(). Reads prefer this column; fall back to plaintext access_token only during dual-write window. Plaintext column dropped in v3.1 migration after dual-write proves stable.';

COMMENT ON COLUMN public.x402_user_x_tokens.access_secret_ciphertext IS
  'AES-256-CBC ciphertext of access_secret. Format: iv_hex:encrypted_hex. Encrypted with INTEGRATION_ENCRYPTION_SECRET via lib/instant/encrypt.encryptSecret(). Reads prefer this column; fall back to plaintext access_secret only during dual-write window. Plaintext column dropped in v3.1 migration after dual-write proves stable.';

-- Partial index — supports the backfill script's "find rows missing ciphertext" query.
CREATE INDEX IF NOT EXISTS idx_x_tokens_ciphertext_present
  ON public.x402_user_x_tokens (user_id)
  WHERE access_token_ciphertext IS NOT NULL;
