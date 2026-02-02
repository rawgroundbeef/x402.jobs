# Phase 13: API Key Integration UI - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can add their OpenRouter API key in Settings → Integrations. One key per user, can be updated or removed. Follows existing integration card patterns (Claude, Discord, Telegram).

</domain>

<decisions>
## Implementation Decisions

### Update & Delete Flows

- Replace in-place: click edit, paste new key, save (same field, no delete-then-add)
- Delete confirmation shows affected resource count: "You have X resources using this key. They will stop working."
- On key deletion: resources automatically unpublished (hidden from public listings)
- On key re-added: previously-unpublished resources auto-republish

### Claude's Discretion

- Key input UX (paste flow, validation, error messages, loading states)
- Key display masking format
- Card layout and positioning within Integrations page
- Help links and status indicators

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing integration card patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 13-api-key-integration-ui_
_Context gathered: 2026-01-26_
