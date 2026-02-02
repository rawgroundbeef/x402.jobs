# Phase 19: Wizard Shell & Type Selection - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Full-page wizard at `/resources/new` with step navigation, session storage persistence, and a type selection step showing 4 resource type cards. Users can navigate to the wizard, see type options, click one to proceed, and have their state survive page refreshes. This phase builds the shell and Step 1 only — source configuration (Step 2), details (Step 3), and review (Step 4) are later phases.

</domain>

<decisions>
## Implementation Decisions

### Visual design & layout
- Centered card layout within the page (like Stripe onboarding) — constrained width (~700-800px), content focused
- App nav bar stays visible — wizard renders below it, not full-immersive
- Dark theme consistent with existing app: page background #0a0f14, card #111820 with #252d3a border
- Card distinguished by border only, no contrasting background color
- Step indicator is a simple "Step 1 of 3" text counter in the header — no numbered circles, no breadcrumbs
- Green accent (#00d992) for interactive elements

### Type card content & hierarchy
- Each card shows: icon + title + one-line description
- "Link Existing" is full-width at the top as the primary/default path
- Below it: centered text divider "or create something new" with horizontal lines on each side
- Lines use border color (#252d3a), text uses muted color (#5c6670), sentence case, 32px vertical margin
- Three "create" cards (Proxy, Claude, OpenRouter) displayed in a row below the divider
- Card descriptions: Link Existing = "Connect your x402-enabled endpoint", Proxy = "Wrap any URL with payments", Claude = "Monetize a prompt", OpenRouter = active (not "Coming soon" — will be built in this milestone)
- Clicking a type card navigates directly to that type's Step 2 URL — no intermediate selection state, no Continue button on Step 1

### Navigation & URL strategy
- Flat URL structure with type only on Step 2:
  - `/resources/new` → Step 1: Choose type
  - `/resources/new/link` → Step 2: Configure (Link Existing)
  - `/resources/new/proxy` → Step 2: Configure (Proxy)
  - `/resources/new/claude` → Step 2: Configure (Claude)
  - `/resources/new/openrouter` → Step 2: Configure (OpenRouter)
  - `/resources/new/details` → Step 3: Resource details (shared)
  - `/resources/new/review` → Step 4: Review & publish (shared)
- Next.js App Router file structure mirrors these routes
- Natural browser history — each step pushes to history, browser back goes to previous step
- Deep link protection: if session storage has state, show the step; if not, redirect to `/resources/new`
- OpenRouter route included and fully functional (not disabled/coming-soon)

### Session storage & state shape
- Single session storage key: `x402jobs:newResource` containing all wizard state as one JSON object
- No React context/provider — each step page reads/writes session storage directly via shared helper functions (getDraft, saveDraft, clearDraft)
- Each step: load draft on mount → validate prerequisites → edit → save on continue → navigate
- Draft cleared on successful publish or explicit Cancel
- Cancel button shows confirmation dialog ("Discard this resource?") if meaningful data exists; navigates directly if draft is empty
- When user returns to `/resources/new` with existing draft: show resume prompt ("You have an unfinished resource — Continue editing / Start fresh") with draft name, type, and last-edited time
- Resume navigates to farthest completed step; Start fresh clears draft and shows type selection

### Claude's Discretion
- Exact card hover/focus states
- Loading skeleton while checking session storage
- Toast message style on redirect
- Mobile breakpoint behavior (cards stack naturally)
- Exact spacing values beyond what was specified
- Animation/transitions between steps (if any)

</decisions>

<specifics>
## Specific Ideas

- Centered divider styled as flexbox with ::before/::after pseudo-elements for the lines, gap for text
- Helper functions pattern: `getDraft()`, `saveDraft(updates)`, `clearDraft()` with updatedAt timestamp on every save
- Resume prompt shows draft name (e.g., "My Awesome API") and type (e.g., "Link Existing") plus relative time ("2 hours ago")
- Card conceptual split represents a real distinction: "Link Existing" = you host it, we list it; "Create" options = we host it for you

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-wizard-shell-type-selection*
*Context gathered: 2026-01-30*
