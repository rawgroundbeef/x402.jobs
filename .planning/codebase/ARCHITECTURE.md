# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Next.js App Router with Client-Side State Management

**Key Characteristics:**

- Next.js 15 App Router for routing with thin page components
- React contexts for global state (Auth, Modals)
- SWR for data fetching and caching
- Component-centric architecture with page components containing business logic
- External API backend (x402-jobs-api) - this app is frontend-only

## Layers

**Routes Layer:**

- Purpose: URL routing and page composition
- Location: `src/app/`
- Contains: Thin page.tsx files that render page components
- Depends on: Page components from `src/components/pages/`
- Used by: Next.js router

**Page Components Layer:**

- Purpose: Full page implementations with business logic
- Location: `src/components/pages/`
- Contains: Complete page UIs with data fetching, state, and rendering
- Depends on: Hooks, contexts, UI components
- Used by: Route pages in `src/app/`

**UI Components Layer:**

- Purpose: Reusable UI building blocks
- Location: `src/components/`
- Contains: Buttons, modals, cards, panels, workflow nodes
- Depends on: @repo/ui shared library, contexts
- Used by: Page components

**Hooks Layer:**

- Purpose: Encapsulate data fetching and state logic
- Location: `src/hooks/`
- Contains: SWR queries, mutations, utility hooks
- Depends on: `src/lib/api.ts` for API calls
- Used by: Page components, UI components

**Lib Layer:**

- Purpose: Core utilities and API client
- Location: `src/lib/`
- Contains: Supabase client, API helpers, formatting utilities
- Depends on: External services (Supabase, API)
- Used by: Hooks, contexts

**Contexts Layer:**

- Purpose: Global state management
- Location: `src/contexts/`
- Contains: AuthContext, ModalContext
- Depends on: Supabase, lib utilities
- Used by: All components needing auth/modal state

## Data Flow

**Authentication Flow:**

1. User initiates OAuth via `AuthContext.signInWithGoogle/Twitter()`
2. Supabase handles OAuth redirect to `/auth/callback`
3. `AuthContext` listens to `onAuthStateChange` and updates user/session state
4. Components access auth via `useAuth()` hook
5. API calls include Bearer token via `authenticatedFetch()`

**Job Workflow Execution Flow:**

1. User clicks Run in `JobCanvas` component
2. `buildWorkflowSteps()` creates execution plan from nodes/edges
3. `handleRunWorkflow()` saves workflow, creates run via POST `/runs`
4. `useRunTracking` hook polls `/runs/:id` for status updates
5. Node execution status updates rendered on `WorkflowCanvas`
6. Results displayed in output nodes and `ActivityDrawer`

**Workflow Persistence Flow:**

1. `useWorkflowPersistence` hook manages all workflow state
2. Auto-saves to localStorage with debouncing (1s)
3. Manual saves to database via PUT `/jobs/:id`
4. Loads from database on mount or from localStorage if newer
5. Warns on unsaved changes via beforeunload event

**State Management:**

- Auth state: `AuthContext` (React Context + Supabase)
- Modal state: `ModalContext` (React Context)
- Workflow state: `useWorkflowPersistence` hook (local state + SWR)
- API data: SWR with `authenticatedFetcher` for caching

## Key Abstractions

**Job:**

- Purpose: A workflow that can be executed
- Examples: `src/hooks/useJobQuery.ts`, `src/components/pages/JobCanvas/JobCanvas.tsx`
- Pattern: Contains workflow_definition with nodes, edges, viewport

**Workflow Node:**

- Purpose: Visual unit in workflow canvas (trigger, resource, transform, output, source)
- Examples: `src/components/workflow/nodes/ResourceNode.tsx`, `src/components/workflow/nodes/TriggerNode.tsx`
- Pattern: React Flow custom node with typed data

**Resource:**

- Purpose: External X402 API endpoint that can be called
- Examples: `src/components/modals/ResourcesModal.tsx`, `src/hooks/useJobQuery.ts`
- Pattern: Contains resource_url, max_amount_required, output_schema

**Run:**

- Purpose: Single execution of a job
- Examples: `src/types/runs.ts`, `src/components/pages/JobCanvas/lib/useRunTracking.ts`
- Pattern: Has status, events[], total_cost

**Panel:**

- Purpose: Slide-out configuration/detail UI
- Examples: `src/components/panels/ResourceConfigPanel.tsx`, `src/components/panels/SlidePanel.tsx`
- Pattern: Railway-style floating panels with stacking support

## Entry Points

**Root Layout:**

- Location: `src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: Provider tree setup (Auth, Theme, Wallet, Toast, Modal)

**Home Page:**

- Location: `src/app/page.tsx` -> `src/components/pages/HomePage/HomePage.tsx`
- Triggers: Navigation to /
- Responsibilities: Marketing landing, workflow showcase, featured content

**Job Canvas:**

- Location: `src/app/jobs/[id]/page.tsx` -> `src/components/pages/JobCanvas/JobCanvas.tsx`
- Triggers: Navigation to /jobs/:id
- Responsibilities: Visual workflow editor, job execution

**Dashboard:**

- Location: `src/app/dashboard/page.tsx` -> `src/components/pages/CreatorDashboardPage/CreatorDashboardPage.tsx`
- Triggers: Navigation to /dashboard
- Responsibilities: Creator earnings, stats, recent activity

## Error Handling

**Strategy:** Try-catch with error state display

**Patterns:**

- API errors returned via SWR error state
- Form errors via react-hook-form + zod validation
- Auth errors handled in `AuthContext` with console.error logging
- Run failures stored in run.error and event.error fields

## Cross-Cutting Concerns

**Logging:** console.log/error (no structured logging framework)

**Validation:** Zod schemas with react-hook-form for forms; runtime type checking for API responses

**Authentication:** Supabase Auth with JWT tokens; `authenticatedFetch()` adds Bearer token to all API calls

**Theming:** next-themes with CSS variables; `ThemeProvider` wraps app

**Real-time Updates:** WebSocket via `useWebSocket` hook for schedule updates; SWR polling for run status

---

_Architecture analysis: 2026-01-19_
