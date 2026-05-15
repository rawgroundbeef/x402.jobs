import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Rate limit middleware for the public API.
 * Uses API key as the identifier (falls back to IP if no key).
 *
 * Limits:
 * - 100 requests per minute per API key
 * - 1000 requests per hour per API key (separate limiter)
 */

// Key generator that uses API key ID if available, otherwise IP
const keyGenerator = (req: Request): string => {
  // API key is attached by apiKeyMiddleware
  if (req.apiKey?.id) {
    return `apikey:${req.apiKey.id}`;
  }
  // Fallback to IP (shouldn't happen since apiKeyMiddleware runs first)
  return req.ip || req.socket.remoteAddress || "unknown";
};

// Custom handler for rate limit exceeded
const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    error: "Too Many Requests",
    message: "Rate limit exceeded. Please slow down your requests.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

/**
 * Per-minute rate limiter: 100 requests per minute
 */
export const minuteRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: true, // Also return `X-RateLimit-*` headers for compatibility
  keyGenerator,
  handler: rateLimitHandler,
  message: {
    error: "Too Many Requests",
    message: "Rate limit exceeded: 100 requests per minute. Please slow down.",
  },
});

/**
 * Per-hour rate limiter: 1000 requests per hour
 */
export const hourlyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator,
  handler: rateLimitHandler,
  message: {
    error: "Too Many Requests",
    message:
      "Rate limit exceeded: 1000 requests per hour. Please try again later.",
  },
});

/**
 * Public endpoint rate limiter: 30 requests per minute per IP
 * For unauthenticated catalog-style endpoints (e.g. /api/v1/ai-models)
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: Request): string => {
    return `public:${req.ip || req.socket.remoteAddress || "unknown"}`;
  },
  handler: rateLimitHandler,
});

/**
 * Per-API-key bulk-registration rate limiter: 6 requests per minute.
 *
 * Distinct keyspace (`bulk:apikey:...`) from the broader minute/hour limiters
 * (which use `apikey:...`), so this bucket is orthogonal — bulk requests still
 * count against the broader per-key minute/hour buckets as well. Mounted as
 * an inline middleware on the bulk handler only.
 *
 * 6 req/min × 25 items/req = 150 work units/min worst case per key, which fits
 * comfortably under the existing 100 req/min single-endpoint cap once amortized.
 */
export const bulkResourceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: Request): string =>
    req.apiKey?.id
      ? `bulk:apikey:${req.apiKey.id}`
      : `bulk:ip:${req.ip || req.socket.remoteAddress || "unknown"}`,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: "Too Many Requests",
      message: "Bulk rate limit exceeded: 6 requests per minute. Please slow down.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
  message: {
    error: "Too Many Requests",
    message: "Bulk rate limit exceeded: 6 requests per minute.",
  },
});

/**
 * Wallet-export rate limiter: 3 requests per hour per authenticated user.
 *
 * HIGH-11 (Phase 28 plan 28-05): the export-key endpoint hands out the raw
 * Solana/Base private key. A leaked bearer token without rate limiting equals
 * unlimited wallet-drain attempts. 3/hour is generous for legitimate use
 * (the user explicitly clicked "export"; if they need to do it more than
 * three times in an hour, they have a bigger problem) and tight enough that
 * an automated drain attempt is meaningfully slowed.
 *
 * Keyed by `req.user.id` (authenticated user). Falls back to IP if no user is
 * attached — but the route is auth-gated, so this fallback should never fire
 * in practice.
 */
export const walletExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: Request): string => {
    if (req.user?.id) return `wallet-export:user:${req.user.id}`;
    return `wallet-export:ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: "Too Many Requests",
      message:
        "Wallet-export rate limit exceeded: 3 requests per hour. " +
        "If this wasn't you, your token may be compromised — rotate credentials immediately.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
  message: {
    error: "Too Many Requests",
    message: "Wallet-export rate limit exceeded: 3 requests per hour.",
  },
});

/**
 * Discovery API rate limiter for free tier: 100 requests per day
 * Paid tier (with valid API key) bypasses this limit.
 */
export const discoveryApiRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100, // 100 requests per day for free tier
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: Request): string => {
    // Paid tier bypasses rate limit - use a unique key per request
    if (req.apiKey?.tier === "paid") {
      return `paid:${Date.now()}:${Math.random()}`;
    }
    // Free tier - rate limit by IP
    return `discovery:${req.ip || req.socket.remoteAddress || "unknown"}`;
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for paid tier
    return req.apiKey?.tier === "paid";
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message:
        "Free tier allows 100 score lookups per day. Upgrade to paid tier for unlimited access.",
      retryAfter: res.getHeader("Retry-After"),
      upgradeUrl: "https://x402.jobs/discover",
    });
  },
});
