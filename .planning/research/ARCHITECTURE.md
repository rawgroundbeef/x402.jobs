# Architecture Research: OpenRouter Integration

**Project:** OpenRouter Instant Resources for x402jobs
**Researched:** 2026-01-26
**Overall confidence:** HIGH

## Executive Summary

OpenRouter instant resources should integrate deeply with the existing x402jobs architecture by extending current patterns rather than creating parallel systems. The existing architecture already supports dynamic resource execution, API key storage, and cron-based catalog sync patterns. OpenRouter resources will be a special resource_type with server-side execution using official SDK, extending the existing `x402_resources` table and reusing the execution flow.

**Key insight:** x402jobs already has a comprehensive AI model catalog (`ai_models` table) synced from OpenRouter. The instant resources feature builds upon this foundation by enabling users to execute these models as x402 resources without server deployment.

## Integration Points with Existing Architecture

### 1. Database Schema

#### Extend Existing Tables

**x402_resources table** (EXISTING - extend with new columns):

```sql
-- Add to existing x402_resources table
ALTER TABLE x402_resources
ADD COLUMN resource_type TEXT CHECK (resource_type IN ('x402', 'prompt_template', 'openrouter_instant'));

-- OpenRouter-specific config stored as JSONB
ADD COLUMN openrouter_config JSONB;
-- Structure: { modelId: "openai/gpt-4o", temperature: 0.7, maxTokens: 4000 }

-- Link to ai_models table for catalog metadata
ADD COLUMN ai_model_id UUID REFERENCES ai_models(id);
```

**Rationale:** Reuse existing resource infrastructure rather than creating `openrouter_models` table. Resources are execution endpoints, not model metadata.

#### Keep Existing Tables

**ai_models table** (EXISTING - no changes needed):

```sql
-- Already has:
- id, openrouter_id, display_name, description
- provider, max_tokens, context_length
- web_search_supported, vision_supported, tool_calling_supported
- pricing columns
- is_active, last_synced_at
```

**Rationale:** Already synced from OpenRouter API via `update-openrouter-models` script. Contains authoritative model catalog.

#### New Tables Needed

**user_openrouter_integrations** - For user API key storage:

```sql
-- Store OpenRouter API key per user
CREATE TABLE user_openrouter_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- API key (encrypted with WALLET_ENCRYPTION_SECRET)
  api_key TEXT NOT NULL,

  -- Optional: credit info for display
  credits_usd DECIMAL(10, 2),
  last_credit_check TIMESTAMPTZ,

  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies (same pattern as other integrations)
ALTER TABLE user_openrouter_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own OpenRouter integration"
  ON user_openrouter_integrations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 2. API Key Storage Pattern

**Use existing user_integrations pattern** - Same as Discord, Telegram.

Pattern (from agent_discord_integrations):

- One table per service integration
- user_id UNIQUE constraint (one integration per user)
- Encrypted secrets (using WALLET_ENCRYPTION_SECRET)
- RLS policies for user-only access
- is_enabled flag for toggling

**Integration flow:**

1. User adds OpenRouter API key via Settings page
2. Key stored encrypted (same pattern as Discord tokens)
3. Resource execution retrieves key from user_openrouter_integrations
4. API calls made server-side with user's key

**Fallback:** If no user key, use platform OPENROUTER_API_KEY (env var).

### 3. Resource Execution Flow

**Extend existing /api/execute endpoint** - NO new endpoint needed.

Current flow (from `/apps/x402-jobs-api/src/routes/execute.ts`):

```
POST /api/execute
├─ Look up resource by resourceId
├─ Detect resource_type
├─ If x402 → executeX402Request (existing)
├─ If prompt_template → (existing)
└─ If openrouter_instant → NEW: executeOpenRouterResource
```

**New execution handler:**

```typescript
// In /apps/x402-jobs-api/src/routes/execute.ts
async function executeOpenRouterResource(params: {
  resourceId: string;
  userId: string;
  body: Record<string, unknown>;
  supabase: SupabaseClient;
}): Promise<ExecuteResult> {
  // 1. Fetch resource config
  const { data: resource } = await supabase
    .from("x402_resources")
    .select("openrouter_config, ai_model_id, ai_models(*)")
    .eq("id", params.resourceId)
    .single();

  // 2. Get user's OpenRouter key (or fallback to platform key)
  const { data: integration } = await supabase
    .from("user_openrouter_integrations")
    .select("api_key")
    .eq("user_id", params.userId)
    .single();

  const apiKey = integration?.api_key || process.env.OPENROUTER_API_KEY;

  // 3. Initialize OpenRouter SDK
  const openrouter = createOpenRouter({ apiKey });

  // 4. Call model with user inputs
  const completion = await openrouter.callModel({
    model: resource.openrouter_config.modelId,
    messages: [{ role: "user", content: params.body.prompt }],
    temperature: resource.openrouter_config.temperature,
    maxTokens: resource.openrouter_config.maxTokens,
  });

  // 5. Return response
  return {
    success: true,
    output: completion.choices[0].message.content,
  };
}
```

**Key integration points:**

- Reuses existing authentication middleware
- Reuses existing resource lookup logic
- Reuses existing stats tracking (call_count, total_earned_usdc)
- Fits into workflow execution (StepExecutor already handles resource calls)

### 4. Model Catalog Sync Strategy

**Use existing cron pattern from Inngest functions**.

Pattern (from `/apps/x402-jobs-api/src/inngest/functions/poll-bazaar-discovery.ts`):

```typescript
// New file: /apps/x402-jobs-api/src/inngest/functions/sync-openrouter-models.ts

export const syncOpenRouterModels = inngest.createFunction(
  {
    id: "sync-openrouter-models",
    retries: 2,
  },
  // Run daily at 3am UTC
  { cron: "0 3 * * *" },
  async ({ step, logger }) => {
    const updated = await step.run("fetch-and-sync-models", async () => {
      logger.info("Fetching OpenRouter model catalog...");

      // 1. Fetch from OpenRouter API
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      });
      const { data: models } = await response.json();

      // 2. Upsert to ai_models table
      for (const model of models) {
        await supabase.from("ai_models").upsert(
          {
            openrouter_id: model.id,
            display_name: model.name,
            description: model.description,
            provider: extractProvider(model.id),
            max_tokens: model.context_length,
            vision_supported: model.architecture?.modalities?.includes("image"),
            tool_calling_supported:
              model.supported_parameters?.includes("tools"),
            pricing_prompt: model.pricing?.prompt,
            pricing_completion: model.pricing?.completion,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "openrouter_id" },
        );
      }

      logger.info(`Synced ${models.length} models`);
      return models.length;
    });

    return { modelsUpdated: updated };
  },
);
```

**Sync frequency:** Daily (models don't change frequently).
**Trigger options:**

- Cron schedule (daily at 3am UTC)
- Manual trigger via event: `openrouter/models.sync`
- On-demand via admin endpoint

**NOTE:** Existing codebase may already have this sync via `update-openrouter-models` script. Check `/packages/scripts/` or similar.

### 5. Multi-Modal Output Handling

OpenRouter supports multiple input/output modalities:

**Input types supported:**

- Text (standard)
- Images (vision-capable models)
- PDFs (document models)
- Audio (speech models)
- Video (multimodal models)

**Output types supported:**

- Text (all models) → store as JSON string
- Images (generation models) → base64 data URLs → need special handling

#### Storage Strategy

**Option A: Store in output JSONB (current pattern)**

```jsonb
{
  "type": "text",
  "content": "Response text here..."
}

// OR for images
{
  "type": "image",
  "format": "png",
  "data": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Option B: Store images in x402_cached_images table** (PREFERRED)

```typescript
// Check if output contains images
if (completion.images && completion.images.length > 0) {
  // Upload to x402_cached_images
  for (const image of completion.images) {
    const { data: cached } = await supabase
      .from("x402_cached_images")
      .insert({
        original_url: image.image_url,
        content_type: "image/png",
        size_bytes: estimateSize(image.image_url),
        user_id: userId,
      })
      .select()
      .single();

    imageUrls.push(`/api/images/${cached.id}`);
  }

  return {
    type: "image",
    urls: imageUrls,
  };
}
```

**Rationale:**

- Reuses existing image caching infrastructure
- Keeps JSONB outputs small
- Enables CDN/caching for generated images
- Consistent with how other image outputs are handled

**Migration from 20250525_create_x402_cached_images.sql shows:**

- Table already exists with user_id, content_type, size_bytes
- Has RLS policies for access control
- Can store any image type

### 6. Resource Creation Flow

**Extend existing CreateResourceModal** (from `/apps/x402-jobs/src/components/modals/CreateResourceModal.tsx`).

Add new resource type option:

```typescript
// In resource type selector
<Select value={resourceType} onChange={setResourceType}>
  <option value="x402">X402 Resource (External API)</option>
  <option value="prompt_template">Prompt Template (Server-side)</option>
  <option value="openrouter_instant">OpenRouter Model (Instant)</option>
</Select>

// Conditional form fields
{resourceType === 'openrouter_instant' && (
  <>
    <ModelSelector
      models={aiModels} // From ai_models table
      value={selectedModelId}
      onChange={setSelectedModelId}
    />
    <Input
      label="Temperature"
      type="number"
      min={0}
      max={2}
      step={0.1}
      value={temperature}
    />
    <Input
      label="Max Tokens"
      type="number"
      value={maxTokens}
    />
  </>
)}
```

**Backend creation endpoint:**

```typescript
// POST /api/resources
const { data: resource } = await supabase.from("x402_resources").insert({
  resource_type: "openrouter_instant",
  name: req.body.name,
  description: req.body.description,
  category: req.body.category,
  registered_by: userId,

  // OpenRouter-specific config
  ai_model_id: req.body.modelId,
  openrouter_config: {
    modelId: req.body.openrouterId, // e.g., "openai/gpt-4o"
    temperature: req.body.temperature,
    maxTokens: req.body.maxTokens,
  },

  // Free resources (no payment required)
  pay_to: null,
  max_amount_required: null,
  asset: null,
  network: null,
});
```

### 7. Resource Detail Page Integration

**Extend ResourceDetailPage** to show OpenRouter-specific metadata.

Current pattern shows:

- Resource name, description, category
- Call stats (call_count, success rate)
- Try button (opens execution modal)

Add for OpenRouter resources:

```typescript
// In ResourceDetailPage component
{resource.resource_type === 'openrouter_instant' && (
  <div className="openrouter-metadata">
    <Badge>Model: {resource.ai_model?.display_name}</Badge>
    <Badge>Provider: {resource.ai_model?.provider}</Badge>
    {resource.ai_model?.vision_supported && <Badge>Vision</Badge>}
    {resource.ai_model?.tool_calling_supported && <Badge>Tools</Badge>}
    {resource.ai_model?.web_search_supported && <Badge>Search</Badge>}

    <div className="config">
      <span>Temperature: {resource.openrouter_config.temperature}</span>
      <span>Max Tokens: {resource.openrouter_config.maxTokens}</span>
    </div>
  </div>
)}
```

## Component Architecture

### New Components Needed

1. **ModelSelector.tsx**
   - Purpose: Dropdown to select AI model from catalog
   - Data: Fetches from `/api/models` (existing endpoint)
   - Filters: Provider, capabilities (vision, tools, search)

2. **OpenRouterSettingsCard.tsx**
   - Purpose: User settings page card for API key
   - Pattern: Same as existing Discord/Telegram integration cards
   - Features: Add key, test connection, view credits

3. **OpenRouterExecutionModal.tsx** (optional)
   - Purpose: Specialized execution modal for instant resources
   - Features: Live streaming, multimodal input, response formatting
   - Alternative: Extend existing TryResourceModal

### Modified Components

1. **CreateResourceModal.tsx**
   - Add `openrouter_instant` type option
   - Add model selection form fields
   - Add config fields (temperature, maxTokens)

2. **ResourceDetailPage.tsx**
   - Add OpenRouter metadata display
   - Show model capabilities badges
   - Show config parameters

3. **StepExecutor.ts** (workflow execution)
   - Add case for `resource_type === 'openrouter_instant'`
   - Call new OpenRouter execution handler
   - Handle multimodal outputs

## Data Flow Diagram

```
User creates OpenRouter instant resource:
┌─────────────────────────────────────────────────────┐
│ CreateResourceModal                                  │
│ - Select model from ai_models catalog               │
│ - Configure temperature, maxTokens                  │
│ - Save as openrouter_instant resource               │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ POST /api/resources                                  │
│ - Insert into x402_resources with type              │
│ - Store openrouter_config as JSONB                  │
│ - Link to ai_model_id                               │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ Resource appears in catalog                          │
│ - Browsable like other resources                    │
│ - Shows model metadata from ai_models               │
└─────────────────────────────────────────────────────┘

User executes OpenRouter resource:
┌─────────────────────────────────────────────────────┐
│ TryResourceModal / Workflow execution                │
│ - User provides inputs (prompt, etc)                │
│ - Calls POST /api/execute                           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ /api/execute endpoint                                │
│ 1. Look up resource by resourceId                   │
│ 2. Detect resource_type = openrouter_instant        │
│ 3. Route to executeOpenRouterResource()             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ executeOpenRouterResource()                          │
│ 1. Fetch resource.openrouter_config                 │
│ 2. Get user API key or platform key                 │
│ 3. Initialize @openrouter/sdk                       │
│ 4. Call model with inputs                           │
│ 5. Handle multimodal outputs                        │
│ 6. Update resource stats                            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ Response returned to user                            │
│ - Text: displayed inline                            │
│ - Images: cached and displayed                      │
│ - Stats updated (call_count, success_count)         │
└─────────────────────────────────────────────────────┘

Daily model catalog sync:
┌─────────────────────────────────────────────────────┐
│ Inngest cron: sync-openrouter-models                │
│ - Runs daily at 3am UTC                             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ Fetch OpenRouter API                                 │
│ GET https://openrouter.ai/api/v1/models            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ Upsert to ai_models table                           │
│ - Update existing models                            │
│ - Add new models                                    │
│ - Update pricing, capabilities                      │
│ - Set last_synced_at                                │
└─────────────────────────────────────────────────────┘
```

## Architecture Patterns to Follow

### Pattern 1: Resource Type Polymorphism

**What:** Resources have different types with type-specific execution.

**Current implementation:**

- `x402` type → HTTP call with x402 payment protocol
- `prompt_template` type → Server-side template rendering + AI

**Extension:**

- `openrouter_instant` type → Server-side OpenRouter SDK call

**Code location:** `/apps/x402-jobs-api/src/routes/execute.ts`

### Pattern 2: JSONB Configuration Storage

**What:** Type-specific config stored in JSONB column.

**Examples:**

- `prompt_template` → stores template, inputs, model
- `openrouter_instant` → stores modelId, temperature, maxTokens

**Benefit:** Schema flexibility without migrations.

### Pattern 3: Integration Tables Per Service

**What:** Each external service gets its own user_X_integrations table.

**Examples:**

- `agent_discord_integrations` → Discord OAuth tokens
- `x402_user_telegram_configs` → Telegram bot tokens
- `user_openrouter_integrations` → OpenRouter API keys (NEW)

**Pattern:** user_id UNIQUE, encrypted secrets, RLS policies.

### Pattern 4: Inngest for Scheduled Jobs

**What:** Use Inngest functions for cron jobs, not pg_cron.

**Examples:**

- `poll-bazaar-discovery` → Every 5 minutes
- `check-resource-health` → Health checks
- `sync-openrouter-models` → Daily model sync (NEW)

**Benefit:** Retries, observability, step functions.

### Pattern 5: Stats Tracking in Resource Table

**What:** Resource table has execution stats columns.

**Columns:**

- `call_count` → Total executions
- `success_count_30d` → Success count (rolling 30 days)
- `failure_count_30d` → Failure count (rolling 30 days)
- `total_earned_usdc` → Revenue (for paid resources)
- `last_called_at` → Last execution timestamp

**Update on:** Every execution (increment counters).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating Separate Model Table

**Don't:** Create `openrouter_models` table separate from `ai_models`.

**Why:** Duplication. `ai_models` is already synced from OpenRouter.

**Instead:** Link resources to `ai_models.id` via foreign key.

### Anti-Pattern 2: New Execution Endpoint

**Don't:** Create `/api/execute-openrouter` endpoint.

**Why:** Fragments execution logic, harder to maintain workflows.

**Instead:** Extend existing `/api/execute` with type detection.

### Anti-Pattern 3: Client-Side API Keys

**Don't:** Store OpenRouter keys in frontend or make direct API calls.

**Why:** Security risk, CORS issues, can't track usage properly.

**Instead:** Server-side execution with encrypted key storage.

### Anti-Pattern 4: Storing Base64 Images in JSONB

**Don't:** Store large base64 images directly in output JSONB.

**Why:** Database bloat, slow queries, can't cache/CDN.

**Instead:** Upload to `x402_cached_images`, return URLs.

### Anti-Pattern 5: Manual Model Catalog Updates

**Don't:** Manually add models to `ai_models` table.

**Why:** Tedious, error-prone, gets out of sync.

**Instead:** Automated daily sync from OpenRouter API.

## Suggested Build Order

### Phase 1: Database Foundation (1-2 days)

**Prerequisite:** None

1. Migration: Add columns to `x402_resources`
   - `resource_type` enum (add 'openrouter_instant')
   - `openrouter_config` JSONB
   - `ai_model_id` UUID FK

2. Migration: Create `user_openrouter_integrations` table
   - Follow existing integration table pattern
   - RLS policies for user access

3. Verify `ai_models` table exists and has data
   - Check if sync script exists
   - Run manual sync if needed

**Why first:** Database schema changes block all other work.

### Phase 2: Model Catalog Sync (1 day)

**Prerequisite:** Phase 1 complete

1. Create Inngest function: `sync-openrouter-models.ts`
   - Fetch from OpenRouter API
   - Upsert to `ai_models` table
   - Handle errors, retries

2. Add manual trigger endpoint (admin only)
   - POST `/api/admin/sync-models`

3. Test sync with production API

**Why second:** Ensures model catalog is populated before building UI.

### Phase 3: Execution Backend (2-3 days)

**Prerequisite:** Phase 1, 2 complete

1. Install OpenRouter SDK: `npm install @openrouter/sdk`

2. Create execution handler: `executeOpenRouterResource()`
   - Fetch resource config
   - Get user API key
   - Call OpenRouter SDK
   - Handle text/image outputs
   - Update stats

3. Integrate into `/api/execute` endpoint
   - Type detection logic
   - Route to new handler

4. Add to StepExecutor for workflows
   - Handle openrouter_instant type
   - Pass through to execute endpoint

**Why third:** Backend must work before UI can test it.

### Phase 4: Settings UI (1-2 days)

**Prerequisite:** Phase 1 complete (can parallel with Phase 3)

1. Create OpenRouterSettingsCard component
   - API key input
   - Test connection button
   - Credit display (optional)

2. Add to user settings page
   - New section: "OpenRouter Integration"

3. API endpoints for settings
   - POST `/api/user/integrations/openrouter` (save key)
   - GET `/api/user/integrations/openrouter` (fetch key)
   - POST `/api/user/integrations/openrouter/test` (test key)

**Why fourth:** Users need to configure before creating resources.

### Phase 5: Resource Creation UI (2 days)

**Prerequisite:** Phase 2, 4 complete

1. Create ModelSelector component
   - Fetch from `/api/models`
   - Filter by capabilities
   - Search/filter UI

2. Extend CreateResourceModal
   - Add openrouter_instant type option
   - Model selection form
   - Config inputs (temperature, maxTokens)
   - Save to backend

3. Backend endpoint updates
   - Handle openrouter_instant in POST `/api/resources`
   - Validate config
   - Store properly

**Why fifth:** Can't create resources without settings and models.

### Phase 6: Resource Display UI (1-2 days)

**Prerequisite:** Phase 5 complete

1. Extend ResourceDetailPage
   - Show model metadata
   - Show config parameters
   - Display capabilities badges

2. Update resource cards in catalog
   - Show "Instant" badge
   - Show model name

**Why sixth:** Nice-to-have, users can still use resources without this.

### Phase 7: Execution UI (1-2 days)

**Prerequisite:** Phase 3, 5 complete

1. Extend TryResourceModal
   - Handle multimodal inputs (vision models)
   - Display image outputs properly
   - Show streaming responses (optional)

2. Test full flow end-to-end
   - Create resource → Execute → View results

**Why seventh:** Users can test resources through workflows first if needed.

### Phase 8: Multi-Modal Enhancements (2-3 days)

**Prerequisite:** Phase 7 complete

1. Image generation support
   - Detect image outputs
   - Upload to x402_cached_images
   - Display in UI

2. Vision input support
   - Image upload in execution modal
   - Pass to OpenRouter API

3. Streaming support (optional)
   - Real-time text streaming
   - Progress indicators

**Why last:** Core functionality works, these are enhancements.

## Confidence Assessment

| Component            | Confidence | Rationale                                       |
| -------------------- | ---------- | ----------------------------------------------- |
| Database integration | HIGH       | Existing patterns clear, minimal changes needed |
| API key storage      | HIGH       | Reuses proven integration pattern               |
| Execution flow       | HIGH       | Existing execute endpoint extensible            |
| Model sync           | MEDIUM     | Inngest pattern exists, but sync logic new      |
| Multi-modal handling | MEDIUM     | Image caching exists, but integration untested  |
| UI components        | HIGH       | Existing modals/forms easy to extend            |

## Gaps & Open Questions

### Resolved in Research

- ✅ Whether to create new tables → No, extend existing
- ✅ How to store API keys → User integrations table pattern
- ✅ How to sync models → Inngest cron, daily at 3am
- ✅ Where to store outputs → JSONB for text, x402_cached_images for images

### Require Phase-Specific Research

- ❓ **Performance:** How fast are OpenRouter API calls? (Test in execution phase)
- ❓ **Rate limits:** What are OpenRouter rate limits per key? (Test in execution phase)
- ❓ **Streaming:** Does SDK support server-sent events for real-time? (Check SDK docs in streaming phase)
- ❓ **Cost tracking:** Should we track per-user OpenRouter spend? (Decide in execution phase)

### Deferred to Post-MVP

- Batch execution support (execute same prompt across multiple models)
- Cost estimation before execution
- Model comparison UI
- Fine-tuned model support

## References & Sources

**High Confidence (Official Documentation):**

- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models) - Model catalog endpoint
- [OpenRouter TypeScript SDK](https://openrouter.ai/docs/sdks/typescript) - Official SDK documentation
- [OpenRouter Multimodal Overview](https://openrouter.ai/docs/guides/overview/multimodal/overview) - Input/output types
- [OpenRouter Image Generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) - Base64 response format

**Medium Confidence (Community Implementation):**

- [x402-OpenRouter Integration Example](https://github.com/ekailabs/x402-openrouter) - Reference implementation
- [x402 Protocol Overview](https://www.x402.org/) - Payment protocol spec
- [InfoQ: x402 Expansion](https://www.infoq.com/news/2026/01/x402-agentic-http-payments/) - Protocol updates 2026

**Existing Codebase (HIGH confidence):**

- `/apps/x402-jobs-api/src/routes/execute.ts` - Current execution flow
- `/supabase/migrations/20250120_create_ai_models_table.sql` - Model catalog schema
- `/supabase/migrations/20251218_add_discord_integration.sql` - Integration table pattern
- `/apps/x402-jobs-api/src/inngest/functions/poll-bazaar-discovery.ts` - Cron job pattern
- `/packages/services/src/services/ModelService/ModelService.ts` - Model service implementation

---

_Architecture research completed: 2026-01-26_
_Researcher: Claude Sonnet 4.5_
