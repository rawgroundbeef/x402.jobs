# Phase 4: Caller Detail Page + Parameter Form - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

UI for callers to view prompt template resource details, fill in parameters, and execute to receive Claude's response. This is the caller-facing experience for prompt_template resources — follows existing resource detail page patterns.

</domain>

<decisions>
## Implementation Decisions

### Page Structure

- Follow existing resource detail page patterns — prompt_template is just another resource type
- No custom layout needed — use established conventions

### Parameter Form

- Follow existing dynamic form patterns in the codebase
- Required parameters enforced, defaults pre-filled
- Validation feedback follows existing form conventions

### User Message Input

- Appears **after parameters, before Run button** when `allows_user_message` is true
- Hidden when `allows_user_message` is false

### Response Display

- **No streaming** — display complete response when execution finishes
- Use existing results area that resource pages already have
- Copy to clipboard follows existing patterns

### Claude's Discretion

- Loading state design during execution
- Error message display formatting
- Exact typography and spacing within existing patterns
- Any polish details within the established conventions

</decisions>

<specifics>
## Specific Ideas

- "We have a space for results in the resource pages" — use that existing results area
- Follow conventions consistently — this is not a special page, it's a resource page

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 04-caller-detail-page_
_Context gathered: 2026-01-19_
