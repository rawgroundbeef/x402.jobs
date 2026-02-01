"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  preview?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: "default" | "destructive" | "warning" | "success";
}

export function CollapsibleSection({
  title,
  preview,
  defaultExpanded = false,
  children,
  icon,
  badge,
  badgeVariant = "default",
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const badgeColors = {
    default: "bg-muted text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    success: "bg-primary/10 text-primary",
  };

  return (
    <div className="border border-border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors ${
          expanded ? "rounded-t-lg" : "rounded-lg"
        }`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${badgeColors[badgeVariant]}`}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!expanded && preview && (
            <span className="text-sm text-muted-foreground">{preview}</span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              expanded ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      <div
        className={`transition-all duration-200 ease-in-out ${
          expanded ? "opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        {expanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
