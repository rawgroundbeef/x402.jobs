---
phase: 02-creator-template-ui
plan: 04
subsystem: integrations
tags: [claude, api-key, user-settings, swr]
dependency-graph:
  requires: ["02-03"]
  provides:
    - "ClaudeCard integration component"
    - "User-level API key management"
    - "CreateResourceModal integration check"
  affects: ["03-server-execution"]
tech-stack:
  added: []
  patterns:
    - "User-level integrations (not per-resource)"
    - "SWR for integration status checking"
key-files:
  created:
    - src/components/pages/AccountIntegrationsPage/components/ClaudeCard.tsx
  modified:
    - src/components/pages/AccountIntegrationsPage/AccountIntegrationsPage.tsx
    - src/components/modals/CreateResourceModal.tsx
    - src/types/prompt-template.ts
decisions:
  - id: user-level-api-key
    choice: "User-level Claude integration instead of per-template API key"
    rationale: "Better UX - configure once, use for all templates"
metrics:
  duration: 8m
  completed: 2026-01-20
---

# Phase 02 Plan 04: Claude Integration Card Summary

User-level Claude API key integration following TelegramCard pattern, with CreateResourceModal validation.

## What Was Built

### 1. ClaudeCard Integration Component

Created `ClaudeCard.tsx` following the existing TelegramCard pattern:

- SWR fetch from `/integrations/claude/config`
- Edit mode with password input for API key
- "Connected" badge when hasApiKey is true
- Link to Anthropic Console for obtaining keys
- Purple/coral accent color matching prompt template theme

### 2. Integrations Page Update

Added ClaudeCard to AccountIntegrationsPage:

- Imported and rendered ClaudeCard component
- Positioned Claude card first in the integration list
- Updated page description: "Connect external services and AI providers"

### 3. CreateResourceModal Integration Check

Modified CreateResourceModal for prompt template creation:

- Added SWR hook to fetch Claude integration status
- Warning alert when Claude integration is missing
- Submit button disabled without Claude integration
- Removed per-template API key field (moved to user-level)
- Link to `/dashboard/integrations` in warning message

## Technical Implementation

### SWR Integration Status Hook

```tsx
const { data: claudeIntegration } = useSWR<{ hasApiKey: boolean }>(
  resourceType === "prompt_template" ? "/integrations/claude/config" : null,
  authenticatedFetcher,
);
```

### Warning Alert Component

```tsx
{
  !isEditMode && claudeIntegration && !claudeIntegration.hasApiKey && (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        You need to configure your Claude API key before creating prompt
        templates.{" "}
        <NextLink
          href="/dashboard/integrations"
          className="text-primary hover:underline font-medium"
        >
          Configure in Settings
        </NextLink>
      </AlertDescription>
    </Alert>
  );
}
```

### Submit Button Disabled Logic

```tsx
disabled={
  isSubmitting ||
  (!isEditMode && (isCheckingSlug || (slugStatus !== null && !slugStatus.available))) ||
  (!isEditMode && claudeIntegration && !claudeIntegration.hasApiKey)
}
```

## Architecture Decision

Changed from per-template API key to user-level integration:

| Before                            | After                               |
| --------------------------------- | ----------------------------------- |
| API key per prompt template       | API key per user account            |
| Entered in CreateResourceModal    | Entered in Dashboard > Integrations |
| Stored with template              | Stored in user integrations         |
| Complex form with sensitive field | Simple form, security in one place  |

**Rationale:** Better UX - users configure their Claude API key once and can create unlimited prompt templates without re-entering credentials.

## Commits

| Hash    | Description                                         |
| ------- | --------------------------------------------------- |
| a25f31b | Create ClaudeCard integration component             |
| efdfcc6 | Add ClaudeCard to AccountIntegrationsPage           |
| c629a0d | Add Claude integration check to CreateResourceModal |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] ClaudeCard.tsx exists with proper structure
- [x] ClaudeCard shows on Integrations page
- [x] ClaudeCard has edit mode for API key entry
- [x] ClaudeCard shows "Connected" when configured
- [x] CreateResourceModal fetches Claude integration status
- [x] Warning shows when Claude integration missing
- [x] Submit disabled without Claude integration
- [x] TypeScript compiles without errors
- [x] Build succeeds

## Next Phase Readiness

**Phase 3 (Server Execution) Dependencies Met:**

- User can configure Claude API key in integrations
- CreateResourceModal validates integration before allowing template creation
- API key storage follows existing integration pattern (server handles encryption)

**Server-side needs:**

- `/integrations/claude/config` GET endpoint returning `{ hasApiKey: boolean }`
- `/integrations/claude/config` PUT endpoint accepting `{ apiKey: string, isEnabled: boolean }`
- Execution endpoint should read user's Claude API key from integrations table

---

_Generated: 2026-01-20T01:59:03Z_
