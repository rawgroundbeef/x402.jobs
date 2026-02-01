# Phase 18: Resource Display - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Display OpenRouter resources in Explore listings and detail pages. Callers can view model info, fill parameter forms, and execute resources. This phase handles the display and execution UX — resource creation was Phase 15, execution backend was Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Execution Feedback

- Loading state: Match existing prompt_template resource pattern
- Image results: Display inline, sized to fit the result area
- Error display: Follow existing prompt_template error handling pattern
- Result actions: Follow existing patterns (copy for text, appropriate actions for media)

### Claude's Discretion

- Listing card layout and visual distinction for OpenRouter resources
- Detail page hierarchy and model info presentation
- Parameter form styling and validation UX
- Specific loading skeleton or spinner implementation
- Download vs copy behavior per modality

</decisions>

<specifics>
## Specific Ideas

- Follow existing prompt_template patterns throughout — this is an extension of that resource type, not a new paradigm
- Images should appear inline in the result area, not as thumbnails requiring expansion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 18-resource-display_
_Context gathered: 2026-01-27_
