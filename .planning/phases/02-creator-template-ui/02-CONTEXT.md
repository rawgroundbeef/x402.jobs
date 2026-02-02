# Phase 2: Creator Template Definition UI - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Creators can define and publish prompt template resources. This includes selecting "Prompt Template" as resource type, writing the system prompt, defining parameters, setting price/settings, and publishing. Testing templates is Phase 3; caller UI is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### System Prompt Editor

- Simple textarea with monospace font (not a full code editor)
- Auto-expands with content up to a max height, then scrolls
- Help text above/below editor explaining `{param}{/param}` syntax with example
- Insert button that shows dropdown of existing defined parameters to insert at cursor
- Real-time inline warnings when a tag name doesn't match a defined parameter
- Character count indicator displayed

### Parameter Management

- Parameter add/edit UI: Claude's discretion on inline list vs expandable cards
- No reordering - parameters appear in creation order
- Required flag UI: Claude's discretion (checkbox or toggle based on app patterns)
- Deleting a param used in template: warn but allow (broken tag remains, creator's responsibility)

### Creation Flow Structure

- Modal dialog (follows existing resource creation pattern)
- No drafts - must complete and publish in one session
- Form structure: Claude's discretion (single page vs tabs based on content)
- After publishing: close modal + success toast, stay on current page

### Pricing & Settings UX

- Price input with $ prefix, value in USDC
- Minimum price $0.01 (enforced)
- max_tokens: plain number input
- allows_user_message toggle placement: Claude's discretion

### Claude's Discretion

- Parameter UI style (inline list vs expandable cards)
- Required flag UI pattern (checkbox vs toggle)
- Form structure (single page vs tabs)
- Editor max height before scrolling
- allows_user_message toggle placement

</decisions>

<specifics>
## Specific Ideas

- The main goal with tag styling is user awareness that tags exist - not fancy IDE features
- Insert param button only shows existing params (can't create new param from there)
- Follows existing CreateResourceModal patterns

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

_Phase: 02-creator-template-ui_
_Context gathered: 2026-01-19_
