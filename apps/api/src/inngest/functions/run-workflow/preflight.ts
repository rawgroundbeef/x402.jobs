/**
 * Resource info for pre-flight validation
 */
export interface PreflightResource {
  resourceUrl?: string;
  resourceName?: string;
}

/**
 * Result of pre-flight validation
 */
export interface PreflightResult {
  success: boolean;
  unreachable: string[];
}

/**
 * Check if a single resource is reachable
 *
 * A resource is considered reachable if:
 * - It returns 2xx (success)
 * - It returns 402 (needs payment, but endpoint exists)
 */
export async function checkResourceReachable(
  resource: PreflightResource,
  timeoutMs: number,
): Promise<{ reachable: boolean; reason?: string }> {
  if (!resource.resourceUrl) {
    return { reachable: true }; // No URL to check
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(resource.resourceUrl, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 2xx or 402 means resource is reachable
    if (response.ok || response.status === 402) {
      return { reachable: true };
    }

    return {
      reachable: false,
      reason: `${response.status}`,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { reachable: false, reason: "timeout" };
      }
      return { reachable: false, reason: err.message };
    }
    return { reachable: false, reason: "Unknown error" };
  }
}

/**
 * Validate that all resources are reachable before executing a workflow
 *
 * This is a "fail fast" check that prevents wasting money on resources
 * if any of them are unreachable.
 *
 * @param resources - Array of resources to check
 * @param timeoutMs - Timeout for each resource check in milliseconds
 * @returns PreflightResult with success status and list of unreachable resources
 */
export async function validateResourcesReachable(
  resources: PreflightResource[],
  timeoutMs: number,
): Promise<PreflightResult> {
  const unreachable: string[] = [];

  for (const resource of resources) {
    const result = await checkResourceReachable(resource, timeoutMs);

    if (!result.reachable) {
      const name = resource.resourceName || resource.resourceUrl || "Unknown";
      unreachable.push(`${name} (${result.reason})`);
    }
  }

  return {
    success: unreachable.length === 0,
    unreachable,
  };
}
