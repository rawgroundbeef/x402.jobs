# Phase 4: Caller Detail Page + Parameter Form - Research

**Researched:** 2026-01-19
**Domain:** Frontend detail page patterns, dynamic forms, API consumption
**Confidence:** HIGH

## Summary

This research addresses the caller-facing detail page for prompt_template resources. The x402-jobs frontend has well-established patterns for resource detail pages (ResourceDetailPage.tsx) that can be directly adapted for prompt templates. The key differences are: (1) parameter form generation from template metadata instead of output_schema, (2) user message input when allows_user_message is true, and (3) response display without streaming (per CONTEXT.md decision).

Key findings:

- ResourceDetailPage.tsx provides a comprehensive pattern with form generation, validation, submission, and results display
- react-hook-form with Zod is already used for dynamic forms throughout the codebase
- No SSE/streaming patterns exist in the frontend - LRO polling is used for async operations
- The existing "try it" section pattern places form fields above, results below, with loading states
- Copy to clipboard uses native navigator.clipboard.writeText with visual feedback

**Primary recommendation:** Create PromptTemplateDetailPage following ResourceDetailPage structure. Reuse existing form patterns, adapt field generation from pt_parameters instead of output_schema, and use existing ResultDisplay/copy patterns for response display.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Frontend)

| Library         | Version  | Purpose               | Why Standard                                   |
| --------------- | -------- | --------------------- | ---------------------------------------------- |
| react-hook-form | existing | Form state management | Already used in CreateResourceModal, all forms |
| zod             | existing | Validation            | Already used with @hookform/resolvers          |
| swr             | existing | Data fetching         | Already used for all API calls                 |
| @repo/ui        | internal | UI components         | Consistent with all pages                      |

### Supporting (Already Available)

| Library         | Version  | Purpose | When to Use            |
| --------------- | -------- | ------- | ---------------------- |
| lucide-react    | existing | Icons   | All icons in the app   |
| next/navigation | existing | Routing | Client-side navigation |

**No new packages required.**

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/resources/[serverSlug]/[resourceSlug]/
│   └── page.tsx                    # Existing - detects resource type
├── components/pages/
│   ├── ResourceDetailPage/         # Existing - handles external/proxy resources
│   └── PromptTemplateDetailPage/   # NEW - handles prompt_template resources
│       ├── index.ts
│       └── PromptTemplateDetailPage.tsx
└── types/
    └── prompt-template.ts          # Existing - PromptTemplatePublicView type
```

### Pattern 1: Route-Level Resource Type Detection

**What:** Existing resource detail route detects type and renders appropriate component
**When to use:** Entry point for resource detail pages
**Example:**

```typescript
// Source: src/app/resources/[serverSlug]/[resourceSlug]/page.tsx
// The route fetches resource and routes to appropriate detail component

// Option A: Fetch in page, route to component
export default async function Page({ params }: PageProps) {
  const { serverSlug, resourceSlug } = await params;

  // Server-side fetch to determine resource type
  const res = await fetch(`${API_URL}/api/v1/resources/${serverSlug}/${resourceSlug}`);
  const { resource } = await res.json();

  if (resource.resource_type === 'prompt_template') {
    return <PromptTemplateDetailPage serverSlug={serverSlug} resourceSlug={resourceSlug} />;
  }

  return <ResourceDetailPage serverSlug={serverSlug} resourceSlug={resourceSlug} />;
}

// Option B (simpler): Both components fetch their own data and handle 404 gracefully
// Current pattern - let each component fetch and render appropriate UI
```

### Pattern 2: SWR Data Fetching with Public Fetcher

**What:** Use publicFetcher for unauthenticated data loading
**When to use:** Loading public resource details
**Example:**

```typescript
// Source: ResourceDetailPage.tsx pattern
const {
  data,
  isLoading,
  error: fetchError,
  mutate,
} = useSWR<{
  resource: PromptTemplatePublicView;
}>(`/api/v1/resources/${serverSlug}/${resourceSlug}`, publicFetcher);
```

### Pattern 3: Dynamic Form from Parameters

**What:** Generate form fields from pt_parameters array
**When to use:** Caller parameter input
**Example:**

```typescript
// Adapted from ResourceDetailPage field generation
// ResourceDetailPage uses output_schema.input.bodyFields
// PromptTemplateDetailPage uses resource.parameters

const fieldEntries = useMemo(() => {
  const params = resource?.parameters || [];
  return params.sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });
}, [resource?.parameters]);

// Form initialization with defaults
useEffect(() => {
  if (!resource) return;

  const defaults: Record<string, string> = {};
  for (const param of resource.parameters) {
    if (param.default !== undefined) {
      defaults[param.name] = param.default;
    }
  }
  setFormData(defaults);
}, [resource]);
```

### Pattern 4: Authenticated API Execution

**What:** POST to execution endpoint with auth token
**When to use:** Submitting prompt for execution
**Example:**

```typescript
// Source: ResourceDetailPage handleSubmit pattern
const handleSubmit = async () => {
  if (!resource) return;
  if (!user) {
    // Show login prompt
    return;
  }
  if (!validateForm()) return;

  setIsSubmitting(true);
  setError(null);
  setResult(null);

  try {
    const response = await authenticatedFetch(
      `/instant/@${serverSlug}/${resourceSlug}`,
      {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          ...(userMessage && { user_message: userMessage }),
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 402 && data.required) {
        setError(
          `Insufficient balance: need $${data.required.toFixed(2)} USDC`,
        );
      } else {
        setError(data.error || "Request failed");
      }
      return;
    }

    // Non-streaming: data.response contains full text
    setResult(data.response);
    if (data.payment) {
      setPayment(data.payment);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Request failed");
  } finally {
    setIsSubmitting(false);
  }
};
```

### Pattern 5: Copy to Clipboard with Feedback

**What:** Navigator clipboard API with visual confirmation
**When to use:** Copy output button
**Example:**

```typescript
// Source: ResourceDetailPage copyToClipboard
const [outputCopied, setOutputCopied] = useState(false);

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  setOutputCopied(true);
  setTimeout(() => setOutputCopied(false), 2000);
};

// Button rendering
<button
  onClick={() => copyToClipboard(result)}
  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
>
  {outputCopied ? (
    <>
      <Check className="h-3 w-3" />
      Copied
    </>
  ) : (
    <>
      <Copy className="h-3 w-3" />
      Copy
    </>
  )}
</button>
```

### Anti-Patterns to Avoid

- **Streaming consumption:** CONTEXT.md explicitly says "No streaming" - display complete response
- **Custom form library:** Use react-hook-form + Zod already in codebase
- **Direct system_prompt access:** PromptTemplatePublicView excludes it for security
- **Creating new routing patterns:** Follow existing `/resources/[server]/[slug]` pattern

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem          | Don't Build           | Use Instead                 | Why                           |
| ---------------- | --------------------- | --------------------------- | ----------------------------- |
| Form validation  | Custom validation     | react-hook-form + Zod       | Already used, tested patterns |
| Loading states   | Custom spinners       | Existing Loader2 + patterns | Consistent UX                 |
| Error display    | Custom error UI       | Alert component + patterns  | Consistent styling            |
| Layout           | Custom layout         | BaseLayout component        | Consistent page structure     |
| Avatar display   | Custom image handling | Avatar component            | Handles fallbacks             |
| Price formatting | String manipulation   | formatPrice from lib/format | Consistent USDC display       |

**Key insight:** ResourceDetailPage.tsx is 1450 lines with battle-tested patterns. Adapt, don't reinvent.

## Common Pitfalls

### Pitfall 1: Exposing system_prompt

**What goes wrong:** Frontend accidentally shows system prompt content
**Why it happens:** Using wrong type or fetching full resource data
**How to avoid:** Use PromptTemplatePublicView type which excludes pt_system_prompt
**Warning signs:** Any reference to system_prompt in detail page component

### Pitfall 2: Form Validation After Submit

**What goes wrong:** User sees error after clicking Run
**Why it happens:** Not using react-hook-form validation mode properly
**How to avoid:** Use mode: 'onChange' for immediate feedback, validate before submit
**Warning signs:** Validation errors appearing only after form submission

### Pitfall 3: Missing Login State Handling

**What goes wrong:** Logged-out user clicks Run, nothing happens
**Why it happens:** Not checking auth state before enabling button
**How to avoid:** Check user from useAuth(), show "Login to Run" on button
**Warning signs:** Run button enabled when not logged in

### Pitfall 4: Not Pre-filling Defaults

**What goes wrong:** User must fill in default values manually
**Why it happens:** Form not initialized with param.default values
**How to avoid:** Initialize formData with defaults on resource load
**Warning signs:** Optional fields with defaults showing empty

### Pitfall 5: Wrong API Endpoint

**What goes wrong:** 404 or method not allowed
**Why it happens:** Using wrong endpoint pattern
**How to avoid:** Use `/instant/@{username}/{slug}` pattern from instant.ts
**Warning signs:** Network errors on submit

## Code Examples

Verified patterns from the existing codebase:

### Page Header Layout

```typescript
// Source: ResourceDetailPage.tsx header section
<div className="text-center py-10 md:py-12">
  {/* Avatar */}
  <div className="flex justify-center mb-5">
    <Avatar
      src={avatarUrl}
      alt={resource.name}
      size="3xl"
      fallbackIcon={<Sparkles className="w-14 h-14 text-muted-foreground" />}
      className="border-2 border-border"
    />
  </div>

  {/* Name */}
  <h1 className="text-2xl md:text-3xl font-bold font-mono mb-2">
    <Link href={`/@${username}`} className="text-muted-foreground hover:text-foreground">
      @{username}
    </Link>
    <span className="text-muted-foreground/50">/</span>
    <span>{resourceSlug}</span>
  </h1>

  {/* Description */}
  {resource.description && (
    <p className="text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed">
      {resource.description}
    </p>
  )}

  {/* Stats line */}
  <p className="text-sm text-muted-foreground">
    {resource.usage_count?.toLocaleString() || 0} runs
    <span className="mx-2">-</span>
    {formatPrice(resource.price_usdc)} per run
  </p>
</div>
```

### Form Field Rendering

```typescript
// Source: ResourceDetailPage recursive field renderer (simplified for prompt_template)
const renderField = (param: PromptTemplateParameter) => {
  const hasError = !!fieldErrors[param.name];

  return (
    <div key={param.name}>
      <Label htmlFor={param.name} className="mb-1.5 block">
        {param.name.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
        {param.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={param.name}
        value={formData[param.name] || ""}
        onChange={(e) => handleFieldChange(param.name, e.target.value)}
        placeholder={param.description || `Enter ${param.name}...`}
        className={hasError ? "border-destructive" : ""}
      />
      {hasError && (
        <p className="text-xs text-destructive mt-1">{fieldErrors[param.name]}</p>
      )}
      {param.description && !hasError && (
        <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
      )}
    </div>
  );
};
```

### User Message Input (Conditional)

```typescript
// New pattern for allows_user_message
{resource.allows_user_message && (
  <div className="mt-4">
    <Label htmlFor="user-message">Your Message (optional)</Label>
    <Textarea
      id="user-message"
      value={userMessage}
      onChange={(e) => setUserMessage(e.target.value)}
      placeholder="Add any additional context or instructions..."
      rows={3}
      className="mt-1.5"
    />
  </div>
)}
```

### Result Display Area

```typescript
// Source: ResourceDetailPage syncResult display (non-LRO)
{result && !isSubmitting && (
  <div className="mt-6">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        Output
        {payment && (
          <span className="text-xs font-normal text-muted-foreground">
            - Paid ${payment.amount.toFixed(2)}
          </span>
        )}
      </h3>
      <button
        onClick={() => copyToClipboard(result)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {outputCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {outputCopied ? "Copied" : "Copy"}
      </button>
    </div>
    <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm">
      {result}
    </div>
  </div>
)}
```

### Loading State During Execution

```typescript
// Source: ResourceDetailPage submitting state
{isSubmitting && (
  <div className="mt-6 bg-muted rounded-lg p-6 flex items-center justify-center gap-2 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Running...
  </div>
)}
```

## State of the Art

| Old Approach        | Current Approach       | When Changed           | Impact                                       |
| ------------------- | ---------------------- | ---------------------- | -------------------------------------------- |
| Streaming UI        | Non-streaming display  | CONTEXT.md decision    | Simpler implementation, complete response    |
| LRO polling         | Direct response        | Phase 3 design         | Prompt templates are fast, no polling needed |
| output_schema forms | parameters array forms | prompt_template design | Cleaner, purpose-built structure             |

**Note:** While Phase 3 implements SSE streaming on the backend, CONTEXT.md for Phase 4 explicitly decided "No streaming - display complete response when execution finishes." This means the frontend waits for the full response.

## Open Questions

Things that couldn't be fully resolved:

1. **Resource Type Routing**
   - What we know: Current page.tsx passes slugs to ResourceDetailPage unconditionally
   - What's unclear: Whether to detect type in page.tsx (server) or in component (client)
   - Recommendation: Client-side detection in a shared component that SWR fetches then routes

2. **Error Format from Backend**
   - What we know: Standard error format with { error: string, message?: string }
   - What's unclear: Exact format for Claude API errors passed through
   - Recommendation: Handle generic error display, log details to console

3. **Price Display for Owner Testing**
   - What we know: Owners can test free via X-OWNER-TEST header
   - What's unclear: Should UI show "Free (owner)" or hide price?
   - Recommendation: Show "Run (Free)" for owners, normal price for callers

## Sources

### Primary (HIGH confidence)

- `src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx` - Full detail page pattern
- `src/components/modals/CreateResourceModal.tsx` - Dynamic form with react-hook-form
- `src/lib/api.ts` - API fetching patterns
- `src/types/prompt-template.ts` - PromptTemplatePublicView type definition

### Secondary (MEDIUM confidence)

- `src/components/lro/ResultDisplay.tsx` - Result display patterns (for reference)
- `src/app/resources/[serverSlug]/[resourceSlug]/page.tsx` - Routing pattern

### Tertiary (LOW confidence)

- Phase 3 Research - Backend SSE patterns (not used per CONTEXT.md decision)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Direct adaptation of ResourceDetailPage
- Pitfalls: HIGH - Based on existing page patterns and common issues

**Research date:** 2026-01-19
**Valid until:** 60 days (stable frontend patterns, no external dependencies)
