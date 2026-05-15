-- Rollback for migration 008: soft-delete profiles (HIGH-03 / plan 28-07).

DROP FUNCTION IF EXISTS public.soft_delete_user_tx(UUID);

DROP INDEX IF EXISTS public.idx_profiles_deleted_at;
DROP INDEX IF EXISTS public.idx_profiles_active_id;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS deleted_at;
