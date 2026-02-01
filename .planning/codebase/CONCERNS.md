# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Giant Component Files:**

- Issue: Several components exceed 1000+ lines with mixed concerns (UI, state, business logic)
- Files:
  - `src/components/panels/JobPanel.tsx` (2448 lines)
  - `src/components/pages/JobCanvas/JobCanvas.tsx` (2261 lines)
  - `src/components/modals/CreateResourceModal.tsx` (1483 lines)
  - `src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx` (1453 lines)
  - `src/components/pages/HiringDetailPage/HiringDetailPage.tsx` (1317 lines)
  - `src/components/modals/ResourceInteractionModal.tsx` (1268 lines)
  - `src/components/pages/RewardsPage/RewardsPage.tsx` (1194 lines)
- Impact: Difficult to maintain, test, and reason about. High cognitive load for developers.
- Fix approach: Extract logical units into custom hooks, sub-components, and separate concerns (container/presentation pattern)

**Excessive Console Logging in Production Code:**

- Issue: 105 console statements across 37 files remain in production code
- Files: `src/hooks/useWebSocket.ts`, `src/contexts/AuthContext.tsx`, `src/components/pages/JobCanvas/JobCanvas.tsx` (16 occurrences)
- Impact: Performance overhead, leaks internal state to browser console, unprofessional UX
- Fix approach: Implement proper logging service with environment-aware log levels; remove debug logs before production

**Type Safety Bypasses:**

- Issue: 48 uses of `any` type across 31 files
- Files:
  - `src/components/pages/HiringDetailPage/HiringDetailPage.tsx` (5 occurrences)
  - `src/components/modals/RegisterResourceModal.tsx` (3 occurrences)
  - `src/contexts/AuthContext.tsx` (2 occurrences)
  - `src/components/AIJobCreator/AIJobCreator.tsx` (2 occurrences)
- Impact: Bypasses TypeScript's type checking, potential runtime errors
- Fix approach: Define proper interfaces for external API responses; use `unknown` with type guards where types are genuinely unknown

**Duplicate Route Patterns:**

- Issue: Same job view logic exists in two places with identical implementations
- Files:
  - `src/app/user/[username]/[slug]/page.tsx`
  - `src/app/(public)/[username]/[slug]/page.tsx`
  - `src/app/user/[username]/[slug]/opengraph-image.tsx`
  - `src/app/(public)/[username]/[slug]/opengraph-image.tsx`
- Impact: Code duplication, maintenance burden, risk of drift between implementations
- Fix approach: Extract shared data fetching to utility functions; consolidate route structure

**ESLint Disables:**

- Issue: Explicit eslint-disable comments bypassing hooks rules
- Files:
  - `src/hooks/useWorkflowPersistence.ts:429` - eslint-disable-next-line react-hooks/exhaustive-deps
  - `src/components/panels/JobPanel.tsx:701` - eslint-disable-next-line react-hooks/exhaustive-deps
- Impact: Potential stale closure bugs, memory leaks from missing dependencies
- Fix approach: Review each case; refactor to satisfy hooks rules or add explicit comments explaining why disable is necessary

## Known Bugs

**Panel Stacking Issue:**

- Symptoms: Clicking same panel type (e.g., resource A then resource B) replaces instead of stacking
- Files: `src/components/pages/JobCanvas/JobCanvas.tsx:555-556`
- Trigger: Click resource node A to configure, then click resource node B
- Workaround: Documented as TODO in code; users must close panel before opening different resource

**Unauthenticated Resource Submission:**

- Symptoms: Submit button appears but silently fails for non-logged-in users
- Files: `src/components/pages/ResourceDetailPage/ResourceDetailPage.tsx:408-411`
- Trigger: Visit resource page without authentication, fill form, click submit
- Workaround: TODO comment indicates login modal should open; currently just returns early

**Schedule Modal Not Implemented:**

- Symptoms: Schedule indicator links to full job page instead of modal
- Files: `src/components/pages/AccountJobsPage/components/JobCard.tsx:371-372`
- Trigger: Click schedule indicator on job card
- Workaround: Users are redirected to full job editor page

## Security Considerations

**Token Exposure in WebSocket URL:**

- Risk: Auth token passed as query parameter in WebSocket connection
- Files: `src/hooks/useWebSocket.ts:163`
- Current mitigation: HTTPS encrypts URL in transit
- Recommendations: Consider using WebSocket authentication handshake instead of query param; tokens may be logged in server access logs

**LocalStorage for Sensitive Data:**

- Risk: Workflow drafts and chat history stored in localStorage (accessible to XSS)
- Files:
  - `src/hooks/useWorkflowPersistence.ts:55-81` (workflow drafts)
  - `src/components/modals/AskJobputerModal.tsx:33-44` (chat history)
  - `src/components/panels/RunWorkflowPanel.tsx:114-128` (run parameters)
- Current mitigation: No sensitive data like credentials stored
- Recommendations: Audit what data is persisted; ensure no PII or secrets end up in localStorage

**Manual LocalStorage Cleanup on Signout:**

- Risk: Auth cleanup relies on iterating localStorage keys as fallback
- Files: `src/contexts/AuthContext.tsx:169-181`
- Current mitigation: Supabase signOut is called first; manual cleanup is fallback
- Recommendations: This is defensive but indicates distrust of Supabase cleanup; monitor if needed long-term

## Performance Bottlenecks

**Large Component Re-renders:**

- Problem: JobCanvas component (2261 lines) re-renders on any state change
- Files: `src/components/pages/JobCanvas/JobCanvas.tsx`
- Cause: 29 useMemo/useCallback occurrences suggest attempt at optimization, but component size makes optimization difficult
- Improvement path: Split into smaller components with isolated state; use React DevTools Profiler to identify render cascades

**No Virtualization for Lists:**

- Problem: Job lists, run history, resource lists render all items
- Files:
  - `src/components/sidebars/JobsSidebar.tsx`
  - `src/components/sidebars/RunsHistorySidebar.tsx`
  - `src/components/modals/ResourcesModal.tsx`
- Cause: Simple map() over arrays without virtualization
- Improvement path: Implement react-window or similar for lists that can grow large (>50 items)

**SWR Cache Configuration:**

- Problem: Various deduping intervals scattered across codebase
- Files: `src/contexts/AuthContext.tsx:60` - dedupingInterval: 60000
- Cause: Ad-hoc configuration per-component
- Improvement path: Centralize SWR configuration; establish consistent caching strategy

## Fragile Areas

**Workflow Persistence Hook:**

- Files: `src/hooks/useWorkflowPersistence.ts` (894 lines)
- Why fragile: Complex state synchronization between localStorage, server, and React state; debounced saves can race with navigation
- Safe modification: Always test save/load cycles; check for race conditions with navigation
- Test coverage: No test files found (`*.test.*` or `*.spec.*` patterns return empty)

**JobCanvas State Machine:**

- Files: `src/components/pages/JobCanvas/JobCanvas.tsx`
- Why fragile: Panel stacking logic with refs, multiple useEffects watching each other, documented stale closure issues
- Safe modification: Changes to panel state require testing all panel combinations
- Test coverage: None

**Auth Context:**

- Files: `src/contexts/AuthContext.tsx`
- Why fragile: Handles OAuth, email/password, admin status, session management with fallback cleanup logic
- Safe modification: Test all auth providers; verify token refresh works
- Test coverage: None

## Scaling Limits

**No Rate Limiting on Client:**

- Current capacity: Unlimited client-side API calls
- Limit: Server-side rate limits will reject requests
- Scaling path: Implement client-side request queuing/debouncing; show rate limit feedback to users

**WebSocket Single Connection:**

- Current capacity: One WebSocket connection per user
- Limit: Reconnect logic has max 5 attempts with exponential backoff
- Scaling path: Acceptable for current use; document behavior for users with unstable connections

## Dependencies at Risk

**React 19.1.2 (Very Recent):**

- Risk: Using cutting-edge React version with potential breaking changes
- Impact: UI library compatibility issues, less community support for debugging
- Migration plan: Pin to React 18.x if stability issues arise

**Next.js 15.5.9:**

- Risk: Very recent version; may have undiscovered bugs
- Impact: Build/deployment issues, App Router edge cases
- Migration plan: Maintain ability to rollback to 15.x stable

**@xyflow/react 12.4.4:**

- Risk: Core workflow visualization dependency
- Impact: Breaking changes would require significant refactoring
- Migration plan: Pin version; review changelogs carefully before updating

## Missing Critical Features

**Error Boundaries:**

- Problem: No React error boundaries for graceful failure handling
- Blocks: Single component error crashes entire page
- Location: Should wrap major UI sections in `src/app/layout.tsx`

**Loading States:**

- Problem: Inconsistent loading indicators across modals and pages
- Blocks: Users uncertain if action is processing
- Many components return `null` early: 50+ instances of `return null;` for loading/empty states

## Test Coverage Gaps

**No Test Files:**

- What's not tested: Entire codebase - no `*.test.*` or `*.spec.*` files found
- Files: All 68000+ lines of TypeScript
- Risk: Any change can introduce regression; refactoring is high-risk
- Priority: High - establish testing infrastructure and start with critical paths:
  1. `src/hooks/useWorkflowPersistence.ts` - data integrity
  2. `src/lib/api.ts` - API communication
  3. `src/contexts/AuthContext.tsx` - authentication flows

**No E2E Testing:**

- What's not tested: User workflows (create job, run job, view results)
- Risk: Integration issues between components invisible until production
- Priority: High - add Playwright/Cypress for critical user journeys

---

_Concerns audit: 2026-01-19_
