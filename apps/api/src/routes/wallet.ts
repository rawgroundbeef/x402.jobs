import { Router } from "express";
import type { Router as RouterType } from "express";
import bs58 from "bs58";
import { getSupabase } from "../lib/supabase";
import { inngest } from "../lib/inngest";
import { getSolanaUsdcBalance } from "../lib/solana";
import { getBaseUsdcBalance } from "../lib/base";
import { loadDecryptedUserWallet } from "../lib/wallet-keys";
import { redactPayer, hashSignature } from "../lib/redact";
import { walletExportLimiter } from "../middleware/rateLimit";
import { sendWalletExportNotification } from "../lib/email-service";

export const walletRouter: RouterType = Router();

// ============================================================================
// HIGH-11 — POST /wallet/export-key hardening helpers (Phase 28 plan 28-05).
// ============================================================================

/** Re-auth window: token must have been issued within this many seconds. */
const FRESH_TOKEN_WINDOW_SECONDS = 5 * 60;

/**
 * Best-effort audit row insert. Never throws. A failed audit must NOT
 * block the export response (the row write is a defense-in-depth surface,
 * not on the critical path).
 */
async function recordWalletExportAudit(row: {
  user_id: string;
  ip: string | null;
  user_agent: string | null;
  wallet_network: "base" | "solana" | "both";
  success: boolean;
}): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from("x402_wallet_export_audit")
      .insert(row);
    if (error) {
      console.error("[wallet/export-key] audit insert failed", error);
    }
  } catch (err) {
    console.error("[wallet/export-key] audit insert threw", err);
  }
}

// ============================================================================
// Routes
// ============================================================================

// GET /api/wallet - Get user's wallet with live balances
walletRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data: wallet, error } = await getSupabase()
      .from("x402_user_wallets")
      .select(
        "address, base_address, balance_usdc, total_spent_usdc, total_jobs_run",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching wallet:", error);
      return res.status(500).json({ error: "Failed to fetch wallet" });
    }

    if (!wallet) {
      // Trigger wallet creation via Inngest
      inngest
        .send({ name: "x402/user.ensure-wallet", data: { userId } })
        .catch((err: Error) =>
          console.error("Failed to send ensure-wallet event:", err),
        );
      return res.json({ wallet: null });
    }

    // Fetch live balances in parallel
    const [solanaBalance, baseBalance] = await Promise.all([
      getSolanaUsdcBalance(wallet.address),
      wallet.base_address ? getBaseUsdcBalance(wallet.base_address) : 0,
    ]);

    res.json({
      wallet: {
        // Solana
        address: wallet.address,
        balanceUsdc: solanaBalance,
        // Base
        baseAddress: wallet.base_address || null,
        baseBalanceUsdc: baseBalance,
        // Combined stats
        totalBalanceUsdc: solanaBalance + baseBalance,
        totalSpentUsdc: parseFloat(wallet.total_spent_usdc) || 0,
        totalJobsRun: wallet.total_jobs_run || 0,
      },
    });
  } catch (error) {
    console.error("Wallet fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/wallet/export-key — Export private key (HIGH-11 hardened).
//
// Four guardrails:
//   1. Re-auth: JWT iat must be within FRESH_TOKEN_WINDOW_SECONDS (5 min).
//      Stale tokens → 401 stale_token. Re-issued tokens (post user-login)
//      pass; long-lived tokens recovered from leaked logs / browser
//      storage do not.
//   2. Rate limit: walletExportLimiter — 3 per hour per user.
//   3. Audit: one row per attempt in x402_wallet_export_audit, with
//      success=true|false reflecting outcome. Best-effort write — does
//      not block the response.
//   4. Email: out-of-band notification on successful export so a
//      compromised token results in an immediately-detectable signal
//      to the legitimate user.
//
// METHOD CHANGE: was GET, now POST. A GET that returns secrets is a
// browser-cache / Referer-leak / preflight-skip footgun; POST is the
// correct verb for an action-with-side-effects (audit row, email).
// Clients must update accordingly.
// ============================================================================
walletRouter.post("/export-key", walletExportLimiter, async (req, res) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email ?? null;
  const ip = (req.ip ?? (req.headers["x-forwarded-for"] as string) ?? null) || null;
  const userAgent = (req.headers["user-agent"] as string) ?? null;

  // ---- Gate 1: Re-auth (fresh JWT) ----
  const tokenIssuedAt = req.user?.iat;
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    typeof tokenIssuedAt !== "number" ||
    nowSec - tokenIssuedAt > FRESH_TOKEN_WINDOW_SECONDS
  ) {
    // Record the failed attempt — token may be stolen / replayed.
    await recordWalletExportAudit({
      user_id: userId,
      ip,
      user_agent: userAgent,
      wallet_network: "both",
      success: false,
    });
    return res.status(401).json({
      error: "stale_token",
      message:
        "Re-authenticate to export wallet key (token must be fresh — issued within the last 5 minutes).",
    });
  }

  // ---- Gates 2-4: rate limit already applied as middleware; now do
  // audit + decrypt + email. Wrap so we always record the outcome.
  let walletNetwork: "base" | "solana" | "both" = "both";
  try {
    const wallet = await loadDecryptedUserWallet(userId);
    if (!wallet) {
      await recordWalletExportAudit({
        user_id: userId,
        ip,
        user_agent: userAgent,
        wallet_network: walletNetwork,
        success: false,
      });
      return res.status(404).json({ error: "No wallet found" });
    }

    // Decode the decrypted base64 secret and re-encode as base58 for Solana.
    const privateKeyBytes = Buffer.from(wallet.solanaSecretBase64, "base64");
    const solanaPrivateKeyBase58 = bs58.encode(privateKeyBytes);

    const response: {
      solana: {
        address: string;
        privateKey: string;
      };
      base?: {
        address: string;
        privateKey: string;
      };
    } = {
      solana: {
        address: wallet.address,
        privateKey: solanaPrivateKeyBase58,
      },
    };

    // Include Base key if exists.
    if (wallet.baseAddress && wallet.baseSecretBase64) {
      const basePrivateKey = Buffer.from(
        wallet.baseSecretBase64,
        "base64",
      ).toString("utf-8");

      response.base = {
        address: wallet.baseAddress,
        privateKey: basePrivateKey,
      };
      walletNetwork = "both";
    } else {
      walletNetwork = "solana";
    }

    // Audit (success path) BEFORE responding so an exit/crash between
    // here and the response still leaves a record.
    await recordWalletExportAudit({
      user_id: userId,
      ip,
      user_agent: userAgent,
      wallet_network: walletNetwork,
      success: true,
    });

    // Email notification — best-effort, do not fail the response if the
    // provider is misconfigured.
    if (userEmail) {
      try {
        await sendWalletExportNotification({
          to: userEmail,
          userId,
          walletNetwork,
          ip,
          userAgent,
          exportedAt: new Date().toISOString(),
        });
      } catch (emailErr) {
        console.error(
          "[wallet/export-key] notification email failed (continuing)",
          emailErr,
        );
      }
    } else {
      console.warn(
        "[wallet/export-key] no user email on req.user — skipping notification",
        { user_id: userId },
      );
    }

    return res.json(response);
  } catch (error) {
    console.error("Key export error:", error);
    await recordWalletExportAudit({
      user_id: userId,
      ip,
      user_agent: userAgent,
      wallet_network: walletNetwork,
      success: false,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/balance - Get just the live balances
walletRouter.get("/balance", async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data: wallet, error } = await getSupabase()
      .from("x402_user_wallets")
      .select("address, base_address")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !wallet) {
      return res.json({
        solanaBalanceUsdc: 0,
        baseBalanceUsdc: 0,
        totalBalanceUsdc: 0,
      });
    }

    // Fetch live balances in parallel
    const [solanaBalance, baseBalance] = await Promise.all([
      getSolanaUsdcBalance(wallet.address),
      wallet.base_address ? getBaseUsdcBalance(wallet.base_address) : 0,
    ]);

    res.json({
      solanaBalanceUsdc: solanaBalance,
      baseBalanceUsdc: baseBalance,
      totalBalanceUsdc: solanaBalance + baseBalance,
    });
  } catch (error) {
    console.error("Balance fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/transactions - Get user's recent transactions
walletRouter.get("/transactions", async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get user's wallet addresses
    const { data: wallet, error: walletError } = await getSupabase()
      .from("x402_user_wallets")
      .select("address, base_address")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError || !wallet) {
      return res.json({ transactions: [], total: 0 });
    }

    const addresses = [wallet.address];
    if (wallet.base_address) {
      addresses.push(wallet.base_address);
    }

    // Query transactions where user is sender or receiver
    const {
      data: transactions,
      error,
      count,
    } = await getSupabase()
      .from("x402_transactions")
      .select(
        `
        id, signature, sender_address, receiver_address, 
        amount_usdc, network, block_time, status,
        server:x402_servers(id, slug, name)
      `,
        { count: "exact" },
      )
      .or(
        addresses
          .map(
            (addr) => `sender_address.eq.${addr},receiver_address.eq.${addr}`,
          )
          .join(","),
      )
      .eq("status", "confirmed")
      .order("block_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Transactions fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    // Also get reward claims
    const { data: claims, error: claimsError } = await getSupabase()
      .from("x402_jobs_rewards_claims")
      .select(
        "id, wallet_address, total_claimed_usdc, tx_hash, claimed_at, periods_claimed",
      )
      .eq("user_id", userId)
      .order("claimed_at", { ascending: false })
      .limit(10);

    if (claimsError) {
      console.error("Claims fetch error:", claimsError);
    }

    // Format response with type info
    type ServerJoin = { id: string; slug: string; name: string } | null;

    const formattedTransactions = (transactions || []).map((tx) => {
      // Supabase can return array or single object for joins
      const serverData = tx.server;
      const server: ServerJoin = Array.isArray(serverData)
        ? serverData[0] || null
        : (serverData as ServerJoin);
      const isSender = addresses.includes(tx.sender_address);
      const isReceiver = addresses.includes(tx.receiver_address);

      return {
        id: tx.id,
        // HIGH-12: hash payment signature in public wallet activity shape.
        signature: hashSignature(tx.signature),
        type:
          isSender && !isReceiver
            ? "sent"
            : isReceiver && !isSender
              ? "received"
              : "internal",
        amount: parseFloat(tx.amount_usdc?.toString() || "0"),
        network: tx.network,
        timestamp: tx.block_time,
        // HIGH-12: redact counterparty (sender_address / receiver_address)
        // — same on-chain identifier exposure as payer_address.
        counterparty: redactPayer(
          isSender ? tx.receiver_address : tx.sender_address,
        ),
        server: server
          ? { id: server.id, slug: server.slug, name: server.name }
          : null,
      };
    });

    // Add reward claims as transactions
    const rewardTransactions = (claims || []).map((claim) => ({
      id: claim.id,
      // HIGH-12: tx_hash is the same kind of on-chain identifier.
      signature: hashSignature(claim.tx_hash),
      type: "reward_claim" as const,
      amount: parseFloat(claim.total_claimed_usdc?.toString() || "0"),
      network: "solana",
      timestamp: claim.claimed_at,
      counterparty: null,
      server: null,
      period: Array.isArray(claim.periods_claimed)
        ? claim.periods_claimed.join(", ")
        : claim.periods_claimed,
    }));

    // Merge and sort by timestamp
    const allTransactions = [...formattedTransactions, ...rewardTransactions]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);

    res.json({
      transactions: allTransactions,
      total: (count || 0) + (claims?.length || 0),
    });
  } catch (error) {
    console.error("Transactions fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/runs - Get jobs the user has paid for (as a consumer)
walletRouter.get("/runs", async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get user's wallet addresses
    const { data: wallet, error: walletError } = await getSupabase()
      .from("x402_user_wallets")
      .select("address, base_address")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError || !wallet) {
      return res.json({ runs: [], total: 0 });
    }

    const addresses = [wallet.address];
    if (wallet.base_address) {
      addresses.push(wallet.base_address);
    }

    // Query runs where user's wallet was the payer
    const {
      data: runs,
      error,
      count,
    } = await getSupabase()
      .from("x402_job_runs")
      .select(
        `
        id, status, total_payment, payment_network, created_at, completed_at,
        job:x402_jobs(id, name, slug, avatar_url, owner:profiles!x402_jobs_user_id_fkey(username))
      `,
        { count: "exact" },
      )
      .in("payer_address", addresses)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Runs fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch runs" });
    }

    // Format response
    const formattedRuns = (runs || []).map((run) => {
      // Supabase joins can return array or single object
      const jobData = run.job;
      const job = Array.isArray(jobData) ? jobData[0] : jobData;

      // Owner is also a joined field
      const ownerData = job?.owner;
      const owner = Array.isArray(ownerData) ? ownerData[0] : ownerData;

      return {
        id: run.id,
        status: run.status,
        amount: parseFloat(run.total_payment || "0"),
        network: run.payment_network || "solana",
        timestamp: run.created_at,
        completedAt: run.completed_at,
        job: job
          ? {
              id: job.id,
              name: job.name,
              slug: job.slug,
              avatarUrl: job.avatar_url,
              ownerUsername: owner?.username || null,
            }
          : null,
      };
    });

    res.json({
      runs: formattedRuns,
      total: count || 0,
    });
  } catch (error) {
    console.error("Runs fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
