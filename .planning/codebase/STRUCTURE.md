# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
x402-jobs/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (public)/           # Public user profile routes
│   │   ├── admin/              # Admin pages
│   │   ├── api/                # API routes (minimal)
│   │   ├── auth/               # Auth callback
│   │   ├── bounties/           # Bounty pages
│   │   ├── create/             # Job creation
│   │   ├── dashboard/          # User dashboard section
│   │   ├── developer/          # Developer tools
│   │   ├── developers/         # API docs
│   │   ├── discover/           # Discovery page
│   │   ├── docs/               # Documentation
│   │   ├── hackathons/         # Hackathon pages
│   │   ├── jobs/               # Job pages (list, detail, canvas)
│   │   ├── login/              # Login page
│   │   ├── resources/          # Resource pages
│   │   ├── rewards/            # Rewards pages
│   │   ├── servers/            # Server pages
│   │   ├── signup/             # Signup page
│   │   ├── user/               # User profile pages
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── icons/              # Icon components
│   │   ├── inputs/             # Form input components
│   │   ├── lro/                # Long-running operation components
│   │   ├── modals/             # Modal dialogs
│   │   ├── pages/              # Full page components
│   │   ├── panels/             # Slide-out panels
│   │   ├── sidebars/           # Sidebar components
│   │   ├── workflow/           # Workflow canvas nodes
│   │   └── [Component]/        # Feature-specific components
│   ├── contexts/               # React contexts
│   ├── constants/              # App constants
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Core utilities
│   └── types/                  # TypeScript types
├── public/                     # Static assets
├── .planning/                  # Planning documents
├── next.config.js              # Next.js config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies
```

## Directory Purposes

**`src/app/`:**

- Purpose: Next.js App Router route definitions
- Contains: page.tsx files (thin wrappers), layout.tsx files, route groups
- Key files: `layout.tsx` (root layout), `page.tsx` (home)

**`src/components/pages/`:**

- Purpose: Full page implementations with business logic
- Contains: Page-level components like `HomePage.tsx`, `JobCanvas.tsx`
- Key files: `JobCanvas/JobCanvas.tsx` (main workflow editor), `HomePage/HomePage.tsx`

**`src/components/workflow/`:**

- Purpose: React Flow node components for workflow canvas
- Contains: Node types (TriggerNode, ResourceNode, TransformNode, OutputNode, SourceNode)
- Key files: `WorkflowCanvas.tsx` (main canvas wrapper), `nodes/ResourceNode.tsx`

**`src/components/panels/`:**

- Purpose: Railway-style slide-out configuration panels
- Contains: Resource config, trigger config, output config, run details
- Key files: `SlidePanel.tsx` (base), `ResourceConfigPanel.tsx`, `RunWorkflowPanel.tsx`

**`src/components/modals/`:**

- Purpose: Modal dialog components
- Contains: Create job, search resources, confirmation dialogs
- Key files: `ResourcesModal.tsx`, `CreateJobModal.tsx`, `ResourceInteractionModal.tsx`

**`src/hooks/`:**

- Purpose: Custom React hooks for data fetching and state
- Contains: SWR queries, mutations, utility hooks
- Key files: `useJobQuery.ts`, `useWorkflowPersistence.ts`, `useWallet.ts`

**`src/contexts/`:**

- Purpose: React contexts for global state
- Contains: Auth, Modal contexts
- Key files: `AuthContext.tsx`, `ModalContext.tsx`

**`src/lib/`:**

- Purpose: Core utility functions and API client
- Contains: API helpers, Supabase client, formatting
- Key files: `api.ts` (API client), `supabase.ts`, `config.ts`

**`src/types/`:**

- Purpose: Shared TypeScript type definitions
- Contains: Run types, dashboard types, output config
- Key files: `runs.ts`, `dashboard.ts`, `output-config.ts`

## Key File Locations

**Entry Points:**

- `src/app/layout.tsx`: Root layout with all providers
- `src/app/page.tsx`: Home page (renders HomePage component)
- `src/app/jobs/[id]/page.tsx`: Job canvas page

**Configuration:**

- `next.config.js`: Next.js configuration
- `tailwind.config.ts`: Tailwind CSS configuration
- `tsconfig.json`: TypeScript configuration
- `.env` / `.env.local`: Environment variables

**Core Logic:**

- `src/components/pages/JobCanvas/JobCanvas.tsx`: Main workflow editor (2200+ lines)
- `src/hooks/useWorkflowPersistence.ts`: Workflow state management
- `src/lib/api.ts`: API client with auth
- `src/contexts/AuthContext.tsx`: Authentication state

**Testing:**

- No test files detected in codebase

## Naming Conventions

**Files:**

- Components: `PascalCase.tsx` (e.g., `ResourceNode.tsx`, `JobCanvas.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useJobQuery.ts`, `useWorkflowPersistence.ts`)
- Types: `camelCase.ts` (e.g., `runs.ts`, `dashboard.ts`)
- Utils: `camelCase.ts` (e.g., `api.ts`, `supabase.ts`)

**Directories:**

- Component folders: `PascalCase/` with `index.ts` barrel export
- Route folders: `kebab-case/` or `[param]/` for dynamic routes
- Feature folders: `camelCase/` (e.g., `workflow/`, `panels/`)

**Exports:**

- Components use barrel exports via `index.ts` files
- Default export for page components
- Named exports for utilities and hooks

## Where to Add New Code

**New Feature (full page):**

- Route: `src/app/[feature]/page.tsx`
- Component: `src/components/pages/[Feature]Page/[Feature]Page.tsx`
- Add barrel export: `src/components/pages/[Feature]Page/index.ts`

**New Component:**

- Shared UI: `src/components/[ComponentName]/[ComponentName].tsx`
- Workflow node: `src/components/workflow/nodes/[NodeType]Node.tsx`
- Panel: `src/components/panels/[Feature]Panel.tsx`
- Modal: `src/components/modals/[Feature]Modal.tsx`

**New Hook:**

- Query hook: `src/hooks/use[Entity]Query.ts`
- Mutation hook: `src/hooks/use[Action]Mutation.ts`
- Utility hook: `src/hooks/use[Feature].ts`

**New Type:**

- Add to existing file if related: `src/types/[domain].ts`
- Create new file for new domain: `src/types/[newDomain].ts`

**Utilities:**

- API-related: `src/lib/api.ts` or new file in `src/lib/`
- Formatting: `src/lib/format.ts`
- Config: `src/lib/config.ts`

## Special Directories

**`.next/`:**

- Purpose: Next.js build output
- Generated: Yes
- Committed: No (in .gitignore)

**`.planning/`:**

- Purpose: Planning and architecture documentation
- Generated: No
- Committed: Yes

**`node_modules/`:**

- Purpose: Dependencies
- Generated: Yes
- Committed: No

**`public/`:**

- Purpose: Static assets (images, logos)
- Generated: No
- Committed: Yes

---

_Structure analysis: 2026-01-19_
