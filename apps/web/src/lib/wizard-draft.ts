/**
 * Session storage helpers for wizard draft persistence
 */

export interface WizardDraft {
  type?: "link" | "proxy" | "claude" | "openrouter";
  name?: string;
  description?: string;
  slug?: string;
  // Step 2 type-specific config (added by later phases)
  linkConfig?: Record<string, unknown>;
  proxyConfig?: Record<string, unknown>;
  claudeConfig?: Record<string, unknown>;
  openrouterConfig?: Record<string, unknown>;
  // Step 3 details
  imageUrl?: string;
  category?: string;
  price?: string;
  network?: string;
  updatedAt: string;
}

const DRAFT_KEY = "x402jobs:newResource";

/**
 * Get the current wizard draft from session storage
 * @returns The draft object or null if not found or SSR
 */
export function getDraft(): WizardDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const data = sessionStorage.getItem(DRAFT_KEY);
    if (!data) return null;
    return JSON.parse(data) as WizardDraft;
  } catch (error) {
    console.error("Failed to parse wizard draft from session storage:", error);
    return null;
  }
}

/**
 * Save updates to the wizard draft in session storage
 * @param updates Partial draft updates to merge
 */
export function saveDraft(updates: Partial<Omit<WizardDraft, "updatedAt">>): void {
  if (typeof window === "undefined") {
    return;
  }

  const existing = getDraft() || ({} as WizardDraft);
  const updated: WizardDraft = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save wizard draft to session storage:", error);
  }
}

/**
 * Clear the wizard draft from session storage
 */
export function clearDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error("Failed to clear wizard draft from session storage:", error);
  }
}

/**
 * Check if the draft has meaningful unsaved changes
 * A draft with only type selected is not considered meaningful (easily re-selected)
 * @returns True if draft has meaningful data
 */
export function hasUnsavedChanges(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const draft = getDraft();
  if (!draft) return false;

  // Destructure to check all fields except updatedAt and type
  const {
    updatedAt,
    type,
    name,
    description,
    slug,
    linkConfig,
    proxyConfig,
    claudeConfig,
    openrouterConfig,
    imageUrl,
    category,
    price,
    network,
  } = draft;

  // Meaningful = has name, or any config field, or description, slug, price, etc.
  return !!(
    name ||
    description ||
    slug ||
    linkConfig ||
    proxyConfig ||
    claudeConfig ||
    openrouterConfig ||
    imageUrl ||
    category ||
    price ||
    network
  );
}
