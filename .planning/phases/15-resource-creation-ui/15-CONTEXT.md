# Phase 15: Resource Creation UI - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Create Resource modal flow for OpenRouter resources — model selection, prompt template authoring, parameter definitions, and pricing configuration. Users can create monetized endpoints powered by any OpenRouter model.

</domain>

<decisions>
## Implementation Decisions

### Prompt template editor

- Follow existing Claude prompt template pattern exactly
- Same textarea, same `{{param}}` auto-extraction, same parameter cards
- No differences from Claude template editor experience
- System prompt field included, same handling as Claude pattern

### Claude's Discretion

- Creation flow structure (steps/tabs vs single form)
- Model selection UX (inline browser vs modal)
- Parameter definition UI details
- Validation timing and error states
- Any sensible improvements that don't change the core experience

</decisions>

<specifics>
## Specific Ideas

- "Follow the same pattern as Claude AI prompt template type" — existing implementation is the reference
- Identical experience between Claude and OpenRouter template editing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 15-resource-creation-ui_
_Context gathered: 2026-01-27_
