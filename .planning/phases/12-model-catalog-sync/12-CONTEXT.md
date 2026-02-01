# Phase 12: Model Catalog Sync - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Daily cron job syncs OpenRouter models to ai_models table. Includes model metadata (pricing, capabilities, context length), modality flags, and popular model curation. Manual trigger endpoint for testing.

</domain>

<decisions>
## Implementation Decisions

### Popular model curation

- Mirror OpenRouter's featured/popular flags if available in their API
- Fallback: hardcode a starter list of ~30 known-good models (Claude, GPT-4, Gemini, Llama, Stable Diffusion, etc.)
- Include variety across modalities — text, image, video, audio all represented in curated view
- Auto-remove from curated when OpenRouter marks model as deprecated

### Model categorization

- Trust OpenRouter's metadata as primary source, but allow manual overrides
- Overrides stored in database columns on ai_models (is_curated, modality_override)
- Five modality categories: text, image, video, audio, embedding
- Capabilities stored in JSONB field (vision, function-calling, JSON mode, etc.) for flexibility

### Claude's Discretion

- Sync failure handling and retry strategy
- Exact Inngest cron configuration
- Manual trigger authorization (likely admin-only)
- Logging verbosity and notification approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for cron jobs and API sync patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 12-model-catalog-sync_
_Context gathered: 2026-01-26_
