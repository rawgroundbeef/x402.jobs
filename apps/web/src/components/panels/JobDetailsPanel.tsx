"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, formatDistanceToNow } from "date-fns";
import {
  Play,
  Box,
  Zap,
  Calendar,
  Hash,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@x402jobs/ui/badge";
import { Button } from "@x402jobs/ui/button";
import { SlidePanel } from "./SlidePanel";
import { PanelTabs } from "./PanelTabs";
import { authenticatedFetcher } from "@/lib/api";
import { ChainIcon } from "@/components/icons/ChainIcons";
import type { Run } from "@/types/runs";
import type { Job } from "@/hooks/useJobQuery";

interface JobDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  /** Called when user wants to run the job */
  onRun?: () => void;
  /** Called when user selects a run to view details */
  onSelectRun?: (run: Run) => void;
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

function getStatusIcon(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (s === "failed" || s === "error") {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  if (s === "running" || s === "pending") {
    return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null || cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Job details panel with tabs for Details and Runs history (Railway-style).
 */
export function JobDetailsPanel({
  isOpen,
  onClose,
  job,
  onRun,
  onSelectRun,
}: JobDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState("details");

  // Fetch runs for this job
  const { data: runsData, isLoading: runsLoading } = useSWR<{ runs: Run[] }>(
    isOpen && job?.id ? `/runs?jobId=${job.id}` : null,
    authenticatedFetcher,
    { refreshInterval: 5000 },
  );

  const runs = runsData?.runs || [];

  // Count resources from workflow definition
  const resourceCount =
    (
      job?.workflow_definition?.nodes as Array<{ type: string }> | undefined
    )?.filter((n) => n.type === "resource").length || 0;

  const tabs = [
    { id: "details", label: "Details" },
    { id: "runs", label: "Runs", count: runs.length },
  ];

  if (!job) return null;

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={job.name || "Untitled Job"}
      subtitle={
        <span className="flex items-center gap-1.5">
          <ChainIcon network={job.network || "solana"} className="h-3 w-3" />
          <span>
            {job.network === "base" ? "Base" : "Solana"} • {resourceCount}{" "}
            resource{resourceCount !== 1 ? "s" : ""}
          </span>
        </span>
      }
      headerRight={
        onRun && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </Button>
        )
      }
      fullBleed
    >
      {/* Tabs */}
      <PanelTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "details" && (
          <div className="p-4 space-y-6">
            {/* Overview */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="text-xs">Job ID</span>
                  </div>
                  <div className="text-sm font-mono truncate" title={job.id}>
                    {job.display_id || job.id.slice(0, 8)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="text-xs">Network</span>
                  </div>
                  <div className="text-sm flex items-center gap-1.5">
                    <ChainIcon
                      network={job.network || "solana"}
                      className="h-4 w-4"
                    />
                    {job.network === "base" ? "Base" : "Solana"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Box className="h-3.5 w-3.5" />
                    <span className="text-xs">Resources</span>
                  </div>
                  <div className="text-sm">{resourceCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-xs">Trigger</span>
                  </div>
                  <div className="text-sm capitalize">
                    {job.trigger_type || "Manual"}
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Activity
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Created
                  </span>
                  <span>{format(new Date(job.created_at), "MMM d, yyyy")}</span>
                </div>
                {job.last_run_at && (
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Play className="h-3.5 w-3.5" />
                      Last run
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(job.last_run_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                )}
                {job.updated_at && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Updated</span>
                    <span>
                      {formatDistanceToNow(new Date(job.updated_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Slug / Public URL */}
            {job.slug && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Public URL
                </h3>
                <div className="p-3 rounded-lg bg-muted/50">
                  <a
                    href={`/jobs/${job.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    x402.jobs/jobs/{job.slug}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "runs" && (
          <div className="p-4">
            {runsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Play className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No runs yet</p>
                <p className="text-xs mt-1">Run the job to see history here</p>
                {onRun && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRun}
                    className="mt-4 gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun?.(run)}
                    className="w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        <div>
                          <div className="text-sm font-medium">
                            {formatDistanceToNow(new Date(run.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(run.created_at), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {((run.total_payment != null &&
                          run.total_payment > 0) ||
                          (run.total_cost != null && run.total_cost > 0)) && (
                          <span className="text-sm font-mono text-muted-foreground">
                            {formatCost(run.total_payment || run.total_cost)}
                          </span>
                        )}
                        {getStatusBadge(run.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {run.error && (
                      <p className="text-xs text-destructive mt-2 truncate">
                        {run.error}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
