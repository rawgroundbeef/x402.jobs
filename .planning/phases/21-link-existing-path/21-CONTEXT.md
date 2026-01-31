# Phase 21: Link Existing Path - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Users validate an existing x402 endpoint and create a resource from it, with full x402check results displayed in the wizard. The validation step uses x402check components imported as-is. Valid endpoints pre-fill network and price into the details step. This phase makes the Link Existing flow end-to-end functional (Type Selection -> Validate -> Details -> Review -> Publish).

</domain>

<decisions>
## Implementation Decisions

### Results display
- Large full-width colored banner for the verdict (green for valid, red for invalid) with verdict text, error count, and warning count
- Detail sections (warnings, parsed config, endpoint checks, response body) all default to collapsed — verdict banner tells the story
- Errors and warnings distinguished with color-coded badges: red badges for errors, amber/yellow badges for warnings, shown as counts next to section headers
- x402check result display components imported and used as-is — no restyling, consistent with x402check.com

### Pre-fill behavior
- Network and price fields are locked (read-only) on the details step when pre-filled from validation — prevents mismatch between endpoint config and resource listing
- x402check is treated as the source of truth — if validation passes, network and price will always be detected. No partial detection handling needed; if x402check can't detect something, that's an x402check bug to fix upstream
- Parsed config section (chain, address, amount, format) from x402check results is sufficient to show what was detected — no additional pre-fill summary needed
- Detected values visible on the validation step itself via the parsed config expandable section, then locked into details step

### Claude's Discretion
- Validation trigger UX (button placement, loading states)
- Error and edge state handling (invalid URLs, network errors, timeouts)
- Re-validation flow if user changes URL
- Layout and spacing of results within the wizard step

</decisions>

<specifics>
## Specific Ideas

- x402check components should be imported directly, matching the look of x402check.com
- The verdict banner should be prominent — this is the most important information on the page

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-link-existing-path*
*Context gathered: 2026-01-31*
