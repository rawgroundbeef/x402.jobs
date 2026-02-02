# Phase 2: Creator Template Definition UI - Research

**Researched:** 2026-01-19
**Domain:** React forms, modal patterns, syntax highlighting, form arrays
**Confidence:** HIGH

## Summary

Phase 2 involves extending the existing `CreateResourceModal` to support a new "Prompt Template" resource type. The codebase has well-established patterns for resource creation that must be followed: react-hook-form with Zod validation, `@repo/ui` component library, `authenticatedFetch` for API calls, and the existing modal/step structure.

Key findings:

1. The existing `CreateResourceModal.tsx` already supports multiple resource types (external, proxy) with a step-based flow
2. Form patterns use react-hook-form with zodResolver and Zod schemas
3. `useFieldArray` is already used in the codebase for dynamic arrays (workflowInputs in JobPanel)
4. Image upload has an existing `ImageUrlOrUpload` component that handles both URL and file upload
5. Toast notifications use `useToast` from `@repo/ui/toast`
6. The Switch component from `@repo/ui/switch` is used for boolean toggles throughout

**Primary recommendation:** Extend `CreateResourceModal.tsx` to add "prompt_template" as a third resource type, following existing patterns for type selection, form structure, and API integration.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library             | Version    | Purpose                    | Why Standard                                        |
| ------------------- | ---------- | -------------------------- | --------------------------------------------------- |
| react-hook-form     | (existing) | Form state management      | Already used throughout codebase for all forms      |
| @hookform/resolvers | (existing) | Zod validation integration | Already used with zodResolver                       |
| zod                 | (existing) | Schema validation          | createPromptTemplateSchema already defined in types |
| @repo/ui            | (internal) | UI components              | All form inputs, dialogs, buttons from this package |

### Supporting

| Library               | Version    | Purpose         | When to Use                                  |
| --------------------- | ---------- | --------------- | -------------------------------------------- |
| lucide-react          | (existing) | Icons           | All icons in the codebase use this           |
| @supabase/supabase-js | (existing) | Database client | Only if direct DB access needed (likely not) |

### Alternatives Considered

| Instead of          | Could Use         | Tradeoff                                        |
| ------------------- | ----------------- | ----------------------------------------------- |
| react-hook-form     | Formik            | Don't - codebase uses RHF everywhere            |
| Zod                 | Yup               | Don't - Zod schemas already defined             |
| Custom highlighting | CodeMirror/Monaco | Overkill - CONTEXT.md specifies simple textarea |

**Installation:**

```bash
# No new packages needed - all dependencies exist
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── modals/
│       └── CreateResourceModal.tsx   # Extend this file (primary change)
├── types/
│   └── prompt-template.ts            # Already exists with schemas
├── hooks/
│   └── useResourceImageUpload.ts     # Existing - reuse for image upload
└── lib/
    └── api.ts                        # authenticatedFetch - use for API calls
```

### Pattern 1: Step-based Modal Flow

**What:** Modal with step management (select type -> form -> success)
**When to use:** Always for resource creation - already established
**Example:**

```typescript
// From CreateResourceModal.tsx
type Step = "select" | "form" | "success";
type ResourceType = "external" | "proxy" | "prompt_template"; // Add new type

const [step, setStep] = useState<Step>("select");
const [resourceType, setResourceType] = useState<ResourceType | null>(null);

// Step 1: Type selection with cards
// Step 2: Form based on selected type
// Step 3: Success confirmation
```

### Pattern 2: react-hook-form with Zod

**What:** Form state managed by RHF, validated by Zod schema
**When to use:** All form submissions in this codebase
**Example:**

```typescript
// Source: CreateResourceModal.tsx lines 240-255
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPromptTemplateSchema, CreatePromptTemplateInput } from "@/types/prompt-template";

const promptTemplateForm = useForm<CreatePromptTemplateInput>({
  resolver: zodResolver(createPromptTemplateSchema),
  defaultValues: {
    name: "",
    slug: "",
    description: "",
    category: "",
    // ... other defaults from schema
  },
});

// Field binding
<Input {...promptTemplateForm.register("name")} />
```

### Pattern 3: useFieldArray for Dynamic Lists

**What:** RHF hook for managing arrays of form fields
**When to use:** Parameter list management (add/remove/update parameters)
**Example:**

```typescript
// Source: JobPanel.tsx lines 480-486
const {
  fields: parameterFields,
  append: appendParameter,
  remove: removeParameter,
  update: updateParameter,
} = useFieldArray({
  control: promptTemplateForm.control,
  name: "parameters",
});

// Rendering fields
{parameterFields.map((field, index) => (
  <div key={field.id}>
    <Input {...promptTemplateForm.register(`parameters.${index}.name`)} />
    <Button onClick={() => removeParameter(index)}>Remove</Button>
  </div>
))}

// Adding new
<Button onClick={() => appendParameter({ name: "", description: "", required: true })}>
  Add Parameter
</Button>
```

### Pattern 4: authenticatedFetch for API Calls

**What:** Wrapper that adds auth token to fetch requests
**When to use:** All authenticated API calls
**Example:**

```typescript
// Source: CreateResourceModal.tsx lines 566-576
const res = await authenticatedFetch("/resources/instant", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    resourceType: "prompt_template",
    name: data.name.trim(),
    // ... other fields
  }),
});

if (!res.ok) {
  const responseData = await res.json();
  throw new Error(responseData.error || "Failed to create resource");
}
```

### Pattern 5: UI Component Usage

**What:** Consistent UI components from @repo/ui
**When to use:** All form inputs and UI elements
**Example:**

```typescript
// Source: CreateResourceModal.tsx various
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  DialogBody,
  DialogFooter,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Label } from "@repo/ui/label";
import { Select } from "@repo/ui/select";
import { Switch } from "@repo/ui/switch";
```

### Anti-Patterns to Avoid

- **Direct Supabase calls in components:** Use authenticatedFetch for API calls
- **Custom form state management:** Use react-hook-form, not useState for form fields
- **Non-Zod validation:** Use existing Zod schemas from types/prompt-template.ts
- **Custom dialog components:** Use AnimatedDialog from @repo/ui/dialog
- **Inline styles:** Use Tailwind classes consistently

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem         | Don't Build        | Use Instead                  | Why                                               |
| --------------- | ------------------ | ---------------------------- | ------------------------------------------------- |
| Form state      | useState per field | react-hook-form              | Already used, handles validation, dirty state     |
| Validation      | Custom if/else     | Zod + zodResolver            | Schema already exists in types/prompt-template.ts |
| Dynamic arrays  | Array.push/splice  | useFieldArray                | Proper key handling, RHF integration              |
| Image upload    | Custom fetch       | ImageUrlOrUpload component   | Handles URL mode, file upload, progress           |
| Toast messages  | Custom div         | useToast from @repo/ui/toast | Consistent styling, auto-dismiss                  |
| Slug validation | Manual API call    | Existing slug check pattern  | See CreateResourceModal lines 283-304             |

**Key insight:** The codebase has mature patterns for all these problems. Following them ensures consistency and reduces bugs.

## Common Pitfalls

### Pitfall 1: Not Following Modal Type Selection Pattern

**What goes wrong:** Creating a separate modal instead of extending existing
**Why it happens:** Desire to avoid touching working code
**How to avoid:** Add "prompt_template" as a third option in CreateResourceModal.tsx
**Warning signs:** Creating new modal file, duplicating step logic

### Pitfall 2: Missing Form Reset on Modal Close

**What goes wrong:** Form state persists between opens, showing stale data
**Why it happens:** Not handling onClose properly
**How to avoid:** Follow existing handleClose pattern (line 344-367) that resets all form state
**Warning signs:** Old values appearing when reopening modal

### Pitfall 3: Incorrect useFieldArray Key Usage

**What goes wrong:** React key warnings, items reordering incorrectly
**Why it happens:** Using index instead of field.id as key
**How to avoid:** Always use `field.id` from useFieldArray as the key
**Warning signs:** Console warnings about keys, flickering on add/remove

### Pitfall 4: Forgetting Edit Mode

**What goes wrong:** CRTR-09 (edit published template) not working
**Why it happens:** Only building create flow
**How to avoid:** Check isEditMode flag throughout, populate form from editResource prop
**Warning signs:** Edit button doesn't open pre-filled form

### Pitfall 5: Syntax Highlighting Complexity

**What goes wrong:** Over-engineering the editor with CodeMirror/Monaco
**Why it happens:** Developer instinct to use "proper" code editors
**How to avoid:** CONTEXT.md explicitly says "simple textarea with monospace font"
**Warning signs:** Adding npm packages for editors, complex highlighting logic

## Code Examples

Verified patterns from the codebase:

### Type Selection Step (extend existing)

```typescript
// Source: CreateResourceModal.tsx lines 713-750
// Add third card for prompt_template
<button
  onClick={() => handleSelectType("prompt_template")}
  className="p-4 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
>
  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
    <FileText className="w-5 h-5 text-purple-500" />
  </div>
  <h3 className="font-medium mb-1">Prompt Template</h3>
  <p className="text-sm text-muted-foreground">
    Monetize AI prompts with your own Claude templates
  </p>
</button>
```

### Switch Component for Boolean Toggle

```typescript
// Source: ResourceConfigModal.tsx lines 184-195
<div className="flex items-center justify-between py-2">
  <div>
    <Label>Allow User Message</Label>
    <p className="text-xs text-muted-foreground">
      Enable system + user message mode
    </p>
  </div>
  <Switch
    checked={promptTemplateForm.watch("allows_user_message")}
    onCheckedChange={(checked) =>
      promptTemplateForm.setValue("allows_user_message", checked)
    }
  />
</div>
```

### Parameter Management with useFieldArray

```typescript
// Pattern from JobPanel.tsx workflowInputs
const {
  fields: parameterFields,
  append: appendParameter,
  remove: removeParameter,
} = useFieldArray({
  control: promptTemplateForm.control,
  name: "parameters",
});

// Render list
{parameterFields.map((field, index) => (
  <div key={field.id} className="p-3 border rounded-lg space-y-3">
    <Input
      placeholder="Parameter name"
      {...promptTemplateForm.register(`parameters.${index}.name`)}
    />
    <Input
      placeholder="Description"
      {...promptTemplateForm.register(`parameters.${index}.description`)}
    />
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Switch
          checked={promptTemplateForm.watch(`parameters.${index}.required`)}
          onCheckedChange={(v) => promptTemplateForm.setValue(`parameters.${index}.required`, v)}
        />
        <span className="text-sm">Required</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeParameter(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
))}

<Button
  variant="outline"
  onClick={() => appendParameter({ name: "", description: "", required: true, default: "" })}
>
  <Plus className="h-4 w-4 mr-2" /> Add Parameter
</Button>
```

### Image Upload Component Usage

```typescript
// Source: CreateResourceModal.tsx lines 1238-1254
<div>
  <Label>Image (optional)</Label>
  <div className="mt-1.5">
    <ImageUrlOrUpload
      value={promptTemplateForm.watch("avatar_url") || ""}
      onChange={(val) => promptTemplateForm.setValue("avatar_url", val)}
      placeholder="https://example.com/image.png"
    />
  </div>
</div>
```

### Toast Notification

```typescript
// Source: ResourceEditModal.tsx lines 212
import { useToast } from "@repo/ui/toast";

const { toast } = useToast();

// On success
toast({ title: "Template published", variant: "success" });

// On error (using inline error state instead is also acceptable)
toast({ title: "Failed to save template", variant: "destructive" });
```

### System Prompt Textarea with Character Count

```typescript
// Custom component for system prompt editor
<div>
  <Label>System Prompt *</Label>
  <p className="text-xs text-muted-foreground mb-2">
    Use {'{paramName}{/paramName}'} to mark parameter placeholders
  </p>
  <Textarea
    {...promptTemplateForm.register("system_prompt")}
    className="font-mono text-sm min-h-[200px]"
    placeholder="You are a helpful assistant that..."
  />
  <div className="flex justify-between mt-1">
    <p className="text-xs text-muted-foreground">
      Parameters used: {extractParams(promptTemplateForm.watch("system_prompt")).join(", ") || "none"}
    </p>
    <p className="text-xs text-muted-foreground">
      {promptTemplateForm.watch("system_prompt")?.length || 0} characters
    </p>
  </div>
</div>
```

## State of the Art

| Old Approach       | Current Approach      | When Changed    | Impact                      |
| ------------------ | --------------------- | --------------- | --------------------------- |
| Custom form state  | react-hook-form       | Already current | Continue using RHF          |
| Manual validation  | Zod schemas           | Already current | Schemas already exist       |
| Alert() for errors | toast() notifications | Already current | Use toast for success/error |

**Deprecated/outdated:**

- None identified - codebase is modern and consistent

## Open Questions

Things that couldn't be fully resolved:

1. **Tag styling implementation**
   - What we know: CONTEXT.md says "distinct styling" for {param}{/param} tags
   - What's unclear: Whether to use CSS-only (span highlighting) or contenteditable
   - Recommendation: Start with simple regex-based span wrapping in a preview, not in the textarea itself. Can enhance later if needed.

2. **API endpoint for prompt template creation**
   - What we know: Existing resources use POST /resources/instant
   - What's unclear: Whether same endpoint handles prompt_template or needs new one
   - Recommendation: Assume same endpoint with resourceType: "prompt_template" and prompt template fields. Backend team to confirm.

3. **Minimum price enforcement**
   - What we know: CONTEXT.md says $0.01 minimum
   - What's unclear: Whether this differs from existing $0.001 minimum for proxy resources
   - Recommendation: Use $0.01 as minimum in Zod schema for prompt templates specifically

## Sources

### Primary (HIGH confidence)

- CreateResourceModal.tsx (1483 lines) - Complete resource creation patterns
- types/prompt-template.ts - Zod schemas and TypeScript types
- JobPanel.tsx - useFieldArray usage for dynamic forms
- ResourceEditModal.tsx - Edit flow, toast usage, image upload

### Secondary (MEDIUM confidence)

- CONTEXT.md - User decisions constraining implementation
- REQUIREMENTS.md - CRTR requirements for Phase 2

### Tertiary (LOW confidence)

- None - all patterns verified against existing codebase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Patterns observed in multiple files
- Pitfalls: HIGH - Based on existing code patterns

**Research date:** 2026-01-19
**Valid until:** 90 days (stable patterns, internal codebase)
