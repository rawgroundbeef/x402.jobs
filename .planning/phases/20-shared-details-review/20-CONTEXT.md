# Phase 20: Shared Details & Review - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Shared details form step (name, slug, description, image, category, price, network) and review step (summary card with edit links, publish button) that every resource type flows through. This is the middle and end of the wizard — type-specific configuration happens before this, cleanup happens after.

</domain>

<decisions>
## Implementation Decisions

### Slug generation UX
- Live auto-generate: slug field updates in real-time as user types the resource name (e.g., "My Cool API" → "my-cool-api")
- Slug field is always editable — regular text input that auto-fills but user can change freely
- Once user manually edits the slug field, stop syncing with name changes — slug becomes fully independent
- Display /@username/ as a non-editable inline prefix inside/adjacent to the slug input field

### Claude's Discretion
- Form field layout and grouping
- Review step card design and information hierarchy
- Loading/error states during publish
- Image field implementation (URL input vs upload)
- Field validation timing and error display
- Mobile responsive behavior

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

*Phase: 20-shared-details-review*
*Context gathered: 2026-01-31*
