"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@x402jobs/ui/utils";
import type { Run } from "@/types/runs";

interface ActivityDrawerProps {
  runs: Run[];
  currentRunId?: string | null;
  isRunning?: boolean;
  onSelectRun?: (run: Run) => void;
  className?: string;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
    case "pending":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ActivityDrawer({
  runs,
  currentRunId,
  isRunning,
  onSelectRun,
  className,
}: ActivityDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Track if user manually closed - don't auto-open again during this session
  const userClosedRef = useRef(false);
  // Track the run that triggered auto-open to avoid re-opening on chained runs
  const autoOpenedForRunRef = useRef<string | null>(null);

  // Auto-expand only when a NEW run session starts (not chained runs)
  useEffect(() => {
    if (isRunning && currentRunId) {
      // Only auto-open if:
      // 1. User hasn't manually closed the drawer
      // 2. This is a new run session (not just switching to a chained run)
      const isNewSession = !autoOpenedForRunRef.current;
      if (!userClosedRef.current && isNewSession) {
        setIsExpanded(true);
        autoOpenedForRunRef.current = currentRunId;
      }
    } else if (!isRunning && !currentRunId) {
      // Run session ended - reset for next session
      autoOpenedForRunRef.current = null;
      userClosedRef.current = false;
    }
  }, [isRunning, currentRunId]);

  // Handle user toggle - track if they closed it
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (!newExpanded && isRunning) {
      // User closed while running - don't auto-open again
      userClosedRef.current = true;
    }
  };

  const activeRun = runs.find(
    (r) => r.status === "running" || r.status === "pending",
  );
  const recentRuns = runs.slice(0, 10); // Show last 10 runs

  const hasActivity = runs.length > 0;
  const showBadge = activeRun || (currentRunId && isRunning);

  return (
    <div
      className={cn(
        "fixed bottom-0 right-[9%] w-[400px] z-40",
        "hidden md:block", // Hide on mobile
        className,
      )}
    >
      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? "min(500px, 60vh)" : 48,
        }}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 400,
        }}
        className="bg-background border border-border border-b-0 rounded-t-xl shadow-xl overflow-hidden flex flex-col"
      >
        {/* Header - always visible */}
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Activity</span>
            {showBadge && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Content - always rendered, visibility controlled by height */}
        <div className="flex-1 overflow-hidden flex flex-col border-t border-border">
          {!hasActivity ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs mt-1">Run a job to see activity here</p>
              </div>
            </div>
          ) : (
            /* Runs list view */
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {recentRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun?.(run)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left group",
                      run.id === currentRunId
                        ? "bg-primary/10"
                        : "hover:bg-accent/50",
                    )}
                  >
                    {getStatusIcon(run.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate capitalize">
                        {run.id === "optimistic-run"
                          ? "Starting..."
                          : run.status === "running" || run.status === "pending"
                            ? "Running..."
                            : run.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.id === "optimistic-run"
                          ? "just now"
                          : formatDistanceToNow(new Date(run.created_at), {
                              addSuffix: true,
                            })}
                      </p>
                    </div>
                    {(run.total_payment != null && run.total_payment > 0) ||
                    (run.total_cost != null && run.total_cost > 0) ? (
                      <span className="text-xs font-mono text-muted-foreground">
                        ${(run.total_payment || run.total_cost || 0).toFixed(2)}
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
