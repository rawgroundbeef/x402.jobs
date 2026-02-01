---
phase: 11-database-foundation
plan: 01
subsystem: database
tags: [database, migration, openrouter, encryption, rls]
requires:
  - phases: [01-05]
    reason: Depends on existing auth.users, ai_models, and x402_resources schema
provides:
  - user_openrouter_integrations table for encrypted API key storage
  - openrouter_instant resource_type extension
  - FK relationships for OpenRouter integration
affects:
  - phase: 12-api-key-encryption
    reason: Will use user_openrouter_integrations table structure
  - phase: 13-resource-creation-ui
    reason: Will create resources with openrouter_instant type
  - phase: 14-backend-execution
    reason: Will query user_openrouter_integrations and execute via OpenRouter
tech-stack:
  added:
    - PostgreSQL RLS policies for user_openrouter_integrations
    - JSONB storage for openrouter_config
  patterns:
    - User-scoped integration pattern (following Claude integration)
    - Service role full access for backend execution
    - Combined IV+ciphertext encryption storage format
key-files:
  created:
    - apps/x402-jobs/migrations/005_add_openrouter_integration.sql
  modified: []
decisions:
  - decision: Store API keys at user level, not per-resource
    rationale: Follows existing Claude integration pattern, better UX
    date: 2026-01-26
  - decision: Use JSONB for openrouter_config flexibility
    rationale: Allows storing model params, system prompt, and future extensions without schema changes
    date: 2026-01-26
  - decision: ON DELETE SET NULL for ai_models FK
    rationale: Resources remain valid if model is removed from ai_models catalog
    date: 2026-01-26
  - decision: ON DELETE CASCADE for auth.users FK
    rationale: Clean up integrations when user is deleted
    date: 2026-01-26
metrics:
  duration: 2 minutes
  completed: 2026-01-26
---

# Phase 11 Plan 01: OpenRouter Integration Migration Summary

OpenRouter database foundation: encrypted API key storage and resource type extension.

## What Was Built

Created migration `005_add_openrouter_integration.sql` with complete OpenRouter integration infrastructure:

**1. user_openrouter_integrations Table**

- Stores encrypted OpenRouter API keys per user
- Columns: user_id (PK, FK to auth.users CASCADE), encrypted_api_key, is_valid, last_verified_at, is_enabled, timestamps
- Follows exact pattern from x402_user_claude_configs (migration 002)
- Uses combined IV+ciphertext storage format in encrypted_api_key column

**2. Row Level Security (RLS)**

- Users can only access their own integration records (auth.uid() = user_id)
- Service role has full access for backend execution
- Index on (user_id, is_enabled) for fast lookups

**3. Updated_at Trigger**

- Automatic timestamp updates on row modification
- Function: update_openrouter_integration_updated_at()
- Trigger: openrouter_integration_updated_at BEFORE UPDATE

**4. x402_resources Extensions**

- Added openrouter_model_id column (UUID FK to ai_models with SET NULL)
- Added openrouter_config column (JSONB for {modelId, systemPrompt, params})
- Updated resource_type constraint to include 'openrouter_instant'
- Added index on openrouter_model_id WHERE NOT NULL

**5. Complete Documentation**

- Comments on all tables and columns
- Verification queries (commented out)
- Full rollback script (commented out)
- Manual application note for Supabase SQL Editor

## Deviations from Plan

### Auto-added Features

**1. [Rule 2 - Missing Critical] Included rollback script in Task 1**

- **Found during:** Task 1 file creation
- **Issue:** Plan specified Task 2 to append rollback script separately
- **Rationale:** Migration file incomplete without rollback documentation; no value in temporary incomplete state
- **Decision:** Include complete rollback section in initial file creation
- **Files modified:** apps/x402-jobs/migrations/005_add_openrouter_integration.sql
- **Commit:** d6f8612c

This resulted in Task 2 being completed automatically as part of Task 1.

## Technical Decisions

**Foreign Key Relationships**

| From                                 | To             | Delete Rule | Rationale                                         |
| ------------------------------------ | -------------- | ----------- | ------------------------------------------------- |
| user_openrouter_integrations.user_id | auth.users(id) | CASCADE     | Clean up integration when user deleted            |
| x402_resources.openrouter_model_id   | ai_models(id)  | SET NULL    | Resources remain valid if model removed from list |

**JSONB Config Structure**

```json
{
  "modelId": "uuid-reference-to-ai_models",
  "systemPrompt": "Optional system prompt override",
  "params": {
    "temperature": 0.7,
    "maxTokens": 4000,
    "topP": 1.0
    // ... other model-specific parameters
  }
}
```

This structure allows frontend to configure model behavior without backend schema changes.

**RLS Security Model**

- **User policy:** Users manage only their own integration (USING/WITH CHECK auth.uid() = user_id)
- **Service role policy:** Backend has full access (USING true TO service_role)
- **No anon access:** Anonymous users cannot read any integration data

## Schema Verification

**Key Links Verified:**

- user_openrouter_integrations.user_id → auth.users(id) ON DELETE CASCADE ✓
- x402_resources.openrouter_model_id → ai_models(id) ON DELETE SET NULL ✓

**Resource Type Constraint:**

```sql
CHECK (resource_type IN (
  'external',
  'proxy',
  'prompt',
  'static',
  'prompt_template',
  'openrouter_instant'  -- NEW
))
```

**Indexes Created:**

- idx_openrouter_integrations_user_enabled ON (user_id, is_enabled)
- idx_x402_resources_openrouter_model ON openrouter_model_id WHERE NOT NULL

## Migration Application

**MANUAL STEP REQUIRED:**

This migration must be applied manually in Supabase SQL Editor:

1. Navigate to Supabase Dashboard → SQL Editor
2. Copy contents of `apps/x402-jobs/migrations/005_add_openrouter_integration.sql`
3. Execute migration
4. Verify with provided verification queries
5. Update STATE.md to remove from "Remaining Manual Tasks"

**Rollback Available:**

If migration needs to be reversed, execute the rollback script at the end of the migration file (uncomment the statements).

## Next Phase Readiness

**Phase 12 (API Key Encryption) can proceed:**

- ✓ user_openrouter_integrations table structure defined
- ✓ encrypted_api_key column ready for encryption service
- ✓ is_valid and last_verified_at columns ready for verification flow

**Phase 13 (Resource Creation UI) can proceed:**

- ✓ openrouter_instant resource_type available
- ✓ openrouter_model_id and openrouter_config columns ready
- ✓ FK to ai_models table established

**Phase 14 (Backend Execution) can proceed:**

- ✓ Service role policy grants backend full access
- ✓ Index optimized for execution lookups
- ✓ JSONB config structure supports flexible model params

**Blockers:** None

**Concerns:**

- Migration must be applied to Supabase before phases 12-14 can deploy
- Encryption/decryption service needs to match combined IV+ciphertext format
- ai_models table must be populated with OpenRouter models before resources can reference them

## Testing Notes

**Manual Verification Queries (included in migration):**

1. Verify table exists and RLS enabled
2. Verify policies created correctly
3. Verify x402_resources columns added
4. Verify resource_type constraint updated
5. Verify foreign keys with correct delete rules
6. Test INSERT into user_openrouter_integrations
7. Test INSERT with openrouter_instant resource_type

**Expected to work after migration:**

```sql
-- User can insert their own integration
INSERT INTO user_openrouter_integrations (user_id, encrypted_api_key)
VALUES (auth.uid(), 'encrypted_key_placeholder');

-- Can create openrouter_instant resource
INSERT INTO x402_resources (
  slug, name, resource_type,
  openrouter_model_id, openrouter_config
) VALUES (
  'test-openrouter',
  'Test OpenRouter Resource',
  'openrouter_instant',
  (SELECT id FROM ai_models WHERE memeputer_name = 'claude-3.5-sonnet' LIMIT 1),
  '{"params": {"temperature": 0.7}}'::jsonb
);
```

## Metrics

- **Tasks completed:** 2/2
- **Files created:** 1
- **Lines of code:** 196 (migration SQL)
- **Execution time:** ~2 minutes
- **Deviations:** 1 (auto-added rollback in Task 1)

## Commit History

| Task | Description                             | Commit   | Files                                         |
| ---- | --------------------------------------- | -------- | --------------------------------------------- |
| 1-2  | Create OpenRouter integration migration | d6f8612c | migrations/005_add_openrouter_integration.sql |

_Note: Both tasks completed in single commit due to deviation._
