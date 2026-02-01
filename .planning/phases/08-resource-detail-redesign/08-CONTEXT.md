# Phase 8: Resource Detail Page Redesign - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize resource detail page layout — clearer information hierarchy, better visual grouping, prominent CTAs, and appropriate placement for different user roles (visitor vs owner). Does not add new features, only improves presentation of existing information.

</domain>

<decisions>
## Implementation Decisions

### CTA Hierarchy

- Primary CTAs (Run, Use in Job) positioned **after stats** — stats provide context before action
- **Run is primary button**, Use in Job is secondary/outline style
- **Price embedded in Run button**: "Run ($0.10)" — single element, not repeated elsewhere
- Owner actions (Edit, Delete) in **three-dot dropdown menu** in header top-right corner

### Stats Presentation

- **Single stats bar** (horizontal row), not individual cards or grid
- **Failure indicators**: Red/warning color + warning icon for poor success rates
  - 0-50% success: Red with warning icon
  - 51-80% success: Yellow/amber (caution)
  - 81%+: Green or neutral (no special treatment)
- **Sample size context**: Show as "0% success (13 calls)" — parenthetical shows data confidence
- **Role-based stats**:
  - Visitors see: Success rate, Total runs, Network
  - Owners also see: Earnings (replaces price in stats since price is in CTA)

### Information Deduplication

- **Price**: CTA button only ("Run ($0.10)") — not repeated in stats bar
- **Network/Chain**: Stats bar only with icon (e.g., "⬡ Base") — remove from description text and reduce redundancy
- **Refund badge**: Merge with attribution into single line below CTAs: "🛡️ Refund Protected via OpenFacilitator"
  - Remove separate "Powered by OpenFacilitator" text
  - Position near CTAs (trust signal at decision point), not prominent header placement

### Visual Grouping

- **Primary separator: Whitespace** — generous spacing, no heavy borders
- **One exception: Action zone card** — subtle card (light background, slight shadow) around stats + CTAs + refund note
- **Vertical flow**: Title → API URL → Description → [Stats+CTAs Card] → Tabs
- **Owner dropdown**: Top-right of title area (three-dot menu with Edit/Delete)
- **Keep all 3 tabs**: Overview, API Details, Activity
  - Content is genuinely distinct
  - API Details has code-heavy JSON schemas
  - Activity will grow with run history

### Claude's Discretion

- Exact color values for warning states
- Spacing and typography specifics
- Card shadow/border subtlety
- Whether to merge Overview tab fields into header (lightweight content)
- Icon choices for warning indicators

</decisions>

<specifics>
## Specific Ideas

- "A 0% success rate isn't just information—it's a warning. Users are about to spend money on something that has failed every single time."
- Color alone can be missed by colorblind users (~8% of men) — use both color AND icon
- Stats bar example: `⚠️ 0% success (13 calls) • ⬡ Base`
- CTA area example: `[Use in Job] [Run ($0.10)]` followed by `🛡️ Refund Protected via OpenFacilitator`
- Action zone should feel like a contained "decision zone" — everything user needs to know and act on in one visual unit
- Owner actions follow established pattern: top-right three-dot menu (like YouTube, GitHub, Notion)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 08-resource-detail-redesign_
_Context gathered: 2026-01-21_
