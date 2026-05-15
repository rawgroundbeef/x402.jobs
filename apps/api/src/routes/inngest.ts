import { serve } from "inngest/express";
import {
  inngest,
  runWorkflow,
  regenerateEmbeddings,
  aggregateServerStats,
  aggregateResourceSuccessRates,
  cleanupStaleRuns,
  checkResourceHealth,
  triggerHealthCheck,
  runScheduledJob,
  initializeSchedule,
  recoverStuckSchedules,
  // x402 Ecosystem Indexer functions
  pollBazaarDiscovery,
  triggerBazaarPoll,
  pollHeliusTransactions,
  triggerHeliusPoll,
  verifyServers,
  // OpenRouter model sync
  syncOpenRouterModels,
  triggerModelSync,
  // User wallet provisioning
  ensureUserWallet,
  // HIGH-03 / plan 28-07: hard-delete stale soft-deleted users
  hardDeleteStaleUsers,
} from "../inngest";

/**
 * Inngest serve handler for Express
 *
 * This creates the /api/inngest endpoint that Inngest uses to:
 * 1. Discover available functions
 * 2. Invoke functions when events are received
 *
 * In development, use `npx inngest-cli dev` to run the Inngest dev server
 * In production, Inngest Cloud handles the orchestration
 */
export const inngestHandler = serve({
  client: inngest,
  functions: [
    runWorkflow,
    regenerateEmbeddings,
    aggregateServerStats,
    aggregateResourceSuccessRates,
    cleanupStaleRuns,
    checkResourceHealth,
    triggerHealthCheck,
    runScheduledJob,
    initializeSchedule,
    recoverStuckSchedules,
    // x402 Ecosystem Indexer functions
    pollBazaarDiscovery,
    triggerBazaarPoll,
    pollHeliusTransactions,
    triggerHeliusPoll,
    verifyServers,
    // OpenRouter model sync
    syncOpenRouterModels,
    triggerModelSync,
    // User wallet provisioning
    ensureUserWallet,
    // HIGH-03 / plan 28-07: hard-delete stale soft-deleted users
    hardDeleteStaleUsers,
  ],
});
