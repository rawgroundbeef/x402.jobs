# Stack Research: OpenRouter Integration

**Project:** x402jobs v1.4 - OpenRouter Instant Resources
**Researched:** 2026-01-26
**Overall confidence:** HIGH

## Executive Summary

OpenRouter integration requires minimal new dependencies. Use the official OpenAI SDK (already a common Node.js dependency) as a drop-in replacement by changing the baseURL to OpenRouter's endpoint. This approach leverages battle-tested tooling and avoids beta dependencies. The existing AES-256-CBC encryption pattern can be reused for OpenRouter API keys without modification.

**Key decision:** Use `openai` npm package (v6.16.0) instead of `@openrouter/sdk` (beta, breaking changes risk).

## Recommended Stack Additions

### Core Integration

| Technology | Version | Purpose               | Why                                                                                                                                                                 |
| ---------- | ------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openai`   | ^6.16.0 | OpenRouter API client | OpenRouter is OpenAI API-compatible. Official SDK is stable, well-documented, and drop-in compatible. Avoid beta `@openrouter/sdk` which has breaking changes risk. |
| _(none)_   | -       | Encryption            | Reuse existing `encrypt.ts` (AES-256-CBC). Already proven with Claude API keys.                                                                                     |
| _(none)_   | -       | Model catalog sync    | Use native `fetch` to call OpenRouter `/api/v1/models` endpoint. No library needed.                                                                                 |

### Supporting Types (Optional)

| Library | Version | Purpose                                       | When to Use                                                      |
| ------- | ------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `zod`   | ^3.x    | Runtime validation for model catalog response | Only if not already in project. Validates model metadata schema. |

## OpenRouter API Details

### Base Configuration

**Endpoint:** `https://openrouter.ai/api/v1`
**Authentication:** Bearer token in `Authorization` header

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: decryptedUserApiKey,
  defaultHeaders: {
    "HTTP-Referer": "https://x402.jobs", // Optional, for OpenRouter leaderboards
    "X-Title": "x402jobs", // Optional, app identification
  },
});
```

### Rate Limits

**Free users:**

- 20 requests/minute for free models (IDs ending in `:free`)
- 50 requests/day (accounts with <$10 credits)
- 1000 requests/day (accounts with $10+ credits)

**Paid users:**

- No platform-level rate limits
- Dynamic scaling: $1 balance = 1 RPS capacity (max 500 RPS)
- Cloudflare DDoS protection blocks excessive usage

**Error codes:**

- `429` - Rate limit exceeded
- `402` - Negative account balance

### Model Catalog API

**Endpoint:** `GET https://openrouter.ai/api/v1/models`
**Authentication:** Optional (can fetch without auth)
**Response format:** JSON with OpenAI-compatible schema

**Key metadata fields:**

```typescript
interface ModelMetadata {
  id: string; // e.g., "openai/gpt-4-turbo"
  name: string; // Display name
  description: string; // Model description
  context_length: number; // Max tokens
  pricing: {
    prompt: string; // Cost per prompt token (USD)
    completion: string; // Cost per completion token (USD)
    request?: string; // Cost per request (optional)
    image?: string; // Cost per image (optional)
  };
  architecture: {
    modality: "text" | "text->image" | "text->video" | "text+image->text";
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  supported_parameters: string[]; // e.g., ["temperature", "top_p", "tools"]
}
```

### Pricing & Cost Tracking

**Model:** Pass-through pricing + 5.5% platform fee ($0.80 minimum on credit purchase)
**Billing:** Per-token, calculated using model's native tokenizer
**Cost transparency:** Response includes `usage.cost` field (in credits/USD)

```typescript
interface ResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number; // Total cost in USD
  cost_details?: {
    // Upstream provider breakdown
  };
}
```

## Multi-Modal Response Handling

### Text Models (Standard)

**Input:** Standard OpenAI messages format
**Output:** `choices[0].message.content` as string

No changes needed from existing Anthropic pattern.

### Image Generation Models

**Input:** Set `modalities: ["image", "text"]` in request body
**Output:** Images returned in `choices[0].message.images` array as base64 data URLs

```typescript
interface ImageGenerationResponse {
  choices: [
    {
      message: {
        role: "assistant";
        content: string; // Text description
        images?: [
          {
            type: "image_url";
            image_url: {
              url: string; // data:image/png;base64,...
            };
          },
        ];
      };
    },
  ];
}
```

**Format:** Base64-encoded data URLs (NOT external URLs)
**Example:** `data:image/png;base64,iVBORw0KGgoAAAANS...`

**Storage strategy:**

1. Extract base64 data from response
2. Option A: Return directly to caller (simplest, no storage)
3. Option B: Upload to Supabase Storage, return public URL (better for mobile)

### Video Models (Input)

**Support:** Limited to specific models (e.g., Gemini)
**Format:** YouTube URLs only for some providers (Google AI Studio)
**Alternative:** Base64-encoded video for other providers (`data:video/mp4;base64,...`)

**Recommendation:** Defer video input support to v2. Focus on text and image generation for v1.4.

### Audio Models

**Support:** Some models support audio input/output
**Format:** Base64-encoded data URLs similar to images

**Recommendation:** Defer audio support to v2. Not table-stakes for initial launch.

## Integration Points with Existing Stack

### 1. API Key Storage (Reuse Existing Pattern)

**Existing:** `x402_user_claude_configs` table with `api_key_encrypted` column
**New:** Create `x402_user_openrouter_configs` table with identical schema

```sql
CREATE TABLE x402_user_openrouter_configs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  api_key_encrypted TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Encryption:** Reuse existing `encryptSecret()` and `decryptSecret()` from `/lib/instant/encrypt.ts`

- Algorithm: AES-256-CBC
- IV: Random 16 bytes per encryption
- Format: `iv_hex:encrypted_hex`
- Key derivation: SHA-256 hash of `INTEGRATION_ENCRYPTION_SECRET` env var

### 2. Resource Execution Pattern (Server-Side)

**Existing:** `instant.ts` route executes prompt templates with creator's Claude API key
**New:** Add OpenRouter execution path using same pattern

```typescript
// Existing pattern (Claude)
const apiKey = await getCreatorClaudeApiKey(resource.user_id);
const anthropic = new Anthropic({ apiKey });

// New pattern (OpenRouter)
const apiKey = await getCreatorOpenRouterApiKey(resource.user_id);
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
});
```

**Key similarity:** Both use server-side execution with creator's stored API key, streaming responses to caller.

### 3. Resource Type Pattern

**Existing types:**

- `url` - Fetch from URL
- `webhook` - POST to webhook
- `prompt_template` - Execute with Claude

**New type:** `openrouter` (or `openrouter_template`)

- Stores: prompt template, parameters, selected model ID, pricing
- Executes: Server-side with creator's OpenRouter API key
- Returns: Streaming text OR base64 images depending on model modality

**Database columns to add:**

```sql
ALTER TABLE x402_resources ADD COLUMN or_model_id TEXT;
ALTER TABLE x402_resources ADD COLUMN or_template TEXT;
ALTER TABLE x402_resources ADD COLUMN or_parameters JSONB;
```

### 4. Model Catalog Sync

**Pattern:** Daily cron job (Inngest function) to sync model catalog
**Storage:** New table `x402_openrouter_models` with metadata

```sql
CREATE TABLE x402_openrouter_models (
  id TEXT PRIMARY KEY,                 -- Model ID (e.g., "openai/gpt-4-turbo")
  name TEXT NOT NULL,
  description TEXT,
  context_length INTEGER,
  modality TEXT NOT NULL,              -- "text", "text->image", etc.
  provider TEXT,                       -- Extracted from ID prefix
  pricing_prompt NUMERIC(10, 8),       -- Per token USD
  pricing_completion NUMERIC(10, 8),   -- Per token USD
  supported_parameters JSONB,
  is_popular BOOLEAN DEFAULT FALSE,    -- Manual curation flag
  metadata JSONB,                      -- Full model object
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Sync frequency:** Daily at 3 AM UTC (models rarely change)
**Endpoint:** `GET https://openrouter.ai/api/v1/models`
**Auth:** Not required (public endpoint)

### 5. Frontend Integration Points

**Settings page:** Add OpenRouter card next to existing Claude card
**Component:** Reuse `ClaudeCard.tsx` pattern for `OpenRouterCard.tsx`

**Create Resource modal:** Add "OpenRouter Template" option
**Flow:**

1. User selects OpenRouter resource type
2. Browse/search model catalog (fetched from `x402_openrouter_models`)
3. Configure prompt template with `{{param}}` syntax
4. Set flat-fee pricing
5. Test execution (user pays their own OpenRouter credits)

**Resource detail page:** Show model name, modality, estimated cost per call

## What NOT to Add

### 1. `@openrouter/sdk` (Beta Package)

**Why avoid:**

- Beta status with breaking changes risk (documentation warns to pin versions)
- Current version: 0.3.14 (published 3 days ago, rapid iteration)
- Adds unnecessary abstraction over OpenAI SDK
- No clear benefit over OpenAI SDK drop-in approach

**Alternative:** Use stable `openai` package with baseURL override.

### 2. `@openrouter/ai-sdk-provider` (Vercel AI SDK Wrapper)

**Why avoid:**

- Requires Vercel AI SDK as peer dependency (v1.5.4, another layer)
- Project doesn't use Vercel AI SDK patterns elsewhere
- Adds complexity for streaming when native OpenAI SDK streaming works
- Built for Vercel AI SDK's abstractions (streamText, generateText), not raw SDK usage

**Alternative:** Direct OpenAI SDK usage matches existing Anthropic SDK pattern.

### 3. Separate Encryption Library

**Why avoid:**

- Node.js `crypto` module (built-in) already in use
- Existing `encrypt.ts` is proven and simple
- External libraries (bcrypt, argon2) are for password hashing, not secret encryption
- AES-256-CBC is industry standard, no need for alternatives

**Alternative:** Reuse existing encryption pattern.

### 4. Model Catalog Caching Library

**Why avoid:**

- Model catalog changes infrequently (daily sync is sufficient)
- Supabase table provides natural cache layer
- Redis/memory cache adds operational complexity
- Frontend can cache with SWR (already used: `useSWR` in ClaudeCard)

**Alternative:** Postgres table + SWR on frontend.

### 5. Streaming Response Libraries

**Why avoid:**

- OpenAI SDK has built-in streaming support
- Next.js 15 supports streaming responses natively
- Existing prompt_template code already handles streaming with Anthropic SDK
- Pattern can be replicated for OpenRouter

**Alternative:** Native SDK streaming + Next.js Response streaming.

### 6. Image Processing Libraries (Sharp, Jimp)

**Why avoid for v1.4:**

- OpenRouter returns base64 data URLs directly
- Caller can decode/display without server processing
- Image optimization/resizing not required for v1.4
- Adds significant dependency weight

**Alternative:** Pass through base64 data URLs, defer optimization to v2.

## Installation

```bash
# Core dependency
npm install openai@^6.16.0

# Optional type validation (if not already installed)
npm install zod@^3.x
```

## Environment Variables

Add to `.env.local` and deployment config:

```bash
# Existing (reuse for OpenRouter)
INTEGRATION_ENCRYPTION_SECRET=<256-bit-secret>

# Optional: Platform-level OpenRouter key for model catalog sync
# (If you want to track sync usage separately)
OPENROUTER_PLATFORM_KEY=<optional>
```

## Migration Path from Existing Stack

| Step                               | Action                       | Risk                                    |
| ---------------------------------- | ---------------------------- | --------------------------------------- |
| 1. Install openai package          | `npm install openai@^6.16.0` | LOW - Stable, well-maintained package   |
| 2. Create OpenRouter configs table | SQL migration                | LOW - Follows Claude pattern exactly    |
| 3. Create models catalog table     | SQL migration                | LOW - New table, no existing data       |
| 4. Add integrations routes         | Extend `integrations.ts`     | LOW - Copy Claude pattern               |
| 5. Add model sync Inngest function | New cron job                 | LOW - Read-only API call                |
| 6. Extend instant.ts execution     | Add OpenRouter branch        | MEDIUM - Test thoroughly with streaming |
| 7. Add frontend UI                 | New components               | LOW - Reuse existing patterns           |

## Sources

- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) - HIGH confidence
- [OpenRouter Authentication Documentation](https://openrouter.ai/docs/api/reference/authentication) - HIGH confidence
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models) - HIGH confidence
- [OpenRouter Multimodal Documentation](https://openrouter.ai/docs/guides/overview/multimodal/overview) - HIGH confidence
- [OpenRouter Image Generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) - HIGH confidence
- [OpenRouter Rate Limits](https://openrouter.ai/docs/api/reference/limits) - HIGH confidence
- [@openrouter/sdk npm](https://www.npmjs.com/package/@openrouter/sdk) - HIGH confidence (for version/status check)
- [@openrouter/ai-sdk-provider npm](https://www.npmjs.com/package/@openrouter/ai-sdk-provider) - HIGH confidence (for version/status check)
- [openai npm package](https://www.npmjs.com/package/openai) - HIGH confidence (version 6.16.0)
- [OpenRouter Quickstart Guide](https://openrouter.ai/docs/quickstart) - HIGH confidence
- [OpenRouter TypeScript SDK Docs](https://openrouter.ai/docs/sdks/typescript) - MEDIUM confidence (for comparison)
- [OpenRouter Pricing](https://openrouter.ai/pricing) - HIGH confidence
- [OpenAI SDK Integration with OpenRouter](https://openrouter.ai/docs/guides/community/openai-sdk) - HIGH confidence

## Confidence Assessment

| Area                  | Level | Reason                                                              |
| --------------------- | ----- | ------------------------------------------------------------------- |
| OpenAI SDK approach   | HIGH  | Official OpenRouter documentation confirms OpenAI API compatibility |
| Model catalog API     | HIGH  | Direct API documentation with schema examples                       |
| Multi-modal responses | HIGH  | Official documentation with example response formats                |
| Rate limits           | HIGH  | Official documentation with specific numbers                        |
| Encryption reuse      | HIGH  | Verified existing encrypt.ts implementation, standard AES-256-CBC   |
| Avoid beta SDKs       | HIGH  | npm package shows beta status with version pinning warning          |
| Integration pattern   | HIGH  | Matches existing Claude pattern exactly                             |
