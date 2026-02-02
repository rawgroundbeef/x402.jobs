# Phase 21: Link Existing Path - Research

**Researched:** 2026-01-31
**Domain:** x402 endpoint validation with x402check package, React Hook Form async validation, collapsible results display
**Confidence:** HIGH

## Summary

This phase builds the Link Existing validation step where users input an x402 endpoint URL, validate it using the x402check package, view detailed validation results, and proceed to details/review on success. The validation step is the type-specific configuration step for the "Link Existing" resource type path through the wizard (Type Selection → Validate → Details → Review → Publish).

The standard approach uses React Hook Form for the URL + HTTP method form, triggers x402check validation via the existing `/api/v1/resources/verify` backend endpoint (which already uses x402check), and displays results using the VerifyResultDetails component that already exists in the codebase. The validation results display with a prominent verdict banner (green for valid, red for invalid), errors shown inline, and warnings/parsed config/endpoint checks/response body in collapsible sections that default to closed.

The project already has all infrastructure in place: x402check@0.2.0 package installed, VerifyResultDetails component with full CheckResult display logic, processVerifyResponse utility for handling the proxy response format, and HTTP method detection in the backend. The Link Existing step reuses these existing components without modification, treating x402check as the source of truth for network and price detection.

**Primary recommendation:** Use the existing VerifyResultDetails component as-is for results display, call the existing `/api/v1/resources/verify` endpoint with URL and method, disable Continue button until validation succeeds, pre-fill network and price from CheckResult.summary[0] into session storage for the details step, and handle re-validation when user changes URL with clear visual feedback.

## Standard Stack

The established libraries/tools for x402 endpoint validation:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| x402check | ^0.2.0 (installed) | x402 config extraction, validation, registry lookups | Official x402 validation library, used by x402check.com, provides CheckResult with errors/warnings/summary |
| react-hook-form | ^7.62.0 (installed) | Form state for URL + method inputs | Minimal re-renders, uncontrolled inputs, built-in validation |
| zod | ^3.24.4 (installed) | Schema validation for URL format | Type-safe validation, integrates with RHF |
| @hookform/resolvers | 3.3.4 (installed) | Zod + RHF bridge | Official adapter for Zod schemas |
| VerifyResultDetails | N/A (local component) | Display CheckResult with verdict banner, errors, collapsible sections | Already built, matches x402check.com design, production-tested |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.468.0 (installed) | Icons for validation states, chevrons | Tree-shakable icons for CheckCircle2, XCircle, AlertTriangle, ChevronDown |
| CollapsibleSection | N/A (local component) | Expandable sections for warnings/config/checks | Matches wizard design system, consistent with other steps |
| processVerifyResponse | N/A (local utility) | Parse backend proxy response into VerifyResponse | Handles both legacy and proxy formats, normalizes networks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| VerifyResultDetails | Custom results display | VerifyResultDetails already exists, matches x402check.com, no need to rebuild |
| /api/v1/resources/verify | Direct x402check client-side | Backend proxy handles CORS, caching, server preview, normalizes response |
| HTTP method dropdown | Detect method automatically | Some endpoints support multiple methods, user should choose |
| Session storage pre-fill | URL params for network/price | Session storage already used for wizard draft, consistent approach |
| Re-validate on URL change | Keep old results | Stale results confusing, user expects fresh validation |

**Installation:**
All required packages already installed. No additional dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
app/dashboard/resources/new/
├── page.tsx                    # Step 1: Type selection
├── link/
│   └── page.tsx               # Step 2: Validate endpoint (THIS PHASE)
├── details/
│   └── page.tsx               # Step 3: Shared details (Phase 20)
└── review/
    └── page.tsx               # Step 4: Review summary (Phase 20)

lib/
├── wizard-draft.ts            # Session storage helpers (Phase 19)
├── x402-verify.ts             # processVerifyResponse, types (already exists)
└── networks.ts                # normalizeNetworkId (already exists)

components/
├── VerifyResultDetails.tsx    # CheckResult display (already exists)
└── ui/
    └── CollapsibleSection.tsx # Collapsible component (already exists)
```

### Pattern 1: Async Validation with External API
**What:** Validate URL via backend API call, show loading state, display results, block Continue until valid
**When to use:** Form validation that requires server-side checks (x402 endpoint validation, slug uniqueness, etc.)

**Example:**
```typescript
// app/dashboard/resources/new/link/page.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { processVerifyResponse, type VerifyResponse } from '@/lib/x402-verify'
import { VerifyResultDetails } from '@/components/VerifyResultDetails'

const linkSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
})

export default function LinkExistingPage() {
  const [isValidating, setIsValidating] = useState(false)
  const [verifyResponse, setVerifyResponse] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(linkSchema),
    defaultValues: { method: 'GET' },
  })

  const handleValidate = async (data: { url: string; method: string }) => {
    setIsValidating(true)
    setError(null)
    setVerifyResponse(null)

    try {
      const res = await fetch(`/api/v1/resources/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.url }),
      })

      const rawData = await res.json()

      if (!res.ok) {
        throw new Error(rawData.error || 'Validation failed')
      }

      const processed = processVerifyResponse(rawData, data.url)
      setVerifyResponse(processed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate endpoint')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleValidate)}>
      <Input {...register('url')} placeholder="https://api.example.com/x402/..." />
      <Select {...register('method')}>
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
      </Select>

      <Button type="submit" disabled={isValidating}>
        {isValidating ? <Loader2 className="animate-spin" /> : 'Validate Endpoint'}
      </Button>

      {error && <ErrorDisplay>{error}</ErrorDisplay>}
      {verifyResponse && <VerifyResultDetails verifyResponse={verifyResponse} url={data.url} />}

      <Button disabled={!verifyResponse?.valid} onClick={handleContinue}>
        Continue
      </Button>
    </form>
  )
}
```

**Source:** Adapted from RegisterResourceModal.tsx handleVerify pattern, [React Hook Form async validation 2026](https://blog.benorloff.co/async-form-validation-with-zod-react-hook-form)

**Why this works:**
- Separate loading state prevents duplicate submissions
- Clear error/success/loading states for UX clarity
- processVerifyResponse normalizes backend response format
- Continue button gated by `verifyResponse?.valid` prevents invalid progression
- Results display via existing VerifyResultDetails component

### Pattern 2: Pre-fill Details Step from Validation Results
**What:** Extract network and price from CheckResult.summary, save to session storage for details step pre-fill
**When to use:** Multi-step wizard where validation results inform later steps

**Example:**
```typescript
// Extract detected network and price from x402check results
const handleContinue = () => {
  if (!verifyResponse?.valid || !verifyResponse.checkResult) return

  const summary = verifyResponse.checkResult.summary[0]
  if (!summary) return

  // Normalize network from CAIP-2 to app format (base/solana)
  const normalizedNetwork = normalizeNetworkId(summary.network) || 'solana'

  // Convert amount from smallest unit to decimal (e.g., 10000 → "0.01" for USDC)
  const decimals = summary.assetDecimals || 6
  const amountNum = parseInt(summary.amount, 10)
  const price = (amountNum / 10 ** decimals).toString()

  // Update draft with pre-filled values
  saveDraft({
    ...getDraft(),
    type: 'link',
    resourceUrl: url,
    network: normalizedNetwork,
    price: price,
    // Mark as pre-filled so details step can lock fields
    preFilled: {
      network: true,
      price: true,
    },
  })

  router.push('/dashboard/resources/new/details')
}
```

**Source:** Pattern from RegisterResourceModal.tsx (lines 130-141), x402check CheckResult.summary structure

**Why this works:**
- CheckResult.summary contains registry-enriched data (network name, asset symbol, decimals)
- First summary entry [0] is primary accept option (x402check guarantees at least one if valid)
- normalizeNetworkId maps CAIP-2 (eip155:8453) to app format (base)
- Decimal conversion uses assetDecimals from registry (handles USDC, SOL, etc.)
- preFilled flag allows details step to render fields as read-only

### Pattern 3: Re-validation Flow When URL Changes
**What:** Clear old validation results when user changes URL, require fresh validation before continuing
**When to use:** Validation results that become stale when input changes

**Example:**
```typescript
// Clear validation when URL changes
const url = watch('url')
const method = watch('method')

useEffect(() => {
  // If results exist and URL/method changed, clear them (stale)
  if (verifyResponse) {
    setVerifyResponse(null)
    setError(null)
  }
}, [url, method])

// Disable Continue if results are stale
const canContinue = verifyResponse?.valid &&
                    verifyResponse.normalizedUrl === url &&
                    verifyResponse.detectedMethod === method
```

**Source:** RegisterResourceModal.tsx handleChangeUrl pattern (line 269-274)

**Why this works:**
- Prevents user from validating one URL then changing to another without re-validating
- Clear visual feedback that results are gone (need to re-validate)
- Continue button disabled until fresh validation completes
- Checks normalizedUrl match to handle URL canonicalization (http→https)

### Pattern 4: Verdict Banner with Counts
**What:** Large colored banner showing validation verdict, error count, warning count, version
**When to use:** Displaying validation results where verdict is most important information

**Example:**
```typescript
// VerifyResultDetails.tsx VerdictBanner component (already exists)
function VerdictBanner({ valid, errorCount, warningCount, version }) {
  if (valid) {
    return (
      <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Valid x402 endpoint
        </div>
        <div className="flex items-center gap-2">
          {warningCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            {version}
          </span>
        </div>
      </div>
    )
  }

  // Invalid state (red banner with error count)
  return (
    <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Invalid
        {errorCount > 0 && (
          <span className="font-normal"> · {errorCount} error{errorCount > 1 ? 's' : ''}</span>
        )}
      </div>
      {version !== 'unknown' && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {version}
        </span>
      )}
    </div>
  )
}
```

**Source:** VerifyResultDetails.tsx VerdictBanner implementation (lines 213-264)

**Why this works:**
- Prominent banner immediately communicates success/failure
- Color coding (green/red) provides instant visual feedback
- Counts badge show warning/error volume without expanding sections
- Version badge shows x402 v1/v2 at a glance
- Follows x402check.com design language (user decisions in CONTEXT.md)

### Pattern 5: Collapsible Sections Default Closed
**What:** Detail sections (warnings, parsed config, endpoint checks, response body) collapsed by default, verdict banner tells the story
**When to use:** Displaying detailed validation results where most users only need the verdict

**Example:**
```typescript
// VerifyResultDetails.tsx Details component (already exists)
function Details({ label, badge, badgeVariant = 'muted', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-border/50 rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {badge && <span className={badgeColors[badgeVariant]}>{badge}</span>}
        </div>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t">{children}</div>}
    </div>
  )
}

// Usage in VerifyResultDetails
<Details label="View warnings" badge={`${warnings.length}`} badgeVariant="warning">
  {/* Warning list */}
</Details>

<Details label="View parsed config">
  {/* Config table */}
</Details>

<Details label="View endpoint checks">
  {/* Check list */}
</Details>

<Details label="View response body">
  {/* Raw JSON */}
</Details>
```

**Source:** VerifyResultDetails.tsx Details component (lines 21-66), [React collapsible default closed pattern](https://react-bootstrap.netlify.app/docs/components/accordion/)

**Why this works:**
- Reduces visual clutter, verdict banner shows what matters
- Badge counts give preview of content without opening
- ChevronDown rotation (-90deg when closed) shows expand direction
- defaultOpen=false keeps all sections collapsed initially
- User can expand sections for deeper investigation when needed

### Pattern 6: HTTP Method Dropdown
**What:** Dropdown select for GET/POST/PUT/DELETE, defaults to GET
**When to use:** API endpoint forms where method matters for validation

**Example:**
```typescript
// HTTP method selection
const { register } = useForm({
  defaultValues: { method: 'GET' },
})

<div>
  <label className="block text-sm font-medium mb-2">HTTP Method</label>
  <select {...register('method')} className="w-full px-3 py-2 border rounded-md">
    <option value="GET">GET</option>
    <option value="POST">POST</option>
    <option value="PUT">PUT</option>
    <option value="DELETE">DELETE</option>
  </select>
</div>
```

**Source:** LINK-01 requirement, [HTTP method selection patterns](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)

**Why this works:**
- Simple native select, no custom dropdown needed
- GET default covers most x402 endpoints
- Limited to 4 standard methods (no PATCH, OPTIONS, HEAD clutter)
- Registered with RHF for consistent form state management
- Method included in verify API call (backend may use for actual request)

### Pattern 7: Loading Button with Spinner
**What:** Button shows spinner icon and "Validating..." text during API call, disabled state prevents duplicate submission
**When to use:** Any button that triggers async operations

**Example:**
```typescript
import { Loader2 } from 'lucide-react'

<Button type="submit" disabled={isValidating || isSubmitting}>
  {isValidating ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Validating...
    </>
  ) : (
    'Validate Endpoint'
  )}
</Button>
```

**Source:** RegisterResourceModal.tsx Verify button pattern (lines 598-609), [React loading button best practices 2026](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/)

**Why this works:**
- Loader2 with animate-spin provides standard spinner animation
- Text change ("Validate Endpoint" → "Validating...") reinforces loading state
- Disabled during loading prevents duplicate submissions
- Icon + text (not just spinner) provides clear feedback
- lucide-react icons are tree-shakable, no extra bundle weight

### Anti-Patterns to Avoid
- **Validating automatically on URL blur:** Users should explicitly trigger validation with button (control when API call happens)
- **Keeping old results when URL changes:** Stale results confusing, clear them immediately
- **Enabling Continue before validation completes:** Must wait for valid result, not optimistic
- **Custom x402check results display:** VerifyResultDetails already exists and matches x402check.com design
- **Making network/price editable on details step when pre-filled:** Mismatch between endpoint config and resource listing (user decision in CONTEXT.md: fields should be locked/read-only when pre-filled)
- **Expanding all collapsible sections by default:** Overwhelming, verdict banner tells the story
- **Showing success message for invalid endpoint:** Validation failure is not success, show errors clearly

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| x402 config validation | Custom validation logic | x402check package | Handles v1/v2 formats, registry lookups (networks/assets), address checksums, validation rules |
| Validation results display | Custom verdict UI | VerifyResultDetails component | Already built, matches x402check.com, tested in RegisterResourceModal |
| Response processing | Parse JSON directly | processVerifyResponse utility | Handles both legacy and proxy formats, normalizes networks, validates config |
| Network ID normalization | String mapping | normalizeNetworkId from networks.ts | Centralized CAIP-2 → app format mapping (eip155:8453 → base) |
| Collapsible sections | Custom accordion | CollapsibleSection or Details component | Consistent with wizard design, accessibility built-in |
| Loading button | Custom spinner | Loader2 icon + disabled state | Standard pattern, tree-shakable, consistent with project |
| Asset decimal conversion | Hardcode decimals | CheckResult.summary[0].assetDecimals | x402check registry provides accurate decimals per network/asset |

**Key insight:** The project already has production-tested x402 validation infrastructure from RegisterResourceModal.tsx. The Link Existing step is essentially that modal's validation flow extracted into a wizard step. Don't rebuild the validation display or response processing—reuse VerifyResultDetails and processVerifyResponse as-is. The only new code is the wizard page wrapper and the pre-fill logic for details step.

## Common Pitfalls

### Pitfall 1: Not Clearing Results When URL Changes
**What goes wrong:** User validates "https://api1.com", gets valid result, changes URL to "https://api2.com", clicks Continue without re-validating, creates resource pointing to api1.com but user thinks it's api2.com
**Why it happens:** No effect hook watching URL changes to clear stale results
**How to avoid:**
- Use `watch('url')` and `watch('method')` from React Hook Form
- useEffect that clears verifyResponse and error when URL or method changes
- Visual feedback that results are gone (sections collapse, buttons reset)
- Disable Continue unless `verifyResponse.normalizedUrl === currentUrl`
**Warning signs:** User confusion about which endpoint was validated, mismatched URLs in resources table, stale validation results displaying

**Source:** RegisterResourceModal.tsx handleChangeUrl pattern (line 269-274)

### Pitfall 2: Continue Enabled Before Validation Completes
**What goes wrong:** User clicks Validate, immediately clicks Continue before API response returns, wizard proceeds with null or partial data
**Why it happens:** Continue button not properly gated on validation success state
**How to avoid:**
- Disable Continue button with `disabled={!verifyResponse?.valid || isValidating}`
- Check both existence (`verifyResponse`) and validity (`verifyResponse.valid`)
- Show loading state during validation to communicate wait time
- Only enable Continue after successful validation completes
**Warning signs:** Crashes in details step from missing data, user proceeding with invalid endpoints, race conditions

**Source:** RegisterResourceModal.tsx footer logic (lines 611-628), [React Hook Form button disable patterns](https://github.com/react-hook-form/react-hook-form/discussions/1953)

### Pitfall 3: Network Normalization Mismatch
**What goes wrong:** CheckResult shows "eip155:8453" (CAIP-2 format), details step expects "base" (app format), network dropdown shows wrong selection or validation fails
**Why it happens:** x402check uses CAIP-2 standard, app uses simple names (base, solana)
**How to avoid:**
- Always use `normalizeNetworkId(summary.network)` when extracting from CheckResult
- Check normalizeNetworkId result for null (unknown network)
- Handle unknown networks gracefully with fallback or error message
- Test with all supported networks (base, solana, base-sepolia, solana-devnet)
**Warning signs:** Network field blank in details step, validation errors about unsupported networks, mismatched network displays

**Source:** lib/networks.ts normalizeNetworkId function, x402-verify.ts processVerifyResponse (line 241)

### Pitfall 4: Decimal Conversion Errors for Price
**What goes wrong:** Amount shows as "1000000" instead of "1.00", or wrong decimal places (0.000001 instead of 0.01)
**Why it happens:** x402 amounts are in smallest unit (1000000 = $1.00 USDC with 6 decimals), not using assetDecimals from registry
**How to avoid:**
- Use `CheckResult.summary[0].assetDecimals` for accurate decimals
- Calculate: `amountNum / (10 ** decimals)` where amountNum is parseInt(summary.amount)
- Use `.toString()` to preserve precision (not .toFixed which rounds)
- Handle null decimals (fallback to 6 for USDC)
- Test with different assets (USDC = 6 decimals, SOL = 9 decimals)
**Warning signs:** Prices showing huge numbers, wrong decimal precision, validation errors on details step price field

**Source:** x402check CheckResult.summary structure, VerifyResultDetails formatAmount function (lines 73-78)

### Pitfall 5: Missing Error Display for Network Errors
**What goes wrong:** User enters URL, clicks Validate, endpoint is unreachable (CORS, timeout, DNS), no error message shown, user confused about why nothing happens
**Why it happens:** Only catching validation errors, not network/fetch errors
**How to avoid:**
- Wrap fetch in try/catch with generic error handling
- Check `!res.ok` and show backend error message (`rawData.error`)
- Handle network errors separately from validation errors (different messages)
- Show error in prominent red box, not just console.error
- Timeout fetch after reasonable duration (10s for x402 endpoint validation)
**Warning signs:** Silent failures, user clicking Validate multiple times, no feedback for network errors

**Source:** RegisterResourceModal.tsx handleVerify error handling (lines 142-147), [React error state best practices](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/)

### Pitfall 6: Not Handling Legacy Response Format
**What goes wrong:** Backend returns old-style VerifyResponse (no checkResult), VerifyResultDetails expects CheckResult, component crashes or shows nothing
**Why it happens:** processVerifyResponse handles both formats, but code assumes checkResult always exists
**How to avoid:**
- Check `if (!verifyResponse.checkResult)` before accessing CheckResult fields
- VerifyResultDetails has LegacyDisplay fallback (lines 312-349)
- Don't assume CheckResult.summary exists, check length first
- Backend may return legacy format for cached responses or old endpoints
**Warning signs:** Crashes with "Cannot read property 'summary' of null", blank results display, old endpoints not validating

**Source:** VerifyResultDetails.tsx LegacyDisplay component (lines 312-349), x402-verify.ts processVerifyResponse (lines 142-158)

### Pitfall 7: URL Input Without Protocol Validation
**What goes wrong:** User enters "api.example.com" (no https://), validation fails with unclear error, or auto-corrects unexpectedly
**Why it happens:** Zod url() validation requires protocol, users often omit it
**How to avoid:**
- Zod schema: `z.string().url('Must be a valid URL starting with https://')`
- Show placeholder: `placeholder="https://api.example.com/x402/..."`
- Consider auto-prepending https:// if missing (transform before validation)
- Error message should mention protocol requirement explicitly
- Alternative: use text input with custom regex if auto-prepend needed
**Warning signs:** "Invalid URL" errors for valid-looking domains, user confusion about URL format

**Source:** Zod URL validation, [URL validation patterns 2026](https://react-hook-form.com/docs/useform)

## Code Examples

Verified patterns from official sources and project codebase:

### Complete Link Existing Validation Page
```typescript
// app/dashboard/resources/new/link/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Input } from '@x402jobs/ui/input'
import { Button } from '@x402jobs/ui/button'
import { WizardShell } from '@/components/wizard/WizardShell'
import { VerifyResultDetails } from '@/components/VerifyResultDetails'
import { getDraft, saveDraft } from '@/lib/wizard-draft'
import { processVerifyResponse, type VerifyResponse } from '@/lib/x402-verify'
import { normalizeNetworkId } from '@/lib/networks'
import { API_URL } from '@/lib/api'

const linkSchema = z.object({
  url: z.string().min(1, 'URL is required').url('Must be a valid URL starting with https://'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
})

type LinkForm = z.infer<typeof linkSchema>

export default function LinkExistingPage() {
  const router = useRouter()
  const draft = getDraft()

  // Redirect if missing type selection
  useEffect(() => {
    if (!draft?.type || draft.type !== 'link') {
      router.replace('/dashboard/resources/new')
    }
  }, [draft, router])

  if (!draft?.type || draft.type !== 'link') {
    return null
  }

  const [isValidating, setIsValidating] = useState(false)
  const [verifyResponse, setVerifyResponse] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LinkForm>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      url: draft.resourceUrl || '',
      method: 'GET',
    },
  })

  const url = watch('url')
  const method = watch('method')

  // Clear results when URL or method changes (stale results)
  useEffect(() => {
    if (verifyResponse) {
      setVerifyResponse(null)
      setError(null)
    }
  }, [url, method])

  const handleValidate = async (data: LinkForm) => {
    setIsValidating(true)
    setError(null)
    setVerifyResponse(null)

    try {
      const res = await fetch(`${API_URL}/api/v1/resources/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.url }),
      })

      const rawData = await res.json()

      if (!res.ok) {
        if (rawData.validationErrors) {
          throw new Error(rawData.validationErrors.join('. '))
        }
        throw new Error(rawData.error || 'Validation failed')
      }

      const processed = processVerifyResponse(rawData, data.url)
      setVerifyResponse(processed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate endpoint')
    } finally {
      setIsValidating(false)
    }
  }

  const handleContinue = () => {
    if (!verifyResponse?.valid || !verifyResponse.checkResult) return

    const summary = verifyResponse.checkResult.summary[0]
    if (!summary) return

    // Extract and normalize network (CAIP-2 → app format)
    const normalizedNetwork = normalizeNetworkId(summary.network) || 'solana'

    // Convert amount from smallest unit to decimal using registry decimals
    const decimals = summary.assetDecimals || 6
    const amountNum = parseInt(summary.amount, 10)
    const price = (amountNum / 10 ** decimals).toString()

    // Save validated data to draft
    saveDraft({
      ...draft,
      resourceUrl: verifyResponse.normalizedUrl || url,
      network: normalizedNetwork,
      price: price,
      preFilled: {
        network: true,
        price: true,
      },
    })

    router.push('/dashboard/resources/new/details')
  }

  // Can only continue if validation succeeded and URL hasn't changed
  const canContinue = verifyResponse?.valid &&
                      !isValidating &&
                      verifyResponse.normalizedUrl === url

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Validate Endpoint"
      description="Check your x402 endpoint configuration"
      footer={
        <>
          {!verifyResponse ? (
            <Button
              type="submit"
              form="link-form"
              disabled={isValidating}
              variant="primary"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate Endpoint'
              )}
            </Button>
          ) : (
            <Button onClick={handleContinue} disabled={!canContinue} variant="primary">
              Continue
            </Button>
          )}
        </>
      }
    >
      <form id="link-form" onSubmit={handleSubmit(handleValidate)} className="space-y-6">
        {/* URL Input */}
        {!verifyResponse && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Endpoint URL <span className="text-destructive">*</span>
              </label>
              <Input
                {...register('url')}
                type="url"
                placeholder="https://api.example.com/x402/..."
                autoFocus
              />
              {errors.url && (
                <p className="text-sm text-destructive mt-1">{errors.url.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                HTTP Method <span className="text-destructive">*</span>
              </label>
              <select
                {...register('method')}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              {errors.method && (
                <p className="text-sm text-destructive mt-1">{errors.method.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <span className="flex-shrink-0">✕</span>
            {error}
          </div>
        )}

        {/* Validation Results */}
        {verifyResponse && (
          <div className="space-y-4">
            {/* URL display with change option */}
            <div className="flex items-center gap-2 text-sm">
              <code className="flex-1 px-2 py-1 bg-muted rounded text-xs font-mono truncate">
                {url}
              </code>
              <button
                onClick={() => setVerifyResponse(null)}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Change
              </button>
            </div>

            {/* Detailed validation results (uses existing component) */}
            <VerifyResultDetails verifyResponse={verifyResponse} url={url} />
          </div>
        )}
      </form>
    </WizardShell>
  )
}
```

**Source:** Combined patterns from RegisterResourceModal.tsx, Phase 19 WizardShell, VerifyResultDetails component

### Pre-fill Details Step with Locked Fields
```typescript
// app/dashboard/resources/new/details/page.tsx modifications for pre-fill
'use client'

import { useForm } from 'react-hook-form'
import { getDraft } from '@/lib/wizard-draft'

export default function DetailsPage() {
  const draft = getDraft()
  const isPreFilled = draft?.preFilled || {}

  const { register, watch, setValue } = useForm({
    defaultValues: {
      network: draft?.network || 'base',
      price: draft?.price || '',
      // ... other fields
    },
  })

  return (
    <form>
      {/* Network - locked if pre-filled from validation */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Network <span className="text-destructive">*</span>
          {isPreFilled.network && (
            <span className="text-xs text-muted-foreground ml-2">
              (Detected from endpoint)
            </span>
          )}
        </label>
        <Select
          {...register('network')}
          value={watch('network')}
          onChange={(value) => !isPreFilled.network && setValue('network', value)}
          disabled={isPreFilled.network}
          options={getAllNetworks().map(n => ({ value: n.id, label: n.name }))}
        />
      </div>

      {/* Price - locked if pre-filled from validation */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Price (USDC) <span className="text-destructive">*</span>
          {isPreFilled.price && (
            <span className="text-xs text-muted-foreground ml-2">
              (Detected from endpoint)
            </span>
          )}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            {...register('price')}
            type="text"
            inputMode="decimal"
            placeholder="0.01"
            className="pl-7"
            disabled={isPreFilled.price}
            readOnly={isPreFilled.price}
          />
        </div>
      </div>
    </form>
  )
}
```

**Source:** Phase 20 details step patterns, user decision on locked pre-filled fields (CONTEXT.md lines 23-24)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom x402 validation logic | x402check package | 2024-2025 | Centralized validation, registry lookups, reduced bugs |
| Validation in backend only | Backend + client-side display | x402check v0.2.0 (2025) | Rich error/warning display, better UX |
| Flat error messages | Structured CheckResult with errors/warnings/summary | x402check v0.2.0 (2025) | Actionable errors with fixes, expandable details |
| All sections expanded by default | Verdict banner + collapsed details | Modern UX pattern (2024-2025) | Reduces overwhelm, progressive disclosure |
| CAIP-2 only | CAIP-2 + simple name mapping | x402check registries (2025) | User-friendly network names while maintaining standards |
| Immediate validation on blur | Explicit validate button | User control pattern (2024-2025) | User controls when API calls happen, clearer intent |
| Network as string | CAIP-2 standard with registry lookups | x402check registries (2025) | Accurate network/asset metadata, no hardcoding |

**Deprecated/outdated:**
- Custom x402 config parsing: Use x402check.check() unified API instead
- Hardcoded network names: Use x402check KNOWN_NETWORKS registry
- Manual decimal conversion: Use CheckResult.summary.assetDecimals from registry
- Separate extraction and validation steps: x402check.check() does both in one call
- Per-resource validation logic: processVerifyResponse handles all validation centrally

## Open Questions

Things that couldn't be fully resolved:

1. **HTTP method impact on validation**
   - What we know: Backend /api/v1/resources/verify accepts URL, may use method for actual HTTP request
   - What's unclear: Does x402check care about HTTP method? Does backend pass it through?
   - Recommendation: Include method in form, pass to backend. Backend may use it to make actual HTTP request to endpoint. If backend ignores it, no harm done.

2. **Partial detection handling (if x402check can't detect network or amount)**
   - What we know: User decision says "x402check is source of truth, if it can't detect something that's an x402check bug"
   - What's unclear: Should we handle partial detection gracefully or block?
   - Recommendation: Trust user decision. If CheckResult.summary[0] is missing or incomplete, treat as validation failure (invalid endpoint). Don't try to handle partial detection.

3. **Multiple accept options (v2 endpoints with multiple payment networks)**
   - What we know: CheckResult.summary is array, may have multiple entries for multi-network endpoints
   - What's unclear: Should Link Existing support multi-network endpoints (create multiple resources)?
   - Recommendation: For simplicity, only use summary[0] (first accept option). If user wants multi-network, they can validate endpoint twice with different selections. Defer multi-network support to later phase.

4. **Validation timeout duration**
   - What we know: Some x402 endpoints may be slow to respond (CORS preflight, cold starts, etc.)
   - What's unclear: What's reasonable timeout? 5s? 10s? 30s?
   - Recommendation: Let browser fetch() default timeout handle it (typically 30s-60s). If becomes issue, add explicit timeout with better error message ("Endpoint took too long to respond").

5. **Change URL vs re-validate flow**
   - What we know: RegisterResourceModal has "Change" button that clears results
   - What's unclear: Should we hide URL input after validation, or keep it visible with disabled state?
   - Recommendation: Keep URL visible with "Change" button like RegisterResourceModal. Clearer than hiding input entirely, matches existing UX.

## Sources

### Primary (HIGH confidence)
- Project codebase: VerifyResultDetails.tsx - Complete CheckResult display implementation (lines 1-350)
- Project codebase: x402-verify.ts - processVerifyResponse, types, CheckResult handling (lines 1-326)
- Project codebase: RegisterResourceModal.tsx - Validation flow, error handling, state management (lines 1-633)
- Project codebase: networks.ts - normalizeNetworkId, CAIP-2 mapping
- [x402check package v0.2.0 TypeScript definitions](https://www.npmjs.com/package/x402check) - CheckResult structure, ValidationIssue, AcceptSummary types
- [x402check.com](https://www.x402check.com) - Official validation tool, design language reference
- Phase 21 CONTEXT.md - User decisions on results display, pre-fill behavior, locked fields

### Secondary (MEDIUM confidence)
- [React Hook Form Async Validation with Zod 2026](https://blog.benorloff.co/async-form-validation-with-zod-react-hook-form) - Async validation patterns
- [React Hook Form useForm API](https://react-hook-form.com/docs/useform) - Official documentation for validation modes
- [React loading button best practices 2026](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/) - Loading states, spinners, error display
- [React Bootstrap Accordion](https://react-bootstrap.netlify.app/docs/components/accordion/) - Collapsible sections default closed pattern
- [HTTP Methods MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) - Standard HTTP method semantics

### Tertiary (LOW confidence)
- [React Hook Form discussions on async validation](https://github.com/orgs/react-hook-form/discussions/9005) - Community patterns
- [Form re-validation patterns](https://www.nngroup.com/articles/errors-forms-design-guidelines/) - UX guidelines for error clearing
- [React collapsible components](https://www.npmjs.com/package/react-collapsible) - Alternative implementations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - x402check installed, VerifyResultDetails exists, all components verified in codebase
- Architecture: HIGH - Patterns extracted from RegisterResourceModal.tsx production code, Phase 19/20 wizard patterns verified
- Pitfalls: HIGH - Based on existing RegisterResourceModal edge cases, x402check CheckResult structure, network normalization issues
- Code examples: HIGH - Adapted from working RegisterResourceModal code, existing VerifyResultDetails component

**Research date:** 2026-01-31
**Valid until:** 2026-03-02 (30 days - stable libraries, x402check API stable)
