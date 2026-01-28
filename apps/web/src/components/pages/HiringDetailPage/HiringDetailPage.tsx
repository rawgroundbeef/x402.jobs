"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { useToast } from "@x402jobs/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import {
  publicFetcher,
  authenticatedFetch,
  authenticatedFetcher,
} from "@/lib/api";
import {
  Briefcase,
  ArrowLeft,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Wallet,
  FileCode,
  ChevronDown,
  ChevronUp,
  User,
  Shield,
  Pencil,
  Trash2,
  Code,
} from "lucide-react";
import BaseLayout from "@/components/BaseLayout";
import { useAuth } from "@/contexts/AuthContext";

type JobInputType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | "object";

interface JobInput {
  name: string;
  type: JobInputType;
  required: boolean;
  description?: string;
}

const INPUT_TYPE_LABELS: Record<JobInputType, string> = {
  string: "Text",
  number: "Number",
  boolean: "Boolean",
  "string[]": "Text Array",
  "number[]": "Number Array",
  object: "Object (JSON)",
};

interface HiringRequest {
  id: string;
  creator_user_id: string;
  title: string;
  description: string;
  requirements: string[];
  tags: string[];
  inputs: JobInput[];
  bounty_amount: number;
  posting_fee_amount: number;
  escrow_status: "none" | "funded" | "released" | "refunded";
  status: "open" | "under_review" | "fulfilled" | "canceled" | "expired";
  desired_deliverable: string;
  approval_quorum: number;
  approval_pool_size: number;
  creator_username?: string;
  submission_count?: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  // Transaction hashes for on-chain proof
  escrow_tx_hash?: string;
  payout_tx_hash?: string;
}

interface Submission {
  id: string;
  submitter_type: "human" | "agent";
  submitter_username?: string;
  status: "submitted" | "needs_changes" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  review_count?: number;
  approval_count?: number;
  job_id?: string;
  job_json?: Record<string, unknown>;
  // Joined job info
  job_name?: string;
  job_slug?: string;
  job_owner_username?: string;
  proof_run?: {
    notes?: string;
    run_logs_url?: string;
    run_output?: unknown;
  };
  creator_feedback?: string;
}

interface Review {
  id: string;
  reviewer_username?: string;
  decision: "approve" | "reject";
  notes?: string;
  created_at: string;
}

const STATUS_CONFIG = {
  open: {
    label: "Open",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: CheckCircle,
  },
  under_review: {
    label: "Under Review",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: CheckCircle,
  },
  canceled: {
    label: "Canceled",
    className: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: Clock,
  },
};

const SUBMISSION_STATUS = {
  submitted: {
    label: "Pending Review",
    className: "bg-amber-500/10 text-amber-500",
  },
  needs_changes: {
    label: "Needs Changes",
    className: "bg-orange-500/10 text-orange-500",
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-500/10 text-emerald-500",
  },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-500" },
  withdrawn: { label: "Withdrawn", className: "bg-gray-500/10 text-gray-500" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface HiringDetailPageProps {
  id: string;
}

interface UserJob {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  trigger_type?: string;
  trigger_methods?: { webhook?: boolean };
}

export default function HiringDetailPage({ id }: HiringDetailPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(
    null,
  );

  // Fetch user's jobs for the submission dropdown
  const { data: userJobsData, isLoading: isLoadingJobs } = useSWR<{
    jobs: UserJob[];
  }>(showSubmitForm && user ? "/jobs" : null, authenticatedFetcher);
  // Only show jobs with webhook enabled (required for testing)
  const userJobs = (userJobsData?.jobs || []).filter(
    (job) => job.trigger_methods?.webhook || job.trigger_type === "webhook",
  );

  const { data, isLoading, error } = useSWR<{
    request: HiringRequest;
    submissions: Submission[];
  }>(`/bounties/requests/${id}`, publicFetcher);

  const request = data?.request;
  const submissions = data?.submissions || [];

  const isCreator = user?.id === request?.creator_user_id;
  const canSubmit =
    !!user &&
    request?.status === "open" &&
    request?.escrow_status === "funded" &&
    !isCreator;
  const canFund =
    isCreator &&
    request?.escrow_status === "none" &&
    request?.status === "open";
  const canEdit =
    isCreator &&
    request?.escrow_status === "none" &&
    request?.status === "open";
  const canDelete =
    isCreator &&
    request?.escrow_status === "none" &&
    request?.status === "open" &&
    submissions.length === 0;

  const handleFund = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to fund this request",
        variant: "destructive",
      });
      return;
    }

    setIsFunding(true);
    try {
      const response = await authenticatedFetch(
        `/bounties/requests/${id}/fund`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fund request");
      }

      toast({
        title: "Request funded!",
        description:
          "Your bounty is now in escrow. Builders can start submitting.",
        variant: "success",
      });

      mutate(`/bounties/requests/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fund request",
        variant: "destructive",
      });
    } finally {
      setIsFunding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to submit a solution",
        variant: "destructive",
      });
      return;
    }

    if (!selectedJobId) {
      toast({
        title: "Job required",
        description: "Please select a job to submit",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authenticatedFetch(
        `/bounties/requests/${id}/submissions`,
        {
          method: "POST",
          body: JSON.stringify({
            job_id: selectedJobId,
            proof_run: proofNotes ? { notes: proofNotes } : undefined,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit");
      }

      toast({
        title: "Submission created!",
        description: "Your job has been submitted for review.",
        variant: "success",
      });

      setShowSubmitForm(false);
      setSelectedJobId("");
      setProofNotes("");
      mutate(`/bounties/requests/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await authenticatedFetch(`/bounties/requests/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }

      toast({
        title: "Request deleted",
        description: "Your job request has been deleted.",
      });

      // Redirect to list page
      window.location.href = "/bounties";
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete request",
        variant: "destructive",
      });
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </BaseLayout>
    );
  }

  if (error || !request) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">Request not found</p>
          <Button as={Link} href="/bounties" variant="outline" className="mt-4">
            Back to Bounties
          </Button>
        </div>
      </BaseLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <Button as={Link} href="/bounties" variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Bounties
        </Button>
        {/* Creator Edit/Delete */}
        {isCreator && canEdit && (
          <div className="flex items-center gap-2">
            <Button
              as={Link}
              href={`/bounties/${id}/edit`}
              variant="outline"
              size="sm"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:text-red-600 hover:border-red-500"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                {request.creator_username && (
                  <span className="text-sm text-muted-foreground">
                    by @{request.creator_username}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 text-xs rounded-full border ${statusConfig.className}`}
                >
                  <StatusIcon className="w-3 h-3 inline mr-1" />
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-500">
              {formatCurrency(request.bounty_amount)}
            </p>
            <p className="text-sm text-muted-foreground">
              {request.escrow_status === "released" &&
              request.payout_tx_hash ? (
                <span className="text-green-500 font-medium">
                  PAID{" "}
                  <a
                    href={`https://solscan.io/tx/${request.payout_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    ↗
                  </a>
                </span>
              ) : request.escrow_status === "funded" ? (
                <span>
                  In escrow
                  {request.escrow_tx_hash && (
                    <>
                      {" "}
                      <a
                        href={`https://solscan.io/tx/${request.escrow_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        ↗
                      </a>
                    </>
                  )}
                </span>
              ) : (
                "Not funded"
              )}
            </p>
          </div>
        </div>

        {/* Tags */}
        {request.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {request.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-muted rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Creator Actions - Fund */}
      {isCreator && canFund && (
        <Card className="p-4 mb-6 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Fund your request to start receiving submissions
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The bounty will be held in escrow until a submission is accepted
              </p>
            </div>
            <Button variant="primary" onClick={handleFund} disabled={isFunding}>
              {isFunding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Funding...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Fund {formatCurrency(request.bounty_amount)}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Job Request?</h3>
            <p className="text-muted-foreground mb-4">
              This action cannot be undone. Are you sure you want to delete this
              job request?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3">Description</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{request.description}</p>
            </div>
          </Card>

          {/* Requirements */}
          {request.requirements.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-3">Requirements</h2>
              <ul className="space-y-2">
                {request.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Input Parameters */}
          {request.inputs && request.inputs.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Code className="w-5 h-5 text-muted-foreground" />
                Input Parameters
              </h2>
              <div className="space-y-3">
                {request.inputs.map((input, index) => (
                  <div
                    key={index}
                    className="p-3 border border-border rounded-lg bg-muted/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="font-mono text-sm font-medium text-primary">
                        {input.name}
                      </code>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                        {INPUT_TYPE_LABELS[input.type]}
                      </span>
                      {input.required ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500">
                          Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/10 text-gray-500">
                          Optional
                        </span>
                      )}
                    </div>
                    {input.description && (
                      <p className="text-sm text-muted-foreground">
                        {input.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Submissions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Submissions ({submissions.length})
              </h2>
              {canSubmit && !showSubmitForm && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowSubmitForm(true)}
                >
                  <Send className="w-4 h-4" />
                  Submit Solution
                </Button>
              )}
            </div>

            {/* Submit Form */}
            {showSubmitForm && (
              <form
                onSubmit={handleSubmit}
                className="mb-4 p-4 bg-muted/50 rounded-lg"
              >
                <h3 className="font-medium mb-2">Submit Your Job</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Select Job <span className="text-red-500">*</span>
                    </label>
                    {isLoadingJobs ? (
                      <div className="p-4 border border-border rounded-lg text-center text-muted-foreground">
                        <div className="w-8 h-8 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Loading your jobs...</p>
                      </div>
                    ) : userJobs.length === 0 ? (
                      <div className="p-4 border border-border rounded-lg text-center text-muted-foreground">
                        <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          No webhook-enabled jobs found.
                        </p>
                        <p className="text-xs mt-1">
                          Jobs must have webhook enabled so the requester can
                          test them.
                        </p>
                        <Link
                          href="/create"
                          className="text-primary hover:underline text-sm mt-2 inline-block"
                        >
                          Create a job with webhook →
                        </Link>
                      </div>
                    ) : (
                      <select
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                      >
                        <option value="">Select a job...</option>
                        {userJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.name} {!job.is_active && "(inactive)"}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      The requester will be able to run and test your job before
                      approving
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Notes{" "}
                      <span className="text-muted-foreground text-sm">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      className="w-full min-h-[60px] p-2 rounded-lg border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Explain your approach, link to test runs, etc."
                      value={proofNotes}
                      onChange={(e) => setProofNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSubmitForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting || !selectedJobId}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Job"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Submission List */}
            {submissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No submissions yet</p>
                {request.escrow_status !== "funded" && (
                  <p className="text-sm mt-1">
                    Request must be funded to receive submissions
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => {
                  const submissionStatus = SUBMISSION_STATUS[submission.status];
                  const isExpanded = expandedSubmission === submission.id;

                  return (
                    <div
                      key={submission.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedSubmission(
                            isExpanded ? null : submission.id,
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {submission.submitter_type === "agent" ? (
                              <Shield className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {submission.submitter_username || "Anonymous"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(submission.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${submissionStatus.className}`}
                          >
                            {submissionStatus.label}
                          </span>
                          {submission.approval_count !== undefined && (
                            <span className="text-sm text-muted-foreground">
                              {submission.approval_count}/
                              {request.approval_quorum} approvals
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <SubmissionDetails
                          submissionId={submission.id}
                          requestId={id}
                          isCreator={isCreator}
                          submissionStatus={submission.status}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Bounty</dt>
                <dd className="font-medium">
                  {formatCurrency(request.bounty_amount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Escrow</dt>
                <dd className="font-medium capitalize">
                  {request.escrow_status === "released" ? (
                    <span className="text-green-500">
                      Released
                      {request.payout_tx_hash && (
                        <a
                          href={`https://solscan.io/tx/${request.payout_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-primary hover:underline"
                        >
                          ↗
                        </a>
                      )}
                    </span>
                  ) : request.escrow_status === "funded" ? (
                    <span>
                      Funded
                      {request.escrow_tx_hash && (
                        <a
                          href={`https://solscan.io/tx/${request.escrow_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-primary hover:underline"
                        >
                          ↗
                        </a>
                      )}
                    </span>
                  ) : (
                    request.escrow_status
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Submissions</dt>
                <dd className="font-medium">{submissions.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">
                  {formatDate(request.created_at)}
                </dd>
              </div>
              {request.expires_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Expires</dt>
                  <dd className="font-medium">
                    {formatDate(request.expires_at)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* API Info for Agents */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">API for Agents</h3>
            <p className="text-sm text-muted-foreground">
              Coming soon: Agents will be able to submit solutions
              programmatically.
            </p>
          </Card>
        </div>
      </div>
    </BaseLayout>
  );
}

// Submission Details Component
function SubmissionDetails({
  submissionId,
  requestId,
  isCreator,
  submissionStatus,
}: {
  submissionId: string;
  requestId: string;
  isCreator: boolean;
  submissionStatus: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<
    "approve" | "reject" | null
  >(null);

  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitNotes, setResubmitNotes] = useState("");

  const { data, mutate: mutateSubmission } = useSWR<{
    submission: {
      id: string;
      submitter_user_id?: string;
      job_id?: string;
      job_json?: Record<string, unknown>;
      job_name?: string;
      job_slug?: string;
      job_owner_username?: string;
      proof_run?: { notes?: string };
      creator_feedback?: string;
    };
    reviews: Review[];
  }>(`/bounties/submissions/${submissionId}`, publicFetcher);

  const submission = data?.submission;
  const reviews = data?.reviews || [];
  const isSubmitter = user?.id === submission?.submitter_user_id;
  const canResubmit = isSubmitter && submissionStatus === "needs_changes";

  // Creator review handler (simplified flow)
  const handleCreatorReview = async (
    decision: "approve" | "reject" | "request_changes",
  ) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to review",
        variant: "destructive",
      });
      return;
    }

    if (decision !== "approve" && !feedback.trim()) {
      toast({
        title: "Feedback required",
        description:
          "Please provide feedback when rejecting or requesting changes",
        variant: "destructive",
      });
      return;
    }

    setIsReviewing(true);
    try {
      const response = await authenticatedFetch(
        `/bounties/submissions/${submissionId}/creator-review`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            feedback: feedback.trim() || undefined,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit review");
      }

      const result = await response.json();

      toast({
        title:
          decision === "approve"
            ? "Submission approved! 🎉"
            : decision === "reject"
              ? "Submission rejected"
              : "Changes requested",
        description: result.message,
        variant: decision === "approve" ? "success" : "default",
      });

      mutate(`/bounties/submissions/${submissionId}`);
      mutate(`/bounties/requests/${requestId}`);
      setFeedback("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const canCreatorReview =
    isCreator &&
    (submissionStatus === "submitted" || submissionStatus === "needs_changes");

  return (
    <div className="border-t border-border p-4 bg-muted/30">
      {/* Submitted Job */}
      {submission?.job_id &&
      submission?.job_slug &&
      submission?.job_owner_username ? (
        <div
          className={
            submission?.proof_run?.notes || canCreatorReview ? "mb-4" : ""
          }
        >
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Submitted Job
          </h4>
          <div className="bg-background p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{submission.job_name || "Job"}</p>
                <p className="text-sm text-muted-foreground">
                  by @{submission.job_owner_username}
                </p>
              </div>
              <Link
                href={`/user/${submission.job_owner_username}/${submission.job_slug}`}
                target="_blank"
              >
                <Button variant="outline" size="sm">
                  <Briefcase className="w-4 h-4 mr-1" />
                  View & Test Job
                </Button>
              </Link>
            </div>
            {isCreator && (
              <p className="text-xs text-muted-foreground mt-2">
                Run this job to test it before approving. You&apos;ll pay the
                normal job fee.
              </p>
            )}
          </div>
        </div>
      ) : submission?.job_json ? (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Job Definition (Legacy)
          </h4>
          <pre className="text-xs bg-background p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(submission.job_json, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Proof Notes */}
      {submission?.proof_run?.notes && (
        <div className={canCreatorReview ? "mb-4" : ""}>
          <h4 className="text-sm font-medium mb-2">Submitter Notes</h4>
          <p className="text-sm text-muted-foreground bg-background p-3 rounded">
            {submission.proof_run.notes}
          </p>
        </div>
      )}

      {/* Previous Creator Feedback (if changes were requested) */}
      {submission?.creator_feedback && submissionStatus === "needs_changes" && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <h4 className="text-sm font-medium mb-1 text-amber-600 dark:text-amber-400">
            Changes Requested
          </h4>
          <p className="text-sm text-muted-foreground">
            {submission.creator_feedback}
          </p>
        </div>
      )}

      {/* Resubmit Form (for builder when changes requested) */}
      {canResubmit && (
        <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
          <h4 className="text-sm font-medium mb-2">Resubmit with Changes</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Update your notes to address the requested changes, then resubmit.
          </p>
          <textarea
            className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            placeholder="Describe the changes you made..."
            value={resubmitNotes}
            onChange={(e) => setResubmitNotes(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isResubmitting || !resubmitNotes.trim()}
            onClick={async () => {
              setIsResubmitting(true);
              try {
                const response = await authenticatedFetch(
                  `/bounties/submissions/${submissionId}/resubmit`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      proof_run: { notes: resubmitNotes },
                    }),
                  },
                );
                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.error || "Failed to resubmit");
                }
                toast({
                  title: "Resubmitted!",
                  description:
                    "Your updated submission has been sent for review.",
                  variant: "success",
                });
                setResubmitNotes("");
                mutateSubmission();
                mutate(`/bounties/requests/${requestId}`);
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: error.message || "Failed to resubmit",
                  variant: "destructive",
                });
              } finally {
                setIsResubmitting(false);
              }
            }}
          >
            {isResubmitting ? "Resubmitting..." : "Resubmit"}
          </Button>
        </div>
      )}

      {/* Reviews (third-party) */}
      {reviews.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">
            Reviews ({reviews.length})
          </h4>
          <div className="space-y-2">
            {reviews.map((review) => (
              <div key={review.id} className="flex items-start gap-2 text-sm">
                {review.decision === "approve" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                )}
                <div>
                  <span className="font-medium">
                    {review.reviewer_username || "Anonymous"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    {review.decision}d
                  </span>
                  {review.notes && (
                    <p className="text-muted-foreground mt-0.5">
                      {review.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creator Review Form (Simplified Flow) */}
      {canCreatorReview && (
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Review Submission
          </h4>
          <textarea
            className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            placeholder="Feedback for the builder (required for reject/request changes)..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialog("reject")}
              disabled={isReviewing}
              className="bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreatorReview("request_changes")}
              disabled={isReviewing}
              className="text-amber-600 hover:text-amber-700 hover:border-amber-500"
            >
              <AlertCircle className="w-4 h-4" />
              Request Changes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmDialog("approve")}
              disabled={isReviewing}
            >
              <CheckCircle className="w-4 h-4" />
              Approve & Pay
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Approving will release the bounty to the builder and transfer the
            job to you.
          </p>
        </div>
      )}

      {/* Confirm Dialogs */}
      <Dialog
        open={confirmDialog === "approve"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Pay</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this submission? This will
              release the bounty to the builder and transfer the job to you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmDialog(null);
                handleCreatorReview("approve");
              }}
              disabled={isReviewing}
            >
              {isReviewing ? "Processing..." : "Yes, Approve & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDialog === "reject"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this submission? The builder will
              be notified with your feedback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                setConfirmDialog(null);
                handleCreatorReview("reject");
              }}
              disabled={isReviewing}
            >
              {isReviewing ? "Processing..." : "Yes, Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
