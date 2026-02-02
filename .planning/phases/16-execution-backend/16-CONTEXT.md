# Phase 16: Execution Backend - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side execution of OpenRouter resources. Decrypt creator's stored API key, substitute parameters into prompt template, call OpenRouter API, return full response to caller via LRO pattern, log usage, and handle errors gracefully.

</domain>

<decisions>
## Implementation Decisions

### Streaming behavior

- No streaming — wait for full OpenRouter response before returning
- Follows existing LRO (Long-Running Operation) pattern used by other async resources
- Timeout behavior matches existing LRO timeout handling
- No progress indication while waiting — standard pending-until-complete polling

### Error messaging

- Full error pass-through from OpenRouter to caller
- All OpenRouter errors fail the job (no retry logic, no distinguishing error types)
- Global platform rate limits for abuse prevention (not per-resource limits)

### Usage logging

- Match existing logging patterns from Claude prompt template execution
- Full content logging — both prompt and response stored
- Creator-only access to execution logs with content
- Keep logs indefinitely — no auto-deletion

### Credit/key failure handling

- Generic failure message to callers ("Resource unavailable") — don't expose key/credit issues
- No proactive notification to creators about key/credit problems — they see failures in dashboard
- No auto-disable of resources when credits depleted — jobs fail, creator discovers via dashboard
- Same generic message for all failure types (key invalid, credits depleted, etc.)

### Claude's Discretion

- Creator notification strategy for key/credit issues (if any)
- Exact error message wording for generic failures
- Rate limit thresholds for global platform limits

</decisions>

<specifics>
## Specific Ideas

- "This is a workflow builder. We use LRO pattern to wait for async resources to complete."
- Match existing patterns wherever possible — timeout handling, logging fields, error behavior

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 16-execution-backend_
_Context gathered: 2026-01-27_
