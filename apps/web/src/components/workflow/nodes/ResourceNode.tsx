"use client";

import { useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Box,
  X,
  Settings2,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { ConfiguredInputs } from "@/components/modals/ResourceConfigModal";
import { formatUsd, getResourceDisplayName } from "@/lib/format";
import { LoadingBorder } from "../LoadingBorder";

export type ExecutionStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed";

type ResourceNodeData = {
  executionStatus?: ExecutionStatus;
  resource?: {
    id: string;
    name: string;
    slug?: string;
    serverSlug?: string;
    displayName?: string; // Resolved display name (agentName > serviceName > name)
    description?: string;
    price: number;
    avatarUrl?: string;
    resourceUrl?: string;
    network?: string;
    outputSchema?: {
      input?: {
        method?: string;
        bodyFields?: Record<
          string,
          {
            type: string;
            required?: boolean;
            description?: string;
          }
        >;
        queryParams?: Record<
          string,
          {
            type: string;
            required?: boolean;
            description?: string;
          }
        >;
      };
    };
    extra?: {
      agentName?: string;
      serviceName?: string;
      [key: string]: unknown;
    };
  } | null;
  configuredInputs?: ConfiguredInputs;
  onDelete?: (nodeId: string) => void;
  onConfigure?: (nodeId: string) => void;
};

type ResourceNodeType = Node<ResourceNodeData, "resource">;

export function ResourceNode({
  id,
  data,
  selected,
}: NodeProps<ResourceNodeType>) {
  const resource = data.resource;
  const configuredInputs = data.configuredInputs || {};
  const displayName = getResourceDisplayName(resource);
  const executionStatus = data.executionStatus || "idle";

  // Check if there are any configured inputs
  const hasConfiguredInputs = Object.keys(configuredInputs).some(
    (key) =>
      configuredInputs[key]?.value || configuredInputs[key]?.sourceNodeId,
  );

  // Check if any inputs are wired to other nodes
  const hasWiredInputs = Object.values(configuredInputs).some(
    (input) => input?.type === "reference",
  );

  // Get a preview of configured values
  const getInputPreview = () => {
    const entries = Object.entries(configuredInputs);
    if (entries.length === 0) return null;

    const configured = entries.filter(
      ([, input]) => input?.value || input?.sourceNodeId,
    );
    if (configured.length === 0) return null;

    // Show first configured value or "Linked" if it's a reference
    const [_fieldName, input] = configured[0];
    if (input?.type === "reference") {
      return "← Linked input";
    }
    if (input?.value) {
      const preview =
        input.value.length > 20
          ? input.value.substring(0, 20) + "..."
          : input.value;
      return preview;
    }
    return null;
  };

  const inputPreview = getInputPreview();

  // Calculate dynamic width based on display name length
  // Each character is roughly 8px, plus padding for avatar and margins
  const nodeWidth = useMemo(() => {
    const minWidth = 200;
    const maxWidth = 400;
    const charWidth = 8;
    const basePadding = 70; // avatar + margins
    const calculatedWidth = displayName.length * charWidth + basePadding;
    return Math.min(maxWidth, Math.max(minWidth, calculatedWidth));
  }, [displayName]);

  // Status-based styling
  const getStatusClasses = () => {
    switch (executionStatus) {
      case "running":
        return "border-resource shadow-lg shadow-resource/30";
      case "failed":
        return "border-destructive shadow-lg shadow-destructive/20";
      case "pending":
        return "border-muted-foreground/50";
      case "completed":
      default:
        return selected
          ? "border-resource shadow-lg shadow-resource/20"
          : hasConfiguredInputs
            ? "border-resource/70"
            : "border-resource/50";
    }
  };

  const isRunning = executionStatus === "running";

  return (
    <LoadingBorder isLoading={isRunning} borderRadius={8}>
      <div
        className={`bg-background border-2 rounded-lg p-3 transition-all relative group cursor-pointer ${getStatusClasses()}`}
        style={{ width: nodeWidth }}
        onDoubleClick={() => data.onConfigure?.(id)}
      >
        {/* Delete button */}
        {resource && data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(id);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80 z-10"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Configure button */}
        {resource && data.onConfigure && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onConfigure?.(id);
            }}
            className="absolute top-2 right-2 w-6 h-6 bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
            title="Configure inputs"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Configured indicator */}
        {hasConfiguredInputs && (
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-resource rounded-full flex items-center justify-center">
            {hasWiredInputs ? (
              <Link2 className="w-2 h-2 text-white" />
            ) : (
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            )}
          </div>
        )}

        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-resource border-2 border-card"
        />

        {resource ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-resource/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {resource.avatarUrl ? (
                  <img
                    src={resource.avatarUrl}
                    alt={displayName}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const parent = (e.target as HTMLImageElement)
                        .parentElement;
                      if (parent) {
                        const fallback = document.createElement("div");
                        fallback.className = "w-4 h-4";
                        // Box/cube icon SVG
                        fallback.innerHTML =
                          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-resource w-4 h-4"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <Box className="w-4 h-4 text-resource" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <div className="flex items-center gap-1 text-xs">
                  {executionStatus === "running" ? (
                    <>
                      <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                      <span className="text-blue-500">Running...</span>
                    </>
                  ) : executionStatus === "completed" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Complete</span>
                    </>
                  ) : executionStatus === "failed" ? (
                    <>
                      <AlertCircle className="w-3 h-3 text-destructive" />
                      <span className="text-destructive">Failed</span>
                    </>
                  ) : executionStatus === "pending" ? (
                    <>
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Pending</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatUsd(resource.price)} USDC
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Input preview */}
            {inputPreview && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate flex items-center gap-1">
                {hasWiredInputs && <Link2 className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate italic">{inputPreview}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-8 h-8 bg-resource/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Box className="w-4 h-4 text-resource" />
            </div>
            <span className="text-sm">Empty Resource</span>
          </div>
        )}

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-resource border-2 border-card"
        />
      </div>
    </LoadingBorder>
  );
}
