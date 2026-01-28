"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { Spinner } from "@x402jobs/ui/spinner";
import { formatDistanceToNow, format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { authenticatedFetcher } from "@/lib/api";
import type { RunEvent } from "@/types/runs";

// Re-export RunEvent for convenience
export type { RunEvent };

interface RunDetails {
  run: {
    id: string;
    status: string;
    error?: string;
    events: RunEvent[];
  };
}

export interface RunCardProps {
  id: string;
  status: string;
  createdAt: string;
  totalCost: number | null;
  error?: string;
  /** Optional title line (e.g. job name) */
  title?: string;
  /** Optional subtitle (defaults to relative time) */
  subtitle?: string;
  /** Content to render in the header row (always visible, next to status) */
  headerRight?: React.ReactNode;
  /** Content to render in the footer (left side) */
  footerLeft?: React.ReactNode;
  /** Content to render in the footer (right side) */
  footerRight?: React.ReactNode;
  /** If provided, events will be passed to parent instead of fetched */
  events?: RunEvent[];
  /** Called when expanded state changes */
  onExpandedChange?: (expanded: boolean, events: RunEvent[]) => void;
  /** Control expanded state externally */
  isExpanded?: boolean;
}

/**
 * Format price with smart decimal handling:
 * - 2 decimals if >= $0.01
 * - Up to 6 decimals if < $0.01
 */
export function formatPrice(amount: number): string {
  if (amount >= 0.01) {
    return `$${amount.toFixed(2)}`;
  }
  const formatted = amount.toFixed(6).replace(/\.?0+$/, "");
  return `$${formatted}`;
}

export function getStatusBadge(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "completed" || normalizedStatus === "success") {
    return <Badge variant="success">Success</Badge>;
  }

  if (normalizedStatus === "failed" || normalizedStatus === "error") {
    return <Badge variant="destructive">Failed</Badge>;
  }

  if (normalizedStatus === "running" || normalizedStatus === "pending") {
    return <Badge variant="secondary">Running</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
}

function getEventStatusColor(status?: string) {
  if (!status) return "text-muted-foreground";
  const s = status.toLowerCase();
  if (s === "completed" || s === "success")
    return "text-emerald-600 dark:text-emerald-400";
  if (s === "failed" || s === "error") return "text-destructive";
  if (s === "running" || s === "pending") return "text-amber-500";
  return "text-muted-foreground";
}

export default function RunCard({
  id,
  status,
  createdAt,
  totalCost,
  error,
  title,
  subtitle,
  headerRight,
  footerLeft,
  footerRight,
  events: providedEvents,
  onExpandedChange,
  isExpanded: controlledExpanded,
}: RunCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Support both controlled and uncontrolled modes
  const isExpanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (expanded: boolean) => {
    setInternalExpanded(expanded);
  };

  // Only fetch details when expanded and events not provided
  const shouldFetch = isExpanded && !providedEvents;
  const { data, isLoading } = useSWR<RunDetails>(
    shouldFetch ? `/runs/${id}` : null,
    authenticatedFetcher,
  );

  const events = providedEvents || data?.run?.events || [];
  const runError = error || data?.run?.error;

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setExpanded(newExpanded);
    onExpandedChange?.(newExpanded, events);
  };

  return (
    <Card className="overflow-hidden">
      {/* Main row - clickable to expand */}
      <button
        onClick={handleToggle}
        className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {title ||
                  formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {subtitle ||
                  (title
                    ? formatDistanceToNow(new Date(createdAt), {
                        addSuffix: true,
                      })
                    : format(new Date(createdAt), "MMM d, h:mm a"))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {totalCost != null && totalCost > 0 && (
              <span className="text-sm font-mono text-muted-foreground">
                {formatPrice(totalCost)}
              </span>
            )}
            {getStatusBadge(status)}
            {headerRight}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/30">
          {/* Run Error */}
          {runError && (
            <div className="mb-3 p-2 rounded bg-destructive/10 text-destructive text-sm">
              {runError}
            </div>
          )}

          {/* Events / Logs */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner />
            </div>
          ) : events.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              No events recorded
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 text-xs py-1.5 border-b border-border/50 last:border-0"
                >
                  <span className="text-muted-foreground w-16 flex-shrink-0">
                    {format(new Date(event.created_at), "HH:mm:ss")}
                  </span>
                  <span
                    className={`font-medium ${getEventStatusColor(event.status)}`}
                  >
                    {event.type || event.status}
                  </span>
                  {event.resource_name && (
                    <span className="text-muted-foreground">
                      {event.resource_name}
                    </span>
                  )}
                  {(event.cost_usdc ?? event.amount_paid) != null &&
                    (event.cost_usdc ?? event.amount_paid)! > 0 && (
                      <span className="text-muted-foreground font-mono ml-auto">
                        {formatPrice((event.cost_usdc ?? event.amount_paid)!)}
                      </span>
                    )}
                  {event.error && (
                    <span className="text-destructive truncate flex-1">
                      {event.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {(footerLeft || footerRight) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <div>{footerLeft}</div>
              <div className="flex items-center gap-2">{footerRight}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
