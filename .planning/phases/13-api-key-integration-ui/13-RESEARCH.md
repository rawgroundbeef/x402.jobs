# Phase 13: API Key Integration UI - Research

**Researched:** 2026-01-26
**Domain:** React UI for sensitive credential management
**Confidence:** HIGH

## Summary

This phase implements an OpenRouter API key integration card in Settings → Integrations, following the exact pattern established by the Claude integration (already implemented). The codebase provides a complete reference implementation that should be replicated with minimal changes.

**Research reveals:**

- Existing Claude integration provides complete blueprint (ClaudeCard.tsx, backend routes, encryption)
- UI follows established integration card pattern used by Claude, Telegram, and X
- Encryption infrastructure already in place (AES-256-CBC with encryptSecret/decryptSecret)
- Database schema ready (user_openrouter_integrations table from Phase 11)
- OpenRouter API keys follow bearer token authentication (no specific format validation required)

**Primary recommendation:** Clone ClaudeCard.tsx structure and backend routes pattern with OpenRouter-specific branding and endpoints.

## Standard Stack

The codebase uses an established stack that this phase must follow:

### Core UI

| Library      | Version  | Purpose                  | Why Standard                          |
| ------------ | -------- | ------------------------ | ------------------------------------- |
| React        | 18.x     | UI framework             | Existing codebase standard            |
| @repo/ui     | local    | Shared component library | Monorepo pattern, shadcn/ui based     |
| lucide-react | ^0.468.0 | Icon library             | Consistent with Claude/Telegram cards |
| useSWR       | latest   | Data fetching            | Used across all integration cards     |

### Supporting

| Library                  | Version | Purpose            | When to Use                         |
| ------------------------ | ------- | ------------------ | ----------------------------------- |
| @radix-ui/react-dialog   | latest  | Dialog primitives  | Delete confirmation modal           |
| class-variance-authority | latest  | Component variants | Button/Badge styling (via @repo/ui) |

### Backend

| Library          | Version  | Purpose     | When to Use                 |
| ---------------- | -------- | ----------- | --------------------------- |
| express          | latest   | API routing | Integration endpoints       |
| crypto (Node.js) | built-in | Encryption  | encryptSecret/decryptSecret |

**Installation:**

```bash
# No new dependencies required - all packages already installed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── pages/
│       └── AccountIntegrationsPage/
│           ├── AccountIntegrationsPage.tsx       # Parent container
│           └── components/
│               ├── ClaudeCard.tsx                # REFERENCE implementation
│               ├── OpenRouterCard.tsx            # NEW - replicate ClaudeCard
│               ├── TelegramCard.tsx              # Reference for show/hide token
│               └── XCard.tsx                     # Reference for OAuth flow
└── api/routes/
    └── integrations.ts                           # Backend routes
```

### Pattern 1: Integration Card Component Structure

**What:** Self-contained card with collapsed/expanded states for API key configuration
**When to use:** All integration settings that involve secret credentials

**Example:** ClaudeCard.tsx (lines 19-160)

```typescript
// Source: apps/x402-jobs/src/components/pages/AccountIntegrationsPage/components/ClaudeCard.tsx

export default function ClaudeCard() {
  const { data, mutate } = useSWR<ClaudeConfig>("/integrations/claude/config", authenticatedFetcher);
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Collapsed state: Shows status, Configure/Update button
  if (!isEditing) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon />
            <div>
              <h2>Integration Name</h2>
              <p className="text-sm text-muted-foreground">Description</p>
            </div>
          </div>
          {data?.hasApiKey && <Badge variant="success">Connected</Badge>}
        </div>
        <Button variant="primary" onClick={handleStartEditing}>
          {data?.hasApiKey ? "Update" : "Configure"}
        </Button>
      </Card>
    );
  }

  // Expanded state: Shows input fields, Cancel/Save buttons
  return (
    <Card className="p-4">
      {/* Error/Success alerts */}
      {/* Input fields */}
      {/* Action buttons */}
    </Card>
  );
}
```

### Pattern 2: Password Input with Show/Hide Toggle

**What:** Input field with type toggled between "password" and "text"
**When to use:** API keys, tokens, secrets that users may need to verify

**Example:** Discord/Telegram bot token inputs

```typescript
// Source: apps/web/components/pages/AgentDiscordSettingsPage/components/DiscordBotControlCard.tsx

const [showToken, setShowToken] = useState(false);

<div className="relative">
  <Input
    type={showToken ? "text" : "password"}
    value={botToken}
    onChange={(e) => setBotToken(e.target.value)}
    placeholder="Enter API key..."
    className="font-mono text-sm pr-16"
    disabled={isSaving}
  />
  <button
    type="button"
    onClick={() => setShowToken(!showToken)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-300"
  >
    {showToken ? "Hide" : "Show"}
  </button>
</div>
```

### Pattern 3: Backend Encryption and Storage

**What:** Encrypt secrets before database storage, decrypt for execution
**When to use:** All API keys, tokens, auth headers

**Example:** Claude integration routes (lines 417-511)

```typescript
// Source: apps/x402-jobs-api/src/routes/integrations.ts

import { encryptSecret, decryptSecret } from "../lib/instant/encrypt";

// Save encrypted key
integrationsRouter.put("/claude/config", authMiddleware, async (req, res) => {
  const { apiKey, isEnabled } = req.body;
  const payload: Record<string, unknown> = { user_id: req.user!.id };

  if (apiKey !== undefined) {
    payload.api_key_encrypted = encryptSecret(apiKey);
  }

  await getSupabase()
    .from("x402_user_claude_configs")
    .upsert(payload, { onConflict: "user_id" });
});

// Retrieve decrypted key for execution
export async function getCreatorClaudeApiKey(
  userId: string,
): Promise<string | null> {
  const { data } = await getSupabase()
    .from("x402_user_claude_configs")
    .select("api_key_encrypted, is_enabled")
    .eq("user_id", userId)
    .single();

  if (!data?.api_key_encrypted || !data.is_enabled) return null;
  return decryptSecret(data.api_key_encrypted);
}
```

### Pattern 4: Delete Confirmation with Affected Resource Count

**What:** Modal shows impact before deletion (e.g., "5 resources using this key")
**When to use:** Destructive actions that affect other entities

**Example:** Context decision from 13-CONTEXT.md

```typescript
// Recommended pattern from UX research + context decisions

const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [affectedCount, setAffectedCount] = useState(0);

const handleDeleteClick = async () => {
  // Fetch count of resources using this integration
  const count = await fetchAffectedResourceCount();
  setAffectedCount(count);
  setShowDeleteConfirm(true);
};

<Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete OpenRouter Integration?</DialogTitle>
      <DialogDescription>
        {affectedCount > 0
          ? `You have ${affectedCount} resource(s) using this key. They will be automatically unpublished and stop working.`
          : "This will remove your OpenRouter API key."}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleConfirmedDelete}>
        Delete Integration
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Anti-Patterns to Avoid

- **❌ Client-side encryption:** All encryption MUST happen server-side (existing pattern)
- **❌ Storing plaintext keys:** Never store unencrypted secrets in database
- **❌ Exposing keys in API responses:** GET endpoints return `hasApiKey: boolean`, never the key itself
- **❌ Delete without confirmation:** Always confirm destructive actions, show impact
- **❌ Yes/No buttons:** Use action-specific labels ("Delete Integration" / "Cancel")

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                 | Don't Build                           | Use Instead                                                         | Why                                                                     |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| API key encryption      | Custom crypto implementation          | `encryptSecret()` / `decryptSecret()` from `lib/instant/encrypt.ts` | AES-256-CBC already configured, handles IV generation, tested           |
| Dialog/Modal UI         | Custom modal with backdrop/focus trap | `@repo/ui/dialog` (Radix UI based)                                  | Accessibility (WCAG), keyboard nav (ESC key), focus management built-in |
| Form state management   | Complex useState logic                | Simple useState hooks following ClaudeCard pattern                  | Existing pattern proven, no need for form libraries                     |
| Password input masking  | Custom masking logic                  | type="password" with toggle button                                  | Native browser security, established pattern                            |
| API authentication      | Custom auth headers                   | `authenticatedFetch()` from `lib/api`                               | Handles Supabase auth tokens automatically                              |
| Success/Error messaging | Custom toast system                   | `Alert` component with `variant` prop                               | Consistent with codebase, no dependencies                               |

**Key insight:** The Claude integration is a complete reference implementation. This phase is 90% copy-paste with OpenRouter-specific branding. Resist the urge to "improve" or "modernize" - consistency matters more than novelty.

## Common Pitfalls

### Pitfall 1: Forgetting to Clear Input After Save

**What goes wrong:** After saving a new API key, the input field still contains the plaintext key
**Why it happens:** State is not reset after successful save
**How to avoid:** Clear `apiKey` state in success handler
**Warning signs:** User clicks "Update" again and sees their previous key

**Solution:**

```typescript
const handleSave = async () => {
  await authenticatedFetch("/integrations/openrouter/config", {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
  setApiKey(""); // ← CRITICAL: Clear after save
  setIsEditing(false);
  setSuccess("API key saved successfully!");
};
```

### Pitfall 2: Placeholder Text Confusion

**What goes wrong:** Users think placeholder "Enter new key to update" means they MUST enter a key
**Why it happens:** Ambiguous placeholder text when key already exists
**How to avoid:** Add helper text below input: "Leave blank to keep your existing key"
**Warning signs:** Users report "can't save without entering key again"

**Solution (from ClaudeCard.tsx lines 123-127):**

```typescript
<Input
  type="password"
  placeholder={data?.hasApiKey ? "Enter new key to update" : "sk-or-v1-..."}
  value={apiKey}
/>
{data?.hasApiKey && (
  <p className="text-xs text-muted-foreground">
    Leave blank to keep your existing key
  </p>
)}
```

### Pitfall 3: Backend Not Handling Undefined apiKey

**What goes wrong:** PUT request with `apiKey: undefined` causes validation error
**Why it happens:** Backend expects either a key or nothing, gets undefined
**How to avoid:** Only include `apiKey` in payload if provided
**Warning signs:** 400 errors when trying to update `isEnabled` without changing key

**Solution (from integrations.ts lines 468-470):**

```typescript
if (apiKey !== undefined) {
  payload.api_key_encrypted = encryptSecret(apiKey);
}
// If apiKey is undefined, field is not updated (existing key preserved)
```

### Pitfall 4: Missing RLS Policies on user_openrouter_integrations

**What goes wrong:** Users can't read/write their own integration settings
**Why it happens:** Forgetting to apply migration 005_add_openrouter_integration.sql
**How to avoid:** Verify policies exist before implementing UI
**Warning signs:** Permission denied errors on GET/PUT requests

**Solution:** Confirm migration applied (from 005_add_openrouter_integration.sql):

```sql
-- Policy: Users can only read/write their own OpenRouter config
CREATE POLICY "Users can manage their own OpenRouter config"
  ON user_openrouter_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Pitfall 5: Delete Button Without Confirmation

**What goes wrong:** User accidentally deletes API key, affecting live resources
**Why it happens:** No confirmation dialog for destructive action
**How to avoid:** Use Dialog component with affected resource count
**Warning signs:** User complaints about accidental deletion

**Solution (from CONTEXT.md):**

```typescript
// Query affected resources count
const { data: resources } = await supabase
  .from("x402_resources")
  .select("id", { count: "exact" })
  .eq("resource_type", "openrouter_instant")
  .eq("user_id", userId);

// Show count in confirmation dialog
<DialogDescription>
  You have {resources.length} resource(s) using this key.
  They will stop working.
</DialogDescription>
```

## Code Examples

Verified patterns from official sources and existing codebase:

### OpenRouter API Key Input with Show/Hide Toggle

```typescript
// Source: Pattern from apps/web/components/pages/AgentDiscordSettingsPage/components/DiscordBotControlCard.tsx
// Adapted for OpenRouter

import { useState } from "react";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";

export default function OpenRouterKeyInput() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor="openrouterApiKey">API Key</Label>
      <div className="relative">
        <Input
          id="openrouterApiKey"
          type={showKey ? "text" : "password"}
          placeholder="sk-or-v1-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="font-mono text-sm pr-16"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-300"
        >
          {showKey ? "Hide" : "Show"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Get your API key from{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          openrouter.ai/keys
        </a>
      </p>
    </div>
  );
}
```

### Delete Confirmation Dialog with Resource Count

```typescript
// Source: Pattern from research + Dialog component from @repo/ui/dialog
// Implements UX best practices from NN/G confirmation dialogs

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { AlertCircle } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affectedResourceCount: number;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  affectedResourceCount,
  onConfirm
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete OpenRouter Integration?</DialogTitle>
          <DialogDescription>
            {affectedResourceCount > 0 ? (
              <>
                <div className="flex items-start gap-2 mt-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>
                    You have <strong>{affectedResourceCount} resource(s)</strong> using this key.
                    They will be automatically unpublished and stop working.
                  </span>
                </div>
              </>
            ) : (
              "This will permanently remove your OpenRouter API key from your account."
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Integration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Backend Route Pattern (GET config)

```typescript
// Source: apps/x402-jobs-api/src/routes/integrations.ts (lines 423-450)
// Pattern: Return status only, never the actual key

integrationsRouter.get(
  "/openrouter/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { data, error } = await getSupabase()
        .from("user_openrouter_integrations")
        .select("is_enabled")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching OpenRouter config", error);
        return res
          .status(500)
          .json({ error: "Failed to load OpenRouter settings" });
      }

      res.json({
        hasApiKey: Boolean(data),
        isEnabled: data?.is_enabled ?? false,
      });
    } catch (err) {
      console.error("OpenRouter config error", err);
      res.status(500).json({ error: "Failed to load OpenRouter settings" });
    }
  },
);
```

### Backend Route Pattern (PUT config)

```typescript
// Source: apps/x402-jobs-api/src/routes/integrations.ts (lines 457-511)
// Pattern: Encrypt before storage, handle optional updates

import { encryptSecret } from "../lib/instant/encrypt";

integrationsRouter.put(
  "/openrouter/config",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { apiKey, isEnabled } = req.body || {};

      // Build upsert payload
      const payload: Record<string, unknown> = { user_id: userId };

      if (apiKey !== undefined) {
        // Encrypt API key before storage
        payload.encrypted_api_key = encryptSecret(apiKey);
      }

      if (isEnabled !== undefined) {
        payload.is_enabled = isEnabled;
      }

      // If no apiKey provided, check if user already has one (for enable/disable toggle)
      if (apiKey === undefined) {
        const { data: existing } = await getSupabase()
          .from("user_openrouter_integrations")
          .select("encrypted_api_key")
          .eq("user_id", userId)
          .single();

        if (!existing?.encrypted_api_key) {
          return res.status(400).json({ error: "apiKey is required" });
        }
      }

      const { error } = await getSupabase()
        .from("user_openrouter_integrations")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("Error saving OpenRouter config", error);
        return res
          .status(500)
          .json({ error: "Failed to save OpenRouter settings" });
      }

      res.json({
        success: true,
        hasApiKey: apiKey !== undefined ? true : undefined,
        isEnabled: isEnabled ?? true,
      });
    } catch (err) {
      console.error("OpenRouter config save error", err);
      res.status(500).json({ error: "Failed to save OpenRouter settings" });
    }
  },
);
```

## State of the Art

| Old Approach                    | Current Approach                                         | When Changed      | Impact                                                             |
| ------------------------------- | -------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| Custom modal components         | Radix UI Dialog primitives                               | 2025              | Better accessibility (WCAG), keyboard navigation, focus management |
| Yes/No confirmation buttons     | Action-specific labels ("Delete Integration" / "Cancel") | 2026              | 70% reduction in accidental deletions per NN/G research            |
| Plain text placeholders         | Contextual helper text below inputs                      | 2025              | Clearer guidance, reduced user confusion                           |
| type="text" with manual masking | type="password" with toggle button                       | Standard          | Better security (no plaintext in DOM), established pattern         |
| Toast notifications             | Inline Alert components                                  | Codebase standard | Persistent visibility, less disruptive                             |

**Deprecated/outdated:**

- Manual encryption implementations: Use existing `encryptSecret/decryptSecret` from lib/instant/encrypt.ts
- Separate integration tables per provider: OpenRouter follows established user_openrouter_integrations table pattern (not x402_user_openrouter_configs like Claude - naming is inconsistent but functional)
- Class components: All new code uses function components with hooks

## Open Questions

Things that couldn't be fully resolved:

1. **OpenRouter API Key Format Validation**
   - What we know: Keys use Bearer token format, created at openrouter.ai/keys
   - What's unclear: No official regex pattern or validation rules published
   - Recommendation: Skip format validation (accept any non-empty string), rely on server-side verification when used. OpenRouter API will reject invalid keys naturally.
   - Confidence: MEDIUM - Validated approach (matches Claude integration pattern)

2. **Resource Auto-Unpublish Implementation**
   - What we know: Context decision states "resources automatically unpublished on key deletion"
   - What's unclear: Database trigger vs. application logic, which table columns control publish state
   - Recommendation: Query x402_resources table schema during planning to determine publish/unpublish mechanism. Likely needs is_published flag or similar.
   - Confidence: MEDIUM - Need to verify during planning phase

3. **Resource Auto-Republish on Key Re-add**
   - What we know: Context decision states "previously-unpublished resources auto-republish"
   - What's unclear: How to track "which resources were unpublished due to key deletion vs. manual user unpublish"
   - Recommendation: Either skip this feature (simplify to manual republish) or add unpublish_reason column to track automatic vs. manual unpublish
   - Confidence: LOW - Complex feature, may want to defer to later phase

4. **Integration Card Icon Choice**
   - What we know: Claude uses Sparkles icon, Telegram uses custom SVG, Discord uses custom SVG
   - What's unclear: Best icon to represent OpenRouter (not a standard provider like Anthropic)
   - Recommendation: Use `Network` icon from lucide-react (represents routing/connectivity) or custom OpenRouter logo SVG if available
   - Confidence: HIGH - Minor visual decision, easy to change

## Sources

### Primary (HIGH confidence)

- Existing codebase:
  - `apps/x402-jobs/src/components/pages/AccountIntegrationsPage/components/ClaudeCard.tsx` - Complete reference implementation
  - `apps/x402-jobs-api/src/routes/integrations.ts` - Backend routes pattern (lines 417-534)
  - `apps/x402-jobs-api/src/lib/instant/encrypt.ts` - Encryption utilities
  - `apps/x402-jobs/migrations/005_add_openrouter_integration.sql` - Database schema
  - `packages/ui/src/dialog.tsx` - Dialog component API

### Secondary (MEDIUM confidence)

- [OpenRouter API Authentication](https://openrouter.ai/docs/api/reference/authentication) - Bearer token format, key creation location
- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart) - Getting started flow

### Tertiary (Validated patterns from research)

- [Confirmation Dialogs Can Prevent User Errors - NN/G](https://www.nngroup.com/articles/confirmation-dialog/) - 70% reduction in accidental deletions with proper confirmations
- [How to Design Better Destructive Action Modals - UX Psychology](https://uxpsychology.substack.com/p/how-to-design-better-destructive) - Action-specific button labels vs. Yes/No
- [API Key Security Best Practices for 2026 - DEV Community](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d) - Never log secrets, server-side validation
- [Hide/Show Password in React - DEV Community](https://dev.to/annaqharder/hideshow-password-in-react-513a) - Password toggle implementation pattern

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All dependencies already in place, no new packages needed
- Architecture: HIGH - ClaudeCard.tsx is complete reference implementation
- Pitfalls: HIGH - Derived from existing code patterns and common React pitfalls
- Delete flow: MEDIUM - Auto-unpublish/republish logic needs planning verification
- OpenRouter specifics: MEDIUM - API key format not strictly defined, validation deferred to OpenRouter API

**Research date:** 2026-01-26
**Valid until:** 60 days (stable domain - UI patterns and encryption don't change rapidly)

**Note:** This research is 90% based on existing codebase patterns. The ClaudeCard implementation is production-ready and proven. OpenRouter integration is essentially a clone with different branding, endpoints, and table name.
