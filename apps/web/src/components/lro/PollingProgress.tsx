"use client";

import { Progress } from "@x402jobs/ui/progress";
import {
  Loader2,
  CheckCircle,
  ChevronDown,
  Circle,
  XCircle,
} from "lucide-react";
import type { PollStep, PollProgress } from "./types";

interface PollingProgressProps {
  pollStatus: string | null;
  pollProgress: PollProgress | null;
  pollSteps: PollStep[];
  pollRawData?: unknown;
  showAdvancedLogs?: boolean;
  onAdvancedLogsToggle?: (open: boolean) => void;
}

export function PollingProgress({
  pollStatus,
  pollProgress,
  pollSteps,
  pollRawData,
  showAdvancedLogs = false,
  onAdvancedLogsToggle,
}: PollingProgressProps) {
  return (
    <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">{pollStatus}</span>
        </div>
        {pollProgress && pollProgress.total > 0 && (
          <span className="text-sm font-medium text-muted-foreground">
            Step {Math.min(pollProgress.completed + 1, pollProgress.total)} of{" "}
            {pollProgress.total}
          </span>
        )}
      </div>

      <Progress
        value={pollProgress?.completed || 0}
        max={pollProgress?.total || 100}
        indeterminate={!pollProgress}
        variant="gradient"
        className="h-3"
      />

      {pollSteps.length > 0 && (
        <div className="space-y-2 pt-2">
          {(() => {
            const firstRunningIndex = pollSteps.findIndex(
              (s) => s.status === "running",
            );
            return pollSteps.map((step, index) => {
              const isFirstRunning =
                step.status === "running" && index === firstRunningIndex;
              return (
                <div key={index} className="flex items-center gap-3 text-sm">
                  {step.status === "completed" && (
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  )}
                  {step.status === "running" && isFirstRunning && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                  )}
                  {step.status === "running" && !isFirstRunning && (
                    <Circle className="h-4 w-4 text-primary/60 flex-shrink-0" />
                  )}
                  {step.status === "pending" && (
                    <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  )}
                  {step.status === "failed" && (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span
                    className={
                      step.status === "completed"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : step.status === "running"
                          ? isFirstRunning
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                          : step.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground/70"
                    }
                  >
                    {step.name}
                  </span>
                  <span
                    className={`ml-auto text-xs ${
                      step.status === "completed"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : step.status === "running"
                          ? isFirstRunning
                            ? "text-primary"
                            : "text-muted-foreground"
                          : step.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground/50"
                    }`}
                  >
                    {step.status === "completed" && "Done"}
                    {step.status === "running" &&
                      (isFirstRunning ? "Running..." : "In progress")}
                    {step.status === "pending" && "Pending"}
                    {step.status === "failed" && "Failed"}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {pollRawData !== null &&
        pollRawData !== undefined &&
        onAdvancedLogsToggle && (
          <details
            open={showAdvancedLogs}
            onToggle={(e) =>
              onAdvancedLogsToggle((e.target as HTMLDetailsElement).open)
            }
            className="pt-2 border-t border-border/50"
          >
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronDown className="h-3 w-3" />
              Advanced logs
            </summary>
            <pre className="mt-2 text-xs font-mono bg-background/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
              {JSON.stringify(pollRawData, null, 2)}
            </pre>
          </details>
        )}
    </div>
  );
}
