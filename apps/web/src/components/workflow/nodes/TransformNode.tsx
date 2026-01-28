"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Shuffle,
  X,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { ExecutionStatus } from "./ResourceNode";
import { LoadingBorder } from "../LoadingBorder";

export type TransformType = "extract" | "template" | "code" | "combine";

// Field mapping for combine transform
export interface CombineField {
  fieldName: string;
  sourceNodeId: string;
  sourcePath?: string; // Optional path to extract from source
}

export type TransformNodeData = {
  transformType: TransformType;
  label?: string; // User-friendly name for the transform (e.g., "Extract 1", "Parse Response")
  executionStatus?: ExecutionStatus;
  config: {
    // For "extract" type
    path?: string; // e.g., "data.items[0].name"
    // For "template" type
    template?: string; // e.g., "The answer is: {{input}}"
    // For "code" type
    code?: string;
    // For "combine" type
    combineFields?: CombineField[];
  };
  onDelete?: (nodeId: string) => void;
  onConfigure?: (nodeId: string) => void;
};

type TransformNodeType = Node<TransformNodeData, "transform">;

const transformTypeLabels: Record<TransformType, string> = {
  extract: "Extract",
  template: "Template",
  code: "Code",
  combine: "Combine",
};

export function TransformNode({
  id,
  data,
  selected,
}: NodeProps<TransformNodeType>) {
  const typeLabel = transformTypeLabels[data.transformType];
  const hasConfig =
    data.config?.path ||
    data.config?.template ||
    data.config?.code ||
    (data.config?.combineFields && data.config.combineFields.length > 0);
  const executionStatus = data.executionStatus || "idle";

  // Status-based styling
  const getStatusClasses = () => {
    switch (executionStatus) {
      case "running":
        return "border-transform shadow-lg shadow-transform/30";
      case "failed":
        return "border-destructive shadow-lg shadow-destructive/20";
      case "pending":
        return "border-muted-foreground/50";
      case "completed":
      default:
        return selected
          ? "border-transform shadow-lg shadow-transform/20"
          : "border-transform/50";
    }
  };

  const isRunning = executionStatus === "running";

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
            title="Configure transform"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Configured indicator */}
        {hasConfig && (
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-transform rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        )}

        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-transform border-2 border-card"
        />

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-transform border-2 border-card"
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
                    : "bg-transform/20 text-transform"
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
              <Shuffle className="w-4 h-4" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm truncate max-w-[140px]">
              {data.label || "Transform"}
            </span>
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
        {hasConfig ? (
          <p className="text-xs text-muted-foreground font-mono truncate mt-1">
            {data.transformType === "extract" && data.config.path}
            {data.transformType === "template" &&
              data.config.template?.substring(0, 30) +
                (data.config.template && data.config.template.length > 30
                  ? "..."
                  : "")}
            {data.transformType === "code" && (
              <span className="text-green-500">{"{ js }"}</span>
            )}
            {data.transformType === "combine" && data.config.combineFields && (
              <span className="text-blue-500">
                {data.config.combineFields.length} fields
              </span>
            )}
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
