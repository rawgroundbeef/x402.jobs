-- Migration 005: Add ciphertext columns for wallet private keys.
--
-- Context:
-- The existing `encrypted_private_key` and `base_encrypted_private_key` columns
-- in `x402_user_wallets` store base64-encoded *plaintext* despite their names.
-- The column COMMENT on `encrypted_private_key` admits this ("Base64 encoded
-- private key for signing X402 payments"). This migration begins a two-step
-- fix: add true AES-256-GCM ciphertext columns alongside the legacy plaintext
-- columns, so existing rows keep working while we backfill and switch over.
--
-- Rollout order (this is step 1 of 2):
--   1. Apply this migration.  (you are here)
--   2. Set WALLET_ENCRYPTION_SECRET in Railway env.
--   3. Deploy app changes that:
--        - write new keys to BOTH old + new columns (dual-write, defensive),
--        - read from new columns preferentially, fall back to old.
--   4. Run scripts/backfill-wallet-encryption.ts against prod.
--   5. Monitor for 24-48h.
--   6. Apply migration 006 to drop the legacy plaintext columns.
--
-- Both new columns are NULLABLE during the transition. Migration 006 will
-- flip them to NOT NULL (solana) / leave nullable (base, mirrors current
-- nullability of base_address).

ALTER TABLE public.x402_user_wallets
  ADD COLUMN IF NOT EXISTS solana_private_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS base_private_key_ciphertext   text;

COMMENT ON COLUMN public.x402_user_wallets.solana_private_key_ciphertext IS
  'AES-256-GCM ciphertext of the raw 64-byte Solana secret key. Format: iv_hex:tag_hex:ct_hex. Encrypted with WALLET_ENCRYPTION_SECRET.';

COMMENT ON COLUMN public.x402_user_wallets.base_private_key_ciphertext IS
  'AES-256-GCM ciphertext of the 0x-prefixed Base/Ethereum private key (utf-8 string). Format: iv_hex:tag_hex:ct_hex. Encrypted with WALLET_ENCRYPTION_SECRET.';
