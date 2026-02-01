# Phase 11: Database Foundation - Research

**Researched:** 2026-01-26
**Domain:** PostgreSQL/Supabase database schema, AES-256 encryption, RLS policies
**Confidence:** HIGH

## Summary

Phase 11 establishes the database infrastructure for OpenRouter integration. This is a pure migration phase with no UI or backend code changes. The research confirms that existing patterns from the Claude integration (migration 002) can be directly replicated for OpenRouter API key storage, and the existing x402_resources table schema supports easy extension for the new resource type.

**Key findings:**

- Follow the exact `x402_user_claude_configs` pattern for the new `user_openrouter_integrations` table
- Encryption format is already established: `iv_hex:encrypted_hex` using AES-256-CBC
- The `resource_type` check constraint must be updated to include `'openrouter_instant'`
- Use `openrouter_model_id` (not `ai_model_id`) as the FK column name to match ai_models table naming conventions

**Primary recommendation:** Create migration 005 with three logical sections: (1) user_openrouter_integrations table, (2) x402_resources column additions, (3) RLS policies. Keep in a single file following the existing migration pattern.

## Standard Stack

### Core

| Library             | Version  | Purpose                | Why Standard                                       |
| ------------------- | -------- | ---------------------- | -------------------------------------------------- |
| Supabase/PostgreSQL | N/A      | Database               | Already in use, all migrations follow this pattern |
| Node.js `crypto`    | Built-in | AES-256-CBC encryption | Already used in `/lib/instant/encrypt.ts`          |

### Supporting

| Library | Version | Purpose | When to Use                                       |
| ------- | ------- | ------- | ------------------------------------------------- |
| N/A     | -       | -       | No additional libraries needed for database phase |

### Alternatives Considered

| Instead of                 | Could Use        | Tradeoff                                                                            |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| Separate tables for config | JSONB column     | JSONB is more flexible but separate table matches existing pattern and is cleaner   |
| Combined IV+ciphertext     | Separate columns | Combined format already established in codebase, changing would break existing data |

**Installation:**

```bash
# No new packages required for database phase
```

## Architecture Patterns

### Recommended Migration Structure

```
migrations/
└── 005_add_openrouter_integration.sql   # Single migration file
```

### Pattern 1: User Integration Table Pattern

**What:** One table per external service integration (Claude, Telegram, X, Discord, OpenRouter)
**When to use:** Any user-specific API key or credential storage
**Source:** `/apps/x402-jobs/migrations/002_add_claude_integration.sql`

```sql
CREATE TABLE IF NOT EXISTS user_openrouter_integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_api_key TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Pattern 2: RLS Policy Pattern

**What:** Standard RLS pattern for user-owned data
**When to use:** Any table where users should only access their own rows
**Source:** `/apps/x402-jobs/migrations/002_add_claude_integration.sql`

```sql
-- Enable RLS
ALTER TABLE user_openrouter_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read/write their own config
CREATE POLICY "Users can manage their own OpenRouter config"
  ON user_openrouter_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can access all for backend execution
CREATE POLICY "Service role full access"
  ON user_openrouter_integrations
  FOR ALL
  TO service_role
  USING (true);
```

### Pattern 3: Resource Type Extension Pattern

**What:** Add new resource types by updating check constraint and adding type-specific columns
**When to use:** Adding new resource type to x402_resources
**Source:** `/supabase/migrations/20260114_instant_resources.sql`

```sql
-- Drop existing constraint
ALTER TABLE x402_resources DROP CONSTRAINT IF EXISTS x402_resources_resource_type_check;

-- Recreate with new type
ALTER TABLE x402_resources ADD CONSTRAINT x402_resources_resource_type_check
  CHECK (resource_type IN ('external', 'proxy', 'prompt', 'static', 'prompt_template', 'openrouter_instant'));
```

### Pattern 4: Foreign Key to ai_models

**What:** Reference the existing ai_models table for model metadata
**When to use:** Any resource that needs to link to a specific AI model
**Source:** `/supabase/migrations/20250120_create_ai_models_table.sql`

```sql
-- Add FK column to x402_resources
ALTER TABLE x402_resources
ADD COLUMN IF NOT EXISTS openrouter_model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL;
```

### Pattern 5: JSONB Config Storage

**What:** Store type-specific configuration as JSONB
**When to use:** Flexible configuration that may evolve over time
**Source:** Context decision - nested params structure agreed upon

```sql
ALTER TABLE x402_resources
ADD COLUMN IF NOT EXISTS openrouter_config JSONB;

-- Expected structure:
-- {
--   "modelId": "openai/gpt-4o",
--   "systemPrompt": "You are a helpful assistant",
--   "params": {
--     "temperature": 0.7,
--     "maxTokens": 4000,
--     "topP": 1.0
--   }
-- }
```

### Anti-Patterns to Avoid

- **Storing plaintext API keys:** Always encrypt with AES-256-CBC before storage
- **Skipping RLS:** Every table with user data must have RLS enabled
- **Multiple migrations for related changes:** Keep logically related schema changes in one migration
- **Missing service_role policy:** Backend needs service_role access to decrypt and use keys

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem              | Don't Build               | Use Instead                       | Why                                    |
| -------------------- | ------------------------- | --------------------------------- | -------------------------------------- |
| API key encryption   | Custom encryption scheme  | Existing `encrypt.ts` AES-256-CBC | Already proven, consistent format      |
| User ID lookup       | Custom auth queries       | `auth.uid()` in RLS               | Built into Supabase, secure            |
| Updated_at triggers  | Manual timestamp updates  | PostgreSQL trigger function       | Already have pattern from Claude table |
| Foreign key to users | Manual user_id validation | `REFERENCES auth.users(id)`       | Database enforces integrity            |

**Key insight:** The Claude integration migration (002) is the exact template. Copy its structure and modify table/column names for OpenRouter.

## Common Pitfalls

### Pitfall 1: Missing ON DELETE CASCADE

**What goes wrong:** Orphaned records when user is deleted
**Why it happens:** Forgetting to add cascade on foreign key
**How to avoid:** Always include `ON DELETE CASCADE` for user_id references
**Warning signs:** Records remain after user deletion

### Pitfall 2: Forgetting to Update Check Constraint

**What goes wrong:** Insert fails with constraint violation
**Why it happens:** Adding new resource_type without updating the CHECK constraint
**How to avoid:** Always DROP and recreate the constraint when adding new types
**Warning signs:** Migration runs but inserts fail

### Pitfall 3: Missing Index on user_id

**What goes wrong:** Slow queries when looking up user's integration
**Why it happens:** Primary key on user_id handles this automatically for exact matches
**How to avoid:** PRIMARY KEY on user_id is sufficient (no separate index needed)
**Warning signs:** N/A - PRIMARY KEY creates implicit index

### Pitfall 4: Encryption Key Not Set

**What goes wrong:** Runtime error when encrypting/decrypting
**Why it happens:** `INTEGRATION_ENCRYPTION_SECRET` env var missing
**How to avoid:** Document required env vars, check in application startup
**Warning signs:** "INTEGRATION_ENCRYPTION_SECRET environment variable is not set" error

### Pitfall 5: RLS Blocks Service Role

**What goes wrong:** Backend cannot access encrypted keys
**Why it happens:** Missing service_role policy
**How to avoid:** Always add `FOR ALL TO service_role USING (true)` policy
**Warning signs:** Backend gets empty results when querying for keys

## Code Examples

### Migration File Structure

```sql
-- Migration: 005_add_openrouter_integration.sql
-- Purpose: Add OpenRouter integration table and extend x402_resources

-- ============================================================================
-- SECTION 1: Create user_openrouter_integrations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_openrouter_integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_api_key TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_openrouter_integrations_user_enabled
  ON user_openrouter_integrations(user_id, is_enabled);

-- ============================================================================
-- SECTION 2: RLS Policies for user_openrouter_integrations
-- ============================================================================

ALTER TABLE user_openrouter_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own OpenRouter config"
  ON user_openrouter_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on OpenRouter"
  ON user_openrouter_integrations
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- SECTION 3: Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_openrouter_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER openrouter_integration_updated_at
  BEFORE UPDATE ON user_openrouter_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_openrouter_integration_updated_at();

-- ============================================================================
-- SECTION 4: Extend x402_resources for openrouter_instant type
-- ============================================================================

-- Add OpenRouter-specific columns
ALTER TABLE x402_resources
ADD COLUMN IF NOT EXISTS openrouter_model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL;

ALTER TABLE x402_resources
ADD COLUMN IF NOT EXISTS openrouter_config JSONB;

-- Update resource_type check constraint
ALTER TABLE x402_resources DROP CONSTRAINT IF EXISTS x402_resources_resource_type_check;

ALTER TABLE x402_resources ADD CONSTRAINT x402_resources_resource_type_check
  CHECK (resource_type IN ('external', 'proxy', 'prompt', 'static', 'prompt_template', 'openrouter_instant'));

-- Index for openrouter_instant resources
CREATE INDEX IF NOT EXISTS idx_x402_resources_openrouter_model
  ON x402_resources(openrouter_model_id) WHERE openrouter_model_id IS NOT NULL;

-- ============================================================================
-- SECTION 5: Comments
-- ============================================================================

COMMENT ON TABLE user_openrouter_integrations IS 'User OpenRouter API key storage (encrypted)';
COMMENT ON COLUMN user_openrouter_integrations.encrypted_api_key IS 'AES-256-CBC encrypted API key (iv_hex:encrypted_hex format)';
COMMENT ON COLUMN user_openrouter_integrations.is_valid IS 'Whether the key has been validated with OpenRouter';
COMMENT ON COLUMN user_openrouter_integrations.last_verified_at IS 'When the key was last verified';

COMMENT ON COLUMN x402_resources.openrouter_model_id IS 'Reference to ai_models table for OpenRouter model';
COMMENT ON COLUMN x402_resources.openrouter_config IS 'OpenRouter config: {modelId, systemPrompt, params: {temperature, maxTokens, ...}}';
```

### Verification Queries

```sql
-- Verify user_openrouter_integrations table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_openrouter_integrations';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_openrouter_integrations';

-- Verify policies exist
SELECT policyname
FROM pg_policies
WHERE tablename = 'user_openrouter_integrations';

-- Verify x402_resources columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'x402_resources'
  AND column_name IN ('openrouter_model_id', 'openrouter_config');

-- Verify constraint updated
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'x402_resources_resource_type_check';
```

### Rollback Script

```sql
-- Rollback: 005_add_openrouter_integration.sql

-- Remove trigger
DROP TRIGGER IF EXISTS openrouter_integration_updated_at ON user_openrouter_integrations;

-- Remove function
DROP FUNCTION IF EXISTS update_openrouter_integration_updated_at();

-- Remove policies
DROP POLICY IF EXISTS "Users can manage their own OpenRouter config" ON user_openrouter_integrations;
DROP POLICY IF EXISTS "Service role full access on OpenRouter" ON user_openrouter_integrations;

-- Remove index
DROP INDEX IF EXISTS idx_openrouter_integrations_user_enabled;

-- Remove table
DROP TABLE IF EXISTS user_openrouter_integrations;

-- Remove x402_resources columns (careful - loses data)
ALTER TABLE x402_resources DROP COLUMN IF EXISTS openrouter_model_id;
ALTER TABLE x402_resources DROP COLUMN IF EXISTS openrouter_config;

-- Remove index
DROP INDEX IF EXISTS idx_x402_resources_openrouter_model;

-- Restore constraint without openrouter_instant
ALTER TABLE x402_resources DROP CONSTRAINT IF EXISTS x402_resources_resource_type_check;
ALTER TABLE x402_resources ADD CONSTRAINT x402_resources_resource_type_check
  CHECK (resource_type IN ('external', 'proxy', 'prompt', 'static', 'prompt_template'));
```

## State of the Art

| Old Approach                | Current Approach       | When Changed        | Impact               |
| --------------------------- | ---------------------- | ------------------- | -------------------- |
| Store API keys in plaintext | AES-256-CBC encryption | Project inception   | Security requirement |
| No RLS                      | RLS on all user tables | Supabase standard   | Access control       |
| Separate IV column          | Combined iv:ciphertext | Existing encrypt.ts | Simpler schema       |

**Deprecated/outdated:**

- N/A - Following current established patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Table name: user_openrouter_integrations vs x402_user_openrouter_configs**
   - What we know: Both patterns exist (`x402_user_claude_configs`, `user_openrouter_integrations` in research)
   - What's unclear: Naming convention preference
   - Recommendation: Use `user_openrouter_integrations` to match the prior research docs and `user_*_integrations` pattern

2. **GIN index decision**
   - What we know: User decided "No GIN indexes on openrouter_config for now"
   - What's unclear: Future performance needs
   - Recommendation: Skip GIN index as decided, add later if JSONB queries become slow

## Sources

### Primary (HIGH confidence)

- `/apps/x402-jobs/migrations/002_add_claude_integration.sql` - Exact pattern to follow
- `/apps/x402-jobs/migrations/003_add_usage_logs.sql` - RLS policy examples
- `/apps/x402-jobs-api/src/lib/instant/encrypt.ts` - Encryption implementation
- `/supabase/migrations/20250120_create_ai_models_table.sql` - ai_models table schema
- `/supabase/migrations/20260114_instant_resources.sql` - Resource type extension pattern
- `/supabase/migrations/20260120_add_resource_executions.sql` - Modern RLS pattern example

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` - Architecture decisions
- `.planning/research/STACK.md` - Stack decisions

### Tertiary (LOW confidence)

- N/A

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Exact patterns exist in codebase
- Architecture: HIGH - Documented decisions and existing migrations
- Pitfalls: HIGH - Common PostgreSQL/Supabase issues well documented

**Research date:** 2026-01-26
**Valid until:** 60 days (database patterns are stable)

---

_Phase: 11-database-foundation_
_Research completed: 2026-01-26_
