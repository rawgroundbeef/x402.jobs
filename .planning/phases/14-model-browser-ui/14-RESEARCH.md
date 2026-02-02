# Phase 14: Model Browser UI - Research

**Researched:** 2026-01-26
**Domain:** React UI/UX for browsing and filtering large datasets
**Confidence:** HIGH

## Summary

Phase 14 implements a model browser for 200+ AI models from OpenRouter's catalog, displayed as a responsive card grid with immediate filtering and search. The phase uses the established x402-jobs stack (Next.js 15.5.9, React 19, SWR 2.3.6, Tailwind CSS 3.4.0, lucide-react 0.468.0) and follows existing patterns from ResourcesListPage and ResourcesModal.

The standard approach is a filtered card grid with:

- SWR for data fetching with automatic revalidation
- Tailwind responsive grid (1/2/3/4 columns at mobile/tablet/medium/desktop breakpoints)
- Immediate filter updates using controlled state (no "Apply" button)
- Classic pagination for 200+ items with page number buttons
- CSS text truncation for descriptions

User decisions from CONTEXT.md lock several design choices: card grid layout (4 per row desktop), horizontal filter bar, Popular/All Models tabs, provider logos on cards, and classic pagination.

**Primary recommendation:** Follow ResourcesListPage patterns for filter state management and pagination, adapt ResourcesModal card styling for model cards, use Tailwind line-clamp for descriptions, and create a ProviderIcon component similar to ChainIcons.tsx for AI provider logos.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library      | Version      | Purpose                   | Why Standard                                                                                        |
| ------------ | ------------ | ------------------------- | --------------------------------------------------------------------------------------------------- |
| SWR          | 2.3.6        | Data fetching & caching   | Already used across x402-jobs for resource/job lists, automatic revalidation, request deduplication |
| Tailwind CSS | 3.4.0        | Responsive grid & styling | Project standard, responsive grid utilities, line-clamp for truncation                              |
| lucide-react | 0.468.0      | Icons                     | Project standard, 1000+ SVG icons including modality icons (Type, Image, Video, Volume2)            |
| @repo/ui     | workspace:\* | Base components           | Internal UI library with Tabs, Badge, Button, Input already used                                    |

### Supporting

| Library         | Version | Purpose             | When to Use                                             |
| --------------- | ------- | ------------------- | ------------------------------------------------------- |
| next/navigation | 15.5.9  | URL state sync      | Optional - persist filter state in URL for shareability |
| clsx            | 2.0.0   | Conditional classes | Already used - combine Tailwind classes dynamically     |

### Alternatives Considered

| Instead of            | Could Use              | Tradeoff                                                                 |
| --------------------- | ---------------------- | ------------------------------------------------------------------------ |
| Classic pagination    | Infinite scroll        | Context specifies classic pagination with page numbers                   |
| CSS line-clamp        | react-truncate library | CSS is simpler, performant, and sufficient for 1-2 line descriptions     |
| Custom provider icons | Icons from LobeHub     | Custom SVG components match ChainIcons pattern, no external dependencies |

**Installation:**

```bash
# No new dependencies needed - all libraries already installed
```

## Architecture Patterns

### Recommended Component Structure

```
src/components/
├── ModelBrowser/
│   ├── ModelBrowser.tsx           # Main browser component
│   ├── ModelCard.tsx               # Individual model card
│   ├── ModelFilters.tsx            # Horizontal filter bar
│   ├── ModelSearch.tsx             # Search input
│   └── Pagination.tsx              # Page number pagination
├── icons/
│   └── ProviderIcons.tsx           # Google, Anthropic, Meta, etc.
```

### Pattern 1: SWR Data Fetching with Filtering

**What:** Fetch all models once, filter client-side for immediate updates
**When to use:** Dataset under 1000 items, fast filtering without server round-trips
**Example:**

```typescript
// Source: ResourcesModal.tsx pattern + SWR docs
import useSWR from "swr";

const { data, isLoading } = useSWR<{ models: AIModel[] }>(
  "/api/v1/ai-models",
  authenticatedFetcher,
);

const models = data?.models || [];

// Client-side filtering for immediate updates
const filteredModels = models.filter((model) => {
  if (
    search &&
    !model.display_name.toLowerCase().includes(search.toLowerCase())
  ) {
    return false;
  }
  if (modalityFilter !== "all" && model.modality !== modalityFilter) {
    return false;
  }
  if (providerFilter !== "all" && model.provider !== providerFilter) {
    return false;
  }
  if (priceRange && !matchesPriceRange(model, priceRange)) {
    return false;
  }
  return true;
});

// Pagination slice
const startIndex = currentPage * itemsPerPage;
const paginatedModels = filteredModels.slice(
  startIndex,
  startIndex + itemsPerPage,
);
```

### Pattern 2: Responsive Card Grid

**What:** Tailwind grid that adapts from 1 column (mobile) to 4 columns (desktop)
**When to use:** Card-based layouts following mobile-first design
**Example:**

```typescript
// Source: Tailwind grid-template-columns docs + ResourcesModal
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {paginatedModels.map(model => (
    <ModelCard key={model.id} model={model} onSelect={onSelect} />
  ))}
</div>
```

### Pattern 3: Horizontal Filter Bar with Active State

**What:** Inline filters that update immediately, show active count, clear all button
**When to use:** Multiple filter dimensions, need to show active filter state
**Example:**

```typescript
// Source: ResourcesListPage pattern + shadcn filter badge pattern
const [modalityFilter, setModalityFilter] = useState<string>("all");
const [providerFilter, setProviderFilter] = useState<string>("all");
const [priceRange, setPriceRange] = useState<string | null>(null);

// Count active filters
const activeFilterCount = [
  modalityFilter !== "all",
  providerFilter !== "all",
  priceRange !== null
].filter(Boolean).length;

<div className="flex items-center gap-3 flex-wrap">
  {/* Modality filter */}
  <Select value={modalityFilter} onChange={setModalityFilter}>
    <option value="all">All Types</option>
    <option value="text">Text</option>
    <option value="image">Image</option>
    <option value="video">Video</option>
    <option value="audio">Audio</option>
  </Select>

  {/* Active filter badge */}
  {activeFilterCount > 0 && (
    <Badge variant="secondary">
      {activeFilterCount} active
      <button onClick={clearAllFilters} className="ml-2">
        <X className="w-3 h-3" />
      </button>
    </Badge>
  )}
</div>
```

### Pattern 4: Classic Pagination Component

**What:** Page number buttons with prev/next, shows current page
**When to use:** Known total count, prefer page jumps over infinite scroll
**Example:**

```typescript
// Source: MUI Pagination + ResourcesListPage pagination pattern
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Show max 7 page numbers: [1] ... [4] [5] [6] ... [20]
  const pageNumbers = generatePageNumbers(currentPage, totalPages, 7);

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft />
      </Button>

      {pageNumbers.map((page, i) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${i}`}>...</span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            onClick={() => onPageChange(page)}
          >
            {page + 1}
          </Button>
        )
      )}

      <Button
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
```

### Pattern 5: CSS Text Truncation

**What:** Use Tailwind line-clamp for multi-line truncation
**When to use:** Fixed line limits (1-2 lines), no "Read More" needed
**Example:**

```typescript
// Source: Tailwind CSS line-clamp + LogRocket truncation guide
<p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
  {model.description}
</p>

// CSS output: -webkit-line-clamp: 2 with overflow: hidden
```

### Pattern 6: Tab State Management

**What:** Controlled tabs with @repo/ui/tabs components
**When to use:** Toggle between distinct views (Popular vs All Models)
**Example:**

```typescript
// Source: @repo/ui/tabs.tsx + ResourcesModal tab pattern
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/tabs";

const [activeTab, setActiveTab] = useState<"popular" | "all">("popular");

<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "popular" | "all")}>
  <TabsList>
    <TabsTrigger value="popular">Popular</TabsTrigger>
    <TabsTrigger value="all">All Models</TabsTrigger>
  </TabsContent>

  <TabsContent value="popular">
    {/* Show curated models */}
  </TabsContent>

  <TabsContent value="all">
    {/* Show all models with pagination */}
  </TabsContent>
</Tabs>
```

### Anti-Patterns to Avoid

- **Don't create new filter state inside useEffect** - causes extra renders. Initialize state from props/URL params directly.
- **Don't pass entire model objects as dependencies** - use stable identifiers like `models.length` or `modelIds`.
- **Don't fetch on every filter change** - fetch once, filter client-side for 200-300 items.
- **Don't use react-truncate library** - CSS line-clamp is simpler and more performant.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                       | Don't Build                                   | Use Instead                                          | Why                                                                                                                                 |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Text truncation with ellipsis | Custom JavaScript truncation logic            | Tailwind `line-clamp-2` utility                      | CSS solution is performant, handles resize, no JS needed. Libraries like react-truncate (7 years old) add unnecessary dependencies. |
| Pagination logic              | Custom page number generation with edge cases | Simplified pagination component based on MUI pattern | Page number generation with ellipsis (...) has edge cases for first/last pages, middle ranges. Reuse proven logic.                  |
| Debounced search              | setTimeout in component                       | Debounce in onChange handler with cleanup            | ResourcesListPage pattern handles cleanup correctly, prevents memory leaks.                                                         |
| Filter state + URL sync       | Manual URL manipulation                       | next/navigation useSearchParams + router.replace     | Next.js utilities handle encoding, scroll preservation, avoiding history pollution.                                                 |
| Responsive grid breakpoints   | Custom media queries                          | Tailwind grid utilities                              | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` handles all breakpoints, no custom CSS.                                                 |
| Empty states                  | Plain text div                                | Lucide icon + centered message                       | ResourcesModal pattern: icon + message + optional action creates better UX.                                                         |

**Key insight:** For filter/search UIs with 200-300 items, client-side filtering with debounced search provides instant feedback without server round-trips. SWR handles caching and revalidation automatically.

## Common Pitfalls

### Pitfall 1: Filter State Causing Unnecessary Re-renders

**What goes wrong:** Creating new objects/arrays in filter functions on every render causes child components to re-render unnecessarily.
**Why it happens:** Array.filter() creates a new array reference every time, triggering React's re-render even if contents are identical.
**How to avoid:** Use useMemo to memoize filtered results with proper dependencies.
**Warning signs:** Performance lag when typing in search box, DevTools showing excessive re-renders.

```typescript
// BAD - creates new array every render
const filteredModels = models.filter((m) => m.name.includes(search));

// GOOD - memoized, only recomputes when dependencies change
const filteredModels = useMemo(
  () =>
    models.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
  [models, search],
);
```

### Pitfall 2: Pagination Not Resetting on Filter Change

**What goes wrong:** User changes filter on page 5, filtered results only have 2 pages, user sees empty page.
**Why it happens:** Pagination state (`currentPage`) not reset when filter state changes.
**How to avoid:** Reset `currentPage` to 0 whenever any filter changes.
**Warning signs:** Empty results when switching filters, users report "broken filters."

```typescript
// GOOD - reset page on filter change
const handleModalityChange = (newModality: string) => {
  setModalityFilter(newModality);
  setCurrentPage(0); // Always reset to first page
};
```

### Pitfall 3: Search Debounce Memory Leaks

**What goes wrong:** Rapid typing creates multiple setTimeout callbacks that never get cleared, causing memory leaks and stale state updates.
**Why it happens:** Not cleaning up setTimeout in React effects or callbacks.
**How to avoid:** Return cleanup function from useCallback or useEffect that clears timeout.
**Warning signs:** Filters update multiple times after typing stops, memory usage grows over time.

```typescript
// BAD - no cleanup
const handleSearch = (value: string) => {
  setTimeout(() => setSearch(value), 300);
};

// GOOD - cleanup returned
const handleSearch = useCallback((value: string) => {
  const timeout = setTimeout(() => setDebouncedSearch(value), 300);
  return () => clearTimeout(timeout);
}, []);
```

### Pitfall 4: Overcomplicating Pricing Display

**What goes wrong:** Trying to calculate "average cost per request" or comparing input/output pricing, confusing users with complex formulas.
**Why it happens:** Over-engineering to "help" users understand pricing.
**How to avoid:** Display simple format: "Input: $X/1M tokens, Output: $Y/1M tokens" or just show output pricing (typically 3-10x input). Let users interpret based on their use case.
**Warning signs:** Users confused by pricing, support questions about "what does this cost."

```typescript
// BAD - complex calculation that confuses users
const avgPrice = (model.pricing_input * 0.3 + model.pricing_output * 0.7);

// GOOD - show both clearly
<div className="text-xs">
  <div>In: ${formatTokenPrice(model.pricing_input)}/1M</div>
  <div>Out: ${formatTokenPrice(model.pricing_output)}/1M</div>
</div>
```

### Pitfall 5: Not Showing Empty States

**What goes wrong:** Users apply filters that match zero models, see blank grid, think page is broken.
**Why it happens:** Only handling loading state, not checking if filtered results are empty.
**How to avoid:** Add explicit empty state check after loading completes, show helpful message.
**Warning signs:** User confusion, support tickets "filters don't work."

```typescript
// Check for empty results after loading
{!isLoading && filteredModels.length === 0 && (
  <div className="text-center py-12 text-muted-foreground">
    <Box className="w-10 h-10 mx-auto mb-3 opacity-50" />
    <p>No models match your filters</p>
    <Button variant="ghost" onClick={clearFilters}>
      Clear filters
    </Button>
  </div>
)}
```

### Pitfall 6: Provider Logo Inconsistencies

**What goes wrong:** Some provider logos don't exist, images fail to load, or aspect ratios are inconsistent.
**Why it happens:** Assuming all providers have logos available, not handling missing/failed images.
**How to avoid:** Create ProviderIcon component with fallback, similar to ChainIcons pattern. Use SVG where possible, handle unknown providers gracefully.
**Warning signs:** Broken image icons, inconsistent card heights, visual gaps in grid.

```typescript
// GOOD - fallback for unknown providers
export function ProviderIcon({ provider }: { provider: string }) {
  const normalized = provider.toLowerCase();

  if (normalized === "anthropic") return <AnthropicIcon />;
  if (normalized === "openai") return <OpenAIIcon />;
  if (normalized === "google") return <GoogleIcon />;
  // ... other providers

  // Fallback for unknown providers
  return <Box className="w-5 h-5 text-muted-foreground" />;
}
```

## Code Examples

Verified patterns from official sources:

### SWR with Client-Side Filtering

```typescript
// Source: SWR docs (https://swr.vercel.app/) + ResourcesModal.tsx
import useSWR from "swr";

const { data, isLoading, error } = useSWR<{ models: AIModel[] }>(
  "/api/v1/ai-models",
  authenticatedFetcher,
  {
    revalidateOnFocus: false, // Don't refetch on tab focus for large datasets
    dedupingInterval: 60000, // Cache for 1 minute
  },
);

const models = data?.models || [];

// Client-side filtering
const filteredModels = useMemo(() => {
  let filtered = models;

  // Tab filter (curated vs all)
  if (activeTab === "popular") {
    filtered = filtered.filter((m) => m.is_curated);
  }

  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.display_name.toLowerCase().includes(searchLower) ||
        m.description?.toLowerCase().includes(searchLower),
    );
  }

  // Modality filter
  if (modalityFilter !== "all") {
    filtered = filtered.filter((m) => m.modality === modalityFilter);
  }

  // Provider filter
  if (providerFilter !== "all") {
    filtered = filtered.filter((m) => m.provider === providerFilter);
  }

  // Price range filter (example: preset ranges)
  if (priceRange) {
    filtered = filtered.filter((m) => {
      const outputPrice = parseFloat(m.pricing_completion || "0");
      if (priceRange === "free") return outputPrice === 0;
      if (priceRange === "low") return outputPrice > 0 && outputPrice < 1;
      if (priceRange === "medium") return outputPrice >= 1 && outputPrice < 5;
      if (priceRange === "high") return outputPrice >= 5;
      return true;
    });
  }

  return filtered;
}, [models, activeTab, search, modalityFilter, providerFilter, priceRange]);

// Pagination slice
const totalPages = Math.ceil(filteredModels.length / itemsPerPage);
const paginatedModels = filteredModels.slice(
  currentPage * itemsPerPage,
  (currentPage + 1) * itemsPerPage,
);
```

### Responsive Grid with Model Cards

```typescript
// Source: Tailwind docs + ResourcesModal card pattern
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {paginatedModels.map(model => (
    <button
      key={model.id}
      onClick={() => onSelect(model)}
      className="p-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left"
    >
      {/* Provider logo */}
      <div className="flex items-center gap-2 mb-2">
        <ProviderIcon provider={model.provider} className="w-5 h-5" />
        <span className="text-xs text-muted-foreground">{model.provider}</span>
      </div>

      {/* Model name */}
      <h3 className="font-medium mb-1">{model.display_name}</h3>

      {/* Description (truncated to 2 lines) */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
        {model.description}
      </p>

      {/* Modality icons */}
      <div className="flex items-center gap-2 mb-2">
        {model.modality === "text" && <Type className="w-4 h-4" />}
        {model.modality === "image" && <Image className="w-4 h-4" />}
        {model.modality === "video" && <Video className="w-4 h-4" />}
        {model.modality === "audio" && <Volume2 className="w-4 h-4" />}
        {model.modality === "multimodal" && (
          <>
            <Type className="w-3.5 h-3.5" />
            <Image className="w-3.5 h-3.5" />
          </>
        )}

        {/* Context length */}
        <span className="text-xs text-muted-foreground ml-auto">
          {formatContextLength(model.context_length)} context
        </span>
      </div>

      {/* Pricing */}
      <div className="flex items-baseline gap-1 text-xs">
        <span className="text-muted-foreground">Out:</span>
        <span className="font-mono text-green-500">
          ${model.pricing_completion}/1M
        </span>
      </div>

      {/* Curated badge (if on All Models tab) */}
      {activeTab === "all" && model.is_curated && (
        <Badge variant="secondary" className="mt-2">
          ⭐ Popular
        </Badge>
      )}
    </button>
  ))}
</div>
```

### Horizontal Filter Bar

```typescript
// Source: ResourcesListPage filter pattern + shadcn filter badge
<div className="flex flex-col gap-3">
  {/* Search + Active Filter Count */}
  <div className="flex items-center gap-3">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search models..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-9"
      />
    </div>

    {activeFilterCount > 0 && (
      <Badge variant="secondary" className="flex items-center gap-2">
        {activeFilterCount} active
        <button
          onClick={clearAllFilters}
          className="hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </Badge>
    )}
  </div>

  {/* Filter Dropdowns */}
  <div className="flex items-center gap-2 flex-wrap">
    <Select
      value={modalityFilter}
      onChange={(e) => handleFilterChange("modality", e.target.value)}
    >
      <option value="all">All Types</option>
      <option value="text">Text</option>
      <option value="image">Image</option>
      <option value="video">Video</option>
      <option value="audio">Audio</option>
      <option value="multimodal">Multimodal</option>
    </Select>

    <Select
      value={providerFilter}
      onChange={(e) => handleFilterChange("provider", e.target.value)}
    >
      <option value="all">All Providers</option>
      <option value="Anthropic">Anthropic</option>
      <option value="OpenAI">OpenAI</option>
      <option value="Google">Google</option>
      <option value="Meta">Meta</option>
      {/* ... more providers */}
    </Select>

    <Select
      value={priceRange || "all"}
      onChange={(e) => handleFilterChange("price", e.target.value === "all" ? null : e.target.value)}
    >
      <option value="all">All Prices</option>
      <option value="free">Free</option>
      <option value="low">Low ($0-1/1M)</option>
      <option value="medium">Medium ($1-5/1M)</option>
      <option value="high">High ($5+/1M)</option>
    </Select>
  </div>
</div>
```

### Pagination Component

```typescript
// Source: MUI Pagination pattern + ResourcesListPage
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Generate page numbers with ellipsis
  // Shows: [1] ... [4] [5] [6] ... [20]
  const generatePageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    // Always show first page
    pages.push(0);

    // Show ellipsis if current page is far from start
    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    // Show pages around current page
    const start = Math.max(1, currentPage - 1);
    const end = Math.min(totalPages - 2, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Show ellipsis if current page is far from end
    if (currentPage < totalPages - 4) {
      pages.push("ellipsis");
    }

    // Always show last page
    pages.push(totalPages - 1);

    return pages;
  };

  const pageNumbers = generatePageNumbers();

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {pageNumbers.map((page, i) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(page)}
            className="w-10 h-10"
          >
            {page + 1}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

## State of the Art

| Old Approach                | Current Approach            | When Changed | Impact                                                                                                                                  |
| --------------------------- | --------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| react-truncate library      | Tailwind line-clamp utility | 2020-2021    | CSS-only truncation is more performant, simpler, no JavaScript. react-truncate last updated 7 years ago.                                |
| Server-side filtering       | Client-side with SWR        | 2021-2022    | For 200-300 items, client-side is faster (instant updates), simpler (no API changes). SWR handles caching automatically.                |
| Separate filter modals      | Inline horizontal filters   | 2022-2023    | Immediate feedback pattern (no "Apply" button) became standard. Reduces clicks, faster exploration.                                     |
| Infinite scroll everywhere  | Context-aware pagination    | 2023-2024    | Pagination preferred for known datasets where users need to reference specific pages or share links. Infinite scroll for feeds/streams. |
| Complex pricing calculators | Simple display format       | 2024-2025    | AI model pricing display settled on "$X/1M tokens" format (input + output). Industry standard across OpenRouter, OpenAI, Anthropic.     |

**Deprecated/outdated:**

- **react-truncate**: Last updated 7 years ago. Use Tailwind line-clamp instead.
- **Server-side pagination for small datasets**: For <1000 items, client-side filtering with SWR provides better UX.
- **Apply button for filters**: Immediate update pattern is now standard (debounced search, instant filter updates).

## Open Questions

Things that couldn't be fully resolved:

1. **Provider logo asset availability**
   - What we know: LobeHub offers SVG/PNG logos for major providers (Anthropic, OpenAI, Google), Icons8 has alternatives
   - What's unclear: Which exact providers exist in OpenRouter catalog, whether all have recognizable logos
   - Recommendation: Create ProviderIcon component with fallback pattern. Start with major providers (Anthropic, OpenAI, Google, Meta, Mistral, X.AI), use Box icon fallback for others. Add logos incrementally as needed.

2. **Price range preset values**
   - What we know: Industry standard is per 1M tokens, output pricing ranges from $0 (free tier) to $15+ (premium models)
   - What's unclear: What ranges are most useful for users - needs usage data
   - Recommendation: Start with 4 ranges: Free ($0), Budget ($0-1/1M), Standard ($1-5/1M), Premium ($5+/1M). Adjust based on user feedback.

3. **Curated model selection criteria**
   - What we know: Phase 12 added is_curated flag, migration suggests 20-30 popular models (Claude, GPT-4, Gemini, Llama)
   - What's unclear: Exact curation criteria (usage-based? editor's choice? latest versions only?)
   - Recommendation: For planning purposes, assume is_curated flag is already set by Phase 12 sync function. Browser just filters/displays it. Curation logic is out of scope.

4. **Context length display format**
   - What we know: Models have context_length field (e.g., 128000, 200000)
   - What's unclear: Best display format - "128K context" vs "128,000 tokens" vs just "128K"
   - Recommendation: Use compact format: "128K context", "1M context". Function: `formatContextLength(tokens) => tokens >= 1000000 ? `${tokens/1000000}M` : `${tokens/1000}K``

## Sources

### Primary (HIGH confidence)

- [SWR Official Documentation](https://swr.vercel.app/) - Data fetching patterns, configuration options
- [Tailwind CSS Grid Documentation](https://tailwindcss.com/docs/grid-template-columns) - Responsive grid utilities
- [Lucide React Icons](https://lucide.dev/guide/packages/lucide-react) - Icon library documentation
- ai_models table schema - `/Users/rawgroundbeef/Projects/memeputer/supabase/migrations/20250120_create_ai_models_table.sql` and `006_add_ai_models_curation.sql`
- Existing codebase patterns - ResourcesListPage.tsx, ResourcesModal.tsx, ChainIcons.tsx

### Secondary (MEDIUM confidence)

- [MUI Pagination Component](https://mui.com/material-ui/react-pagination/) - Page number generation patterns
- [Tailwind Line Clamp](https://tailwindcss.com/docs/line-clamp) - CSS text truncation
- [LogRocket: Truncate Text in CSS](https://blog.logrocket.com/truncate-text-css/) - Multi-line truncation techniques
- [LobeHub AI Provider Logos](https://lobehub.com/icons/anthropic) - SVG/PNG logo resources
- [shadcn/ui Filter Badge Pattern](https://www.subframe.com/templates/t/filter-badge) - Active filter UI patterns

### Secondary (MEDIUM confidence) - Performance & Best Practices

- [LogRocket: UI Best Practices for Loading, Error, Empty States](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/) - Empty state patterns
- [Medium: React Filter State Management](https://www.linkedin.com/advice/0/what-some-common-pitfalls-anti-patterns-using) - Common pitfalls
- [react-grid-layout Performance](https://github.com/react-grid-layout/react-grid-layout) - O(n log n) optimization for 200+ items

### Tertiary (LOW confidence) - Industry Context

- [PricePerToken.com](https://pricepertoken.com/) - AI model pricing comparison (unverified accuracy)
- [AI Multiple: LLM Pricing Comparison](https://research.aimultiple.com/llm-pricing/) - Industry pricing formats
- WebSearch results for pagination, filter patterns - multiple sources agree on immediate update pattern

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all libraries already in package.json, versions verified
- Architecture: HIGH - patterns extracted from existing codebase (ResourcesListPage, ResourcesModal)
- Pitfalls: MEDIUM - based on general React state management best practices, not phase-specific verification
- Pricing display: MEDIUM - industry standard verified across multiple sources, but format needs validation with actual ai_models data

**Research date:** 2026-01-26
**Valid until:** 30 days (stack is stable, UI patterns change slowly)

**Notes:**

- No new dependencies required - phase uses existing stack
- Provider logo implementation is main unknown - recommend starting with major providers + fallback
- Curation criteria out of scope - Phase 12 sets is_curated flag
- Price range presets should be validated with actual pricing data after initial implementation
