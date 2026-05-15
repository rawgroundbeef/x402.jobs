-- Migration 008: Soft-delete profiles (HIGH-03 / Phase 28 plan 28-07)
--
-- HIGH-03 from the Phase 28 security review: account deletion permanently
-- destroys access to any USDC/SOL the user has in their custodial wallet, and
-- the DELETE handler isn't transactional, so a mid-cascade failure leaves
-- partial state. The full remediation is:
--   (a) block deletion if combined wallet balance > $0.01 (handled in app),
--   (b) offer external withdrawal + auto-sweep paths (handled in app),
--   (c) wrap the multi-table delete in a transaction (this migration creates
--       the RPC `soft_delete_user_tx` for that),
--   (d) soft-delete via `deleted_at` so users have a 30-day recovery window
--       (this migration adds the column + filter index).
--
-- Soft-delete column lives on `public.profiles`, the application-owned user
-- identity table. (`auth.users` is the Supabase Auth schema and we do not
-- ALTER columns there.) All user-reading routes must filter
-- `WHERE deleted_at IS NULL`. The companion DELETE handler converts to
-- soft-delete (`UPDATE ... SET deleted_at = NOW()`) and the Inngest
-- `hard-delete-stale-users` cron purges rows older than 30 days.

-- 1. deleted_at column on profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Soft-delete tombstone. NULL = active; non-NULL = pending hard-delete after 30 days. All user-reading queries MUST filter `WHERE deleted_at IS NULL`. (HIGH-03 / plan 28-07)';

-- 2. Partial index on (id) for live users only. Speeds up the dominant
--    user-reading query shape (`WHERE id = $1 AND deleted_at IS NULL`).
CREATE INDEX IF NOT EXISTS idx_profiles_active_id
  ON public.profiles(id) WHERE deleted_at IS NULL;

-- 3. Index on deleted_at for the Inngest hard-delete cron.
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 4. Transactional soft-delete RPC.
--
-- The DELETE /api/user/account handler calls this from a single point so
-- the multi-table teardown (profiles + jobs + wallets + integrations) is
-- atomic. PL/pgSQL functions run inside an implicit transaction — any
-- exception aborts and rolls back every UPDATE/DELETE issued in this body.
--
-- We tombstone `profiles` (set deleted_at) and hard-delete the
-- application-private side tables (jobs, wallets, integrations). The auth
-- user record (auth.users) is left intact and deleted by the Inngest cron
-- after the 30-day window. Until then the user can re-auth and recover.
CREATE OR REPLACE FUNCTION public.soft_delete_user_tx(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Tombstone the profile (no-op if already soft-deleted).
  UPDATE public.profiles
    SET deleted_at = NOW()
    WHERE id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    -- Either the profile doesn't exist or was already soft-deleted.
    -- Either way it's idempotent from the caller's perspective; we
    -- raise so the handler can log + return 404/409 appropriately.
    RAISE EXCEPTION 'user_not_found_or_already_deleted' USING ERRCODE = 'P0002';
  END IF;

  -- Hard-delete application-private rows. Cascade handles dependents
  -- (job runs, events, etc).
  DELETE FROM public.x402_jobs WHERE user_id = p_user_id;
  DELETE FROM public.x402_user_wallets WHERE user_id = p_user_id;
  DELETE FROM public.x402_user_telegram_configs WHERE user_id = p_user_id;
  DELETE FROM public.x402_user_x_tokens WHERE user_id = p_user_id;

  -- Note: auth.users is NOT touched here. The 30-day recovery window
  -- means the auth row stays alive (so the user can re-authenticate and
  -- file a recovery request); the Inngest hard-delete-stale-users cron
  -- deletes the auth row + the soft-deleted profile after the cutoff.
END;
$$;

COMMENT ON FUNCTION public.soft_delete_user_tx(UUID) IS
  'Transactional soft-delete entry point for DELETE /api/user/account. Sets profiles.deleted_at and hard-deletes application-private side tables in a single transaction. auth.users left intact for 30-day recovery window. (HIGH-03 / plan 28-07)';

-- 5. Lock down RPC exposure. SECURITY DEFINER + default PUBLIC EXECUTE would let
--    anon callers nuke any user via /rest/v1/rpc/soft_delete_user_tx — revoke
--    everything except service_role (which the API uses server-side).
REVOKE EXECUTE ON FUNCTION public.soft_delete_user_tx(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_user_tx(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_user_tx(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_user_tx(UUID) TO service_role;
