# Coding Conventions

**Analysis Date:** 2025-01-19

## Naming Patterns

**Files:**

- React components: PascalCase with `.tsx` extension (e.g., `JobPage.tsx`, `ResourceNode.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useJobQuery.ts`, `useSaveJobMutation.ts`)
- Utilities/libs: camelCase (e.g., `api.ts`, `format.ts`, `config.ts`)
- Type definitions: camelCase (e.g., `runs.ts`, `dashboard.ts`)
- Constants: camelCase file, SCREAMING_SNAKE_CASE for values (e.g., `categories.ts` with `PLATFORM_FEE`)
- Index files: `index.ts` for barrel exports in component directories

**Functions:**

- React components: PascalCase (e.g., `ListCard`, `ResourceNode`, `BaseLayout`)
- Hooks: camelCase with `use` prefix (e.g., `useAuth`, `useJobQuery`, `useWebSocket`)
- Utility functions: camelCase (e.g., `formatPrice`, `getSuccessRate`, `authenticatedFetch`)
- Event handlers: `handle` prefix (e.g., `handleSave`, `handlePromptSubmit`, `handleCreateJob`)
- API fetchers: descriptive camelCase (e.g., `authenticatedFetcher`, `publicFetcher`)

**Variables:**

- Local state: camelCase (e.g., `isOpen`, `inputs`, `executionStatus`)
- Boolean state: `is`/`has`/`should` prefix (e.g., `isLoading`, `hasConfiguredInputs`, `isDirty`)
- Refs: camelCase with `Ref` suffix (e.g., `panelRef`, `wasOpenRef`, `lastNodeIdRef`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `API_URL`, `PLATFORM_FEE`, `NAV_LINKS`)

**Types:**

- Interfaces: PascalCase with descriptive names (e.g., `JobPageProps`, `AuthContextType`, `RunEvent`)
- Types: PascalCase (e.g., `ExecutionStatus`, `NetworkType`, `WSEventType`)
- Props interfaces: Component name + `Props` suffix (e.g., `ListCardProps`, `SlidePanelProps`)
- Generic response types: `[Entity]Response` (e.g., `JobResponse`)

## Code Style

**Formatting:**

- Tool: ESLint with flat config (`eslint.config.mjs`)
- Indentation: 2 spaces
- Quotes: Double quotes for strings
- Semicolons: Required
- Trailing commas: ES5 style (required in objects/arrays)
- Line width: No strict limit, but readability preferred

**Linting:**

- TypeScript: `@typescript-eslint/eslint-plugin`
- React: `eslint-plugin-react`, `eslint-plugin-react-hooks`
- Key rules:
  - `@typescript-eslint/no-unused-vars`: Error with `_` prefix exceptions
  - `@typescript-eslint/no-explicit-any`: Off (permitted when necessary)
  - `react-hooks/rules-of-hooks`: Error
  - `react-hooks/exhaustive-deps`: Warn

**TypeScript Configuration:**

- Strict mode: Enabled
- Target: ES2017
- Module: ESNext with bundler resolution
- Path aliases: `@/*` maps to `./src/*`

## Import Organization

**Order:**

1. React/Next.js framework imports
2. External library imports (third-party packages)
3. Internal absolute imports (using `@/` alias)
4. Relative imports (components, utils from same feature)
5. Type-only imports at end of relevant section

**Example from `src/components/pages/HomePage/HomePage.tsx`:**

```typescript
// 1. React/Next.js
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 2. External libraries
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

// 3. Internal - contexts/hooks
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";

// 4. Internal - components
import BaseLayout from "@/components/BaseLayout";
import { PlatformStats } from "@/components/PlatformStats";
import { Button } from "@repo/ui/button";

// 5. Internal - utilities
import { authenticatedFetch } from "@/lib/api";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
```

**Path Aliases:**

- `@/*` - Maps to `./src/*` for internal imports
- `@repo/ui/*` - Shared UI components from monorepo packages

## Error Handling

**Patterns:**

- API errors: Throw with descriptive message, catch and display to user
- Async operations: try/catch with error state or return `{ error: Error | null }`
- Auth errors: Log to console, throw to propagate

**API Error Pattern (from `src/lib/api.ts`):**

```typescript
if (!response.ok) {
  const error = await response
    .json()
    .catch(() => ({ error: "Request failed" }));
  throw new Error(error.error || `HTTP ${response.status}`);
}
```

**Component Error Pattern (from `src/contexts/AuthContext.tsx`):**

```typescript
const signInWithEmail = async (email: string, password: string) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};
```

**Mutation Hook Pattern (from `src/hooks/useSaveJobMutation.ts`):**

```typescript
const saveJob = useCallback(
  async (jobId: string, params: SaveJobParams) => {
    const response = await authenticatedFetch(`/jobs/${jobId}`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to save job");
    }
    // Revalidate caches
    await mutate("/jobs");
    return await response.json();
  },
  [mutate],
);
```

## Logging

**Framework:** `console` (browser native)

**Patterns:**

- Errors: `console.error("Descriptive message:", error)`
- Debug info: `console.log("[Feature] Message", data)` with bracket prefix
- WebSocket: `console.log("[WS] Connection status")` - bracket tag for filtering

**When to Log:**

- Authentication failures
- API request failures
- WebSocket connection changes
- Debug information in development

## Comments

**When to Comment:**

- Complex business logic that isn't self-documenting
- Non-obvious workarounds or browser-specific fixes
- TODOs for future work (use `// TODO:` format)
- Public API documentation (JSDoc)

**JSDoc/TSDoc:**

- Required for exported utility functions
- Required for complex hooks
- Optional for React components (props interface is documentation)

**Example from `src/lib/format.ts`:**

```typescript
/**
 * Format a price from micro-USDC (1,000,000 = $1) to a display string
 * Shows sub-cent precision for small amounts
 */
export function formatPrice(
  microUsdc: string | number | undefined | null,
): string {
  // implementation
}
```

**Example from `src/lib/api.ts`:**

```typescript
/**
 * Authenticated fetcher for SWR - automatically includes auth token
 */
export async function authenticatedFetcher<T>(url: string): Promise<T> {
  // implementation
}
```

## Function Design

**Size:** Keep functions focused and under ~50 lines. Extract helpers for complex logic.

**Parameters:**

- Use object destructuring for 3+ parameters
- Provide defaults for optional parameters
- Type all parameters explicitly

**Return Values:**

- Use typed return values for public functions
- Return objects for multiple values: `{ data, error }`
- Hooks return objects: `{ isLoading, data, error, mutate }`

**Example from `src/hooks/useJobQuery.ts`:**

```typescript
export function useJobQuery(jobId: string | null) {
  return useSWR<JobResponse>(
    jobId ? `/jobs/view/${jobId}` : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );
}
```

## Module Design

**Exports:**

- Named exports preferred over default exports
- Exception: Page components use default export (Next.js convention)
- Exception: Layout components may use default export

**Barrel Files:**

- Component directories use `index.ts` for clean imports
- Export only the main component(s), not internal helpers

**Example from `src/components/ListCard/index.ts`:**

```typescript
export { ListCard, type ListCardProps } from "./ListCard";
```

## React Patterns

**Component Structure:**

1. "use client" directive (if client component)
2. Imports
3. Types/interfaces
4. Component function
5. Early returns for loading/error states
6. Main render

**State Management:**

- Local state: `useState` for component-specific state
- Server state: SWR with `useSWR` hook
- Global state: React Context (AuthContext, ModalContext)

**Data Fetching:**

- SWR for server state with automatic revalidation
- `authenticatedFetcher` for auth-protected endpoints
- `publicFetcher` for public endpoints

**Props Pattern (from `src/components/ListCard/ListCard.tsx`):**

```typescript
export interface ListCardProps {
  /** Navigation href */
  href: string;
  /** Avatar/icon image URL */
  avatarUrl?: string | null;
  /** Display name */
  name: string;
  /** Optional description - truncated to one line */
  description?: string | null;
  // ... more props with JSDoc
}

export function ListCard({
  href,
  avatarUrl,
  name,
  description,
  type = "job",
  variant = "default",
}: ListCardProps) {
  // implementation
}
```

## Styling Patterns

**Approach:** Tailwind CSS with CSS variables for theming

**Class Organization:**

1. Layout (flex, grid, position)
2. Sizing (w, h, p, m)
3. Typography (text, font)
4. Colors (bg, text, border)
5. Effects (shadow, rounded, opacity)
6. States (hover:, focus:, active:)
7. Transitions (transition-\*)

**Dynamic Classes:** Use `clsx` or template literals

```typescript
import clsx from "clsx";

className={clsx(
  "base-classes",
  isActive && "bg-primary/10 text-primary",
  variant === "featured" && "p-6"
)}
```

**Theming:**

- CSS variables in `globals.css` for colors
- `hsl(var(--color-name))` format
- Dark mode via `class` strategy

---

_Convention analysis: 2025-01-19_
