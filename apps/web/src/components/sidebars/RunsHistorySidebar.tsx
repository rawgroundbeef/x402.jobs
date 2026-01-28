"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Spinner } from "@x402jobs/ui/spinner";
import {
  X,
  Clock,
  Copy,
  Trash2,
  Play,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { authenticatedFetcher, authenticatedFetch } from "@/lib/api";
import RunCard from "@/components/RunCard";
import { type Run, type RunEvent } from "@/types/runs";

interface RunsHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  jobName?: string;
  onSelectRun?: (run: Run, events: RunEvent[]) => void;
}

export function RunsHistorySidebar({
  isOpen,
  onClose,
  jobId,
  jobName,
  onSelectRun,
}: RunsHistorySidebarProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<RunEvent[]>([]);

  // Fetch runs for job
  const {
    data: runsData,
    isLoading,
    mutate,
  } = useSWR<{ runs: Run[] }>(
    isOpen && jobId ? `/runs?jobId=${jobId}` : null,
    authenticatedFetcher,
    { refreshInterval: 5000 },
  );

  const runs = runsData?.runs || [];

  const handleDeleteRun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this run?")) return;

    setDeletingRunId(runId);
    try {
      const res = await authenticatedFetch(`/runs/${runId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete run");
      }
      mutate();
    } catch (err) {
      console.error("Delete run error:", err);
      alert("Failed to delete run");
    } finally {
      setDeletingRunId(null);
    }
  };

  const handleCopyRunId = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(runId);
    setCopiedRunId(runId);
    setTimeout(() => setCopiedRunId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-background border-l border-border z-50 flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-[53px] flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              Run History
            </h2>
            {jobName && (
              <p className="text-xs text-muted-foreground truncate">
                {jobName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!jobId ? (
            <div className="text-center text-muted-foreground py-8">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Save a job first to see runs</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No runs yet</p>
              <p className="text-xs mt-1">Run the job to see history here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const isExpanded = expandedRunId === run.id;

                return (
                  <RunCard
                    key={run.id}
                    id={run.id}
                    status={run.status}
                    createdAt={run.created_at}
                    totalCost={run.total_cost ?? null}
                    error={run.error}
                    isExpanded={isExpanded}
                    onExpandedChange={(expanded, events) => {
                      setExpandedRunId(expanded ? run.id : null);
                      setExpandedEvents(events);
                    }}
                    footerLeft={
                      <button
                        onClick={(e) => handleCopyRunId(e, run.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Copy run ID"
                      >
                        {copiedRunId === run.id ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{run.id.slice(0, 8)}...</span>
                      </button>
                    }
                    footerRight={
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteRun(e, run.id)}
                          disabled={deletingRunId === run.id}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deletingRunId === run.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                        {onSelectRun && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onSelectRun(run, expandedEvents);
                              onClose();
                            }}
                          >
                            View on Canvas
                          </Button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
