import { Router, Request, Response } from "express";
import { getSupabase } from "../lib/supabase";
import {
  transferUsdcFromFeeWallet,
  isUsdcTransferEnabled,
} from "../lib/usdc-transfer";
import { createNotification } from "../services/notifications.service";

const router: Router = Router();

// Admin auth middleware - verify admin token
async function adminAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.substring(7);
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ error: "Invalid admin token" });
  }

  next();
}

// GET /admin/users - List X402 users with stats
router.get("/users", adminAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    const offset = (page - 1) * perPage;

    // Get profiles with job counts and earnings.
    // HIGH-03: filter soft-deleted users from the admin list. (Use a separate
    // "soft-deleted users" endpoint when a restoration UI lands.)
    const {
      data: users,
      error,
      count,
    } = await getSupabase()
      .from("profiles")
      .select(
        `
        id,
        username,
        display_name,
        avatar_url,
        created_at,
        updated_at
      `,
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        // Get email from auth
        const { data: authData } = await getSupabase().auth.admin.getUserById(
          user.id,
        );

        // Get wallet address
        const { data: wallet } = await getSupabase()
          .from("x402_user_wallets")
          .select("address")
          .eq("user_id", user.id)
          .single();

        // Get job count and total earnings
        const { data: jobs } = await getSupabase()
          .from("x402_jobs")
          .select("id, total_earnings_usdc")
          .eq("user_id", user.id);

        const jobsCount = jobs?.length || 0;
        const totalEarnings =
          jobs?.reduce(
            (sum, j) => sum + (parseFloat(j.total_earnings_usdc) || 0),
            0,
          ) || 0;

        return {
          id: user.id,
          email: authData?.user?.email,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          wallet_address: wallet?.address,
          jobs_count: jobsCount,
          total_earnings: totalEarnings,
          created_at: user.created_at,
        };
      }),
    );

    res.json({
      users: usersWithStats,
      total: count || 0,
      page,
      perPage,
    });
  } catch (error) {
    console.error("Error in admin users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/jobs - List X402 jobs with stats
router.get("/jobs", adminAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    const offset = (page - 1) * perPage;

    const {
      data: jobs,
      error,
      count,
    } = await getSupabase()
      .from("x402_jobs")
      .select(
        `
        id,
        name,
        user_id,
        run_count,
        total_earnings_usdc,
        is_active,
        created_at,
        updated_at
      `,
        { count: "exact" },
      )
      .order("total_earnings_usdc", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) {
      console.error("Error fetching jobs:", error);
      return res.status(500).json({ error: "Failed to fetch jobs" });
    }

    res.json({
      jobs: jobs || [],
      total: count || 0,
      page,
      perPage,
    });
  } catch (error) {
    console.error("Error in admin jobs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/users/:userId/impersonate - Generate impersonation URL
router.post(
  "/users/:userId/impersonate",
  adminAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Verify user exists
      const { data: user, error: userError } =
        await getSupabase().auth.admin.getUserById(userId);

      if (userError || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate magic link for impersonation
      const x402AppUrl = process.env.X402_APP_URL || "https://x402.jobs";

      const { data: linkData, error: linkError } =
        await getSupabase().auth.admin.generateLink({
          type: "magiclink",
          email: user.user.email!,
          options: {
            redirectTo: x402AppUrl,
          },
        });

      if (linkError || !linkData) {
        console.error("Error generating impersonation link:", linkError);
        return res
          .status(500)
          .json({ error: "Failed to generate impersonation link" });
      }

      // Build impersonation URL
      const impersonationUrl = `${x402AppUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink`;

      res.json({
        impersonation_url: impersonationUrl,
        user: {
          id: user.user.id,
          email: user.user.email,
        },
      });
    } catch (error) {
      console.error("Error in impersonate:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// Refund Management
// ============================================================================

// GET /admin/refunds - List refund requests
router.get("/refunds", adminAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    const offset = (page - 1) * perPage;

    let query = getSupabase()
      .from("x402_refunds")
      .select(
        `
        id, refund_number, amount, reason, status, admin_notes,
        created_at, resolved_at, payout_signature,
        user_id, job_id, run_id,
        job:x402_jobs(id, name, slug),
        run:x402_job_runs(id, status, total_cost, error)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: refunds, error, count } = await query;

    if (error) {
      console.error("[Admin] Error fetching refunds:", error);
      return res.status(500).json({ error: "Failed to fetch refunds" });
    }

    // Enrich with user info.
    // HIGH-03 NOTE: this admin-facing query intentionally does NOT filter
    // soft-deleted users — admins need refund context for accounts in the
    // 30-day recovery window. Public-facing surfaces filter elsewhere.
    const enrichedRefunds = await Promise.all(
      (refunds || []).map(async (refund) => {
        const { data: profile } = await getSupabase()
          .from("profiles")
          .select("username, display_name")
          .eq("id", refund.user_id)
          .single();

        const { data: authData } = await getSupabase().auth.admin.getUserById(
          refund.user_id,
        );

        const { data: wallet } = await getSupabase()
          .from("x402_user_wallets")
          .select("address")
          .eq("user_id", refund.user_id)
          .single();

        return {
          ...refund,
          user: {
            id: refund.user_id,
            email: authData?.user?.email,
            username: profile?.username,
            display_name: profile?.display_name,
            wallet_address: wallet?.address,
          },
        };
      }),
    );

    // Get counts by status
    const { count: pendingCount } = await getSupabase()
      .from("x402_refunds")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedCount } = await getSupabase()
      .from("x402_refunds")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: deniedCount } = await getSupabase()
      .from("x402_refunds")
      .select("id", { count: "exact", head: true })
      .eq("status", "denied");

    res.json({
      refunds: enrichedRefunds,
      total: count || 0,
      page,
      perPage,
      counts: {
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        denied: deniedCount || 0,
      },
    });
  } catch (error) {
    console.error("[Admin] Error in refunds list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/refunds/:id/approve - Approve and process refund
router.post(
  "/refunds/:id/approve",
  adminAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;

      const supabase = getSupabase();

      // Get the refund
      const { data: refund, error: refundError } = await supabase
        .from("x402_refunds")
        .select("*, job:x402_jobs(name)")
        .eq("id", id)
        .single();

      if (refundError || !refund) {
        return res.status(404).json({ error: "Refund not found" });
      }

      if (refund.status !== "pending") {
        return res.status(400).json({
          error: `Refund is already ${refund.status}`,
        });
      }

      // Get user's wallet for the transfer
      const { data: wallet, error: walletError } = await supabase
        .from("x402_user_wallets")
        .select("address")
        .eq("user_id", refund.user_id)
        .single();

      if (walletError || !wallet?.address) {
        return res.status(400).json({
          error: "User wallet not found",
        });
      }

      // Process the USDC transfer
      let payoutSignature: string | undefined;

      if (isUsdcTransferEnabled()) {
        const transferResult = await transferUsdcFromFeeWallet(
          wallet.address,
          parseFloat(refund.amount),
        );

        if (!transferResult.success) {
          console.error("[Admin] Refund transfer failed:", transferResult);
          return res.status(500).json({
            error: `Transfer failed: ${transferResult.error}`,
          });
        }

        payoutSignature = transferResult.signature;
      } else {
        console.log(
          `[Admin] DEV MODE: Would transfer $${refund.amount} to ${wallet.address}`,
        );
      }

      // Update refund status
      const { error: updateError } = await supabase
        .from("x402_refunds")
        .update({
          status: "approved",
          admin_notes: admin_notes || null,
          resolved_at: new Date().toISOString(),
          payout_signature: payoutSignature || null,
          payout_network: "solana",
        })
        .eq("id", id);

      if (updateError) {
        console.error("[Admin] Failed to update refund status:", updateError);
        // Transfer happened but status update failed - log for manual reconciliation
        console.error(
          `[Admin] CRITICAL: Transfer succeeded but status update failed. Refund ID: ${id}, Signature: ${payoutSignature}`,
        );
        return res.status(500).json({
          error: "Transfer completed but failed to update status",
          signature: payoutSignature,
        });
      }

      // Notify user
      const jobData = refund.job as { name?: string } | null;
      try {
        await createNotification({
          user_id: refund.user_id,
          type: "submission_approved", // Reusing existing type for "good news"
          title: "Refund approved",
          message: `Your refund request #${refund.refund_number} for $${parseFloat(refund.amount).toFixed(2)} has been approved and sent to your wallet.`,
          link: "/account/history",
          metadata: {
            refund_id: refund.id,
            refund_number: refund.refund_number,
            amount: refund.amount,
            job_name: jobData?.name,
          },
        });
      } catch (notifyError) {
        console.error("[Admin] Failed to notify user:", notifyError);
      }

      console.log(
        `[Admin] Refund #${refund.refund_number} approved: $${refund.amount} to ${wallet.address}`,
      );

      res.json({
        success: true,
        refund_number: refund.refund_number,
        amount: refund.amount,
        signature: payoutSignature,
      });
    } catch (error) {
      console.error("[Admin] Error approving refund:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /admin/refunds/:id/deny - Deny refund request
router.post(
  "/refunds/:id/deny",
  adminAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;

      if (!admin_notes) {
        return res.status(400).json({
          error: "admin_notes is required when denying a refund",
        });
      }

      const supabase = getSupabase();

      // Get the refund
      const { data: refund, error: refundError } = await supabase
        .from("x402_refunds")
        .select("*, job:x402_jobs(name)")
        .eq("id", id)
        .single();

      if (refundError || !refund) {
        return res.status(404).json({ error: "Refund not found" });
      }

      if (refund.status !== "pending") {
        return res.status(400).json({
          error: `Refund is already ${refund.status}`,
        });
      }

      // Update refund status
      const { error: updateError } = await supabase
        .from("x402_refunds")
        .update({
          status: "denied",
          admin_notes,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.error("[Admin] Failed to update refund status:", updateError);
        return res.status(500).json({ error: "Failed to deny refund" });
      }

      // Notify user
      const jobData = refund.job as { name?: string } | null;
      try {
        await createNotification({
          user_id: refund.user_id,
          type: "submission_rejected", // Reusing existing type for "bad news"
          title: "Refund request denied",
          message: `Your refund request #${refund.refund_number} was denied: ${admin_notes}`,
          link: "/account/history",
          metadata: {
            refund_id: refund.id,
            refund_number: refund.refund_number,
            amount: refund.amount,
            job_name: jobData?.name,
            reason: admin_notes,
          },
        });
      } catch (notifyError) {
        console.error("[Admin] Failed to notify user:", notifyError);
      }

      console.log(
        `[Admin] Refund #${refund.refund_number} denied: ${admin_notes}`,
      );

      res.json({
        success: true,
        refund_number: refund.refund_number,
      });
    } catch (error) {
      console.error("[Admin] Error denying refund:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// OpenRouter Model Sync
// ============================================================================

// POST /admin/sync-models - Manually trigger OpenRouter model sync
router.post("/sync-models", adminAuth, async (req: Request, res: Response) => {
  try {
    // Import inngest client
    const { inngest } = await import("../lib/inngest");

    // Send event to trigger sync
    await inngest.send({
      name: "x402/models.sync",
      data: {
        triggeredBy: "admin",
        triggeredAt: new Date().toISOString(),
      },
    });

    console.log("[Admin] Model sync triggered");

    res.json({
      success: true,
      message: "Model sync triggered. Check Inngest dashboard for progress.",
    });
  } catch (error) {
    console.error("[Admin] Error triggering model sync:", error);
    res.status(500).json({ error: "Failed to trigger model sync" });
  }
});

export { router as adminRouter };
