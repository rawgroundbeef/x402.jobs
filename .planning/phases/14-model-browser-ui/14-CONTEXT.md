# Phase 14: Model Browser UI - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users browse curated AI models from OpenRouter, with search and filters, to select one when creating a resource. The browser displays 20-30 curated models by default, with ability to view the full 200+ catalog. Users can filter by modality, provider, and price.

</domain>

<decisions>
## Implementation Decisions

### Visual layout

- Card grid layout, responsive, similar to app stores
- 4 cards per row at desktop width
- Provider logos/icons on cards for visual brand recognition (Google, Anthropic, Meta, etc.)
- Click selects model directly (no detail drawer) — optimized for resource creation flow

### Filter UX

- Horizontal filter bar above the grid (inline with search bar)
- Filters update results immediately (no "Apply" button)
- Active filter count badge with "Clear all" button when filters are active

### Curated vs full view

- Tab buttons: "Popular" | "All Models"
- Always start on "Popular" tab (no persistence)
- Curated models have a badge/star indicator on their cards
- "All Models" tab uses classic pagination (page numbers at bottom) for 200+ models

### Model card content

- Provider logo
- Model name
- 1-2 line description excerpt (truncated)
- Modality icons (text/image/video/audio input/output)
- Context length (always shown, e.g., "128K context")

### Claude's Discretion

- Price filter mechanism (preset ranges vs slider)
- Pricing display format on cards
- Exact card spacing and typography
- Empty state when no models match filters
- Loading states during filter/search

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 14-model-browser-ui_
_Context gathered: 2026-01-26_
