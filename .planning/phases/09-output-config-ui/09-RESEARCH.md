# Phase 9: Output Config UI + Data Model - Research

**Researched:** 2026-01-25
**Domain:** React UI, TypeScript types, x402 storage integration patterns
**Confidence:** HIGH

## Summary

Phase 9 adds x402.storage as a fourth output destination in the existing OutputConfigPanel. The implementation follows established patterns already present in the codebase for Telegram and X destinations.

The primary work involves:

1. Extending the OutputDestination type to include "x402storage"
2. Adding a checkbox UI element following the existing destination pattern
3. Integrating storage fee ($0.01) into the job price calculation via useJobPrice hook
4. Implementing wallet balance check to disable option when insufficient

**Primary recommendation:** Follow the exact UI and code patterns used for Telegram/X destinations. The existing OutputConfigPanel structure makes adding a fourth destination straightforward - it's essentially copying an existing checkbox block with x402storage-specific text and icon.

## Standard Stack

The phase uses existing libraries already in the codebase - no new dependencies required.

### Core

| Library      | Version  | Purpose                         | Why Standard                        |
| ------------ | -------- | ------------------------------- | ----------------------------------- |
| React        | 18.x     | UI components                   | Already in use                      |
| TypeScript   | 5.x      | Type definitions                | Already in use                      |
| lucide-react | 0.x      | Icons (Globe, Link)             | Already used for other destinations |
| @repo/ui     | internal | Button, Input, Label components | Already in use                      |

### Supporting

| Library | Version | Purpose                                 | When to Use      |
| ------- | ------- | --------------------------------------- | ---------------- |
| useSWR  | 2.x     | Wallet data fetching via useWallet hook | Balance checking |

### Alternatives Considered

| Instead of | Could Use               | Tradeoff                                              |
| ---------- | ----------------------- | ----------------------------------------------------- |
| Globe icon | Archive, Box, HardDrive | Globe suggests "permanent/global" better than archive |
| Link icon  | ExternalLink            | Link is simpler, ExternalLink implies navigation away |

**Installation:**

```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── types/
│   └── output-config.ts       # Extend OutputDestination type
├── components/
│   └── panels/
│       └── OutputConfigPanel.tsx  # Add fourth checkbox
├── lib/
│   └── format.ts              # formatPrice already handles $0.01
└── hooks/
    └── useWallet.ts           # Already provides balance checking
```

### Pattern 1: OutputDestination Type Extension

**What:** Add "x402storage" to the OutputDestination type union
**When to use:** When extending supported destination types
**Example:**

```typescript
// Source: src/types/output-config.ts
export interface OutputDestination {
  type: "app" | "telegram" | "x" | "x402storage"; // Add x402storage
  enabled: boolean;
  config?: {
    chatId?: string;
    imageField?: string;
    captionField?: string;
    // No additional config needed for x402storage - it's a simple on/off
  };
}
```

### Pattern 2: Checkbox Destination Block (Existing Pattern)

**What:** Each destination is a clickable card with checkbox icon, title, sublabel
**When to use:** For all destination options
**Example:**

```typescript
// Source: src/components/panels/OutputConfigPanel.tsx (Telegram pattern)
<div className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
  !hasRequirement
    ? "border-border/50 opacity-60"
    : isDestinationEnabled("x402storage")
      ? "border-output bg-output/5"
      : "border-border hover:border-output/50"
}`}>
  <button
    onClick={() => hasRequirement && toggleDestination("x402storage")}
    disabled={!hasRequirement}
    className="flex items-start gap-3 flex-1"
  >
    {/* Checkbox icon */}
    {isDestinationEnabled("x402storage") && hasRequirement ? (
      <CheckSquare className="h-5 w-5 text-output shrink-0 mt-0.5" />
    ) : (
      <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
    )}
    <div className="flex-1 text-left">
      {/* Title with icon */}
      <div className="flex items-center gap-2 mb-1">
        <Globe className="h-4 w-4 text-emerald-500" />
        <span className="font-medium">x402.storage</span>
        {!hasRequirement && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            Low balance
          </span>
        )}
      </div>
      {/* Sublabel */}
      <p className="text-xs text-muted-foreground">
        +$0.01 · Permanent link
      </p>
    </div>
  </button>
</div>
```

### Pattern 3: Price Calculation with useJobPrice

**What:** Job price calculation in useJobPrice hook sums resource prices + platform fee
**When to use:** When extending job price to include storage
**Example:**

```typescript
// Source: src/components/pages/JobCanvas/lib/useJobPrice.ts
// Current: total = resourcesPrice + PLATFORM_FEE
// Updated: total = resourcesPrice + PLATFORM_FEE + storageFee

const PLATFORM_FEE = 0.05;
const STORAGE_FEE = 0.01;

// Check if any output node has x402storage enabled
const hasStorageEnabled = nodes
  .filter((n) => n.type === "output")
  .some((n) => {
    const config = (n.data as { outputConfig?: OutputConfig })?.outputConfig;
    return config?.destinations?.some(
      (d) => d.type === "x402storage" && d.enabled,
    );
  });

return {
  total: resourcesPrice + PLATFORM_FEE + (hasStorageEnabled ? STORAGE_FEE : 0),
  resourcesPrice,
  platformFee: PLATFORM_FEE,
  storageFee: hasStorageEnabled ? STORAGE_FEE : 0,
};
```

### Pattern 4: Balance Check for Disabling Options

**What:** Check wallet balance against required amount to disable UI
**When to use:** When feature requires minimum balance
**Example:**

```typescript
// Source: src/components/panels/RunWorkflowPanel.tsx (existing pattern)
import { useWallet } from "@/hooks/useWallet";

const { wallet } = useWallet();
const userBalance = wallet?.totalBalanceUsdc || 0;

// For storage, need at least $0.01
const hasStorageBalance = userBalance >= 0.01;

// In UI
<button disabled={!hasStorageBalance}>
```

### Anti-Patterns to Avoid

- **Don't add complex config:** x402storage is simple on/off, don't add unnecessary fields
- **Don't fetch storage price:** Price is fixed at $0.01, hardcode it
- **Don't add settings panel:** Unlike Telegram (chatId) or X (fields), no config needed

## Don't Hand-Roll

Problems with existing solutions in the codebase:

| Problem          | Don't Build      | Use Instead                      | Why                                  |
| ---------------- | ---------------- | -------------------------------- | ------------------------------------ |
| Price formatting | Custom formatter | `formatPrice` from lib/format.ts | Handles sub-cent precision correctly |
| Wallet balance   | Custom API call  | `useWallet` hook                 | Cached, refreshes automatically      |
| Checkbox state   | Custom boolean   | `toggleDestination` helper       | Already handles array updates        |
| Panel z-index    | Custom stacking  | `SlidePanel` with stackLevel     | Handles panel stacking               |

**Key insight:** OutputConfigPanel already has all the patterns needed. The task is essentially copying the Telegram/X checkbox pattern and adjusting text/icon.

## Common Pitfalls

### Pitfall 1: Forgetting to Update Type in Both Places

**What goes wrong:** OutputDestination is defined in both output-config.ts AND OutputConfigPanel.tsx
**Why it happens:** The component has a local interface that duplicates the type
**How to avoid:** Update BOTH locations or remove the duplicate
**Warning signs:** TypeScript errors about "x402storage" not in union

### Pitfall 2: Not Handling Disabled State Styling

**What goes wrong:** Checkbox looks clickable but does nothing when balance insufficient
**Why it happens:** Forgot to add opacity/cursor styling for disabled state
**How to avoid:** Follow exact pattern from Telegram/X for !hasRequirement case
**Warning signs:** Visual inconsistency with other disabled destinations

### Pitfall 3: Price Not Updating in Run Button

**What goes wrong:** Storage selected but Run button shows old price
**Why it happens:** useJobPrice not updated to include storage fee
**How to avoid:** Update useJobPrice to check output node configs
**Warning signs:** Price mismatch between panel and button

### Pitfall 4: OutputNode Badge Not Showing

**What goes wrong:** Selecting storage doesn't show badge in OutputNode
**Why it happens:** OutputNode only checks for telegram/x, not x402storage
**How to avoid:** Add x402storage badge render in OutputNode
**Warning signs:** Inconsistent badge display across destinations

## Code Examples

Verified patterns from the existing codebase:

### Existing Destination Toggle Logic

```typescript
// Source: src/components/panels/OutputConfigPanel.tsx
const toggleDestination = (type: OutputDestination["type"]) => {
  setDestinations((prev) => {
    const existing = prev.find((d) => d.type === type);
    if (existing) {
      return prev.map((d) =>
        d.type === type ? { ...d, enabled: !d.enabled } : d,
      );
    }
    return [...prev, { type, enabled: true }];
  });
};

const isDestinationEnabled = (type: OutputDestination["type"]) => {
  return destinations.some((d) => d.type === type && d.enabled);
};
```

### Existing Wallet Balance Usage

```typescript
// Source: src/components/panels/RunWorkflowPanel.tsx
import { useWallet } from "@/hooks/useWallet";

const { wallet } = useWallet();
const effectiveBalance = wallet?.totalBalanceUsdc || 0;
const hasInsufficientBalance = effectiveBalance < totalCost;
```

### Existing Price Display Format

```typescript
// Source: src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx
import { formatPrice } from "@/lib/format";

// formatPrice handles $0.01 correctly
const priceDisplay = formatPrice(10000); // Returns "$0.01"
```

### OutputNode Destination Badges

```typescript
// Source: src/components/workflow/nodes/OutputNode.tsx
const enabledDestinations = data.outputConfig?.destinations?.filter(
  (d) => d.enabled,
);
const hasTelegram = enabledDestinations?.some((d) => d.type === "telegram");
const hasX = enabledDestinations?.some((d) => d.type === "x");

// In render:
{!hasResult && (hasTelegram || hasX) && (
  <div className="flex items-center gap-1 ml-auto">
    {hasTelegram && (
      <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center" title="Telegram enabled">
        <Send className="w-3 h-3 text-blue-500" />
      </div>
    )}
    {/* Add similar for x402storage */}
  </div>
)}
```

## State of the Art

| Old Approach          | Current Approach    | When Changed | Impact             |
| --------------------- | ------------------- | ------------ | ------------------ |
| API key for IPFS      | x402 payment header | 2025         | No accounts needed |
| Account-based storage | Pay-per-use         | 2025         | Simpler UX         |

**Deprecated/outdated:**

- IPFS API keys: x402 removes need for API key management
- Complex storage config: Single on/off toggle is sufficient

## Open Questions

Things that couldn't be fully resolved:

1. **x402.storage endpoint specifics**
   - What we know: x402 protocol works with Pinata for IPFS storage
   - What's unclear: Whether x402.storage is a custom endpoint or uses Pinata
   - Recommendation: Phase 10 will handle actual API integration, Phase 9 just needs UI

2. **Multiple output handling**
   - What we know: PRCE-04 mentions "Multiple outputs show actual total"
   - What's unclear: Does Phase 9 need to handle multiple files, or is that Phase 10?
   - Recommendation: Phase 9 shows fixed $0.01 estimate; Phase 10 handles actual per-file pricing

3. **Storage icon color**
   - What we know: Telegram is blue-500, X is foreground/neutral
   - What's unclear: Best color for x402.storage badge
   - Recommendation: Use emerald-500 (green) to indicate "permanent/success" semantics

## Sources

### Primary (HIGH confidence)

- `/src/components/panels/OutputConfigPanel.tsx` - Existing destination UI patterns
- `/src/types/output-config.ts` - Current OutputDestination type
- `/src/components/pages/JobCanvas/lib/useJobPrice.ts` - Price calculation logic
- `/src/hooks/useWallet.ts` - Wallet balance access
- `/src/components/workflow/nodes/OutputNode.tsx` - Destination badges display

### Secondary (MEDIUM confidence)

- [Pinata x402 IPFS Documentation](https://docs.pinata.cloud/api-reference/endpoint/x402/pin) - x402 storage API patterns
- [Lucide Icons](https://lucide.dev/icons/) - Available icon options

### Tertiary (LOW confidence)

- [x402 Ecosystem](https://www.x402.org/ecosystem) - x402.storage may not be a dedicated service

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using only existing codebase libraries
- Architecture: HIGH - Following established OutputConfigPanel patterns exactly
- Pitfalls: HIGH - Based on direct codebase analysis

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - stable frontend patterns)
