import { Router } from "express";
import type { Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";
import { notifyRefundRequested } from "../services/notifications.service";

export const refundsRouter: RouterType = Router();

// Admin user ID for notifications
const ADMIN_USER_ID = "4e4efff6-3736-4c28-994d-e28163614638";

// POST /refunds - Request a refund for a failed job run
refundsRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { run_id, reason } = req.body;

    if (!run_id) {
      return res.status(400).json({ error: "run_id is required" });
    }

    const supabase = getSupabase();

    // Get the job run and verify ownership
    const { data: run, error: runError } = await supabase
      .from("x402_job_runs")
      .select(
        `
        id, job_id, user_id, status, total_cost,
        job:x402_jobs(name)
      `,
      )
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return res.status(404).json({ error: "Job run not found" });
    }

    // Verify ownership
    if (run.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Verify job failed
    if (run.status !== "failed") {
      return res.status(400).json({
        error: `Cannot refund a job with status "${run.status}". Only failed jobs are eligible.`,
      });
    }

    // Check if already requested refund
    const { data: existingRefund } = await supabase
      .from("x402_refunds")
      .select("id, refund_number, status")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existingRefund) {
      return res.status(400).json({
        error:
          existingRefund.status === "pending"
            ? "A refund request is already pending for this job run"
            : "This job run has already been processed for refund",
        refund_number: existingRefund.refund_number,
        status: existingRefund.status,
      });
    }

    // Calculate refund amount (total job cost)
    const refundAmount = parseFloat(run.total_cost || "0");

    if (refundAmount <= 0) {
      return res.status(400).json({
        error: "No refundable amount for this job run",
      });
    }

    // Find the failed event (for future cost recovery)
    const { data: failedEvent } = await supabase
      .from("x402_job_run_events")
      .select("id")
      .eq("run_id", run_id)
      .eq("status", "failed")
      .limit(1)
      .maybeSingle();

    // Create pending refund record
    const { data: refund, error: refundError } = await supabase
      .from("x402_refunds")
      .insert({
        run_id: run_id,
        job_id: run.job_id,
        user_id: userId,
        amount: refundAmount,
        reason: reason || null,
        status: "pending",
        failed_event_id: failedEvent?.id || null,
      })
      .select("id, refund_number, amount, created_at")
      .single();

    if (refundError) {
      console.error("[Refunds] Failed to create refund record:", refundError);
      return res.status(500).json({
        error: "Failed to create refund request",
      });
    }

    // Get requester's username for notification (skip soft-deleted — HIGH-03)
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    // Notify admin
    const jobData = run.job as { name?: string } | null;
    const jobName = jobData?.name || "Unknown Job";

    try {
      await notifyRefundRequested(
        ADMIN_USER_ID,
        refund.id,
        refund.refund_number,
        refundAmount,
        jobName,
        profile?.username || "Unknown User",
        reason || undefined,
      );
      console.log(
        `[Refunds] Notified admin of refund request #${refund.refund_number}`,
      );
    } catch (notifyError) {
      console.error("[Refunds] Failed to notify admin:", notifyError);
      // Don't fail the request if notification fails
    }

    console.log(
      `[Refunds] Refund #${refund.refund_number} requested: $${refundAmount} for run ${run_id}`,
    );

    res.json({
      success: true,
      refund_number: refund.refund_number,
      amount: refundAmount,
      status: "pending",
      message:
        "Refund request submitted. You'll be notified when it's processed.",
      created_at: refund.created_at,
    });
  } catch (error) {
    console.error("[Refunds] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /refunds - Get user's refund history
refundsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const {
      data: refunds,
      error,
      count,
    } = await getSupabase()
      .from("x402_refunds")
      .select(
        `
        id, refund_number, amount, reason, status, created_at, resolved_at, admin_notes,
        job:x402_jobs(id, name, slug)
      `,
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[Refunds] Error fetching refunds:", error);
      return res.status(500).json({ error: "Failed to fetch refunds" });
    }

    res.json({
      refunds: refunds || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("[Refunds] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /refunds/:run_id/status - Check if a run is eligible for refund
refundsRouter.get("/:run_id/status", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { run_id } = req.params;

    const supabase = getSupabase();

    // Get the job run
    const { data: run, error: runError } = await supabase
      .from("x402_job_runs")
      .select("id, user_id, status, total_cost")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return res.status(404).json({ error: "Job run not found" });
    }

    // Verify ownership
    if (run.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if already has refund
    const { data: existingRefund } = await supabase
      .from("x402_refunds")
      .select("id, refund_number, amount, status, created_at")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existingRefund) {
      return res.json({
        eligible: false,
        reason:
          existingRefund.status === "pending" ? "pending" : "already_processed",
        refund: existingRefund,
      });
    }

    // Check status
    if (run.status !== "failed") {
      return res.json({
        eligible: false,
        reason: "not_failed",
        status: run.status,
      });
    }

    const refundAmount = parseFloat(run.total_cost || "0");

    if (refundAmount <= 0) {
      return res.json({
        eligible: false,
        reason: "no_cost",
      });
    }

    res.json({
      eligible: true,
      amount: refundAmount,
    });
  } catch (error) {
    console.error("[Refunds] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
