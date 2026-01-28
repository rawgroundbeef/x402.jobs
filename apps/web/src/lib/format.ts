/**
 * Format a date string to a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Format a price from micro-USDC (1,000,000 = $1) to a display string
 * Shows sub-cent precision for small amounts
 */
export function formatPrice(
  microUsdc: string | number | undefined | null,
): string {
  if (!microUsdc) return "$0.00";

  const amount =
    typeof microUsdc === "string" ? parseFloat(microUsdc) : microUsdc;
  if (isNaN(amount) || amount === 0) return "$0.00";

  const dollars = amount / 1_000_000;

  // For amounts >= $1, show 2 decimal places
  if (dollars >= 1) {
    return `$${dollars.toFixed(2)}`;
  }

  // For amounts >= $0.01, show 2 decimal places
  if (dollars >= 0.01) {
    return `$${dollars.toFixed(2)}`;
  }

  // For amounts >= $0.001, show 3 decimal places
  if (dollars >= 0.001) {
    return `$${dollars.toFixed(3)}`;
  }

  // For amounts >= $0.0001, show 4 decimal places
  if (dollars >= 0.0001) {
    return `$${dollars.toFixed(4)}`;
  }

  // For very small amounts, show in scientific notation or as <$0.0001
  return "<$0.0001";
}

/**
 * Format a resource path from slugs (e.g., "@username/resource-slug")
 * Handles both nested (server.slug) and flat (server_slug) API response formats
 * Converts personal server slugs (p-username) to @username format
 */
export function formatResourcePath(resource: {
  slug?: string | null;
  server_slug?: string | null;
  server?: { slug?: string | null } | null;
}): string {
  // Handle both nested and flat server slug formats
  let serverSlug = resource.server_slug || resource.server?.slug;
  const resourceSlug = resource.slug;

  // Convert legacy personal server slug (p-username) to @username
  // New format already uses @username
  if (serverSlug?.startsWith("p-")) {
    serverSlug = `@${serverSlug.slice(2)}`;
  }

  // If we have both slugs, format nicely
  if (serverSlug && resourceSlug) {
    return `${serverSlug}/${resourceSlug}`;
  }

  // If we only have resource slug
  if (resourceSlug) {
    return resourceSlug;
  }

  // If we only have server slug
  if (serverSlug) {
    return serverSlug;
  }

  return "";
}

/**
 * Get display name for a resource: prefer serverSlug/slug pattern
 * Handles camelCase format (used in canvas nodes) and falls back to name/URL
 * Converts personal server slugs (p-username) to @username format
 */
export function getResourceDisplayName(
  resource:
    | {
        name?: string;
        slug?: string;
        serverSlug?: string;
        displayName?: string;
        resourceUrl?: string;
      }
    | null
    | undefined,
): string {
  if (!resource) return "Resource";

  // Prefer slug pattern: serverSlug/slug
  if (resource.serverSlug && resource.slug) {
    // Convert legacy personal server slug (p-username) to @username
    // New format already uses @username
    const displayServerSlug = resource.serverSlug.startsWith("p-")
      ? `@${resource.serverSlug.slice(2)}`
      : resource.serverSlug;
    return `${displayServerSlug}/${resource.slug}`;
  }
  if (resource.slug) {
    return resource.slug;
  }

  // Fall back to displayName or name
  if (resource.displayName) return resource.displayName;
  if (resource.name && !resource.name.match(/^[0-9a-f-]{36}$/i)) {
    return resource.name;
  }

  // Last resort: extract from URL path
  if (resource.resourceUrl) {
    try {
      const path = new URL(resource.resourceUrl, "http://localhost").pathname;
      const segments = path.split("/").filter(Boolean);
      if (segments.length >= 2) {
        return segments.slice(-2).join("/");
      }
      if (segments.length === 1) {
        return segments[0];
      }
    } catch {
      // Invalid URL, fall through
    }
  }

  return resource.name || "Resource";
}

/**
 * Format a USD amount (already in dollars) to a display string
 * Shows sub-cent precision for small amounts, and k/M suffixes for large amounts
 */
export function formatUsd(dollars: number): string {
  if (dollars === 0) return "$0.00";

  // Large amounts with suffixes
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }

  // Normal amounts >= $0.01
  if (dollars >= 0.01) {
    return `$${dollars.toFixed(2)}`;
  }

  // Sub-cent amounts
  if (dollars >= 0.001) {
    return `$${dollars.toFixed(3)}`;
  }

  if (dollars >= 0.0001) {
    return `$${dollars.toFixed(4)}`;
  }

  return "<$0.0001";
}

/**
 * Calculate success rate from 30-day counts
 * Returns 100% by default for new resources with no data
 */
export function getSuccessRate(
  successCount: number | null | undefined,
  failureCount: number | null | undefined,
): number {
  const success = successCount ?? 0;
  const failure = failureCount ?? 0;
  const total = success + failure;

  // No runs yet - assume 100% (optimistic default)
  if (total === 0) return 100;

  return Math.round((success / total) * 100);
}

/**
 * Get the appropriate color class for a success rate
 * Green (95%+) = reliable, Yellow (80-94%) = some issues, Red (<80%) = unreliable
 */
export function getSuccessRateColor(rate: number): string {
  if (rate >= 95) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 80) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

/**
 * Get success rate tier with color, background, and warning indicator
 * More granular than getSuccessRateColor - designed for resource detail page
 * 0-50%: Red with warning (critical)
 * 51-80%: Yellow with warning (caution)
 * 81%+: Green/neutral (no warning)
 */
export function getSuccessRateTier(rate: number): {
  color: string;
  bgColor: string;
  showWarning: boolean;
} {
  if (rate <= 50) {
    return {
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
      showWarning: true,
    };
  }
  if (rate <= 80) {
    return {
      color: "text-yellow-600 dark:text-yellow-500",
      bgColor: "bg-yellow-500/10",
      showWarning: true,
    };
  }
  return {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "",
    showWarning: false,
  };
}

/**
 * Get display label for success rate
 * Always returns a rate (100% default for new resources)
 */
export function getSuccessRateDisplay(
  successCount: number | null | undefined,
  failureCount: number | null | undefined,
): { text: string; isNew: boolean; rate: number } {
  const success = successCount ?? 0;
  const failure = failureCount ?? 0;
  const total = success + failure;

  // No runs yet - show 100% (optimistic default)
  if (total === 0) {
    return { text: "100%", isNew: true, rate: 100 };
  }

  const rate = Math.round((success / total) * 100);
  return { text: `${rate}%`, isNew: false, rate };
}

/**
 * Format context length: 128000 -> "128K", 1000000 -> "1M"
 */
export function formatContextLength(tokens: number | null): string {
  if (!tokens) return "N/A";
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
  return `${(tokens / 1000).toFixed(0)}K`;
}

/**
 * Format token price for display: "0.0001" -> "$0.10/1M"
 */
export function formatTokenPrice(pricePerToken: string | null): string {
  if (!pricePerToken) return "Free";
  const price = parseFloat(pricePerToken);
  if (price === 0) return "Free";
  // Convert per-token to per-million-tokens
  const perMillion = price * 1000000;
  if (perMillion < 0.01) return "<$0.01";
  if (perMillion < 1) return `$${perMillion.toFixed(2)}`;
  return `$${perMillion.toFixed(2)}`;
}
