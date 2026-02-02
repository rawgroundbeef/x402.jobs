# Phase 23: Claude Prompt Path - Research

**Researched:** 2026-02-01
**Domain:** Claude prompt template configuration UI with API key checking, parameter management, system prompt editor, max tokens configuration
**Confidence:** HIGH

## Summary

This phase builds the Claude Prompt Path configuration step where users create AI prompt templates with system prompts, parameter definitions using `{param}{/param}` syntax, and model configuration. The step integrates with the existing wizard flow (Type Selection → Claude Config → Details → Review → Publish) and includes critical API key checking with a warning banner.

The established approach follows the existing wizard patterns from Phase 21 (Link Existing) and Phase 22 (Proxy Path), using React Hook Form with Zod validation, `useFieldArray` for dynamic parameter management, standard `@x402jobs/ui` components, and session storage via `wizard-draft.ts`. The key differentiator for this path is the Claude API key requirement—users must configure their API key in Settings > Integrations before they can proceed.

The codebase already has:
- Complete Claude integration in `ClaudeCard.tsx` with GET `/integrations/claude/config` endpoint
- Parameter template types in `types/prompt-template.ts` with `{param}{/param}` syntax
- CollapsibleSection component for optional sections
- Alert component with `variant="warning"` for banners
- WizardShell pattern from phases 19-22

**Primary recommendation:** Use `useFieldArray` for parameter list management, check Claude API key status on page load via GET `/integrations/claude/config`, show warning banner with Settings link if no key configured, disable Continue button when API key missing, save `claudeConfig` with system prompt + parameters to wizard draft, and follow the proven WizardShell pattern.

## Standard Stack

The established libraries/tools for Claude prompt configuration:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.62.0 (installed) | Form state for prompt, parameters, max tokens | Industry standard, useFieldArray for dynamic parameter list |
| zod | ^3.24.4 (installed) | Schema validation for prompt template | Type-safe validation, integrates with RHF via zodResolver |
| @hookform/resolvers | 3.3.4 (installed) | Zod + RHF bridge | Official adapter for schema validation |
| WizardShell | N/A (local component) | Wizard layout with step navigation | Consistent with Phase 21/22 patterns |
| wizard-draft.ts | N/A (local utilities) | Session storage persistence | Proven pattern from phases 19-22 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.468.0 (installed) | Icons (AlertCircle, Plus, Trash2, Settings) | Tree-shakable icons for UI elements |
| Textarea | @x402jobs/ui | Multiline system prompt input | Project UI components, auto-resize |
| Input | @x402jobs/ui | Parameter name/description/default fields | Consistent styling with dark theme |
| Button | @x402jobs/ui | Add parameter, Remove parameter, Continue | Project button variants |
| Alert | @x402jobs/ui | Warning banner for missing API key | Supports variant="warning" |
| CollapsibleSection | N/A (local component) | Optional: collapsible for parameters section | Reduces visual clutter |
| useSWR | latest (installed) | Fetch Claude config status | Data fetching with automatic revalidation |

### No New Dependencies
All required packages already installed. Claude API integration infrastructure exists.

## Architecture Patterns

### Recommended Project Structure
```
app/dashboard/resources/new/
├── page.tsx                    # Step 1: Type selection (Phase 19)
├── link/page.tsx               # Step 2: Link Existing (Phase 21)
├── proxy/page.tsx              # Step 2: Proxy config (Phase 22)
├── claude/
│   └── page.tsx               # Step 2: Claude prompt config (THIS PHASE)
├── openrouter/page.tsx         # Step 2: OpenRouter config (future)
├── details/page.tsx            # Step 3: Shared details (Phase 20)
└── review/page.tsx             # Step 4: Review summary (Phase 20)

lib/
└── wizard-draft.ts            # Session storage helpers

components/
├── wizard/
│   └── WizardShell.tsx        # Layout wrapper
└── ui/
    ├── CollapsibleSection.tsx # Collapsible component
    └── alert.tsx              # Alert/Banner component

types/
└── prompt-template.ts         # PromptTemplateParameter, schemas
```

### Pattern 1: API Key Check with Warning Banner
**What:** Check user's Claude API key status on page load, show warning banner if missing, block Continue button
**When to use:** Any resource type requiring user-configured API integration (Claude, OpenRouter, etc.)

**Example:**
```typescript
// app/dashboard/resources/new/claude/page.tsx
import useSWR from 'swr'
import { authenticatedFetcher } from '@/lib/api'
import { Alert, AlertDescription } from '@x402jobs/ui/alert'
import { AlertCircle, Settings } from 'lucide-react'
import Link from 'next/link'

interface ClaudeConfig {
  hasApiKey: boolean
  isEnabled: boolean
}

export default function ClaudeConfigPage() {
  const { data: claudeConfig, isLoading } = useSWR<ClaudeConfig>(
    '/integrations/claude/config',
    authenticatedFetcher
  )

  const hasApiKey = claudeConfig?.hasApiKey ?? false

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure Prompt Template"
      backHref="/dashboard/resources/new"
      footer={
        <Button
          onClick={handleContinue}
          disabled={!hasApiKey || !isFormValid}
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
            You need to configure your Claude API key before creating prompt templates.{' '}
            <Link
              href="/dashboard/settings/integrations"
              className="font-medium underline underline-offset-4 hover:text-foreground"
            >
              Go to Settings
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

**Source:** [ClaudeCard.tsx](apps/web/src/components/pages/AccountIntegrationsPage/components/ClaudeCard.tsx) - hasApiKey check pattern, [integrations.ts](apps/x402jobs-api/src/routes/integrations.ts) lines 423-451 - GET /integrations/claude/config endpoint, [Alert component](packages/ui/src/alert.tsx) - warning variant

**Why this works:**
- useSWR fetches config on mount, auto-revalidates on focus
- Warning banner clearly explains what's needed
- Settings link provides direct path to fix the issue
- Continue button disabled prevents invalid progression
- User sees actionable guidance, not just an error

### Pattern 2: Dynamic Parameters with useFieldArray
**What:** Add/remove parameter definitions with name, description, required flag, default value using React Hook Form's useFieldArray
**When to use:** Forms with variable number of repeated field groups (parameters, headers, tags)

**Example:**
```typescript
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { promptTemplateParameterSchema } from '@/types/prompt-template'

const claudeSchema = z.object({
  systemPrompt: z.string().min(1, 'System prompt is required'),
  parameters: z.array(promptTemplateParameterSchema).default([]),
  maxTokens: z.number().int().min(1).max(64000).default(4096),
})

type ClaudeFormData = z.infer<typeof claudeSchema>

export default function ClaudeConfigPage() {
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<ClaudeFormData>({
    resolver: zodResolver(claudeSchema),
    defaultValues: {
      systemPrompt: '',
      parameters: [],
      maxTokens: 4096,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters',
  })

  return (
    <form className="space-y-6">
      {/* System prompt textarea */}
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
        />
        {errors.systemPrompt && (
          <p className="text-sm text-destructive mt-1">
            {errors.systemPrompt.message}
          </p>
        )}
      </div>

      {/* Parameters section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Parameters</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '', description: '', required: true, default: '' })}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Parameter
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="p-3 border rounded-lg space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  {...register(`parameters.${index}.name`)}
                  placeholder="Parameter name"
                />
                {errors.parameters?.[index]?.name && (
                  <p className="text-xs text-destructive mt-1">
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
                <Trash2 className="w-4 h-4 text-muted-foreground" />
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

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No parameters defined. Click "Add Parameter" to create placeholders in your prompt.
          </p>
        )}
      </div>
    </form>
  )
}
```

**Source:** [React Hook Form useFieldArray](https://www.react-hook-form.com/api/usefieldarray/), [proxy/page.tsx](apps/web/src/app/dashboard/resources/new/proxy/page.tsx) - similar pattern for headers, [promptTemplateParameterSchema](apps/web/src/types/prompt-template.ts) lines 29-34

**Why this works:**
- `field.id` as key prevents React re-render issues when removing items
- Zod schema validates each parameter's structure
- Individual field errors accessible via nested path
- Form state tracks dirty/touched for each parameter field
- Default values ensure clean initial state

### Pattern 3: Max Tokens Configuration with Number Input
**What:** Number input for max_tokens with validation range (1-64000), helper text explaining limit
**When to use:** Claude API configuration requiring output token limit

**Example:**
```typescript
<div>
  <label className="block text-sm font-medium mb-1.5">
    Max Tokens
  </label>
  <Input
    type="number"
    {...register('maxTokens', { valueAsNumber: true })}
    min={1}
    max={64000}
    step={1}
    className="w-32"
  />
  {errors.maxTokens && (
    <p className="text-sm text-destructive mt-1">
      {errors.maxTokens.message}
    </p>
  )}
  <p className="text-xs text-muted-foreground mt-1">
    Maximum output tokens (1-64,000). Default: 4,096
  </p>
</div>
```

**Source:** [Claude API max_tokens limits](https://docs.claude.com/en/api/rate-limits), [Claude API Quota Tiers](https://www.aifreeapi.com/en/posts/claude-api-quota-tiers-limits) - 64,000 max for claude-opus-4-5, [promptTemplateSchema](apps/web/src/types/prompt-template.ts) line 52 - max_tokens field

**Why this works:**
- Zod `.min(1).max(64000)` enforces API limits client-side
- `valueAsNumber: true` converts string input to number for Zod
- Helper text explains what the value means
- Default 4,096 is reasonable for most use cases
- Prevents API errors from exceeding token limits

### Pattern 4: System Prompt Textarea with Character Counter
**What:** Auto-resizing textarea for system prompt with character count, monospace font for readability
**When to use:** Long-form text input where users need to see formatting (prompts, code, markdown)

**Example:**
```typescript
const systemPrompt = watch('systemPrompt')

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
  />
  <div className="flex justify-end mt-1">
    <p className="text-xs text-muted-foreground">
      {systemPrompt?.length || 0} characters
    </p>
  </div>
</div>
```

**Source:** [Textarea best practices](https://www.heroui.com/docs/components/textarea) - auto-sizing and character counters, Phase 2 research on textarea patterns (02-RESEARCH.md lines 387-407)

**Why this works:**
- Monospace font makes `{param}{/param}` syntax more readable
- min-h-[200px] provides adequate space for prompts
- Character counter helps users track length
- watch() provides live character count without re-render overhead
- Placeholder demonstrates correct prompt format

### Pattern 5: Continue Button Gated by API Key and Form Validity
**What:** Continue button disabled until both API key configured AND form valid
**When to use:** Multi-condition progression requirements (external dependency + form state)

**Example:**
```typescript
const { data: claudeConfig } = useSWR<ClaudeConfig>(
  '/integrations/claude/config',
  authenticatedFetcher
)
const hasApiKey = claudeConfig?.hasApiKey ?? false

const { formState: { isValid } } = useForm({...})

const canContinue = hasApiKey && isValid

<Button
  onClick={handleContinue}
  disabled={!canContinue}
>
  Continue
</Button>
```

**Source:** User requirement CLPT-05 (Continue blocked until API key configured), Phase 21/22 Continue button patterns

**Why this works:**
- Clear boolean logic for enable/disable state
- Both conditions must be true (API key AND valid form)
- Visual feedback via disabled state
- Prevents progression with incomplete setup

### Pattern 6: Save Claude Config to Session Storage
**What:** Save system prompt, parameters array, max tokens to `draft.claudeConfig` for details step
**When to use:** Type-specific configuration preserved across wizard steps

**Example:**
```typescript
const handleContinue = () => {
  const formData = getValues()

  saveDraft({
    claudeConfig: {
      systemPrompt: formData.systemPrompt,
      parameters: formData.parameters,
      maxTokens: formData.maxTokens,
    },
  })

  router.push('/dashboard/resources/new/details')
}
```

**Source:** wizard-draft.ts saveDraft function (Phase 19), Phase 21 linkConfig / Phase 22 proxyConfig pattern

**Why this works:**
- Consistent with other type-specific configs
- Details/review steps can display Claude config
- Session storage survives page refresh
- Merging behavior preserves other draft fields

### Anti-Patterns to Avoid
- **Allowing empty system prompt to continue:** System prompt is the core IP, must be required
- **Manually parsing `{param}{/param}` syntax:** Store parameters separately, let backend handle substitution
- **Over-validating parameter names:** Allow any non-empty string, backend handles substitution edge cases
- **Not checking API key status:** Users will hit errors on publish if key missing
- **Hardcoding model name in form:** Use schema default, allow future model selection
- **Not preserving parameters when user clicks Back:** Session storage must restore full form state

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic parameter fields | Custom array state | useFieldArray from react-hook-form | Handles validation, focus, re-indexing, dirty state |
| API key status check | Direct fetch in useEffect | useSWR with authenticatedFetcher | Auto-revalidation, loading states, error handling |
| Warning banner | Custom div with colors | Alert component with variant="warning" | Consistent styling, accessibility, icon support |
| Parameter schema validation | Custom if/else checks | Zod schema from types/prompt-template.ts | Type-safe, reusable, integrates with RHF |
| Character counter | Manual event listener | watch() from react-hook-form | Live updates without re-renders, form integration |
| Settings link navigation | window.location or custom router | Next.js Link component | Client-side navigation, prefetching, fast transitions |
| Number input validation | Manual min/max checks | Zod .min().max() + valueAsNumber | Client-side validation, type coercion, clear errors |

**Key insight:** The codebase has proven patterns for all these concerns. useSWR for API checks, useFieldArray for dynamic lists, Alert for banners, and wizard-draft.ts for state persistence. Don't reinvent these wheels.

## Common Pitfalls

### Pitfall 1: Not Checking API Key on Page Load
**What goes wrong:** User fills entire form, clicks Continue, hits error on publish because no API key configured
**Why it happens:** Missing initial API key status check
**How to avoid:**
- Use useSWR to fetch `/integrations/claude/config` on mount
- Show warning banner immediately if `hasApiKey: false`
- Disable Continue button when API key missing
- Provide direct link to Settings > Integrations
**Warning signs:** Users reporting "unexpected error" on publish, no upfront warning about API key requirement

**Source:** User requirement CLPT-01 (warning banner if no API key), Phase 13 research on API key integration patterns

### Pitfall 2: Using Array Index as Key for Parameter Fields
**What goes wrong:** Remove middle parameter, React re-uses components for wrong fields, validation errors appear on wrong inputs
**Why it happens:** Array index changes when items removed, not stable across renders
**How to avoid:**
- Always use `field.id` from useFieldArray: `key={field.id}`
- Never use array index: `key={index}` (wrong)
- useFieldArray generates stable IDs
**Warning signs:** Validation errors jumping between fields, input values swapping, focus moving to wrong field after remove

**Source:** [React Hook Form useFieldArray](https://www.react-hook-form.com/api/usefieldarray/), Phase 22 research pitfall 1 (22-RESEARCH.md lines 368-377)

### Pitfall 3: Parameter Names Not Matching Prompt Syntax
**What goes wrong:** User defines parameter "topic" but uses `{subject}{/subject}` in prompt, backend substitution fails
**Why it happens:** No validation linking parameter names to prompt content
**How to avoid:**
- Don't try to validate parameter/prompt matching on frontend
- Store parameters as separate array in database
- Backend handles `{param}{/param}` parsing and substitution validation
- Show helper text explaining syntax but don't enforce matching
**Warning signs:** Over-complex frontend validation, parameter extraction logic in UI code

**Source:** [promptTemplateParameterSchema](apps/web/src/types/prompt-template.ts) lines 29-34 - parameters stored separately, Phase 2 research open question 1 (02-RESEARCH.md lines 421-429)

### Pitfall 4: Max Tokens Exceeding API Limits
**What goes wrong:** User sets max_tokens to 70,000, API rejects request with "exceeds limit" error
**Why it happens:** Not enforcing Claude API's 64,000 token limit
**How to avoid:**
- Zod schema: `z.number().int().min(1).max(64000)`
- Helper text: "Maximum output tokens (1-64,000). Default: 4,096"
- Consider setting practical default like 4,096 (most prompts don't need 64k)
**Warning signs:** API errors on execution, users confused about token limits

**Source:** [Claude API max_tokens limits](https://docs.claude.com/en/api/rate-limits) - 64,000 max for claude-opus-4-5, [max_tokens overflow issue](https://github.com/AndyMik90/Auto-Claude/issues/1309) - 64001 exceeds limit

### Pitfall 5: Not Providing Default Values for Parameters Array
**What goes wrong:** Form crashes with "Cannot read property 'map' of undefined", parameters section doesn't render
**Why it happens:** useFieldArray expects array to exist, even if empty
**How to avoid:**
- Set `defaultValues: { parameters: [] }` in useForm config
- Always initialize with empty array, not undefined or null
- Check `fields.length === 0` for empty state, don't check `!fields`
**Warning signs:** "Cannot read property 'map' of undefined", parameters section blank, add button doesn't work

**Source:** Phase 22 research pitfall 2 (22-RESEARCH.md lines 380-388), [React Hook Form useFieldArray default values](https://react-hook-form.com/docs/usefieldarray)

### Pitfall 6: Warning Banner Shown Even When API Key Exists
**What goes wrong:** Warning banner flashes on load, confusing users who already configured their key
**Why it happens:** useSWR loading state not handled, banner renders before data arrives
**How to avoid:**
- Check `isLoading` from useSWR
- Only show banner when `!isLoading && !hasApiKey`
- Consider skeleton/spinner during initial load
**Warning signs:** Banner flashing on every page load, users reporting "confusing warning"

**Source:** [useSWR API](https://swr.vercel.app/docs/api) - isLoading state, [ClaudeCard.tsx](apps/web/src/components/pages/AccountIntegrationsPage/components/ClaudeCard.tsx) - loading state handling

### Pitfall 7: Character Counter Not Updating Live
**What goes wrong:** Character count shows 0 until user blurs field, confusing feedback
**Why it happens:** Using onChange instead of watch()
**How to avoid:**
- Use `const systemPrompt = watch('systemPrompt')` for live updates
- Display with `{systemPrompt?.length || 0} characters`
- watch() subscribes to field changes without triggering re-renders
**Warning signs:** Counter only updating on blur, users thinking character limit doesn't work

**Source:** [React Hook Form watch()](https://react-hook-form.com/docs/useform/watch), Phase 2 research textarea patterns (02-RESEARCH.md lines 387-407)

## Code Examples

Verified patterns from official sources and project codebase:

### Complete Claude Config Page Structure
```typescript
// app/dashboard/resources/new/claude/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import { Plus, Trash2, AlertCircle, Settings } from 'lucide-react'
import { Input } from '@x402jobs/ui/input'
import { Textarea } from '@x402jobs/ui/textarea'
import { Button } from '@x402jobs/ui/button'
import { Alert, AlertDescription } from '@x402jobs/ui/alert'
import { WizardShell } from '@/components/wizard/WizardShell'
import { getDraft, saveDraft } from '@/lib/wizard-draft'
import { authenticatedFetcher } from '@/lib/api'
import { promptTemplateParameterSchema } from '@/types/prompt-template'
import Link from 'next/link'

const claudeSchema = z.object({
  systemPrompt: z.string().min(1, 'System prompt is required'),
  parameters: z.array(promptTemplateParameterSchema).default([]),
  maxTokens: z.number().int().min(1).max(64000).default(4096),
})

type ClaudeFormData = z.infer<typeof claudeSchema>

interface ClaudeConfig {
  hasApiKey: boolean
  isEnabled: boolean
}

export default function ClaudeConfigPage() {
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)

  // Check Claude API key status
  const { data: claudeConfig, isLoading: isLoadingConfig } = useSWR<ClaudeConfig>(
    '/integrations/claude/config',
    authenticatedFetcher
  )

  const hasApiKey = claudeConfig?.hasApiKey ?? false

  // Deep link protection
  useEffect(() => {
    const draft = getDraft()
    if (!draft?.type || draft.type !== 'claude') {
      router.replace('/dashboard/resources/new')
      return
    }
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
  } = useForm<ClaudeFormData>({
    resolver: zodResolver(claudeSchema),
    defaultValues: {
      systemPrompt: draft?.claudeConfig?.systemPrompt || '',
      parameters: draft?.claudeConfig?.parameters || [],
      maxTokens: draft?.claudeConfig?.maxTokens || 4096,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters',
  })

  const systemPrompt = watch('systemPrompt')

  const handleContinue = () => {
    const formData = getValues()

    saveDraft({
      claudeConfig: {
        systemPrompt: formData.systemPrompt,
        parameters: formData.parameters,
        maxTokens: formData.maxTokens,
      },
    })

    router.push('/dashboard/resources/new/details')
  }

  if (!isLoaded) return null

  const canContinue = hasApiKey && isValid

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure Prompt Template"
      description="Create your AI prompt with parameters"
      backHref="/dashboard/resources/new"
      footer={
        <Button onClick={handleContinue} disabled={!canContinue}>
          Continue
        </Button>
      }
    >
      {/* Warning banner when API key missing */}
      {!isLoadingConfig && !hasApiKey && (
        <Alert variant="warning" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to configure your Claude API key before creating prompt templates.{' '}
            <Link
              href="/dashboard/settings/integrations"
              className="font-medium underline underline-offset-4 hover:text-foreground inline-flex items-center gap-1"
            >
              <Settings className="h-3 w-3" />
              Go to Settings
            </Link>
            {' '}to add your key.
          </AlertDescription>
        </Alert>
      )}

      <form className="space-y-6">
        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            System Prompt <span className="text-destructive">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Use {'{paramName}{/paramName}'} to mark parameter placeholders
          </p>
          <Textarea
            {...register('systemPrompt')}
            className="font-mono text-sm min-h-[200px]"
            placeholder="You are a helpful assistant that..."
            disabled={!hasApiKey}
          />
          <div className="flex justify-between items-center mt-1">
            {errors.systemPrompt && (
              <p className="text-sm text-destructive">
                {errors.systemPrompt.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground ml-auto">
              {systemPrompt?.length || 0} characters
            </p>
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Parameters</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: '', description: '', required: true, default: '' })}
              disabled={!hasApiKey}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Parameter
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="p-3 border border-border rounded-lg space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    {...register(`parameters.${index}.name`)}
                    placeholder="Parameter name (e.g., topic)"
                  />
                  {errors.parameters?.[index]?.name && (
                    <p className="text-xs text-destructive mt-1">
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
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
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

          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No parameters defined. Add parameters to create customizable placeholders in your prompt.
            </p>
          )}
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
            max={64000}
            step={1}
            className="w-32"
            disabled={!hasApiKey}
          />
          {errors.maxTokens && (
            <p className="text-sm text-destructive mt-1">
              {errors.maxTokens.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Maximum output tokens (1-64,000). Default: 4,096
          </p>
        </div>
      </form>
    </WizardShell>
  )
}
```

**Source:** Combined patterns from Phase 21 link/page.tsx (wizard integration), Phase 22 proxy/page.tsx (useFieldArray), ClaudeCard.tsx (API key check), promptTemplateParameterSchema (types/prompt-template.ts)

### Wizard Draft Type Extension
```typescript
// lib/wizard-draft.ts - add to WizardDraft interface
export interface WizardDraft {
  type?: 'link' | 'proxy' | 'claude' | 'openrouter'
  // ... existing fields
  claudeConfig?: {
    systemPrompt: string
    parameters: Array<{
      name: string
      description: string
      required: boolean
      default?: string
    }>
    maxTokens: number
  }
  // ... other configs
}
```

**Source:** wizard-draft.ts WizardDraft interface (Phase 19), linkConfig/proxyConfig patterns

### Review Step Display for Claude Config
```typescript
// app/dashboard/resources/new/review/page.tsx - add Claude config display
{draft.type === 'claude' && draft.claudeConfig && (
  <div className="space-y-3">
    <h3 className="text-sm font-medium text-muted-foreground">
      Prompt Template Configuration
    </h3>

    <div>
      <dt className="text-sm text-muted-foreground">System Prompt</dt>
      <dd className="text-sm font-mono text-foreground mt-1 p-2 bg-muted/30 rounded max-h-32 overflow-y-auto">
        {draft.claudeConfig.systemPrompt}
      </dd>
    </div>

    {draft.claudeConfig.parameters.length > 0 && (
      <div>
        <dt className="text-sm text-muted-foreground">Parameters</dt>
        <dd className="space-y-2 mt-1">
          {draft.claudeConfig.parameters.map((param, i) => (
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

    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">Max Tokens:</span>
      <span className="font-mono">{draft.claudeConfig.maxTokens}</span>
    </div>
  </div>
)}
```

**Source:** Phase 20 review step pattern, Phase 22 proxyConfig display

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API key in resource form | User-level integration (Dashboard > Integrations) | Phase 13 (2026-01) | Reusable across all prompt templates, centralized management |
| Manual parameter parsing | Zod schema with useFieldArray | React Hook Form v7 (2021+) | Type-safe validation, automatic error handling |
| Static model selection | Default model with future extensibility | Current | Simplified UX for v1, room for model picker later |
| Inline API calls | useSWR with authenticatedFetcher | Modern React (2024+) | Auto-revalidation, loading states, caching |
| Custom warning components | Alert component with variants | Modern UI libraries (2025+) | Consistent styling, accessibility built-in |
| {param} syntax | {param}{/param} closing tags | Current codebase decision | Clearer boundaries, prevents parsing ambiguity |

**Deprecated/outdated:**
- API key per-resource: Use user-level Claude integration instead
- Manual array state for parameters: Use useFieldArray
- Direct fetch in useEffect: Use useSWR for data fetching
- Custom textarea without character counter: Add live character count
- No upfront API key check: Always validate integration before allowing form submission

## Open Questions

Things that couldn't be fully resolved:

1. **Parameter name validation strictness**
   - What we know: Parameter names used for `{param}{/param}` substitution
   - What's unclear: Should frontend validate parameter name format (alphanumeric, no spaces, etc.)?
   - Recommendation: Simple validation (min length 1). Backend handles substitution edge cases. Don't over-validate on frontend.
   - Confidence: MEDIUM - Backend will reject invalid parameter names naturally

2. **System prompt length limit**
   - What we know: Character counter shows length, no explicit limit in schema
   - What's unclear: Is there a practical limit for system prompt length (database column, API limits)?
   - Recommendation: No frontend limit for now. Backend/database can enforce if needed. Claude API has input token limits but those are per-request, not per-template.
   - Confidence: MEDIUM - May need database column limit verification

3. **Parameter default value usage**
   - What we know: Parameters have optional `default` field
   - What's unclear: When are defaults used? (Caller doesn't provide value, or pre-filled in caller form?)
   - Recommendation: Assume defaults pre-fill caller form but user can override. Document in parameter description field guidance.
   - Confidence: LOW - Execution behavior needs backend clarification

4. **Model selection UI**
   - What we know: Schema has `model` field defaulting to "claude-sonnet-4-20250514"
   - What's unclear: Should v1 show model picker or hardcode to default?
   - Recommendation: Hardcode default for v1 (simpler UX). Add model picker in future phase when multiple models supported.
   - Confidence: HIGH - Schema default suggests hardcoded for v1

5. **Details step pre-fill for Claude**
   - What we know: Link Existing pre-fills network/price from validation
   - What's unclear: Should Claude path pre-fill anything on details step?
   - Recommendation: No pre-fill (no validation to extract metadata from). User enters all details manually.
   - Confidence: HIGH - Consistent with Proxy path pattern

## Sources

### Primary (HIGH confidence)
- Project codebase: [ClaudeCard.tsx](apps/web/src/components/pages/AccountIntegrationsPage/components/ClaudeCard.tsx) - API key check, useSWR pattern
- Project codebase: [integrations.ts](apps/x402jobs-api/src/routes/integrations.ts) lines 423-534 - GET/PUT /integrations/claude/config endpoints
- Project codebase: [types/prompt-template.ts](apps/web/src/types/prompt-template.ts) - PromptTemplateParameter schema, validation
- Project codebase: [proxy/page.tsx](apps/web/src/app/dashboard/resources/new/proxy/page.tsx) - useFieldArray pattern, WizardShell integration
- Project codebase: [link/page.tsx](apps/web/src/app/dashboard/resources/new/link/page.tsx) - Wizard pattern, deep link protection
- Project codebase: [alert.tsx](packages/ui/src/alert.tsx) - Alert component with variant="warning"
- [React Hook Form useFieldArray](https://www.react-hook-form.com/api/usefieldarray/) - Official API reference

### Secondary (MEDIUM confidence)
- [Claude API Messages API](https://docs.claude.com/en/api/messages) - Official API documentation
- [Claude API max_tokens limits](https://docs.claude.com/en/api/rate-limits) - 64,000 token limit for claude-opus-4-5
- [Claude API prompt templates guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompt-templates-and-variables) - Template variable patterns
- [Dynamic Forms with React Hook Form](https://medium.com/@sassenthusiast/dynamic-forms-in-react-a-guide-to-implementing-reusable-components-and-factory-patterns-2a029776455b) - useFieldArray patterns
- [Textarea best practices](https://www.heroui.com/docs/components/textarea) - Auto-sizing, character counters
- [Conditional Rendering in React](https://react.dev/learn/conditional-rendering) - Warning banner patterns

### Tertiary (LOW confidence - verified with primary sources)
- [React Hook Form with Zod Guide 2026](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1) - Current integration patterns
- [Claude API Integration Guide 2025](https://collabnix.com/claude-api-integration-guide-2025-complete-developer-tutorial-with-code-examples/) - General integration patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages installed, patterns exist in codebase (useSWR, useFieldArray, Alert, WizardShell)
- Architecture: HIGH - Extracted from working Phase 21/22 wizard patterns, ClaudeCard integration pattern
- Pitfalls: HIGH - Based on React Hook Form docs, known useFieldArray issues, API key integration patterns from Phase 13
- Code examples: HIGH - Adapted from proxy/page.tsx, link/page.tsx, ClaudeCard.tsx production code

**Research date:** 2026-02-01
**Valid until:** 2026-03-03 (30 days - stable libraries, React Hook Form v7 mature, Claude API stable)
