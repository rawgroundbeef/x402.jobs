# Phase 10: Storage Integration + Results Display - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate x402.storage API in job completion flow and display permanent URLs in results. When a job with x402storage destination enabled completes, POST the output to x402.storage API and show the returned URLs in the OutputNode. Upload timing, retry logic, and error handling are part of this phase.

</domain>

<decisions>
## Implementation Decisions

### Results URL display

- URLs appear **below output content** in OutputNode, not in header or inline
- Subtle section, visually separated from the output itself
- Display **full URL** (https://x402.storage/bafybei...) with middle truncated
- Section labeled **"📦 Stored permanently"**
- Each URL has a **copy button** as primary action

### Multi-output display

- **Stacked list** format — each file on its own row
- Show filename for context: `📦 report.pdf     x402.storage/bafybei...  [Copy]`
- One copy button per URL
- No accordion or collapsing — links visible immediately

### Receipt line item

- **Separate line item** in job receipt, not bundled into total
- Label: **"x402.storage"** (service name)
- When multiple files: **"x402.storage (3)"** — count in parentheses when >1
- Single file: just "x402.storage" (no count)
- **No links in receipt** — receipt is costs only, URLs shown in OutputNode

### Claude's Discretion

- Upload timing within job completion flow
- Retry behavior on storage failure
- Error message wording
- URL truncation algorithm (middle ellipsis)

</decisions>

<specifics>
## Specific Ideas

Receipt format example:

```
Job execution    $0.05
x402.storage (3) $0.03
─────────────────────
Total            $0.08
```

OutputNode format example:

```
┌─────────────────────────────────────┐
│  [Output content/preview]           │
│                                     │
├─────────────────────────────────────┤
│  📦 Stored permanently              │
│  report.pdf   x402.storage/bafybei... [Copy] │
│  chart.png    x402.storage/bafybeig.. [Copy] │
└─────────────────────────────────────┘
```

- Transparency is key — user opted into +$0.01, they should see it charged
- Output is what they care about, URL is metadata tucked below

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 10-storage-integration_
_Context gathered: 2026-01-25_
