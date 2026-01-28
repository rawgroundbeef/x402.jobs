"use client";

import React from "react";
import { useConversation } from "./ConversationContext";
import { useConversationFlow } from "./useConversationFlow";
import type { ResourceSuggestionContent } from "./types";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Check, ExternalLink, ArrowRight, Loader2 } from "lucide-react";
import { formatUsd } from "@/lib/format";
import { cn } from "@x402jobs/ui/utils";

interface ResourceSuggestionCardProps {
  content: ResourceSuggestionContent;
}

export function ResourceSuggestionCard({
  content,
}: ResourceSuggestionCardProps) {
  const { state, toggleResource, selectedResources } = useConversation();
  const { handleConfirmResources, isLoading } = useConversationFlow();
  const { resources } = content;

  const hasSelection = selectedResources.length > 0;

  return (
    <div className="space-y-3">
      {/* Resource cards */}
      <div className="space-y-2">
        {resources.map((resource) => {
          const isSelected = state.workflow.selectedResourceIds.includes(
            resource.id,
          );

          return (
            <Card
              key={resource.id}
              as="button"
              onClick={() => !isLoading && toggleResource(resource.id)}
              className={cn(
                "w-full p-4 text-left transition-all group",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-accent",
                isLoading &&
                  "opacity-60 cursor-not-allowed pointer-events-none",
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                  )}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium truncate">
                        {resource.serverSlug && (
                          <span className="text-muted-foreground">
                            {resource.serverSlug}/
                          </span>
                        )}
                        {resource.slug || resource.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {resource.description}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground shrink-0">
                      {formatUsd(resource.price)}/run
                    </span>
                  </div>
                </div>

                {/* External link */}
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Action */}
      {hasSelection && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-2"
            onClick={handleConfirmResources}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Building workflow...
              </>
            ) : (
              <>
                Continue with {selectedResources.length} resource
                {selectedResources.length !== 1 ? "s" : ""}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      )}

      {!hasSelection && resources.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Select at least one resource to continue
        </p>
      )}
    </div>
  );
}
