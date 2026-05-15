-- Migration: Add OpenRouter integration infrastructure
-- Created: 2026-01-26
-- Description: Adds x402_user_openrouter_integrations table for encrypted API keys
--              and extends x402_resources for openrouter_instant resource type

-- ============================================================================
-- SECTION 1: x402_user_openrouter_integrations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.x402_user_openrouter_integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_api_key TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: RLS policies for x402_user_openrouter_integrations
-- ============================================================================

-- Enable RLS
ALTER TABLE public.x402_user_openrouter_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read/write their own OpenRouter config
CREATE POLICY "Users can manage their own OpenRouter config"
  ON public.x402_user_openrouter_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can access all for backend execution
CREATE POLICY "Service role full access on OpenRouter"
  ON public.x402_user_openrouter_integrations
  FOR ALL
  TO service_role
  USING (true);

-- Index for quick lookups during execution
CREATE INDEX idx_openrouter_integrations_user_enabled
  ON public.x402_user_openrouter_integrations(user_id, is_enabled);

-- ============================================================================
-- SECTION 3: Updated_at trigger
-- ============================================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_openrouter_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER openrouter_integration_updated_at
  BEFORE UPDATE ON public.x402_user_openrouter_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_openrouter_integration_updated_at();

-- ============================================================================
-- SECTION 4: Extend x402_resources for OpenRouter
-- ============================================================================

-- Add OpenRouter-specific columns to x402_resources
ALTER TABLE public.x402_resources ADD COLUMN IF NOT EXISTS openrouter_model_id UUID REFERENCES public.x402_openrouter_models(id) ON DELETE SET NULL;

-- Config for OpenRouter execution (model params, system prompt, etc.)
ALTER TABLE public.x402_resources ADD COLUMN IF NOT EXISTS openrouter_config JSONB;

-- Update resource_type check constraint to include openrouter_instant
-- Drop the existing constraint
ALTER TABLE public.x402_resources DROP CONSTRAINT IF EXISTS x402_resources_resource_type_check;

-- Recreate with openrouter_instant included
ALTER TABLE public.x402_resources ADD CONSTRAINT x402_resources_resource_type_check
  CHECK (resource_type IN ('external', 'proxy', 'prompt', 'static', 'prompt_template', 'openrouter_instant'));

-- Index for OpenRouter resources
CREATE INDEX IF NOT EXISTS idx_x402_resources_openrouter_model
  ON public.x402_resources(openrouter_model_id)
  WHERE openrouter_model_id IS NOT NULL;

-- ============================================================================
-- SECTION 5: Comments
-- ============================================================================

-- Table comments
COMMENT ON TABLE x402_user_openrouter_integrations IS 'User OpenRouter API keys (encrypted at rest). Following pattern from x402_user_claude_configs.';

-- Column comments for x402_user_openrouter_integrations
COMMENT ON COLUMN x402_user_openrouter_integrations.user_id IS 'User ID (FK to auth.users)';
COMMENT ON COLUMN x402_user_openrouter_integrations.encrypted_api_key IS 'Encrypted OpenRouter API key. Format: IV+ciphertext combined storage.';
COMMENT ON COLUMN x402_user_openrouter_integrations.is_valid IS 'Whether the API key is valid (checked on last verification)';
COMMENT ON COLUMN x402_user_openrouter_integrations.last_verified_at IS 'Last time the API key was verified against OpenRouter API';
COMMENT ON COLUMN x402_user_openrouter_integrations.is_enabled IS 'Whether this integration is enabled for the user';
COMMENT ON COLUMN x402_user_openrouter_integrations.created_at IS 'Timestamp when integration was created';
COMMENT ON COLUMN x402_user_openrouter_integrations.updated_at IS 'Timestamp when integration was last updated';

-- Column comments for x402_resources extensions
COMMENT ON COLUMN x402_resources.openrouter_model_id IS 'Reference to x402_openrouter_models table for OpenRouter model selection. NULL if not openrouter_instant type.';
COMMENT ON COLUMN x402_resources.openrouter_config IS 'JSONB config for OpenRouter execution: {modelId, systemPrompt, params: {temperature, maxTokens, ...}}';

-- ============================================================================
-- VERIFICATION QUERIES (for manual verification - not executed)
-- ============================================================================

-- Verify x402_user_openrouter_integrations table exists:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'x402_user_openrouter_integrations';

-- Verify RLS is enabled:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'x402_user_openrouter_integrations';

-- Verify policies exist:
-- SELECT policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'x402_user_openrouter_integrations';

-- Verify x402_resources columns added:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'x402_resources' AND column_name IN ('openrouter_model_id', 'openrouter_config');

-- Verify resource_type constraint updated:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'x402_resources_resource_type_check';

-- Verify foreign keys:
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name,
--   rc.delete_rule
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints AS rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('x402_user_openrouter_integrations', 'x402_resources');

-- Test INSERT into x402_user_openrouter_integrations (verify schema):
-- INSERT INTO x402_user_openrouter_integrations (user_id, encrypted_api_key)
-- VALUES (auth.uid(), 'test_encrypted_key_placeholder');

-- Test INSERT with openrouter_instant resource_type:
-- INSERT INTO x402_resources (slug, name, resource_type, openrouter_model_id)
-- VALUES ('test-openrouter', 'Test OpenRouter Resource', 'openrouter_instant', NULL);

-- ============================================================================
-- ROLLBACK SCRIPT (for manual rollback - commented out)
-- ============================================================================

-- To rollback this migration, execute the following in reverse order:

-- -- Drop index on x402_resources
-- DROP INDEX IF EXISTS idx_x402_resources_openrouter_model;

-- -- Remove openrouter_instant from resource_type constraint
-- ALTER TABLE public.x402_resources DROP CONSTRAINT IF EXISTS x402_resources_resource_type_check;
-- ALTER TABLE public.x402_resources ADD CONSTRAINT x402_resources_resource_type_check
--   CHECK (resource_type IN ('external', 'proxy', 'prompt', 'static', 'prompt_template'));

-- -- Drop OpenRouter columns from x402_resources
-- ALTER TABLE public.x402_resources DROP COLUMN IF EXISTS openrouter_config;
-- ALTER TABLE public.x402_resources DROP COLUMN IF EXISTS openrouter_model_id;

-- -- Drop trigger
-- DROP TRIGGER IF EXISTS openrouter_integration_updated_at ON public.x402_user_openrouter_integrations;

-- -- Drop trigger function
-- DROP FUNCTION IF EXISTS update_openrouter_integration_updated_at();

-- -- Drop policies
-- DROP POLICY IF EXISTS "Service role full access on OpenRouter" ON public.x402_user_openrouter_integrations;
-- DROP POLICY IF EXISTS "Users can manage their own OpenRouter config" ON public.x402_user_openrouter_integrations;

-- -- Drop index
-- DROP INDEX IF EXISTS idx_openrouter_integrations_user_enabled;

-- -- Drop table
-- DROP TABLE IF EXISTS x402_user_openrouter_integrations;

-- ============================================================================
-- MANUAL APPLICATION NOTE
-- ============================================================================

-- MANUAL STEP: Run this migration in Supabase SQL Editor
-- This migration is not automatically applied via CI/CD.
-- Copy the contents of this file and execute in the Supabase dashboard.
