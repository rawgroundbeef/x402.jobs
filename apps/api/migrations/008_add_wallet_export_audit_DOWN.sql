-- Rollback for migration 008.
-- Drops the wallet-export audit table, indexes, and RLS policy.

DROP POLICY IF EXISTS "users read own wallet export audit" ON public.x402_wallet_export_audit;
DROP INDEX IF EXISTS idx_wallet_export_audit_exported_at;
DROP INDEX IF EXISTS idx_wallet_export_audit_user_id;
DROP TABLE IF EXISTS public.x402_wallet_export_audit;
