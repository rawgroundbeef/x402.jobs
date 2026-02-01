# Phase 3: Server-Side Execution Engine - Research

**Researched:** 2026-01-19
**Domain:** Server-side Claude API execution with streaming, Express.js/API patterns
**Confidence:** HIGH

## Summary

This research addresses the execution engine for prompt template resources. The x402-jobs system has an established backend (`x402-jobs-api`) using Express.js that already handles resource execution, payment verification, and integrations. The existing `prompt` resource type provides a direct pattern for implementing `prompt_template` execution.

Key findings:

- The backend uses Express.js with existing patterns for API routes, authentication, and encryption
- A `prompt` resource type executor already exists that calls Anthropic's API (using fetch, not SDK)
- Integrations are stored in dedicated user tables (`x402_user_telegram_configs`, etc.)
- Encryption uses AES-256-CBC via a shared utility (`src/lib/instant/encrypt.ts`)
- Streaming is NOT currently used for the existing `prompt` type - it returns complete responses

**Primary recommendation:** Add `prompt_template` execution to the existing `instant.ts` route handler, using the `@anthropic-ai/sdk` for streaming. Create a dedicated Claude integration table following the Telegram pattern.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Backend)

| Library               | Version | Purpose         | Why Standard                     |
| --------------------- | ------- | --------------- | -------------------------------- |
| express               | ^4.18.2 | API routing     | Already used in x402-jobs-api    |
| @supabase/supabase-js | ^2.38.4 | Database access | Already used for all data access |
| zod                   | ^4.1.11 | Validation      | Already used in backend          |

### To Add

| Library           | Version | Purpose                   | Why Standard                         |
| ----------------- | ------- | ------------------------- | ------------------------------------ |
| @anthropic-ai/sdk | latest  | Claude API with streaming | Official SDK, required for streaming |

### Supporting (Already in Backend)

| Library          | Version  | Purpose               | When to Use        |
| ---------------- | -------- | --------------------- | ------------------ |
| crypto (Node.js) | built-in | Encryption/decryption | API key encryption |

**Installation:**

```bash
# In x402-jobs-api directory
npm install @anthropic-ai/sdk
```

## Architecture Patterns

### Recommended Project Structure

```
x402-jobs-api/src/
├── routes/
│   ├── instant.ts           # Add prompt_template executor
│   └── integrations.ts      # Add Claude integration routes
├── lib/
│   └── instant/
│       └── encrypt.ts       # Existing encryption utility
└── config/
    └── index.ts             # Add Claude API config if needed
```

### Pattern 1: Integration Storage (Following TelegramCard)

**What:** User-level API key storage in dedicated table
**When to use:** Always for sensitive credentials
**Example:**

```typescript
// Database table: x402_user_claude_configs
// Columns: user_id, api_key_encrypted, is_enabled, created_at, updated_at

// GET /integrations/claude/config
integrationsRouter.get(
  "/claude/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { data, error } = await getSupabase()
      .from("x402_user_claude_configs")
      .select("is_enabled")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(500).json({ error: "Failed to load Claude settings" });
    }

    res.json({
      hasApiKey: Boolean(data),
      isEnabled: data?.is_enabled ?? false,
    });
  },
);

// PUT /integrations/claude/config
integrationsRouter.put(
  "/claude/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { apiKey, isEnabled } = req.body || {};

    // Encrypt API key before storage
    const encryptedKey = apiKey ? encryptSecret(apiKey) : null;

    // Upsert config
    const { error } = await getSupabase()
      .from("x402_user_claude_configs")
      .upsert({
        user_id: userId,
        api_key_encrypted: encryptedKey || undefined,
        is_enabled: isEnabled ?? true,
      });

    if (error) {
      return res.status(500).json({ error: "Failed to save Claude settings" });
    }

    res.json({ success: true, hasApiKey: true, isEnabled: isEnabled ?? true });
  },
);
```

### Pattern 2: Parameter Substitution

**What:** Replace `{param}{/param}` tags with provided values
**When to use:** Before sending to Claude API
**Example:**

```typescript
// Source: src/lib/prompt-template-utils.ts pattern
function substituteParameters(
  systemPrompt: string,
  parameters: Record<string, string>,
): string {
  let result = systemPrompt;

  // Replace each {param}{/param} with its value
  for (const [name, value] of Object.entries(parameters)) {
    const regex = new RegExp(`\\{${name}\\}\\{/${name}\\}`, "g");
    result = result.replace(regex, value);
  }

  return result;
}
```

### Pattern 3: Streaming Response (Express + Anthropic SDK)

**What:** Stream Claude responses to caller via SSE
**When to use:** All prompt_template executions
**Example:**

```typescript
import Anthropic from "@anthropic-ai/sdk";

async function executePromptTemplateStreaming(
  res: Response,
  apiKey: string,
  systemPrompt: string,
  userMessage: string | undefined,
  maxTokens: number,
): Promise<void> {
  const client = new Anthropic({ apiKey });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const messages: Anthropic.MessageParam[] = userMessage
    ? [{ role: "user", content: userMessage }]
    : [{ role: "user", content: "Please respond based on the system prompt." }];

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  // Stream text deltas to client
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      res.write(
        `data: ${JSON.stringify({ type: "text", content: event.delta.text })}\n\n`,
      );
    }
  }

  // Send final message with token usage
  const finalMessage = await stream.finalMessage();
  res.write(
    `data: ${JSON.stringify({
      type: "done",
      usage: finalMessage.usage,
    })}\n\n`,
  );

  res.end();
}
```

### Pattern 4: Validation Before Payment

**What:** Reject invalid requests before x402 payment processing
**When to use:** At the start of request handling
**Example:**

```typescript
function validatePromptTemplateRequest(
  resource: InstantResource,
  body: Record<string, any>,
): { valid: true } | { valid: false; error: string } {
  // Check required parameters
  if (resource.pt_parameters) {
    for (const param of resource.pt_parameters) {
      const value = body[param.name];
      if (
        param.required &&
        (value === undefined || value === null || value === "")
      ) {
        if (!param.default) {
          return {
            valid: false,
            error: `Missing required parameter: ${param.name}`,
          };
        }
      }
    }
  }

  // Check user message if required/allowed
  if (resource.pt_allows_user_message && body.user_message) {
    if (typeof body.user_message !== "string") {
      return { valid: false, error: "user_message must be a string" };
    }
  }

  return { valid: true };
}
```

### Anti-Patterns to Avoid

- **Storing API keys in resource table:** Use user-level integration table instead
- **Non-streaming responses for prompt_template:** Always stream for better UX
- **Validating after payment:** Always validate parameters BEFORE x402 payment
- **Using fetch for Claude API:** Use @anthropic-ai/sdk for streaming support

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem          | Don't Build   | Use Instead                  | Why                                               |
| ---------------- | ------------- | ---------------------------- | ------------------------------------------------- |
| Encryption       | Custom crypto | `src/lib/instant/encrypt.ts` | Battle-tested, consistent with other integrations |
| Claude API calls | Raw fetch     | @anthropic-ai/sdk            | Proper streaming, error handling, types           |
| Authentication   | Custom auth   | `authMiddleware`             | Already handles Supabase JWT verification         |
| Database access  | Direct SQL    | `getSupabase()`              | Consistent connection management                  |

**Key insight:** The x402-jobs-api already has patterns for everything needed. Follow existing code rather than inventing new approaches.

## Common Pitfalls

### Pitfall 1: API Key Exposure

**What goes wrong:** Returning encrypted key to frontend, or logging decrypted key
**Why it happens:** Copy-paste from other code without understanding
**How to avoid:** Only return `hasApiKey: boolean`, never the actual key
**Warning signs:** Any `api_key` field in response objects

### Pitfall 2: Streaming Not Working

**What goes wrong:** Response buffers and sends all at once
**Why it happens:** Not calling `res.flushHeaders()` or missing proper headers
**How to avoid:** Always set SSE headers and flush before streaming
**Warning signs:** Long pause then all content appears at once

### Pitfall 3: Parameter Substitution Edge Cases

**What goes wrong:** Regex doesn't match, or replaces wrong text
**Why it happens:** Special characters in parameter names or values
**How to avoid:** Escape regex special chars, use global flag, test edge cases
**Warning signs:** Parameters not replaced, or replaced incorrectly

### Pitfall 4: Error After Payment

**What goes wrong:** User pays, then execution fails
**Why it happens:** Validation happens after payment verification
**How to avoid:** Validate ALL inputs before returning 402 or processing payment
**Warning signs:** Payment receipt in error responses

### Pitfall 5: Creator Can't Test Without Payment

**What goes wrong:** Creator must pay their own markup to test
**Why it happens:** No bypass for owner testing
**How to avoid:** Check if caller is resource owner, skip payment if so
**Warning signs:** Creators complaining about having to pay to test

## Code Examples

Verified patterns from existing codebase:

### Loading Resource with Creator Info

```typescript
// Source: x402-jobs-api/src/routes/instant.ts
async function loadResource(
  username: string,
  slug: string,
): Promise<InstantResource | null> {
  const supabase = getSupabase();

  // Find user by username
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!user) return null;

  // Find hosted server for user
  const { data: server } = await supabase
    .from("x402_servers")
    .select("id, registered_by")
    .eq("registered_by", user.id)
    .eq("is_hosted", true)
    .maybeSingle();
  if (!server) return null;

  // Find resource
  const { data: resource } = await supabase
    .from("x402_resources")
    .select(
      `
      id, slug, name, description, price_usdc, resource_type,
      pt_system_prompt, pt_parameters, pt_model, pt_max_tokens, pt_allows_user_message
    `,
    )
    .eq("server_id", server.id)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return resource
    ? { ...resource, server: { registered_by: server.registered_by } }
    : null;
}
```

### Getting Creator's Claude API Key

```typescript
// Pattern from integrations.ts adapted for Claude
async function getCreatorClaudeApiKey(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("x402_user_claude_configs")
    .select("api_key_encrypted, is_enabled")
    .eq("user_id", userId)
    .single();

  if (error || !data?.api_key_encrypted || !data.is_enabled) {
    return null;
  }

  return decryptSecret(data.api_key_encrypted);
}
```

### Error Response Format

```typescript
// Source: x402-jobs-api/src/routes/instant.ts
// Consistent error response with receipt when payment was made
return res.status(500).json({
  error: "Execution failed",
  message: execError.message,
  receipt: {
    transaction: paymentResult.txHash,
    paidUsdc: priceUsdc,
  },
});
```

## State of the Art

| Old Approach           | Current Approach        | When Changed           | Impact                                     |
| ---------------------- | ----------------------- | ---------------------- | ------------------------------------------ |
| Raw fetch to Anthropic | @anthropic-ai/sdk       | 2024                   | Proper streaming, types, error handling    |
| Per-resource API keys  | User-level integrations | Phase 2 decision       | Better UX, single config for all templates |
| Full response return   | SSE streaming           | Phase 3 implementation | Real-time UX for callers                   |

**Deprecated/outdated:**

- `prompt` resource type API key storage: Still per-resource, but `prompt_template` uses user-level
- Anthropic version header `2023-06-01`: SDK handles this automatically

## Open Questions

Things that couldn't be fully resolved:

1. **Error Mid-Stream**
   - What we know: SSE can send error events
   - What's unclear: Exact format for mid-stream errors that x402 clients expect
   - Recommendation: Send `{ type: 'error', message: '...' }` event, then close

2. **Creator Testing Authentication**
   - What we know: Need to bypass payment for owner testing
   - What's unclear: How to authenticate owner without full x402 payment flow
   - Recommendation: Accept `X-OWNER-TEST: true` header + Supabase JWT, verify ownership

3. **Non-Streaming Mode**
   - What we know: Some callers may want non-streaming
   - What's unclear: Whether this is needed for v1
   - Recommendation: Start with streaming only, add `stream=false` param if needed later

## Sources

### Primary (HIGH confidence)

- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/routes/instant.ts` - Existing prompt executor pattern
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/routes/integrations.ts` - Integration storage pattern
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/lib/instant/encrypt.ts` - Encryption utility
- [Anthropic SDK TypeScript Streaming](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/examples/streaming.ts) - Official streaming example

### Secondary (MEDIUM confidence)

- [Anthropic SDK npm](https://www.npmjs.com/package/@anthropic-ai/sdk) - SDK documentation
- [Next.js SSE Streaming](https://upstash.com/blog/sse-streaming-llm-responses) - SSE patterns for streaming

### Tertiary (LOW confidence)

- General Express.js streaming patterns - Need validation against specific x402 requirements

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Based on existing codebase analysis
- Architecture: HIGH - Following established patterns in x402-jobs-api
- Pitfalls: MEDIUM - Based on common patterns, need validation during implementation

**Research date:** 2026-01-19
**Valid until:** 30 days (stable patterns, but @anthropic-ai/sdk may update)
