import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { notifyResourceOffline } from "../../services/notifications.service";

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

// How many consecutive failures before marking as offline
const FAILURE_THRESHOLD = 3;

// Batch size for processing resources
const BATCH_SIZE = 50;

// Timeout for health check requests (ms)
const REQUEST_TIMEOUT = 10000;

/**
 * Manual trigger for health check (for testing or immediate runs)
 */
export const triggerHealthCheck = inngest.createFunction(
  {
    id: "trigger-health-check",
    retries: 0,
  },
  { event: "x402/health-check.trigger" },
  async ({ step }) => {
    // Forward to the main health check function
    await step.sendEvent("trigger-main-check", {
      name: "x402/health-check.run",
      data: {},
    });
    return { triggered: true };
  },
);

/**
 * Nightly health check for all active resources.
 *
 * This cron job runs daily at 3 AM UTC to check if resources are still responding.
 * Resources that return 404 are tracked, and after 3 consecutive failures are marked offline.
 */
export const checkResourceHealth = inngest.createFunction(
  {
    id: "check-resource-health",
    retries: 1,
  },
  // Run daily at 3 AM UTC OR when manually triggered
  [{ cron: "0 3 * * *" }, { event: "x402/health-check.run" }],
  async ({ step, logger }) => {
    // Step 1: Get all active resources that should be checked
    const resources = await step.run("fetch-resources", async () => {
      const { data, error } = await supabase
        .from("x402_resources")
        .select(
          "id, name, resource_url, registered_by, health_status, health_failure_count, server:x402_servers(slug)",
        )
        .eq("is_active", true)
        .order("last_health_check_at", { ascending: true, nullsFirst: true });

      if (error) {
        logger.error("Failed to fetch resources:", error);
        throw error;
      }

      return data || [];
    });

    logger.info(`Checking health of ${resources.length} resources`);

    // Step 2: Process resources in batches
    let totalChecked = 0;
    let totalHealthy = 0;
    let totalDegraded = 0;
    let totalOffline = 0;
    let totalErrors = 0;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < resources.length; i += BATCH_SIZE) {
      const batch = resources.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const batchResult = await step.run(
        `check-batch-${batchNum}`,
        async () => {
          const results = {
            checked: 0,
            healthy: 0,
            degraded: 0,
            offline: 0,
            errors: 0,
          };

          for (const resource of batch) {
            try {
              const isHealthy = await checkSingleResource(
                resource.resource_url,
              );
              results.checked++;

              if (isHealthy) {
                // Resource is responding - reset failure count and mark healthy
                results.healthy++;
                await supabase
                  .from("x402_resources")
                  .update({
                    health_status: "healthy",
                    health_failure_count: 0,
                    last_health_check_at: new Date().toISOString(),
                  })
                  .eq("id", resource.id);
              } else {
                // Resource failed - increment failure count
                const newFailureCount =
                  (resource.health_failure_count || 0) + 1;
                const wasAlreadyOffline = resource.health_status === "offline";

                if (newFailureCount >= FAILURE_THRESHOLD) {
                  // Mark as offline after threshold failures
                  results.offline++;
                  await supabase
                    .from("x402_resources")
                    .update({
                      health_status: "offline",
                      health_failure_count: newFailureCount,
                      health_offline_at: wasAlreadyOffline
                        ? undefined
                        : new Date().toISOString(),
                      last_health_check_at: new Date().toISOString(),
                    })
                    .eq("id", resource.id);

                  // Notify owner if this is the first time going offline
                  if (!wasAlreadyOffline && resource.registered_by) {
                    try {
                      const serverSlug = (
                        resource.server as { slug?: string } | null
                      )?.slug;
                      await notifyResourceOffline(
                        resource.registered_by,
                        resource.id,
                        resource.name,
                        resource.resource_url,
                        serverSlug,
                      );
                      logger.info(
                        `Notified owner of offline resource: ${resource.name}`,
                      );
                    } catch (notifyError) {
                      logger.error(
                        `Failed to notify owner for ${resource.name}:`,
                        notifyError,
                      );
                    }
                  }
                } else {
                  // Mark as degraded (some failures but not offline yet)
                  results.degraded++;
                  await supabase
                    .from("x402_resources")
                    .update({
                      health_status: "degraded",
                      health_failure_count: newFailureCount,
                      last_health_check_at: new Date().toISOString(),
                    })
                    .eq("id", resource.id);
                }
              }
            } catch (error) {
              results.errors++;
              logger.error(`Error checking resource ${resource.id}:`, error);
            }
          }

          return results;
        },
      );

      totalChecked += batchResult.checked;
      totalHealthy += batchResult.healthy;
      totalDegraded += batchResult.degraded;
      totalOffline += batchResult.offline;
      totalErrors += batchResult.errors;
    }

    logger.info("Health check complete", {
      totalChecked,
      totalHealthy,
      totalDegraded,
      totalOffline,
      totalErrors,
    });

    return {
      checked: totalChecked,
      healthy: totalHealthy,
      degraded: totalDegraded,
      offline: totalOffline,
      errors: totalErrors,
    };
  },
);

/**
 * Check if a single resource is healthy by trying GET, then POST.
 * Returns true ONLY if the resource returns 402 Payment Required.
 * Any other status (including 200) means the x402 paywall isn't working correctly.
 *
 * Many x402 resources only respond to POST requests, so we try both methods.
 */
async function checkSingleResource(resourceUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Try GET first
      let response = await fetch(resourceUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "X402-HealthCheck/1.0",
        },
      });

      // 402 Payment Required is the ONLY healthy status for x402 resources
      if (response.status === 402) {
        clearTimeout(timeoutId);
        return true;
      }

      // If GET doesn't return 402, try POST (many x402 resources are POST-only)
      if (response.status !== 402) {
        response = await fetch(resourceUrl, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "User-Agent": "X402-HealthCheck/1.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        clearTimeout(timeoutId);
        return response.status === 402;
      }

      clearTimeout(timeoutId);
      return false;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch {
    // Network errors, timeouts, etc. count as failures
    return false;
  }
}
