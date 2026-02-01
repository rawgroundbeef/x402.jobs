---
phase: 15-resource-creation-ui
plan: 02
subsystem: frontend
tags: [ui, forms, openrouter, react-hook-form, model-browser]

requires:
  - "15-01"
  - "14-02"

provides:
  - "OpenRouter resource creation flow in CreateResourceModal"
  - "Model browser integration for model selection"
  - "System prompt editor with parameter tag detection"
  - "Complete form validation and submission to backend"

affects:
  - "16-01 (execution needs form-created resources)"

tech-stack:
  added:
    - "ModelBrowser component integration"
  patterns:
    - "react-hook-form with zod validation"
    - "Visual parameter tag indicators below textarea"
    - "Auto-parameter extraction from prompt template"

key-files:
  created: []
  modified:
    - "apps/x402-jobs/src/components/modals/CreateResourceModal.tsx"

decisions:
  - title: "Visual tag indicators instead of inline syntax highlighting"
    rationale: "Tags are extracted and displayed as colored badges below textarea rather than inline highlighting. Provides clear feedback without complex highlighting library. Purple for defined parameters, yellow for undefined."
    date: "2026-01-27"

  - title: "Dual storage pattern confirmed in form"
    rationale: "Form submits both openrouter_config fields AND pt_* fields for backend compatibility (decision from 15-01)"
    date: "2026-01-27"

  - title: "Context-aware max_tokens default"
    rationale: "When user selects model, default max_tokens set to min(context_length/4, 4096) for sensible defaults"
    date: "2026-01-27"

metrics:
  duration: "5 minutes"
  completed: "2026-01-27"
---

# Phase 15 Plan 02: OpenRouter Resource Creation Form Summary

**One-liner:** OpenRouter instant resource creation with model browser, parameter auto-extraction, and visual tag indicators

## What Was Built

### Type Selection Extension

- Added `openrouter_instant` to ResourceType union
- Added fourth type selection card with indigo Network icon (200+ AI models)
- Updated grid layout from 3 columns to 4 (sm:grid-cols-2 lg:grid-cols-4)
- Added OpenRouter badge styling (indigo-500)
- Updated dialog titles to include "Create OpenRouter Resource"

### OpenRouter Integration Check

- Added useSWR hook for `/integrations/openrouter/config`
- Displays API key warning alert if not configured
- Links to `/dashboard/integrations` for configuration
- Form submit button disabled without valid API key

### Form State Management

- Created `openrouterForm` with react-hook-form + zod validation
- Added `selectedModel` and `showModelBrowser` state
- Created `orParameterFields` field array for parameter management
- Auto-extract parameters useEffect (matches prompt template pattern)

### Model Selection UI

- Model browser dialog (full-screen modal with close button)
- Selected model display card with provider name and Change button
- Empty state: "Select a model..." button with Box icon
- On selection: auto-set max_tokens based on model context_length

### Form Fields

- **Network:** Base/Solana radio buttons with ChainIcon
- **Model:** Browser dialog integration (see above)
- **Name:** Text input with auto-slug generation
- **Slug:** Input with real-time availability check, regenerate button
- **Description:** Textarea (2 rows)
- **Image:** ImageUrlOrUpload component
- **Category:** Select dropdown from RESOURCE_CATEGORIES
- **Price:** Number input (min $0.01, step 0.01)

### System Prompt Editor

- Textarea with font-mono styling (200px min height)
- Placeholder: `"You are a helpful assistant that specializes in {topic}{/topic}..."`
- Visual tag indicators below editor:
  - **Purple badges:** Defined parameters (in both prompt and parameters list)
  - **Yellow badges:** Undefined tags (in prompt but no parameter definition)
  - **Yellow warnings:** Unused parameters (defined but not in prompt)
- Character count display

### Parameters Section

- "Add Parameter" button creates new parameter entry
- Empty state: dashed border message
- Each parameter card:
  - Name input (required)
  - Description input (optional)
  - Required checkbox
  - Default value input (disabled when required=true)
  - Remove button (Trash2 icon)
- Auto-add when new tags detected in system prompt

### Model Settings

- **Temperature:** Number input (0-2, step 0.1, default 1)
- **Max Tokens:** Number input (1-128000, default 4096)
  - Shows model context length in helper text if available
- **User Input:** Switch toggle (allows_user_message)

### Form Submission

- Submit handler: `handleCreateOpenRouter`
- Posts to `/resources/instant` with `resourceType: "openrouter_instant"`
- Validation: slug availability, API key existence
- Success: redirects to success step with resource URL
- Error: displays error message in alert

### Handler Extensions

- `handleNameChange`: added `openrouter_instant` case
- `regenerateSlug`: added `openrouter_instant` case
- `handleClose`: resets OpenRouter state (form, model, browser)

## Technical Implementation

### Component Architecture

```
CreateResourceModal
├── Type Selection (4 cards)
├── OpenRouter Form
│   ├── API Key Warning (conditional)
│   ├── Network Selection
│   ├── Model Browser Dialog (conditional)
│   ├── Basic Metadata Fields
│   ├── System Prompt Editor + Tag Indicators
│   ├── Parameters Section (auto-extracted)
│   └── Model Settings
└── Footer (Cancel + Create buttons)
```

### Form Validation Schema

- Uses `createOpenRouterResourceSchema` from `@/types/openrouter-resource`
- Validates: name, slug, model_id, system_prompt, parameters, temperature, max_tokens
- Slug: real-time availability check with debounce
- Price: minimum $0.001 (same as other resource types)

### State Flow

1. User clicks "OpenRouter Model" card → `resourceType = "openrouter_instant"`, `step = "form"`
2. Form loads → checks OpenRouter integration, loads empty defaults
3. User clicks "Select a model..." → `showModelBrowser = true`
4. User selects model → `selectedModel = model`, `model_id = model.id`, auto-sets max_tokens
5. User types system prompt → auto-extracts tags, creates parameter entries
6. User fills parameters, sets price, metadata
7. User clicks "Create Resource" → validates, submits to backend
8. Success → `step = "success"`, displays resource URL

## Files Modified

### apps/x402-jobs/src/components/modals/CreateResourceModal.tsx

**Changed:**

- Added imports: Network, ModelBrowser, AIModel, createOpenRouterResourceSchema, CreateOpenRouterResourceInput
- Added `openrouter_instant` to ResourceType
- Added OpenRouter integration check (useSWR)
- Added OpenRouter state (selectedModel, showModelBrowser)
- Added openrouterForm with react-hook-form
- Added orParameterFields field array
- Added auto-extract parameters useEffect for OpenRouter
- Extended handleNameChange, regenerateSlug, handleClose
- Added handleCreateOpenRouter handler
- Added OpenRouter type selection card
- Updated grid layout to 4 columns
- Updated dialog title/badge cases
- Added complete OpenRouter form UI (500+ lines)
- Added OpenRouter footer buttons

## Deviations from Plan

None - plan executed exactly as written.

## Verification

✅ Build succeeds: `npm run build` compiles without errors
✅ Type selection shows 4 cards including "OpenRouter Model"
✅ OpenRouter form includes all required sections:

- API key warning if not configured
- Model selection with browser dialog
- Prompt editor with {{param}} tag detection and visual indicators
- Parameters section with auto-add
- Model settings (temperature, max_tokens, allows_user_message)
- Price and metadata fields

## Success Criteria Met

✅ **CREA-01:** "OpenRouter Model" appears in type selection with indigo Network icon
✅ **CREA-02:** Model browser dialog allows selection with search/filters (ModelBrowser component integrated)
✅ **CREA-03:** Prompt template editor with {{param}} syntax detection and visual tag indicators (purple for defined, yellow for undefined)
✅ **CREA-04:** Parameter definitions with name, description, required, default fields
✅ **CREA-05:** Price field with minimum $0.01
✅ **CREA-06:** Name, description, category, image fields present
✅ **CREA-07:** System prompt hidden from callers (stored server-side via POST body)
✅ **CREA-08:** Model parameters: temperature (0-2), max_tokens (1-128000), allows_user_message (switch)
✅ Form submission creates resource and shows success confirmation

## Next Phase Readiness

**Phase 16 (OpenRouter Execution)** can proceed:

- ✅ Form creates openrouter_instant resources in database
- ✅ modelId, systemPrompt, parameters stored correctly
- ✅ temperature, maxTokens, allowsUserMessage configuration saved
- ✅ Resources appear in user's dashboard for testing

**Known blockers:**

- Backend must accept openrouter_instant resourceType (completed in 15-01)
- Backend must validate OpenRouter API key exists (hasCreatorOpenRouterApiKey - completed in 15-01)
- Migration 005_add_openrouter_integration.sql must be applied to production

## Related Work

- **15-01:** Backend types and validation for OpenRouter resources
- **14-02:** ModelBrowser component with popular/all tabs, filters, pagination
- **11-01:** Database schema for OpenRouter integrations and ai_models

## Notes

### Visual Tag Indicators Implementation

The system prompt editor uses **detection with visual indicators** rather than inline syntax highlighting:

- Tags are extracted using `extractParameterTags(systemPrompt)`
- Displayed as colored badges below the textarea
- Purple: parameter defined in both prompt and parameters list
- Yellow: tag in prompt but no corresponding parameter (warning)
- Yellow: parameter defined but not used in prompt (warning)

This approach:

- Provides clear feedback without complex highlighting library
- Works with plain Textarea component (no CodeMirror/Monaco)
- Matches the existing Claude prompt template pattern
- Users see `font-mono` styling for code-like appearance

### Context-Aware Defaults

When user selects a model, the form automatically:

- Sets `model_id` to the selected model's UUID
- Sets `max_tokens` to `Math.min(context_length / 4, 4096)`
  - Example: GPT-4 (8192 context) → 2048 max_tokens
  - Example: Claude Opus (200k context) → 4096 max_tokens (capped)

This provides sensible defaults while respecting model limits.

### Form Validation

- Real-time slug availability check (debounced)
- Zod schema validation on all fields
- Submit button disabled when:
  - Form is submitting
  - Slug is being checked
  - Slug is unavailable
  - OpenRouter API key not configured

---

**Commits:**

- dfa0b4c7: feat(15-02): add OpenRouter resource creation form

**Completed:** 2026-01-27
**Duration:** ~5 minutes
