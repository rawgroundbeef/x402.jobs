-- Migration 007: hash API keys at rest (closes CRIT-03 from Phase 28 review).
--
-- The `api_keys.key` column held raw plaintext API keys, and the middleware
-- looked them up with `.eq("key", providedKey)`. Any DB-read compromise
-- (Supabase support incident, backup leak, log misroute) would have handed
-- over every issued API key.
--
-- After this migration:
--   - `key_hash`  (SHA-256 hex) — what the middleware looks up by
--   - `key_prefix` (first 8 chars of the raw key) — for UI display only;
--     not a security boundary, but lets users identify which key is which
--     without showing the secret
--
-- The plaintext `key` column is kept temporarily (NOT NULL constraint
-- dropped) so app code can be deployed without breaking existing rows.
-- Migration 008 (follow-up) drops it once we've confirmed the new path
-- is healthy in production.
--
-- After this migration runs, existing API keys CONTINUE to work — the
-- backfill computed their hashes from the existing plaintext.

-- Add the new columns (nullable for now; migration 008 may flip to NOT NULL).
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS key_hash   text,
  ADD COLUMN IF NOT EXISTS key_prefix text;

-- Backfill: SHA-256 of existing plaintext keys. `digest(...)` requires
-- the pgcrypto extension, which Supabase enables by default. If for some
-- reason it isn't enabled here, run `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
-- before this migration.
UPDATE public.api_keys
SET
  key_hash   = encode(digest(key, 'sha256'), 'hex'),
  key_prefix = substring(key, 1, 8)
WHERE key IS NOT NULL
  AND key_hash IS NULL;

-- Lookups go through key_hash. Unique to prevent (cryptographically
-- improbable but worth enforcing) hash collisions and to fail loudly if
-- something is wrong.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash
  ON public.api_keys(key_hash);

-- Drop the NOT NULL constraint on the legacy `key` column so the app
-- can insert new rows without writing the plaintext.
ALTER TABLE public.api_keys
  ALTER COLUMN key DROP NOT NULL;

COMMENT ON COLUMN public.api_keys.key IS
  'LEGACY plaintext API key. Migration 008 will drop this column. New rows MUST leave this NULL.';
COMMENT ON COLUMN public.api_keys.key_hash IS
  'SHA-256 hex digest of the raw API key. The middleware looks up keys by hashing the provided key and matching this column.';
COMMENT ON COLUMN public.api_keys.key_prefix IS
  'First 8 characters of the raw API key (e.g. "abc12345..."). Display-only — lets the UI distinguish keys for the user without revealing the full secret.';
