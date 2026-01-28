"use client";

import React from "react";
import { useConversationFlow } from "./useConversationFlow";
import type { FinalSummaryContent } from "./types";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Check, Loader2, Sparkles } from "lucide-react";
import { formatUsd } from "@/lib/format";
import { ChainIcon } from "@/components/icons/ChainIcons";

interface FinalSummaryCardProps {
  content: FinalSummaryContent;
}

export function FinalSummaryCard({ content }: FinalSummaryCardProps) {
  const { handleCreateJob, isLoading } = useConversationFlow();
  const { workflow } = content;

  const exposedParams = workflow.parameters.filter((p) => p.exposed);
  const totalCost =
    workflow.estimatedCost ||
    workflow.steps.reduce((sum, s) => sum + s.price, 0);

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-emerald-500/5 border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold truncate">
                {workflow.name || "Untitled Workflow"}
              </h3>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              <span>{workflow.steps.length} steps</span>
              <span>·</span>
              <span>{formatUsd(totalCost)}/run</span>
              {exposedParams.length > 0 && (
                <>
                  <span>·</span>
                  <span>{exposedParams.length} parameters</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-muted">
            <ChainIcon network={workflow.network} className="w-3.5 h-3.5" />
            <span className="capitalize">{workflow.network}</span>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {workflow.steps.map((step) => (
            <div
              key={step.resourceId}
              className="flex items-center justify-between gap-4 text-sm p-2 rounded-lg bg-background/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {step.order}
                </span>
                <span className="font-mono truncate text-xs">
                  {step.serverSlug && (
                    <span className="text-muted-foreground">
                      {step.serverSlug}/
                    </span>
                  )}
                  {step.resourceSlug || step.resourceName}
                </span>
              </div>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatUsd(step.price)}
              </span>
            </div>
          ))}
        </div>

        {/* Parameters */}
        {exposedParams.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Configurable parameters:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {exposedParams.map((param) => (
                <span
                  key={param.name}
                  className="text-xs font-mono px-2 py-1 rounded bg-muted"
                >
                  {param.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={handleCreateJob}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Job
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
