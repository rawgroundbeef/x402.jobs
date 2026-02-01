# Phase 26: Fix Link Existing Publish - Research

**Researched:** 2026-02-01
**Domain:** Next.js frontend API integration, resource registration endpoints
**Confidence:** HIGH

## Summary

Research confirms the gap identified in the milestone audit: the Link Existing publish flow sends requests to the wrong API endpoint. The platform has TWO distinct resource creation endpoints serving fundamentally different purposes:

1. **POST /api/resources** - Registers EXTERNAL resources (Link Existing). User provides a URL to an x402-enabled endpoint they host elsewhere. The platform catalogs it but does not host or proxy it.

2. **POST /api/resources/instant** - Creates INSTANT resources (Proxy, Claude Prompt, OpenRouter). The platform generates a URL like `https://x402.com/@username/slug` and hosts/executes the resource.

The review page currently sends ALL resource types to `/resources/instant`, including Link Existing. This causes a 400 error because the instant endpoint explicitly rejects the "external" resource type (it's not in the `validTypes` array at line 1809-1815 of resources.ts).

**Primary recommendation:** Route Link Existing publish requests to `POST /api/resources` instead of `/api/resources/instant`. All other types continue using `/instant`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.x | Frontend framework | Already in use, handles routing and API calls |
| authenticatedFetch | N/A | API client helper | Existing utility in `/lib/api.ts` for authenticated requests |
| x402check | 0.2.0 | x402 config validation | Already integrated, used in Link Existing validation step |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | Latest | Request validation | Currently used for form validation, could validate API payloads |

**Installation:**
No new packages required. All necessary tooling is already installed.

## Architecture Patterns

### Recommended Approach

**Pattern: Type-based endpoint routing**

The review page should route to different endpoints based on resource type:

```typescript
// In review/page.tsx handlePublish
const endpoint = draft.type === "link"
  ? "/resources"           // External registration
  : "/resources/instant";  // Instant resource creation

const res = await authenticatedFetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
```

### Request Body Mapping

**For Link Existing (POST /api/resources):**
```typescript
{
  resourceUrl: string,      // The external URL being registered
  network: string,          // "base" | "solana"
  name: string,
  payTo: string,            // Wallet address from verification
  description?: string,
  category?: string,
  avatarUrl?: string,
  maxAmountRequired?: string,  // From verification (lamports/wei)
  asset?: string,              // Token contract address
  mimeType?: string,
  maxTimeoutSeconds?: number,
  outputSchema?: object,
  extra?: object,
  isA2A?: boolean,
  supportsRefunds?: boolean
}
```

**For Instant Resources (POST /api/resources/instant):**
```typescript
{
  resourceType: string,     // "proxy" | "prompt_template" | "openrouter_instant"
  name: string,
  priceUsdc: number,        // Decimal price (e.g., 0.01)
  network?: string,         // Defaults to "base"
  category?: string,
  avatarUrl?: string,
  slug?: string,            // Optional custom slug
  // Type-specific fields (proxyOriginUrl, systemPrompt, etc.)
}
```

### Key Differences

| Field | Link Existing | Instant Resources |
|-------|---------------|-------------------|
| Endpoint | `/api/resources` | `/api/resources/instant` |
| URL source | User provides `resourceUrl` | Platform generates from username/slug |
| Price format | `maxAmountRequired` (lamports/wei string) | `priceUsdc` (decimal number) |
| Type field | No `resourceType` (defaults to "external") | `resourceType` required |
| Wallet field | `payTo` required (from verification) | `payTo` derived from user's wallet |
| Config fields | None (external handles own logic) | Type-specific (proxyOriginUrl, etc.) |

### Pattern: Data Transformation

Link Existing requires converting verification results into the registration payload:

```typescript
// Source: Current implementation at review/page.tsx:60-77 + verification data
// The wizard already has most data, but needs to extract from linkConfig

if (draft.type === "link" && draft.linkConfig) {
  // Basic fields from draft
  body = {
    resourceUrl: draft.linkConfig.url,
    network: draft.network,
    name: draft.name!.trim(),
    description: draft.description?.trim() || null,
    category: draft.category,
    avatarUrl: draft.imageUrl?.trim() || null,
  };

  // Payment fields from verification results
  // These were extracted during validation step and saved in linkConfig
  // Need to retrieve from checkResult.summary[0]
  Object.assign(body, {
    payTo: linkConfig.payTo,
    maxAmountRequired: linkConfig.amount,
    asset: linkConfig.asset,
    mimeType: linkConfig.mimeType,
    maxTimeoutSeconds: linkConfig.maxTimeoutSeconds,
    outputSchema: linkConfig.outputSchema,
    isA2A: linkConfig.isA2A,
    supportsRefunds: linkConfig.supportsRefunds,
  });
}
```

### Anti-Patterns to Avoid

- **Mapping "link" to "external" resourceType:** The `/resources` endpoint doesn't use resourceType field at all (defaults to "external" in database). Including `resourceType: "external"` is harmless but unnecessary.
- **Sending to /instant with "external":** Never works - instant endpoint explicitly validates against allowed types.
- **Converting price to USDC for Link Existing:** The standard endpoint expects `maxAmountRequired` in lamports/wei, not decimal USDC.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-to-endpoint routing | Complex conditional logic | Simple ternary based on draft.type | Only two options, clear semantics |
| Wallet address resolution | Frontend wallet lookup | Let API handle `payTo` from verification | API already has this logic for external resources |
| Price conversion | Manual lamports/wei to USDC | Use verified `maxAmountRequired` directly | Verification already provides correct format |

**Key insight:** The verification step (`/api/v1/resources/verify`) already extracts all payment configuration from the external endpoint. This data is in `verifyResponse.checkResult.summary[0]` but is NOT currently saved to linkConfig. The minimal fix stores this data during validation and includes it in the publish request.

## Common Pitfalls

### Pitfall 1: Incomplete linkConfig Storage
**What goes wrong:** Link Existing validation extracts network, price, payTo, and other fields from the verification response, but only saves url, method, network, and price to linkConfig. At publish time, the API requires payTo, maxAmountRequired, and asset fields which are missing.

**Why it happens:** Phase 21 implementation saved minimal data to linkConfig, assuming the review page wouldn't need the full verification results. The milestone audit revealed this gap.

**How to avoid:** During validation (link/page.tsx lines 108-139), save the full first accept option from `verifyResponse.checkResult.summary[0]` to linkConfig:
```typescript
const summary = verifyResponse.checkResult.summary?.[0];
saveDraft({
  linkConfig: {
    url: verifyResponse.normalizedUrl || url,
    method: method,
    payTo: summary.payTo,
    amount: summary.amount,
    asset: summary.asset,
    assetDecimals: summary.assetDecimals,
    network: summary.network,
    mimeType: summary.mimeType,
    maxTimeoutSeconds: summary.maxTimeoutSeconds,
    outputSchema: summary.outputSchema,
    isA2A: summary.isA2A,
    supportsRefunds: summary.extra?.supportsRefunds,
  },
});
```

**Warning signs:**
- 400 error "Missing required fields: resourceUrl, network, name, payTo"
- Console logs showing linkConfig with only url and method

### Pitfall 2: Wrong Endpoint Selection
**What goes wrong:** Sending Link Existing to `/resources/instant` results in 400 error "Invalid resourceType. Must be one of: proxy, prompt, static, prompt_template, openrouter_instant".

**Why it happens:** All instant resources are platform-hosted, but Link Existing points to an external URL. The endpoints have fundamentally different purposes.

**How to avoid:** Route based on resource type before constructing body:
```typescript
const isLinkExisting = draft.type === "link";
const endpoint = isLinkExisting ? "/resources" : "/resources/instant";
```

**Warning signs:**
- Error message mentioning "external" not in validTypes
- 400 response from `/resources/instant` for Link Existing

### Pitfall 3: Mixing Request Body Formats
**What goes wrong:** Including instant-specific fields (resourceType, priceUsdc) when calling `/api/resources`, or external-specific fields (resourceUrl, payTo) when calling `/api/resources/instant`.

**Why it happens:** Trying to unify the request body construction for all resource types.

**How to avoid:** Build completely separate body objects based on endpoint:
```typescript
let body: Record<string, unknown>;

if (draft.type === "link") {
  // Build external resource body (no resourceType field)
  body = {
    resourceUrl: linkConfig.url,
    network: draft.network,
    name: draft.name,
    payTo: linkConfig.payTo,
    // ... other external fields
  };
} else {
  // Build instant resource body (no resourceUrl field)
  body = {
    resourceType: TYPE_TO_API[draft.type!],
    name: draft.name,
    priceUsdc: parseFloat(draft.price!),
    // ... other instant fields
  };
}
```

**Warning signs:**
- API ignoring unexpected fields silently
- 400 errors about missing required fields despite sending data

## Code Examples

Verified patterns from codebase analysis:

### Current Broken Implementation (review/page.tsx)
```typescript
// Source: apps/web/src/app/dashboard/resources/new/review/page.tsx:51-117
// Problem: ALL types go to /resources/instant
const handlePublish = async () => {
  // ... validation ...

  const body: Record<string, unknown> = {
    resourceType: TYPE_TO_API[draft.type!] || draft.type,  // "external" for link
    name: draft.name!.trim(),
    // ... common fields ...
  };

  if (draft.type === "link" && draft.linkConfig) {
    Object.assign(body, {
      resourceUrl: draft.linkConfig.url,      // Wrong: instant doesn't expect this
      httpMethod: draft.linkConfig.method,
    });
  }

  const res = await authenticatedFetch("/resources/instant", {  // Wrong endpoint!
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // ... error handling ...
};
```

### Correct Implementation Pattern
```typescript
// Source: Based on old RegisterResourceModal flow (git show 5d5a15c^)
// Pattern: Route to different endpoints, build appropriate bodies

const handlePublish = async () => {
  if (!draft) return;
  setIsPublishing(true);
  setPublishError("");

  try {
    let endpoint: string;
    let body: Record<string, unknown>;

    if (draft.type === "link" && draft.linkConfig) {
      // Link Existing: use standard external resource registration
      endpoint = "/resources";
      body = {
        resourceUrl: draft.linkConfig.url,
        network: draft.network!,
        name: draft.name!.trim(),
        description: draft.description?.trim() || undefined,
        category: draft.category,
        avatarUrl: draft.imageUrl?.trim() || undefined,
        // Payment fields from verification
        payTo: draft.linkConfig.payTo,
        maxAmountRequired: draft.linkConfig.amount,
        asset: draft.linkConfig.asset,
        mimeType: draft.linkConfig.mimeType || "application/json",
        maxTimeoutSeconds: draft.linkConfig.maxTimeoutSeconds,
        outputSchema: draft.linkConfig.outputSchema,
        extra: draft.linkConfig.extra,
        isA2A: draft.linkConfig.isA2A || false,
        supportsRefunds: draft.linkConfig.supportsRefunds || false,
      };
    } else {
      // Instant resources: proxy, claude, openrouter
      endpoint = "/resources/instant";
      body = {
        resourceType: TYPE_TO_API[draft.type!] || draft.type,
        name: draft.name!.trim(),
        slug: draft.slug!.trim(),
        description: draft.description?.trim() || null,
        priceUsdc: parseFloat(draft.price!),
        network: draft.network,
        category: draft.category,
        avatarUrl: draft.imageUrl?.trim() || null,
      };

      // Add type-specific fields for instant resources
      if (draft.type === "proxy" && draft.proxyConfig) {
        Object.assign(body, {
          proxyOriginUrl: draft.proxyConfig.originUrl,
          proxyMethod: draft.proxyConfig.method,
          proxyAuthHeader: draft.proxyConfig.authHeader || null,
        });
      }
      // ... claude and openrouter configs ...
    }

    const res = await authenticatedFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to create resource");
    }

    const responseData = await res.json();
    clearDraft();

    // Navigate to resource detail page
    // External: uses responseData.resource.slug
    // Instant: uses draft.slug
    const slug = draft.type === "link"
      ? responseData.resource.slug
      : draft.slug;
    router.push(`/${username}/${slug}`);
  } catch (err) {
    setPublishError(
      err instanceof Error ? err.message : "Failed to publish resource"
    );
  } finally {
    setIsPublishing(false);
  }
};
```

### Validation Step Enhancement (link/page.tsx)
```typescript
// Source: apps/web/src/app/dashboard/resources/new/link/page.tsx:107-139
// Enhancement: Save full verification results to linkConfig

const handleContinue = () => {
  if (!verifyResponse?.valid || !verifyResponse.checkResult) {
    return;
  }

  const summary = verifyResponse.checkResult.summary?.[0];
  if (!summary) {
    return;
  }

  // Normalize network
  const normalizedNetwork = normalizeNetworkId(summary.network) || "solana";

  // Convert price from lamports/wei to decimal for UI display
  const decimals = summary.assetDecimals || 6;
  const amountNum = parseInt(summary.amount, 10);
  const price = (amountNum / 10 ** decimals).toString();

  // Save comprehensive data for publish step
  saveDraft({
    resourceUrl: verifyResponse.normalizedUrl || url,
    network: normalizedNetwork,
    price: price,
    preFilled: { network: true, price: true },
    linkConfig: {
      // User-provided fields
      url: verifyResponse.normalizedUrl || url,
      method: method,
      // Extracted from verification (needed for registration)
      payTo: summary.payTo,
      amount: summary.amount,  // Keep as lamports/wei string
      asset: summary.asset,
      assetDecimals: summary.assetDecimals,
      network: summary.network,  // Original CAIP-2 format
      mimeType: summary.mimeType,
      maxTimeoutSeconds: summary.maxTimeoutSeconds,
      outputSchema: summary.outputSchema,
      isA2A: summary.isA2A,
      extra: summary.extra,
      supportsRefunds: summary.extra?.supportsRefunds,
    },
  });

  router.push("/dashboard/resources/new/details");
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modal-based registration | Full-page wizard | Phase 19-25 (2026-01) | Better UX, but introduced endpoint routing bug |
| Backend-only verification | x402check client-side + backend proxy | Phase 21 (2026-01) | Faster validation, reusable components |
| Single endpoint routing | Should be type-based routing | Gap identified 2026-02-01 | Need to restore dual-endpoint pattern |

**Deprecated/outdated:**
- CreateResourceModal: Removed in Phase 25, had correct endpoint routing for external resources
- RegisterResourceModal: Removed in Phase 25, called `/resources` for external registration
- TYPE_TO_API mapping: Currently maps link→"external" but this field isn't used by `/resources` endpoint

## Open Questions

1. **Should slug be required for Link Existing?**
   - What we know: Standard endpoint generates slug from name if not provided (line 1544-1551)
   - What's unclear: Does the frontend need to send customSlug, or rely on API generation?
   - Recommendation: Let API generate slug. The wizard collects slug but it's only needed for instant resources that use it in the generated URL. External resources already have their own URL.

2. **Should Link Existing support custom slug?**
   - What we know: External resources get a slug for the platform's catalog page (e.g., /servers/:serverSlug/:resourceSlug)
   - What's unclear: Is there value in letting users customize this vs auto-generating from name?
   - Recommendation: Phase 26 should NOT send slug for Link Existing (let API generate). Future enhancement could add custom slug support if users request it.

3. **Should httpMethod field be stored?**
   - What we know: The review page includes `httpMethod: draft.linkConfig.method` in the body
   - What's unclear: The standard endpoint doesn't have an httpMethod parameter in its signature
   - Recommendation: Drop httpMethod from the payload. It's not used by the API. The method was only needed for the verification step.

## Sources

### Primary (HIGH confidence)
- Backend API codebase: `/Users/rawgroundbeef/Projects/x402jobs-api/src/routes/resources.ts`
  - POST /api/resources endpoint (lines 1430-1688) - external resource registration with upsert logic
  - POST /api/resources/instant endpoint (lines 1762-2140) - instant resource creation with type validation
  - validTypes array (lines 1809-1815) - confirms "external" not allowed for instant endpoint
- Frontend review page: `apps/web/src/app/dashboard/resources/new/review/page.tsx`
  - Current broken implementation sending all types to /instant (line 96)
  - TYPE_TO_API mapping (line 14-19)
  - Body construction with type-specific fields (lines 60-94)
- Link validation page: `apps/web/src/app/dashboard/resources/new/link/page.tsx`
  - Verification flow using /api/v1/resources/verify (lines 77-105)
  - Data saved to linkConfig (lines 126-136)
- Deleted RegisterResourceModal: `git show 5d5a15c^:apps/web/src/components/modals/RegisterResourceModal.tsx`
  - Old working pattern for external resource registration
  - Used POST /api/resources with correct field mapping

### Secondary (MEDIUM confidence)
- Database schema: `migrations/001_initial_schema.sql`
  - resource_type field default and check constraint (lines 168, 200)
  - Confirms "external" is valid database value
- Milestone audit: `.planning/v2.0-MILESTONE-AUDIT.md`
  - Gap identification with specific line numbers
  - Requirements status showing Link Existing as PARTIAL

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already integrated, no new dependencies
- Architecture: HIGH - Clear endpoint separation confirmed in backend code
- Pitfalls: HIGH - Specific error messages and field requirements verified from API code

**Research date:** 2026-02-01
**Valid until:** 60 days (backend API structure is stable, unlikely to change)
