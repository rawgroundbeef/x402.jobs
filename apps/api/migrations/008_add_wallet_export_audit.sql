-- Migration 008: Wallet export audit table (HIGH-11 / Phase 28 plan 28-05).
--
-- Records every POST /wallet/export-key attempt — successful or failed.
-- Purpose:
--   - Incident response: which user, when, from what IP, what network.
--   - Rate-limit verification: cross-check that strictRateLimiter actually
--     rejected the 4th attempt (no audit row past N=3 within the window).
--   - User-visible confirmation surface: a future "Recent wallet exports"
--     page can read directly from this table.
--
-- Best-effort logging: a row write failure MUST NOT block the response path
-- (the handler logs and continues). Read paths must tolerate missing rows.
--
-- Foreign key: `auth.users(id)` (Supabase Auth schema), matching the rest of
-- the codebase (see migrations/003_add_openrouter_integration.sql, etc.).

CREATE TABLE IF NOT EXISTS public.x402_wallet_export_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  wallet_network TEXT NOT NULL CHECK (wallet_network IN ('base', 'solana', 'both')),
  success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_wallet_export_audit_user_id
  ON public.x402_wallet_export_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_export_audit_exported_at
  ON public.x402_wallet_export_audit(exported_at);

-- RLS: only the row's user can read their own audit. Service role bypasses
-- automatically (used by the API to insert rows).
ALTER TABLE public.x402_wallet_export_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own wallet export audit"
  ON public.x402_wallet_export_audit
  FOR SELECT
  USING (auth.uid() = user_id);

-- No insert/update/delete policies for regular users — only service role
-- (the API) writes to this table.

COMMENT ON TABLE public.x402_wallet_export_audit IS
  'HIGH-11 audit log: records every POST /wallet/export-key attempt for incident response and rate-limit verification.';
