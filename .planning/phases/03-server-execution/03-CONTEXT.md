# Phase 3: Server-Side Execution Engine - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side execution engine that handles prompt template resource calls. When a caller hits `api.x402.jobs/@{username}/{slug}` for a prompt_template resource, the server substitutes parameters, calls Claude with the creator's encrypted API key, and streams the response back. Payment integration (x402) is handled in Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Streaming format

- Claude's Discretion: Protocol choice (SSE vs newline-delimited JSON) — pick based on codebase patterns
- Claude's Discretion: Metadata in stream (tokens only vs rich events) — determine appropriate level
- Claude's Discretion: Mid-stream error handling — decide how to signal errors
- Claude's Discretion: Non-streaming mode support — determine if both modes needed

### Error responses

- Validate parameters BEFORE payment — reject invalid requests before x402 charge
- Refunds handled by x402/OpenFacilitator middleware — endpoint just reports success/failure
- Claude's Discretion: Error message specificity (generic vs detailed API key errors)
- Claude's Discretion: Error format — match existing codebase patterns

### Testing flow

- Creator-only free testing — only template owner can test without payment
- Claude's Discretion: Whether pre-publish testing is supported
- Claude's Discretion: Test button placement in UI
- Claude's Discretion: Test run logging approach (separate vs unified)

### Request/response contract

- URL pattern: `api.x402.jobs/@{username}/{slug}` — follows existing x402 resource pattern
- Claude's Discretion: Input format (POST body structure)
- Claude's Discretion: Response metadata (token counts, timing)

</decisions>

<specifics>
## Specific Ideas

- The existing x402 infrastructure handles payment and refunds via @openfacilitator/sdk and pay.x402.jobs facilitator
- Follow existing resource type patterns for how the server routes and handles different resource types

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 03-server-execution_
_Context gathered: 2026-01-19_
