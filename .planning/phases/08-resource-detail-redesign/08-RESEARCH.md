# Phase 8: Resource Detail Page Redesign - Research

**Researched:** 2026-01-21
**Domain:** React/Next.js page layout, UX patterns, Tailwind CSS
**Confidence:** HIGH

## Summary

This phase involves reorganizing the existing ResourceDetailPage component (~1660 lines) to improve information hierarchy, visual grouping, and CTA prominence. The codebase already has all necessary UI primitives - the work is purely about restructuring existing patterns, not introducing new libraries.

Key findings:

- The existing codebase has established patterns for dropdown menus (`@repo/ui/dropdown`), cards (`@repo/ui/card`), and warning icons (`AlertTriangle`, `AlertCircle` from lucide-react)
- The `format.ts` file already has `getSuccessRateDisplay()` and `getSuccessRateColor()` utilities that can be enhanced for the new warning tiers
- The project uses Tailwind CSS with CSS variables for theming; warning colors should follow established patterns (yellow-500/600, red-500/600)

**Primary recommendation:** Restructure the existing ResourceDetailPage.tsx using established codebase patterns (Dropdown for owner menu, Card for action zone, enhanced success rate display with tiered warnings).

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library      | Version   | Purpose                                             | Why Standard                     |
| ------------ | --------- | --------------------------------------------------- | -------------------------------- |
| @repo/ui     | internal  | Shared UI components (Button, Card, Dropdown, etc.) | Monorepo shared components       |
| lucide-react | installed | Icons (AlertTriangle, MoreVertical, etc.)           | Already used throughout codebase |
| tailwindcss  | installed | Styling with CSS classes                            | Project standard                 |

### Supporting

| Library                  | Version | Purpose            | When to Use              |
| ------------------------ | ------- | ------------------ | ------------------------ |
| cn (from @repo/ui/utils) | -       | Class name merging | Conditional styling      |
| @repo/ui/tooltip         | -       | Hover tooltips     | Refund badge explanation |

### Alternatives Considered

| Instead of          | Could Use          | Tradeoff                                |
| ------------------- | ------------------ | --------------------------------------- |
| Custom dropdown     | Radix DropdownMenu | Codebase already uses @repo/ui/dropdown |
| Custom card styling | shadcn Card        | @repo/ui/card is the project standard   |

**Installation:**
No new packages needed - all required components exist in the codebase.

## Architecture Patterns

### Recommended Component Structure

```
ResourceDetailPage.tsx (refactored)
├── Header Section (Title, URL, Owner dropdown)
├── Description Section
├── ActionZone (new container)
│   ├── StatsBar
│   ├── CTAs (Run, Use in Job)
│   └── RefundNote (inline)
├── Tabs (Overview, API, Activity)
└── RelatedJobs
```

### Pattern 1: Owner Actions Three-Dot Dropdown

**What:** Top-right positioned dropdown menu for Edit/Delete actions
**When to use:** When user is owner/admin
**Example:**

```typescript
// Source: src/components/pages/AccountJobsPage/components/JobCard.tsx
import { Dropdown, DropdownItem, DropdownDivider } from "@repo/ui/dropdown";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

{canEdit && (
  <Dropdown
    trigger={
      <Button variant="ghost" size="sm">
        <MoreVertical className="h-4 w-4" />
      </Button>
    }
    placement="bottom-end"
  >
    <DropdownItem onClick={() => setShowEditModal(true)}>
      <span className="flex items-center gap-2">
        <Pencil className="h-4 w-4" />
        Edit
      </span>
    </DropdownItem>
    <DropdownDivider />
    <DropdownItem onClick={handleDelete} className="text-destructive">
      <span className="flex items-center gap-2">
        <Trash2 className="h-4 w-4" />
        Delete
      </span>
    </DropdownItem>
  </Dropdown>
)}
```

### Pattern 2: Action Zone Card

**What:** Subtle card containing stats, CTAs, and trust signals
**When to use:** When grouping decision-related elements
**Example:**

```typescript
// Based on existing Card usage in codebase
<Card className="p-6 bg-muted/30 border-border/50">
  {/* Stats Bar */}
  <div className="flex items-center gap-4 text-sm mb-4">
    {/* Success rate with warning */}
    {/* Total runs */}
    {/* Network */}
  </div>

  {/* CTAs */}
  <div className="flex gap-2 mb-3">
    <Button variant="outline">Use in Job</Button>
    <Button>Run ({price})</Button>
  </div>

  {/* Refund note */}
  <p className="text-xs text-muted-foreground">
    {/* Merged refund + attribution */}
  </p>
</Card>
```

### Pattern 3: Tiered Warning Display

**What:** Color + icon indicators for success rate tiers
**When to use:** Displaying success rate with contextual warnings
**Example:**

```typescript
// Enhanced from existing getSuccessRateColor in format.ts
function getSuccessRateTier(rate: number): {
  color: string;
  icon: React.ReactNode | null;
  bgColor: string;
} {
  if (rate <= 50) {
    return {
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
      icon: <AlertTriangle className="w-3.5 h-3.5" />
    };
  }
  if (rate <= 80) {
    return {
      color: "text-yellow-600 dark:text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: <AlertTriangle className="w-3.5 h-3.5" />
    };
  }
  return {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "",
    icon: null
  };
}
```

### Anti-Patterns to Avoid

- **Separate Edit/Delete buttons:** Use dropdown menu pattern for owner actions
- **Multiple price displays:** Price should only appear in Run CTA button
- **Heavy borders for grouping:** Use whitespace as primary separator; subtle card for action zone only
- **Refund badge in header:** Keep near CTAs where it serves as trust signal at decision point

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem            | Don't Build                           | Use Instead                                            | Why                                                |
| ------------------ | ------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Dropdown menu      | Custom menu with absolute positioning | `@repo/ui/dropdown`                                    | Handles accessibility, keyboard nav, click-outside |
| Icon choices       | Random lucide icons                   | `AlertTriangle` for warnings, `MoreVertical` for menus | Consistency with codebase patterns                 |
| Success rate logic | New calculation                       | Enhance `getSuccessRateDisplay()` in format.ts         | Centralized, tested, reusable                      |
| Tooltip for refund | Inline explanation                    | `@repo/ui/tooltip`                                     | Consistent tooltip behavior                        |

**Key insight:** This redesign is restructuring, not building new. Use existing components; enhance existing utilities.

## Common Pitfalls

### Pitfall 1: Breaking Mobile Responsiveness

**What goes wrong:** Desktop-focused layout breaks on mobile
**Why it happens:** Stats bar with multiple items can overflow; dropdown positioning issues
**How to avoid:**

- Use `flex-wrap` on stats bar
- Test dropdown placement on mobile (use `placement="bottom-end"`)
- Ensure action zone card has responsive padding
  **Warning signs:** Stats items overlapping, dropdown cut off on small screens

### Pitfall 2: Color-Only Accessibility Failures

**What goes wrong:** Colorblind users miss warning states
**Why it happens:** Relying only on red/yellow color for warnings
**How to avoid:**

- Always pair color with icon (AlertTriangle)
- Include text description ("0% success (13 calls)")
  **Warning signs:** 8% of male users (~4% overall) may miss color-only signals

### Pitfall 3: Inconsistent Button Hierarchy

**What goes wrong:** Primary/secondary actions visually confused
**Why it happens:** Both buttons styled the same
**How to avoid:**

- Run button: default Button (filled)
- Use in Job button: `variant="outline"`
  **Warning signs:** Users clicking "Use in Job" when they meant "Run"

### Pitfall 4: Owner Menu Visibility to Non-Owners

**What goes wrong:** Edit/Delete options shown to all users
**Why it happens:** Missing `canEdit` guard
**How to avoid:**

- Wrap owner dropdown in `{canEdit && ...}`
- Keep existing ownership check logic
  **Warning signs:** Non-owners see three-dot menu

### Pitfall 5: Lost Form State on Layout Change

**What goes wrong:** User input cleared when refactoring
**Why it happens:** Component restructuring changes key hierarchy
**How to avoid:**

- Keep form state hooks at same level
- Preserve existing `formData`, `fieldErrors` state management
  **Warning signs:** Form resets unexpectedly

## Code Examples

Verified patterns from the codebase:

### Stats Bar with Warning Icon

```typescript
// Source: Adapted from existing ResourceDetailPage and SuccessRateWarning patterns
import { AlertTriangle } from "lucide-react";
import { ChainIcon } from "@/components/icons/ChainIcons";

// Stats bar example matching CONTEXT.md specification
<div className="flex items-center gap-4 text-sm text-muted-foreground">
  {/* Success rate with warning */}
  {successRateInfo.rate <= 50 ? (
    <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
      <AlertTriangle className="w-3.5 h-3.5" />
      {successRateInfo.text} success ({totalCalls} calls)
    </span>
  ) : successRateInfo.rate <= 80 ? (
    <span className="inline-flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500 font-medium">
      <AlertTriangle className="w-3.5 h-3.5" />
      {successRateInfo.text} success ({totalCalls} calls)
    </span>
  ) : (
    <span className="font-medium">
      {successRateInfo.text} success ({totalCalls} calls)
    </span>
  )}

  <span className="text-muted-foreground/50">|</span>

  {/* Network */}
  <span className="inline-flex items-center gap-1">
    <ChainIcon network={resource.network} className="h-3.5 w-3.5" />
    {networkName}
  </span>
</div>
```

### CTA Buttons with Price in Run

```typescript
// Source: Adapted from existing ResourceDetailPage button patterns
<div className="flex gap-2">
  <Button
    variant="outline"
    onClick={handleCreateJob}
    disabled={isCreatingJob || !user}
  >
    {isCreatingJob ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Creating...
      </>
    ) : (
      "Use in Job"
    )}
  </Button>

  <Button
    onClick={handleSubmit}
    disabled={isSubmitting || !user}
  >
    {isSubmitting ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Running...
      </>
    ) : !user ? (
      "Login to Run"
    ) : (
      `Run (${priceDisplay})`  // Price only here, not elsewhere
    )}
  </Button>
</div>
```

### Merged Refund + Attribution Line

```typescript
// Source: Based on existing refund badge pattern
import { Tooltip } from "@repo/ui/tooltip";

<p className="text-xs text-muted-foreground flex items-center gap-1.5">
  <img src="/badges/shield-icon.svg" alt="" className="h-4 w-4" />
  <Tooltip content={
    <>Refunds provided by <a href="https://openfacilitator.io" target="_blank" rel="noopener noreferrer" className="underline">OpenFacilitator.io</a>. If the request fails, you'll be automatically refunded.</>
  }>
    <span className="cursor-help underline decoration-dotted">
      Refund Protected
    </span>
  </Tooltip>
  {" "}via{" "}
  <a
    href="https://openfacilitator.io"
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
  >
    OpenFacilitator
  </a>
</p>
```

### Header with Owner Dropdown

```typescript
// Source: Combining existing patterns from ResourceDetailPage and JobCard
<div className="flex items-start justify-between">
  <div className="flex-1">
    <h1 className="text-2xl md:text-3xl font-bold font-mono mb-2">
      {/* Name with server link */}
    </h1>
    {/* API URL */}
    {/* Description */}
  </div>

  {/* Owner dropdown - top right */}
  {canEdit && (
    <Dropdown
      trigger={
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      }
      placement="bottom-end"
    >
      <DropdownItem onClick={() => setShowEditModal(true)}>
        <span className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Edit
        </span>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={handleDeleteClick} className="text-destructive">
        <span className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Delete
        </span>
      </DropdownItem>
    </Dropdown>
  )}
</div>
```

## State of the Art

| Old Approach                     | Current Approach               | When Changed  | Impact                                                    |
| -------------------------------- | ------------------------------ | ------------- | --------------------------------------------------------- |
| Edit/Delete as separate buttons  | Three-dot dropdown menu        | 2024+         | Cleaner UI, established pattern (YouTube, GitHub, Notion) |
| Price shown in multiple places   | Price only in CTA button       | This redesign | Reduces redundancy, clearer decision point                |
| Refund badge prominent in header | Inline near CTAs               | This redesign | Trust signal at decision moment                           |
| Color-only warning states        | Color + icon for accessibility | Best practice | WCAG compliance, colorblind accessibility                 |

**Deprecated/outdated:**

- Separate "Powered by OpenFacilitator" text: Merge with refund badge
- Individual stats cards for each metric: Use single horizontal stats bar
- Owner actions in header row: Move to dropdown menu

## Open Questions

Things that couldn't be fully resolved:

1. **Exact warning thresholds**
   - What we know: CONTEXT.md specifies 0-50% (red), 51-80% (yellow/amber), 81%+ (green/neutral)
   - What's unclear: Should 100% (new resources with no data) show special "New" badge or neutral?
   - Recommendation: Keep existing "New" badge behavior from `getSuccessRateDisplay()` for resources with no runs

2. **Mobile stats bar layout**
   - What we know: Desktop is horizontal row with items separated by pipes/dots
   - What's unclear: Should mobile stack items vertically or keep horizontal with wrap?
   - Recommendation: Use `flex-wrap` for mobile, test both approaches

3. **Owner-only earnings in stats**
   - What we know: CONTEXT.md says owners see Earnings (replaces price in stats since price is in CTA)
   - What's unclear: How prominently to display earnings - inline in stats bar or separate element?
   - Recommendation: Add earnings after network in stats bar for owners only, style as green pill

## Sources

### Primary (HIGH confidence)

- `/src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx` - Current implementation (~1660 lines)
- `/src/components/pages/AccountJobsPage/components/JobCard.tsx` - Dropdown menu pattern (lines 417-507)
- `/src/lib/format.ts` - Success rate utilities (lines 199-242)
- `/src/components/SuccessRateWarning/SuccessRateWarning.tsx` - Warning display patterns

### Secondary (MEDIUM confidence)

- [Lucide React Icons](https://lucide.dev/icons/triangle-alert) - AlertTriangle, MoreVertical icons
- [UX Best Practices for CTA Placement](https://vwo.com/blog/ecommerce-product-page-design/) - Stats before CTAs pattern
- [Zoho CTA Best Practices](https://www.zoho.com/academy/website-building/cta-buttons/best-practices-for-cta-placement.html) - Price near CTA button

### Tertiary (LOW confidence)

- General UX research on information hierarchy (validates stats-before-action pattern)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All components exist in codebase, verified through file inspection
- Architecture: HIGH - Patterns directly from codebase (JobCard dropdown, ServerDetailPage layout)
- Pitfalls: MEDIUM - Based on common React patterns and accessibility guidelines
- Code examples: HIGH - Adapted from verified codebase patterns

**Research date:** 2026-01-21
**Valid until:** Indefinite (refactoring existing codebase, no external dependencies)
