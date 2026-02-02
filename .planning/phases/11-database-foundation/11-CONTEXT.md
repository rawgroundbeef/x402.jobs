# Phase 11: Database Foundation - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish encrypted storage for OpenRouter API keys and extend the x402_resources data model. Create user_openrouter_integrations table, add openrouter_model_id column and openrouter_config JSONB to x402_resources, and set up RLS policies. No UI work — this is pure database/migration infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Schema design

- openrouter_config JSONB uses nested params structure: `{modelId, systemPrompt, params: {temperature, maxTokens, ...}}`
- Model reference stored as separate `openrouter_model_id` column on x402_resources with FK constraint to ai_models
- user_openrouter_integrations includes health tracking: `is_valid` boolean and `last_verified_at` timestamp
- No GIN indexes on openrouter_config for now — add later if query performance requires it

### Encryption handling

- IV prepended to ciphertext in single `encrypted_api_key` column (combined storage)
- Decryption failures return clear error message: "API key configuration error - contact resource owner"
- API key validated with OpenRouter on save (test call before storing)
- Invalid keys rejected entirely — user must fix and retry, no storing with is_valid=false

### Claude's Discretion

- Exact column types and constraints
- Migration ordering and rollback strategy
- RLS policy specifics (follow existing patterns)
- Index choices beyond the GIN decision

</decisions>

<specifics>
## Specific Ideas

No specific requirements — follow existing encryption patterns from Claude key storage.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 11-database-foundation_
_Context gathered: 2026-01-26_
