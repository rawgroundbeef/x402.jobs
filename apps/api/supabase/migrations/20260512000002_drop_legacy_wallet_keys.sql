-- Migration 006: drop legacy plaintext wallet key columns.
--
-- Context:
-- Migration 005 added AES-256-GCM ciphertext columns alongside the legacy
-- base64-plaintext columns. The backfill script populated the new columns
-- for all rows. App code at commits 0ef9cf7+ through f417405+ supported
-- both columns (preferring new, falling back to legacy). This migration
-- and the corresponding app deploy remove the legacy columns entirely.
--
-- IMPORTANT ordering: app code that no longer references `encrypted_private_key`
-- or `base_encrypted_private_key` must be deployed BEFORE this migration is
-- applied. Running this against an older deploy will break wallet reads.
--
-- A backup of the legacy data was taken via scripts/backup-legacy-wallet-keys.ts
-- before this migration was applied (SHA-256 recorded in commit message).

ALTER TABLE public.x402_user_wallets
  DROP COLUMN encrypted_private_key,
  DROP COLUMN base_encrypted_private_key;

-- Every wallet has a Solana key — enforce NOT NULL now that the ciphertext
-- column is the sole source of truth.
ALTER TABLE public.x402_user_wallets
  ALTER COLUMN solana_private_key_ciphertext SET NOT NULL;

-- Base key is optional (mirrors base_address being nullable), but the two
-- must agree: either both set or both null. Prevents "wallet with base_address
-- but no key" corruption.
ALTER TABLE public.x402_user_wallets
  ADD CONSTRAINT x402_user_wallets_base_key_consistency CHECK (
    (base_address IS NULL AND base_private_key_ciphertext IS NULL) OR
    (base_address IS NOT NULL AND base_private_key_ciphertext IS NOT NULL)
  );
