"use client";

import React from "react";
import { useConversation } from "./ConversationContext";
import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { formatUsd } from "@/lib/format";
import {
  Sparkles,
  ArrowDown,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
// cn import removed - not currently used

interface WorkflowPreviewProps {
  onCreateJob?: () => void;
  isCreating?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function WorkflowPreview({
  onCreateJob,
  isCreating = false,
  collapsed = false,
  onToggleCollapse,
}: WorkflowPreviewProps) {
  const { state, selectedResources, exposedParameters, updateWorkflow } =
    useConversation();
  const { workflow } = state;

  // Calculate totals
  const totalCost = selectedResources.reduce((sum, r) => sum + r.price, 0);
  const stepCount = selectedResources.length;

  // Check if we have anything to show
  const hasContent = stepCount > 0 || workflow.name;

  // Mobile collapsed view
  if (collapsed) {
    return (
      <Card
        as="button"
        onClick={onToggleCollapse}
        className="w-full p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {stepCount > 0
              ? `${stepCount} step${stepCount !== 1 ? "s" : ""} · ${formatUsd(totalCost)}/run`
              : "Workflow preview"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stepCount > 0 && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateJob?.();
              }}
              disabled={isCreating}
            >
              Create
            </Button>
          )}
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Workflow Preview</span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-muted rounded lg:hidden"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!hasContent ? (
          <div className="text-center text-muted-foreground py-12">
            <Settings className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Your workflow will appear here as you build it.
            </p>
          </div>
        ) : (
          <>
            {/* Name input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Job Name
              </label>
              <Input
                value={workflow.name}
                onChange={(e) => updateWorkflow({ name: e.target.value })}
                placeholder="Untitled Workflow"
                className="font-medium"
              />
            </div>

            {/* Network */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Network
              </span>
              <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-muted">
                <ChainIcon network={workflow.network} className="w-3.5 h-3.5" />
                <span className="capitalize">{workflow.network}</span>
              </div>
            </div>

            {/* Steps */}
            {stepCount > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Steps ({stepCount})
                </label>
                <div className="space-y-2">
                  {selectedResources.map((resource, index) => (
                    <React.Fragment key={resource.id}>
                      {index > 0 && (
                        <div className="flex justify-center">
                          <ArrowDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <Card className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <span
                              className="font-mono text-xs truncate"
                              title={resource.name}
                            >
                              {resource.serverSlug && (
                                <span className="text-muted-foreground">
                                  {resource.serverSlug}/
                                </span>
                              )}
                              {resource.slug || resource.name.slice(0, 25)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatUsd(resource.price)}
                          </span>
                        </div>
                      </Card>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters */}
            {exposedParameters.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parameters ({exposedParameters.length})
                </label>
                <div className="space-y-1">
                  {exposedParameters.map((param) => (
                    <div
                      key={param.name}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 text-sm"
                    >
                      <span className="font-mono text-xs">{param.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {param.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {stepCount > 0 && (
        <div className="p-4 border-t border-border space-y-3">
          {/* Cost */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Est. cost per run:</span>
            <span className="font-medium">{formatUsd(totalCost)}</span>
          </div>

          {/* Create button */}
          <Button
            onClick={onCreateJob}
            disabled={isCreating || !workflow.name}
            loading={isCreating}
            className="w-full gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Create Job
          </Button>
        </div>
      )}
    </div>
  );
}
