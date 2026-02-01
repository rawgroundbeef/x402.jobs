# Testing Patterns

**Analysis Date:** 2025-01-19

## Test Framework

**Frontend (x402-jobs):**

- Runner: None configured
- Note: No test files exist in `apps/x402-jobs/src/`
- No Jest/Vitest config found
- Linting via `eslint src/`
- Type checking via `tsc --noEmit`

**Backend API (x402-jobs-api):**

- Runner: Vitest 2.1.8
- Config: `apps/x402-jobs-api/vitest.config.ts`
- Environment: Node

**Run Commands:**

```bash
# x402-jobs-api
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
# No coverage command defined, but coverage config exists
```

## Test File Organization

**Location:**

- Pattern: Co-located in `__tests__/` directories adjacent to source files
- Example: `src/routes/__tests__/jobs.test.ts`
- Example: `src/inngest/functions/run-workflow/__tests__/execute-step.test.ts`

**Naming:**

- Pattern: `[filename].test.ts`
- Integration tests: `[filename].integration.test.ts`

**Structure:**

```
apps/x402-jobs-api/src/
├── routes/
│   ├── jobs.ts
│   └── __tests__/
│       ├── jobs.test.ts
│       ├── public-api.integration.test.ts
│       └── public-api-ownership.test.ts
├── services/
│   └── __tests__/
│       └── hiring.service.test.ts
└── inngest/
    ├── workflow/
    │   └── __tests__/
    │       ├── StepExecutor.test.ts
    │       └── TransformExecutor.test.ts
    └── functions/
        └── run-workflow/
            └── __tests__/
                ├── execute-step.test.ts
                ├── preflight.test.ts
                ├── chain.test.ts
                ├── escrow.test.ts
                ├── post-to-destinations.test.ts
                └── process-payout.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Feature/Component Name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("specific behavior", () => {
    it("should do expected thing", () => {
      // Arrange
      // Act
      // Assert
    });

    it("should handle edge case", () => {
      // ...
    });
  });

  describe("another behavior", () => {
    it("should work correctly", () => {
      // ...
    });
  });
});
```

**Patterns:**

- Use `describe` blocks for grouping related tests
- Nested `describe` for specific behaviors/scenarios
- `beforeEach` for mock cleanup and setup
- `it` descriptions start with "should"

**Example from `src/routes/__tests__/jobs.test.ts`:**

```typescript
describe("Jobs API - Name Uniqueness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSlug", () => {
    it("should convert to lowercase", () => {
      expect(generateSlug("MyJob")).toBe("myjob");
    });

    it("should replace spaces with hyphens", () => {
      expect(generateSlug("My Cool Job")).toBe("my-cool-job");
    });
  });

  describe("isJobNameTaken logic", () => {
    it("should detect when a job name is taken", async () => {
      // implementation
    });
  });
});
```

## Mocking

**Framework:** Vitest built-in `vi`

**Patterns:**

**Module Mocking (from `src/routes/__tests__/jobs.test.ts`):**

```typescript
// Mock supabase
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  maybeSingle: mockMaybeSingle,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));
```

**Factory Functions for Mocks (from `src/inngest/functions/run-workflow/__tests__/execute-step.test.ts`):**

```typescript
// Mock repository factory
function createMockRepository(
  overrides: Partial<IStepExecutionRepository> = {},
): IStepExecutionRepository {
  return {
    getRunStatus: vi.fn().mockResolvedValue("running"),
    getEventRecordBySequence: vi.fn().mockResolvedValue({ id: "event-123" }),
    getAllEventRecords: vi.fn().mockResolvedValue([]),
    markEventRunning: vi.fn().mockResolvedValue(undefined),
    markEventCompleted: vi.fn().mockResolvedValue(undefined),
    markEventFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Mock step executor factory
function createMockStepExecutor(
  result: Partial<StepResult> = {},
): StepExecutorFn {
  return vi.fn().mockResolvedValue({
    success: true,
    nodeId: "node-1",
    output: { data: "test output" },
    paid: 0.05,
    paymentSignature: "sig-123",
    resolvedInputs: { prompt: "test" },
    ...result,
  });
}
```

**What to Mock:**

- External services (Supabase, payment APIs)
- Database operations
- Third-party APIs
- Environment-dependent code

**What NOT to Mock:**

- Pure utility functions (test them directly)
- Simple type transformations
- Business logic under test

## Fixtures and Factories

**Test Data:**

```typescript
// Sample workflow step fixture
const sampleStep: WorkflowStep = {
  type: "resource",
  nodeId: "node-1",
  dependencies: [],
  data: {
    resourceId: "res-123",
    resourceUrl: "https://api.example.com/resource",
    resourceName: "Test Resource",
    resourcePrice: 0.05,
    resourceNetwork: "solana",
    nodeId: "node-1",
    inputs: { prompt: "test" },
  },
};

// Context factory
const ctx: ExecuteWorkflowStepContext = {
  repository,
  stepExecutor,
  supabase: mockSupabase,
  broadcastRunEvent: mockBroadcast,
  runId: "run-123",
  userId: "user-456",
  jobId: "job-789",
  walletSecretKey: "wallet-key",
  outputs: {},
  workflowInputs: {},
};
```

**Location:**

- Inline in test files (no separate fixtures directory)
- Factory functions defined at top of test file

## Coverage

**Requirements:** None enforced

**Configuration (from `vitest.config.ts`):**

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/inngest/workflow/**/*.ts", "src/routes/**/*.ts"],
  exclude: ["**/__tests__/**", "**/*.test.ts"],
},
```

**View Coverage:**

```bash
# Coverage not exposed via npm script, run directly:
pnpm vitest run --coverage
```

## Test Types

**Unit Tests:**

- Scope: Individual functions, utilities, logic modules
- Location: `__tests__/[filename].test.ts`
- Approach: Mock all external dependencies
- Focus: Input/output validation, edge cases

**Integration Tests:**

- Scope: API routes with database interactions
- Location: `__tests__/[filename].integration.test.ts`
- Approach: May use real database or mock at HTTP level
- Example: `src/routes/__tests__/public-api.integration.test.ts`

**E2E Tests:**

- Framework: Not used
- The frontend has no test infrastructure

## Common Patterns

**Async Testing:**

```typescript
it("should return cancelled when run status is cancelled", async () => {
  const repository = createMockRepository({
    getRunStatus: vi.fn().mockResolvedValue("cancelled"),
  });

  const result = await executeWorkflowStep(sampleStep, 0, ctx);

  expect(result.cancelled).toBe(true);
  expect(result.success).toBe(false);
});
```

**Error Testing:**

```typescript
it("should throw error when event record not found", async () => {
  const repository = createMockRepository({
    getEventRecordBySequence: vi.fn().mockResolvedValue(null),
  });

  await expect(executeWorkflowStep(sampleStep, 0, ctx)).rejects.toThrow(
    "Event record not found for sequence 0",
  );
});
```

**Partial Matching:**

```typescript
it("should mark event as completed with output data", async () => {
  await executeWorkflowStep(sampleStep, 0, ctx);

  expect(repository.markEventCompleted).toHaveBeenCalledWith(
    "event-123",
    expect.objectContaining({
      output: { result: "success data" },
      paymentSignature: "payment-sig-abc",
    }),
  );
});
```

**Not Called Assertions:**

```typescript
it("should not broadcast when userId is empty", async () => {
  const ctx = { ...baseCtx, userId: "" };

  await executeWorkflowStep(sampleStep, 0, ctx);

  expect(mockBroadcast).not.toHaveBeenCalled();
});
```

## Testing Gaps

**Frontend (x402-jobs):**

- No test framework configured
- No unit tests for hooks
- No component tests
- No integration tests
- Relies on TypeScript type checking and ESLint only

**Backend (x402-jobs-api):**

- Good coverage of workflow execution logic
- Good coverage of step execution
- Route tests exist but focus on logic, not HTTP layer
- No tests for middleware
- No tests for authentication flows

## Recommendations for New Tests

**Adding Tests to x402-jobs (Frontend):**

1. Add Vitest: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom`
2. Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

**Adding Tests to x402-jobs-api (Backend):**

- Follow existing patterns in `__tests__/` directories
- Use factory functions for mocks
- Group by behavior with nested `describe` blocks
- Test error cases explicitly

---

_Testing analysis: 2025-01-19_
