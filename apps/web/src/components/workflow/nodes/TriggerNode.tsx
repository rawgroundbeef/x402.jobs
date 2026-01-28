"use client";

import { useState, useEffect } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Play,
  X,
  Loader2,
  Webhook,
  Settings2,
  DollarSign,
  Square,
  Clock,
} from "lucide-react";

// Helper to format countdown
function formatCountdown(ms: number): string {
  const seconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Simple inline countdown text
function ScheduleCountdownText({ nextRunAt }: { nextRunAt: string }) {
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const nextRun = new Date(nextRunAt).getTime();
      const now = Date.now();
      const diff = nextRun - now;

      if (diff <= 0) {
        setCountdown("now");
      } else {
        setCountdown(formatCountdown(diff));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextRunAt]);

  return <span className="font-medium">{countdown}</span>;
}

export type TriggerType = "manual" | "webhook" | "schedule";

export interface TriggerMethods {
  manual: boolean;
  webhook: boolean;
  schedule: boolean;
}

// Schedule configuration
export interface ScheduleConfig {
  cron: string; // Cron expression (e.g., "0 9 * * *" for daily at 9 AM)
  timezone: string; // Timezone (e.g., "America/New_York")
  enabled: boolean;
}

// Workflow input parameter definition
export interface WorkflowInput {
  name: string; // e.g., "brand_agent_id"
  type: "string" | "number" | "boolean" | "object" | "file"; // Data type ("file" shows upload UI, stored as URL string)
  required: boolean;
  description?: string;
  default?: string; // Default value (stored as string, parsed based on type)
}

type TriggerNodeData = {
  label?: string; // Custom trigger name (e.g., "Debug Trigger", "Full Run")
  triggerType?: TriggerType; // Legacy
  triggerMethods?: TriggerMethods; // New: multiple methods
  scheduleConfig?: ScheduleConfig; // Schedule configuration
  scheduleNextRunAt?: string; // ISO timestamp of next scheduled run
  workflowInputs?: WorkflowInput[]; // Configurable workflow parameters
  onRun?: (triggerId: string) => void;
  onCancel?: () => void;
  onDelete?: (nodeId: string) => void;
  onConfigure?: () => void;
  isRunning?: boolean;
  isInitiating?: boolean;
};

type TriggerNodeType = Node<TriggerNodeData, "trigger">;

export function TriggerNode({
  id,
  data,
  selected,
}: NodeProps<TriggerNodeType>) {
  const isRunning = data.isRunning;
  const isInitiating = data.isInitiating;

  // Support both legacy triggerType and new triggerMethods
  const methods: TriggerMethods = data.triggerMethods || {
    manual: data.triggerType !== "webhook" && data.triggerType !== "schedule",
    webhook: data.triggerType === "webhook",
    schedule: data.triggerType === "schedule",
  };

  const hasManual = methods.manual;
  const hasWebhook = methods.webhook;
  const hasSchedule = methods.schedule;

  // Determine border styling based on state
  const getBorderClass = () => {
    if (isInitiating) {
      return "border-trigger shadow-lg shadow-trigger/30 animate-pulse";
    }
    if (isRunning) {
      return "border-trigger shadow-lg shadow-trigger/20";
    }
    if (selected) {
      return "border-trigger shadow-lg shadow-trigger/20";
    }
    return "border-trigger/50";
  };

  return (
    <div
      className={`bg-background border-2 rounded-lg p-3 min-w-[160px] transition-all relative group ${getBorderClass()}`}
      onDoubleClick={() => data.onConfigure?.()}
    >
      {/* Delete button */}
      {data.onDelete && !isRunning && (
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

      {/* Settings button */}
      {data.onConfigure && !isRunning && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onConfigure?.();
          }}
          className="absolute top-2 right-2 w-6 h-6 bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          title="Configure trigger"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Header with single icon */}
      <div className="flex items-center gap-2 mb-2">
        {/* Single icon based on primary trigger type */}
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-trigger/20 text-trigger">
          {!hasManual && hasWebhook ? (
            <Webhook className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </div>
        <span
          className="font-semibold text-sm truncate max-w-[100px]"
          title={data.label}
        >
          {data.label || "Trigger"}
        </span>
      </div>

      {/* Content area */}
      <div className="space-y-2">
        {/* Manual run button - shown when manual is enabled */}
        {hasManual && (
          <>
            {isRunning || isInitiating ? (
              <>
                {/* Running indicator */}
                <div className="w-full font-medium py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1.5 bg-muted text-muted-foreground">
                  {isInitiating ? (
                    <>
                      <DollarSign className="w-3 h-3 animate-pulse" />
                      Initiating...
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Running...
                    </>
                  )}
                </div>
                {/* Cancel button */}
                <button
                  onClick={() => data.onCancel?.()}
                  className="w-full font-medium py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors"
                >
                  <Square className="w-3 h-3" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => data.onRun?.(id)}
                className="w-full font-medium py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1.5 bg-trigger hover:bg-trigger-dark text-white transition-colors"
              >
                <Play className="w-3 h-3" />
                Run
              </button>
            )}
          </>
        )}

        {/* Webhook status - text indicator, not a button */}
        {hasWebhook && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-1">
            <Webhook className="w-3.5 h-3.5 text-trigger" />
            <span>Webhook enabled</span>
          </div>
        )}

        {/* Schedule status - text indicator */}
        {hasSchedule && data.scheduleConfig?.enabled && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-1">
            <Clock className="w-3.5 h-3.5 text-trigger" />
            <span>
              Scheduled
              {data.scheduleNextRunAt && (
                <span className="text-[10px] ml-1 opacity-70">
                  (next in{" "}
                  <ScheduleCountdownText nextRunAt={data.scheduleNextRunAt} />)
                </span>
              )}
            </span>
          </div>
        )}
        {hasSchedule && !data.scheduleConfig?.enabled && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 py-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Schedule paused</span>
          </div>
        )}

        {/* Show configured workflow inputs */}
        {data.workflowInputs && data.workflowInputs.length > 0 && (
          <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
            <div className="font-medium mb-1">Parameters:</div>
            {data.workflowInputs.map((input) => (
              <div
                key={input.name}
                className="flex items-center gap-1 text-[10px]"
              >
                <span className="font-mono text-foreground">{input.name}</span>
                {input.required && <span className="text-destructive">*</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-card !bg-trigger"
      />
    </div>
  );
}
