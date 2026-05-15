/**
 * Hiring Service
 * Business logic for the Hiring Board feature
 *
 * TODO Phase 2:
 * - Agent protocol / MCP server integration
 * - x402 payment settlement
 * - Automated acceptance tests
 * - Dispute resolution
 * - Reputation system
 */

import * as notificationService from "./notifications.service";
import { releaseEscrowPayout } from "../inngest/utils/release-escrow";
import { getSupabase } from "../lib/supabase";

// ============================================================================
// Types
// ============================================================================

export type EscrowStatus = "none" | "funded" | "released" | "refunded";
export type RequestStatus =
  | "open"
  | "under_review"
  | "fulfilled"
  | "canceled"
  | "expired";
export type SubmitterType = "human" | "agent";
export type SubmissionStatus =
  | "submitted"
  | "needs_changes"
  | "accepted"
  | "rejected"
  | "withdrawn";
export type ReviewDecision = "approve" | "reject";
export type PayoutStatus = "pending" | "paid" | "failed";
export type LedgerTransactionType = "deposit" | "release" | "refund" | "fee";

export type JobInputType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | "object";

export interface JobInput {
  name: string;
  type: JobInputType;
  required: boolean;
  description?: string;
  default?: string;
}

export interface HiringRequest {
  id: string;
  creator_user_id: string;
  title: string;
  description: string;
  requirements: string[];
  tags: string[];
  inputs: JobInput[];
  bounty_amount: number;
  posting_fee_amount: number;
  escrow_status: EscrowStatus;
  status: RequestStatus;
  desired_deliverable: string;
  approval_quorum: number;
  approval_pool_size: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  // Transaction hashes for on-chain proof
  escrow_tx_hash?: string;
  payout_tx_hash?: string;
  // Joined fields
  creator_username?: string;
  submission_count?: number;
}

export interface ProofRun {
  run_logs_url?: string;
  run_output?: unknown;
  notes?: string;
}

export interface HiringSubmission {
  id: string;
  request_id: string;
  submitter_type: SubmitterType;
  submitter_user_id?: string;
  submitter_wallet_address?: string;
  job_id?: string;
  job_json?: unknown;
  proof_run: ProofRun;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
  // Creator review fields
  creator_feedback?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  // Joined fields
  submitter_username?: string;
  review_count?: number;
  approval_count?: number;
  // Job info (when job_id exists)
  job_name?: string;
  job_slug?: string;
  job_owner_username?: string;
}

export type CreatorReviewDecision = "approve" | "reject" | "request_changes";

export interface HiringReview {
  id: string;
  submission_id: string;
  reviewer_user_id: string;
  decision: ReviewDecision;
  notes?: string;
  created_at: string;
  // Joined fields
  reviewer_username?: string;
}

export interface HiringPayout {
  id: string;
  request_id: string;
  submission_id: string;
  amount: number;
  platform_fee: number;
  reviewer_pool_fee: number;
  payout_address: string;
  status: PayoutStatus;
  tx_hash?: string;
  paid_at?: string;
  error_message?: string;
  created_at: string;
}

export interface CreateRequestInput {
  title: string;
  description: string;
  requirements?: string[];
  tags?: string[];
  inputs?: JobInput[];
  bounty_amount: number;
  posting_fee_amount?: number;
  expires_at?: string;
  approval_quorum?: number;
  approval_pool_size?: number;
}

export interface CreateSubmissionInput {
  request_id: string;
  job_json?: unknown;
  job_id?: string;
  payout_address?: string;
  proof_run?: ProofRun;
  submitter_type?: SubmitterType;
}

export interface ListRequestsFilter {
  status?: RequestStatus;
  tag?: string;
  q?: string; // search query
  creator_user_id?: string;
  min_bounty?: number;
  max_bounty?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Service Class
// ============================================================================

// Platform fee percentage (5%)
const PLATFORM_FEE_RATE = 0.05;

// Fee collection address for platform revenue
const FEE_COLLECTION_ADDRESS =
  process.env.FEE_COLLECTION_ADDRESS ||
  "6Yw8BnPU6sadbsZtB6LykxTVfhj8qmEVL2cyjdh5ChKh";

// ============================================================================
// Request Operations
// ============================================================================

/**
 * List hiring requests with filters
 * Agent-friendly: returns structured JSON with pagination
 */
export async function listRequests(
  filters: ListRequestsFilter = {},
): Promise<{ requests: HiringRequest[]; total: number }> {
  const {
    status = "open",
    tag,
    q,
    creator_user_id,
    min_bounty,
    max_bounty,
    limit = 20,
    offset = 0,
  } = filters;

  let query = getSupabase()
    .from("x402_hiring_requests")
    .select("*", { count: "exact" });

  // Apply filters
  if (status) {
    query = query.eq("status", status);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (creator_user_id) {
    query = query.eq("creator_user_id", creator_user_id);
  }

  if (min_bounty !== undefined) {
    query = query.gte("bounty_amount", min_bounty);
  }

  if (max_bounty !== undefined) {
    query = query.lte("bounty_amount", max_bounty);
  }

  // Pagination
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error listing hiring requests:", error);
    throw new Error("Failed to list hiring requests");
  }

  // Fetch creator usernames
  const creatorIds = [
    ...new Set((data || []).map((r: any) => r.creator_user_id)),
  ];
  const usernames: Record<string, string> = {};

  if (creatorIds.length > 0) {
    const { data: users } = await getSupabase()
      .from("users")
      .select("id, username")
      .in("id", creatorIds);

    (users || []).forEach((u: { id: string; username: string }) => {
      if (u.username) usernames[u.id] = u.username;
    });
  }

  // Map to typed response
  const requests: HiringRequest[] = (data || []).map((row: any) => ({
    ...row,
    creator_username: usernames[row.creator_user_id],
    requirements: row.requirements || [],
    tags: row.tags || [],
    inputs: row.inputs || [],
    bounty_amount: parseFloat(row.bounty_amount),
    posting_fee_amount: parseFloat(row.posting_fee_amount || 0),
  }));

  return { requests, total: count || 0 };
}

/**
 * Get a single hiring request by ID
 * Agent-friendly: includes all relevant data for decision making
 */
export async function getRequest(
  requestId: string,
): Promise<HiringRequest | null> {
  const { data, error } = await getSupabase()
    .from("x402_hiring_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !data) {
    return null;
  }

  // Get creator username
  let creatorUsername: string | undefined;
  if (data.creator_user_id) {
    const { data: user } = await getSupabase()
      .from("users")
      .select("username")
      .eq("id", data.creator_user_id)
      .single();
    creatorUsername = user?.username;
  }

  // Get submission count
  const { count: submissionCount } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("*", { count: "exact", head: true })
    .eq("request_id", requestId);

  return {
    ...data,
    creator_username: creatorUsername,
    requirements: data.requirements || [],
    tags: data.tags || [],
    inputs: data.inputs || [],
    bounty_amount: parseFloat(data.bounty_amount),
    posting_fee_amount: parseFloat(data.posting_fee_amount || 0),
    submission_count: submissionCount || 0,
  };
}

/**
 * Create a new hiring request
 */
export async function createRequest(
  creatorUserId: string,
  input: CreateRequestInput,
): Promise<HiringRequest> {
  const { data, error } = await getSupabase()
    .from("x402_hiring_requests")
    .insert({
      creator_user_id: creatorUserId,
      title: input.title,
      description: input.description,
      requirements: input.requirements || [],
      tags: input.tags || [],
      inputs: input.inputs || [],
      bounty_amount: input.bounty_amount,
      posting_fee_amount: input.posting_fee_amount || 0,
      expires_at: input.expires_at,
      approval_quorum: input.approval_quorum || 2,
      approval_pool_size: input.approval_pool_size || 3,
      escrow_status: "none",
      status: "open",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating hiring request:", error);
    throw new Error("Failed to create hiring request");
  }

  return {
    ...data,
    requirements: data.requirements || [],
    tags: data.tags || [],
    inputs: data.inputs || [],
    bounty_amount: parseFloat(data.bounty_amount),
    posting_fee_amount: parseFloat(data.posting_fee_amount || 0),
  };
}

/**
 * Update a hiring request (only if open and not funded)
 */
export async function updateRequest(
  requestId: string,
  userId: string,
  input: Partial<CreateRequestInput>,
): Promise<HiringRequest> {
  const request = await getRequest(requestId);
  if (!request) {
    throw new Error("Request not found");
  }

  if (request.creator_user_id !== userId) {
    throw new Error("Only the creator can update this request");
  }

  if (request.escrow_status !== "none") {
    throw new Error("Cannot edit a funded request");
  }

  if (request.status !== "open") {
    throw new Error("Can only edit open requests");
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.requirements !== undefined)
    updateData.requirements = input.requirements;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.inputs !== undefined) updateData.inputs = input.inputs;
  if (input.bounty_amount !== undefined)
    updateData.bounty_amount = input.bounty_amount;
  if (input.expires_at !== undefined) updateData.expires_at = input.expires_at;

  const { data, error } = await getSupabase()
    .from("x402_hiring_requests")
    .update(updateData)
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    console.error("Error updating hiring request:", error);
    throw new Error("Failed to update hiring request");
  }

  return {
    ...data,
    requirements: data.requirements || [],
    tags: data.tags || [],
    inputs: data.inputs || [],
    bounty_amount: parseFloat(data.bounty_amount),
    posting_fee_amount: parseFloat(data.posting_fee_amount || 0),
  };
}

/**
 * Delete a hiring request (only if open and not funded)
 */
export async function deleteRequest(
  requestId: string,
  userId: string,
): Promise<void> {
  const request = await getRequest(requestId);
  if (!request) {
    throw new Error("Request not found");
  }

  if (request.creator_user_id !== userId) {
    throw new Error("Only the creator can delete this request");
  }

  if (request.escrow_status !== "none") {
    throw new Error(
      "Cannot delete a funded request. Cancel it instead to get a refund.",
    );
  }

  if (request.status !== "open") {
    throw new Error("Can only delete open requests");
  }

  // Check if there are any submissions
  const { count } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);

  if (count && count > 0) {
    throw new Error(
      "Cannot delete a request with submissions. Cancel it instead.",
    );
  }

  const { error } = await getSupabase()
    .from("x402_hiring_requests")
    .delete()
    .eq("id", requestId);

  if (error) {
    console.error("Error deleting hiring request:", error);
    throw new Error("Failed to delete hiring request");
  }
}

/**
 * Fund a hiring request's escrow
 * Called after successful x402 payment to update status
 */
export async function fundRequest(
  requestId: string,
  userId: string,
  transactionSignature?: string,
): Promise<HiringRequest> {
  // Get the request
  const request = await getRequest(requestId);
  if (!request) {
    throw new Error("Request not found");
  }

  // Verify ownership
  if (request.creator_user_id !== userId) {
    throw new Error("Only the creator can fund this request");
  }

  // Check current status
  if (request.escrow_status !== "none") {
    throw new Error(`Request is already ${request.escrow_status}`);
  }

  if (request.status !== "open") {
    throw new Error("Can only fund open requests");
  }

  // Update escrow status with transaction hash
  const { data, error } = await getSupabase()
    .from("x402_hiring_requests")
    .update({
      escrow_status: "funded",
      escrow_tx_hash: transactionSignature,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to fund request");
  }

  // Record in ledger with transaction signature
  await recordEscrowTransaction(requestId, "deposit", request.bounty_amount, {
    description: "Bounty deposited to escrow",
    metadata: transactionSignature
      ? { transaction_signature: transactionSignature }
      : undefined,
  });

  return {
    ...data,
    requirements: data.requirements || [],
    tags: data.tags || [],
    bounty_amount: parseFloat(data.bounty_amount),
    posting_fee_amount: parseFloat(data.posting_fee_amount || 0),
  };
}

/**
 * Cancel a hiring request (only if no accepted submissions)
 */
export async function cancelRequest(
  requestId: string,
  userId: string,
): Promise<HiringRequest> {
  const request = await getRequest(requestId);
  if (!request) {
    throw new Error("Request not found");
  }

  if (request.creator_user_id !== userId) {
    throw new Error("Only the creator can cancel this request");
  }

  if (request.status === "fulfilled") {
    throw new Error("Cannot cancel a fulfilled request");
  }

  // Check for accepted submissions
  const { count } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("*", { count: "exact", head: true })
    .eq("request_id", requestId)
    .eq("status", "accepted");

  if (count && count > 0) {
    throw new Error("Cannot cancel: has accepted submissions");
  }

  // Update status
  const { data, error } = await getSupabase()
    .from("x402_hiring_requests")
    .update({
      status: "canceled",
      escrow_status:
        request.escrow_status === "funded" ? "refunded" : request.escrow_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to cancel request");
  }

  // Record refund in ledger if was funded
  if (request.escrow_status === "funded") {
    await recordEscrowTransaction(requestId, "refund", request.bounty_amount, {
      description: "Bounty refunded due to cancellation",
    });
  }

  return {
    ...data,
    requirements: data.requirements || [],
    tags: data.tags || [],
    bounty_amount: parseFloat(data.bounty_amount),
    posting_fee_amount: parseFloat(data.posting_fee_amount || 0),
  };
}

// ============================================================================
// Submission Operations
// ============================================================================

/**
 * Create a submission for a hiring request
 * Agent-friendly: accepts job_json directly
 */
export async function createSubmission(
  userId: string | null,
  input: CreateSubmissionInput,
): Promise<HiringSubmission> {
  // Get the request
  const request = await getRequest(input.request_id);
  if (!request) {
    throw new Error("Request not found");
  }

  // Validate request status
  if (request.status !== "open") {
    throw new Error("Can only submit to open requests");
  }

  // Determine submitter type and validate
  const submitterType = input.submitter_type || "human";

  if (submitterType === "human" && !userId) {
    throw new Error("Human submissions require authentication");
  }

  if (submitterType === "agent" && !input.payout_address) {
    throw new Error("Agent submissions require a payout address");
  }

  // Need either job_json or job_id
  if (!input.job_json && !input.job_id) {
    throw new Error("Must provide either job_json or job_id");
  }

  // Get user's wallet address if human and no payout address specified
  let payoutAddress = input.payout_address;
  if (!payoutAddress && userId) {
    const { data: wallet } = await getSupabase()
      .from("x402_user_wallets")
      .select("address")
      .eq("user_id", userId)
      .single();
    payoutAddress = wallet?.address;
  }

  const { data, error } = await getSupabase()
    .from("x402_hiring_submissions")
    .insert({
      request_id: input.request_id,
      submitter_type: submitterType,
      submitter_user_id: userId,
      submitter_wallet_address: payoutAddress,
      job_id: input.job_id,
      job_json: input.job_json,
      proof_run: input.proof_run || {},
      status: "submitted",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating submission:", error);
    throw new Error("Failed to create submission");
  }

  // Send notification to the request creator
  try {
    // Get submitter name
    let submitterName = "Someone";
    if (userId) {
      const { data: submitter } = await getSupabase()
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();
      if (submitter?.username) {
        submitterName = submitter.username;
      }
    } else if (input.payout_address) {
      submitterName = `Agent (${input.payout_address.substring(0, 8)}...)`;
    }

    await notificationService.notifySubmissionReceived(
      request.creator_user_id,
      request.id,
      request.title,
      submitterName,
    );
  } catch (notifError) {
    // Don't fail the submission if notification fails
    console.error("Failed to send submission notification:", notifError);
  }

  return {
    ...data,
    proof_run: data.proof_run || {},
  };
}

/**
 * Get a submission by ID
 * Agent-friendly: includes review status for polling
 */
export async function getSubmission(
  submissionId: string,
): Promise<HiringSubmission | null> {
  const { data, error } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (error || !data) {
    return null;
  }

  // Get submitter username
  let submitterUsername: string | undefined;
  if (data.submitter_user_id) {
    const { data: user } = await getSupabase()
      .from("users")
      .select("username")
      .eq("id", data.submitter_user_id)
      .single();
    submitterUsername = user?.username;
  }

  // Get job info if job_id exists
  let jobName: string | undefined;
  let jobSlug: string | undefined;
  let jobOwnerUsername: string | undefined;
  if (data.job_id) {
    const { data: job } = await getSupabase()
      .from("x402_jobs")
      .select("name, slug, user_id")
      .eq("id", data.job_id)
      .single();
    if (job) {
      jobName = job.name;
      jobSlug = job.slug;
      // Get job owner username
      const { data: owner } = await getSupabase()
        .from("users")
        .select("username")
        .eq("id", job.user_id)
        .single();
      jobOwnerUsername = owner?.username;
    }
  }

  // Get review counts
  const { data: reviews } = await getSupabase()
    .from("x402_hiring_reviews")
    .select("decision")
    .eq("submission_id", submissionId);

  const reviewCount = reviews?.length || 0;
  const approvalCount =
    reviews?.filter((r) => r.decision === "approve").length || 0;

  return {
    ...data,
    submitter_username: submitterUsername,
    proof_run: data.proof_run || {},
    review_count: reviewCount,
    approval_count: approvalCount,
    job_name: jobName,
    job_slug: jobSlug,
    job_owner_username: jobOwnerUsername,
  };
}

/**
 * List submissions for a request
 */
export async function listSubmissions(
  requestId: string,
): Promise<HiringSubmission[]> {
  const { data, error } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing submissions:", error);
    throw new Error("Failed to list submissions");
  }

  // Fetch submitter usernames
  const submitterIds = [
    ...new Set(
      (data || [])
        .filter((s: any) => s.submitter_user_id)
        .map((s: any) => s.submitter_user_id),
    ),
  ];
  const usernames: Record<string, string> = {};

  if (submitterIds.length > 0) {
    const { data: users } = await getSupabase()
      .from("users")
      .select("id, username")
      .in("id", submitterIds);

    (users || []).forEach((u: { id: string; username: string }) => {
      if (u.username) usernames[u.id] = u.username;
    });
  }

  // Fetch job info for submissions with job_id
  const jobIds = [
    ...new Set(
      (data || []).filter((s: any) => s.job_id).map((s: any) => s.job_id),
    ),
  ];
  const jobInfo: Record<
    string,
    { name: string; slug: string; owner_username: string }
  > = {};

  if (jobIds.length > 0) {
    const { data: jobs } = await getSupabase()
      .from("x402_jobs")
      .select("id, name, slug, user_id")
      .in("id", jobIds);

    if (jobs && jobs.length > 0) {
      // Get job owner usernames
      const ownerIds = [...new Set(jobs.map((j: any) => j.user_id))];
      const { data: owners } = await getSupabase()
        .from("users")
        .select("id, username")
        .in("id", ownerIds);

      const ownerUsernames: Record<string, string> = {};
      (owners || []).forEach((u: { id: string; username: string }) => {
        if (u.username) ownerUsernames[u.id] = u.username;
      });

      jobs.forEach((j: any) => {
        jobInfo[j.id] = {
          name: j.name,
          slug: j.slug,
          owner_username: ownerUsernames[j.user_id] || "unknown",
        };
      });
    }
  }

  return (data || []).map((row: any) => ({
    ...row,
    submitter_username: row.submitter_user_id
      ? usernames[row.submitter_user_id]
      : undefined,
    proof_run: row.proof_run || {},
    // Add job info if available
    job_name: row.job_id ? jobInfo[row.job_id]?.name : undefined,
    job_slug: row.job_id ? jobInfo[row.job_id]?.slug : undefined,
    job_owner_username: row.job_id
      ? jobInfo[row.job_id]?.owner_username
      : undefined,
  }));
}

/**
 * Withdraw a submission (by submitter)
 */
export async function withdrawSubmission(
  submissionId: string,
  userId: string,
): Promise<HiringSubmission> {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.submitter_user_id !== userId) {
    throw new Error("Only the submitter can withdraw");
  }

  if (
    submission.status !== "submitted" &&
    submission.status !== "needs_changes"
  ) {
    throw new Error("Can only withdraw pending submissions");
  }

  const { data, error } = await getSupabase()
    .from("x402_hiring_submissions")
    .update({
      status: "withdrawn",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to withdraw submission");
  }

  return {
    ...data,
    proof_run: data.proof_run || {},
  };
}

// ============================================================================
// Review Operations
// ============================================================================

/**
 * Get submissions needing review (reviewer queue)
 */
export async function getReviewQueue(
  limit: number = 20,
  offset: number = 0,
): Promise<{ submissions: HiringSubmission[]; total: number }> {
  // First get funded request IDs
  const { data: fundedRequests } = await getSupabase()
    .from("x402_hiring_requests")
    .select("id, title, bounty_amount, approval_quorum")
    .eq("escrow_status", "funded");

  const fundedRequestIds = (fundedRequests || []).map((r: any) => r.id);
  const requestInfo: Record<
    string,
    { title: string; bounty_amount: number; approval_quorum: number }
  > = {};
  (fundedRequests || []).forEach((r: any) => {
    requestInfo[r.id] = {
      title: r.title,
      bounty_amount: parseFloat(r.bounty_amount),
      approval_quorum: r.approval_quorum,
    };
  });

  if (fundedRequestIds.length === 0) {
    return { submissions: [], total: 0 };
  }

  // Get submissions in 'submitted' status for funded requests
  const { data, error, count } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("*", { count: "exact" })
    .eq("status", "submitted")
    .in("request_id", fundedRequestIds)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error getting review queue:", error);
    throw new Error("Failed to get review queue");
  }

  // Fetch submitter usernames
  const submitterIds = [
    ...new Set(
      (data || [])
        .filter((s: any) => s.submitter_user_id)
        .map((s: any) => s.submitter_user_id),
    ),
  ];
  const usernames: Record<string, string> = {};

  if (submitterIds.length > 0) {
    const { data: users } = await getSupabase()
      .from("users")
      .select("id, username")
      .in("id", submitterIds);

    (users || []).forEach((u: { id: string; username: string }) => {
      if (u.username) usernames[u.id] = u.username;
    });
  }

  const submissions = (data || []).map((row: any) => ({
    ...row,
    submitter_username: row.submitter_user_id
      ? usernames[row.submitter_user_id]
      : undefined,
    proof_run: row.proof_run || {},
    request_title: requestInfo[row.request_id]?.title,
    request_bounty: requestInfo[row.request_id]?.bounty_amount || 0,
    approval_quorum: requestInfo[row.request_id]?.approval_quorum,
  }));

  return { submissions, total: count || 0 };
}

/**
 * Submit a review for a submission
 */
export async function createReview(
  submissionId: string,
  reviewerUserId: string,
  decision: ReviewDecision,
  notes?: string,
): Promise<{ review: HiringReview; submissionAccepted: boolean }> {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "submitted") {
    throw new Error("Can only review pending submissions");
  }

  // Get the request to check quorum
  const request = await getRequest(submission.request_id);
  if (!request) {
    throw new Error("Request not found");
  }

  // Don't allow self-review
  if (submission.submitter_user_id === reviewerUserId) {
    throw new Error("Cannot review your own submission");
  }

  // Don't allow creator to review
  if (request.creator_user_id === reviewerUserId) {
    throw new Error("Request creator cannot review submissions");
  }

  // Check if already reviewed
  const { data: existingReview } = await getSupabase()
    .from("x402_hiring_reviews")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("reviewer_user_id", reviewerUserId)
    .single();

  if (existingReview) {
    throw new Error("You have already reviewed this submission");
  }

  // Create the review
  const { data: review, error } = await getSupabase()
    .from("x402_hiring_reviews")
    .insert({
      submission_id: submissionId,
      reviewer_user_id: reviewerUserId,
      decision,
      notes,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating review:", error);
    throw new Error("Failed to create review");
  }

  // Check if quorum is reached
  let submissionAccepted = false;
  if (decision === "approve") {
    const { data: approvals } = await getSupabase()
      .from("x402_hiring_reviews")
      .select("id")
      .eq("submission_id", submissionId)
      .eq("decision", "approve");

    const approvalCount = approvals?.length || 0;

    if (approvalCount >= request.approval_quorum) {
      // Quorum reached - accept the submission
      await acceptSubmission(submissionId, request);
      submissionAccepted = true;
    }
  }

  return { review, submissionAccepted };
}

/**
 * Get reviews for a submission
 */
export async function getReviews(
  submissionId: string,
): Promise<HiringReview[]> {
  const { data, error } = await getSupabase()
    .from("x402_hiring_reviews")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error getting reviews:", error);
    throw new Error("Failed to get reviews");
  }

  // Fetch reviewer usernames
  const reviewerIds = [
    ...new Set((data || []).map((r: any) => r.reviewer_user_id)),
  ];
  const usernames: Record<string, string> = {};

  if (reviewerIds.length > 0) {
    const { data: users } = await getSupabase()
      .from("users")
      .select("id, username")
      .in("id", reviewerIds);

    (users || []).forEach((u: { id: string; username: string }) => {
      if (u.username) usernames[u.id] = u.username;
    });
  }

  return (data || []).map((row: any) => ({
    ...row,
    reviewer_username: usernames[row.reviewer_user_id],
  }));
}

// ============================================================================
// Creator Review (Simplified Flow)
// ============================================================================

/**
 * Creator reviews a submission
 * This is the simplified flow where the request creator directly approves/rejects
 */
export async function creatorReview(
  submissionId: string,
  creatorUserId: string,
  decision: CreatorReviewDecision,
  feedback?: string,
): Promise<{ submission: HiringSubmission; payout?: HiringPayout }> {
  // Get the submission
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  // Get the request
  const request = await getRequest(submission.request_id);
  if (!request) {
    throw new Error("Request not found");
  }

  // Verify caller is the request creator
  if (request.creator_user_id !== creatorUserId) {
    throw new Error("Only the request creator can review submissions");
  }

  // Validate submission status
  if (
    submission.status !== "submitted" &&
    submission.status !== "needs_changes"
  ) {
    throw new Error(
      `Cannot review submission in '${submission.status}' status`,
    );
  }

  // Validate request has funds
  if (decision === "approve" && request.escrow_status !== "funded") {
    throw new Error("Cannot approve submission - request is not funded");
  }

  const now = new Date().toISOString();
  let payout: HiringPayout | undefined;

  switch (decision) {
    case "approve":
      // FIRST: Process the payout (this can fail)
      // Don't update submission status until payout succeeds!
      payout = await acceptSubmissionWithPayout(submissionId, request);

      // Only mark submission as accepted AFTER successful payout
      await getSupabase()
        .from("x402_hiring_submissions")
        .update({
          status: "accepted",
          creator_feedback: feedback,
          reviewed_at: now,
          reviewed_by: creatorUserId,
          updated_at: now,
        })
        .eq("id", submissionId);

      // Notify builder
      if (submission.submitter_user_id) {
        await notificationService.notifySubmissionApproved(
          submission.submitter_user_id,
          request.id,
          request.title,
          request.bounty_amount,
        );
      }

      // Transfer job to creator if there's a job_id
      if (submission.job_id) {
        // Get job name before transfer
        const { data: job } = await getSupabase()
          .from("x402_jobs")
          .select("name")
          .eq("id", submission.job_id)
          .single();

        await transferJobToCreator(submission.job_id, creatorUserId);

        // Notify creator about job transfer
        const jobTitle = job?.name || "Job";
        await notificationService.notifyJobTransferred(
          creatorUserId,
          request.id,
          submission.job_id,
          jobTitle,
        );
      }
      break;

    case "reject":
      // Update submission status
      await getSupabase()
        .from("x402_hiring_submissions")
        .update({
          status: "rejected",
          creator_feedback: feedback,
          reviewed_at: now,
          reviewed_by: creatorUserId,
          updated_at: now,
        })
        .eq("id", submissionId);

      // Notify builder
      if (submission.submitter_user_id) {
        await notificationService.notifySubmissionRejected(
          submission.submitter_user_id,
          request.id,
          request.title,
          feedback,
        );
      }
      break;

    case "request_changes":
      if (!feedback) {
        throw new Error("Feedback is required when requesting changes");
      }

      // Update submission status
      await getSupabase()
        .from("x402_hiring_submissions")
        .update({
          status: "needs_changes",
          creator_feedback: feedback,
          reviewed_at: now,
          reviewed_by: creatorUserId,
          updated_at: now,
        })
        .eq("id", submissionId);

      // Notify builder
      if (submission.submitter_user_id) {
        await notificationService.notifyChangesRequested(
          submission.submitter_user_id,
          request.id,
          request.title,
          feedback,
        );
      }
      break;
  }

  // Get updated submission
  const updatedSubmission = await getSubmission(submissionId);
  return { submission: updatedSubmission!, payout };
}

/**
 * Resubmit after changes requested
 * Allows builder to update their submission after creator requested changes
 */
export async function resubmitAfterChanges(
  submissionId: string,
  userId: string,
  updates: {
    job_json?: unknown;
    proof_run?: ProofRun;
  },
): Promise<HiringSubmission> {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  // Verify owner
  if (submission.submitter_user_id !== userId) {
    throw new Error("Only the submitter can update this submission");
  }

  // Validate status
  if (submission.status !== "needs_changes") {
    throw new Error("Can only resubmit when changes have been requested");
  }

  // Update submission
  const { data, error } = await getSupabase()
    .from("x402_hiring_submissions")
    .update({
      job_json: updates.job_json || submission.job_json,
      proof_run: updates.proof_run || submission.proof_run,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to resubmit");
  }

  // Notify creator
  const request = await getRequest(submission.request_id);
  if (request) {
    let submitterName = "Builder";
    if (userId) {
      const { data: user } = await getSupabase()
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();
      if (user?.username) {
        submitterName = user.username;
      }
    }

    await notificationService.notifySubmissionReceived(
      request.creator_user_id,
      request.id,
      request.title,
      `${submitterName} (revised)`,
    );
  }

  return { ...data, proof_run: data.proof_run || {} };
}

/**
 * Transfer job ownership to the request creator
 */
async function transferJobToCreator(
  jobId: string,
  newOwnerId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("x402_jobs")
    .update({
      user_id: newOwnerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("Failed to transfer job:", error);
    throw new Error("Failed to transfer job to creator");
  }

  console.log(`Job ${jobId} transferred to user ${newOwnerId}`);
}

// ============================================================================
// Acceptance & Payout
// ============================================================================

/**
 * Accept a submission and trigger payout (with return value)
 * Used by creatorReview
 */
async function acceptSubmissionWithPayout(
  submissionId: string,
  request: HiringRequest,
): Promise<HiringPayout> {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  // Get payout address
  let payoutAddress = submission.submitter_wallet_address;
  if (!payoutAddress && submission.submitter_user_id) {
    const { data: wallet } = await getSupabase()
      .from("x402_user_wallets")
      .select("address")
      .eq("user_id", submission.submitter_user_id)
      .single();
    payoutAddress = wallet?.address;
  }

  if (!payoutAddress) {
    throw new Error("No payout address available for submitter");
  }

  // Calculate fees
  const platformFee = request.bounty_amount * PLATFORM_FEE_RATE;
  const payoutAmount = request.bounty_amount - platformFee;

  // FIRST: Release the escrow funds to the builder
  // Don't update status until this succeeds!
  const releaseResult = await releaseEscrowPayout(
    payoutAddress,
    payoutAmount,
    request.id,
  );

  if (!releaseResult.success) {
    console.error("Failed to release escrow:", releaseResult.error);
    throw new Error(`Failed to release escrow: ${releaseResult.error}`);
  }

  // Only update request status AFTER successful escrow release
  await getSupabase()
    .from("x402_hiring_requests")
    .update({
      status: "fulfilled",
      escrow_status: "released",
      payout_tx_hash: releaseResult.transactionHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  // Reject other submissions
  await getSupabase()
    .from("x402_hiring_submissions")
    .update({
      status: "rejected",
      creator_feedback: "Another submission was accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("request_id", request.id)
    .neq("id", submissionId)
    .eq("status", "submitted");

  // Create payout record with completed status and tx hash
  const { data: payout, error: payoutError } = await getSupabase()
    .from("x402_hiring_payouts")
    .insert({
      request_id: request.id,
      submission_id: submissionId,
      amount: payoutAmount,
      platform_fee: platformFee,
      reviewer_pool_fee: 0,
      payout_address: payoutAddress,
      status: "paid",
      tx_hash: releaseResult.transactionHash,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (payoutError) {
    console.error("Failed to create payout record:", payoutError);
    throw new Error("Failed to create payout record");
  }

  // Record in ledger
  await recordEscrowTransaction(request.id, "release", payoutAmount, {
    submissionId,
    payoutId: payout.id,
    description: "Bounty released to builder",
    metadata: { tx_hash: releaseResult.transactionHash },
  });

  // Transfer platform fee to fee collection address
  if (platformFee > 0) {
    console.log(
      `💰 Transferring platform fee: $${platformFee} to ${FEE_COLLECTION_ADDRESS}`,
    );
    const feeResult = await releaseEscrowPayout(
      FEE_COLLECTION_ADDRESS,
      platformFee,
      request.id,
    );

    if (!feeResult.success) {
      // Log but don't fail the payout - builder already got paid
      console.error(
        `⚠️ Failed to transfer platform fee: ${feeResult.error}. Fee remains in escrow.`,
      );
    }

    await recordEscrowTransaction(request.id, "fee", platformFee, {
      description: "Platform fee transferred to fee collection",
      metadata: feeResult.success
        ? { tx_hash: feeResult.transactionHash }
        : { error: feeResult.error },
    });
  }

  return {
    ...payout,
    amount: parseFloat(payout.amount),
    platform_fee: parseFloat(payout.platform_fee),
    reviewer_pool_fee: parseFloat(payout.reviewer_pool_fee),
  };
}

/**
 * Accept a submission and trigger payout
 * Called automatically when quorum is reached, or manually by admin
 */
async function acceptSubmission(
  submissionId: string,
  request: HiringRequest,
): Promise<void> {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  // Get payout address
  const payoutAddress = submission.submitter_wallet_address;
  if (!payoutAddress) {
    // Try to get from user wallet
    if (submission.submitter_user_id) {
      const { data: wallet } = await getSupabase()
        .from("x402_user_wallets")
        .select("address")
        .eq("user_id", submission.submitter_user_id)
        .single();

      if (!wallet?.address) {
        throw new Error("No payout address available for submitter");
      }
    } else {
      throw new Error("No payout address available");
    }
  }

  // Calculate fees
  const platformFee = request.bounty_amount * PLATFORM_FEE_RATE;
  const payoutAmount = request.bounty_amount - platformFee;

  // Start transaction-like updates
  // 1. Update submission status
  await getSupabase()
    .from("x402_hiring_submissions")
    .update({
      status: "accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  // 2. Update request status
  await getSupabase()
    .from("x402_hiring_requests")
    .update({
      status: "fulfilled",
      escrow_status: "released",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  // 3. Reject other submissions
  await getSupabase()
    .from("x402_hiring_submissions")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("request_id", request.id)
    .neq("id", submissionId)
    .eq("status", "submitted");

  // 4. Create payout record
  const { data: payout } = await getSupabase()
    .from("x402_hiring_payouts")
    .insert({
      request_id: request.id,
      submission_id: submissionId,
      amount: payoutAmount,
      platform_fee: platformFee,
      reviewer_pool_fee: 0, // TODO: Phase 2
      payout_address: payoutAddress || "",
      status: "pending",
    })
    .select()
    .single();

  // 5. Execute actual payouts
  if (payoutAddress) {
    // Transfer bounty to builder
    const releaseResult = await releaseEscrowPayout(
      payoutAddress,
      payoutAmount,
      request.id,
    );

    if (releaseResult.success) {
      // Update payout record with tx hash
      await getSupabase()
        .from("x402_hiring_payouts")
        .update({
          status: "paid",
          tx_hash: releaseResult.transactionHash,
          paid_at: new Date().toISOString(),
        })
        .eq("id", payout?.id);

      // Update request status
      await getSupabase()
        .from("x402_hiring_requests")
        .update({
          payout_tx_hash: releaseResult.transactionHash,
        })
        .eq("id", request.id);
    }

    await recordEscrowTransaction(request.id, "release", payoutAmount, {
      submissionId,
      payoutId: payout?.id,
      description: "Bounty released to winner",
      metadata: releaseResult.success
        ? { tx_hash: releaseResult.transactionHash }
        : { error: releaseResult.error },
    });

    // Transfer platform fee to fee collection address
    if (platformFee > 0) {
      console.log(
        `💰 Transferring platform fee: $${platformFee} to ${FEE_COLLECTION_ADDRESS}`,
      );
      const feeResult = await releaseEscrowPayout(
        FEE_COLLECTION_ADDRESS,
        platformFee,
        request.id,
      );

      await recordEscrowTransaction(request.id, "fee", platformFee, {
        submissionId,
        payoutId: payout?.id,
        description: "Platform fee transferred to fee collection",
        metadata: feeResult.success
          ? { tx_hash: feeResult.transactionHash }
          : { error: feeResult.error },
      });
    }

    console.log(
      `[Hiring] Submission ${submissionId} accepted. Payout: $${payoutAmount} to ${payoutAddress}`,
    );
  } else {
    // No payout address - just record in ledger
    await recordEscrowTransaction(request.id, "release", payoutAmount, {
      submissionId,
      payoutId: payout?.id,
      description: "Bounty released to winner (pending address)",
    });

    await recordEscrowTransaction(request.id, "fee", platformFee, {
      submissionId,
      payoutId: payout?.id,
      description: "Platform fee (pending transfer)",
    });

    console.log(
      `[Hiring] Submission ${submissionId} accepted. Payout pending - no wallet address.`,
    );
  }
}

/**
 * Manually accept a submission (admin/creator override)
 */
export async function manuallyAcceptSubmission(
  submissionId: string,
  userId: string,
): Promise<void> {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  const request = await getRequest(submission.request_id);
  if (!request) {
    throw new Error("Request not found");
  }

  // Only creator can manually accept
  if (request.creator_user_id !== userId) {
    throw new Error("Only the request creator can manually accept");
  }

  if (submission.status !== "submitted") {
    throw new Error("Can only accept pending submissions");
  }

  if (request.escrow_status !== "funded") {
    throw new Error("Request must be funded to accept submissions");
  }

  await acceptSubmission(submissionId, request);
}

// ============================================================================
// Escrow Ledger
// ============================================================================

/**
 * Record a transaction in the escrow ledger
 */
async function recordEscrowTransaction(
  requestId: string,
  type: LedgerTransactionType,
  amount: number,
  options: {
    submissionId?: string;
    payoutId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await getSupabase()
    .from("x402_hiring_escrow_ledger")
    .insert({
      request_id: requestId,
      transaction_type: type,
      amount,
      submission_id: options.submissionId,
      payout_id: options.payoutId,
      description: options.description,
      metadata: options.metadata || {},
    });
}

/**
 * Get escrow ledger for a request
 */
export async function getEscrowLedger(requestId: string): Promise<
  Array<{
    id: string;
    transaction_type: LedgerTransactionType;
    amount: number;
    description?: string;
    created_at: string;
  }>
> {
  const { data, error } = await getSupabase()
    .from("x402_hiring_escrow_ledger")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Failed to get escrow ledger");
  }

  return (data || []).map((row) => ({
    ...row,
    amount: parseFloat(row.amount),
  }));
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get hiring board stats
 */
export async function getStats(): Promise<{
  openRequests: number;
  totalBountyPool: number;
  totalPaidOut: number;
  totalSubmissions: number;
}> {
  // Open requests count and total bounty
  const { data: openRequests } = await getSupabase()
    .from("x402_hiring_requests")
    .select("bounty_amount")
    .eq("status", "open")
    .eq("escrow_status", "funded");

  const openCount = openRequests?.length || 0;
  const totalBountyPool = (openRequests || []).reduce(
    (sum, r) => sum + parseFloat(r.bounty_amount),
    0,
  );

  // Total paid out
  const { data: payouts } = await getSupabase()
    .from("x402_hiring_payouts")
    .select("amount")
    .eq("status", "paid");

  const totalPaidOut = (payouts || []).reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0,
  );

  // Total submissions
  const { count: submissionCount } = await getSupabase()
    .from("x402_hiring_submissions")
    .select("*", { count: "exact", head: true });

  return {
    openRequests: openCount,
    totalBountyPool,
    totalPaidOut,
    totalSubmissions: submissionCount || 0,
  };
}
