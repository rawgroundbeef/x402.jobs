# Phase 1: Database Schema + Resource Type - Research

**Researched:** 2026-01-19
**Domain:** Database schema, TypeScript types, Supabase patterns
**Confidence:** HIGH

## Summary

Phase 1 establishes the data foundation for prompt templates. The codebase already has a pattern for multiple resource types (`external`, `proxy`, `prompt`, `static`) with type-specific fields stored in the main resources table and handled through API endpoints.

The new `prompt_template` resource type differs from the existing `prompt` type in a critical way: the existing `prompt` type stores the creator's API key server-side and executes on the server. The new `prompt_template` type stores only the template content server-side and relies on client-side execution with the caller's API key (BYOK model).

**Primary recommendation:** Add `prompt_template` as a new resource type with dedicated fields in the existing resources infrastructure, following the established pattern of type-specific fields handled at the API layer.

## Standard Stack

The codebase already uses these patterns:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.47.22 | Database client | Already in use for auth, API calls go through backend |
| `zod` | ^3.24.4 | Schema validation | Already used for form validation |
| TypeScript | ^5.3.3 | Type safety | Codebase standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | ^7.62.0 | Form handling | Template creation/editing forms |
| `@hookform/resolvers` | 3.3.4 | Zod integration | Form schema validation |

### No New Dependencies Needed
This phase does not require new npm packages. All infrastructure exists.

## Architecture Patterns

### Existing Resource Type Pattern

The codebase uses a single `resources` table with type-specific fields:

```typescript
// From src/app/dashboard/resources/page.tsx
interface Resource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: string;
  price_usdc: string;
  resource_type: "external" | "proxy" | "prompt" | "static";  // Add "prompt_template"
  call_count: number;
  total_earned_usdc: number;
  is_active: boolean;
  created_at: string;
  avatar_url?: string | null;
  category?: string;
  // Type-specific fields handled at API layer
}
```

### Recommended Data Model Approach

**Option A: Add fields to resources table (Recommended)**
Following the existing pattern where `proxy` has `proxy_origin_url`, `proxy_method`, etc.

```sql
-- Add to existing resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS pt_system_prompt TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS pt_parameters JSONB DEFAULT '[]';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS pt_model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS pt_max_tokens INTEGER DEFAULT 4096;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS pt_allows_user_message BOOLEAN DEFAULT false;
```

**Option B: Separate prompt_templates table (Alternative)**
A separate table linked to resources via `resource_id`:

```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '[]',
  model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER DEFAULT 4096,
  allows_user_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id)
);
```

**Recommendation: Option A** - Matches existing patterns for `proxy`, `prompt`, `static` types. Simpler queries, less join complexity.

### Parameter Schema

```typescript
// Types for prompt template parameters
interface PromptTemplateParameter {
  name: string;              // e.g., "topic"
  description: string;       // Displayed to caller
  required: boolean;         // Enforced before payment
  default?: string;          // Pre-filled value
}

// Full prompt template type
interface PromptTemplate {
  system_prompt: string;              // Creator's IP, never exposed to callers
  parameters: PromptTemplateParameter[];
  model: string;                      // Hardcoded to claude-sonnet-4-20250514 for v1
  max_tokens: number;                 // Default 4096
  allows_user_message: boolean;       // Enables system+user mode
}
```

### Recommended Project Structure

```
src/
├── types/
│   └── prompt-template.ts       # New: PromptTemplate, PromptTemplateParameter types
├── lib/
│   └── prompt-template-utils.ts # New: Parameter extraction, validation
└── hooks/
    └── usePromptTemplateQuery.ts # New: SWR hook for fetching templates
```

### Anti-Patterns to Avoid

- **Storing caller's API key**: Never. The entire security model depends on BYOK.
- **Exposing system_prompt in public endpoints**: RLS must prevent non-owner access.
- **Mixing with existing `prompt` type**: That type stores server-side API keys. Keep separate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom UUID function | Supabase `gen_random_uuid()` | Database handles it |
| JSON field validation | Custom parsing | Zod + JSONB | Existing pattern |
| Type guards | Manual type checks | TypeScript discriminated unions | Type safety |

## Common Pitfalls

### Pitfall 1: Resource Type Enum Not Updated
**What goes wrong:** Adding `prompt_template` to TypeScript types but forgetting database enum or API validation.
**Why it happens:** Multiple layers need updates.
**How to avoid:** Create checklist: 1) DB migration, 2) API validation, 3) TypeScript types, 4) UI type guards.
**Warning signs:** TypeScript compiles but API returns 400.

### Pitfall 2: RLS Policy Gaps
**What goes wrong:** system_prompt readable by non-owners through some endpoint.
**Why it happens:** New resource type not covered by existing RLS policies.
**How to avoid:** Explicit RLS test: query as non-owner, verify system_prompt is null.
**Warning signs:** Any endpoint that returns resource data without filtering system_prompt.

### Pitfall 3: Parameter Schema Mismatch
**What goes wrong:** Creator saves parameters, but format differs from what caller UI expects.
**Why it happens:** No single source of truth for parameter schema.
**How to avoid:** Define Zod schema once, use for both creation and retrieval.
**Warning signs:** Parameters saved correctly but caller form doesn't render properly.

### Pitfall 4: Confusing with Existing `prompt` Type
**What goes wrong:** Code meant for `prompt_template` accidentally handles `prompt` resources.
**Why it happens:** Similar names, overlapping concepts.
**How to avoid:** Clear naming: `pt_*` prefix for all prompt_template fields. Explicit type checks.
**Warning signs:** Server-side API key logic triggered for prompt_template resources.

## Code Examples

### TypeScript Types (New File)

```typescript
// src/types/prompt-template.ts

import { z } from 'zod';

// Parameter schema
export const promptTemplateParameterSchema = z.object({
  name: z.string().min(1, "Parameter name required"),
  description: z.string().default(""),
  required: z.boolean().default(true),
  default: z.string().optional(),
});

export type PromptTemplateParameter = z.infer<typeof promptTemplateParameterSchema>;

// Full template schema (for creation/editing)
export const promptTemplateSchema = z.object({
  system_prompt: z.string().min(1, "System prompt required"),
  parameters: z.array(promptTemplateParameterSchema).default([]),
  model: z.string().default('claude-sonnet-4-20250514'),
  max_tokens: z.number().int().min(1).max(8192).default(4096),
  allows_user_message: z.boolean().default(false),
});

export type PromptTemplate = z.infer<typeof promptTemplateSchema>;

// Resource with prompt template fields (for API responses)
export interface PromptTemplateResource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: 'solana' | 'base';
  price_usdc: string;
  resource_type: 'prompt_template';
  avatar_url: string | null;
  category: string | null;
  created_at: string;
  // Prompt template specific (only present for owners)
  pt_system_prompt?: string;
  pt_parameters: PromptTemplateParameter[];
  pt_model: string;
  pt_max_tokens: number;
  pt_allows_user_message: boolean;
}

// Public view (for callers - no system_prompt)
export interface PromptTemplatePublicView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: 'solana' | 'base';
  price_usdc: string;
  avatar_url: string | null;
  category: string | null;
  // Parameters visible (for form generation)
  parameters: PromptTemplateParameter[];
  model: string;
  max_tokens: number;
  allows_user_message: boolean;
  // Stats
  usage_count?: number;
}
```

### Existing Resource Type Pattern (Reference)

```typescript
// From src/app/dashboard/resources/[id]/edit/page.tsx - existing pattern
// Shows how type-specific fields are handled

type ResourceType = "proxy" | "prompt" | "static";  // Add "prompt_template"

interface PromptParameter {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description?: string;
  default?: string;
}

// Type-specific state management pattern
const [promptParameters, setPromptParameters] = useState<PromptParameter[]>([]);
const [promptSystemPrompt, setPromptSystemPrompt] = useState("");

// Type-specific API body pattern
if (resourceType === "prompt") {
  body.promptSystemPrompt = promptSystemPrompt.trim();
  body.promptParameters = promptParameters.length > 0 ? promptParameters : null;
}
```

### SWR Hook Pattern (Reference)

```typescript
// From src/hooks/useJobQuery.ts - existing pattern
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";

export function usePromptTemplateQuery(templateId: string | null) {
  return useSWR<PromptTemplatePublicView>(
    templateId ? `/templates/${templateId}` : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single resource type | Multiple resource types | Already implemented | Add `prompt_template` following pattern |
| Server-side LLM execution | Client-side with BYOK | New for prompt_template | Different security model |

**Note:** The existing `prompt` resource type stores API keys server-side. The new `prompt_template` type is fundamentally different - no API key storage, client-side execution.

## Open Questions

### 1. Migration Strategy
- **What we know:** Codebase uses Supabase, migrations likely manual
- **What's unclear:** Migration file location, whether Prisma/Drizzle used
- **Recommendation:** Create SQL migration script, document manual application

### 2. API Endpoint Structure
- **What we know:** Existing endpoints follow `/resources/*` pattern
- **What's unclear:** Whether to use `/resources/instant` (like proxy) or new `/templates/*` endpoints
- **Recommendation:** Use `/resources/instant` with `resourceType: 'prompt_template'` for consistency

### 3. RLS Policy Details
- **What we know:** system_prompt must be protected
- **What's unclear:** Exact Supabase RLS policy syntax for this project
- **Recommendation:** Verify existing RLS patterns before implementing

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/src/app/dashboard/resources/page.tsx` - Resource interface
- Codebase analysis: `/src/app/dashboard/resources/[id]/edit/page.tsx` - Type-specific handling
- Codebase analysis: `/src/components/modals/CreateResourceModal.tsx` - Form validation patterns
- Codebase analysis: `/.planning/research/ARCHITECTURE.md` - Security model decisions

### Secondary (MEDIUM confidence)
- Codebase analysis: `/src/hooks/useJobQuery.ts` - SWR patterns
- Codebase analysis: `/src/types/` - Existing type patterns

### Tertiary (LOW confidence)
- General Supabase RLS patterns (not verified against this specific project)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly observed in codebase
- Architecture: HIGH - Follows existing patterns
- Data model: HIGH - Matches existing resource type approach
- Pitfalls: MEDIUM - Based on domain knowledge + codebase patterns

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - stable domain)
