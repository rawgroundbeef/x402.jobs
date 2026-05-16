/**
 * Notifications Service
 * Handles user notifications for the Hiring Board
 */

import { getSupabase } from "../lib/supabase";

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | "submission_received" // Creator receives when builder submits
  | "submission_approved" // Builder receives when creator approves
  | "submission_rejected" // Builder receives when creator rejects
  | "changes_requested" // Builder receives when creator wants changes
  | "job_transferred" // Creator receives when job is transferred
  | "schedule_paused_low_balance" // User receives when scheduled job paused due to low wallet balance
  | "loop_stopped_job_failed" // User receives when a looped job fails
  | "hackathon_winner" // Winner receives when selected as hackathon winner
  | "resource_offline" // Resource owner receives when their resource returns 404
  | "resource_low_success_rate" // Resource owner receives when success rate drops below threshold
  | "refund_requested"; // Admin receives when user requests a refund

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Notification Operations
// ============================================================================

/**
 * Create a new notification
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const { data, error } = await getSupabase()
    .from("x402_notifications")
    .insert({
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    throw new Error("Failed to create notification");
  }

  return data;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  notifications: Notification[];
  total: number;
  unreadCount: number;
}> {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  // Build query
  let query = getSupabase()
    .from("x402_notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error getting notifications:", error);
    throw new Error("Failed to get notifications");
  }

  // Get unread count separately
  const { count: unreadCount } = await getSupabase()
    .from("x402_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return {
    notifications: data || [],
    total: count || 0,
    unreadCount: unreadCount || 0,
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("x402_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<Notification> {
  const { data, error } = await getSupabase()
    .from("x402_notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId) // Security: ensure user owns the notification
    .select()
    .single();

  if (error) {
    console.error("Error marking notification as read:", error);
    throw new Error("Failed to mark notification as read");
  }

  return data;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("x402_notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)
    .select("id");

  if (error) {
    console.error("Error marking all as read:", error);
    throw new Error("Failed to mark all notifications as read");
  }

  return data?.length || 0;
}

/**
 * Delete old read notifications (cleanup)
 */
export async function deleteOldNotifications(
  userId: string,
  olderThanDays: number = 30,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await getSupabase()
    .from("x402_notifications")
    .delete()
    .eq("user_id", userId)
    .eq("read", true)
    .lt("created_at", cutoffDate.toISOString())
    .select("id");

  if (error) {
    console.error("Error deleting old notifications:", error);
    throw new Error("Failed to delete old notifications");
  }

  return data?.length || 0;
}

// ============================================================================
// Notification Helpers (for specific events)
// ============================================================================

/**
 * Notify creator that a submission was received
 */
export async function notifySubmissionReceived(
  creatorUserId: string,
  requestId: string,
  requestTitle: string,
  submitterName: string,
): Promise<Notification> {
  return createNotification({
    user_id: creatorUserId,
    type: "submission_received",
    title: "New submission received",
    message: `${submitterName} submitted a solution for "${requestTitle}"`,
    link: `/bounties/${requestId}`,
    metadata: { request_id: requestId },
  });
}

/**
 * Notify builder that their submission was approved
 */
export async function notifySubmissionApproved(
  builderUserId: string,
  requestId: string,
  requestTitle: string,
  bountyAmount: number,
): Promise<Notification> {
  return createNotification({
    user_id: builderUserId,
    type: "submission_approved",
    title: "Submission approved! 🎉",
    message: `Your submission for "${requestTitle}" was approved. $${bountyAmount.toFixed(2)} has been sent to your wallet.`,
    link: `/bounties/${requestId}`,
    metadata: { request_id: requestId, bounty_amount: bountyAmount },
  });
}

/**
 * Notify builder that their submission was rejected
 */
export async function notifySubmissionRejected(
  builderUserId: string,
  requestId: string,
  requestTitle: string,
  feedback?: string,
): Promise<Notification> {
  return createNotification({
    user_id: builderUserId,
    type: "submission_rejected",
    title: "Submission not accepted",
    message: feedback
      ? `Your submission for "${requestTitle}" was not accepted: ${feedback}`
      : `Your submission for "${requestTitle}" was not accepted.`,
    link: `/bounties/${requestId}`,
    metadata: { request_id: requestId, feedback },
  });
}

/**
 * Notify builder that changes were requested
 */
export async function notifyChangesRequested(
  builderUserId: string,
  requestId: string,
  requestTitle: string,
  feedback: string,
): Promise<Notification> {
  return createNotification({
    user_id: builderUserId,
    type: "changes_requested",
    title: "Changes requested",
    message: `The creator of "${requestTitle}" requested changes: ${feedback}`,
    link: `/bounties/${requestId}`,
    metadata: { request_id: requestId, feedback },
  });
}

/**
 * Notify creator that job was transferred to them
 */
export async function notifyJobTransferred(
  creatorUserId: string,
  requestId: string,
  jobId: string,
  jobTitle: string,
): Promise<Notification> {
  return createNotification({
    user_id: creatorUserId,
    type: "job_transferred",
    title: "Job transferred to you",
    message: `"${jobTitle}" is now yours! You can find it in your dashboard.`,
    link: `/dashboard/jobs/${jobId}`,
    metadata: { request_id: requestId, job_id: jobId },
  });
}

/**
 * Notify user that their scheduled job was paused due to low wallet balance
 */
export async function notifySchedulePausedLowBalance(
  userId: string,
  jobId: string,
  jobName: string,
  currentBalance: number,
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: "schedule_paused_low_balance",
    title: "Scheduled job paused ⚠️",
    message: `Your scheduled job "${jobName}" has been paused because your wallet balance is too low ($${currentBalance.toFixed(2)}). Please add funds to resume.`,
    link: `/jobs/${jobId}`,
    metadata: { job_id: jobId, balance: currentBalance },
  });
}

/**
 * Notify user that their looped job was stopped due to a failure
 */
export async function notifyLoopStoppedJobFailed(
  userId: string,
  jobId: string,
  jobName: string,
  errorMessage?: string,
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: "loop_stopped_job_failed",
    title: "Looped job stopped ⚠️",
    message: errorMessage
      ? `Your looped job "${jobName}" has stopped because it failed: ${errorMessage}`
      : `Your looped job "${jobName}" has stopped because it failed.`,
    link: `/jobs/${jobId}`,
    metadata: { job_id: jobId, error: errorMessage },
  });
}

/**
 * Notify resource owner that their resource is returning 404 and has been marked offline
 */
export async function notifyResourceOffline(
  ownerUserId: string,
  resourceId: string,
  resourceName: string,
  resourceUrl: string,
  serverSlug?: string,
): Promise<Notification> {
  const displayPath = serverSlug
    ? `${serverSlug}/${resourceName}`
    : resourceName;
  return createNotification({
    user_id: ownerUserId,
    type: "resource_offline",
    title: "Resource offline ⚠️",
    message: `Your resource "${displayPath}" is returning 404 and has been hidden from search results. Please fix the endpoint or remove the resource.`,
    link: `/ecosystem/${serverSlug || ""}`,
    metadata: {
      resource_id: resourceId,
      resource_name: resourceName,
      resource_url: resourceUrl,
      server_slug: serverSlug,
    },
  });
}

/**
 * Notify resource owner that their resource has a low success rate
 */
export async function notifyResourceLowSuccessRate(
  ownerUserId: string,
  resourceId: string,
  resourceName: string,
  serverSlug: string | undefined,
  successRate: number,
  successCount: number,
  failureCount: number,
): Promise<Notification> {
  const displayPath = serverSlug
    ? `${serverSlug}/${resourceName}`
    : resourceName;
  const successRatePercent = Math.round(successRate * 100);
  return createNotification({
    user_id: ownerUserId,
    type: "resource_low_success_rate",
    title: "Resource reliability warning ⚠️",
    message: `Your resource "${displayPath}" has a ${successRatePercent}% success rate (${successCount} successes, ${failureCount} failures in the last 30 days). Resources below 70% are hidden from the workflow builder.`,
    link: `/ecosystem/${serverSlug || ""}`,
    metadata: {
      resource_id: resourceId,
      resource_name: resourceName,
      server_slug: serverSlug,
      success_rate: successRate,
      success_count: successCount,
      failure_count: failureCount,
    },
  });
}

/**
 * Notify admin that a refund was requested
 */
export async function notifyRefundRequested(
  adminUserId: string,
  refundId: string,
  refundNumber: number,
  amount: number,
  jobName: string,
  requesterUsername: string,
  reason?: string,
): Promise<Notification> {
  return createNotification({
    user_id: adminUserId,
    type: "refund_requested",
    title: `Refund request #${refundNumber}`,
    message: `${requesterUsername} requested $${amount.toFixed(2)} refund for "${jobName}"${reason ? `: ${reason}` : ""}`,
    link: `/admin/refunds`,
    metadata: {
      refund_id: refundId,
      refund_number: refundNumber,
      amount,
      job_name: jobName,
      requester_username: requesterUsername,
      reason,
    },
  });
}
