# External Resource Registration PRD

## Overview

This document defines the resource registration process for x402-enabled endpoints, including all supported input formats and field mappings.

## Supported x402 Response Formats

### Format Matrix

| Format           | Location                           | Detection                           | Status    |
| ---------------- | ---------------------------------- | ----------------------------------- | --------- |
| v1 body          | Response body JSON                 | No `x402Version` or `accepts` array | Supported |
| v2 body          | Response body JSON                 | `x402Version: 2` + `accepts[]`      | Supported |
| v2 header        | `PAYMENT-REQUIRED` header (base64) | Empty body + header present         | Supported |
| Bazaar extension | `extensions.bazaar.info`           | Extension present                   | Supported |

---

## Format Specifications

### 1. v1 Body Format (Legacy)

```json
{
  "scheme": "exact",
  "network": "solana",
  "maxAmountRequired": "10000",
  "payTo": "EPq9Acvx...",
  "asset": "EPjFWdd5...",
  "description": "API endpoint",
  "mimeType": "application/json",
  "outputSchema": {
    "input": {
      "method": "POST",
      "bodyFields": { ... }
    }
  }
}
```

**Field Mapping:**

- `payTo` → payment address
- `network` → blockchain network
- `maxAmountRequired` → price in atomic units
- `outputSchema` → input/output schema

---

### 2. v2 Body Format

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://...",
    "description": "...",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "amount": "10000",
      "asset": "EPjFWdd5...",
      "payTo": "EPq9Acvx...",
      "maxTimeoutSeconds": 300,
      "extra": { "feePayer": "..." },
      "outputSchema": { ... }
    }
  ]
}
```

**Field Mapping:**

- `accepts[0].payTo` → payment address
- `accepts[0].network` → blockchain (CAIP-2 format supported)
- `accepts[0].amount` OR `accepts[0].maxAmountRequired` → price
- `accepts[0].outputSchema` → schema (optional)
- `resource.description` → description fallback

---

### 3. v2 Header Format (Per Spec)

HTTP Response:

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Mi4uLg==
Content-Type: application/json

{}
```

The `PAYMENT-REQUIRED` header contains **base64-encoded JSON** with the same structure as v2 body format.

**Detection Logic:**

1. Response status is 402
2. Body is empty OR body has no `accepts`/`payTo`
3. `PAYMENT-REQUIRED` or `payment-required` header exists
4. Decode base64 → parse JSON → use v2 body mapping

---

### 4. Bazaar Extension Format

When `extensions.bazaar` is present, schema info is in `extensions.bazaar.info`:

```json
{
  "x402Version": 2,
  "accepts": [ ... ],
  "extensions": {
    "bazaar": {
      "info": {
        "input": {
          "type": "http",
          "method": "GET",
          "body": {},
          "queryParams": {
            "page": { "type": "string", "required": true, "description": "..." },
            "limit": { "type": "string", "description": "..." }
          },
          "headers": {}
        }
      },
      "schema": {
        "properties": { ... }
      }
    }
  }
}
```

**Schema Priority:**

1. `accepts[0].outputSchema` (if present)
2. `extensions.bazaar.info` (fallback)

---

## Field Extraction Logic

### Payment Address (`payTo`)

```
accepts[0].payTo || accepts[0].pay_to || data.payTo || data.pay_to
```

### Network

```
accepts[0].network || data.network
```

**Network Normalization (CAIP-2):**

- `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` → `solana`
- `eip155:8453` → `base`
- `solana` → `solana`
- `base` → `base`

### Price/Amount

```
accepts[0].amount || accepts[0].maxAmountRequired || accepts[0].max_amount_required || data.maxAmountRequired
```

### Schema

```
accepts[0].outputSchema || data.extensions?.bazaar?.info || {}
```

---

## Validation Rules

### Required Fields

| Field     | Error if Missing                                   |
| --------- | -------------------------------------------------- |
| `payTo`   | "Missing required field: payTo (payment address)"  |
| `network` | "Missing required field: network (e.g., 'solana')" |

### Supported Networks

- `solana` (including CAIP-2: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)
- `base` (including CAIP-2: `eip155:8453`)

Unsupported networks return error:

> "Unsupported network: X. We currently only support Solana and Base networks."

### Warnings (Non-blocking)

| Condition                       | Warning                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| No `amount`/`maxAmountRequired` | "No maxAmountRequired/amount specified - price unknown"    |
| No `asset`                      | "No asset specified (assuming USDC)"                       |
| No `outputSchema`               | "No outputSchema - input fields may not be known"          |
| URL mismatch                    | "URL mismatch: you provided X but 402 response declares Y" |

---

## Test Cases

### Case 1: v1 Body (Legacy)

```bash
curl -s https://legacy-api.example.com/endpoint
# Returns 402 with flat JSON (no x402Version, no accepts)
```

### Case 2: v2 Body

```bash
curl -s https://modern-api.example.com/endpoint
# Returns 402 with { x402Version: 2, accepts: [...] }
```

### Case 3: v2 Header (Spec-compliant)

```bash
curl -si https://int.relai.fi/api/relay/xxx/projects
# Returns 402 with empty body, PAYMENT-REQUIRED header with base64 JSON
```

### Case 4: v2 with Bazaar Extension

```bash
# Same as Case 3, but extensions.bazaar.info contains schema
```

### Case 5: Multiple Networks

```bash
# accepts[] contains multiple entries for different networks
# User selects which network(s) to register
```

---

## Implementation Checklist

- [x] Parse v1 body format
- [x] Parse v2 body format with `accepts[]`
- [x] Parse v2 `PAYMENT-REQUIRED` header (base64)
- [x] Extract schema from `extensions.bazaar.info`
- [x] Normalize CAIP-2 network identifiers
- [x] Support `payTo` and `pay_to` variants
- [x] Support `amount` and `maxAmountRequired` variants
- [x] Handle multiple `accepts` entries (multi-network)
- [ ] Add automated tests for all formats
- [ ] Add format detection logging for debugging

---

## UX Redesign: Registration Modal

### Current State (Problems)

The current registration modal shows:

- URL with version badge
- Generic "Valid x402 endpoint found!" message
- Server/resource preview cards
- Price
- Register button

**Issues:**

1. No visibility into detected input fields (the main value prop)
2. Warnings feel negative ("No outputSchema") instead of showing what IS available
3. No differentiation from competitors
4. User can't preview what the "Try it" experience will be

### Proposed Redesign

#### 1. Schema Preview Section

Show detected input fields directly in registration modal:

```
┌─────────────────────────────────────────────────┐
│ 📥 Input Fields Detected (17)                   │
├─────────────────────────────────────────────────┤
│ GET request with query parameters:              │
│                                                 │
│ • page* (string) - Page number (1-based)        │
│ • limit (string) - Number of entries per page   │
│ • order_by (string) - Field to order by         │
│ • q (string) - Search term to filter by...      │
│ [+13 more fields]                               │
└─────────────────────────────────────────────────┘
```

#### 2. Feature Badges

Show what features the endpoint supports:

```
┌─────────────────────────────────────────────────┐
│ ✓ Bazaar Listed    ✓ Schema Defined             │
│ ✓ Refund Support   ○ A2A Protocol               │
└─────────────────────────────────────────────────┘
```

#### 3. "Try It" Preview

Show a mini preview of what the execution form will look like:

```
┌─────────────────────────────────────────────────┐
│ Preview: Try this resource                      │
├─────────────────────────────────────────────────┤
│ page*    [1        ]                            │
│ limit    [10       ]                            │
│ q        [search...] (optional)                 │
│                                                 │
│ [Try Now - $0.01 USDC]                          │
└─────────────────────────────────────────────────┘
```

#### 4. Positive Framing

Replace warnings with positive capability indicators:

| Old (Negative)                                    | New (Positive)                                             |
| ------------------------------------------------- | ---------------------------------------------------------- |
| "No outputSchema - input fields may not be known" | "17 input fields detected" or "Basic endpoint (no schema)" |
| "No asset specified (assuming USDC)"              | "Accepts: USDC"                                            |
| "Validation warnings"                             | "Endpoint Details"                                         |

#### 5. Registration Success State

Show what was registered with direct action:

```
┌─────────────────────────────────────────────────┐
│ ✓ Resource Registered!                          │
├─────────────────────────────────────────────────┤
│ api/relay/.../projects                          │
│ 17 input fields • $0.01 USDC • Solana           │
│                                                 │
│ [Try It Now]  [View Details]  [Add Another]     │
└─────────────────────────────────────────────────┘
```

### Implementation Tasks

- [ ] Add schema preview component to registration modal
- [ ] Add feature badges (Bazaar, Refunds, A2A, Schema)
- [ ] Add "Try It" preview with detected fields
- [ ] Reframe warnings as capability indicators
- [ ] Update success state with direct "Try It" action
- [ ] Add field count to resource cards across the app

### Differentiation Opportunities

1. **Schema-First**: We show what the API can do before you register
2. **Try Before Register**: Preview the execution form
3. **Feature Discovery**: Surface Bazaar, refunds, A2A automatically
4. **Field Intelligence**: Count and categorize input fields (required vs optional)

---

## References

- [x402 Protocol Spec](https://github.com/coinbase/x402)
- [x402 v2 Announcement](https://www.x402.org/writing/x402-v2-launch)
- [Bazaar Discovery Layer](https://docs.cdp.coinbase.com/x402/bazaar)
- [CAIP-2 Chain IDs](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
