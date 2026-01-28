"use client";

// TODO: Backend needs to return storage_cost in run data for receipt display
// For now, storage cost line item will only show if backend provides it

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, formatDistanceToNow } from "date-fns";
import { useWebSocket, RunStepEvent } from "@/hooks/useWebSocket";
import {
  Copy,
  Check,
  Play,
  Trash2,
  Clock,
  DollarSign,
  Hash,
  Loader2,
  Box,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@x402jobs/ui/badge";
import { Button } from "@x402jobs/ui/button";
import { SlidePanel } from "./SlidePanel";
import { PanelTabs } from "./PanelTabs";
import { LogViewer } from "./LogViewer";
import { authenticatedFetcher, authenticatedFetch } from "@/lib/api";
import type { Run, RunEvent } from "@/types/runs";

interface RunDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** The run to display */
  run: Run | null;
  /** Job name for context */
  jobName?: string;
  /** Called when user wants to re-run (run the job again) */
  onReRun?: () => void;
  /** Called when user wants to view this run on the canvas */
  onViewOnCanvas?: (run: Run, events: RunEvent[]) => void;
  /** Called when the run is deleted */
  onDelete?: () => void;
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "success") {
    return <Badge variant="success">Success</Badge>;
  }
  if (s === "failed" || s === "error") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (s === "running" || s === "pending") {
    return <Badge variant="secondary">Running</Badge>;
  }
  if (s === "cancelled") {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null || cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt || !completedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface RunDetailsResponse {
  run: Run & { events: RunEvent[] };
}

/**
 * Run details panel with tabs for Details and Logs (Railway-style).
 * Can be stacked on top of JobDetailsPanel.
 */
export function RunDetailsPanel({
  isOpen,
  onClose,
  run,
  jobName,
  onReRun,
  onViewOnCanvas,
  onDelete,
}: RunDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequestingRefund, setIsRequestingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Fetch run details with events
  const { data, isLoading, mutate } = useSWR<RunDetailsResponse>(
    isOpen && run?.id ? `/runs/${run.id}` : null,
    authenticatedFetcher,
    { refreshInterval: run?.status === "running" ? 2000 : 0 },
  );

  // Subscribe to WebSocket events to update logs in real-time
  const { subscribe, isAvailable: wsAvailable } = useWebSocket();

  useEffect(() => {
    if (!wsAvailable || !isOpen || !run?.id) return;

    // Listen for run:step events to refetch logs (e.g., x402.storage updates)
    const unsubscribe = subscribe<RunStepEvent>("run:step", (event) => {
      if (event.runId === run.id) {
        // Refetch run details to get updated events
        mutate();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [wsAvailable, isOpen, run?.id, subscribe, mutate]);

  // Check refund eligibility for failed runs
  const { data: refundStatus, mutate: mutateRefundStatus } = useSWR<{
    eligible: boolean;
    reason?: string;
    amount?: number;
    refund?: { refund_number: number; status: string };
  }>(
    isOpen && run?.id && run?.status === "failed"
      ? `/refunds/${run.id}/status`
      : null,
    authenticatedFetcher,
  );

  const events = data?.run?.events || [];
  const runData = data?.run || run;

  // Check if this run used x402.storage (backend will provide actual cost)
  const hasStorageCost =
    runData?.storage_cost != null && runData.storage_cost > 0;
  const storageCost = runData?.storage_cost || 0;

  const handleCopyId = () => {
    if (!run) return;
    navigator.clipboard.writeText(run.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!run || !window.confirm("Are you sure you want to delete this run?"))
      return;

    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(`/runs/${run.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete run");
      onDelete?.();
      onClose();
    } catch (err) {
      console.error("Delete run error:", err);
      alert("Failed to delete run");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!run) return;

    setIsRequestingRefund(true);
    setRefundError(null);

    try {
      const res = await authenticatedFetch("/refunds", {
        method: "POST",
        body: JSON.stringify({
          run_id: run.id,
          reason: "Job failed",
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setRefundError(result.error || "Failed to request refund");
        return;
      }

      // Refresh refund status
      mutateRefundStatus();
    } catch (err) {
      console.error("Request refund error:", err);
      setRefundError("Failed to request refund");
    } finally {
      setIsRequestingRefund(false);
    }
  };

  const tabs = [
    { id: "details", label: "Details" },
    { id: "logs", label: "Logs", count: events.length },
  ];

  if (!run) return null;

  const successCount = events.filter(
    (e) => e.status?.toLowerCase() === "completed",
  ).length;
  const failedCount = events.filter(
    (e) => e.status?.toLowerCase() === "failed",
  ).length;

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={jobName || "Run Details"}
      subtitle={
        <span className="flex items-center gap-2">
          <span>
            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
          </span>
          {runData?.status && getStatusBadge(runData.status)}
        </span>
      }
      headerRight={
        onViewOnCanvas && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewOnCanvas(run, events)}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            View on Canvas
          </Button>
        )
      }
      fullBleed
      stackLevel={1}
    >
      {/* Tabs */}
      <PanelTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "details" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Error banner */}
            {runData?.error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Run failed
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">
                    {runData.error}
                  </p>
                </div>
              </div>
            )}

            {/* Overview */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="text-xs">Run ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono truncate" title={run.id}>
                      {run.id.slice(0, 8)}...
                    </span>
                    <button
                      onClick={handleCopyId}
                      className="p-1 rounded hover:bg-accent text-muted-foreground"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {runData?.total_payment ? "Total Payment" : "Total Cost"}
                    </span>
                  </div>
                  <div className="text-sm font-mono">
                    {formatCost(runData?.total_payment || runData?.total_cost)}
                  </div>
                  {/* Fee breakdown for x402 payments */}
                  {runData?.total_payment &&
                    runData?.creator_markup_earned != null && (
                      <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 mt-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Base fee</span>
                          <span>{formatCost(runData.total_cost)}</span>
                        </div>
                        {/* Storage line item - show when storage was used */}
                        {hasStorageCost && (
                          <div className="flex justify-between">
                            <span>x402.storage</span>
                            <span>{formatCost(storageCost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Creator markup</span>
                          <span>
                            {formatCost(runData.creator_markup_earned)}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <div className="text-sm">
                    {formatDuration(runData?.started_at, runData?.completed_at)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Box className="h-3.5 w-3.5" />
                    <span className="text-xs">Steps</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {successCount}
                        </span>
                        {failedCount > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5" />
                            {failedCount}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Created</span>
                  <span>
                    {format(new Date(run.created_at), "MMM d, yyyy HH:mm:ss")}
                  </span>
                </div>
                {runData?.started_at && (
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Started</span>
                    <span>
                      {format(
                        new Date(runData.started_at),
                        "MMM d, yyyy HH:mm:ss",
                      )}
                    </span>
                  </div>
                )}
                {runData?.completed_at && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Completed</span>
                    <span>
                      {format(
                        new Date(runData.completed_at),
                        "MMM d, yyyy HH:mm:ss",
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info (for x402 webhook runs) */}
            {runData?.payment_signature &&
              runData.payment_signature !== "facilitator-settled" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Payment
                  </h3>
                  <div className="space-y-2 text-sm">
                    {runData.payer_address && (
                      <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Payer</span>
                        <span
                          className="font-mono text-xs truncate max-w-[180px]"
                          title={runData.payer_address}
                        >
                          {runData.payer_address.slice(0, 8)}...
                          {runData.payer_address.slice(-6)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Transaction</span>
                      <a
                        href={`https://solscan.io/tx/${runData.payment_signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <span className="font-mono text-xs">
                          {runData.payment_signature.slice(0, 8)}...
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

            {/* Refund section for failed runs */}
            {runData?.status === "failed" && refundStatus && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Refund
                </h3>
                {refundStatus.refund ? (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        Refund #{refundStatus.refund.refund_number}
                      </span>
                      <Badge
                        variant={
                          refundStatus.refund.status === "approved"
                            ? "success"
                            : refundStatus.refund.status === "denied"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {refundStatus.refund.status}
                      </Badge>
                    </div>
                  </div>
                ) : refundStatus.eligible ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      You can request a refund of{" "}
                      <span className="font-mono font-medium text-foreground">
                        ${refundStatus.amount?.toFixed(2)}
                      </span>{" "}
                      for this failed run.
                    </p>
                    {refundError && (
                      <p className="text-sm text-destructive">{refundError}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestRefund}
                      disabled={isRequestingRefund}
                      className="gap-1.5"
                    >
                      {isRequestingRefund ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Request Refund
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {refundStatus.reason === "no_cost"
                      ? "No refundable amount for this run."
                      : "Not eligible for refund."}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </h3>
              <div className="flex flex-wrap gap-2">
                {onReRun && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReRun}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Again
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete Run
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <LogViewer events={events} isLoading={isLoading} />
        )}
      </div>
    </SlidePanel>
  );
}
