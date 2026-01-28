"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Spinner } from "@x402jobs/ui/spinner";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { authenticatedFetcher, authenticatedFetch, API_URL } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Check, X, Clock } from "lucide-react";

interface User {
  id: string;
  email?: string;
  username?: string;
  display_name?: string;
  wallet_address?: string;
}

interface Job {
  id: string;
  name: string;
  slug?: string;
}

interface Run {
  id: string;
  status: string;
  total_cost: string;
  error?: string;
}

interface Refund {
  id: string;
  refund_number: number;
  amount: string;
  reason?: string;
  status: string;
  admin_notes?: string;
  created_at: string;
  resolved_at?: string;
  payout_signature?: string;
  user: User;
  job: Job | null;
  run: Run | null;
}

interface RefundsResponse {
  refunds: Refund[];
  total: number;
  counts: {
    pending: number;
    approved: number;
    denied: number;
  };
}

type StatusFilter = "all" | "pending" | "approved" | "denied";

export default function AdminRefundsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const {
    data,
    isLoading,
    error: fetchError,
    mutate,
  } = useSWR<RefundsResponse>(
    `/refunds/admin${queryParams}`,
    authenticatedFetcher,
  );

  const handleApprove = async (refund: Refund) => {
    if (processingId) return;
    setProcessingId(refund.id);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/refunds/admin/${refund.id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ admin_notes: adminNotes[refund.id] || null }),
        },
      );

      const result = await response.json();

      if (result.success) {
        mutate();
      } else {
        setError(result.error || "Failed to approve refund");
      }
    } catch (err) {
      setError("Failed to approve refund");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (refund: Refund) => {
    if (processingId) return;

    const notes = adminNotes[refund.id];
    if (!notes?.trim()) {
      setError("Please provide a reason for denying the refund");
      return;
    }

    setProcessingId(refund.id);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/refunds/admin/${refund.id}/deny`,
        {
          method: "POST",
          body: JSON.stringify({ admin_notes: notes }),
        },
      );

      const result = await response.json();

      if (result.success) {
        mutate();
      } else {
        setError(result.error || "Failed to deny refund");
      }
    } catch (err) {
      setError("Failed to deny refund");
    } finally {
      setProcessingId(null);
    }
  };

  if (fetchError) {
    notFound();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Refund Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and process refund requests from users.
        </p>
      </header>

      {/* Stats */}
      {data?.counts && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-semibold mt-1">
              {data.counts.pending}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <div className="text-2xl font-semibold mt-1">
              {data.counts.approved}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Denied</span>
            </div>
            <div className="text-2xl font-semibold mt-1">
              {data.counts.denied}
            </div>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        {(["pending", "approved", "denied", "all"] as StatusFilter[]).map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "primary" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ),
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !data?.refunds?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          No {statusFilter !== "all" ? statusFilter : ""} refund requests.
        </div>
      ) : (
        <div className="space-y-4">
          {data.refunds.map((refund) => (
            <Card key={refund.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono font-semibold">
                      #{refund.refund_number}
                    </span>
                    <Badge
                      variant={
                        refund.status === "pending"
                          ? "secondary"
                          : refund.status === "approved"
                            ? "success"
                            : "destructive"
                      }
                    >
                      {refund.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(refund.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="text-lg font-semibold mb-2">
                    ${parseFloat(refund.amount).toFixed(2)}
                  </div>

                  {/* User info */}
                  <div className="text-sm text-muted-foreground mb-2">
                    <strong>User:</strong>{" "}
                    {refund.user.username ||
                      refund.user.email ||
                      refund.user.id}
                    {refund.user.wallet_address && (
                      <span className="ml-2 font-mono text-xs">
                        ({refund.user.wallet_address.slice(0, 8)}...)
                      </span>
                    )}
                  </div>

                  {/* Job info */}
                  <div className="text-sm text-muted-foreground mb-2">
                    <strong>Job:</strong> {refund.job?.name || "Unknown"}
                    {refund.run?.error && (
                      <span className="ml-2 text-destructive">
                        Error: {refund.run.error.slice(0, 100)}
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  {refund.reason && (
                    <div className="text-sm mb-2">
                      <strong>Reason:</strong> {refund.reason}
                    </div>
                  )}

                  {/* Admin notes (if resolved) */}
                  {refund.admin_notes && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Admin notes:</strong> {refund.admin_notes}
                    </div>
                  )}

                  {/* Payout signature */}
                  {refund.payout_signature && (
                    <div className="text-xs font-mono text-muted-foreground mt-2">
                      TX: {refund.payout_signature.slice(0, 20)}...
                    </div>
                  )}
                </div>

                {/* Actions */}
                {refund.status === "pending" && (
                  <div className="flex flex-col gap-2 w-64">
                    <textarea
                      placeholder="Admin notes (required for deny)"
                      value={adminNotes[refund.id] || ""}
                      onChange={(e) =>
                        setAdminNotes((prev) => ({
                          ...prev,
                          [refund.id]: e.target.value,
                        }))
                      }
                      className="w-full p-2 text-sm border border-border rounded-lg bg-background resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleApprove(refund)}
                        disabled={processingId === refund.id}
                      >
                        {processingId === refund.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeny(refund)}
                        disabled={processingId === refund.id}
                      >
                        {processingId === refund.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            Deny
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
