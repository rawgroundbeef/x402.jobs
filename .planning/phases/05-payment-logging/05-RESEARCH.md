# Phase 5: x402 Payment + Usage Logging - Research

**Researched:** 2026-01-20
**Domain:** x402 Payment Integration, Usage Logging
**Confidence:** HIGH

## Summary

The codebase already has a robust x402 payment system implemented for other resource types (proxy, prompt, static). The prompt_template execution engine (`instant.ts`) already includes:

- x402 payment verification via OpenFacilitator SDK
- 402 response generation with payment requirements
- Owner test mode bypass (X-OWNER-TEST header)
- Resource stats update (call_count, total_earned_usdc)

**Key finding:** The payment flow is already 90% implemented. The current `instant.ts` endpoint accepts X-PAYMENT headers, verifies via facilitator, and settles payments. The main gaps are:

1. Frontend payment flow integration (wallet signature generation)
2. Dedicated usage logging table for detailed analytics
3. Caller history endpoint

**Primary recommendation:** Extend the existing `/execute` endpoint pattern for frontend-initiated payment flow, and create a simple usage log table that captures per-execution details (template_id, caller_id, success/fail, token counts, cost).

## Existing x402 Payment Integration

### Current Implementation

The codebase uses `@openfacilitator/sdk` for x402 payment verification and settlement.

**Key file:** `x402-jobs-api/src/routes/instant.ts`

```typescript
// OpenFacilitator initialization
const facilitator = FACILITATOR_URL
  ? new OpenFacilitator({ url: FACILITATOR_URL, timeout: 60000 })
  : null;

// Payment verification flow
const paymentResult = await verifyAndSettlePayment(
  paymentHeader,
  resource,
  payTo,
  network,
  resourceUrl,
);
```

### Payment Flow (Currently Implemented)

1. **No X-PAYMENT header** -> Return 402 with payment requirements
2. **X-PAYMENT header present** -> Verify via facilitator -> Settle -> Execute
3. **Owner test mode (X-OWNER-TEST: true)** -> Skip payment, execute directly

### 402 Response Structure (v2 format)

```typescript
{
  x402Version: 2,
  error: "Payment required",
  service: { name: "x402.jobs", url: "https://x402.jobs" },
  accepts: [{
    scheme: "exact",
    network: "eip155:8453", // CAIP-2 format (Base)
    amount: "10000", // atomic units (0.01 USDC)
    resource: "https://x402.jobs/@username/slug",
    payTo: "0x...", // creator's wallet
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    maxTimeoutSeconds: 300
  }]
}
```

### Supported Networks

| Network | CAIP-2 ID                                 | USDC Address                                   |
| ------- | ----------------------------------------- | ---------------------------------------------- |
| Solana  | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Base    | `eip155:8453`                             | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`   |

## Frontend Payment Patterns

### Existing Execute Endpoint

**File:** `x402-jobs-api/src/routes/execute.ts`

The `/api/execute` endpoint handles the full payment flow for frontend callers:

1. Receives resource URL and body
2. Makes initial request to get 402 requirements
3. Creates payment header using user's wallet
4. Retries with payment proof
5. Updates user and resource stats

```typescript
// Step 4: Create X-PAYMENT header based on network
if (network === "base") {
  paymentHeader = await createBasePaymentHeader(
    baseWallet,
    payTo,
    amountUsdc,
    originalNetwork,
  );
} else {
  paymentHeader = await createPaymentHeader(
    userKeypair,
    payTo,
    amountUsdc,
    network,
    feePayer,
    originalNetwork,
  );
}
```

### Payment Header Creation

**Solana:** Uses facilitator as fee payer (gasless for users)

```typescript
const paymentPayload = {
  x402Version: 1,
  scheme: "exact",
  network: originalNetwork,
  payload: {
    transaction: serializedTx,
    signature: txSignature,
  },
};
```

**Base:** Uses EIP-3009 TransferWithAuthorization

```typescript
const paymentPayload = {
  x402Version: 1,
  scheme: "exact",
  network: originalNetwork,
  payload: {
    authorization: { from, to, value, validAfter, validBefore, nonce },
    signature: signature,
  },
};
```

## Usage Logging Patterns

### Current Stats Tracking

**Resource-level stats (instant.ts):**

```typescript
async function updateResourceStats(resourceId, amountUsdc, platformFeePercent) {
  // Updates: call_count, total_earned_usdc
}
```

**Workflow execution logging (x402_job_run_events):**

- Tracks each step in a workflow
- Fields: sequence, status, resource_name, amount_paid, payment_signature, error, output

### Existing Tables for Reference

**x402_job_runs:** Workflow execution tracking

- id, job_id, user_id, status, inputs, total_cost, resources_total, resources_completed

**x402_job_run_events:** Per-step execution details

- id, run_id, sequence, resource_id, resource_name, status, amount_paid, payment_signature, error

**x402_transactions:** On-chain payment tracking (Helius indexer)

- id, server_id, sender, recipient, amount_usdc, block_time, status

### Gap: No Dedicated Prompt Template Usage Logs

Current tracking is at the resource level (aggregate stats) or workflow level (x402_job_run_events). Need a dedicated table for:

- Per-execution details (template_id, caller_id, timestamp)
- Success/failure tracking with error messages
- Token usage (input/output tokens from Claude)
- Cost breakdown (price paid, platform fee)

## Key Files to Modify

### Plan 05-01: x402 Payment Integration

| File                                                | Change                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| `src/components/pages/PromptTemplateDetailPage.tsx` | Add payment flow before execution                     |
| `x402-jobs-api/src/routes/instant.ts`               | Already handles payment (may need SSE payment events) |

### Plan 05-02: Usage Logging

| File                                                | Change                                  |
| --------------------------------------------------- | --------------------------------------- |
| `migrations/003_add_usage_logs.sql`                 | Create prompt_template_usage_logs table |
| `x402-jobs-api/src/routes/instant.ts`               | Log execution after streaming completes |
| `x402-jobs-api/src/routes/*.ts`                     | New endpoint for caller history         |
| `src/components/pages/PromptTemplateDetailPage.tsx` | Display caller's history                |

## Recommendations

### 1. Payment Integration Approach

**Option A: Frontend-initiated via /execute endpoint**

- Frontend calls `/api/execute` with template URL
- Backend handles payment, returns streamed response
- Follows existing pattern (JobPage uses this)

**Option B: Direct instant endpoint with wallet SDK**

- Frontend creates X-PAYMENT header client-side
- Requires wallet signing in browser
- More complex, but no extra backend hop

**Recommendation:** Option A - Use `/execute` endpoint pattern. Simpler frontend, follows existing conventions, wallet secrets stay server-side.

### 2. Usage Logging Schema

```sql
CREATE TABLE x402_prompt_template_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES x402_resources(id),
  caller_id UUID NOT NULL REFERENCES auth.users(id),

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,

  -- Token usage
  input_tokens INTEGER,
  output_tokens INTEGER,

  -- Payment details
  amount_paid NUMERIC(10, 6),
  payment_signature TEXT,
  network TEXT,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  execution_time_ms INTEGER,

  -- Request/response metadata (optional, for debugging)
  parameters JSONB,

  CONSTRAINT fk_template FOREIGN KEY (template_id)
    REFERENCES x402_resources(id) ON DELETE CASCADE
);

CREATE INDEX idx_ptul_template_id ON x402_prompt_template_usage_logs(template_id);
CREATE INDEX idx_ptul_caller_id ON x402_prompt_template_usage_logs(caller_id);
CREATE INDEX idx_ptul_created_at ON x402_prompt_template_usage_logs(created_at DESC);
```

### 3. Caller History Endpoint

```typescript
// GET /api/resources/:templateId/usage-history
// Returns caller's own executions for this template

{
  executions: [
    {
      id: "...",
      status: "success",
      created_at: "2026-01-20T...",
      amount_paid: 0.05,
      input_tokens: 150,
      output_tokens: 500
    }
  ],
  pagination: { total: 10, offset: 0, limit: 20 }
}
```

## Code Examples

### Frontend Payment Flow (via /execute)

```typescript
// In PromptTemplateDetailPage.tsx
const handleSubmit = async () => {
  const response = await authenticatedFetch("/api/execute", {
    method: "POST",
    body: JSON.stringify({
      resourceUrl: `${API_URL}/instant/@${username}/${slug}`,
      method: "POST",
      body: { ...formData, user_message: userMessage },
    }),
  });

  const data = await response.json();
  if (data.paid) {
    setResult(data.data.response);
    setPaymentInfo({ amount: data.payment.amount, tx: data.payment.signature });
  }
};
```

### Logging After Execution (Backend)

```typescript
// In instant.ts after streaming completes
async function logUsage(
  templateId: string,
  callerId: string,
  status: "success" | "failed",
  tokenUsage: { input: number; output: number },
  amountPaid: number,
  paymentSignature: string | null,
  executionTimeMs: number,
  error?: string,
) {
  await supabase.from("x402_prompt_template_usage_logs").insert({
    template_id: templateId,
    caller_id: callerId,
    status,
    error_message: error,
    input_tokens: tokenUsage.input,
    output_tokens: tokenUsage.output,
    amount_paid: amountPaid,
    payment_signature: paymentSignature,
    execution_time_ms: executionTimeMs,
    created_at: new Date().toISOString(),
  });
}
```

## Open Questions

1. **Streaming + Payment:** Current `/execute` doesn't support SSE streaming responses. Options:
   - Return full response after streaming completes (simpler)
   - Add SSE support to execute endpoint (complex)
   - Use instant endpoint directly with payment header (requires frontend wallet)

   **Recommendation:** Start with non-streaming (wait for complete response). SSE can be added later.

2. **Platform Fee:** The instant.ts already handles platform fee calculation:

   ```typescript
   const platformFeePercent = parseFloat(
     resource.platform_fee_percent || "0.10",
   );
   const creatorEarnings = amountUsdc * (1 - platformFeePercent);
   ```

   This should continue to work as-is.

3. **Usage Logs vs Event Table:** Could extend x402_job_run_events for prompt templates, but a dedicated table is cleaner since:
   - No run_id for standalone template executions
   - Different fields (token counts vs workflow sequence)
   - Simpler queries for template-specific analytics

## Sources

### Primary (HIGH confidence)

- `x402-jobs-api/src/routes/instant.ts` - Current prompt_template execution with payment
- `x402-jobs-api/src/routes/execute.ts` - Frontend payment flow pattern
- `x402-jobs-api/src/inngest/utils/execute-x402.ts` - X402 payment header creation

### Secondary (MEDIUM confidence)

- `@openfacilitator/sdk` - Payment verification (package.json confirms version 0.3.0)
- `x402_job_run_events` table schema - Reference for logging patterns

## Metadata

**Confidence breakdown:**

- Payment integration: HIGH - Code already exists, just need frontend integration
- Usage logging: HIGH - Clear pattern from existing tables
- Caller history: MEDIUM - New endpoint, but follows existing patterns

**Research date:** 2026-01-20
**Valid until:** 30 days (stable domain)
