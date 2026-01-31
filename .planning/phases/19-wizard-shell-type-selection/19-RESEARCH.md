# Phase 19: Wizard Shell & Type Selection - Research

**Researched:** 2026-01-30
**Domain:** Next.js 15 App Router multi-step wizard with session storage persistence
**Confidence:** HIGH

## Summary

This phase builds a full-page wizard at `/resources/new` using Next.js 15 App Router with file-system routing, session storage for state persistence, and React Hook Form v7 with Zod validation. The wizard follows established UX patterns for multi-step forms with progressive disclosure, visual feedback through step indicators, and natural browser history integration.

The standard approach combines Next.js 15's App Router for routing (using `next/navigation`), session storage helper functions for state persistence across refreshes, and Tailwind CSS for a centered card layout with dark theme. The wizard shell provides navigation controls (Back, Cancel, Continue) and a simple step counter, while Step 1 displays four clickable resource type cards with visual hierarchy.

**Primary recommendation:** Use file-based routing with flat URL structure, direct session storage access via helper functions (no React Context), and client-side components only where interactivity is required. Leverage existing UI components from `@x402jobs/ui` and maintain dark theme consistency with project-defined CSS variables.

## Standard Stack

The established libraries/tools for Next.js 15 multi-step wizards:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.9 (installed) | App Router file-system routing | Official Next.js routing with React Server Components support, native navigation hooks |
| react-hook-form | ^7.62.0 (installed) | Form state management | Industry standard for React forms with minimal re-renders, uncontrolled components |
| zod | ^3.24.4 (installed) | Schema validation | TypeScript-native validation with type inference, server-client code reuse |
| @hookform/resolvers | 3.3.4 (installed) | Bridge RHF + Zod | Official adapter for integrating validation libraries with React Hook Form |
| Tailwind CSS | ^3.4.0 (installed) | Styling framework | Project standard, utility-first CSS with dark mode support |
| lucide-react | ^0.468.0 (installed) | Icon library | 1500+ tree-shakable SVG icons, fully-typed React components |
| framer-motion | ^12.23.26 (installed) | Animations (optional) | Already in project, can enhance transitions between wizard steps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @x402jobs/ui | workspace:* | Internal component library | All UI primitives (Button, Input, Card, etc.) |
| clsx | ^2.0.0 (installed) | Conditional classes | Combining Tailwind utilities dynamically |
| date-fns | ^4.1.0 (installed) | Date formatting | Display "last edited" timestamps for draft resume prompts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File-based routing | Programmatic router only | File-based mirrors URL structure clearly, easier to maintain |
| Session storage | React Context + URL params | Session storage survives refresh, Context requires provider setup |
| Zod | Yup, Joi | Zod offers native TypeScript inference, better DX for typed forms |
| Flat URL structure | Nested `/resources/new/:type/:step` | Flat structure simpler, type only needed on Step 2 per user decisions |

**Installation:**
All required packages already installed in project. No additional dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── resources/
│   ├── new/
│   │   ├── page.tsx                    # Step 1: Type selection
│   │   ├── link/
│   │   │   └── page.tsx                # Step 2: Link Existing config
│   │   ├── proxy/
│   │   │   └── page.tsx                # Step 2: Proxy config
│   │   ├── claude/
│   │   │   └── page.tsx                # Step 2: Claude config
│   │   ├── openrouter/
│   │   │   └── page.tsx                # Step 2: OpenRouter config
│   │   ├── details/
│   │   │   └── page.tsx                # Step 3: Details (shared)
│   │   └── review/
│   │       └── page.tsx                # Step 4: Review (shared)
lib/
├── wizard-draft.ts                     # Session storage helpers
components/
├── wizard/
│   ├── WizardShell.tsx                 # Layout wrapper with nav
│   ├── TypeCard.tsx                    # Reusable type selection card
│   └── DraftResume.tsx                 # Resume/start fresh prompt
```

### Pattern 1: File-Based Routing with Next.js 15 App Router
**What:** Each wizard step is a separate page.tsx file, URL structure maps directly to folder structure
**When to use:** Multi-step flows where each step has distinct UI and can be deep-linked

**Example:**
```typescript
// app/resources/new/page.tsx (Step 1)
'use client'

import { useRouter } from 'next/navigation'

export default function NewResourcePage() {
  const router = useRouter()

  const handleSelectType = (type: string) => {
    // Save to session storage, navigate to next step
    saveDraft({ type })
    router.push(`/resources/new/${type}`)
  }

  return <TypeSelection onSelect={handleSelectType} />
}
```

**Source:** [Next.js useRouter documentation](https://nextjs.org/docs/app/api-reference/functions/use-router)

**Why this works:**
- Natural browser history (back button navigates to previous step)
- Deep links work with proper session storage checks
- File structure mirrors user flow visually

### Pattern 2: Session Storage Helper Functions
**What:** Direct session storage access via getDraft/saveDraft/clearDraft helpers, no React Context provider
**When to use:** Wizard state that needs to survive page refreshes but clear on tab close

**Example:**
```typescript
// lib/wizard-draft.ts
const DRAFT_KEY = 'x402jobs:newResource'

export interface WizardDraft {
  type?: 'link' | 'proxy' | 'claude' | 'openrouter'
  name?: string
  // ... other fields
  updatedAt: string
}

export function getDraft(): WizardDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function saveDraft(updates: Partial<WizardDraft>): void {
  if (typeof window === 'undefined') return
  const current = getDraft() || {}
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(DRAFT_KEY)
}
```

**Source:** [React state persistence with session storage](https://www.geeksforgeeks.org/reactjs/how-to-persist-state-with-local-or-session-storage-in-react/)

**Why this works:**
- Simple, testable functions
- Automatic serialization/deserialization with error handling
- TypeScript types enforce draft shape
- `typeof window` check prevents SSR errors

### Pattern 3: Deep Link Protection with Redirect
**What:** Check for required draft data on mount, redirect to `/resources/new` if missing
**When to use:** Any wizard step beyond Step 1 that requires prior selections

**Example:**
```typescript
// app/resources/new/details/page.tsx (Step 3)
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDraft } from '@/lib/wizard-draft'

export default function DetailsPage() {
  const router = useRouter()

  useEffect(() => {
    const draft = getDraft()
    if (!draft?.type) {
      // Missing prerequisites, redirect to start
      router.replace('/resources/new')
    }
  }, [router])

  const draft = getDraft()
  if (!draft?.type) return null // Prevent flash of content

  return <DetailsForm draft={draft} />
}
```

**Source:** [Next.js authentication redirects preserving deep links](https://dev.to/dalenguyen/fixing-nextjs-authentication-redirects-preserving-deep-links-after-login-pkk)

**Why this works:**
- Prevents invalid state (user jumps to Step 3 without Step 1/2)
- `router.replace` doesn't pollute history stack
- Early return prevents hydration issues

### Pattern 4: Centered Card Layout with Dark Theme
**What:** Max-width centered card with Tailwind utilities and CSS variables for theming
**When to use:** Full-page wizards that need focused, distraction-free UX

**Example:**
```typescript
// components/wizard/WizardShell.tsx
export function WizardShell({ children, step, totalSteps, onBack, onCancel }) {
  return (
    <div className="min-h-screen bg-[#0a0f14] py-8">
      <div className="max-w-[800px] mx-auto px-4">
        <div className="bg-[#111820] border border-[#252d3a] rounded-xl p-8">
          {/* Step indicator */}
          <div className="text-sm text-[#5c6670] mb-6">
            Step {step} of {totalSteps}
          </div>

          {/* Content */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Source:** [Tailwind CSS best practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)

**Why this works:**
- Hex colors match user-specified design (#0a0f14 background, #111820 card, #252d3a border)
- Max-width constraint (800px per user decision) keeps content focused
- Responsive padding adapts to mobile

### Pattern 5: React Hook Form with Zod per Step
**What:** Each wizard step has its own form schema and useForm instance
**When to use:** Multi-step forms where each step validates independently

**Example:**
```typescript
// app/resources/new/proxy/page.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const proxySchema = z.object({
  originUrl: z.string().url('Must be a valid URL'),
  method: z.enum(['GET', 'POST', 'PASS']),
  timeout: z.number().min(1000).optional()
})

type ProxyForm = z.infer<typeof proxySchema>

export default function ProxyConfigPage() {
  const router = useRouter()
  const draft = getDraft()

  const { register, handleSubmit, formState: { errors } } = useForm<ProxyForm>({
    resolver: zodResolver(proxySchema),
    defaultValues: draft?.proxyConfig || {}
  })

  const onSubmit = (data: ProxyForm) => {
    saveDraft({ proxyConfig: data })
    router.push('/resources/new/details')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('originUrl')} />
      {errors.originUrl && <FieldError>{errors.originUrl.message}</FieldError>}
      {/* ... */}
      <Button type="submit">Continue</Button>
    </form>
  )
}
```

**Source:** [React Hook Form with Zod complete guide](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1)

**Why this works:**
- `zodResolver` automatically validates on submit
- `z.infer` provides TypeScript types from schema
- `defaultValues` loads from session storage draft
- Validation errors scoped to current step only

### Anti-Patterns to Avoid
- **Wrapping entire wizard in Context provider:** Violates "push client to leaves" best practice, forces all pages to be client components
- **Single giant form across all steps:** Loses ability to validate per-step, harder to manage state
- **Using `router.push` for Cancel:** Should use `router.replace` or direct navigation to avoid polluting history
- **Storing entire form state in URL params:** Makes URLs unreadable, URL length limits, not suitable for large forms
- **Not checking `typeof window` in storage helpers:** Causes SSR hydration errors on initial render

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validator functions | Zod + @hookform/resolvers | Schema reusable on server, TypeScript inference, mature error handling |
| Date formatting for "2 hours ago" | Custom date math | date-fns formatDistanceToNow | Handles edge cases (DST, leap years), i18n support, tree-shakable |
| Session storage hooks | Custom useSessionStorage | Direct helper functions + useEffect | Avoids React 18 SSR hydration issues, simpler to test |
| Icon components | Custom SVG wrapper | lucide-react | 1500+ icons, tree-shakable, fully typed, consistent style |
| Card/Button components | Custom styled divs | @x402jobs/ui components | Already styled for dark theme, accessible, battle-tested |
| Browser back button handling | Custom history listeners | Native router.back() + URL routing | Browser handles history stack, works with middle-click/right-click navigation |

**Key insight:** Session storage seems simple (just `getItem`/`setItem`) but edge cases like SSR detection, JSON parse errors, and hydration mismatches make helper functions essential. Similarly, form validation appears straightforward until you need TypeScript types, async validation, and cross-field dependencies—Zod handles all of this.

## Common Pitfalls

### Pitfall 1: Session Storage Causing Hydration Errors
**What goes wrong:** Component renders different content on server vs. client because session storage only exists in browser, triggering "Expected server HTML to contain..." error
**Why it happens:** React 18 strict hydration checks compare server-rendered HTML with client first render. If session storage value affects DOM structure, they'll mismatch.
**How to avoid:**
- Use `useEffect` to load draft data after mount: `useEffect(() => { setDraft(getDraft()) }, [])`
- Return `null` or loading state until draft loaded
- Never access session storage during initial render (before useEffect runs)
**Warning signs:** Console errors mentioning "hydration", content briefly flashing, server/client HTML mismatch warnings

**Source:** [Session storage SSR hydration issues](https://github.com/astoilkov/use-local-storage-state/issues/50)

### Pitfall 2: Missing Step Validation Leading to Broken State
**What goes wrong:** User navigates directly to `/resources/new/details` without selecting type, form crashes or shows confusing errors
**Why it happens:** Browser history or manual URL entry bypasses wizard flow, deep link protection not implemented
**How to avoid:**
- Every step beyond Step 1 checks `getDraft()` for required fields
- Use `useEffect` with `router.replace('/resources/new')` if validation fails
- Early return with `null` prevents flash of invalid content
**Warning signs:** Errors like "Cannot read property 'type' of null", user can bookmark mid-wizard URLs and break flow

**Source:** User-specified requirement WIZD-06 (URL routing) implies need for deep link protection

### Pitfall 3: Forgetting "use client" Directive
**What goes wrong:** useRouter, useEffect, or useState throws "Error: useRouter only works in Client Components"
**Why it happens:** Next.js 15 App Router defaults to Server Components. Hooks like useRouter require client-side rendering.
**How to avoid:**
- Add `'use client'` at top of any file using React hooks or browser APIs
- Only mark the page component itself, not imported utilities
- Server components can import and render client components as children
**Warning signs:** Build errors mentioning "only works in Client Components", hooks undefined on server

**Source:** [Next.js use client directive best practices](https://nextjs.org/docs/app/api-reference/directives/use-client)

### Pitfall 4: Not Handling Cancel with Unsaved Changes
**What goes wrong:** User clicks Cancel after entering data, loses all progress without warning
**Why it happens:** Cancel button directly navigates to `/resources` without checking if draft exists
**How to avoid:**
- Check if draft has meaningful data (more than just `updatedAt`)
- Show confirmation dialog: "Discard this resource? [Discard] [Keep Editing]"
- Only skip confirmation if draft is empty or equivalent to initial state
**Warning signs:** User complaints about accidental data loss, no "are you sure?" prompts

**Source:** Common UX pattern, user requirement WIZD-04 implies cancel should be safe but doesn't specify confirmation

### Pitfall 5: Overly Complex Step State Management
**What goes wrong:** Trying to track "farthest step reached" or validate all previous steps on each navigation
**Why it happens:** Over-engineering the wizard flow, assuming users will only move forward linearly
**How to avoid:**
- Keep it simple: session storage holds form data, URL holds current step
- Each step validates only its own prerequisites (e.g., Step 3 checks `draft.type` exists)
- Don't track "completed steps" array or step history
- Browser history naturally handles back/forward navigation
**Warning signs:** Complex state reducer, step flow diagrams with arrows everywhere, bugs when clicking browser back

**Source:** [Multi-step wizard validation best practices](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained)

### Pitfall 6: Using Wrong Router Import
**What goes wrong:** Importing from `next/router` instead of `next/navigation`, hooks don't work
**Why it happens:** Next.js 13+ uses `next/navigation` for App Router, but old docs reference `next/router` (Pages Router)
**How to avoid:**
- Always import from `next/navigation` for App Router: `import { useRouter } from 'next/navigation'`
- Check official Next.js docs for App Router-specific APIs
- Linter warning if mixing Pages/App Router APIs
**Warning signs:** TypeScript errors about router methods, hooks returning unexpected values

**Source:** [Next.js 15 useRouter documentation](https://nextjs.org/docs/app/api-reference/functions/use-router)

## Code Examples

Verified patterns from official sources and project context:

### Session Storage Helpers with SSR Safety
```typescript
// lib/wizard-draft.ts
const DRAFT_KEY = 'x402jobs:newResource'

export interface WizardDraft {
  type?: 'link' | 'proxy' | 'claude' | 'openrouter'
  name?: string
  description?: string
  // ... step-specific fields
  updatedAt: string
}

// Safe for SSR - returns null on server
export function getDraft(): WizardDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error('Failed to parse draft:', error)
    return null
  }
}

// Merge updates into existing draft
export function saveDraft(updates: Partial<Omit<WizardDraft, 'updatedAt'>>): void {
  if (typeof window === 'undefined') return
  const current = getDraft() || {}
  const updated: WizardDraft = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(DRAFT_KEY)
}

// Check if draft has meaningful data (not just timestamp)
export function hasUnsavedChanges(): boolean {
  const draft = getDraft()
  if (!draft) return false
  const { updatedAt, ...data } = draft
  return Object.keys(data).length > 0
}
```

**Source:** Adapted from [React session storage best practices](https://www.dhiwise.com/blog/design-converter/session-storage-react-how-to-save-data-in-your-app) with SSR safety added

### Type Selection Cards with Visual Hierarchy
```typescript
// app/resources/new/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getDraft, saveDraft } from '@/lib/wizard-draft'
import { Link2, Globe, Sparkles, Zap } from 'lucide-react'

type ResourceType = 'link' | 'proxy' | 'claude' | 'openrouter'

export default function TypeSelectionPage() {
  const router = useRouter()
  const [showResume, setShowResume] = useState(false)
  const [draft, setDraft] = useState<WizardDraft | null>(null)

  // Load draft after mount to avoid SSR hydration issues
  useEffect(() => {
    const existing = getDraft()
    if (existing?.type) {
      setShowResume(true)
      setDraft(existing)
    }
  }, [])

  const handleSelectType = (type: ResourceType) => {
    saveDraft({ type })
    router.push(`/resources/new/${type}`)
  }

  const handleStartFresh = () => {
    clearDraft()
    setShowResume(false)
    setDraft(null)
  }

  if (showResume && draft) {
    return (
      <div className="min-h-screen bg-[#0a0f14] py-8">
        <div className="max-w-[800px] mx-auto px-4">
          <div className="bg-[#111820] border border-[#252d3a] rounded-xl p-8">
            <h2 className="text-xl font-semibold mb-4">Resume Draft?</h2>
            <p className="text-[#5c6670] mb-6">
              You have an unfinished {draft.type} resource
              {draft.name && `: "${draft.name}"`}
              {draft.updatedAt && ` (${formatDistanceToNow(new Date(draft.updatedAt))} ago)`}
            </p>
            <div className="flex gap-3">
              <Button onClick={() => router.push(`/resources/new/${draft.type}`)}>
                Continue Editing
              </Button>
              <Button variant="outline" onClick={handleStartFresh}>
                Start Fresh
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f14] py-8">
      <div className="max-w-[800px] mx-auto px-4">
        <div className="bg-[#111820] border border-[#252d3a] rounded-xl p-8">
          <div className="text-sm text-[#5c6670] mb-6">Step 1 of 3</div>

          <h1 className="text-2xl font-semibold mb-8">Choose Resource Type</h1>

          {/* Primary: Link Existing (full width) */}
          <TypeCard
            icon={<Link2 className="w-6 h-6" />}
            title="Link Existing"
            description="Connect your x402-enabled endpoint"
            onClick={() => handleSelectType('link')}
            className="mb-6"
          />

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[#252d3a]" />
            <span className="text-sm text-[#5c6670]">or create something new</span>
            <div className="flex-1 h-px bg-[#252d3a]" />
          </div>

          {/* Create options (3 cards in row) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TypeCard
              icon={<Globe className="w-6 h-6" />}
              title="Proxy"
              description="Wrap any URL with payments"
              onClick={() => handleSelectType('proxy')}
            />
            <TypeCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Claude Prompt"
              description="Monetize a prompt"
              onClick={() => handleSelectType('claude')}
            />
            <TypeCard
              icon={<Zap className="w-6 h-6" />}
              title="OpenRouter"
              description="Multi-model AI endpoint"
              onClick={() => handleSelectType('openrouter')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Reusable card component
function TypeCard({ icon, title, description, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-6 rounded-lg border border-[#252d3a]
        hover:border-[#00d992] hover:bg-[#00d992]/5
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-[#00d992] focus:ring-offset-2 focus:ring-offset-[#111820]
        ${className}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="text-[#00d992]">{icon}</div>
        <div>
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-[#5c6670]">{description}</p>
        </div>
      </div>
    </button>
  )
}
```

**Source:** Design based on user specifications and [Tailwind CSS card patterns](https://flowbite.com/docs/components/card/)

### Wizard Shell with Navigation Controls
```typescript
// components/wizard/WizardShell.tsx
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@x402jobs/ui/button'
import { hasUnsavedChanges, clearDraft } from '@/lib/wizard-draft'
import { useState } from 'react'

interface WizardShellProps {
  children: React.ReactNode
  step: number
  totalSteps: number
  onBack?: () => void
  backHref?: string // Optional: custom back URL
}

export function WizardShell({
  children,
  step,
  totalSteps,
  onBack,
  backHref
}: WizardShellProps) {
  const router = useRouter()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowCancelConfirm(true)
    } else {
      router.push('/resources')
    }
  }

  const confirmCancel = () => {
    clearDraft()
    router.push('/resources')
  }

  return (
    <div className="min-h-screen bg-[#0a0f14] py-8">
      <div className="max-w-[800px] mx-auto px-4">
        <div className="bg-[#111820] border border-[#252d3a] rounded-xl p-8">
          {/* Step indicator */}
          <div className="text-sm text-[#5c6670] mb-6">
            Step {step} of {totalSteps}
          </div>

          {/* Content */}
          <div className="mb-8">
            {children}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t border-[#252d3a]">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <div /> // Spacer
            )}
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <ConfirmDialog
          title="Discard this resource?"
          message="Your progress will be lost."
          confirmLabel="Discard"
          onConfirm={confirmCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
    </div>
  )
}
```

**Source:** Pattern based on user requirements WIZD-02, WIZD-03, WIZD-04

### Deep Link Protection Pattern
```typescript
// app/resources/new/details/page.tsx (Step 3)
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDraft } from '@/lib/wizard-draft'
import { WizardShell } from '@/components/wizard/WizardShell'

export default function DetailsPage() {
  const router = useRouter()
  const draft = getDraft()

  // Redirect if prerequisites missing
  useEffect(() => {
    if (!draft?.type) {
      router.replace('/resources/new')
    }
  }, [draft, router])

  // Prevent flash of content before redirect
  if (!draft?.type) {
    return null
  }

  return (
    <WizardShell step={3} totalSteps={4} backHref={`/resources/new/${draft.type}`}>
      <h1 className="text-2xl font-semibold mb-6">Resource Details</h1>
      {/* Form content */}
    </WizardShell>
  )
}
```

**Source:** Pattern adapted from [Next.js authentication redirect](https://dev.to/dalenguyen/fixing-nextjs-authentication-redirects-preserving-deep-links-after-login-pkk)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router (`next/router`) | App Router (`next/navigation`) | Next.js 13 (Oct 2022) | File-based routing with RSC support, better code splitting |
| React Context for wizard state | Session storage + URL routing | 2024-2025 | Survives refresh, simpler DX, no provider setup |
| Single-page stepper component | Multi-page with file routing | 2024-2025 | Deep linkable, better SEO, natural browser history |
| Yup validation | Zod validation | 2023-2024 | Native TypeScript inference, server/client reuse |
| Custom session storage hooks | Direct helper functions | React 18 (2022) | Avoids hydration issues, simpler testing |
| Multi-step forms in modals | Full-page wizards | 2024-2025 | Mobile-friendly, more space for validation, progressive disclosure |

**Deprecated/outdated:**
- `useRouter` from `next/router`: Use `next/navigation` for App Router (Pages Router is legacy for new projects)
- React Context for simple wizard state: Session storage + URL is simpler and survives refresh
- Single giant form with hidden steps: Split into separate pages for better code splitting and validation

## Open Questions

Things that couldn't be fully resolved:

1. **Mobile breakpoint for card stacking**
   - What we know: User wants cards to "stack naturally on small screens", Tailwind has responsive prefixes
   - What's unclear: Exact breakpoint (sm: 640px, md: 768px?) for 3-card grid to collapse to single column
   - Recommendation: Use `grid-cols-1 md:grid-cols-3` (768px+ shows row, below stacks). Test on actual devices.

2. **Loading skeleton during session storage check**
   - What we know: Step 1 needs to check for existing draft, may want skeleton while checking
   - What's unclear: Whether to show skeleton at all (session storage is synchronous, instant on client)
   - Recommendation: Skip skeleton for session storage (it's instant). Only show skeleton if fetching from server.

3. **Animation/transitions between steps**
   - What we know: framer-motion is installed, user marked "animations between steps" as Claude's discretion
   - What's unclear: Whether animations add value or feel sluggish in wizard flow
   - Recommendation: Start without animations (simpler, faster). Add subtle fade-in if feels too abrupt during testing.

4. **Resume prompt navigation behavior**
   - What we know: User wants resume prompt with "Continue editing / Start fresh" options
   - What's unclear: Should "Continue editing" go to last-visited step or the type selection step (Step 2)?
   - Recommendation: Navigate to `/resources/new/{type}` (Step 2). Keeps logic simple, user can always go forward/back.

5. **Cancel confirmation threshold**
   - What we know: Cancel should show confirmation if "meaningful data exists"
   - What's unclear: What counts as "meaningful"? Just type selection? Name entered? Any field touched?
   - Recommendation: Consider draft meaningful if it has `name` field or any step-specific config fields. Type-only is not meaningful (easily re-selected).

## Sources

### Primary (HIGH confidence)
- [Next.js 15 useRouter documentation](https://nextjs.org/docs/app/api-reference/functions/use-router) - Official API reference for App Router navigation
- [Next.js "use client" directive](https://nextjs.org/docs/app/api-reference/directives/use-client) - Official guidance on client components
- [React Hook Form with Zod complete guide (2026)](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1) - Current best practices for form validation
- [Lucide React documentation](https://lucide.dev/guide/packages/lucide-react) - Icon library official docs
- Project codebase analysis: package.json, tailwind.config.ts, globals.css, existing modal patterns

### Secondary (MEDIUM confidence)
- [Creating effective multistep forms (Smashing Magazine)](https://www.smashingmagazine.com/2024/12/creating-effective-multistep-form-better-user-experience/) - UX best practices for wizards
- [Nielsen Norman Group: Wizards definition](https://www.nngroup.com/articles/wizards/) - Authoritative UX patterns
- [Tailwind CSS best practices 2025-2026](https://www.frontendtools.front/blog/tailwind-css-best-practices-design-system-patterns) - Modern Tailwind patterns
- [Session storage SSR hydration issues](https://github.com/astoilkov/use-local-storage-state/issues/50) - Known pitfalls from library maintainer

### Tertiary (LOW confidence)
- Multiple WebSearch results on multi-step wizards (various frameworks, some contradictory patterns)
- Community blog posts on session storage (techniques vary, not all SSR-safe)
- GitHub discussions on form validation (useful for understanding pain points, not authoritative solutions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages installed and verified in project, official docs reviewed
- Architecture: HIGH - Next.js 15 App Router patterns verified from official docs, session storage helpers follow documented SSR safety practices
- Pitfalls: HIGH - Based on official Next.js docs, known GitHub issues, and common React 18 hydration problems

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days - stable Next.js 15 release, no major version changes expected)
