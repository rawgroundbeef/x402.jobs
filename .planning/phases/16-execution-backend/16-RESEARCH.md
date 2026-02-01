# Phase 16: Execution Backend - Research

**Researched:** 2026-01-27
**Domain:** Server-side OpenRouter API execution, encrypted key retrieval, LRO pattern, error handling
**Confidence:** HIGH

## Summary

Phase 16 implements server-side execution of `openrouter_instant` resources. The codebase already has complete patterns for this from the `prompt_template` execution (Claude with creator's API key). This phase follows the same architecture: decrypt creator's stored API key, substitute parameters into the prompt, call OpenRouter API, log usage, and return full response via LRO pattern.

Key findings:

- The existing `prompt_template` executor in `instant.ts` is the exact pattern to follow for `openrouter_instant`
- Use the `openai` npm package with `baseURL: "https://openrouter.ai/api/v1"` per prior decision
- OpenRouter uses OpenAI-compatible API with HTTP-Referer and X-Title headers for attribution
- Error codes map directly: 401 (invalid key), 402 (credits depleted), 429 (rate limit), 502/503 (model unavailable)
- The `getCreatorOpenRouterApiKey()` function already exists in `integrations.ts`
- No streaming per CONTEXT.md decision - wait for full response before returning (LRO pattern)

**Primary recommendation:** Add `openrouter_instant` case to the existing `instant.ts` route handler, following the exact `prompt_template` pattern but using the openai npm package with OpenRouter baseURL override. Reuse all existing patterns for validation, error mapping, and usage logging.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Backend)

| Library               | Version  | Purpose               | Why Standard                     |
| --------------------- | -------- | --------------------- | -------------------------------- |
| express               | ^4.18.2  | API routing           | Already used in x402-jobs-api    |
| @supabase/supabase-js | ^2.38.4  | Database access       | Already used for all data access |
| zod                   | ^4.1.11  | Validation            | Already used in backend          |
| crypto (Node.js)      | built-in | Encryption/decryption | Already used via `encrypt.ts`    |

### To Add

| Library | Version | Purpose              | Why Standard                             |
| ------- | ------- | -------------------- | ---------------------------------------- |
| openai  | ^4.73.0 | OpenRouter API calls | Per decision - use with baseURL override |

### Supporting (Already Available)

| Library                        | Version | Purpose                | When to Use                            |
| ------------------------------ | ------- | ---------------------- | -------------------------------------- |
| `src/lib/instant/encrypt.ts`   | N/A     | AES-256-CBC encryption | API key decrypt                        |
| `getCreatorOpenRouterApiKey()` | N/A     | Key retrieval          | Already implemented in integrations.ts |

### Alternatives Considered

| Instead of         | Could Use  | Tradeoff                                                                                      |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------- |
| openai npm package | Raw fetch  | Fetch works but openai package gives better types, streaming support (future), error handling |
| @openrouter/sdk    | openai npm | openai package is more mature, per prior decision                                             |

**Installation:**

```bash
# In x402-jobs-api directory
npm install openai
```

## Architecture Patterns

### Recommended Project Structure

```
x402-jobs-api/src/
├── routes/
│   └── instant.ts           # Add openrouter_instant case to existing switch
├── lib/
│   └── instant/
│       └── encrypt.ts       # Existing encryption utility (no changes)
└── routes/
    └── integrations.ts      # Has getCreatorOpenRouterApiKey() already
```

### Pattern 1: OpenRouter API Call via openai Package

**What:** Use openai npm package with baseURL override for OpenRouter
**When to use:** All openrouter_instant executions
**Source:** [OpenRouter OpenAI SDK Guide](https://openrouter.ai/docs/guides/community/openai-sdk)

```typescript
import OpenAI from "openai";

async function executeOpenRouterInstant(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userMessage: string | undefined,
  params: { temperature?: number; maxTokens?: number; topP?: number },
): Promise<{
  success: boolean;
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
}> {
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://x402.jobs",
      "X-Title": "x402.jobs",
    },
  });

  try {
    // Build messages array
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({
      role: "user",
      content:
        userMessage || "Please respond based on the system instructions.",
    });

    const response = await client.chat.completions.create({
      model: modelId, // e.g., "openai/gpt-4o" or "anthropic/claude-sonnet-4-20250514"
      messages,
      temperature: params.temperature ?? 1.0,
      max_tokens: params.maxTokens ?? 4000,
      top_p: params.topP ?? 1.0,
      stream: false, // No streaming per CONTEXT.md decision
    });

    const content = response.choices[0]?.message?.content || "";

    return {
      success: true,
      content,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    return {
      success: false,
      errorMessage: message,
    };
  }
}
```

### Pattern 2: Parameter Substitution (Reuse Existing)

**What:** Replace `{{param}}` tags with provided values
**When to use:** Before sending to OpenRouter API
**Source:** Follow the exact pattern from prompt_template

```typescript
// Reuse existing substituteParameters function from prompt_template
function substituteParameters(
  systemPrompt: string,
  parameters: Array<{ name: string; required: boolean; default?: string }>,
  providedValues: Record<string, string>,
): string {
  let result = systemPrompt;

  for (const param of parameters) {
    const value = providedValues[param.name] ?? param.default;
    if (value !== undefined) {
      // Replace {name}{/name} with the value (matches prompt_template pattern)
      const regex = new RegExp(`\\{${param.name}\\}\\{/${param.name}\\}`, "g");
      result = result.replace(regex, value);
    }
  }

  return result;
}
```

### Pattern 3: Error Mapping for OpenRouter

**What:** Map OpenRouter API errors to user-friendly messages
**When to use:** All error handling
**Source:** [OpenRouter Errors Documentation](https://openrouter.ai/docs/api/reference/errors-and-debugging)

```typescript
function mapOpenRouterError(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof OpenAI.APIError) {
    switch (error.status) {
      case 401:
        // Invalid API key
        return {
          message: "Resource unavailable", // Generic per CONTEXT.md
          status: 500,
        };
      case 402:
        // Credits depleted
        return {
          message: "Resource unavailable", // Generic per CONTEXT.md
          status: 500,
        };
      case 403:
        // Input flagged by moderation
        return {
          message: "Request rejected by content moderation",
          status: 400,
        };
      case 408:
        // Request timeout
        return {
          message: "Request timed out. Please try again.",
          status: 504,
        };
      case 429:
        // Rate limited
        return {
          message: "Rate limit exceeded. Please try again in a moment.",
          status: 429,
        };
      case 502:
        // Model down or invalid response
        return {
          message: "Resource unavailable", // Generic per CONTEXT.md
          status: 502,
        };
      case 503:
        // No provider available (model deprecated/removed)
        return {
          message: "Resource unavailable", // Generic per CONTEXT.md
          status: 503,
        };
      default:
        return {
          message: "Resource unavailable",
          status: error.status || 500,
        };
    }
  }

  return {
    message: "Resource unavailable",
    status: 500,
  };
}
```

### Pattern 4: Usage Logging (Match prompt_template)

**What:** Log execution to database for creator dashboard
**When to use:** After every execution (success or failure)
**Source:** Existing `logPromptTemplateUsage` in instant.ts

```typescript
// Reuse the existing x402_prompt_template_usage_logs table
// The table structure supports both Claude and OpenRouter executions
interface UsageLogParams {
  templateId: string;
  callerId: string;
  status: "success" | "failed";
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
  amountPaid?: number;
  paymentSignature?: string;
  network?: string;
  executionTimeMs?: number;
}

// Use existing logPromptTemplateUsage function - it's resource-type agnostic
async function logPromptTemplateUsage(params: UsageLogParams): Promise<void> {
  // ... existing implementation works for both prompt_template and openrouter_instant
}
```

### Pattern 5: Resource Loading with OpenRouter Config

**What:** Load resource with OpenRouter-specific fields
**When to use:** When handling openrouter_instant requests
**Source:** Extend existing loadResource function

```typescript
// Add to InstantResource interface
interface InstantResource {
  // ... existing fields ...

  // OpenRouter-specific fields (from Phase 11 database)
  openrouter_model_id: string | null;
  openrouter_config: {
    modelId: string;
    systemPrompt: string;
    params: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    };
  } | null;
}

// Update loadResource query to include new fields
const { data: resource } = await supabase.from("x402_resources").select(`
    id, slug, name, description, price_usdc, resource_type,
    // ... existing fields ...
    openrouter_model_id,
    openrouter_config
  `);
// ... rest of query
```

### Anti-Patterns to Avoid

- **Streaming for openrouter_instant:** CONTEXT.md explicitly says "No streaming - wait for full OpenRouter response"
- **Exposing error details:** Per CONTEXT.md, all failures return generic "Resource unavailable" message
- **Custom retry logic:** Per CONTEXT.md, "All OpenRouter errors fail the job (no retry logic)"
- **Per-resource API keys:** Use user-level integration from user_openrouter_integrations table

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                | Don't Build   | Use Instead                       | Why                                            |
| ---------------------- | ------------- | --------------------------------- | ---------------------------------------------- |
| OpenRouter API calls   | Raw fetch     | openai npm package                | Better types, error handling, future streaming |
| Encryption             | Custom crypto | `src/lib/instant/encrypt.ts`      | Battle-tested, consistent with Claude          |
| API key retrieval      | Custom query  | `getCreatorOpenRouterApiKey()`    | Already implemented in integrations.ts         |
| Validation             | Custom checks | `validatePromptTemplateRequest()` | Same pattern works for openrouter_instant      |
| Usage logging          | New table     | `x402_prompt_template_usage_logs` | Existing table is resource-type agnostic       |
| Parameter substitution | New function  | Existing `substituteParameters()` | Already handles the `{name}{/name}` pattern    |

**Key insight:** The prompt*template executor is 95% of what's needed. The only changes are: (1) use openai package instead of anthropic SDK, (2) read from openrouter_config instead of pt*\* fields, (3) use getCreatorOpenRouterApiKey instead of getCreatorClaudeApiKey.

## Common Pitfalls

### Pitfall 1: Incorrect Model ID Format

**What goes wrong:** OpenRouter returns "Model not found" error
**Why it happens:** Using wrong model ID format (e.g., "gpt-4o" instead of "openai/gpt-4o")
**How to avoid:** Always use provider-prefixed format from openrouter_config.modelId
**Warning signs:** 404 or 503 errors from OpenRouter

### Pitfall 2: Missing HTTP-Referer Header

**What goes wrong:** Request might be rate-limited or deprioritized
**Why it happens:** OpenRouter uses these headers for attribution/analytics
**How to avoid:** Always include HTTP-Referer and X-Title in defaultHeaders
**Warning signs:** Unexplained rate limiting

### Pitfall 3: Exposing Error Details

**What goes wrong:** Callers learn about creator's key/credit status
**Why it happens:** Forgetting CONTEXT.md decision about generic error messages
**How to avoid:** ALL failures return "Resource unavailable" - never expose 401/402 details
**Warning signs:** Error messages mentioning "credits" or "API key"

### Pitfall 4: Using Streaming

**What goes wrong:** LRO pattern breaks, client can't handle SSE
**Why it happens:** Copying from prompt_template which has streaming support
**How to avoid:** Always `stream: false` in the OpenAI client call
**Warning signs:** Response headers show text/event-stream

### Pitfall 5: Wrong API Key Source

**What goes wrong:** Using caller's key instead of creator's key
**Why it happens:** Confusion about who pays for OpenRouter usage
**How to avoid:** Always call `getCreatorOpenRouterApiKey(resource.server.registered_by)`
**Warning signs:** Callers being prompted for their own API key

## Code Examples

Verified patterns from existing codebase and official sources:

### Complete openrouter_instant Executor

```typescript
// Add to instant.ts switch statement
case "openrouter_instant": {
  const result = await executeOpenRouterInstant(
    resource,
    req.body,
    isOwnerTest,
    {
      callerId: req.user?.id,
      amountPaid: priceUsdc,
      paymentSignature: paymentResult.txHash,
      network,
    },
  );

  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }

  // Update stats
  await updateResourceStats(resource.id, priceUsdc, platformFeePercent);

  return res.json(result.response);
}
```

### OpenRouter Client Setup

```typescript
// Source: OpenRouter docs + prior decision
import OpenAI from "openai";

function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://x402.jobs",
      "X-Title": "x402.jobs",
    },
  });
}
```

### Validation Reuse

```typescript
// Same validation as prompt_template - reuse directly
function validateOpenRouterRequest(
  resource: {
    openrouter_config?: {
      params?: { maxTokens?: number };
    } | null;
  },
  body: Record<string, unknown>,
): string | null {
  // Validate parameters if defined in config
  // ... similar to validatePromptTemplateRequest

  // Validate user_message if provided
  if (
    body.user_message !== undefined &&
    typeof body.user_message !== "string"
  ) {
    return "user_message must be a string";
  }

  return null;
}
```

## State of the Art

| Old Approach            | Current Approach               | When Changed   | Impact                            |
| ----------------------- | ------------------------------ | -------------- | --------------------------------- |
| Raw fetch to OpenRouter | openai npm package             | Prior decision | Better types, error handling      |
| Per-resource API keys   | User-level integrations        | Phase 11       | Single key for all resources      |
| Streaming responses     | LRO pattern (no streaming)     | CONTEXT.md     | Simpler client integration        |
| Detailed error messages | Generic "Resource unavailable" | CONTEXT.md     | Security (no key/credit exposure) |

**Deprecated/outdated:**

- N/A - Following current established patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Usage table column naming**
   - What we know: `x402_prompt_template_usage_logs` exists
   - What's unclear: Should we rename it to be more generic, or just reuse as-is?
   - Recommendation: Reuse as-is - the table structure works for any LLM-based resource

2. **Model deprecation detection**
   - What we know: OpenRouter returns 503 for deprecated/unavailable models
   - What's unclear: Should we proactively check model availability?
   - Recommendation: No - per CONTEXT.md, "no proactive notification" - creators see failures in dashboard

3. **Rate limit configuration**
   - What we know: CONTEXT.md mentions "Global platform rate limits for abuse prevention"
   - What's unclear: Exact thresholds not specified
   - Recommendation: Use existing rate limiting patterns, defer threshold decision to implementation

## Sources

### Primary (HIGH confidence)

- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/routes/instant.ts` - Existing prompt_template executor (exact pattern)
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/routes/integrations.ts` - getCreatorOpenRouterApiKey() implementation
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/lib/instant/encrypt.ts` - Encryption utility
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) - API documentation
- [OpenRouter Error Handling](https://openrouter.ai/docs/api/reference/errors-and-debugging) - Error codes

### Secondary (MEDIUM confidence)

- [OpenRouter OpenAI SDK Guide](https://openrouter.ai/docs/guides/community/openai-sdk) - SDK integration pattern
- `/Users/rawgroundbeef/Projects/memeputer/packages/services/src/services/LLMServices/OpenRouterService.ts` - Existing OpenRouter usage

### Tertiary (LOW confidence)

- N/A - All findings verified with official sources

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using established packages per prior decision
- Architecture: HIGH - Following exact prompt_template pattern
- Pitfalls: HIGH - Based on official OpenRouter docs and CONTEXT.md decisions

**Research date:** 2026-01-27
**Valid until:** 30 days (OpenRouter API is stable)

---

_Phase: 16-execution-backend_
_Research completed: 2026-01-27_
