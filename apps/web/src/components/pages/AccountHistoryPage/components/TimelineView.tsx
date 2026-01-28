"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { Spinner } from "@x402jobs/ui/spinner";
import { Button } from "@x402jobs/ui/button";
import { authenticatedFetcher, authenticatedFetch, API_URL } from "@/lib/api";
import { format } from "date-fns";
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface RefundInfo {
  id: string;
  refund_number: number;
  status: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  resource_name: string;
  resource_url: string;
  status: string;
  cost: number;
  payment_signature: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  run_id: string;
  run_status: string;
  run_total_cost: number;
  run_refund: RefundInfo | null;
  job_id: string;
  job_name: string;
  job_slug: string | null;
}

interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  limit: number;
  offset: number;
}

type StatusFilter = "all" | "completed" | "failed";

interface TimelineViewProps {
  statusFilter: StatusFilter;
}

const PAGE_SIZE = 20;

function formatPrice(amount: number): string {
  if (amount >= 0.01) {
    return `$${amount.toFixed(2)}`;
  }
  const formatted = amount.toFixed(6).replace(/\.?0+$/, "");
  return `$${formatted}`;
}

function getStatusBadge(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "completed" || normalizedStatus === "success") {
    return <Badge variant="success">Success</Badge>;
  }

  if (normalizedStatus === "failed" || normalizedStatus === "error") {
    return <Badge variant="destructive">Failed</Badge>;
  }

  if (normalizedStatus === "running" || normalizedStatus === "pending") {
    return <Badge variant="secondary">Running</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
}

export default function TimelineView({ statusFilter }: TimelineViewProps) {
  const [page, setPage] = useState(0);
  const [processingRunId, setProcessingRunId] = useState<string | null>(null);
  const [localRefunds, setLocalRefunds] = useState<Record<string, RefundInfo>>(
    {},
  );

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const offset = page * PAGE_SIZE;

  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const { data, isLoading, mutate } = useSWR<TimelineResponse>(
    `/runs/events?limit=${PAGE_SIZE}&offset=${offset}${statusParam}`,
    authenticatedFetcher,
  );

  const handleRequestRefund = async (runId: string) => {
    if (processingRunId) return;

    setProcessingRunId(runId);

    try {
      const response = await authenticatedFetch(`${API_URL}/refunds`, {
        method: "POST",
        body: JSON.stringify({ run_id: runId }),
      });

      const result = await response.json();

      if (result.success) {
        setLocalRefunds((prev) => ({
          ...prev,
          [runId]: {
            id: result.refund_id,
            refund_number: result.refund_number,
            status: "pending",
          },
        }));
        mutate();
      }
    } catch (err) {
      console.error("Failed to request refund:", err);
    } finally {
      setProcessingRunId(null);
    }
  };

  const getRefundForRun = (event: TimelineEvent): RefundInfo | null => {
    return localRefunds[event.run_id] || event.run_refund;
  };

  const events = data?.events || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No resource calls yet. Run a job to see your resources here.
      </p>
    );
  }

  // Group events by date for better organization
  const eventsByDate = events.reduce(
    (acc, event) => {
      const date = format(new Date(event.created_at), "MMM d, yyyy");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, TimelineEvent[]>,
  );

  return (
    <div className="space-y-6">
      {Object.entries(eventsByDate).map(([date, dateEvents]) => (
        <div key={date}>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
            {date}
          </h3>
          <div className="space-y-2">
            {dateEvents.map((event) => {
              const refund = getRefundForRun(event);
              const runFailed = event.run_status.toLowerCase() === "failed";
              const canRequestRefund =
                runFailed && !refund && event.run_total_cost > 0;
              const isProcessing = processingRunId === event.run_id;

              return (
                <Card key={event.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(event.created_at), "HH:mm:ss")}
                        </span>
                        {getStatusBadge(event.status)}
                      </div>
                      <div className="font-medium text-sm truncate">
                        {event.resource_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span className="truncate">
                          from{" "}
                          <Link
                            href={`/jobs/${event.job_id}`}
                            className="hover:underline"
                          >
                            {event.job_name}
                          </Link>
                        </span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </div>
                      {event.error && (
                        <div className="text-xs text-destructive mt-1 truncate">
                          {event.error}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {event.cost > 0 && (
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatPrice(event.cost)}
                        </span>
                      )}
                      {event.payment_signature && (
                        <a
                          href={`https://solscan.io/tx/${event.payment_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:underline font-mono"
                        >
                          {event.payment_signature.slice(0, 8)}...
                        </a>
                      )}

                      {/* Refund button for failed runs */}
                      {canRequestRefund && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequestRefund(event.run_id)}
                          disabled={isProcessing}
                          className="mt-1 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800 dark:hover:bg-amber-950"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Request Refund
                            </>
                          )}
                        </Button>
                      )}

                      {/* Refund status */}
                      {refund?.status === "pending" && (
                        <span className="text-xs text-amber-600 mt-1">
                          Refund #{refund.refund_number} pending
                        </span>
                      )}
                      {refund?.status === "approved" && (
                        <span className="text-xs text-emerald-600 mt-1">
                          Refunded
                        </span>
                      )}
                      {refund?.status === "denied" && (
                        <span className="text-xs text-red-600 mt-1">
                          Refund denied
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of{" "}
            {total} resources
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
