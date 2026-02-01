# Phase 10: Storage Integration + Results Display - Research

**Researched:** 2026-01-25
**Domain:** x402.storage API integration, IPFS/CID handling, React async patterns, graceful degradation
**Confidence:** MEDIUM

## Summary

Phase 10 integrates x402.storage API in job completion flow and displays permanent IPFS URLs in results. The implementation spans two critical areas: (1) POST to external API with x402 payment protocol during job completion, and (2) display returned CID URLs with copy functionality in OutputNode.

The technical foundation is already in place: the codebase uses `authenticatedFetch` for HTTP requests, WebSocket events for job completion tracking, and established patterns for displaying job results. The x402 payment protocol uses PAYMENT-SIGNATURE headers following EIP-712 standard. IPFS CIDs returned from x402.storage will use base32 encoding (CIDv1 format starting with "bafy...") for URL compatibility.

Key insight: This phase involves client-side API calls to external service (x402.storage) from the job completion flow. The codebase pattern is to handle API integration in `useRunTracking.ts` which already subscribes to WebSocket `run:completed` events. Storage must gracefully degrade on failure without blocking job completion.

**Primary recommendation:** Implement storage upload in `useRunTracking.ts` within the `run:completed` event handler, after job execution completes. Use try-catch with graceful degradation - store URLs in OutputNode's result data structure on success, show error state on failure. Follow existing patterns for authenticated API calls and result display.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library             | Version     | Purpose                   | Why Standard                             |
| ------------------- | ----------- | ------------------------- | ---------------------------------------- |
| fetch (native)      | Browser API | HTTP POST to x402.storage | Native Web API, no dependencies needed   |
| navigator.clipboard | Browser API | Copy URL to clipboard     | Standard Clipboard API, widely supported |
| WebSocket           | Browser API | Job completion events     | Already in use via useWebSocket.ts       |

### Supporting

| Library     | Version | Purpose            | When to Use                       |
| ----------- | ------- | ------------------ | --------------------------------- |
| SWR         | Current | Cache invalidation | Already used throughout codebase  |
| React hooks | 18+     | State management   | useEffect for completion handlers |

### Alternatives Considered

| Instead of          | Could Use               | Tradeoff                                       |
| ------------------- | ----------------------- | ---------------------------------------------- |
| fetch               | Axios with retry plugin | Adds dependency, provides built-in retry logic |
| navigator.clipboard | react-copy-to-clipboard | Adds dependency for minimal benefit            |
| WebSocket events    | Polling                 | Less real-time, already have WebSocket         |

**Installation:**
No new dependencies required - use native browser APIs and existing codebase utilities.

## Architecture Patterns

### Recommended Integration Points

```
src/
├── components/
│   └── pages/JobCanvas/lib/
│       └── useRunTracking.ts     # Add storage upload in run:completed handler
├── components/workflow/nodes/
│   └── OutputNode.tsx            # Add URL display section
├── types/
│   └── output-config.ts          # Already has x402storage type ✓
└── lib/
    └── api.ts                    # authenticatedFetch for API calls ✓
```

### Pattern 1: Storage Upload in Job Completion Flow

**What:** POST to x402.storage when job completes with x402storage destination enabled

**When to use:** Within `run:completed` WebSocket event handler in useRunTracking.ts

**Example:**

```typescript
// In useRunTracking.ts, within run:completed handler
const unsubCompleted = subscribe<RunCompletedEvent>(
  "run:completed",
  async (event) => {
    // Existing completion logic...

    // NEW: Check if x402storage is enabled
    const outputNode = nodes.find((n) => n.type === "output");
    const hasStorageEnabled =
      outputNode?.data?.outputConfig?.destinations?.some(
        (d) => d.type === "x402storage" && d.enabled,
      );

    if (hasStorageEnabled && event.status === "completed") {
      try {
        // Get output content from event
        const outputContent = event.output || event.outputText;

        // POST to x402.storage API
        const response = await fetch("https://api.x402.storage/store", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "PAYMENT-SIGNATURE": await createPaymentSignature(0.01),
          },
          body: JSON.stringify({ content: outputContent }),
        });

        const { cid, url } = await response.json();

        // Update OutputNode with storage URL
        updateNodeWithStorageUrl(outputNode.id, url);
      } catch (err) {
        // Graceful degradation - show error but don't fail job
        console.error("Storage upload failed:", err);
        updateNodeWithStorageError(outputNode.id, err.message);
      }
    }
  },
);
```

### Pattern 2: URL Display with Copy Button

**What:** Display IPFS URLs below output content with copy functionality

**When to use:** In OutputNode.tsx when result includes x402storageUrls

**Example:**

```typescript
// In OutputNode.tsx, after output content display
{data.x402storageUrls && data.x402storageUrls.length > 0 && (
  <div className="mt-3 pt-3 border-t border-border/50">
    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
      <Globe className="w-3 h-3 text-emerald-500" />
      <span>Stored permanently</span>
    </div>
    {data.x402storageUrls.map((urlData, idx) => (
      <div key={idx} className="flex items-center gap-2 text-xs">
        {urlData.filename && (
          <span className="text-muted-foreground">{urlData.filename}</span>
        )}
        <span className="font-mono truncate flex-1">
          {truncateMiddle(urlData.url, 40)}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(urlData.url)}
          className="px-2 py-1 bg-muted hover:bg-accent rounded"
        >
          Copy
        </button>
      </div>
    ))}
  </div>
)}
```

### Pattern 3: Graceful Degradation for Failed Upload

**What:** Storage failure shows error message but preserves job output

**When to use:** In error handling for x402.storage POST request

**Example:**

```typescript
// Graceful degradation pattern
try {
  const storageResult = await uploadToStorage(output);
  // Success - add URLs to result
  updateResult({ output, storageUrls: [storageResult.url] });
} catch (err) {
  // Failure - preserve output, add error state
  updateResult({
    output,
    storageError: err.message,
    storageUrls: [],
  });
  // Optional: Show toast notification
  toast({
    title: "Storage upload failed",
    description: err.message,
    variant: "warning",
  });
}
```

### Anti-Patterns to Avoid

- **Blocking job completion on storage failure:** Storage is optional enhancement - job should complete successfully even if storage POST fails
- **POSTing before job completes:** Wait for run:completed event, not run:step - need full output content
- **Storing full output in URL array:** Only store { url, filename, cid }, not the content itself
- **Hardcoding CID format assumptions:** CIDs can be base32 or base58, handle both formats
- **No retry on transient failures:** Implement at least one retry with exponential backoff

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem               | Don't Build           | Use Instead                           | Why                                           |
| --------------------- | --------------------- | ------------------------------------- | --------------------------------------------- |
| URL middle truncation | Custom string slicing | react-middle-truncate or CSS ellipsis | Handles dynamic container width, font metrics |
| Clipboard copy        | document.execCommand  | navigator.clipboard.writeText         | Modern API, returns Promise, better security  |
| Retry logic           | setTimeout loops      | exponential-backoff npm               | Handles jitter, max attempts, cancellation    |
| CID validation        | Regex patterns        | multiformats/cid library              | Handles CIDv0, CIDv1, all encodings           |
| Payment signature     | Custom crypto         | Existing wallet integration           | Already handles EIP-712 signing               |

**Key insight:** The codebase already has patterns for authenticated API calls (`authenticatedFetch`), WebSocket event handling (`useWebSocket`), and result display (OutputNode). Don't rebuild these - extend them.

## Common Pitfalls

### Pitfall 1: Uploading Before Job Completes

**What goes wrong:** Attempting to POST to x402.storage on individual `run:step` events instead of `run:completed`

**Why it happens:** Confusion between per-node completion (run:step) and full job completion (run:completed)

**How to avoid:** Only trigger storage upload in `run:completed` handler when `event.status === "completed"`. Check OutputNode has actual content before POSTing.

**Warning signs:** Multiple storage POSTs for single job run, empty content uploads

### Pitfall 2: Not Handling Multiple Outputs

**What goes wrong:** Assuming single output URL when job could produce multiple files

**Why it happens:** Initial implementation focuses on simple case, JCOMP-06 requires multiple file support

**How to avoid:** Design data structure as array from start: `x402storageUrls: Array<{url, filename, cid}>`. Loop through outputs if result is object with multiple fields.

**Warning signs:** Second output file overwrites first, only last URL displayed

### Pitfall 3: Storage Failure Breaks Job

**What goes wrong:** Uncaught exception in storage POST causes job to show failed status

**Why it happens:** Missing try-catch around external API call, treating storage as critical path

**How to avoid:** Wrap entire storage flow in try-catch. Update result even on error (with error flag). Job completion is independent of storage success.

**Warning signs:** Jobs marked failed when x402.storage is down, loss of job output on storage error

### Pitfall 4: Payment Header Missing/Incorrect

**What goes wrong:** x402.storage API returns 402 Payment Required, upload fails silently

**Why it happens:** PAYMENT-SIGNATURE header format incorrect or missing wallet signature

**How to avoid:** Follow x402 v2 protocol exactly - header must contain EIP-712 signed payment payload for $0.01. Test with invalid header to verify error handling.

**Warning signs:** All storage uploads return 402, no helpful error messages in console

### Pitfall 5: CID URL Format Assumptions

**What goes wrong:** Displaying CIDs with wrong gateway URL, broken links

**Why it happens:** Assuming base58 (Qm...) format when x402.storage returns base32 (bafy...)

**How to avoid:** Use URL from API response directly, don't reconstruct from CID. If truncating, preserve URL scheme and domain.

**Warning signs:** Links show 404, URLs missing https:// prefix

## Code Examples

Verified patterns from official sources and existing codebase:

### Clipboard API with User Feedback

```typescript
// Source: https://blog.logrocket.com/implementing-copy-clipboard-react-clipboard-api/
const [copied, setCopied] = useState(false);

const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500); // Reset after 1.5s
  } catch (err) {
    console.error("Copy failed:", err);
    // Fallback to older method if needed
    fallbackCopy(text);
  }
};

// In render:
<button onClick={() => handleCopy(url)}>
  {copied ? "Copied!" : "Copy"}
</button>
```

### Exponential Backoff for API Retry

```typescript
// Source: https://dev.to/abhivyaktii/retrying-failed-requests-with-exponential-backoff-48ld
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status === 402) {
        return response; // Success or payment required (don't retry)
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        // Wait with exponential backoff + jitter
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### URL Middle Truncation (Simple CSS Approach)

```typescript
// For simple cases, CSS is sufficient (no library needed)
// Source: Existing codebase pattern
function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;

  const start = Math.ceil(maxLength / 2);
  const end = Math.floor(maxLength / 2) - 3; // Account for "..."

  return str.slice(0, start) + "..." + str.slice(-end);
}

// Or use CSS for responsive truncation:
// <span className="truncate max-w-full">{url}</span>
```

### Existing Pattern: Authenticated API Call

```typescript
// Source: src/lib/api.ts (existing codebase)
import { authenticatedFetch } from "@/lib/api";

// For external APIs with custom headers
const response = await authenticatedFetch("https://api.x402.storage/store", {
  method: "POST",
  headers: {
    "PAYMENT-SIGNATURE": paymentSig,
    // authenticatedFetch adds Authorization header automatically
  },
  body: JSON.stringify({ content: outputData }),
});

if (!response.ok) {
  const error = await response.json().catch(() => ({ error: "Upload failed" }));
  throw new Error(error.error || `HTTP ${response.status}`);
}

const result = await response.json();
```

### Existing Pattern: WebSocket Event Handler

```typescript
// Source: src/components/pages/JobCanvas/lib/useRunTracking.ts
const unsubCompleted = subscribe<RunCompletedEvent>(
  "run:completed",
  (event) => {
    console.log("[RunTracking] run:completed event:", event);

    // Check if this is our run
    if (event.runId !== currentRunIdRef.current) {
      return;
    }

    // Handle failure case
    if (event.status === "failed") {
      // Update UI to show error
      return;
    }

    // Handle success case
    // NEW: Add storage upload here
  },
);
```

## State of the Art

| Old Approach         | Current Approach              | When Changed | Impact                                         |
| -------------------- | ----------------------------- | ------------ | ---------------------------------------------- |
| CIDv0 base58 (Qm...) | CIDv1 base32 (bafy...)        | 2019-2020    | Case-insensitive, subdomain gateway compatible |
| API keys for IPFS    | x402 payment headers          | 2025         | No accounts needed, pay-per-use                |
| document.execCommand | navigator.clipboard           | 2020+        | Promise-based, better security model           |
| Manual retry loops   | Exponential backoff libraries | Ongoing      | Handles jitter, thundering herd                |

**Deprecated/outdated:**

- **document.execCommand('copy'):** Use navigator.clipboard.writeText() - modern API with better security
- **Pinata API key pattern:** x402.storage uses payment headers, no API key management
- **Base58 CID assumption:** x402.storage returns base32 CIDv1 for gateway compatibility

## Open Questions

Things that couldn't be fully resolved:

1. **Where exactly does x402.storage upload happen - frontend or backend?**
   - What we know: Job completion flow is tracked in useRunTracking.ts (frontend), but actual execution is backend
   - What's unclear: Whether backend (x402-jobs-api) should POST to x402.storage, or frontend should do it
   - Recommendation: Frontend approach is cleaner - backend already completes job, frontend handles optional storage as enhancement. Matches pattern of Telegram/X output destinations.

2. **How to get PAYMENT-SIGNATURE for x402.storage API?**
   - What we know: Codebase has wallet integration (useWallet.ts), x402 payment protocol requires EIP-712 signature
   - What's unclear: Exact signature creation for $0.01 payment to x402.storage domain
   - Recommendation: Research existing payment signature creation in Phase 5 implementation, reuse that pattern. May need backend helper endpoint if frontend can't sign directly.

3. **How to handle multi-file outputs (JCOMP-06)?**
   - What we know: Job output could be single value, JSON object with multiple fields, or array
   - What's unclear: How to determine which fields represent separate files vs combined data
   - Recommendation: Start with single output POST (entire result), expand to multi-file by detecting common patterns (imageUrl + caption as separate files). Defer complex logic to future iteration.

4. **Should storage URLs persist in database or just in-memory?**
   - What we know: DATA-03 requires "Storage URLs persisted with job history"
   - What's unclear: Whether this needs backend schema change or can use existing result metadata
   - Recommendation: Store in RunEvent.output metadata as x402storageUrls field. Requires backend update to preserve this field. Check with planner if backend changes are in scope.

## Sources

### Primary (HIGH confidence)

- [Next.js Data Fetching Documentation](https://nextjs.org/docs/app/getting-started/fetching-data) - Official patterns for API calls
- [Navigator Clipboard API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard) - Standard clipboard API reference
- [IPFS CIDs Documentation](https://docs.ipfs.tech/concepts/content-addressing/) - CID format and encoding standards
- [x402 Protocol - Coinbase](https://github.com/coinbase/x402) - Official x402 payment protocol spec
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch) - PAYMENT-SIGNATURE header format

### Secondary (MEDIUM confidence)

- [LogRocket: Copy to Clipboard in React](https://blog.logrocket.com/implementing-copy-clipboard-react-clipboard-api/) - React clipboard implementation patterns (2024)
- [Graceful Degradation Guide](https://blog.logrocket.com/guide-graceful-degradation-web-development/) - Error handling best practices (2024)
- [Exponential Backoff with Fetch](https://dev.to/abhivyaktii/retrying-failed-requests-with-exponential-backoff-48ld) - Retry logic patterns (2024)
- [React useEffect Complete Guide](https://blog.logrocket.com/useeffect-react-hook-complete-guide/) - useEffect patterns for API calls (2025)

### Tertiary (LOW confidence - needs validation)

- [react-middle-truncate npm](https://www.npmjs.com/package/react-middle-truncate) - URL truncation component (check current version)
- [exponential-backoff npm](https://www.npmjs.com/package/exponential-backoff) - Retry utility library (verify maintenance status)

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM - Native APIs are confirmed, but x402 payment signature creation needs verification
- Architecture: MEDIUM - Pattern of extending useRunTracking is clear, but payment signature integration uncertain
- Pitfalls: HIGH - Based on common async/API integration pitfalls and existing codebase patterns
- Code examples: HIGH - Verified from official documentation and existing codebase

**Research date:** 2026-01-25
**Valid until:** 30 days (stable domain - browser APIs and established patterns unlikely to change rapidly)

**Key uncertainties requiring planner attention:**

1. PAYMENT-SIGNATURE creation mechanism - may need backend helper or existing wallet pattern
2. Backend schema changes for persisting storage URLs (DATA-02, DATA-03)
3. Multi-file output detection logic (JCOMP-06)
