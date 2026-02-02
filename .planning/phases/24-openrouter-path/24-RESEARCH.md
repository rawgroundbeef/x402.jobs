# Phase 24: OpenRouter Path - Research

**Researched:** 2026-02-01
**Domain:** OpenRouter AI model browser, prompt template configuration with parameter management, model configuration
**Confidence:** HIGH

## Summary

Phase 24 builds the OpenRouter Path configuration step where users browse and select AI models from OpenRouter's catalog, then configure prompt templates with system prompts, parameter definitions using `{param}{/param}` syntax (SAME as Claude), and model-specific configuration (temperature, max_tokens). The step integrates with the existing wizard flow (Type Selection → OpenRouter Config → Details → Review → Publish) and includes critical API key checking with a warning banner.

The codebase already has EXTENSIVE v1.4 OpenRouter infrastructure built in Phases 11-18:
- Complete ModelBrowser component with search, filters (modality, provider, price), tabs (Popular/All), pagination
- OpenRouter API integration endpoints at `/integrations/openrouter/config` (GET/PUT/DELETE)
- Database tables: `x402_user_openrouter_integrations`, `x402_openrouter_models`
- useAIModelsQuery hook for fetching models from `/api/v1/ai-models`
- ModelCard, ModelFilters, Pagination components fully built
- ProviderIcon component with major provider logos
- OpenRouter parameter schema (identical to Claude except adds `type` field - BUT user clarified to use SAME syntax)

The key differentiator from Claude path:
1. Model selection required (via ModelBrowser component)
2. Temperature config in addition to max_tokens
3. Parameter type field present in schema (but user clarified to use same `{param}{/param}` syntax as Claude)

**Primary recommendation:** Integrate existing ModelBrowser component, use GET `/integrations/openrouter/config` for API key check, reuse parameter management pattern from claude/page.tsx with useFieldArray, save selected model ID + config to `openrouterConfig` in wizard draft, follow proven WizardShell pattern, add temperature slider/input.

## Standard Stack

The established libraries/tools for OpenRouter configuration:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.62.0 (installed) | Form state for prompt, parameters, model config | Industry standard, useFieldArray for dynamic parameter list |
| zod | ^3.24.4 (installed) | Schema validation for OpenRouter config | Type-safe validation, integrates with RHF via zodResolver |
| @hookform/resolvers | 3.3.4 (installed) | Zod + RHF bridge | Official adapter for schema validation |
| ModelBrowser | N/A (existing component) | Browse/filter/select AI models | Built in Phase 14, fully functional with 200+ models |
| useAIModelsQuery | N/A (existing hook) | Fetch AI models via useSWR | Public endpoint /api/v1/ai-models, auto-revalidation |
| WizardShell | N/A (local component) | Wizard layout with step navigation | Consistent with Phase 21-23 patterns |
| wizard-draft.ts | N/A (local utilities) | Session storage persistence | Proven pattern from phases 19-23 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.468.0 (installed) | Icons (AlertCircle, Plus, Trash2, Settings, Type, Image, etc.) | Tree-shakable icons for UI elements |
| Textarea | @x402jobs/ui | Multiline system prompt input | Project UI components, auto-resize |
| Input | @x402jobs/ui | Parameter fields, temperature, max_tokens | Consistent styling with dark theme |
| Button | @x402jobs/ui | Add parameter, Remove parameter, Continue | Project button variants |
| Alert | @x402jobs/ui | Warning banner for missing API key | Supports variant="warning" |
| Tabs | @x402jobs/ui | Popular/All Models tabs in ModelBrowser | Existing pattern from Phase 14 |
| useSWR | latest (installed) | Fetch OpenRouter config status | Data fetching with automatic revalidation |

### Existing OpenRouter Infrastructure (v1.4)
| Component/File | Purpose | Built in Phase |
|----------------|---------|----------------|
| ModelBrowser.tsx | Browse/filter/select models with tabs, search, filters, pagination | Phase 14 |
| ModelCard.tsx | Display model with provider icon, description, pricing, modality | Phase 14 |
| ModelFilters.tsx | Search, modality, provider, price range filters | Phase 14 |
| Pagination.tsx | Classic page number pagination (20 items per page) | Phase 14 |
| useAIModelsQuery.ts | Fetch models from /api/v1/ai-models | Phase 14 |
| ProviderIcon.tsx | Provider logo component (Anthropic, OpenAI, Google, etc.) | Phase 14 |
| /integrations/openrouter/config (GET/PUT/DELETE) | API key management endpoints | Phase 13 |
| /api/v1/ai-models (GET) | Public endpoint for model catalog | Phase 12 |
| x402_openrouter_models table | Model catalog with is_curated flag | Phase 11 |
| x402_user_openrouter_integrations table | Encrypted API key storage | Phase 11 |
| openRouterParameterSchema | Zod schema for parameters (includes type field) | Phase 11 |
| createOpenRouterResourceSchema | Full creation schema | Phase 11 |

### No New Dependencies
All required packages already installed. OpenRouter infrastructure 90% complete from v1.4.

## Architecture Patterns

### Recommended Project Structure
```
app/dashboard/resources/new/
├── page.tsx                    # Step 1: Type selection (Phase 19)
├── link/page.tsx               # Step 2: Link Existing (Phase 21)
├── proxy/page.tsx              # Step 2: Proxy config (Phase 22)
├── claude/page.tsx             # Step 2: Claude config (Phase 23)
├── openrouter/
│   └── page.tsx               # Step 2: OpenRouter config (THIS PHASE)
├── details/page.tsx            # Step 3: Shared details (Phase 20)
└── review/page.tsx             # Step 4: Review summary (Phase 20)

components/
├── ModelBrowser/
│   ├── ModelBrowser.tsx       # Main browser (existing)
│   ├── ModelCard.tsx          # Model card (existing)
│   ├── ModelFilters.tsx       # Filters (existing)
│   └── Pagination.tsx         # Pagination (existing)
├── wizard/
│   └── WizardShell.tsx        # Layout wrapper
└── icons/
    └── ProviderIcons.tsx      # Provider logos (existing)

hooks/
└── useAIModelsQuery.ts        # Model fetching hook (existing)

types/
└── openrouter-resource.ts     # OpenRouter types (existing)

lib/
└── wizard-draft.ts            # Session storage helpers
```

### Pattern 1: API Key Check with Warning Banner (Identical to Claude)
**What:** Check user's OpenRouter API key status on page load, show warning banner if missing, block Continue button
**When to use:** Any resource type requiring user-configured API integration

**Example:**
```typescript
// app/dashboard/resources/new/openrouter/page.tsx
import useSWR from 'swr'
import { authenticatedFetcher } from '@/lib/api'
import { Alert, AlertDescription } from '@x402jobs/ui/alert'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface OpenRouterConfig {
  hasApiKey: boolean
  isEnabled: boolean
}

export default function OpenRouterConfigPage() {
  const { data: orConfig, isLoading } = useSWR<OpenRouterConfig>(
    '/integrations/openrouter/config',
    authenticatedFetcher
  )

  const hasApiKey = orConfig?.hasApiKey ?? false

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure OpenRouter Resource"
      backHref="/dashboard/resources/new"
      footer={
        <Button
          onClick={handleContinue}
          disabled={!hasApiKey || !selectedModel || !isFormValid}
        >
          Continue
        </Button>
      }
    >
      {/* Warning banner when API key missing */}
      {!isLoading && !hasApiKey && (
        <Alert variant="warning" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to configure your OpenRouter API key before creating resources.{' '}
            <Link
              href="/dashboard/integrations"
              className="font-medium underline underline-offset-4 hover:text-foreground"
            >
              Go to Integrations
            </Link>
            {' '}to add your key.
          </AlertDescription>
        </Alert>
      )}

      {/* Form content */}
      {/* ... */}
    </WizardShell>
  )
}
```

**Source:** OpenRouterCard.tsx lines 28-31 (useSWR pattern), integrations.ts lines 542-570 (GET /integrations/openrouter/config endpoint), claude/page.tsx (identical pattern)

**Why this works:**
- Same API key check pattern as Claude (proven)
- `/integrations/openrouter/config` endpoint already exists and works
- Warning banner provides direct path to fix issue
- Continue button gated by both API key AND model selection

### Pattern 2: Model Browser Integration
**What:** Integrate existing ModelBrowser component for model selection, display selected model summary
**When to use:** OpenRouter resource creation requiring model selection

**Example:**
```typescript
import { ModelBrowser } from '@/components/ModelBrowser'
import { AIModel } from '@/hooks/useAIModelsQuery'

export default function OpenRouterConfigPage() {
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null)

  return (
    <WizardShell {...}>
      <form className="space-y-6">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Select Model <span className="text-destructive">*</span>
          </label>

          {!selectedModel ? (
            <ModelBrowser
              onSelect={(model) => setSelectedModel(model)}
              selectedModelId={selectedModel?.id}
            />
          ) : (
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={selectedModel.provider} className="w-5 h-5" />
                  <span className="font-medium">{selectedModel.display_name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedModel(null)}
                >
                  Change
                </Button>
              </div>
              {selectedModel.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedModel.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* System Prompt, Parameters, etc. (only shown after model selected) */}
        {selectedModel && (
          <>
            {/* ... rest of form ... */}
          </>
        )}
      </form>
    </WizardShell>
  )
}
```

**Source:** ModelBrowser.tsx lines 12-22 (component props), Phase 14 research (model browser patterns), Phase 15 research (integration into creation flow)

**Why this works:**
- ModelBrowser is fully functional with search, filters, tabs, pagination
- Collapse to summary after selection reduces visual clutter
- Change button allows re-browsing without losing other form data
- Conditional rendering ensures model selected before prompt config

### Pattern 3: Dynamic Parameters with useFieldArray (SAME as Claude)
**What:** Add/remove parameter definitions with name, description, required flag, default value, type field
**When to use:** OpenRouter prompt template parameters (identical to Claude except type field exists but not used)

**Example:**
```typescript
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { openRouterParameterSchema } from '@/types/openrouter-resource'

const openrouterSchema = z.object({
  systemPrompt: z.string().min(1, 'System prompt is required'),
  parameters: z.array(openRouterParameterSchema).default([]),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
})

type OpenRouterFormData = z.infer<typeof openrouterSchema>

export default function OpenRouterConfigPage() {
  const { register, control, handleSubmit, formState: { errors } } = useForm<OpenRouterFormData>({
    resolver: zodResolver(openrouterSchema),
    defaultValues: {
      systemPrompt: '',
      parameters: [],
      temperature: 1.0,
      maxTokens: 4096,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters',
  })

  return (
    <form className="space-y-6">
      {/* System prompt textarea (identical to Claude) */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          System Prompt <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Use {'{paramName}{/paramName}'} to mark parameter placeholders
        </p>
        <Textarea
          {...register('systemPrompt')}
          className="font-mono text-sm min-h-[200px]"
          placeholder="You are a helpful assistant that..."
          disabled={!hasApiKey || !selectedModel}
        />
      </div>

      {/* Parameters section (identical to Claude) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Parameters</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({
              name: '',
              description: '',
              required: true,
              default: ''
            })}
            disabled={!hasApiKey || !selectedModel}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Parameter
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="p-3 border rounded-lg space-y-3">
            {/* Parameter fields identical to Claude */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  {...register(`parameters.${index}.name`)}
                  placeholder="Parameter name"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input
              {...register(`parameters.${index}.description`)}
              placeholder="Description (shown to callers)"
            />
            <Input
              {...register(`parameters.${index}.default`)}
              placeholder="Default value (optional)"
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register(`parameters.${index}.required`)}
                className="rounded"
              />
              <span className="text-sm">Required parameter</span>
            </div>
          </div>
        ))}
      </div>
    </form>
  )
}
```

**Source:** openRouterParameterSchema in types/openrouter-resource.ts lines 31-36 (has type field but user clarified to use SAME syntax as Claude), claude/page.tsx pattern, openrouter-resource.ts lines 48-74 (createOpenRouterResourceSchema)

**Why this works:**
- SAME parameter syntax as Claude (`{param}{/param}`) per user clarification
- Identical parameter management UI (name, description, required, default)
- Type field exists in schema but not rendered in UI (for future use)
- Consistent UX between Claude and OpenRouter paths

### Pattern 4: Temperature and Max Tokens Configuration
**What:** Number inputs for temperature (0-2) and max_tokens (1-128000), helper text explaining ranges
**When to use:** OpenRouter model configuration requiring temperature and max tokens

**Example:**
```typescript
<div className="grid grid-cols-2 gap-4">
  {/* Temperature */}
  <div>
    <label className="block text-sm font-medium mb-1.5">
      Temperature
    </label>
    <Input
      type="number"
      {...register('temperature', { valueAsNumber: true })}
      min={0}
      max={2}
      step={0.1}
      className="w-full"
      disabled={!hasApiKey || !selectedModel}
    />
    {errors.temperature && (
      <p className="text-sm text-destructive mt-1">
        {errors.temperature.message}
      </p>
    )}
    <p className="text-xs text-muted-foreground mt-1">
      Randomness (0-2). Lower = more focused. Default: 1.0
    </p>
  </div>

  {/* Max Tokens */}
  <div>
    <label className="block text-sm font-medium mb-1.5">
      Max Tokens
    </label>
    <Input
      type="number"
      {...register('maxTokens', { valueAsNumber: true })}
      min={1}
      max={128000}
      step={1}
      className="w-full"
      disabled={!hasApiKey || !selectedModel}
    />
    {errors.maxTokens && (
      <p className="text-sm text-destructive mt-1">
        {errors.maxTokens.message}
      </p>
    )}
    <p className="text-xs text-muted-foreground mt-1">
      Maximum output tokens (1-128,000). Default: 4,096
    </p>
  </div>
</div>
```

**Source:** openrouter-resource.ts lines 71-72 (temperature: z.number().min(0).max(2), max_tokens: max 128000), OpenRouter API docs (temperature range 0-2)

**Why this works:**
- Temperature 0-2 matches OpenRouter API spec
- Max tokens 128,000 matches model limits
- Grid layout groups related configs
- Helper text explains what each value means
- Defaults (1.0, 4096) are reasonable

### Pattern 5: Save OpenRouter Config to Session Storage
**What:** Save selected model ID, system prompt, parameters, temperature, max_tokens to `draft.openrouterConfig`
**When to use:** Type-specific configuration preserved across wizard steps

**Example:**
```typescript
const handleContinue = () => {
  if (!selectedModel) return

  const formData = getValues()

  saveDraft({
    openrouterConfig: {
      modelId: selectedModel.id,
      systemPrompt: formData.systemPrompt,
      parameters: formData.parameters,
      temperature: formData.temperature,
      maxTokens: formData.maxTokens,
    },
  })

  router.push('/dashboard/resources/new/details')
}
```

**Source:** wizard-draft.ts WizardDraft interface line 14 (openrouterConfig field), claude/page.tsx pattern, Phase 20 details/review preservation

**Why this works:**
- Consistent with claudeConfig, proxyConfig, linkConfig patterns
- Details/review steps can display OpenRouter config
- Session storage survives page refresh
- Merging behavior preserves other draft fields
- Model ID stored for display/verification

### Pattern 6: Continue Button Gated by API Key, Model, and Form Validity
**What:** Continue button disabled until API key configured AND model selected AND form valid
**When to use:** Multi-condition progression requirements (external dependency + selection + form state)

**Example:**
```typescript
const { data: orConfig } = useSWR<OpenRouterConfig>(
  '/integrations/openrouter/config',
  authenticatedFetcher
)
const hasApiKey = orConfig?.hasApiKey ?? false

const [selectedModel, setSelectedModel] = useState<AIModel | null>(null)

const { formState: { isValid } } = useForm({...})

const canContinue = hasApiKey && selectedModel !== null && isValid

<Button
  onClick={handleContinue}
  disabled={!canContinue}
>
  Continue
</Button>
```

**Source:** User requirement ORTR-07 (blocked until API key configured and model selected), Phase 23 Continue button pattern

**Why this works:**
- Clear boolean logic for enable/disable state
- All conditions must be true (API key AND model AND valid form)
- Visual feedback via disabled state
- Prevents progression with incomplete setup

### Anti-Patterns to Avoid
- **Not checking both API key AND model selection:** Both are required, check both before allowing Continue
- **Trying to validate parameter names against prompt syntax:** Store separately, backend handles substitution
- **Creating new model browser:** ModelBrowser component is complete and proven
- **Using different parameter syntax from Claude:** User explicitly clarified to use SAME `{param}{/param}` syntax
- **Not preserving selected model in session storage:** User might click Back, need to restore selection
- **Showing full ModelBrowser after selection:** Collapse to summary, provide Change button

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model browsing UI | Custom model selector | ModelBrowser component from Phase 14 | Fully built with search, filters, tabs, pagination, 200+ models |
| Model data fetching | Direct fetch or custom hook | useAIModelsQuery with useSWR | Auto-revalidation, caching, error handling, 1-minute deduping |
| Model cards | Custom model display | ModelCard component | Provider icons, pricing, modality icons, context length formatting |
| Filter UI | Custom filter components | ModelFilters component | Search, modality, provider, price filters with active count |
| Provider logos | Image URLs or emoji | ProviderIcon component | SVG icons for major providers with fallback |
| Pagination | Custom page logic | Pagination component | Page number generation with ellipsis, prev/next buttons |
| API key check | Direct fetch in useEffect | useSWR with authenticatedFetcher | Auto-revalidation, loading states, error handling |
| Parameter validation | Custom parameter schema | openRouterParameterSchema from types | Type-safe, reusable, consistent with database |
| Temperature validation | Manual range checks | Zod .min(0).max(2) | Client-side validation, clear errors |
| Dynamic parameters | Custom array state | useFieldArray from react-hook-form | Validation, focus, re-indexing, dirty state |

**Key insight:** Phase 14 built a complete, production-ready ModelBrowser. Don't rebuild it. Integrate it as-is. The only new code needed is the form wrapper, parameter management (copy from Claude), and session storage integration.

## Common Pitfalls

### Pitfall 1: Not Checking API Key on Page Load
**What goes wrong:** User browses models, fills form, clicks Continue, hits error on publish because no API key
**Why it happens:** Missing initial API key status check
**How to avoid:**
- Use useSWR to fetch `/integrations/openrouter/config` on mount
- Show warning banner immediately if `hasApiKey: false`
- Disable Continue button when API key missing
- Provide direct link to Integrations page
**Warning signs:** Users reporting "unexpected error" on publish, no upfront warning about API key requirement

**Source:** User requirement ORTR-01 (warning banner), OpenRouterCard.tsx (existing pattern), Phase 23 research pitfall 1

### Pitfall 2: Model Selection Not Persisted in Session Storage
**What goes wrong:** User selects model, fills form, clicks Back to change details, returns and model selection is gone
**Why it happens:** Not saving selectedModel.id to wizard draft
**How to avoid:**
- Save `modelId: selectedModel.id` in `openrouterConfig` when Continue clicked
- On page load, if `draft.openrouterConfig?.modelId` exists, fetch that model and set as selected
- Restore both model selection AND form values from draft
**Warning signs:** Users frustrated by losing model selection, having to re-browse

**Source:** wizard-draft.ts restoration pattern, Phase 23 form restoration pattern

### Pitfall 3: Showing ModelBrowser After Model Already Selected
**What goes wrong:** Full ModelBrowser always visible, takes up screen, confusing UX
**Why it happens:** Not conditionally rendering based on selection state
**How to avoid:**
- Show ModelBrowser only when `selectedModel === null`
- After selection, show compact summary with Change button
- Change button resets `selectedModel` to null, revealing browser again
**Warning signs:** Cluttered UI, users confused about selection state

**Source:** Phase 15 research (integration patterns), common UX pattern for selection flows

### Pitfall 4: Continue Button Not Gated by Model Selection
**What goes wrong:** User clicks Continue without selecting model, form submits with missing model_id
**Why it happens:** Only checking form validity, not model selection
**How to avoid:**
- `canContinue = hasApiKey && selectedModel !== null && isValid`
- All three conditions required
- Disable Continue when any condition false
**Warning signs:** Validation errors on publish, users confused why Continue is disabled

**Source:** User requirement ORTR-07 (blocked until model selected), createOpenRouterResourceSchema requires model_id

### Pitfall 5: Temperature/Max Tokens Not Having Sensible Defaults
**What goes wrong:** User creates resource without setting temperature, gets unexpected API behavior
**Why it happens:** No default values, user submits empty fields
**How to avoid:**
- Set `defaultValues: { temperature: 1.0, maxTokens: 4096 }`
- Make both fields optional in schema (Zod .optional())
- Backend uses defaults if not provided
**Warning signs:** Users reporting "weird AI responses," temperature set to 0 or 2 unintentionally

**Source:** OpenRouter API defaults, openrouter-resource.ts schema (both optional)

### Pitfall 6: Using Array Index as Key for Parameter Fields
**What goes wrong:** Remove middle parameter, validation errors appear on wrong inputs
**Why it happens:** Array index changes when items removed, not stable across renders
**How to avoid:**
- Always use `field.id` from useFieldArray: `key={field.id}`
- Never use array index: `key={index}` (wrong)
**Warning signs:** Validation errors jumping between fields, input values swapping

**Source:** Phase 23 research pitfall 2, React Hook Form useFieldArray docs

### Pitfall 7: Not Handling useAIModelsQuery Loading/Error States
**What goes wrong:** ModelBrowser renders empty grid while models load, or crashes on fetch error
**Why it happens:** Not checking `isLoading` or `error` from useAIModelsQuery
**How to avoid:**
- ModelBrowser component already handles loading/error states
- If using models directly, check `isLoading` before accessing `models` array
- Show spinner during load, error message on failure
**Warning signs:** Blank screen on load, "Cannot read property 'map' of undefined" errors

**Source:** useAIModelsQuery.ts returns isLoading/error, ModelBrowser.tsx lines 137-156 (loading/error handling)

## Code Examples

Verified patterns from official sources and project codebase:

### Complete OpenRouter Config Page Structure
```typescript
// app/dashboard/resources/new/openrouter/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { Input } from '@x402jobs/ui/input'
import { Textarea } from '@x402jobs/ui/textarea'
import { Button } from '@x402jobs/ui/button'
import { Alert, AlertDescription } from '@x402jobs/ui/alert'
import { WizardShell } from '@/components/wizard/WizardShell'
import { ModelBrowser } from '@/components/ModelBrowser'
import { ProviderIcon } from '@/components/icons/ProviderIcons'
import { getDraft, saveDraft } from '@/lib/wizard-draft'
import { authenticatedFetcher } from '@/lib/api'
import { openRouterParameterSchema } from '@/types/openrouter-resource'
import { AIModel } from '@/hooks/useAIModelsQuery'
import Link from 'next/link'

const openrouterSchema = z.object({
  systemPrompt: z.string().min(1, 'System prompt is required'),
  parameters: z.array(openRouterParameterSchema).default([]),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
})

type OpenRouterFormData = z.infer<typeof openrouterSchema>

interface OpenRouterConfig {
  hasApiKey: boolean
  isEnabled: boolean
}

export default function OpenRouterConfigPage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null)

  // Check OpenRouter API key status
  const { data: orConfig, isLoading: isLoadingConfig } = useSWR<OpenRouterConfig>(
    '/integrations/openrouter/config',
    authenticatedFetcher
  )

  const hasApiKey = orConfig?.hasApiKey ?? false

  // Deep link protection and draft restoration
  useEffect(() => {
    const draft = getDraft()
    if (!draft?.type || draft.type !== 'openrouter') {
      router.replace('/dashboard/resources/new')
      return
    }

    // TODO: Restore selected model from draft.openrouterConfig.modelId
    // Fetch model by ID and set as selectedModel

    setIsLoaded(true)
  }, [router])

  const draft = getDraft()

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    formState: { errors, isValid },
  } = useForm<OpenRouterFormData>({
    resolver: zodResolver(openrouterSchema),
    mode: 'onChange',
    defaultValues: {
      systemPrompt: draft?.openrouterConfig?.systemPrompt || '',
      parameters: draft?.openrouterConfig?.parameters || [],
      temperature: draft?.openrouterConfig?.temperature || 1.0,
      maxTokens: draft?.openrouterConfig?.maxTokens || 4096,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters',
  })

  const systemPrompt = watch('systemPrompt')

  const handleContinue = () => {
    if (!selectedModel) return

    const formData = getValues()

    saveDraft({
      openrouterConfig: {
        modelId: selectedModel.id,
        systemPrompt: formData.systemPrompt,
        parameters: formData.parameters,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
      },
    })

    router.push('/dashboard/resources/new/details')
  }

  if (!isLoaded) return null

  const canContinue = hasApiKey && selectedModel !== null && isValid

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure OpenRouter Resource"
      description="Select a model and configure your AI prompt"
      backHref="/dashboard/resources/new"
      footer={
        <Button
          type="submit"
          form="openrouter-form"
          disabled={!canContinue}
        >
          Continue
        </Button>
      }
    >
      <form
        id="openrouter-form"
        onSubmit={handleSubmit(handleContinue)}
        className="space-y-6"
      >
        {/* Warning banner when API key missing */}
        {!isLoadingConfig && !hasApiKey && (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to configure your OpenRouter API key before creating resources.{' '}
              <Link
                href="/dashboard/integrations"
                className="font-medium underline underline-offset-4 hover:text-foreground"
              >
                Go to Integrations
              </Link>
              {' '}to add your key.
            </AlertDescription>
          </Alert>
        )}

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Select Model <span className="text-destructive">*</span>
          </label>

          {!selectedModel ? (
            <ModelBrowser
              onSelect={(model) => setSelectedModel(model)}
              selectedModelId={selectedModel?.id}
            />
          ) : (
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={selectedModel.provider} className="w-5 h-5" />
                  <span className="font-medium">{selectedModel.display_name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedModel(null)}
                >
                  Change
                </Button>
              </div>
              {selectedModel.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {selectedModel.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Show form only after model selected */}
        {selectedModel && (
          <>
            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                System Prompt <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Use {'{paramName}{/paramName}'} to mark parameter placeholders
              </p>
              <Textarea
                {...register('systemPrompt')}
                className="font-mono text-sm min-h-[200px]"
                placeholder="You are a helpful assistant that..."
                disabled={!hasApiKey}
              />
              {errors.systemPrompt && (
                <p className="text-sm text-destructive mt-1">
                  {errors.systemPrompt.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5 text-right">
                {systemPrompt?.length || 0} characters
              </p>
            </div>

            {/* Parameters */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">
                  Parameters
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasApiKey}
                  onClick={() =>
                    append({ name: '', description: '', required: true, default: '' })
                  }
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Parameter
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No parameters defined. Add parameters to create customizable
                  placeholders in your prompt.
                </p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-3 border border-border rounded-lg space-y-3"
                    >
                      {/* Row 1: Name + Remove */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            {...register(`parameters.${index}.name`)}
                            placeholder="Parameter name"
                          />
                          {errors.parameters?.[index]?.name && (
                            <p className="text-sm text-destructive mt-1">
                              {errors.parameters[index]?.name?.message}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Row 2: Description */}
                      <Input
                        {...register(`parameters.${index}.description`)}
                        placeholder="Description (shown to callers)"
                      />

                      {/* Row 3: Default value */}
                      <Input
                        {...register(`parameters.${index}.default`)}
                        placeholder="Default value (optional)"
                      />

                      {/* Row 4: Required checkbox */}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          {...register(`parameters.${index}.required`)}
                          className="rounded border-border"
                        />
                        Required parameter
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Model Configuration */}
            <div className="grid grid-cols-2 gap-4">
              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Temperature
                </label>
                <Input
                  type="number"
                  {...register('temperature', { valueAsNumber: true })}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-full"
                  disabled={!hasApiKey}
                />
                {errors.temperature && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.temperature.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">
                  Randomness (0-2). Lower = more focused. Default: 1.0
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Max Tokens
                </label>
                <Input
                  type="number"
                  {...register('maxTokens', { valueAsNumber: true })}
                  min={1}
                  max={128000}
                  step={1}
                  className="w-full"
                  disabled={!hasApiKey}
                />
                {errors.maxTokens && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.maxTokens.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">
                  Maximum output tokens (1-128,000). Default: 4,096
                </p>
              </div>
            </div>
          </>
        )}
      </form>
    </WizardShell>
  )
}
```

**Source:** Combined patterns from claude/page.tsx (form structure), ModelBrowser.tsx (model selection), openrouter-resource.ts (schema), integrations.ts (API key check)

### Review Step Display for OpenRouter Config
```typescript
// app/dashboard/resources/new/review/page.tsx - add OpenRouter config display
{draft.type === 'openrouter' && draft.openrouterConfig && (
  <div className="space-y-3">
    <div>
      <dt className="text-sm text-muted-foreground">Selected Model</dt>
      <dd className="text-sm font-medium text-foreground mt-1">
        {/* TODO: Fetch and display model name from modelId */}
        Model ID: {draft.openrouterConfig.modelId}
      </dd>
    </div>

    <div>
      <dt className="text-sm text-muted-foreground">System Prompt</dt>
      <dd className="text-sm font-mono text-foreground mt-1 p-2 bg-muted/30 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
        {draft.openrouterConfig.systemPrompt}
      </dd>
    </div>

    {draft.openrouterConfig.parameters?.length > 0 && (
      <div>
        <dt className="text-sm text-muted-foreground">Parameters</dt>
        <dd className="space-y-2 mt-1">
          {draft.openrouterConfig.parameters.map((param, i) => (
            <div key={i} className="p-2 bg-muted/30 rounded text-sm">
              <div className="flex items-center gap-2">
                <code className="font-mono text-primary">
                  {'{' + param.name + '}{/' + param.name + '}'}
                </code>
                {!param.required && (
                  <span className="text-xs text-muted-foreground">(optional)</span>
                )}
              </div>
              {param.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {param.description}
                </p>
              )}
              {param.default && (
                <p className="text-xs text-muted-foreground mt-1">
                  Default: {param.default}
                </p>
              )}
            </div>
          ))}
        </dd>
      </div>
    )}

    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">Temperature:</span>
        <span className="font-mono ml-2">{draft.openrouterConfig.temperature || 1.0}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Max Tokens:</span>
        <span className="font-mono ml-2">{draft.openrouterConfig.maxTokens?.toLocaleString() || '4,096'}</span>
      </div>
    </div>
  </div>
)}
```

**Source:** review/page.tsx lines 294-350 (Claude config display pattern), openrouterConfig structure

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom model selector dropdown | ModelBrowser with search/filters/tabs | Phase 14 (2026-01) | 200+ models browsable with immediate filtering, pagination |
| API key per-resource | User-level integration (Dashboard > Integrations) | Phase 13 (2026-01) | Reusable across all OpenRouter resources, centralized management |
| Manual model data fetching | useAIModelsQuery with useSWR | Phase 14 (2026-01) | Auto-revalidation, caching, 1-minute deduping |
| Different parameter syntax per provider | Unified {param}{/param} syntax | Current (user decision) | Consistent UX, same review display, simpler documentation |
| Inline temperature slider | Number input with step 0.1 | Current | Precise control, no custom slider component needed |
| Per-model max token limits | Universal 128,000 max | Current | Simpler validation, backend can enforce model-specific limits |

**Deprecated/outdated:**
- API key per-resource: Use user-level OpenRouter integration instead
- Custom model selection UI: Use ModelBrowser component
- Manual array state for parameters: Use useFieldArray
- Direct fetch in useEffect: Use useSWR for data fetching
- No upfront API key check: Always validate integration before allowing form submission

## Open Questions

Things that couldn't be fully resolved:

1. **Model restoration from modelId**
   - What we know: draft.openrouterConfig.modelId stores the selected model UUID
   - What's unclear: How to efficiently fetch single model by ID for restoration
   - Recommendation: Either (a) fetch all models and find by ID, or (b) add GET /api/v1/ai-models/:id endpoint. For v1, option (a) is simpler (models already cached by useSWR).
   - Confidence: MEDIUM - Need to verify fetch pattern

2. **Model name display on review step**
   - What we know: draft only has modelId, review needs to show model display_name
   - What's unclear: Should review page fetch model details or store model metadata in draft?
   - Recommendation: Store minimal model metadata in draft: `{ modelId, modelName, provider }` to avoid fetch on review page. Simpler UX.
   - Confidence: HIGH - Storing display data prevents unnecessary fetches

3. **Curated models criteria**
   - What we know: Phase 12 added is_curated flag, ModelBrowser Popular tab filters by it
   - What's unclear: How many models are curated, which ones?
   - Recommendation: Planning can assume is_curated is set correctly. Curation logic is Phase 12 concern, not Phase 24.
   - Confidence: HIGH - Out of scope for this phase

4. **Temperature slider vs number input**
   - What we know: Temperature range 0-2, step 0.1
   - What's unclear: Should UI use slider or number input?
   - Recommendation: Number input for v1 (simpler, no custom component). Can add slider later if users request it.
   - Confidence: MEDIUM - Number input is proven pattern from Claude max_tokens

5. **Parameter type field usage**
   - What we know: openRouterParameterSchema has `type` field, but user clarified to use SAME syntax as Claude
   - What's unclear: Is type field for future use, or backend validation?
   - Recommendation: Don't render type field in UI for v1. Schema includes it but form doesn't expose it. Backend can default to "string" type.
   - Confidence: HIGH - User explicitly said "SAME syntax as Claude" which has no type field

## Sources

### Primary (HIGH confidence)
- Project codebase: ModelBrowser.tsx - Complete model browser component
- Project codebase: ModelCard.tsx, ModelFilters.tsx, Pagination.tsx - Model browser subcomponents
- Project codebase: useAIModelsQuery.ts - Model fetching hook
- Project codebase: ProviderIcon.tsx - Provider logo component
- Project codebase: integrations.ts lines 542-726 - OpenRouter integration endpoints (GET/PUT/DELETE /integrations/openrouter/config, getCreatorOpenRouterApiKey helper)
- Project codebase: ai-models.ts - GET /api/v1/ai-models endpoint
- Project codebase: types/openrouter-resource.ts - OpenRouter types, parameter schema, creation schema
- Project codebase: claude/page.tsx - Wizard pattern, parameter management, API key check
- Project codebase: wizard-draft.ts - Session storage interface with openrouterConfig field
- Project codebase: review/page.tsx - Review display patterns, TYPE_TO_API mapping line 18
- Phase 14 research (14-RESEARCH.md) - Model browser patterns, filter logic, pagination
- Phase 23 research (23-RESEARCH.md) - Claude config patterns, useFieldArray, API key check

### Secondary (MEDIUM confidence)
- [OpenRouter API Documentation](https://openrouter.ai/docs) - Temperature range (0-2), max_tokens limits
- [OpenRouter Model Catalog](https://openrouter.ai/models) - Available models, pricing
- [React Hook Form useFieldArray](https://www.react-hook-form.com/api/usefieldarray/) - Official API reference
- Phase 11 research (11-RESEARCH.md) - Database schema, encryption patterns
- Phase 13 research - API key integration patterns

### Tertiary (LOW confidence - verified with primary sources)
- N/A - All critical information verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages installed, ModelBrowser component complete, patterns proven in Phase 23
- Architecture: HIGH - Extracted from working Phase 14 (ModelBrowser), Phase 23 (Claude config), existing OpenRouter endpoints
- Pitfalls: HIGH - Based on React Hook Form docs, Phase 23 learnings, ModelBrowser integration considerations
- Code examples: HIGH - Adapted from claude/page.tsx, ModelBrowser.tsx, review/page.tsx production code

**Research date:** 2026-02-01
**Valid until:** 2026-03-03 (30 days - stable libraries, ModelBrowser proven, OpenRouter API stable)

**Notes:**
- ModelBrowser component is 100% ready to integrate (Phase 14 complete)
- OpenRouter backend endpoints exist and work (Phases 11-13)
- Parameter syntax identical to Claude (user clarification)
- Temperature config is the main new field vs Claude
- Model selection is the main new interaction vs Claude
- 90% of code can be copied from claude/page.tsx
- Review display should store model metadata to avoid fetches
