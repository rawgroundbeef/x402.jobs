# Phase 6: Refund Badge Display - Research

**Researched:** 2026-01-21
**Domain:** UI/UX Badge Display, OpenFacilitator Brand Integration
**Confidence:** HIGH

## Summary

This phase adds the official OpenFacilitator "Refund Protected" badge to resource displays when `supportsRefunds: true` is present in the x402 response data. The research identified clear patterns for badge display in both the ResourceDetailPage and ResourceCard components.

The codebase already has established badge patterns (A2A badge, network badge, verified badge) that provide a template for implementation. The official OpenFacilitator badge assets are hosted at openfacilitator.io/badges/ and can be used directly via external URL or downloaded to the public folder.

**Primary recommendation:** Download the official OpenFacilitator badge SVGs to `/public/badges/` for reliable loading and theme support, then create a `RefundProtectedBadge` component that conditionally renders based on `supportsRefunds` field.

## Standard Stack

The implementation uses existing codebase patterns and tools:

### Core

| Library       | Version | Purpose                  | Why Standard            |
| ------------- | ------- | ------------------------ | ----------------------- |
| React         | 18+     | Component rendering      | Existing stack          |
| Next.js Image | 15.x    | SVG/image optimization   | Better loading          |
| Tailwind CSS  | 3.x     | Badge styling            | Matches existing badges |
| lucide-react  | 0.x     | Fallback icons if needed | Already in use          |

### Supporting

| Library    | Version | Purpose             | When to Use           |
| ---------- | ------- | ------------------- | --------------------- |
| next/image | 15.x    | Image optimization  | For badge SVG loading |
| clsx/cn    | N/A     | Conditional classes | Theme-aware styling   |

### Alternatives Considered

| Instead of             | Could Use                         | Tradeoff                                         |
| ---------------------- | --------------------------------- | ------------------------------------------------ |
| Local SVG files        | External URL (openfacilitator.io) | External has latency/reliability concerns        |
| Custom badge component | Embed script from OpenFacilitator | Script adds complexity, less control             |
| Inline SVG             | Image tag                         | Image tag is simpler, works with official assets |

**Installation:**
No new packages needed - all required dependencies exist.

## Architecture Patterns

### Badge Asset Organization

```
public/
└── badges/
    ├── refund-protected.svg        # Standard theme (blue bg)
    ├── refund-protected-dark.svg   # Dark theme (white bg)
    └── shield-icon.svg             # Minimal icon version
```

### Pattern 1: Conditional Badge Rendering

**What:** Render badge only when `supportsRefunds: true` exists in resource data
**When to use:** All resource display contexts (detail page, cards, lists)
**Example:**

```typescript
// Source: Existing A2A badge pattern in ResourceDetailPage.tsx:939-945
{resource.supports_refunds && (
  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
    <img src="/badges/refund-protected.svg" alt="" className="h-4" />
    Refund Protected
  </span>
)}
```

### Pattern 2: Theme-Aware Badge Component

**What:** Single component that handles light/dark theme switching
**When to use:** When official badge needs to adapt to site theme
**Example:**

```typescript
// Component that switches between badge variants based on theme
export function RefundProtectedBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const sizeMap = { sm: "h-6", md: "h-8", lg: "h-10" };

  return (
    <img
      src={isDark ? "/badges/refund-protected-dark.svg" : "/badges/refund-protected.svg"}
      alt="Refund Protected"
      className={sizeMap[size]}
    />
  );
}
```

### Pattern 3: Badge in Stats Row (ResourceDetailPage)

**What:** Add badge inline with existing stats (success rate, call count, price, network)
**When to use:** Resource detail page header section
**Example:**

```typescript
// Source: ResourceDetailPage.tsx:904-948 stats section pattern
<p className="text-sm text-muted-foreground">
  {/* Existing: Success Rate, Calls, Price, Network */}
  {resource.supports_refunds && (
    <>
      <span className="mx-2">•</span>
      <span className="inline-flex items-center">
        <RefundProtectedBadge size="sm" />
      </span>
    </>
  )}
</p>
```

### Pattern 4: Badge in ResourceCard Actions

**What:** Add badge to the actions row in ResourceCard
**When to use:** Resource cards in lists and discovery
**Example:**

```typescript
// Source: ResourceCard.tsx:191-199 (A2A badge pattern)
{/* Actions row */}
<div className="flex items-center gap-1.5 flex-shrink-0">
  {resource.supports_refunds && (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20"
      title="OpenFacilitator Refund Protected"
    >
      <img src="/badges/shield-icon.svg" alt="" className="h-3 w-3 mr-0.5" />
      Refund
    </span>
  )}
  {/* Existing: A2A badge, Network badge, Price pill */}
</div>
```

### Anti-Patterns to Avoid

- **Using badge without refund support:** Only show when `supportsRefunds: true` - never for assumed/default values
- **Modifying official badge colors:** Use official assets as-is, only apply sizing
- **Sizes below 24px height:** Minimum badge height per brand guidelines is 24px
- **Busy background placement:** Badge needs clear space around it

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem            | Don't Build   | Use Instead                    | Why                        |
| ------------------ | ------------- | ------------------------------ | -------------------------- |
| Shield icon        | Custom SVG    | Official shield-icon.svg       | Brand compliance           |
| Blue color         | Custom hex    | #0B64F4 from brand             | Exact match required       |
| Theme switching    | Manual toggle | useTheme() hook + variants     | Already exists in codebase |
| Badge hover states | Custom CSS    | Existing badge pattern classes | Consistency                |

**Key insight:** The official badge assets exist and should be used as-is. The codebase already has badge patterns that handle theming and sizing - leverage these.

## Common Pitfalls

### Pitfall 1: Assuming supportsRefunds Field Exists

**What goes wrong:** Rendering badge when field is undefined/null instead of explicitly true
**Why it happens:** JavaScript truthiness - `undefined` is falsy but different from `false`
**How to avoid:** Explicit check: `resource.supports_refunds === true`
**Warning signs:** Badge appearing on resources without refund support

### Pitfall 2: Breaking Badge on Dark Theme

**What goes wrong:** Blue badge on blue background (standard badge), or poor contrast
**Why it happens:** Not accounting for theme in badge variant selection
**How to avoid:** Use theme-aware component that swaps badge variants
**Warning signs:** Badge invisible or unreadable in dark mode

### Pitfall 3: Badge Too Small on Mobile

**What goes wrong:** Badge becomes unreadable on small screens
**Why it happens:** Fixed pixel sizes without responsive consideration
**How to avoid:** Minimum 24px height per brand guidelines, test on mobile
**Warning signs:** Users cannot identify badge on phones

### Pitfall 4: Data Not Available in ResourceCard

**What goes wrong:** `supports_refunds` field not present in card data
**Why it happens:** API endpoint for lists may not include this field
**How to avoid:** Verify field is returned by `/api/v1/resources` endpoint
**Warning signs:** Badge never appears in lists even for refund-enabled resources

### Pitfall 5: External Asset Loading Issues

**What goes wrong:** Badge doesn't load or loads slowly
**Why it happens:** Relying on external openfacilitator.io URLs
**How to avoid:** Download official assets to `/public/badges/`
**Warning signs:** Flash of empty space where badge should be

## Code Examples

Verified patterns from the existing codebase:

### A2A Badge in ResourceDetailPage (Reference Pattern)

```typescript
// Source: /src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx:939-945
{resource.is_a2a && (
  <>
    <span className="mx-2">•</span>
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
      A2A
    </span>
  </>
)}
```

### A2A Badge in ResourceCard (Reference Pattern)

```typescript
// Source: /src/components/ResourceCard/ResourceCard.tsx:191-199
{resource.is_a2a && (
  <span
    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20"
    title="Agent-to-Agent Protocol"
  >
    A2A
  </span>
)}
```

### ResourceData Interface (Where to Add Field)

```typescript
// Source: /src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx:62-105
interface ResourceData {
  // ... existing fields
  is_a2a?: boolean;
  // ADD: supports_refunds field
  supports_refunds?: boolean;
}
```

### ResourceCardData Interface (Where to Add Field)

```typescript
// Source: /src/components/ResourceCard/ResourceCard.tsx:19-36
export interface ResourceCardData {
  // ... existing fields
  is_a2a?: boolean;
  // ADD: supports_refunds field
  supports_refunds?: boolean;
}
```

### Official Badge Colors (Brand Compliance)

```css
/* From OpenFacilitator brand guidelines */
--refund-badge-blue: #0b64f4; /* Primary badge background */
--refund-badge-white: #ffffff; /* Text/icon color */
--refund-badge-dark: #0f172a; /* Dark theme text */
```

## OpenFacilitator Badge Specifications

### Official Assets

| Asset          | URL                                                 | Size        | Use Case         |
| -------------- | --------------------------------------------------- | ----------- | ---------------- |
| Standard Badge | openfacilitator.io/badges/refund-protected.svg      | 44px height | Default display  |
| Small Badge    | openfacilitator.io/badges/refund-protected-sm.svg   | 32px height | Compact contexts |
| Large Badge    | openfacilitator.io/badges/refund-protected-lg.svg   | 56px height | Hero/featured    |
| Dark Badge     | openfacilitator.io/badges/refund-protected-dark.svg | 44px height | Dark backgrounds |
| Shield Icon    | openfacilitator.io/badges/shield-icon.svg           | 36x36       | Minimal/inline   |

### Brand Colors

- **Primary Blue:** #0B64F4 (hsl(217, 91%, 50%))
- **White:** #FFFFFF
- **Dark:** #0F172A

### Usage Rules

- Minimum height: 24px
- Only display when refund protection is actually enabled
- Use dark variant on dark backgrounds
- Maintain clear space around badge
- Do not modify colors or proportions

## State of the Art

| Old Approach                 | Current Approach                | When Changed      | Impact                            |
| ---------------------------- | ------------------------------- | ----------------- | --------------------------------- |
| Text-only "Supports Refunds" | Official badge SVG              | N/A (new feature) | Brand compliance                  |
| Custom icon design           | Official OpenFacilitator assets | N/A               | Consistency across x402 ecosystem |

**Current best practice:** Use official OpenFacilitator badge assets for brand consistency across the x402 ecosystem. This aligns with how other protocols (Stripe Verified, PayPal Verified) handle trust badges.

## Open Questions

Things that couldn't be fully resolved:

1. **Where does supportsRefunds come from?**
   - What we know: It comes from the x402 response when querying a resource
   - What's unclear: Is this field already being fetched/stored, or does it need to be added to the API response?
   - Recommendation: Check the x402jobs API codebase to verify field availability, add if missing

2. **List page API inclusion**
   - What we know: ResourceDetailPage fetches individual resource data
   - What's unclear: Does `/api/v1/resources` (list endpoint) include `supports_refunds`?
   - Recommendation: Verify and update API if needed

3. **Theme detection reliability**
   - What we know: Codebase uses ThemeProvider with next-themes
   - What's unclear: How reliably can we detect theme at render time?
   - Recommendation: Test with both themes, use CSS media query fallback if needed

## Sources

### Primary (HIGH confidence)

- OpenFacilitator Brand Page (https://www.openfacilitator.io/brand) - Badge specs, colors, assets
- ResourceDetailPage.tsx - Existing badge patterns (lines 939-945, 982-989)
- ResourceCard.tsx - Card badge patterns (lines 191-199)

### Secondary (MEDIUM confidence)

- OpenFacilitator badge URLs verified via WebFetch - Assets are accessible
- Codebase A2A badge patterns - Established styling conventions

### Tertiary (LOW confidence)

- API field availability - Needs verification in API codebase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using existing codebase patterns
- Architecture: HIGH - Clear patterns from A2A badge implementation
- Pitfalls: MEDIUM - Some unknowns around API data availability
- Badge specs: HIGH - Official OpenFacilitator documentation

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable feature, official brand guidelines)
