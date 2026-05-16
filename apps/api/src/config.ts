import "dotenv/config";

// Parse CORS origins (comma-separated for multiple)
function parseCorsOrigins(): string | string[] | boolean {
  const origins = process.env.CORS_ORIGIN;

  // In development, allow all origins
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && (!origins || origins === "*")) {
    return true;
  }

  // In production, require explicit CORS_ORIGIN
  if (!origins) {
    console.warn(
      "⚠️  CORS_ORIGIN not set in production - defaulting to strict mode",
    );
    return false;
  }

  if (origins === "*") {
    return true;
  }

  if (origins.includes(",")) {
    return origins.split(",").map((o) => o.trim());
  }
  return origins;
}

export const config = {
  port: parseInt(process.env.PORT || "3011"),
  publicUrl: process.env.PUBLIC_URL || "http://localhost:3011",

  cors: {
    origin: parseCorsOrigins() as string | string[] | boolean,
  },

  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  },

  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  },

  base: {
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    // Jobputer's Base wallet for receiving platform fees
    platformWallet:
      process.env.BASE_PLATFORM_WALLET ||
      "0xAEB58049d3C266D55595a596Fae249C10764a031",
  },

  twitter: {
    apiKey: process.env.TWITTER_API_KEY || "",
    apiSecret: process.env.TWITTER_API_SECRET || "",
    callbackUrl:
      process.env.TWITTER_CALLBACK_URL ||
      `${process.env.PUBLIC_URL || "http://localhost:3011"}/integrations/x/oauth/callback`,
  },

  // Platform fee configuration - handled by Jobputer agent
  platformFee: {
    // Jobputer's job_fee command endpoint
    resourceUrl:
      process.env.PLATFORM_FEE_URL ||
      "https://agents.memeputer.com/x402/solana/jobputer/job_fee",
    // Fee as percentage of job cost (1.5% = 0.015)
    percentage: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || "0.015"),
    // Minimum fee in USDC (to ensure small jobs still pay something)
    minimumUsdc: parseFloat(process.env.PLATFORM_FEE_MINIMUM || "0.01"),
    // Enable platform fee
    enabled: process.env.PLATFORM_FEE_ENABLED !== "false",
  },

  // Escrow configuration - for hiring board bounty deposits
  escrow: {
    // Escrowputer's escrow_deposit command endpoint (separate from Jobputer to keep escrow funds isolated from fee revenue)
    depositUrl:
      process.env.ESCROW_DEPOSIT_URL ||
      "https://agents.memeputer.com/x402/solana/escrowputer/escrow_deposit",
    // Enable escrow payments (disable to just flip status without payment)
    enabled: process.env.ESCROW_ENABLED !== "false",
  },

  // Platform wallet configuration for escrow payouts
  // These wallets hold escrowed creator markup and process payouts/refunds
  platformWallet: {
    solana: {
      // FEE_COLLECTION_PRIVATE_KEY env var (base58 or hex format, 64 bytes)
      // This wallet receives x402 payments and sends creator payouts
      configured: !!process.env.FEE_COLLECTION_PRIVATE_KEY,
    },
    base: {
      // BASE_PLATFORM_WALLET_PRIVATE_KEY env var (hex format with 0x prefix)
      // This wallet receives Base x402 payments and sends creator payouts
      configured: !!process.env.BASE_PLATFORM_WALLET_PRIVATE_KEY,
    },
  },

  // Admin user IDs (comma-separated)
  adminUserIds: (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),

  // Smart refunds configuration
  // When enabled, calculates refunds based on actual resource spend
  // Refunds unused resource costs + creator markup on job failure
  smartRefunds: {
    // Feature flag - deploy with this OFF, test, then enable
    enabled: process.env.SMART_REFUNDS_ENABLED === "true",
    // Pre-flight validation - check resources are reachable before running
    preflightEnabled: process.env.SMART_REFUNDS_PREFLIGHT_ENABLED === "true",
    // Timeout for pre-flight checks (ms)
    preflightTimeoutMs: parseInt(
      process.env.SMART_REFUNDS_PREFLIGHT_TIMEOUT || "5000",
    ),
  },
};

// Helper to check if a user is an admin
export function isAdminUser(userId: string): boolean {
  return config.adminUserIds.includes(userId);
}

// Validate required config at startup
const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Warning: ${envVar} is not set`);
  }
}
