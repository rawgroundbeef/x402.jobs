"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Database,
  Globe,
  X,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { ExecutionStatus } from "./ResourceNode";
import { LoadingBorder } from "../LoadingBorder";

export type SourceType = "job_history" | "url_fetch";

export interface SourceConfig {
  // For job_history
  jobId?: string; // Job ID or "self" for current job
  jobName?: string; // Display name for the job
  limit?: number; // Max results (default: 100)
  since?: string; // "1h" | "24h" | "7d" | "30d" | "all"
  // For url_fetch
  url?: string;
  headers?: Record<string, string>;
}

export type SourceNodeData = {
  sourceType: SourceType;
  config: SourceConfig;
  executionStatus?: ExecutionStatus;
  onDelete?: (nodeId: string) => void;
  onConfigure?: (nodeId: string) => void;
};

type SourceNodeType = Node<SourceNodeData, "source">;

const sourceTypeLabels: Record<SourceType, string> = {
  job_history: "Job History",
  url_fetch: "URL Fetch",
};

const sourceTypeIcons: Record<
  SourceType,
  React.ComponentType<{ className?: string }>
> = {
  job_history: Database,
  url_fetch: Globe,
};

export function SourceNode({ id, data, selected }: NodeProps<SourceNodeType>) {
  const typeLabel = sourceTypeLabels[data.sourceType];
  const Icon = sourceTypeIcons[data.sourceType];
  const executionStatus = data.executionStatus || "idle";

  // Check if source is configured
  const hasConfig =
    (data.sourceType === "job_history" && data.config?.jobId) ||
    (data.sourceType === "url_fetch" && data.config?.url);

  // Config preview text
  const getConfigPreview = () => {
    if (data.sourceType === "job_history") {
      if (data.config?.jobId === "self") {
        return "Self (this job)";
      }
      if (data.config?.jobName) {
        return data.config.jobName;
      }
      if (data.config?.jobId) {
        return data.config.jobId.substring(0, 8) + "...";
      }
    }
    if (data.sourceType === "url_fetch" && data.config?.url) {
      const url = data.config.url;
      return url.length > 30 ? url.substring(0, 30) + "..." : url;
    }
    return null;
  };

  // Status-based styling
  const getStatusClasses = () => {
    switch (executionStatus) {
      case "running":
        return "border-source shadow-lg shadow-source/30";
      case "failed":
        return "border-destructive shadow-lg shadow-destructive/20";
      case "pending":
        return "border-muted-foreground/50";
      case "completed":
      default:
        return selected
          ? "border-source shadow-lg shadow-source/20"
          : "border-source/50";
    }
  };

  const isRunning = executionStatus === "running";
  const configPreview = getConfigPreview();

  return (
    <LoadingBorder isLoading={isRunning} borderRadius={8}>
      <div
        className={`bg-background border-2 rounded-lg p-3 min-w-[160px] max-w-[220px] transition-all relative group cursor-pointer ${getStatusClasses()}`}
        onDoubleClick={() => data.onConfigure?.(id)}
      >
        {/* Delete button */}
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(id);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Configure button */}
        {data.onConfigure && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onConfigure?.(id);
            }}
            className="absolute top-2 right-2 w-6 h-6 bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
            title="Configure source"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Configured indicator */}
        {hasConfig && (
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-source rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        )}

        {/* Input handle (left) */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-source border-2 border-card"
        />

        {/* Output handle (right) */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-source border-2 border-card"
        />

        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              executionStatus === "running"
                ? "bg-amber-500/20 text-amber-500"
                : executionStatus === "completed"
                  ? "bg-emerald-500/20 text-emerald-500"
                  : executionStatus === "failed"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-source/20 text-source"
            }`}
          >
            {executionStatus === "running" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : executionStatus === "completed" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : executionStatus === "failed" ? (
              <AlertCircle className="w-4 h-4" />
            ) : executionStatus === "pending" ? (
              <Clock className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Source</span>
            <span className="text-xs text-muted-foreground">
              {executionStatus === "running" ? (
                <span className="text-amber-500">Running...</span>
              ) : executionStatus === "completed" ? (
                <span className="text-emerald-500">Complete</span>
              ) : executionStatus === "failed" ? (
                <span className="text-destructive">Failed</span>
              ) : executionStatus === "pending" ? (
                "Pending"
              ) : (
                typeLabel
              )}
            </span>
          </div>
        </div>

        {/* Config preview */}
        {configPreview ? (
          <p className="text-xs text-muted-foreground font-mono truncate mt-1">
            {configPreview}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic mt-1 text-center">
            Double-click to configure
          </p>
        )}
      </div>
    </LoadingBorder>
  );
}
