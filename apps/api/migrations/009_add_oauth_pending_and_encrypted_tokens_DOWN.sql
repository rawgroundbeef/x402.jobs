-- Migration 009 DOWN: revert oauth_pending table + ciphertext columns (HIGH-02 / plan 28-08).
--
-- Reverses 009_add_oauth_pending_and_encrypted_tokens.sql. Use this ONLY if you
-- need to roll back before the follow-up v3.1 migration drops the plaintext
-- columns. Once plaintext is dropped, this DOWN script is no longer reversible
-- without restoring from backup.

DROP INDEX IF EXISTS public.idx_x_tokens_ciphertext_present;

ALTER TABLE public.x402_user_x_tokens
  DROP COLUMN IF EXISTS access_secret_ciphertext,
  DROP COLUMN IF EXISTS access_token_ciphertext;

DROP INDEX IF EXISTS public.idx_oauth_pending_oauth_token;
DROP INDEX IF EXISTS public.idx_oauth_pending_expires_at;

DROP TABLE IF EXISTS public.x402_oauth_pending;
