import { Router, Request, Response, NextFunction } from "express";
import type { Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";
import {
  transferUsdcFromFeeWallet,
  isUsdcTransferEnabled,
} from "../lib/usdc-transfer";
import { createNotification } from "../services/notifications.service";

export const refundsAdminRouter: RouterType = Router();

// Admin email whitelist
const ADMIN_EMAILS = ["ben@memeputer.com"];

// Middleware to check if user is admin
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Get user email
  const { data: authData } = await getSupabase().auth.admin.getUserById(userId);
  const email = authData?.user?.email;

  if (!email || !ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

// GET /refunds/admin - List refund requests (admin only)
refundsAdminRouter.get(
  "/admin",
  requireAdmin,
  async (req: Request, res: Response) => {
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
        console.error("[RefundsAdmin] Error fetching refunds:", error);
        return res.status(500).json({ error: "Failed to fetch refunds" });
      }

      // Enrich with user info.
      // HIGH-03 NOTE: admin-facing — intentionally does NOT filter soft-deleted
      // users. Admins need refund context during the 30-day recovery window.
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
      console.error("[RefundsAdmin] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /refunds/admin/:id/approve - Approve and process refund
refundsAdminRouter.post(
  "/admin/:id/approve",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      const adminUserId = req.user!.id;

      const supabase = getSupabase();

      // Atomically claim this refund by setting status to "processing"
      // This prevents race conditions where multiple requests try to approve the same refund
      const { data: claimedRefund, error: claimError } = await supabase
        .from("x402_refunds")
        .update({ status: "processing" })
        .eq("id", id)
        .eq("status", "pending") // Only update if still pending
        .select("*, job:x402_jobs(name)")
        .single();

      if (claimError || !claimedRefund) {
        // Check if refund exists and what its status is
        const { data: existingRefund } = await supabase
          .from("x402_refunds")
          .select("status")
          .eq("id", id)
          .single();

        if (!existingRefund) {
          return res.status(404).json({ error: "Refund not found" });
        }

        return res.status(400).json({
          error: `Refund is already ${existingRefund.status}`,
        });
      }

      const refund = claimedRefund;

      // Get user's wallet for the transfer
      const { data: wallet, error: walletError } = await supabase
        .from("x402_user_wallets")
        .select("address")
        .eq("user_id", refund.user_id)
        .single();

      if (walletError || !wallet?.address) {
        // Revert status back to pending since we can't process
        await supabase
          .from("x402_refunds")
          .update({ status: "pending" })
          .eq("id", id);
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
          console.error("[RefundsAdmin] Transfer failed:", transferResult);
          // Revert status back to pending since transfer failed
          await supabase
            .from("x402_refunds")
            .update({ status: "pending" })
            .eq("id", id);
          return res.status(500).json({
            error: `Transfer failed: ${transferResult.error}`,
          });
        }

        payoutSignature = transferResult.signature;
      } else {
        console.log(
          `[RefundsAdmin] DEV MODE: Would transfer $${refund.amount} to ${wallet.address}`,
        );
      }

      // Update refund status to approved
      const { error: updateError } = await supabase
        .from("x402_refunds")
        .update({
          status: "approved",
          admin_notes: admin_notes || null,
          resolved_at: new Date().toISOString(),
          resolved_by: adminUserId,
          payout_signature: payoutSignature || null,
          payout_network: "solana",
        })
        .eq("id", id);

      if (updateError) {
        console.error("[RefundsAdmin] Failed to update status:", updateError);
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
          type: "submission_approved",
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
        console.error("[RefundsAdmin] Failed to notify user:", notifyError);
      }

      console.log(
        `[RefundsAdmin] Refund #${refund.refund_number} approved: $${refund.amount}`,
      );

      res.json({
        success: true,
        refund_number: refund.refund_number,
        amount: refund.amount,
        signature: payoutSignature,
      });
    } catch (error) {
      console.error("[RefundsAdmin] Error approving:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /refunds/admin/:id/deny - Deny refund request
refundsAdminRouter.post(
  "/admin/:id/deny",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      const adminUserId = req.user!.id;

      if (!admin_notes) {
        return res.status(400).json({
          error: "admin_notes is required when denying a refund",
        });
      }

      const supabase = getSupabase();

      // Atomically update status from pending to denied
      // This prevents race conditions
      const { data: refund, error: updateError } = await supabase
        .from("x402_refunds")
        .update({
          status: "denied",
          admin_notes,
          resolved_at: new Date().toISOString(),
          resolved_by: adminUserId,
        })
        .eq("id", id)
        .eq("status", "pending") // Only update if still pending
        .select("*, job:x402_jobs(name)")
        .single();

      if (updateError || !refund) {
        // Check if refund exists and what its status is
        const { data: existingRefund } = await supabase
          .from("x402_refunds")
          .select("status")
          .eq("id", id)
          .single();

        if (!existingRefund) {
          return res.status(404).json({ error: "Refund not found" });
        }

        return res.status(400).json({
          error: `Refund is already ${existingRefund.status}`,
        });
      }

      // Notify user
      const jobData = refund.job as { name?: string } | null;
      try {
        await createNotification({
          user_id: refund.user_id,
          type: "submission_rejected",
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
        console.error("[RefundsAdmin] Failed to notify user:", notifyError);
      }

      console.log(`[RefundsAdmin] Refund #${refund.refund_number} denied`);

      res.json({
        success: true,
        refund_number: refund.refund_number,
      });
    } catch (error) {
      console.error("[RefundsAdmin] Error denying:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
