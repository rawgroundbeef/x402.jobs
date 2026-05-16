-- Migration 006: Add AI Models Curation Columns
-- Adds modality categorization and manual curation flags to x402_openrouter_models table

-- ============================================================================
-- 1. Add modality column
-- ============================================================================

ALTER TABLE x402_openrouter_models
ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'text';

-- Add CHECK constraint for valid modality values
ALTER TABLE x402_openrouter_models
ADD CONSTRAINT check_modality_valid
CHECK (modality IN ('text', 'image', 'video', 'audio', 'embedding', 'multimodal'));

COMMENT ON COLUMN x402_openrouter_models.modality IS 'Output modality of the model (text/image/video/audio/embedding/multimodal)';

-- ============================================================================
-- 2. Add is_curated column
-- ============================================================================

ALTER TABLE x402_openrouter_models
ADD COLUMN IF NOT EXISTS is_curated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN x402_openrouter_models.is_curated IS 'Manually flagged for curated view (not synced from OpenRouter)';

-- ============================================================================
-- 3. Create indexes for filtering
-- ============================================================================

-- Index on modality for filtering by model type
CREATE INDEX IF NOT EXISTS idx_x402_openrouter_models_modality ON x402_openrouter_models(modality);

-- Partial index on is_curated for curated view (only index true values)
CREATE INDEX IF NOT EXISTS idx_x402_openrouter_models_curated ON x402_openrouter_models(is_curated) WHERE is_curated = true;

-- ============================================================================
-- 4. Optional: Seed popular models as curated (commented out)
-- ============================================================================
-- Uncomment and run these UPDATE statements to mark popular models as curated.
-- This is optional - admin can manually curate via database access.

/*
-- Anthropic Claude models
UPDATE x402_openrouter_models
SET is_curated = true
WHERE openrouter_id LIKE 'anthropic/claude-%';

-- OpenAI GPT-4o and GPT-4-turbo
UPDATE x402_openrouter_models
SET is_curated = true
WHERE openrouter_id LIKE 'openai/gpt-4o%'
   OR openrouter_id LIKE 'openai/gpt-4-turbo%';

-- Google Gemini 2.0 and Gemini Pro
UPDATE x402_openrouter_models
SET is_curated = true
WHERE openrouter_id LIKE 'google/gemini-2%'
   OR openrouter_id LIKE 'google/gemini-pro%';

-- Meta Llama 3.3
UPDATE x402_openrouter_models
SET is_curated = true
WHERE openrouter_id LIKE 'meta-llama/llama-3.3%';

-- Mistral Large
UPDATE x402_openrouter_models
SET is_curated = true
WHERE openrouter_id LIKE 'mistralai/mistral-large%';

-- X.AI Grok
UPDATE x402_openrouter_models
SET is_curated = true
WHERE openrouter_id LIKE 'x-ai/grok%';
*/

-- ============================================================================
-- VERIFICATION QUERIES (commented out)
-- ============================================================================
/*
-- Verify columns added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'x402_openrouter_models'
  AND column_name IN ('modality', 'is_curated');

-- Verify CHECK constraint
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'x402_openrouter_models'
  AND constraint_type = 'CHECK';

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'x402_openrouter_models'
  AND (indexname LIKE '%modality%' OR indexname LIKE '%curated%');

-- Count models by modality (after sync)
SELECT modality, COUNT(*) as count
FROM x402_openrouter_models
GROUP BY modality
ORDER BY count DESC;

-- List curated models
SELECT openrouter_id, display_name, provider, modality
FROM x402_openrouter_models
WHERE is_curated = true
ORDER BY provider, display_name;
*/

-- ============================================================================
-- ROLLBACK (commented out)
-- ============================================================================
/*
-- Drop indexes
DROP INDEX IF EXISTS idx_x402_openrouter_models_curated;
DROP INDEX IF EXISTS idx_x402_openrouter_models_modality;

-- Drop constraint
ALTER TABLE x402_openrouter_models DROP CONSTRAINT IF EXISTS check_modality_valid;

-- Drop columns
ALTER TABLE x402_openrouter_models DROP COLUMN IF EXISTS is_curated;
ALTER TABLE x402_openrouter_models DROP COLUMN IF EXISTS modality;
*/
