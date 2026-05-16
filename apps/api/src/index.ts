import "reflect-metadata";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { WebSocketServer } from "ws";
import { parse as parseUrl } from "url";
import { config } from "./config";
import { ConnectionManager } from "./lib/websocket";
import { walletRouter } from "./routes/wallet";
import { jobsRouter, jobsPublicRouter } from "./routes/jobs";
import { runsRouter } from "./routes/runs";
import {
  resourcesVerifyRouter,
  resourcesProtectedRouter,
} from "./routes/resources";
import { serversRouter, serversProtectedRouter } from "./routes/servers";
import { imagesRouter } from "./routes/images";
import { executeRouter } from "./routes/execute";
import { healthRouter } from "./routes/health";
import { inngestHandler } from "./routes/inngest";
import { askJobputerRouter } from "./routes/ask-jobputer";
import {
  webhooksRouter,
  jobsWebhookRouter,
  heliusWebhookRouter,
} from "./routes/webhooks";
import { statsRouter } from "./routes/stats";
import { workflowBuilderRouter } from "./routes/workflow-builder";
import { workflowChatRouter } from "./routes/workflow-chat";
import { authRouter } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { integrationsRouter } from "./routes/integrations";
import { userRouter, userPublicRouter } from "./routes/user";
import { adminRouter } from "./routes/admin";
import { uploadRouter } from "./routes/upload";
import { hiringRouter, hiringPublicRouter } from "./routes/hiring";
import { notificationsRouter } from "./routes/notifications";
import { escrowRouter } from "./routes/escrow";
import hackathonsRouter from "./routes/hackathons";
import { publicApiRouter } from "./routes/public-api";
import { apiKeysRouter } from "./routes/api-keys";
import { refundsRouter } from "./routes/refunds";
import { refundsAdminRouter } from "./routes/refunds-admin";
import { dashboardRouter } from "./routes/dashboard";
import { instantRouter } from "./routes/instant";
import { usageHistoryRouter } from "./routes/usage-history";
import { aiModelsRouter } from "./routes/ai-models";
import { publicRateLimiter } from "./middleware/rateLimit";
import { isWalletEncryptionConfigured } from "./lib/wallet-encryption";

// Fail fast at boot if wallet encryption is misconfigured — better to refuse
// to start than to throw 500s mid-request on every payment-signing path.
if (!isWalletEncryptionConfigured()) {
  console.error(
    "[BOOT] FATAL: WALLET_ENCRYPTION_SECRET is not set. Wallet key decryption will fail on every request. Aborting startup.",
  );
  process.exit(1);
}
console.log("[BOOT] WALLET_ENCRYPTION_SECRET configured");

// Soft warning for HELIUS_WEBHOOK_SECRET — the indexer is an optional feature,
// so the api can still start without it. But the Helius webhook endpoint will
// refuse to process events until the secret is set (CRIT-06). If you're using
// Helius to index Solana transactions, set this in Railway env.
if (!process.env.HELIUS_WEBHOOK_SECRET) {
  console.warn(
    "[BOOT] HELIUS_WEBHOOK_SECRET is not set. The /webhooks/helius endpoint will reject all events with 503. Set this env var if you intend to use the Helius indexer.",
  );
} else {
  console.log("[BOOT] HELIUS_WEBHOOK_SECRET configured");
}

const app: ReturnType<typeof express> = express();

// Middleware
app.use(helmet());

// CORS - allow all origins in dev, specific origins in prod
const corsOptions = {
  origin: config.cors.origin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "x-api-key",
  ],
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10mb" }));

// Health check (no auth)
app.use("/health", healthRouter);

// Discovery API (public, optional API key for rate limit bypass)
// Must be mounted BEFORE publicApiRouter to avoid auth middleware
app.use("/api/v1/resources", resourcesVerifyRouter);

// AI Models API (public - no auth required, rate limited by IP)
app.use("/api/v1/ai-models", publicRateLimiter, aiModelsRouter);

// Public API (API key auth required)
app.use("/api/v1", publicApiRouter);

// Inngest endpoint (handles its own auth via signing key)
app.use("/inngest", inngestHandler);

// Helius webhook for Solana transaction indexing (MUST be before generic /webhooks)
app.use("/webhooks/helius", heliusWebhookRouter);

// Webhooks endpoint (public - external services call this)
app.use("/webhooks", webhooksRouter);

// Instant resources: /@username/slug (public - x402 payment handles auth)
// Must be BEFORE jobsWebhookRouter so resources are checked first
app.use("/", instantRouter);

// Nice URL webhooks: /@username/job-slug (public)
// Falls through from instantRouter if not a resource
app.use("/", jobsWebhookRouter);

// Stats endpoint (public - leaderboards and platform stats)
app.use("/stats", statsRouter);

// Admin routes (admin token auth)
app.use("/admin", adminRouter);

// Jobs - public view route (no auth), protected CRUD routes
// Support both /jobs and /api/jobs paths
app.use("/jobs", jobsPublicRouter);
app.use("/api/jobs", jobsPublicRouter);

// Integrations (Twitter/X, Telegram)
app.use("/integrations", integrationsRouter);

// User management - public routes (no auth)
app.use("/user", userPublicRouter);

// User management - protected routes (profile, settings, account deletion)
app.use("/user", authMiddleware, userRouter);

// Creator dashboard - protected routes (stats, earnings, activity)
app.use("/user/dashboard", authMiddleware, dashboardRouter);

// Routes (with auth)
app.use("/auth", authMiddleware, authRouter);
app.use("/wallet", authMiddleware, walletRouter);
app.use("/jobs", authMiddleware, jobsRouter);
app.use("/api/jobs", authMiddleware, jobsRouter);
app.use("/runs", authMiddleware, runsRouter);

// API Key management (protected - requires auth)
app.use("/api/keys", authMiddleware, apiKeysRouter);

// Resources - protected CRUD (old path, kept for backwards compat)
app.use("/resources", authMiddleware, resourcesProtectedRouter);

// Usage history for prompt templates (protected - requires auth)
app.use("/api/v1", authMiddleware, usageHistoryRouter);

// Servers - public read, protected delete (admin only)
app.use("/servers", serversRouter);
app.use("/servers", authMiddleware, serversProtectedRouter);

// Image caching (protected - requires auth to cache new images)
app.use("/images", authMiddleware, imagesRouter);

// File uploads (protected - requires auth for signed URLs)
app.use("/upload", authMiddleware, uploadRouter);

// Execute X402 requests (protected - handles payments)
app.use("/execute", authMiddleware, executeRouter);

// Ask Jobputer for help (protected - costs $0.01)
app.use("/ask-jobputer", authMiddleware, askJobputerRouter);

// Workflow builder - propose is public, create requires auth (handled per-route)
app.use("/workflow", workflowBuilderRouter);

// Conversational workflow builder (requires auth)
app.use("/workflow", workflowChatRouter);

// Bounties board - public read, protected write
app.use("/bounties", hiringPublicRouter);
app.use("/bounties", authMiddleware, hiringRouter);

// Hackathons - mostly public, submission requires auth
app.use("/hackathons", hackathonsRouter);

// Notifications (protected)
app.use("/notifications", authMiddleware, notificationsRouter);

// Escrow operations (webhook secret auth - for escrowputer)
app.use("/escrow", escrowRouter);

// $JOBS Rewards - public endpoints (check rewards, claim, stats)
// $JOBS Rewards - protected endpoints (link wallet)

// Refunds (protected - requires auth)
app.use("/refunds", authMiddleware, refundsRouter);
app.use("/refunds", authMiddleware, refundsAdminRouter);

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  },
);

// Create HTTP server wrapping Express
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });

// Initialize ConnectionManager with WebSocket server
ConnectionManager.initialize(wss);

// Handle WebSocket connections
wss.on("connection", async (ws, req) => {
  const parsedUrl = parseUrl(req.url || "", true);
  const token = parsedUrl.query.token as string;

  if (!token) {
    console.log("[WS] Connection rejected: No token provided");
    ws.close(4001, "Authentication required");
    return;
  }

  // Authenticate the connection
  const userId = await ConnectionManager.authenticate(token);

  if (!userId) {
    console.log("[WS] Connection rejected: Invalid token");
    ws.close(4002, "Invalid token");
    return;
  }

  // Register the connection
  ConnectionManager.registerConnection(ws, userId);
  ConnectionManager.setupHeartbeat(ws);

  // Send welcome message
  ws.send(JSON.stringify({ type: "connected", userId }));

  // Handle incoming messages (for future use - currently just ping/pong)
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // Ignore invalid messages
    }
  });

  // Handle disconnection
  ws.on("close", () => {
    ConnectionManager.removeConnection(ws);
  });

  ws.on("error", (error) => {
    console.error("[WS] Connection error:", error);
    ConnectionManager.removeConnection(ws);
  });
});

// Start server
server.listen(config.port, () => {
  console.log(`🚀 x402.jobs API running on port ${config.port}`);
  console.log(`📋 Health: http://localhost:${config.port}/health`);
  console.log(`🔌 WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`🔑 Public API: http://localhost:${config.port}/api/v1`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.close(1001, "Server shutting down");
  });

  wss.close(() => {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.log("Forcing shutdown...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
