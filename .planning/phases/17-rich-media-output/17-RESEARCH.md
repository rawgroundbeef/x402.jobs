# Phase 17: Rich Media Output - Research

**Researched:** 2026-01-27
**Domain:** OpenRouter multi-modal output handling (image, video, audio)
**Confidence:** MEDIUM

## Summary

Phase 17 extends the existing `openrouter_instant` executor to handle multi-modal outputs from OpenRouter models. The ai_models table already categorizes models by modality (text, image, video, audio, embedding, multimodal), and the executor must detect output type and return appropriate response format. OpenRouter returns images as base64 data URLs in the `message.images` array, with specific request parameters (`modalities: ["image", "text"]`) required to enable image generation.

Key findings:

- **Image generation requires explicit opt-in**: Must pass `modalities: ["image", "text"]` in request to enable image output
- **Images returned as base64**: Response includes `message.images` array with `image_url.url` containing `data:image/png;base64,...`
- **Audio/video output limited**: OpenRouter primarily supports audio/video as inputs, not outputs. Audio output models exist but are model-specific
- **No video generation**: OpenRouter does not currently support video generation output models
- **Modality detection exists**: ai_models table already has `modality` field populated by sync-openrouter-models.ts

**Primary recommendation:** Add modality-aware response handling to `executeOpenRouterInstant()`. For image models, pass `modalities: ["image", "text"]` in request and extract images from response. For text models, continue with existing text extraction. Use fire-and-forget pattern to optionally upload base64 images to Supabase storage (following Phase 10 pattern). Video and audio outputs are not widely supported by OpenRouter and can be deferred.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Backend)

| Library               | Version | Purpose                | Why Standard                                        |
| --------------------- | ------- | ---------------------- | --------------------------------------------------- |
| openai                | ^4.73.0 | OpenRouter API calls   | Already installed in Phase 16 with baseURL override |
| @supabase/supabase-js | ^2.38.4 | Storage bucket uploads | Already used for generated-images bucket            |
| uuid                  | ^9.0.0  | Unique filenames       | Already used in upload.ts                           |

### Supporting (Already Available)

| Library                                           | Version | Purpose                | When to Use                          |
| ------------------------------------------------- | ------- | ---------------------- | ------------------------------------ |
| `src/routes/upload.ts`                            | N/A     | Image storage patterns | Reference for Supabase bucket upload |
| `src/inngest/functions/sync-openrouter-models.ts` | N/A     | Modality detection     | Reference for modality values        |

### Alternatives Considered

| Instead of       | Could Use        | Tradeoff                                            |
| ---------------- | ---------------- | --------------------------------------------------- |
| Supabase Storage | S3/Cloudflare R2 | Supabase already configured and working             |
| Base64 inline    | External URL     | Base64 works offline, URL requires fetch on display |

## Architecture Patterns

### Recommended Project Structure

```
x402-jobs-api/src/
├── routes/
│   └── instant.ts              # Extend executeOpenRouterInstant for multi-modal
├── lib/
│   └── instant/
│       └── media-handler.ts    # NEW: Extract/process media from OpenRouter response
```

### Pattern 1: Modality-Aware Request Building

**What:** Modify OpenRouter request based on model modality
**When to use:** All openrouter_instant executions
**Source:** OpenRouter Image Generation docs

```typescript
// Determine if model outputs images
async function buildOpenRouterRequest(
  modelId: string,
  modelModality: string,
  messages: Array<{ role: string; content: string }>,
  config: OpenRouterConfig,
) {
  const baseRequest = {
    model: modelId,
    messages,
    temperature: config.temperature ?? 1.0,
    max_tokens: config.maxTokens ?? 4096,
    stream: false, // LRO pattern
  };

  // Add modalities for image output models
  if (modelModality === "image") {
    return {
      ...baseRequest,
      modalities: ["image", "text"], // Required for image generation
    };
  }

  return baseRequest;
}
```

### Pattern 2: Response Media Extraction

**What:** Extract images/media from OpenRouter response
**When to use:** After successful API call
**Source:** OpenRouter response schema

```typescript
interface OpenRouterMediaResponse {
  type: "text" | "image" | "audio";
  content: string; // Text content or empty
  images?: Array<{
    // Present for image models
    type: "image_url";
    image_url: {
      url: string; // "data:image/png;base64,..." or URL
    };
  }>;
  audioUrl?: string; // If audio model (rare)
}

function extractMediaFromResponse(
  response: OpenAI.Chat.Completions.ChatCompletion,
  modelModality: string,
): OpenRouterMediaResponse {
  const message = response.choices[0]?.message;
  const textContent = message?.content || "";

  // Check for images in response
  const images = (message as any)?.images;

  if (images && Array.isArray(images) && images.length > 0) {
    return {
      type: "image",
      content: textContent,
      images: images.map((img) => ({
        type: "image_url",
        image_url: { url: img.image_url?.url || img.url },
      })),
    };
  }

  return {
    type: "text",
    content: textContent,
  };
}
```

### Pattern 3: Fire-and-Forget Image Storage (Optional)

**What:** Upload base64 image to Supabase storage without blocking response
**When to use:** When returning image to caller (provides permanent URL)
**Source:** Phase 10 fire-and-forget pattern

```typescript
// Fire-and-forget storage upload (doesn't block response)
async function uploadImageToStorage(
  base64DataUrl: string,
  resourceId: string,
): Promise<string | null> {
  try {
    // Extract base64 and mime type
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;

    const [, mimeType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, "base64");
    const ext = mimeType.split("/")[1] || "png";

    // Generate unique path
    const filename = `openrouter-outputs/${resourceId}/${Date.now()}_${uuidv4().substring(0, 8)}.${ext}`;

    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from("generated-images")
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("[Instant] Image storage upload failed:", error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("generated-images")
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("[Instant] Image storage error:", err);
    return null;
  }
}
```

### Pattern 4: Response Format for Multi-Modal

**What:** Consistent response structure for all modality types
**When to use:** API response to caller

```typescript
interface OpenRouterInstantResponse {
  response: string; // Text content (always present)
  modality: "text" | "image" | "audio";
  usage: {
    input_tokens?: number;
    output_tokens?: number;
  };
  // Present for image models
  images?: Array<{
    url: string; // Base64 data URL or storage URL
    storageUrl?: string; // Permanent storage URL (if uploaded)
  }>;
  // Present for audio models (future)
  audio?: {
    url: string;
    format: string;
  };
}
```

### Anti-Patterns to Avoid

- **Blocking on storage upload:** Per prior decision, storage upload is fire-and-forget
- **Assuming modality from response:** Check ai_models.modality before request, don't infer from response
- **Large base64 in database:** Store URLs, not raw base64 data in usage logs
- **Exposing storage errors:** Storage failures don't fail the job (graceful degradation)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem            | Don't Build      | Use Instead                             | Why                                   |
| ------------------ | ---------------- | --------------------------------------- | ------------------------------------- |
| Image storage      | Custom S3 client | Supabase Storage (generated-images)     | Already configured with public access |
| Modality detection | Response parsing | ai_models.modality field                | Already populated by sync function    |
| Base64 decoding    | Custom parser    | Buffer.from(base64, "base64")           | Node.js built-in, battle-tested       |
| Unique filenames   | Custom generator | uuid + timestamp pattern from upload.ts | Already used, consistent naming       |

**Key insight:** The storage infrastructure from Phase 10 (x402.storage) and the upload.ts patterns provide everything needed. The only new logic is extracting media from OpenRouter's specific response format.

## Common Pitfalls

### Pitfall 1: Missing Modalities Parameter for Image Models

**What goes wrong:** Image model returns only text, no images generated
**Why it happens:** OpenRouter requires explicit `modalities: ["image", "text"]` in request
**How to avoid:** Check ai_models.modality, add modalities array when modality === "image"
**Warning signs:** Image model responses have empty images array, only text content

### Pitfall 2: Incorrect Image Response Path

**What goes wrong:** Cannot find images in response
**Why it happens:** OpenRouter puts images in `message.images`, not standard content array
**How to avoid:** Cast response to include images field, check both `message.images` and `message.content`
**Warning signs:** Type errors accessing images, undefined values

### Pitfall 3: Base64 URL Size in Logs

**What goes wrong:** Database bloat, slow queries
**Why it happens:** Logging full base64 data URLs (can be 1MB+ per image)
**How to avoid:** Log storage URL or truncated reference, not raw base64
**Warning signs:** Usage logs table growing rapidly, slow dashboard queries

### Pitfall 4: Storage Blocking Response

**What goes wrong:** Slow response times for image generation
**Why it happens:** Waiting for storage upload before returning to caller
**How to avoid:** Fire-and-forget pattern (return base64 immediately, upload async)
**Warning signs:** 5-10s delay after image generation before response

### Pitfall 5: Assuming All Media Models Work

**What goes wrong:** Errors with video/audio models
**Why it happens:** OpenRouter's video/audio output support is limited and model-specific
**How to avoid:** Focus on image models first, log but don't crash on unsupported modalities
**Warning signs:** 4xx/5xx errors for non-text modality models

## Code Examples

Verified patterns from official sources and existing codebase:

### Extended executeOpenRouterInstant for Multi-Modal

```typescript
// Source: instant.ts + OpenRouter docs
async function executeOpenRouterInstant(
  resource: InstantResource,
  body: Record<string, unknown>,
  isOwnerTest: boolean,
  context: ExecutePromptTemplateContext = {},
): Promise<
  { json: true; response: unknown } | { error: string; status: number }
> {
  // ... existing validation code ...

  // Look up model with modality
  const { data: model } = await getSupabase()
    .from("ai_models")
    .select("name, modality")
    .eq("id", resource.openrouter_model_id)
    .single();

  if (!model?.name) {
    return { error: "Resource unavailable", status: 500 };
  }

  const modelId = model.name;
  const modelModality = model.modality;

  // Build request with modality awareness
  const requestBody: any = {
    model: modelId,
    messages,
    temperature: config.temperature ?? 1.0,
    max_tokens: config.maxTokens ?? 4096,
    stream: false,
  };

  // Enable image generation for image models
  if (modelModality === "image") {
    requestBody.modalities = ["image", "text"];
  }

  const response = await client.chat.completions.create(requestBody);

  // Extract media from response
  const mediaResponse = extractMediaFromResponse(response, modelModality);

  // Build response based on modality
  const result: any = {
    response: mediaResponse.content,
    modality: mediaResponse.type,
    usage: {
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens,
    },
  };

  // Add images if present
  if (mediaResponse.images && mediaResponse.images.length > 0) {
    result.images = mediaResponse.images.map((img) => ({
      url: img.image_url.url,
    }));

    // Fire-and-forget storage upload (optional)
    // Don't await - return response immediately
    Promise.all(
      mediaResponse.images.map((img) =>
        uploadImageToStorage(img.image_url.url, resource.id),
      ),
    )
      .then((storageUrls) => {
        // Log storage URLs for debugging (don't block response)
        console.log(
          "[Instant] Images uploaded to storage:",
          storageUrls.filter(Boolean),
        );
      })
      .catch((err) => {
        console.error("[Instant] Storage upload failed (non-blocking):", err);
      });
  }

  return { json: true, response: result };
}
```

### Gemini Image Configuration (Model-Specific)

```typescript
// Source: OpenRouter docs - Gemini models only
if (modelId.includes("gemini") && modelModality === "image") {
  requestBody.image_config = {
    aspect_ratio: "1:1", // 1:1, 16:9, 3:2, etc.
    image_size: "1K", // 1K, 2K, or 4K
  };
}
```

## State of the Art

| Old Approach           | Current Approach              | When Changed | Impact                      |
| ---------------------- | ----------------------------- | ------------ | --------------------------- |
| Text-only execution    | Modality-aware execution      | This phase   | Support image model outputs |
| Return base64 only     | Base64 + optional storage URL | This phase   | Permanent URLs when needed  |
| Assume all models work | Check modality before request | This phase   | Proper error handling       |

**Deprecated/outdated:**

- Video generation via OpenRouter: Not widely supported, defer implementation
- Audio generation via OpenRouter: Limited model support, defer implementation

## Open Questions

Things that couldn't be fully resolved:

1. **Audio output model availability**
   - What we know: OpenRouter supports audio input models, audio output is model-specific
   - What's unclear: Which specific models support audio output and their response format
   - Recommendation: Support audio in types but log warning, implement fully when models available

2. **Video generation support**
   - What we know: OpenRouter docs mention video input, no video output documentation found
   - What's unclear: Whether video generation models exist on OpenRouter
   - Recommendation: Defer video support entirely, focus on image

3. **Storage URL persistence**
   - What we know: Fire-and-forget uploads create storage URLs
   - What's unclear: Should storage URLs be persisted in usage logs for later retrieval?
   - Recommendation: Include storage URLs in response, don't persist in logs (avoids bloat)

4. **Multi-image responses**
   - What we know: Some models can generate multiple images per request
   - What's unclear: How to handle multiple images in UI display
   - Recommendation: Return images array, UI handles display (defer to Phase 18)

## Sources

### Primary (HIGH confidence)

- [OpenRouter Image Generation Docs](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) - Response format, modalities parameter
- [OpenRouter Create Response API](https://openrouter.ai/docs/api/api-reference/responses/create-responses) - Full API schema
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/routes/instant.ts` - Existing executor pattern
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/routes/upload.ts` - Storage upload patterns
- `/Users/rawgroundbeef/Projects/memeputer/apps/x402-jobs-api/src/inngest/functions/sync-openrouter-models.ts` - Modality detection

### Secondary (MEDIUM confidence)

- [OpenRouter GPT-5 Image Model Page](https://openrouter.ai/openai/gpt-5-image) - Model capabilities
- [OpenRouter Gemini 3 Pro Image Page](https://openrouter.ai/google/gemini-3-pro-image-preview) - Gemini-specific config

### Tertiary (LOW confidence)

- WebSearch results on audio/video output - Limited/conflicting information about output support

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using existing libraries and patterns
- Architecture: HIGH - Following established instant.ts and storage patterns
- Image handling: MEDIUM - Based on official docs, needs implementation validation
- Audio/video: LOW - Limited documentation, defer implementation

**Research date:** 2026-01-27
**Valid until:** 30 days (OpenRouter API is stable, but multimodal features evolving)

---

_Phase: 17-rich-media-output_
_Research completed: 2026-01-27_
