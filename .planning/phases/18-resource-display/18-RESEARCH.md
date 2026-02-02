# Phase 18: Resource Display - Research

**Researched:** 2026-01-27
**Domain:** Next.js UI patterns, React form handling, multi-modal content display
**Confidence:** HIGH

## Summary

This phase extends the existing `ResourceDetailPage` and `ResourcesListPage` to support OpenRouter instant resources. The codebase already has robust patterns for displaying prompt_template resources with parameter forms and execution UX - OpenRouter resources follow the exact same patterns with modality-aware result display.

Key findings:

- Existing `ResourceCard` and `ResourceDetailPage` components handle all resource types through discriminated unions
- Form handling uses react-hook-form + zod validation (established pattern)
- LRO (Long-Running Operation) components handle execution feedback with retry logic for images
- Result display already supports inline images, videos, and audio with automatic detection
- API returns `resource_type`, `pt_parameters`, `openrouter_model_id`, and model metadata for OpenRouter resources

**Primary recommendation:** Extend existing components rather than creating new ones. OpenRouter resources are a variant of prompt_template with modality-aware results.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library             | Version | Purpose                 | Why Standard                                             |
| ------------------- | ------- | ----------------------- | -------------------------------------------------------- |
| React Hook Form     | 7.x     | Form state management   | Minimal re-renders, hooks-based, established in codebase |
| Zod                 | 3.x     | Schema validation       | Type-safe runtime validation, established in codebase    |
| @hookform/resolvers | 3.x     | Integration layer       | Official resolver for react-hook-form + zod              |
| Next.js Image       | 14.x    | Optimized image display | Automatic WebP/AVIF, lazy loading, built-in              |
| SWR                 | 2.x     | Data fetching           | Already used for resources API, established in codebase  |

### Supporting

| Library      | Version  | Purpose       | When to Use                      |
| ------------ | -------- | ------------- | -------------------------------- |
| lucide-react | Latest   | UI icons      | Already used throughout codebase |
| Tailwind CSS | 3.x      | Styling       | Established design system        |
| @repo/ui     | Internal | UI components | Platform component library       |

### Alternatives Considered

| Instead of      | Could Use   | Tradeoff                                     |
| --------------- | ----------- | -------------------------------------------- |
| React Hook Form | Formik      | Formik has more bundle size, less performant |
| Zod             | Yup         | Zod has better TypeScript inference          |
| SWR             | React Query | Both are good, SWR already established       |

**Installation:**

```bash
# All dependencies already installed in codebase
npm install react-hook-form zod @hookform/resolvers
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── ResourceCard/           # Listing card (all resource types)
│   ├── pages/
│   │   └── ResourceDetailPage/ # Detail page (all resource types)
│   └── lro/                    # Long-running operation components
│       ├── ResultDisplay.tsx   # Multi-modal result display
│       └── PollingProgress.tsx # Execution progress
├── types/
│   └── openrouter-resource.ts  # OpenRouter-specific types
└── lib/
    └── format.ts               # Formatting utilities
```

### Pattern 1: Discriminated Union Resource Types

**What:** Use TypeScript discriminated unions to handle different resource types in the same component
**When to use:** When a component needs to render different resource types with shared and type-specific fields
**Example:**

```typescript
// Existing pattern from ResourceDetailPage.tsx
const isPromptTemplate = resource?.resource_type === "prompt_template";
const isOpenRouter = resource?.resource_type === "openrouter_instant";

// Conditional rendering based on type
{isPromptTemplate && sortedPtParameters.length > 0 && (
  <div className="space-y-4 mb-6">
    {/* Render prompt template form */}
  </div>
)}

{isOpenRouter && sortedPtParameters.length > 0 && (
  <div className="space-y-4 mb-6">
    {/* Render OpenRouter form (same pattern) */}
  </div>
)}
```

### Pattern 2: React Hook Form + Zod Schema Validation

**What:** Define schema first, use zodResolver to connect validation to form
**When to use:** All form validation in the application
**Example:**

```typescript
// From codebase: CreateResourceModal.tsx
const formSchema = createOpenRouterResourceSchema; // Zod schema

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(formSchema),
  defaultValues: {
    /* ... */
  },
});

// Validation happens automatically on submit
const onSubmit = handleSubmit(async (data) => {
  // data is type-safe and validated
});
```

### Pattern 3: LRO Polling with useLROPolling Hook

**What:** Custom hook that manages long-running operation state with retry logic
**When to use:** Resource execution that returns async job results
**Example:**

```typescript
// From ResourceDetailPage.tsx
const lro = useLROPolling({ maxAttempts: 120 });

// Start polling when execution returns jobId
await lro.startPolling(statusUrl, retryAfterSeconds);

// Render progress and results
{lro.isPolling && <PollingProgress {...lro} />}
{lro.result && <ResultDisplay result={lro.result} />}
```

### Pattern 4: Inline Multi-Modal Result Display

**What:** Detect content type from response and render inline (images, video, audio, text)
**When to use:** Displaying execution results that may contain media
**Example:**

```typescript
// From ResultDisplay.tsx
const isImageUrl = (url: string) =>
  url.startsWith("data:image/") || [".jpg", ".png"].some(ext => url.includes(ext));

{artifactUrl && isImageUrl(artifactUrl) && (
  <img
    src={artifactUrl}
    className="rounded-lg max-h-96 w-auto mx-auto border"
    onLoad={() => setImageState("loaded")}
  />
)}
```

### Pattern 5: Image Loading with Retry Logic

**What:** Retry loading images with exponential backoff for CDN propagation delays
**When to use:** Displaying images that may not be immediately available (generated content)
**Example:**

```typescript
// From ResultDisplay.tsx
const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
  "loading",
);
const [retryCount, setRetryCount] = useState(0);

useEffect(() => {
  if (imageState === "error" && retryCount < maxRetries) {
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1);
      setImageState("loading");
    }, retryDelay);
    return () => clearTimeout(timer);
  }
}, [imageState, retryCount]);
```

### Anti-Patterns to Avoid

- **Creating separate components for OpenRouter resources:** They follow the same UX patterns as prompt_template, use conditional rendering in existing components
- **Client-side type coercion:** Zod schemas handle validation and type conversion, don't manually parse strings to numbers
- **Eager image loading:** Use lazy loading and retry logic for generated images that may have CDN propagation delays
- **Hardcoding resource type checks:** Use TypeScript discriminated unions and type guards

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                      | Don't Build                 | Use Instead                     | Why                                              |
| ---------------------------- | --------------------------- | ------------------------------- | ------------------------------------------------ |
| Form validation              | Custom validation logic     | react-hook-form + zod           | Type-safe, less code, better error handling      |
| LRO polling                  | setTimeout loops            | useLROPolling hook              | Already handles edge cases, retry logic, cleanup |
| Image retry logic            | Manual retry                | ResultDisplay component         | Handles CDN delays, loading states, max retries  |
| Resource type discrimination | if/else chains              | TypeScript discriminated unions | Type-safe, compiler-checked exhaustiveness       |
| Parameter form generation    | Manual form fields          | Loop over `pt_parameters`       | DRY, works for all parameter counts              |
| Multi-modal detection        | Manual content-type parsing | isImageUrl/isVideoUrl helpers   | Handles both URLs and base64 data URLs           |

**Key insight:** The codebase already has robust patterns for prompt_template resources. OpenRouter resources are the same pattern with modality field added to results.

## Common Pitfalls

### Pitfall 1: Creating New Components for OpenRouter Resources

**What goes wrong:** Duplicating ResourceCard and ResourceDetailPage logic for OpenRouter resources
**Why it happens:** Assuming OpenRouter needs different UX patterns
**How to avoid:** Use discriminated unions (`resource_type` field) to conditionally render type-specific content in existing components
**Warning signs:** New files like `OpenRouterResourceCard.tsx` or separate detail pages

### Pitfall 2: Not Handling Image Loading States

**What goes wrong:** Blank screens or broken image icons when images aren't ready yet
**Why it happens:** Generated images may have CDN propagation delays (2-10 seconds)
**How to avoid:** Use existing ResultDisplay component with retry logic
**Warning signs:** User reports "image doesn't load" immediately after execution completes

### Pitfall 3: Ignoring Modality Field in Results

**What goes wrong:** Treating all OpenRouter results as text-only
**Why it happens:** Copying prompt_template patterns without checking for `images` array or `modality` field
**How to avoid:** Check `result.fullData.images` array and `result.fullData.modality` field, render appropriately
**Warning signs:** Image generation results only showing JSON instead of inline images

### Pitfall 4: Manual Form State Management

**What goes wrong:** useState for every form field, manual validation, spaghetti code
**Why it happens:** Not using react-hook-form + zod pattern
**How to avoid:** Define Zod schema, use useForm with zodResolver, let the library handle state
**Warning signs:** Many useState calls, manual onChange handlers, imperative validation

### Pitfall 5: Not Reusing pt_parameters Field

**What goes wrong:** Creating separate openrouter_parameters field in database
**Why it happens:** Thinking OpenRouter resources need different parameter structure
**How to avoid:** Use existing `pt_parameters` JSONB column - OpenRouter and prompt_template have identical parameter patterns
**Warning signs:** Schema migration adding `openrouter_parameters` column

### Pitfall 6: Hardcoding Model Display Info

**What goes wrong:** Not showing model name, pricing, or capabilities for OpenRouter resources
**Why it happens:** Not joining with `ai_models` table or using existing model data
**How to avoid:** API already returns model info via FK join, display it in detail page
**Warning signs:** OpenRouter resources missing model metadata that prompt_template resources show

## Code Examples

Verified patterns from official sources:

### Example 1: Type-Safe Resource Rendering (Discriminated Union)

```typescript
// Source: ResourceDetailPage.tsx (lines 334-415)
interface ResourceData {
  resource_type?: "prompt_template" | "openrouter_instant" | "proxy";
  parameters?: Array<{ name: string; required: boolean; }>;
  // ... other fields
}

// Type guard
const isPromptTemplate = resource?.resource_type === "prompt_template";
const isOpenRouter = resource?.resource_type === "openrouter_instant";

// Conditional rendering
{(isPromptTemplate || isOpenRouter) && sortedPtParameters.length > 0 && (
  <div className="space-y-4 mb-6">
    {sortedPtParameters.map((param) => (
      <div key={param.name}>
        <Label>{humanizeParamName(param.name)}</Label>
        <Input
          value={formData[param.name] || ""}
          onChange={(e) => handleFieldChange(param.name, e.target.value)}
        />
      </div>
    ))}
  </div>
)}
```

### Example 2: React Hook Form + Zod Integration

```typescript
// Source: CreateResourceModal.tsx (lines 47-60)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOpenRouterResourceSchema } from "@/types/openrouter-resource";

const form = useForm<CreateOpenRouterResourceInput>({
  resolver: zodResolver(createOpenRouterResourceSchema),
  defaultValues: {
    name: "",
    slug: "",
    network: "base",
    parameters: [],
  },
});

const onSubmit = form.handleSubmit(async (data) => {
  // data is validated and type-safe
  const response = await authenticatedFetch("/resources/openrouter", {
    method: "POST",
    body: JSON.stringify(data),
  });
});
```

### Example 3: Multi-Modal Result Display with Retry

```typescript
// Source: ResultDisplay.tsx (lines 88-114, 165-214)
const [imageState, setImageState] = useState<"loading" | "loaded" | "error">("loading");
const [retryCount, setRetryCount] = useState(0);
const maxRetries = 5;
const retryDelay = 2000;

// Reset on URL change
useEffect(() => {
  if (artifactUrl && isImageUrl(artifactUrl)) {
    setImageState("loading");
    setRetryCount(0);
  }
}, [artifactUrl]);

// Retry logic
useEffect(() => {
  if (imageState === "error" && retryCount < maxRetries && artifactUrl) {
    const timer = setTimeout(() => {
      setRetryCount(c => c + 1);
      setImageState("loading");
    }, retryDelay);
    return () => clearTimeout(timer);
  }
}, [imageState, retryCount, artifactUrl]);

// Render with states
{imageState === "loading" && (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin" />
    <p>Loading image (attempt {retryCount + 1}/{maxRetries + 1})...</p>
  </div>
)}

<img
  key={`${artifactUrl}-${retryCount}`}
  src={artifactUrl}
  className={imageState !== "loaded" ? "hidden" : ""}
  onLoad={() => setImageState("loaded")}
  onError={() => setImageState("error")}
/>
```

### Example 4: LRO Polling Pattern

```typescript
// Source: ResourceDetailPage.tsx (lines 313, 522-604)
const lro = useLROPolling({ maxAttempts: 120 });

const handleSubmit = async () => {
  const response = await authenticatedFetch("/execute", {
    method: "POST",
    body: JSON.stringify({
      resourceId: resource.id,
      resourceUrl: resource.resource_url,
      method: "POST",
      body: formData,
    }),
  });

  const data = await response.json();

  // Check for LRO response
  if (data.data?.statusUrl && data.data?.jobId) {
    setIsSubmitting(false);
    await lro.startPolling(data.data.statusUrl, data.data.retryAfterSeconds || 2);
    return;
  }

  // Synchronous response
  setSyncResult(data.data);
};

// Render polling state
{lro.isPolling && <PollingProgress {...lro} />}
{lro.result && <ResultDisplay result={lro.result} payment={payment} />}
```

### Example 5: Inline Image Display with Sizing

```typescript
// Source: ResultDisplay.tsx (lines 200-214)
// Next.js responsive image pattern
<a href={artifactUrl} target="_blank" rel="noopener noreferrer">
  <img
    src={artifactUrl}
    alt="Generated content"
    className="rounded-lg max-h-96 w-auto mx-auto border border-border"
    onLoad={() => setImageState("loaded")}
    onError={() => setImageState("error")}
  />
</a>

// Plain img tag is used (not next/image) because:
// 1. URLs are dynamic (base64 data URLs or external CDN URLs)
// 2. No optimization needed for one-time generated content
// 3. Direct link to full-size image is desired
```

### Example 6: Parameter Form with Validation Feedback

```typescript
// Source: ResourceDetailPage.tsx (lines 1116-1149)
{sortedPtParameters.map((param) => {
  const hasError = !!fieldErrors[param.name];
  return (
    <div key={param.name}>
      <Label htmlFor={param.name}>
        {humanizeParamName(param.name)}
        {param.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={param.name}
        value={formData[param.name] || ""}
        onChange={(e) => handleFieldChange(param.name, e.target.value)}
        placeholder={param.description || `Enter ${humanizeParamName(param.name)}...`}
        className={hasError ? "border-destructive" : ""}
      />
      {hasError && (
        <p className="text-xs text-destructive mt-1">{fieldErrors[param.name]}</p>
      )}
    </div>
  );
})}
```

## State of the Art

| Old Approach                     | Current Approach                 | When Changed | Impact                                |
| -------------------------------- | -------------------------------- | ------------ | ------------------------------------- |
| Separate pages per resource type | Discriminated unions in one page | 2025         | Single source of truth, less code     |
| Manual form validation           | Zod + react-hook-form            | 2025         | Type-safe, less boilerplate           |
| next/image for all images        | Plain img for dynamic content    | 2025         | Flexible for base64 and external URLs |
| Immediate image display          | Retry logic with loading states  | 2025         | Handles CDN propagation delays        |
| Formik                           | React Hook Form                  | 2024         | Better performance, smaller bundle    |

**Deprecated/outdated:**

- Manual useState per form field: Use react-hook-form
- if/else type checking: Use discriminated unions with TypeScript narrowing
- Separate modal components: Consolidated into CreateResourceModal with type prop

## Open Questions

Things that couldn't be fully resolved:

1. **Model metadata display priority**
   - What we know: API returns model info via FK join to `ai_models` table
   - What's unclear: Should model name appear in card or only detail page?
   - Recommendation: Detail page only to avoid clutter in listings - follow prompt_template pattern (doesn't show "Claude Sonnet" in card)

2. **Modality badge in listings**
   - What we know: Results have modality field (text/image/video/audio)
   - What's unclear: Should resource cards show modality badge before execution?
   - Recommendation: No - model capabilities can be shown on detail page, card focuses on usage stats

3. **Error display for unsupported modalities**
   - What we know: Backend logs warning for video/audio but doesn't fail
   - What's unclear: Should frontend show "video not supported" message?
   - Recommendation: No special handling - display whatever result backend returns, let backend handle graceful degradation

## Sources

### Primary (HIGH confidence)

- Codebase: ResourceDetailPage.tsx - Full implementation of prompt_template execution UX
- Codebase: ResultDisplay.tsx - Multi-modal result rendering with retry logic
- Codebase: CreateResourceModal.tsx - React Hook Form + Zod pattern
- Codebase: openrouter-resource.ts - Type definitions for OpenRouter resources
- Codebase: resources.ts (API) - Resource listing and detail endpoints

### Secondary (MEDIUM confidence)

- [React Hook Form with Zod](https://www.contentful.com/blog/react-hook-form-validation-zod/) - Official integration patterns
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image) - Responsive image documentation
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html) - Official TypeScript docs
- [shadcn/ui Forms](https://ui.shadcn.com/docs/forms/react-hook-form) - Form component patterns

### Tertiary (LOW confidence)

- None - all findings verified against codebase implementation

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already in use in codebase
- Architecture: HIGH - Patterns extracted from working implementation
- Pitfalls: HIGH - Based on existing code patterns and TypeScript discriminated union best practices

**Research date:** 2026-01-27
**Valid until:** 30 days (stable stack, patterns unlikely to change)
