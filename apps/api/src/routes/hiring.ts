/**
 * Hiring Board API Routes
 *
 * Public/Builder endpoints:
 * - GET    /api/hiring/requests - List hiring requests (with filters)
 * - GET    /api/hiring/requests/:id - Get request details
 * - POST   /api/hiring/requests - Create a hiring request
 * - PUT    /api/hiring/requests/:id - Update a request (creator only, before funding)
 * - DELETE /api/hiring/requests/:id - Delete a request (creator only, before funding/submissions)
 * - POST   /api/hiring/requests/:id/fund - Fund bounty escrow
 * - POST   /api/hiring/requests/:id/cancel - Cancel a request
 * - POST   /api/hiring/requests/:id/submissions - Submit a solution
 * - GET    /api/hiring/submissions/:id - Get submission status (for polling)
 * - POST   /api/hiring/submissions/:id/withdraw - Withdraw a submission
 *
 * Reviewer endpoints:
 * - GET  /api/hiring/review-queue - Get submissions needing review
 * - POST /api/hiring/submissions/:id/reviews - Submit a review
 * - GET  /api/hiring/submissions/:id/reviews - Get reviews for a submission
 * - POST /api/hiring/submissions/:id/accept - Manually accept (creator only)
 *
 * Stats:
 * - GET  /api/hiring/stats - Get hiring board stats
 */

import { Router, type Router as RouterType } from "express";
import * as hiringService from "../services/hiring.service";
import { chargeEscrowDeposit } from "../inngest/utils/charge-escrow";
import { executeX402Request } from "../inngest/utils/execute-x402";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import { loadDecryptedUserWallet } from "../lib/wallet-keys";

// Jobputer post_job_request endpoint
const JOBPUTER_POST_JOB_REQUEST_URL =
  process.env.JOBPUTER_POST_JOB_REQUEST_URL ||
  "https://agents.memeputer.com/x402/solana/jobputer/post_job_request";

// Supabase client for wallet lookup
const getSupabase = () =>
  createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Public routes (no auth required for reading)
export const hiringPublicRouter: RouterType = Router();
// Protected routes (auth required)
export const hiringRouter: RouterType = Router();

// ============================================================================
// Public Routes
// ============================================================================

/**
 * GET /api/hiring/requests
 * List hiring requests with filters
 * Agent-friendly: supports status, tag, q (search), pagination
 */
hiringPublicRouter.get("/requests", async (req, res) => {
  try {
    const {
      status,
      tag,
      q,
      min_bounty,
      max_bounty,
      limit = "20",
      offset = "0",
    } = req.query;

    const result = await hiringService.listRequests({
      status: status as hiringService.RequestStatus | undefined,
      tag: tag as string | undefined,
      q: q as string | undefined,
      min_bounty: min_bounty ? parseFloat(min_bounty as string) : undefined,
      max_bounty: max_bounty ? parseFloat(max_bounty as string) : undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      requests: result.requests,
      total: result.total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error("Error listing hiring requests:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/hiring/requests/:id
 * Get a single hiring request with full details
 * Agent-friendly: includes requirements, submission count, etc.
 */
hiringPublicRouter.get("/requests/:id", async (req, res) => {
  try {
    const request = await hiringService.getRequest(req.params.id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Get submissions for this request
    const submissions = await hiringService.listSubmissions(req.params.id);

    res.json({
      request,
      submissions: submissions.map((s) => ({
        id: s.id,
        submitter_type: s.submitter_type,
        submitter_username: s.submitter_username,
        status: s.status,
        created_at: s.created_at,
        // Don't expose job_json in list view
      })),
    });
  } catch (error: any) {
    console.error("Error getting hiring request:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/hiring/submissions/:id
 * Get submission details (for polling status)
 * Agent-friendly: includes review counts and status
 */
hiringPublicRouter.get("/submissions/:id", async (req, res) => {
  try {
    const submission = await hiringService.getSubmission(req.params.id);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Get reviews if submission is not withdrawn
    let reviews: hiringService.HiringReview[] = [];
    if (submission.status !== "withdrawn") {
      reviews = await hiringService.getReviews(req.params.id);
    }

    res.json({
      submission: {
        id: submission.id,
        request_id: submission.request_id,
        submitter_type: submission.submitter_type,
        submitter_user_id: submission.submitter_user_id,
        submitter_username: submission.submitter_username,
        status: submission.status,
        review_count: submission.review_count,
        approval_count: submission.approval_count,
        proof_run: submission.proof_run,
        job_id: submission.job_id,
        job_json: submission.job_json,
        job_name: submission.job_name,
        job_slug: submission.job_slug,
        job_owner_username: submission.job_owner_username,
        creator_feedback: submission.creator_feedback,
        created_at: submission.created_at,
        updated_at: submission.updated_at,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        reviewer_username: r.reviewer_username,
        decision: r.decision,
        notes: r.notes,
        created_at: r.created_at,
      })),
    });
  } catch (error: any) {
    console.error("Error getting submission:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/hiring/stats
 * Get hiring board statistics
 */
hiringPublicRouter.get("/stats", async (req, res) => {
  try {
    const stats = await hiringService.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Error getting hiring stats:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/hiring/review-queue
 * Get submissions awaiting review
 * Public so agents can see what needs review (auth required for actual review)
 */
hiringPublicRouter.get("/review-queue", async (req, res) => {
  try {
    const { limit = "20", offset = "0" } = req.query;

    const result = await hiringService.getReviewQueue(
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
    );

    res.json({
      submissions: result.submissions,
      total: result.total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error("Error getting review queue:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================

/**
 * POST /api/hiring/requests
 * Create a new hiring request
 * Requires $1 posting fee paid via Jobputer
 */
hiringRouter.post("/requests", async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      description,
      requirements,
      tags,
      inputs,
      bounty_amount,
      expires_at,
      approval_quorum,
      approval_pool_size,
    } = req.body;

    // Validation
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return res.status(400).json({ error: "Description is required" });
    }

    if (bounty_amount === undefined || bounty_amount <= 0) {
      return res
        .status(400)
        .json({ error: "Bounty amount must be greater than 0" });
    }

    // Get user's wallet for posting fee payment — decrypted.
    const wallet = await loadDecryptedUserWallet(userId);
    if (!wallet) {
      return res
        .status(400)
        .json({ error: "No wallet found. Please set up your wallet first." });
    }

    // Pay the $1 posting fee via Jobputer
    console.log(`💰 Paying posting fee for user ${userId}...`);
    const paymentResult = await executeX402Request({
      resourceUrl: JOBPUTER_POST_JOB_REQUEST_URL,
      walletSecretKey: wallet.solanaSecretBase64,
      baseWalletKey: wallet.baseSecretBase64 || undefined,
      body: {}, // No body needed for simple text command
    });

    if (!paymentResult.success) {
      console.error(`❌ Posting fee payment failed: ${paymentResult.error}`);
      return res.status(402).json({
        error: paymentResult.error || "Failed to pay posting fee",
        details: "Please ensure you have at least $1 USDC in your wallet",
      });
    }

    // Verify that a payment was actually made (not just a 200 response without payment)
    if (!paymentResult.paymentSignature) {
      console.error(
        `❌ No payment was made - Jobputer command may not require payment`,
      );
      return res.status(500).json({
        error: "Payment verification failed",
        details:
          "The posting fee command is not configured correctly. Please contact support.",
      });
    }

    console.log(
      `✅ Posting fee paid! Tx: ${paymentResult.paymentSignature.substring(0, 20)}...`,
    );

    // Create the request
    const request = await hiringService.createRequest(userId, {
      title: title.trim(),
      description: description.trim(),
      requirements: requirements || [],
      tags: tags || [],
      inputs: inputs || [],
      bounty_amount: parseFloat(bounty_amount),
      posting_fee_amount: paymentResult.amountPaid || 1.0,
      expires_at,
      approval_quorum,
      approval_pool_size,
    });

    res.status(201).json({
      request,
      payment: {
        amount: paymentResult.amountPaid || 1.0,
        signature: paymentResult.paymentSignature,
      },
    });
  } catch (error: any) {
    console.error("Error creating hiring request:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PUT /api/hiring/requests/:id
 * Update a hiring request (only if open and not funded)
 */
hiringRouter.put("/requests/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;
    const {
      title,
      description,
      requirements,
      tags,
      inputs,
      bounty_amount,
      expires_at,
    } = req.body;

    const request = await hiringService.updateRequest(requestId, userId, {
      title,
      description,
      requirements,
      tags,
      inputs,
      bounty_amount:
        bounty_amount !== undefined ? parseFloat(bounty_amount) : undefined,
      expires_at,
    });

    res.json({ request });
  } catch (error: any) {
    console.error("Error updating hiring request:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the creator")
        ? 403
        : error.message.includes("Cannot")
          ? 400
          : 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to update request" });
  }
});

/**
 * DELETE /api/hiring/requests/:id
 * Delete a hiring request (only if open, not funded, and no submissions)
 */
hiringRouter.delete("/requests/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    await hiringService.deleteRequest(requestId, userId);

    res.json({ success: true, message: "Request deleted" });
  } catch (error: any) {
    console.error("Error deleting hiring request:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the creator")
        ? 403
        : error.message.includes("Cannot")
          ? 400
          : 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to delete request" });
  }
});

/**
 * POST /api/hiring/requests/:id/fund
 * Fund the bounty escrow for a request
 *
 * This endpoint:
 * 1. Gets the user's platform wallet
 * 2. Gets the request's bounty amount
 * 3. Charges the escrow via Jobputer's x402 endpoint
 * 4. Updates the request status on success
 */
hiringRouter.post("/requests/:id/fund", async (req, res) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    // Get the request first to verify ownership and get bounty amount
    const existingRequest = await hiringService.getRequest(requestId);
    if (!existingRequest) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existingRequest.creator_user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Only the creator can fund this request" });
    }

    if (existingRequest.escrow_status !== "none") {
      return res
        .status(400)
        .json({ error: `Request is already ${existingRequest.escrow_status}` });
    }

    if (existingRequest.status !== "open") {
      return res.status(400).json({ error: "Can only fund open requests" });
    }

    // Get user's wallet (both Solana and Base keys) — decrypted.
    const wallet = await loadDecryptedUserWallet(userId);
    if (!wallet) {
      return res.status(400).json({
        error: "No wallet found. Please set up your wallet first.",
      });
    }

    // Charge the escrow via x402 (supports both Solana and Base)
    const escrowResult = await chargeEscrowDeposit(
      wallet.solanaSecretBase64,
      requestId,
      existingRequest.bounty_amount,
      wallet.baseSecretBase64 ?? undefined, // Optional Base wallet for Base network payments
    );

    if (!escrowResult.success) {
      return res.status(402).json({
        error: escrowResult.error || "Payment failed",
        code: "payment_failed",
      });
    }

    // Payment succeeded - update the request status
    const request = await hiringService.fundRequest(
      requestId,
      userId,
      escrowResult.transactionSignature,
    );

    res.json({
      request,
      payment: {
        transactionSignature: escrowResult.transactionSignature,
        amountPaid: escrowResult.amountPaid,
      },
    });
  } catch (error: any) {
    console.error("Error funding request:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the creator")
        ? 403
        : 400;
    res
      .status(status)
      .json({ error: error.message || "Failed to fund request" });
  }
});

/**
 * POST /api/hiring/requests/:id/cancel
 * Cancel a hiring request
 */
hiringRouter.post("/requests/:id/cancel", async (req, res) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    const request = await hiringService.cancelRequest(requestId, userId);
    res.json({ request });
  } catch (error: any) {
    console.error("Error canceling request:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the creator")
        ? 403
        : 400;
    res
      .status(status)
      .json({ error: error.message || "Failed to cancel request" });
  }
});

/**
 * POST /api/hiring/requests/:id/submissions
 * Submit a solution to a hiring request
 * Agent-friendly: accepts job_json directly with payout_address
 */
hiringRouter.post("/requests/:id/submissions", async (req, res) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;
    const { job_json, job_id, payout_address, proof_run } = req.body;

    // Validation
    if (!job_json && !job_id) {
      return res.status(400).json({
        error: "Must provide either job_json or job_id",
      });
    }

    const submission = await hiringService.createSubmission(userId, {
      request_id: requestId,
      job_json,
      job_id,
      payout_address,
      proof_run,
      submitter_type: "human",
    });

    res.status(201).json({ submission });
  } catch (error: any) {
    console.error("Error creating submission:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("only submit")
        ? 400
        : 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to create submission" });
  }
});

/**
 * POST /api/hiring/submissions/:id/withdraw
 * Withdraw a submission
 */
hiringRouter.post("/submissions/:id/withdraw", async (req, res) => {
  try {
    const userId = req.user!.id;
    const submissionId = req.params.id;

    const submission = await hiringService.withdrawSubmission(
      submissionId,
      userId,
    );
    res.json({ submission });
  } catch (error: any) {
    console.error("Error withdrawing submission:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the submitter")
        ? 403
        : 400;
    res
      .status(status)
      .json({ error: error.message || "Failed to withdraw submission" });
  }
});

/**
 * POST /api/hiring/submissions/:id/reviews
 * Submit a review for a submission
 */
hiringRouter.post("/submissions/:id/reviews", async (req, res) => {
  try {
    const userId = req.user!.id;
    const submissionId = req.params.id;
    const { decision, notes } = req.body;

    // Validation
    if (!decision || !["approve", "reject"].includes(decision)) {
      return res.status(400).json({
        error: "Decision must be 'approve' or 'reject'",
      });
    }

    const result = await hiringService.createReview(
      submissionId,
      userId,
      decision as hiringService.ReviewDecision,
      notes,
    );

    res.status(201).json({
      review: result.review,
      submission_accepted: result.submissionAccepted,
    });
  } catch (error: any) {
    console.error("Error creating review:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Cannot review")
        ? 403
        : error.message.includes("already reviewed")
          ? 409
          : 400;
    res
      .status(status)
      .json({ error: error.message || "Failed to create review" });
  }
});

/**
 * GET /api/hiring/submissions/:id/reviews
 * Get all reviews for a submission
 */
hiringRouter.get("/submissions/:id/reviews", async (req, res) => {
  try {
    const reviews = await hiringService.getReviews(req.params.id);
    res.json({ reviews });
  } catch (error: any) {
    console.error("Error getting reviews:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/hiring/submissions/:id/accept
 * Manually accept a submission (creator only, bypasses quorum)
 */
hiringRouter.post("/submissions/:id/accept", async (req, res) => {
  try {
    const userId = req.user!.id;
    const submissionId = req.params.id;

    await hiringService.manuallyAcceptSubmission(submissionId, userId);

    // Get updated submission
    const submission = await hiringService.getSubmission(submissionId);
    res.json({ submission, message: "Submission accepted" });
  } catch (error: any) {
    console.error("Error accepting submission:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the request creator")
        ? 403
        : 400;
    res
      .status(status)
      .json({ error: error.message || "Failed to accept submission" });
  }
});

/**
 * GET /api/hiring/my-requests
 * Get current user's hiring requests
 */
hiringRouter.get("/my-requests", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { limit = "20", offset = "0" } = req.query;

    const result = await hiringService.listRequests({
      creator_user_id: userId,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      requests: result.requests,
      total: result.total,
    });
  } catch (error: any) {
    console.error("Error getting my requests:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /api/hiring/requests/:id/escrow-ledger
 * Get escrow ledger for a request (creator only)
 */
hiringRouter.get("/requests/:id/escrow-ledger", async (req, res) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    // Verify ownership
    const request = await hiringService.getRequest(requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.creator_user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Only the creator can view the escrow ledger" });
    }

    const ledger = await hiringService.getEscrowLedger(requestId);
    res.json({ ledger });
  } catch (error: any) {
    console.error("Error getting escrow ledger:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ============================================================================
// Creator Review Routes (Simplified Flow)
// ============================================================================

/**
 * POST /api/hiring/submissions/:id/creator-review
 * Creator reviews a submission (approve/reject/request_changes)
 */
hiringRouter.post("/submissions/:id/creator-review", async (req, res) => {
  try {
    const userId = req.user!.id;
    const submissionId = req.params.id;
    const { decision, feedback } = req.body;

    // Validation
    if (
      !decision ||
      !["approve", "reject", "request_changes"].includes(decision)
    ) {
      return res.status(400).json({
        error: "Decision must be 'approve', 'reject', or 'request_changes'",
      });
    }

    if (decision === "request_changes" && !feedback) {
      return res.status(400).json({
        error: "Feedback is required when requesting changes",
      });
    }

    const result = await hiringService.creatorReview(
      submissionId,
      userId,
      decision as hiringService.CreatorReviewDecision,
      feedback,
    );

    res.json({
      submission: result.submission,
      payout: result.payout,
      message:
        decision === "approve"
          ? "Submission approved! Bounty released to builder."
          : decision === "reject"
            ? "Submission rejected."
            : "Changes requested. Builder has been notified.",
    });
  } catch (error: any) {
    console.error("Error in creator review:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the request creator")
        ? 403
        : error.message.includes("Cannot review")
          ? 400
          : 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to review submission" });
  }
});

/**
 * POST /api/hiring/submissions/:id/resubmit
 * Builder resubmits after changes were requested
 */
hiringRouter.post("/submissions/:id/resubmit", async (req, res) => {
  try {
    const userId = req.user!.id;
    const submissionId = req.params.id;
    const { job_json, proof_run } = req.body;

    const submission = await hiringService.resubmitAfterChanges(
      submissionId,
      userId,
      { job_json, proof_run },
    );

    res.json({
      submission,
      message: "Submission updated and resubmitted for review.",
    });
  } catch (error: any) {
    console.error("Error resubmitting:", error);
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Only the submitter")
        ? 403
        : error.message.includes("Can only resubmit")
          ? 400
          : 500;
    res.status(status).json({ error: error.message || "Failed to resubmit" });
  }
});
