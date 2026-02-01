# Phase 25: Cleanup & Migration - Research

**Researched:** 2026-02-01
**Domain:** Component cleanup, code migration, dead code removal
**Confidence:** HIGH

## Summary

Phase 25 removes the old CreateResourceModal component and redirects all entry points to the new wizard at `/dashboard/resources/new`. The wizard (Phases 19-24) has replaced the modal for creating new resources across all 4 type paths (Link, Proxy, Claude, OpenRouter).

The cleanup is straightforward with one critical finding: CreateResourceModal is still used for EDITING existing resources from the dashboard page. The requirements defer edit functionality to future work (EDIT-01, EDIT-02), so the edit use case must be handled separately.

**Primary recommendation:** Remove CreateResourceModal creation logic but preserve or extract edit functionality to avoid breaking the resources dashboard edit feature.

## Standard Stack

This is a cleanup/deletion phase with no new libraries.

### Existing Tools Used
| Tool | Purpose | Usage |
|------|---------|-------|
| Next.js router | Navigation redirection | Replace modal triggers with `router.push()` |
| React Context | State management cleanup | Remove modal state from ModalContext |
| Git | Safe removal | Delete files, verify no broken references |

## Architecture Patterns

### Cleanup Order

**Safe deletion sequence:**

1. **Audit dependencies** - Find all imports and usages
2. **Remove state management** - Clean context/global state first
3. **Redirect entry points** - Change triggers to route navigation
4. **Remove component** - Delete modal file last
5. **Verify build** - Ensure no broken imports remain

### Pattern: Modal State Cleanup

**Before (modal-based):**
```typescript
// ModalContext.tsx
const [isRegisterResourceOpen, setIsRegisterResourceOpen] = useState(false);
const openRegisterResource = () => setIsRegisterResourceOpen(true);

// GlobalModals.tsx
<CreateResourceModal
  isOpen={isRegisterResourceOpen}
  onClose={closeRegisterResource}
/>

// Component
const { openRegisterResource } = useModals();
<Button onClick={openRegisterResource}>Add Resource</Button>
```

**After (route-based):**
```typescript
// Component
import { useRouter } from "next/navigation";

const router = useRouter();
<Button onClick={() => router.push("/dashboard/resources/new")}>
  Add Resource
</Button>
```

Or using Link component:
```typescript
<Button as={Link} href="/dashboard/resources/new">
  Add Resource
</Button>
```

### Pattern: Preserving Edit Functionality

**Current situation:** CreateResourceModal serves dual purposes:
- Creating new resources (being replaced)
- Editing existing resources (still needed)

**Options for handling edit:**

1. **Extract edit-only modal** - Create lightweight EditResourceModal with only editable fields
2. **Use existing ResourceEditModal** - Simpler modal already exists for basic edits
3. **Defer to future** - Break edit temporarily, implement EDIT-01/EDIT-02 later

**Recommended approach:** Option 2 (use ResourceEditModal) for basic metadata edits, accept that complex field edits (proxy config, prompt templates) are temporarily unavailable until EDIT-01/EDIT-02 are implemented.

## Inventory: Files to Remove or Modify

### Files to DELETE

| File | Size | Purpose | Safe to Delete? |
|------|------|---------|-----------------|
| `apps/web/src/components/modals/CreateResourceModal.tsx` | 117KB (3024 lines) | Old creation/edit modal | **NO** - Still used for editing |
| `apps/web/src/components/modals/RegisterResourceModal.tsx` | 23KB (622 lines) | Alternate registration modal | **YES** - No imports found |

**Critical Finding:** CreateResourceModal cannot be fully deleted because it's used for editing resources in `apps/web/src/app/dashboard/resources/page.tsx` (lines 797-830).

### Files to MODIFY

| File | Current State | Required Changes |
|------|---------------|------------------|
| `apps/web/src/contexts/ModalContext.tsx` | Contains register resource state | Remove `isRegisterResourceOpen`, `registerResourceOnSuccess`, `openRegisterResource`, `closeRegisterResource` |
| `apps/web/src/components/GlobalModals.tsx` | Renders CreateResourceModal | Remove CreateResourceModal import and render |
| `apps/web/src/app/dashboard/resources/page.tsx` | Uses CreateResourceModal for editing | **Either:** (A) Keep import for edit, or (B) Switch to ResourceEditModal |

### Entry Points Already Migrated

These components already route to `/dashboard/resources/new` instead of opening the modal:

| Component | Location | Migration Status |
|-----------|----------|------------------|
| AddResourceModalButton | `apps/web/src/components/AddResourceModalButton.tsx` | **DONE** - Routes to `/dashboard/resources/new` (line 30) |
| DocsPanel | `apps/web/src/components/DocsPanel/DocsPanel.tsx` | **DONE** - Uses AddResourceModalButton (line 187) |
| ResourcesListPage | `apps/web/src/components/pages/ResourcesListPage/ResourcesListPage.tsx` | **DONE** - Uses AddResourceModalButton (line 215) |
| Dashboard Resources Page | `apps/web/src/app/dashboard/resources/page.tsx` | **DONE** - Uses AddResourceModalButton (lines 427, 621) |

**Evidence:** Commit c384f93 "refactor(19): route all 'Add Resource' buttons to wizard page" completed this migration in Phase 19.

**Verification:**
```bash
# No components call openRegisterResource() anymore
grep -r "\.openRegisterResource\(" apps/web/src
# Returns: No matches found
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency tracking | Manual file search | IDE "Find References" or `git grep` | Catches dynamic imports, ensures completeness |
| Safe deletion | Delete and hope | Verify build after each change | TypeScript catches broken imports immediately |
| State cleanup | Delete state instantly | Remove consumers first, then state | Prevents runtime errors if state still referenced |

## Common Pitfalls

### Pitfall 1: Deleting Component Before Removing Imports
**What goes wrong:** TypeScript build fails with "Cannot find module" errors scattered across multiple files.

**Why it happens:** Components imported in multiple places; deleting the file breaks all importers simultaneously.

**How to avoid:**
1. Find all imports: `grep -r "CreateResourceModal" apps/web/src`
2. Remove or update each import
3. Verify build: `npm run build`
4. Only then delete the file

**Warning signs:** Build errors in files you didn't touch.

### Pitfall 2: Removing State While Consumers Still Reference It
**What goes wrong:** Runtime errors "Cannot destructure property 'X' of undefined" or "X is not a function".

**Why it happens:** Context providers export state that components destructure; removing state breaks the contract.

**How to avoid:**
1. Find all consumers: `grep -r "useModals" apps/web/src`
2. Check each consumer for state usage
3. Remove state references from consumers first
4. Then remove from context provider

**Warning signs:** Code compiles but crashes at runtime when modal would open.

### Pitfall 3: Breaking Edit Functionality
**What goes wrong:** Users can no longer edit existing resources from the dashboard.

**Why it happens:** CreateResourceModal is used for both create AND edit; removing it breaks edit flow.

**How to avoid:**
1. Search for `editResource` prop usage
2. Identify if edit mode is used in production
3. Either preserve edit code or migrate to alternative
4. Test edit flow before deployment

**Warning signs:** "Edit" button in resources list does nothing or crashes.

### Pitfall 4: Orphaned Utilities
**What goes wrong:** Helper functions or utilities used only by deleted modal remain in codebase as dead code.

**Why it happens:** Deletion focuses on component, not its dependencies.

**How to avoid:**
1. Check component imports for local utilities
2. Verify each utility is used elsewhere: `grep -r "functionName" apps/web/src`
3. Remove unused utilities after component deletion

**Warning signs:** Lint warnings about unused exports.

### Pitfall 5: Incomplete Context Cleanup
**What goes wrong:** Modal state remains in ModalContext with no consumers, bloating state and confusing future developers.

**Why it happens:** Focus on removing component, forgetting the state management.

**How to avoid:**
1. Trace state from context to consumers
2. Remove all state-related fields from context interface
3. Remove state variables and functions from provider
4. Remove from context value object

**Warning signs:** TypeScript errors about missing properties after removing from interface.

## Code Examples

### Current State: Resources Dashboard Edit

```typescript
// apps/web/src/app/dashboard/resources/page.tsx (lines 797-830)
import { CreateResourceModal } from "@/components/modals/CreateResourceModal";

const [editingResource, setEditingResource] = useState<Resource | null>(null);

// In dropdown menu
<DropdownItem onClick={() => setEditingResource(resource)}>
  Edit
</DropdownItem>

// Modal render
<CreateResourceModal
  isOpen={!!editingResource}
  onClose={() => setEditingResource(null)}
  onSuccess={() => {
    setEditingResource(null);
    fetchResources();
  }}
  editResource={editingResource ? {
    id: editingResource.id,
    name: editingResource.name,
    description: editingResource.description,
    // ... other fields
  } : null}
/>
```

**Issue:** This edit flow depends on CreateResourceModal, which we want to remove.

### Option A: Switch to Simpler ResourceEditModal

```typescript
// apps/web/src/app/dashboard/resources/page.tsx
import { ResourceEditModal } from "@/components/modals/ResourceEditModal";

// Modal render (simplified)
<ResourceEditModal
  isOpen={!!editingResource}
  onClose={() => setEditingResource(null)}
  resource={editingResource}
  onSaved={() => {
    setEditingResource(null);
    fetchResources();
  }}
/>
```

**Tradeoff:** ResourceEditModal only supports basic fields (name, description, slug, avatar). Complex fields like proxy config or prompt templates cannot be edited until EDIT-01/EDIT-02 are implemented.

### Current State: Modal Context

```typescript
// apps/web/src/contexts/ModalContext.tsx (lines 72-76, 95-98, 125-132)
interface ModalContextValue {
  // ... other modals

  // Register Resource Modal - TO REMOVE
  isRegisterResourceOpen: boolean;
  registerResourceOnSuccess: (() => void) | null;
  openRegisterResource: (onSuccess?: () => void) => void;
  closeRegisterResource: () => void;
}

// Provider state - TO REMOVE
const [isRegisterResourceOpen, setIsRegisterResourceOpen] = useState(false);
const [registerResourceOnSuccess, setRegisterResourceOnSuccess] = useState<
  (() => void) | null
>(null);

// Provider functions - TO REMOVE
const openRegisterResource = useCallback((onSuccess?: () => void) => {
  setRegisterResourceOnSuccess(() => onSuccess || null);
  setIsRegisterResourceOpen(true);
}, []);

const closeRegisterResource = useCallback(() => {
  setIsRegisterResourceOpen(false);
  setRegisterResourceOnSuccess(null);
}, []);

// Value object - TO REMOVE these entries
return (
  <ModalContext.Provider
    value={{
      // ... other modals
      isRegisterResourceOpen,
      registerResourceOnSuccess,
      openRegisterResource,
      closeRegisterResource,
    }}
  >
```

**Clean version (after removal):**
```typescript
interface ModalContextValue {
  // Search Modal
  isSearchOpen: boolean;
  searchOptions: SearchOptions | null;
  openSearch: (options?: SearchOptions) => void;
  closeSearch: () => void;

  // Create Job Modal
  isCreateJobOpen: boolean;
  openCreateJob: () => void;
  closeCreateJob: () => void;

  // Jobputer Chat Modal
  isJobputerChatOpen: boolean;
  openJobputerChat: () => void;
  closeJobputerChat: () => void;

  // Resource Modal (try/interact)
  resourceModalResource: ModalResource | null;
  openResourceModal: (resource: ModalResource) => void;
  closeResourceModal: () => void;

  // My Jobs Modal
  isMyJobsOpen: boolean;
  openMyJobs: () => void;
  closeMyJobs: () => void;
}
```

### Current State: GlobalModals

```typescript
// apps/web/src/components/GlobalModals.tsx (lines 8, 31-33, 71-75)
import { CreateResourceModal } from "@/components/modals/CreateResourceModal";

export function GlobalModals() {
  const {
    // ... other modals
    isRegisterResourceOpen,
    registerResourceOnSuccess,
    closeRegisterResource,
  } = useModals();

  return (
    <>
      {/* ... other modals */}

      {/* Create Resource Modal - TO REMOVE */}
      <CreateResourceModal
        isOpen={isRegisterResourceOpen}
        onClose={closeRegisterResource}
        onSuccess={registerResourceOnSuccess || undefined}
      />
    </>
  );
}
```

**Clean version (after removal):**
```typescript
// Remove import
// Remove destructured state
// Remove modal render
```

### Verification Commands

```bash
# Find all CreateResourceModal references
grep -r "CreateResourceModal" apps/web/src --include="*.tsx" --include="*.ts"

# Find all openRegisterResource calls (should be none)
grep -r "openRegisterResource" apps/web/src --include="*.tsx" --include="*.ts"

# Find all modal context consumers
grep -r "useModals" apps/web/src --include="*.tsx" --include="*.ts"

# Verify route exists
ls -la apps/web/src/app/dashboard/resources/new/

# Check for tests
find apps/web -name "*.test.*" -o -name "*.spec.*" | xargs grep -l "CreateResourceModal"
# Result: No test files found
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modal-based resource creation | Full-page wizard with routing | Phase 19 (Jan 2026) | Better UX, mobile-friendly, URL routing |
| Single modal for create + edit | Separate create (wizard) and edit (modal) | Phase 25 (Feb 2026) | Cleaner separation of concerns |
| Global modal state in context | Route-based navigation | Phase 19 (Jan 2026) | Simpler state management, deep linking |

**Migration path:**
- Phase 19: Built wizard infrastructure, routed all entry points
- Phases 20-24: Implemented all 4 type paths (Link, Proxy, Claude, OpenRouter)
- Phase 25: Remove old modal, clean up state

## Open Questions

### 1. How should edit functionality be handled?

**What we know:**
- CreateResourceModal supports editing (lines 797-830 in resources/page.tsx)
- ResourceEditModal exists for basic edits (name, description, avatar)
- EDIT-01/EDIT-02 requirements deferred to future

**What's unclear:**
- Should we break complex edits temporarily?
- Is ResourceEditModal sufficient for current needs?
- When will EDIT-01/EDIT-02 be implemented?

**Recommendation:** Use ResourceEditModal for basic edits, accept that complex fields (proxy headers, prompt templates, model selection) cannot be edited until wizard-based edit flow is implemented. Document this limitation in Phase 25 summary.

### 2. Is RegisterResourceModal actually unused?

**What we know:**
- No imports found for RegisterResourceModal
- File exists at 23KB
- Similar functionality to CreateResourceModal

**What's unclear:**
- Was it replaced earlier or never used?
- Can it be safely deleted?

**Recommendation:** Delete RegisterResourceModal.tsx in Phase 25. If build succeeds and no runtime errors occur, it was dead code. Low risk since grep found no imports.

### 3. Are there any shared utilities only used by CreateResourceModal?

**What we know:**
- `generateSlug()` function defined in CreateResourceModal (line 69)
- Not exported, only used internally
- Similar function may exist in wizard

**What's unclear:**
- Does wizard reimplement slug generation?
- Are there other inline utilities?

**Recommendation:** If CreateResourceModal is preserved for editing, utilities stay. If refactored to ResourceEditModal, audit and remove unused functions.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct file inspection
  - `apps/web/src/components/modals/CreateResourceModal.tsx` (3024 lines, edit mode confirmed)
  - `apps/web/src/components/modals/RegisterResourceModal.tsx` (no imports found)
  - `apps/web/src/contexts/ModalContext.tsx` (modal state defined but unused)
  - `apps/web/src/components/GlobalModals.tsx` (renders CreateResourceModal)
  - `apps/web/src/components/AddResourceModalButton.tsx` (already routes to wizard)
  - `apps/web/src/app/dashboard/resources/page.tsx` (uses CreateResourceModal for editing)
  - `apps/web/src/app/dashboard/resources/new/` (wizard routes confirmed)

- **Git history** - Commit evidence
  - Commit c384f93: "refactor(19): route all 'Add Resource' buttons to wizard page"
  - Commits 2026-01-29 to 2026-02-01: Phases 19-24 implementation

- **Requirements analysis** - `.planning/REQUIREMENTS.md`
  - CLNP-01: Remove CreateResourceModal
  - CLNP-02: Redirect entry points to `/resources/new`
  - EDIT-01/EDIT-02: Deferred to future

### Secondary (MEDIUM confidence)
- **React cleanup best practices** - Web research (2026)
  - [Expert Tips for Handling Component Cleanup in React Lifecycle](https://moldstud.com/articles/p-expert-tips-for-handling-component-cleanup-in-react-lifecycle)
  - [Techniques for Removing React Unused Components](https://www.dhiwise.com/post/techniques-for-identifying-and-eliminating-react-unused-components)
  - [useEffect – React Official Docs](https://react.dev/reference/react/useEffect)

## Metadata

**Confidence breakdown:**
- File locations and imports: HIGH - Verified with grep and file inspection
- Edit functionality impact: HIGH - Code inspection confirmed usage
- Entry points migration: HIGH - Git history and current code verified
- State cleanup requirements: HIGH - Direct context inspection

**Research date:** 2026-02-01
**Valid until:** 60 days (stable cleanup task, code won't change unless edits implemented)

**Critical decision required:** How to handle edit functionality (use ResourceEditModal vs preserve CreateResourceModal vs break temporarily). This decision affects cleanup scope.
