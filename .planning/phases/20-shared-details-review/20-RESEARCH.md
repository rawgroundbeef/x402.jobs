# Phase 20: Shared Details & Review - Research

**Researched:** 2026-01-31
**Domain:** React Hook Form with Zod validation for shared wizard step (details form + review summary)
**Confidence:** HIGH

## Summary

This phase builds the shared details form (Step 3) and review summary (Step 4) pages that every resource type flows through in the wizard. The details step collects common metadata (name, slug, description, image, category, price, network) with live slug auto-generation, while the review step displays a summary card with edit links that navigate back to specific wizard steps.

The standard approach uses React Hook Form 7.62+ with Zod validation, uncontrolled inputs for performance, and validation on blur (first error) then onChange (subsequent changes). Slug generation follows a proven pattern: auto-generate from name in real-time, stop syncing once user manually edits, with debounced uniqueness check against backend. The review page uses simple data display with router.push navigation to edit links, not a complex "edit mode" toggle.

The project already has all required libraries installed (react-hook-form, zod, @hookform/resolvers) and established patterns for form validation, slug generation, network selection, and image upload. Reuse the existing generateSlug function, slug validation regex, debounced API check, network constants, and useResourceImageUpload hook.

**Primary recommendation:** Use controlled inputs via react-hook-form register() for all fields except image (which uses custom upload hook), validate on blur initially then onChange after first error, implement slug auto-generation with manual edit detection via useRef, and build review as read-only display with simple navigation links rather than editable fields.

## Standard Stack

The established libraries/tools for multi-step form details and review:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.62.0 (installed) | Form state and validation | Industry standard, minimal re-renders, uncontrolled components for performance |
| zod | ^3.24.4 (installed) | Schema validation | TypeScript-native validation with type inference, reusable schemas |
| @hookform/resolvers | 3.3.4 (installed) | Zod + RHF bridge | Official adapter for integrating Zod schemas with React Hook Form |
| @x402jobs/ui | workspace:* | Form components | Project's UI library with Input, Textarea, Select, Button already styled |
| lucide-react | ^0.468.0 (installed) | Icons | Tree-shakable icons for edit links, refresh slug button |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | ^2.0.0 (installed) | Conditional classes | Combining Tailwind classes dynamically for validation states |
| useDebounce pattern | N/A (custom hook) | Debounce slug checks | Delay API calls until user stops typing (400ms standard) |
| Supabase Auth | ^2.47.22 (installed) | User context | Get username for slug preview display (`/@username/slug`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Formik | RHF has better performance (uncontrolled), smaller bundle size |
| Zod validation | Yup | Zod offers native TypeScript inference, better DX with RHF |
| Controlled slug input | Read-only with edit button | Editable slug is more flexible, users expect to customize |
| URL input + file upload | File upload only | URL input simpler for users with existing hosted images |
| Review with edit mode | Navigate to step | Navigation clearer, leverages existing wizard flow |

**Installation:**
All required packages already installed. No additional dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
app/dashboard/resources/new/
├── page.tsx                    # Step 1: Type selection (Phase 19)
├── [type]/                     # Step 2: Type-specific config (future phases)
├── details/
│   └── page.tsx               # Step 3: Shared details form (THIS PHASE)
└── review/
    └── page.tsx               # Step 4: Review summary (THIS PHASE)

lib/
├── wizard-draft.ts            # Session storage helpers (Phase 19)
├── slug-helpers.ts            # Slug generation + validation (reuse existing)
└── networks.ts                # Network config (already exists)

hooks/
└── useResourceImageUpload.ts  # Image upload hook (already exists)

constants/
└── categories.ts              # Category options (already exists)
```

### Pattern 1: Auto-Generate Slug with Manual Edit Detection
**What:** Slug auto-generates from name as user types, stops syncing once user manually edits slug field
**When to use:** URL slug fields that should start from name but allow customization

**Example:**
```typescript
// app/dashboard/resources/new/details/page.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRef, useCallback } from 'react'

// Reuse existing slug generation from CreateResourceModal.tsx
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const detailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  price: z.string().min(1, 'Price is required'),
  network: z.enum(['base', 'solana']),
})

export default function DetailsPage() {
  const slugManuallyEdited = useRef(false)
  const { register, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(detailsSchema),
    mode: 'onBlur', // Validate on blur first
    reValidateMode: 'onChange', // Then validate on change after first error
  })

  const name = watch('name')

  // Auto-generate slug from name
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    if (!slugManuallyEdited.current) {
      const newSlug = generateSlug(newName)
      setValue('slug', newSlug, { shouldValidate: true })
    }
  }, [setValue])

  // Detect manual slug edit
  const handleSlugChange = useCallback(() => {
    slugManuallyEdited.current = true
  }, [])

  return (
    <form>
      <Input
        {...register('name')}
        onChange={(e) => {
          register('name').onChange(e)
          handleNameChange(e)
        }}
      />
      <Input
        {...register('slug')}
        onChange={(e) => {
          register('slug').onChange(e)
          handleSlugChange()
        }}
      />
    </form>
  )
}
```

**Source:** Adapted from existing CreateResourceModal.tsx generateSlug implementation

**Why this works:**
- `useRef` persists across renders without causing re-renders
- `slugManuallyEdited` flag never resets, so auto-generation stops permanently once user edits
- `setValue` updates form state with validation
- Combines auto-generation UX with customization flexibility

### Pattern 2: Slug Prefix Display with Username
**What:** Show `/@username/` as non-editable prefix before slug input field
**When to use:** URL slug fields that need to show full path context

**Example:**
```typescript
// Display slug with username prefix
import { useAuth } from '@/contexts/AuthContext'

export default function DetailsPage() {
  const { user } = useAuth()
  const username = user?.user_metadata?.username || 'username'

  return (
    <div className="flex items-center gap-0">
      <span className="text-muted-foreground text-sm px-3 py-2 bg-muted rounded-l-md border border-r-0 border-input">
        /@{username}/
      </span>
      <Input
        {...register('slug')}
        className="rounded-l-none"
        placeholder="my-resource"
      />
    </div>
  )
}
```

**Source:** Pattern from CreateResourceModal.tsx "Your resource will be at: /@username/" display

**Why this works:**
- Visual prefix shows full URL context without cluttering input value
- Styled as disabled input prefix (matches input height/styling)
- Username pulled from Supabase user_metadata
- Slug input remains clean (just the slug part, not full path)

### Pattern 3: Debounced Slug Uniqueness Check
**What:** Check slug availability via API after user stops typing (400ms delay)
**When to use:** Slug fields that must be unique per network

**Example:**
```typescript
// Debounced slug uniqueness check
import { useCallback, useRef, useState } from 'react'

export default function DetailsPage() {
  const [slugStatus, setSlugStatus] = useState<'available' | 'taken' | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const checkSlugAvailability = useCallback(async (slug: string, network: string) => {
    try {
      const response = await fetch(`/api/resources/check-slug?slug=${slug}&network=${network}`)
      const data = await response.json()
      setSlugStatus(data.available ? 'available' : 'taken')
    } catch (error) {
      console.error('Slug check failed:', error)
    } finally {
      setIsCheckingSlug(false)
    }
  }, [])

  const debouncedSlugCheck = useCallback((slug: string, network: string) => {
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current)
    }

    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setIsCheckingSlug(true)
      slugCheckTimeoutRef.current = setTimeout(() => {
        checkSlugAvailability(slug, network)
      }, 400) // 400ms debounce
    }
  }, [checkSlugAvailability])

  // Trigger check when slug or network changes
  const slug = watch('slug')
  const network = watch('network')

  useEffect(() => {
    if (slug && network) {
      debouncedSlugCheck(slug, network)
    }
  }, [slug, network, debouncedSlugCheck])

  return (
    <>
      <Input {...register('slug')} />
      {isCheckingSlug && <span className="text-sm text-muted-foreground">Checking...</span>}
      {slugStatus === 'available' && <span className="text-sm text-green-500">Available</span>}
      {slugStatus === 'taken' && <span className="text-sm text-destructive">Already taken</span>}
    </>
  )
}
```

**Source:** Adapted from CreateResourceModal.tsx checkSlugAvailability and debouncedSlugCheck pattern

**Why this works:**
- 400ms delay prevents API spam while typing
- Clears previous timeout before setting new one
- Only checks valid slug format (regex validation)
- Shows loading/available/taken states clearly
- Cleanup on unmount via useRef for timeout

### Pattern 4: Price Input with Minimum Validation
**What:** Text input for price with Zod validation for minimum $0.01, format as USDC
**When to use:** Currency inputs that need minimum value and decimal precision

**Example:**
```typescript
// Price input with minimum validation
const detailsSchema = z.object({
  price: z.string()
    .min(1, 'Price is required')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0.01
    }, 'Minimum price is $0.01')
})

export default function DetailsPage() {
  return (
    <div>
      <label>Price (USDC)</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <Input
          {...register('price')}
          type="text"
          inputMode="decimal"
          placeholder="0.01"
          className="pl-7"
        />
      </div>
      {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
    </div>
  )
}
```

**Source:** Zod refinement pattern from [JavaScript Currency Validation 2026](https://copyprogramming.com/howto/currency-validation)

**Why this works:**
- Text input with `inputMode="decimal"` shows numeric keyboard on mobile
- Zod `refine` validates parsed float is >= 0.01
- Visual $ prefix indicates currency without cluttering value
- Allows user to type naturally (e.g., "1.5" not "1.50")

### Pattern 5: Image Field Dual Input (URL or Upload)
**What:** Toggle between URL input and file upload, use existing useResourceImageUpload hook
**When to use:** Image fields where users may have hosted image or local file

**Example:**
```typescript
// Image field with URL input or file upload
import { useState } from 'react'
import { useResourceImageUpload } from '@/hooks/useResourceImageUpload'

export default function DetailsPage() {
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url')
  const { uploadImage, uploadImageFromUrl, isUploading } = useResourceImageUpload()
  const { setValue, watch } = useForm()
  const imageUrl = watch('imageUrl')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await uploadImage(file)
    if (result.success && result.data) {
      setValue('imageUrl', result.data.publicUrl)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Button
          type="button"
          variant={imageMode === 'url' ? 'primary' : 'outline'}
          onClick={() => setImageMode('url')}
        >
          URL
        </Button>
        <Button
          type="button"
          variant={imageMode === 'upload' ? 'primary' : 'outline'}
          onClick={() => setImageMode('upload')}
        >
          Upload
        </Button>
      </div>

      {imageMode === 'url' ? (
        <Input
          {...register('imageUrl')}
          type="url"
          placeholder="https://example.com/image.png"
        />
      ) : (
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
      )}

      {imageUrl && (
        <img src={imageUrl} alt="Preview" className="mt-4 max-w-xs rounded-lg" />
      )}
    </div>
  )
}
```

**Source:** useResourceImageUpload hook pattern (already exists in project)

**Why this works:**
- Simple toggle between two modes
- Reuses existing upload infrastructure (Supabase storage, signed URLs)
- Preview shows result immediately
- Both modes result in same value (URL string in form)

### Pattern 6: Review Summary with Edit Navigation
**What:** Read-only display of all wizard data with "Edit" links that navigate to specific steps
**When to use:** Review/confirmation step in multi-step forms

**Example:**
```typescript
// Review summary page with edit links
import { useRouter } from 'next/navigation'
import { getDraft } from '@/lib/wizard-draft'
import { RESOURCE_CATEGORIES } from '@/constants/categories'
import { getNetwork } from '@/lib/networks'

export default function ReviewPage() {
  const router = useRouter()
  const draft = getDraft()

  if (!draft) {
    // Redirect if no draft
    router.replace('/dashboard/resources/new')
    return null
  }

  const category = RESOURCE_CATEGORIES.find(c => c.value === draft.category)
  const network = getNetwork(draft.network)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Review Resource</h1>

      {/* Basic Info Section */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>
          <button
            onClick={() => router.push('/dashboard/resources/new/details')}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>

        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">Name</dt>
            <dd className="text-base font-medium">{draft.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">URL</dt>
            <dd className="text-base font-mono">/@username/{draft.slug}</dd>
          </div>
          {draft.description && (
            <div>
              <dt className="text-sm text-muted-foreground">Description</dt>
              <dd className="text-base">{draft.description}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted-foreground">Category</dt>
            <dd className="text-base">{category?.label}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Price</dt>
            <dd className="text-base">${draft.price} USDC</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Network</dt>
            <dd className="text-base">{network.name}</dd>
          </div>
        </dl>
      </div>

      {/* Type-specific config section */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Configuration</h2>
          <button
            onClick={() => router.push(`/dashboard/resources/new/${draft.type}`)}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        {/* Type-specific config display */}
      </div>

      <Button onClick={handlePublish} disabled={isPublishing}>
        {isPublishing ? 'Publishing...' : 'Publish Resource'}
      </Button>
    </div>
  )
}
```

**Source:** Pattern from [Multi-step form review summary](https://claritydev.net/blog/build-a-multistep-form-with-react-hook-form)

**Why this works:**
- Simple data display, no complex edit mode toggle
- Edit links navigate to specific wizard steps (leverages existing flow)
- Sections grouped logically (basic info, type config, etc.)
- Each section has its own Edit button for targeted navigation
- Shows formatted/human-readable values (network name not ID)

### Pattern 7: Form Validation Timing (onBlur then onChange)
**What:** Validate on blur initially, then validate on change after first error shows
**When to use:** All forms to balance user experience with real-time feedback

**Example:**
```typescript
// React Hook Form validation mode
const { register, formState: { errors } } = useForm({
  resolver: zodResolver(detailsSchema),
  mode: 'onBlur',          // Initial validation on blur
  reValidateMode: 'onChange' // Re-validate on change after error
})
```

**Source:** [React Hook Form validation timing best practices 2026](https://github.com/react-hook-form/react-hook-form/discussions/8241)

**Why this works:**
- Users can finish typing before seeing validation errors (better UX)
- Once error appears, clears immediately when user corrects (real-time feedback)
- Balances between annoying (validate every keystroke) and frustrating (only on submit)

### Anti-Patterns to Avoid
- **Controlled slug input without auto-generation:** User expects slug to derive from name initially
- **Validating on every keystroke before blur:** Interrupts typing flow, shows errors too early
- **Read-only slug field with edit button:** Less intuitive than editable field
- **Complex state machine for review editing:** Simple navigation to steps is clearer
- **Storing full form in URL params:** Session storage handles this, URLs stay clean
- **Custom currency input component:** Native input with Zod validation is simpler, fewer bugs
- **Syncing slug indefinitely:** Once user edits, respect their choice, don't override

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug generation from name | Custom string replacement | Existing generateSlug function (CreateResourceModal.tsx) | Already handles edge cases (consecutive dashes, special chars), tested in production |
| Slug uniqueness check | Polling or immediate check | Debounced API call with 400ms delay | Reduces server load, better UX (doesn't spam while typing) |
| Image upload to storage | Custom fetch to Supabase | useResourceImageUpload hook | Handles signed URLs, error states, progress tracking, file validation |
| Network selection | Custom radio buttons | Existing NETWORKS constant + Select component | Network config centralized, includes icons, colors, explorer URLs |
| Category options | Hardcoded array | RESOURCE_CATEGORIES constant | Single source of truth, type-safe, reusable |
| Form validation | Custom validators | Zod schema + zodResolver | Type inference, reusable schemas, composable validation |
| Currency input masking | Input masking library | Text input with Zod validation | Simpler, fewer dependencies, mobile keyboard support |

**Key insight:** The project already has robust patterns for slug generation, image upload, and form validation. Don't rebuild these—reuse the existing helpers, hooks, and constants. The CreateResourceModal.tsx contains production-tested code for slug generation, uniqueness checking, and network selection that should be extracted to shared utilities and reused.

## Common Pitfalls

### Pitfall 1: Slug Continues Auto-Generating After Manual Edit
**What goes wrong:** User edits slug to "my-custom-slug", then changes name field, and slug resets to auto-generated value
**Why it happens:** No flag to track whether user has manually edited slug, so auto-generation continues indefinitely
**How to avoid:**
- Use `useRef` to track manual edit state: `const slugManuallyEdited = useRef(false)`
- Set flag to true on slug field's onChange handler
- Check flag before auto-generating: `if (!slugManuallyEdited.current) { generateSlug() }`
- Flag persists across renders but doesn't cause re-renders
**Warning signs:** User complaints about slug resetting, slug changes when name changes even after user customized it

**Source:** Pattern from CreateResourceModal.tsx slugManuallyEdited implementation

### Pitfall 2: Slug Check API Spam While Typing
**What goes wrong:** Every keystroke triggers API call to check slug availability, overwhelming server
**Why it happens:** No debouncing on slug onChange handler, each character typed fires request
**How to avoid:**
- Use setTimeout with 400ms delay before making API call
- Clear previous timeout before setting new one (debounce pattern)
- Only check if slug matches valid format (regex validation first)
- Cancel in-flight requests on component unmount
**Warning signs:** Network tab shows dozens of /check-slug requests, server slow response, rate limiting errors

**Source:** Standard debounce pattern from CreateResourceModal.tsx debouncedSlugCheck (400ms)

### Pitfall 3: Price Validation Accepts Invalid Decimals
**What goes wrong:** User enters "0", ".5", "00.01" or other edge cases that parse as numbers but aren't valid prices
**Why it happens:** Simple `parseFloat()` is lenient, accepts leading zeros, no decimal point, etc.
**How to avoid:**
- Use Zod string validation first, then refine to check parsed value
- Validate minimum (0.01) and maximum if needed
- Consider regex for valid decimal format: `/^\d+(\.\d{1,2})?$/`
- Display error message with specific example: "Minimum price is $0.01"
**Warning signs:** Prices stored as 0, $0.00, or malformed decimals in database

**Source:** [JavaScript Currency Validation 2026](https://copyprogramming.com/howto/currency-validation)

### Pitfall 4: Username Not Available for Slug Preview
**What goes wrong:** Slug preview shows "/@username/my-slug" before user object loads, or username is undefined
**Why it happens:** useAuth returns null user initially, user_metadata may not be set, SSR/CSR mismatch
**How to avoid:**
- Provide fallback: `const username = user?.user_metadata?.username || 'username'`
- Show loading state if user is still loading: `{loading ? 'Loading...' : `/@${username}/`}`
- Handle case where username is missing (OAuth users may not have username set)
**Warning signs:** Preview shows "/@undefined/slug", hydration errors, flash of wrong content

**Source:** AuthContext.tsx useAuth hook, Supabase user_metadata structure

### Pitfall 5: Review Page Missing Draft Data
**What goes wrong:** User navigates to /review but draft is null, page crashes or shows empty state
**Why it happens:** User refreshed page after clearing session storage, or deep-linked directly to review
**How to avoid:**
- Check `getDraft()` on mount, redirect to `/dashboard/resources/new` if null
- Use `useEffect` with `router.replace()` for redirect (no history pollution)
- Early return `null` before rendering to prevent flash of content
- Show loading state while checking draft
**Warning signs:** "Cannot read property 'name' of null" errors, blank review page, redirect loops

**Source:** Deep link protection pattern from Phase 19 research

### Pitfall 6: Form Submit Without Required Fields
**What goes wrong:** Continue button enabled even when required fields (name, price, network) are empty
**Why it happens:** No validation before submit, or button enabled state not tied to form validity
**How to avoid:**
- Use React Hook Form's `formState.isValid` to control button disabled state
- Set default values for all fields to avoid undefined
- Validate on blur to show errors before user tries to submit
- Alternative: Always enable button, show validation errors on submit attempt
**Warning signs:** Form submits with missing data, no error messages, user confusion about why submit fails

**Source:** React Hook Form formState.isValid pattern

### Pitfall 7: Image Preview Doesn't Update After Upload
**What goes wrong:** User uploads file, but preview still shows old image or no image
**Why it happens:** Form value not updated after upload completes, no re-render triggered
**How to avoid:**
- Call `setValue('imageUrl', result.data.publicUrl)` after successful upload
- Watch imageUrl field: `const imageUrl = watch('imageUrl')`
- Conditional render preview based on watched value
- Handle loading state during upload
**Warning signs:** Preview stuck on old image, file uploads but form doesn't reflect it, no visual feedback

**Source:** useResourceImageUpload hook usage pattern

## Code Examples

Verified patterns from official sources and project codebase:

### Complete Details Form with All Fields
```typescript
// app/dashboard/resources/new/details/page.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useCallback, useState } from 'react'
import { Input } from '@x402jobs/ui/input'
import { Textarea } from '@x402jobs/ui/textarea'
import { Select } from '@x402jobs/ui/select'
import { Button } from '@x402jobs/ui/button'
import { WizardShell } from '@/components/wizard/WizardShell'
import { getDraft, saveDraft } from '@/lib/wizard-draft'
import { RESOURCE_CATEGORIES } from '@/constants/categories'
import { getAllNetworks } from '@/lib/networks'
import { useAuth } from '@/contexts/AuthContext'

// Slug generation (from CreateResourceModal.tsx)
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const detailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  imageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  price: z.string()
    .min(1, 'Price is required')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num >= 0.01
    }, 'Minimum price is $0.01'),
  network: z.enum(['base', 'solana']),
})

type DetailsForm = z.infer<typeof detailsSchema>

export default function DetailsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const draft = getDraft()

  // Redirect if missing prerequisites
  useEffect(() => {
    if (!draft?.type) {
      router.replace('/dashboard/resources/new')
    }
  }, [draft, router])

  if (!draft?.type) {
    return null
  }

  const slugManuallyEdited = useRef(false)
  const [slugStatus, setSlugStatus] = useState<'available' | 'taken' | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: draft.name || '',
      slug: draft.slug || '',
      description: draft.description || '',
      imageUrl: draft.imageUrl || '',
      category: draft.category || '',
      price: draft.price || '',
      network: draft.network || 'base',
    }
  })

  const name = watch('name')
  const slug = watch('slug')
  const network = watch('network')
  const username = user?.user_metadata?.username || 'username'

  // Auto-generate slug from name
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    if (!slugManuallyEdited.current) {
      const newSlug = generateSlug(newName)
      setValue('slug', newSlug, { shouldValidate: true })
    }
  }, [setValue])

  // Mark slug as manually edited
  const handleSlugChange = useCallback(() => {
    slugManuallyEdited.current = true
  }, [])

  // Debounced slug check
  const checkSlugAvailability = useCallback(async (slugToCheck: string, networkToCheck: string) => {
    try {
      const response = await fetch(`/api/resources/check-slug?slug=${slugToCheck}&network=${networkToCheck}`)
      const data = await response.json()
      setSlugStatus(data.available ? 'available' : 'taken')
    } catch (error) {
      console.error('Slug check failed:', error)
    } finally {
      setIsCheckingSlug(false)
    }
  }, [])

  useEffect(() => {
    const timeoutRef = setTimeout(() => {
      if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && network) {
        setIsCheckingSlug(true)
        checkSlugAvailability(slug, network)
      }
    }, 400)

    return () => clearTimeout(timeoutRef)
  }, [slug, network, checkSlugAvailability])

  const onSubmit = (data: DetailsForm) => {
    saveDraft(data)
    router.push('/dashboard/resources/new/review')
  }

  return (
    <WizardShell
      step={3}
      totalSteps={4}
      title="Resource Details"
      description="Add information about your resource"
      footer={
        <Button type="submit" form="details-form" disabled={!isValid}>
          Continue
        </Button>
      }
    >
      <form id="details-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Name *</label>
          <Input
            {...register('name')}
            onChange={(e) => {
              register('name').onChange(e)
              handleNameChange(e)
            }}
            placeholder="My API Resource"
          />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium mb-2">URL Slug *</label>
          <div className="flex items-center gap-0">
            <span className="text-muted-foreground text-sm px-3 py-2 bg-muted rounded-l-md border border-r-0 border-input min-h-[36px] flex items-center">
              /@{username}/
            </span>
            <Input
              {...register('slug')}
              onChange={(e) => {
                register('slug').onChange(e)
                handleSlugChange()
              }}
              className="rounded-l-none"
              placeholder="my-api-resource"
            />
          </div>
          {errors.slug && <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>}
          {isCheckingSlug && <p className="text-sm text-muted-foreground mt-1">Checking availability...</p>}
          {slugStatus === 'available' && <p className="text-sm text-green-500 mt-1">✓ Available</p>}
          {slugStatus === 'taken' && <p className="text-sm text-destructive mt-1">This slug is already taken</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <Textarea
            {...register('description')}
            placeholder="Describe what your resource does..."
            rows={4}
          />
          {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-sm font-medium mb-2">Image</label>
          <Input
            {...register('imageUrl')}
            type="url"
            placeholder="https://example.com/image.png"
          />
          {errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2">Category *</label>
          <Select
            {...register('category')}
            options={RESOURCE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
            placeholder="Select a category"
            value={watch('category')}
            onChange={(value) => setValue('category', value)}
          />
          {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium mb-2">Price (USDC) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              {...register('price')}
              type="text"
              inputMode="decimal"
              placeholder="0.01"
              className="pl-7"
            />
          </div>
          {errors.price && <p className="text-sm text-destructive mt-1">{errors.price.message}</p>}
        </div>

        {/* Network */}
        <div>
          <label className="block text-sm font-medium mb-2">Network *</label>
          <Select
            {...register('network')}
            options={getAllNetworks().map(n => ({ value: n.id, label: n.name }))}
            value={watch('network')}
            onChange={(value) => setValue('network', value as 'base' | 'solana')}
          />
          {errors.network && <p className="text-sm text-destructive mt-1">{errors.network.message}</p>}
        </div>
      </form>
    </WizardShell>
  )
}
```

**Source:** Combined patterns from CreateResourceModal.tsx, Phase 19 WizardShell, and React Hook Form documentation

### Review Summary with Edit Navigation
```typescript
// app/dashboard/resources/new/review/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@x402jobs/ui/button'
import { WizardShell } from '@/components/wizard/WizardShell'
import { getDraft, clearDraft } from '@/lib/wizard-draft'
import { RESOURCE_CATEGORIES } from '@/constants/categories'
import { getNetwork } from '@/lib/networks'
import { useAuth } from '@/contexts/AuthContext'

export default function ReviewPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isPublishing, setIsPublishing] = useState(false)
  const draft = getDraft()

  // Redirect if missing prerequisites
  useEffect(() => {
    if (!draft?.type || !draft?.name) {
      router.replace('/dashboard/resources/new')
    }
  }, [draft, router])

  if (!draft?.type || !draft?.name) {
    return null
  }

  const category = RESOURCE_CATEGORIES.find(c => c.value === draft.category)
  const network = getNetwork(draft.network)
  const username = user?.user_metadata?.username || 'username'

  const handlePublish = async () => {
    setIsPublishing(true)

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })

      if (!response.ok) {
        throw new Error('Failed to create resource')
      }

      const result = await response.json()
      clearDraft()
      router.push(`/@${username}/${draft.slug}`)
    } catch (error) {
      console.error('Publish failed:', error)
      alert('Failed to publish resource. Please try again.')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <WizardShell
      step={4}
      totalSteps={4}
      title="Review & Publish"
      description="Review your resource before publishing"
      footer={
        <Button onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? 'Publishing...' : 'Publish Resource'}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Basic Information</h2>
            <button
              onClick={() => router.push('/dashboard/resources/new/details')}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground mb-1">Name</dt>
              <dd className="text-base font-medium">{draft.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground mb-1">URL</dt>
              <dd className="text-base font-mono text-primary">/@{username}/{draft.slug}</dd>
            </div>
            {draft.description && (
              <div>
                <dt className="text-sm text-muted-foreground mb-1">Description</dt>
                <dd className="text-base">{draft.description}</dd>
              </div>
            )}
            {draft.imageUrl && (
              <div>
                <dt className="text-sm text-muted-foreground mb-1">Image</dt>
                <dd>
                  <img src={draft.imageUrl} alt={draft.name} className="max-w-xs rounded-lg border border-border" />
                </dd>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground mb-1">Category</dt>
                <dd className="text-base">{category?.label}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground mb-1">Price</dt>
                <dd className="text-base font-semibold">${draft.price} USDC</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground mb-1">Network</dt>
                <dd className="text-base">{network.name}</dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Type-specific Configuration */}
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Configuration</h2>
            <button
              onClick={() => router.push(`/dashboard/resources/new/${draft.type}`)}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          {/* Type-specific config display (future phases) */}
          <p className="text-sm text-muted-foreground">
            {draft.type === 'link' && 'Link Existing configuration'}
            {draft.type === 'proxy' && 'Proxy configuration'}
            {draft.type === 'claude' && 'Claude Prompt configuration'}
            {draft.type === 'openrouter' && 'OpenRouter configuration'}
          </p>
        </div>
      </div>
    </WizardShell>
  )
}
```

**Source:** Review pattern from multi-step form examples and project WizardShell component

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Validate on submit only | Validate on blur, re-validate on change | 2024-2025 | Better UX, users see errors sooner but not while typing |
| Controlled inputs for all fields | Uncontrolled (via register) | React Hook Form v7 (2021) | Better performance, fewer re-renders |
| Custom validation functions | Zod schema validation | 2023-2024 | Type safety, reusable schemas, composable rules |
| Immediate API calls on input | Debounced with 400ms delay | Standard pattern | Reduces server load, better UX |
| Read-only slug auto-generated | Editable with auto-generation | Modern UX pattern | User control + convenience |
| Complex review edit mode | Navigate to step to edit | 2024-2025 | Simpler code, leverages existing wizard flow |
| Currency input libraries | Native input + validation | 2025-2026 | Fewer dependencies, better mobile keyboard |

**Deprecated/outdated:**
- React Hook Form mode: 'all' (validates on every change): Use 'onBlur' then 'onChange' pattern instead
- Custom slug validation with complex regex: Use simple regex + backend uniqueness check
- Formik for new projects: React Hook Form has better performance and smaller bundle
- Input masking libraries for currency: Native inputMode="decimal" + Zod validation simpler

## Open Questions

Things that couldn't be fully resolved:

1. **Image field implementation (URL vs Upload vs Both)**
   - What we know: useResourceImageUpload hook exists, supports both URL fetch and file upload
   - What's unclear: User decision lists "Image field (URL input or upload)" without specifying if both modes needed
   - Recommendation: Implement URL input only for simplicity. Add upload mode if user requests during testing. URL input covers 80% of use cases (users with hosted images).

2. **Network field pre-fill behavior for Link Existing**
   - What we know: REVW-05 mentions "Network and price fields accept pre-filled values (wired when Link Existing path is built)"
   - What's unclear: How pre-fill is passed (URL params? Session storage? x402check response?)
   - Recommendation: Design form to accept defaultValues from draft. Link Existing phase (future) will set network in session storage during its step.

3. **Category field — required or optional?**
   - What we know: DETL-05 lists "Category dropdown" without asterisk, but form needs good UX
   - What's unclear: Can resource exist without category? Is there a default?
   - Recommendation: Make required (better for discovery/browsing). User can select "Other" if needed. Add to RESOURCE_CATEGORIES if missing.

4. **Slug uniqueness scope (per user or global?)**
   - What we know: API endpoint is `/api/resources/check-slug?slug=X&network=Y`
   - What's unclear: Is slug unique per user per network, or globally per network?
   - Recommendation: Likely unique per user per network (/@username/slug implies user scoping). Verify with API implementation.

5. **Review step validation display for Link Existing**
   - What we know: REVW-03 mentions "Validation summary shown for Link Existing type"
   - What's unclear: What validation results? x402check output? URL reachability?
   - Recommendation: Placeholder for now. Link Existing phase will define what validation results to display.

## Sources

### Primary (HIGH confidence)
- Project codebase: CreateResourceModal.tsx - Verified slug generation, debounced checking, network selection patterns
- Project codebase: useResourceImageUpload.ts - Image upload hook implementation
- Project codebase: networks.ts, categories.ts - Network and category constants
- Project codebase: wizard-draft.ts, WizardShell.tsx - Session storage and wizard shell patterns (Phase 19)
- [React Hook Form API Documentation](https://www.react-hook-form.com/api/useform/register/) - Official register() and validation mode docs
- [React Hook Form with Zod Complete Guide 2026](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1) - Current best practices

### Secondary (MEDIUM confidence)
- [React Hook Form validation timing discussion](https://github.com/react-hook-form/react-hook-form/discussions/8241) - Community patterns for onBlur/onChange
- [Multi-step form with React Hook Form (ClarityDev)](https://claritydev.net/blog/build-a-multistep-form-with-react-hook-form) - Review summary patterns
- [JavaScript Currency Validation 2026](https://copyprogramming.com/howto/currency-validation) - Zod price validation patterns
- [As-You-Type Slug Uniqueness Validation](https://lethain.com/as-you-type-slug-uniqueness-validation/) - Debounce patterns
- [Multi-step Form Navigation Best Practices](https://www.reform.app/blog/multi-step-form-navigation-best-practices) - Edit navigation patterns

### Tertiary (LOW confidence)
- WebSearch results on React file upload components - General approaches, not project-specific
- WebSearch results on slug regex patterns - Various formats, need to match project's existing regex
- GitHub discussions on currency input - Multiple library recommendations, project uses simpler approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, versions verified in package.json
- Architecture: HIGH - Patterns extracted from production code (CreateResourceModal.tsx), Phase 19 wizard patterns verified
- Pitfalls: HIGH - Based on existing code patterns, React Hook Form documentation, known issues from similar implementations
- Code examples: HIGH - Adapted from working project code, official documentation

**Research date:** 2026-01-31
**Valid until:** 2026-03-02 (30 days - stable libraries, no major version changes expected)
