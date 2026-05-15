// Export all Inngest functions
export { runWorkflow } from "./functions/run-workflow";
export { regenerateEmbeddings } from "./functions/regenerate-embeddings";
export { aggregateServerStats } from "./functions/aggregate-server-stats";
export { aggregateResourceSuccessRates } from "./functions/aggregate-resource-success-rates";
export { cleanupStaleRuns } from "./functions/cleanup-stale-runs";
export {
  checkResourceHealth,
  triggerHealthCheck,
} from "./functions/check-resource-health";
export {
  runScheduledJob,
  initializeSchedule,
} from "./functions/run-scheduled-jobs";
export { recoverStuckSchedules } from "./functions/recover-stuck-schedules";

// x402 Ecosystem Indexer functions
export {
  pollBazaarDiscovery,
  triggerBazaarPoll,
} from "./functions/poll-bazaar-discovery";
export {
  pollHeliusTransactions,
  triggerHeliusPoll,
} from "./functions/poll-helius-transactions";
export { verifyServers } from "./functions/verify-servers";

// OpenRouter model sync
export {
  syncOpenRouterModels,
  triggerModelSync,
} from "./functions/sync-openrouter-models";

// User wallet provisioning
export { ensureUserWallet } from "./functions/ensure-user-wallet";

// HIGH-03 / plan 28-07: hard-delete users tombstoned more than 30 days ago
export { hardDeleteStaleUsers } from "./functions/hard-delete-stale-users";

// Re-export the client for use in routes
export { inngest } from "../lib/inngest";
