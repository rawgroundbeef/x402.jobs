"use client";

import React from "react";
import { useConversation } from "./ConversationContext";
import { useConversationFlow } from "./useConversationFlow";
import type { ParameterSelectionContent } from "./types";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import {
  Check,
  ArrowRight,
  Calendar,
  Type,
  Hash,
  ToggleLeft,
} from "lucide-react";
import { cn } from "@x402jobs/ui/utils";

interface ParameterSelectionCardProps {
  content: ParameterSelectionContent;
}

const typeIcons = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
};

export function ParameterSelectionCard({
  content,
}: ParameterSelectionCardProps) {
  const { state, toggleParameter } = useConversation();
  const { handleFinalizeParameters } = useConversationFlow();
  const { parameters, explanation } = content;

  return (
    <div className="space-y-4">
      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-muted-foreground">{explanation}</p>
      )}

      {/* Parameter cards */}
      <div className="space-y-2">
        {parameters.map((param) => {
          const isExposed =
            state.workflow.parameters.find((p) => p.name === param.name)
              ?.exposed ?? param.exposed;
          const Icon = typeIcons[param.type] || Type;

          return (
            <Card
              key={param.name}
              as="button"
              onClick={() => toggleParameter(param.name)}
              className={cn(
                "w-full p-3 text-left transition-all group",
                isExposed
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-accent",
              )}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    isExposed
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                  )}
                >
                  {isExposed && <Check className="w-3 h-3" />}
                </div>

                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-medium">
                      {param.name}
                    </p>
                    <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-muted">
                      {param.type}
                    </span>
                    {param.required && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Required
                      </span>
                    )}
                  </div>
                  {param.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {param.description}
                    </p>
                  )}
                </div>

                {/* Default value */}
                <div className="text-right shrink-0 max-w-[120px]">
                  <p className="text-sm font-mono text-muted-foreground truncate">
                    {param.defaultValue || "—"}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground">
        Checked parameters will be configurable when running the job. Unchecked
        will use the default values shown.
      </p>

      {/* Action */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-2" onClick={handleFinalizeParameters}>
          Finalize workflow
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
