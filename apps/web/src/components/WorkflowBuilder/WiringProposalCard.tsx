"use client";

import React from "react";
import { useConversationFlow } from "./useConversationFlow";
import type { WiringProposalContent } from "./types";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { formatUsd } from "@/lib/format";

interface WiringProposalCardProps {
  content: WiringProposalContent;
}

export function WiringProposalCard({ content }: WiringProposalCardProps) {
  const { handleConfirmWiring, isLoading } = useConversationFlow();
  const { steps, connections, explanation } = content;

  // Calculate total cost
  const totalCost = steps.reduce((sum, step) => sum + step.price, 0);

  return (
    <div className="space-y-4">
      {/* Flow diagram - vertical layout */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <React.Fragment key={step.resourceId}>
              {/* Arrow between steps */}
              {index > 0 && (
                <div className="flex justify-center">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                </div>
              )}

              {/* Step box */}
              <div className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center shrink-0">
                    {step.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-mono text-sm truncate"
                      title={step.resourceName}
                    >
                      {step.serverSlug && (
                        <span className="text-muted-foreground">
                          {step.serverSlug}/
                        </span>
                      )}
                      {step.resourceSlug || step.resourceName}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {formatUsd(step.price)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Connections info */}
        {connections.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Data flow:</p>
            <div className="space-y-1">
              {connections.map((conn, i) => (
                <p key={i} className="text-xs font-mono">
                  <span className="text-muted-foreground">
                    Step {conn.fromStep}
                  </span>
                  <span className="mx-1">→</span>
                  <span className="text-foreground">{conn.fromField}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-muted-foreground">
                    Step {conn.toStep}
                  </span>
                  <span className="mx-1">→</span>
                  <span className="text-foreground">{conn.toField}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {explanation}
        </p>
      )}

      {/* Cost summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total cost per run:</span>
        <span className="font-medium">{formatUsd(totalCost)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          className="gap-2"
          onClick={handleConfirmWiring}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Looks good
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
