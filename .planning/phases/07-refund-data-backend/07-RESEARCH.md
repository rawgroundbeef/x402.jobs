# Phase 7: Refund Data Backend - Research

**Researched:** 2026-01-21
**Domain:** Database Schema, x402 Protocol, Backend API
**Confidence:** HIGH

## Summary

This phase adds backend support for the refund badge feature by extracting and storing `supportsRefunds` from x402 `accepts[].extra` responses. The frontend UI components (Phase 6) are already complete and waiting for data.

The x402 protocol specification supports an `extra` field on each `accepts[]` entry that can contain arbitrary metadata, including `supportsRefunds`. The codebase already has established patterns for handling this flow: the `VerifiedResource` interface includes `isA2A` which follows the same extraction pattern, and the registration flow already merges `acceptOption.extra` into stored resource data.

**Primary recommendation:** Add a `supports_refunds BOOLEAN` column to `x402_resources`, update the verify endpoint to extract `supportsRefunds` from `accepts[].extra`, pass it through registration, update the `public_x402_resources` view to expose it, and provide a backfill mechanism for existing resources.

## Standard Stack

The implementation uses existing codebase patterns and tools:

### Core

| Library     | Version | Purpose             | Why Standard          |
| ----------- | ------- | ------------------- | --------------------- |
| Supabase    | 2.x     | Database migrations | Existing stack        |
| Next.js API | 15.x    | Backend endpoints   | Existing architecture |
| TypeScript  | 5.x     | Type safety         | Project standard      |

### Supporting

| Library            | Version | Purpose             | When to Use       |
| ------------------ | ------- | ------------------- | ----------------- |
| authenticatedFetch | N/A     | API calls with auth | Registration flow |
| publicFetcher      | N/A     | SWR data fetching   | Resource listings |

### Alternatives Considered

| Instead of             | Could Use                | Tradeoff                                   |
| ---------------------- | ------------------------ | ------------------------------------------ |
| BOOLEAN column         | JSONB field              | Boolean is simpler, matches is_a2a pattern |
| Database column        | Computed from extra JSON | Column is faster, avoids JSON parsing      |
| Single backfill script | Scheduled re-check       | One-time script is simpler for v1          |

**Installation:**
No new packages needed - all required dependencies exist.

## Architecture Patterns

### Data Flow Pattern

```
x402 Endpoint (402 response)
    |
    v
/api/v1/resources/verify (extract supportsRefunds from accepts[].extra)
    |
    v
Frontend (RegisterResourceModal/CreateResourceModal)
    |
    v
POST /api/v1/resources (pass supportsRefunds in body)
    |
    v
Database x402_resources.supports_refunds column
    |
    v
public_x402_resources view (expose to frontend)
    |
    v
GET /api/v1/resources/{server}/{resource} (return supports_refunds)
    |
    v
Frontend (ResourceDetailPage, ResourceCard - already implemented)
```

### Pattern 1: Field Extraction from x402 Response

**What:** Extract `supportsRefunds` from `accepts[].extra` during verification
**When to use:** When processing 402 responses in the verify endpoint
**Example:**

```typescript
// Source: Existing isA2A pattern in RegisterResourceModal.tsx
interface AcceptOption {
  network: string;
  normalizedNetwork: string;
  payTo: string;
  amount: string;
  asset?: string;
  scheme?: string;
  extra?: Record<string, unknown>; // supportsRefunds lives here
}

// In verify endpoint response processing:
const supportsRefunds = accepts.some(
  (accept) => accept.extra?.supportsRefunds === true,
);
```

### Pattern 2: Column Addition Migration

**What:** Add nullable boolean column with migration
**When to use:** Following existing pt\_\* column pattern
**Example:**

```sql
-- Following pattern from 001_add_prompt_template_fields.sql
ALTER TABLE x402_resources ADD COLUMN IF NOT EXISTS supports_refunds BOOLEAN DEFAULT false;
```

### Pattern 3: View Update for Public Exposure

**What:** Add field to public_x402_resources view
**When to use:** When exposing new fields to unauthenticated requests
**Example:**

```sql
-- Source: 001_add_prompt_template_fields.sql lines 65-87
CREATE OR REPLACE VIEW public_x402_resources AS
SELECT
  id, slug, name, description, resource_url, network,
  price_usdc, resource_type, avatar_url, category,
  created_at, is_active, call_count, total_earned_usdc,
  pt_parameters, pt_model, pt_max_tokens, pt_allows_user_message,
  is_a2a,
  supports_refunds  -- ADD THIS
FROM x402_resources
WHERE is_active = true;
```

### Anti-Patterns to Avoid

- **Parsing extra JSON at read time:** Store the boolean directly, don't query JSON on every read
- **Assuming supportsRefunds is always present:** It's optional, default to false
- **Breaking existing API contracts:** Add field as optional, don't require it

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem            | Don't Build    | Use Instead                  | Why                                    |
| ------------------ | -------------- | ---------------------------- | -------------------------------------- |
| Field extraction   | Custom parsing | Existing extra merge pattern | Lines 253-254 in RegisterResourceModal |
| Boolean column     | Custom type    | PostgreSQL BOOLEAN           | Standard, efficient                    |
| View exposure      | Custom query   | public_x402_resources view   | Established pattern                    |
| API response shape | New endpoint   | Existing resource endpoints  | Consistency                            |

**Key insight:** Follow the `is_a2a` pattern exactly. It was added similarly and flows through the same code paths.

## Common Pitfalls

### Pitfall 1: Forgetting to Update the View

**What goes wrong:** Column added but frontend never sees it
**Why it happens:** Column exists on table but view wasn't recreated
**How to avoid:** Migration must `CREATE OR REPLACE VIEW public_x402_resources`
**Warning signs:** API returns null/undefined for supports_refunds

### Pitfall 2: Not Handling Mixed accepts[] Arrays

**What goes wrong:** Resource shows refund badge incorrectly
**Why it happens:** One accept option supports refunds, another doesn't
**How to avoid:** Any `accepts[].extra.supportsRefunds === true` should enable badge
**Warning signs:** Badge appears inconsistently

### Pitfall 3: Breaking Existing Registrations

**What goes wrong:** Registration fails for resources without supportsRefunds
**Why it happens:** Backend requires field that old x402 endpoints don't provide
**How to avoid:** Field must be optional with default false
**Warning signs:** Registration errors for existing x402 endpoints

### Pitfall 4: Backfill Overwrites Manual Data

**What goes wrong:** Re-verification changes data user manually set
**Why it happens:** Backfill script doesn't check for existing values
**How to avoid:** Only backfill resources where supports_refunds IS NULL or was never set
**Warning signs:** Resources losing custom metadata

### Pitfall 5: External API Rate Limiting

**What goes wrong:** Backfill fails partway through
**Why it happens:** Too many requests to x402 endpoints during re-verification
**How to avoid:** Add delay between backfill requests, implement retry logic
**Warning signs:** Timeout errors, 429 responses

## Code Examples

Verified patterns from the existing codebase:

### AcceptOption Interface with extra Field

```typescript
// Source: /src/components/modals/RegisterResourceModal.tsx:35-43
interface AcceptOption {
  network: string;
  normalizedNetwork: string;
  payTo: string;
  amount: string;
  asset?: string;
  scheme?: string;
  extra?: Record<string, unknown>; // supportsRefunds lives here
}
```

### X402Accept Interface (DeveloperPage)

```typescript
// Source: /src/components/pages/DeveloperPage/components/ResponsePreview.tsx:10-22
interface X402Accept {
  scheme: string;
  network: string;
  maxAmountRequired?: string; // v1
  amount?: string; // v2
  asset: string;
  payTo: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>; // Already defined!
}
```

### Registration Body with isA2A (Pattern to Follow)

```typescript
// Source: /src/components/modals/RegisterResourceModal.tsx:240-256
const res = await authenticatedFetch("/resources", {
  method: "POST",
  body: JSON.stringify({
    resourceUrl: url,
    network: acceptOption.normalizedNetwork,
    name: baseName,
    description: verified.description,
    payTo: acceptOption.payTo,
    maxAmountRequired: acceptOption.amount,
    asset: acceptOption.asset,
    mimeType: verified.mimeType,
    maxTimeoutSeconds: verified.maxTimeoutSeconds,
    outputSchema: verified.outputSchema,
    extra: { ...verified.extra, ...acceptOption.extra }, // extra merged here
    avatarUrl: verified.avatarUrl || verified.extra?.avatarUrl,
    isA2A: verified.isA2A, // ADD: supportsRefunds here
  }),
});
```

### ResourceData Interface with supports_refunds

```typescript
// Source: /src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx:62-106
interface ResourceData {
  // ... existing fields
  is_a2a?: boolean;
  supports_refunds?: boolean; // Already added by Phase 6!
  // ... more fields
}
```

### public_x402_resources View Pattern

```sql
-- Source: /migrations/001_add_prompt_template_fields.sql:65-87
CREATE OR REPLACE VIEW public_x402_resources AS
SELECT
  id, slug, name, description, resource_url, network,
  price_usdc, resource_type, avatar_url, category,
  created_at, is_active, call_count, total_earned_usdc,
  pt_parameters, pt_model, pt_max_tokens, pt_allows_user_message
  -- ADD: is_a2a, supports_refunds
FROM x402_resources
WHERE is_active = true;
```

## x402 Protocol: accepts[].extra Field

### Structure

The x402 protocol v2 supports an `extra` field on each accept option:

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "10000",
      "payTo": "0x...",
      "asset": "0x...",
      "extra": {
        "supportsRefunds": true,
        "facilitator": "openfacilitator"
      }
    }
  ]
}
```

### OpenFacilitator supportsRefunds

- Field location: `accepts[].extra.supportsRefunds`
- Type: boolean
- When true: Resource uses OpenFacilitator with refund protection
- When false/missing: No refund protection guarantee

### Extraction Logic

```typescript
// Check if ANY accept option supports refunds
const supportsRefunds =
  verifyResponse.accepts?.some(
    (accept) => accept.extra?.supportsRefunds === true,
  ) ?? false;
```

## Implementation Approach

### Migration (004_add_supports_refunds.sql)

```sql
-- Add column
ALTER TABLE x402_resources
ADD COLUMN IF NOT EXISTS supports_refunds BOOLEAN DEFAULT false;

-- Update view to include new column and is_a2a
CREATE OR REPLACE VIEW public_x402_resources AS
SELECT
  id, slug, name, description, resource_url, network,
  price_usdc, resource_type, avatar_url, category,
  created_at, is_active, call_count, total_earned_usdc,
  pt_parameters, pt_model, pt_max_tokens, pt_allows_user_message,
  is_a2a,
  supports_refunds
FROM x402_resources
WHERE is_active = true;

-- Grant access
GRANT SELECT ON public_x402_resources TO authenticated;
GRANT SELECT ON public_x402_resources TO anon;
```

### Backend Changes (External API)

The backend API (separate codebase at API_URL) needs to:

1. Extract `supportsRefunds` from `accepts[].extra` in verify endpoint
2. Accept `supportsRefunds` in POST /resources body
3. Store it in `x402_resources.supports_refunds`
4. Return it in GET resource responses

### Frontend Changes (This Codebase)

1. RegisterResourceModal: Pass `supportsRefunds` from `acceptOption.extra`
2. CreateResourceModal: Same pattern for external resource registration

### Backfill Approach

```typescript
// Script to re-verify existing resources and update supports_refunds
// For each resource:
// 1. Fetch 402 response from resource_url
// 2. Extract supportsRefunds from accepts[].extra
// 3. UPDATE x402_resources SET supports_refunds = ? WHERE id = ?
```

## State of the Art

| Old Approach            | Current Approach       | When Changed | Impact                 |
| ----------------------- | ---------------------- | ------------ | ---------------------- |
| No refund indicator     | Store supports_refunds | v1.1 (now)   | Badge display possible |
| Manual resource updates | Extract from x402      | v1.1 (now)   | Automatic detection    |

**Current best practice:** Extract metadata from x402 `accepts[].extra` and store directly in database columns for fast querying.

## Open Questions

Things that couldn't be fully resolved:

1. **Backend API location**
   - What we know: API is external at `API_URL` (env variable)
   - What's unclear: Exact codebase location, deployment process
   - Recommendation: Document changes needed, may require coordination

2. **Backfill scope**
   - What we know: Need to re-verify existing resources
   - What's unclear: How many resources exist? Rate limits?
   - Recommendation: Implement with configurable batch size and delays

3. **Multiple accept options with different supportsRefunds**
   - What we know: A resource can have multiple accept options (multi-network)
   - What's unclear: Should we store per-network or aggregate?
   - Recommendation: Aggregate (any true = true) for v1, can refine later

## Sources

### Primary (HIGH confidence)

- /src/components/modals/RegisterResourceModal.tsx - AcceptOption interface, registration flow
- /src/components/modals/CreateResourceModal.tsx - Same patterns
- /migrations/001_add_prompt_template_fields.sql - View pattern, column addition
- /src/components/pages/DeveloperPage/components/ResponsePreview.tsx - X402Accept with extra

### Secondary (MEDIUM confidence)

- x402.org specification - extra field in accepts array
- OpenFacilitator docs - supportsRefunds as feature

### Tertiary (LOW confidence)

- Exact API implementation details (external codebase)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Using existing patterns
- Architecture: HIGH - Clear flow following is_a2a precedent
- Pitfalls: HIGH - Based on actual code review
- Backend API specifics: MEDIUM - External codebase

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns, internal implementation)
