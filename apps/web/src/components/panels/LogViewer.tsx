"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn } from "@x402jobs/ui/utils";
import { Input } from "@x402jobs/ui/input";
import type { RunEvent } from "@/types/runs";

interface LogViewerProps {
  events: RunEvent[];
  isLoading?: boolean;
  /** Show the filter input */
  showFilter?: boolean;
  /** Show timestamps in GMT-6 (or user's local) */
  showTimezone?: boolean;
}

type LogEntryStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

function getStatusIcon(status?: string) {
  const s = (status || "pending").toLowerCase() as LogEntryStatus;
  switch (s) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
    case "skipped":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// getStatusColor removed - now only using status icon for indication

interface LogEntryProps {
  event: RunEvent;
  isExpanded: boolean;
  onToggle: () => void;
}

function LogEntry({ event, isExpanded, onToggle }: LogEntryProps) {
  const [copied, setCopied] = useState(false);

  const timestamp = format(new Date(event.created_at), "HH:mm:ss");
  const fullTimestamp = format(
    new Date(event.created_at),
    "MMM d, yyyy HH:mm:ss",
  );

  const duration = useMemo(() => {
    if (!event.started_at || !event.completed_at) return null;
    const start = new Date(event.started_at).getTime();
    const end = new Date(event.completed_at).getTime();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, [event.started_at, event.completed_at]);

  const hasDetails =
    event.output ||
    event.error ||
    event.payment_signature ||
    event.inputs ||
    event.resolved_inputs ||
    event.resource_url;

  const handleCopy = () => {
    const content =
      event.error ||
      event.output_text ||
      JSON.stringify(event.output, null, 2) ||
      "";
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group border-b border-border/50 last:border-0">
      {/* Main row */}
      <button
        onClick={onToggle}
        disabled={!hasDetails}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 text-left",
          "hover:bg-muted/50 transition-colors",
          !hasDetails && "cursor-default",
        )}
      >
        {/* Expand chevron */}
        <div className="w-4 flex items-center justify-center flex-shrink-0">
          {hasDetails ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </div>

        {/* Timestamp */}
        <span
          className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0"
          title={fullTimestamp}
        >
          {timestamp}
        </span>

        {/* Status icon */}
        <span className="flex-shrink-0">{getStatusIcon(event.status)}</span>

        {/* Resource name / Message */}
        <span className="flex-1 min-w-0 text-sm truncate">
          <span
            className={cn(
              "font-medium",
              event.status?.toLowerCase() === "failed"
                ? "text-red-400"
                : "text-foreground",
            )}
          >
            {event.resource_name || event.type || "Step"}
          </span>
          {event.error && (
            <span className="text-red-400 ml-2 text-xs">
              {event.error.split("\n")[0].slice(0, 100)}
            </span>
          )}
        </span>

        {/* Duration */}
        {duration && (
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
            {duration}
          </span>
        )}

        {/* Cost */}
        {(event.cost_usdc ?? event.amount_paid) != null &&
          (event.cost_usdc ?? event.amount_paid)! > 0 && (
            <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
              ${(event.cost_usdc ?? event.amount_paid)!.toFixed(4)}
            </span>
          )}

        {/* Size indicator */}
        {event.output !== undefined && event.output !== null && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatSize(event.output)}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="px-3 pb-3 ml-7 mr-3 bg-muted/30 rounded-md mb-2 mx-3">
          {/* x402.storage: Show storage URL prominently */}
          {event.resource_name === "x402.storage" &&
            (() => {
              const output = event.output as Record<string, unknown> | null;
              const storageUrl = output?.url as string | undefined;
              if (!storageUrl) return null;
              return (
                <div className="pt-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Stored At
                  </span>
                  <div className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto flex items-center gap-2">
                    <span className="truncate text-[#C4A77D]">
                      {storageUrl}
                    </span>
                    <a
                      href={storageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C4A77D] hover:text-[#d4b78d] flex-shrink-0"
                      title="View stored content"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })()}

          {/* Resource URL (API endpoint called) */}
          {event.resource_url &&
            !event.resource_url.startsWith("transform://") && (
              <div className="pt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {event.resource_name === "x402.storage"
                    ? "API Endpoint"
                    : "URL"}
                </span>
                <div className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto flex items-center gap-2">
                  <span className="truncate">{event.resource_url}</span>
                  <a
                    href={event.resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 flex-shrink-0"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

          {/* Resolved request body (what was actually sent) */}
          {event.resolved_inputs &&
            Object.keys(event.resolved_inputs).length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Request Body (Resolved)
                </span>
                <pre className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                  {JSON.stringify(event.resolved_inputs, null, 2)}
                </pre>
              </div>
            )}

          {/* Raw input configuration (for debugging reference resolution) */}
          {event.inputs &&
            Object.keys(event.inputs).length > 0 &&
            !event.resolved_inputs && (
              <div className="pt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Request Body
                </span>
                <pre className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                  {JSON.stringify(event.inputs, null, 2)}
                </pre>
              </div>
            )}

          {/* Show input config if different from resolved (for debugging) */}
          {event.inputs &&
            event.resolved_inputs &&
            Object.keys(event.inputs).length > 0 && (
              <div className="pt-2">
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                    Input Configuration (before resolution)
                  </summary>
                  <pre className="font-mono bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                    {JSON.stringify(event.inputs, null, 2)}
                  </pre>
                </details>
              </div>
            )}

          {/* Error */}
          {event.error && (
            <div className="pt-2">
              <span className="text-xs font-medium text-red-400">Error</span>
              <pre className="text-xs font-mono bg-red-500/10 text-red-400 rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap">
                {event.error}
              </pre>
            </div>
          )}

          {/* Output */}
          {event.output !== undefined && event.output !== null && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Response
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded hover:bg-accent text-muted-foreground"
                    title="Copy output"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <pre className="text-xs font-mono bg-background rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {typeof event.output === "string"
                  ? event.output
                  : JSON.stringify(event.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Payment signature */}
          {event.payment_signature && (
            <div className="pt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Payment
              </span>
              <a
                href={`https://solscan.io/tx/${event.payment_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {event.payment_signature.slice(0, 16)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatSize(output: unknown): string {
  const str = typeof output === "string" ? output : JSON.stringify(output);
  const bytes = new Blob([str]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Railway-style log viewer with expandable entries.
 */
export function LogViewer({
  events,
  isLoading,
  showFilter = true,
}: LogViewerProps) {
  const [filter, setFilter] = useState("");
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const failedCount = useMemo(() => {
    return events.filter((e) => e.status?.toLowerCase() === "failed").length;
  }, [events]);

  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply failed only filter
    if (showFailedOnly) {
      filtered = filtered.filter((e) => e.status?.toLowerCase() === "failed");
    }

    // Apply text filter
    if (filter.trim()) {
      const search = filter.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.resource_name?.toLowerCase().includes(search) ||
          e.resource_url?.toLowerCase().includes(search) ||
          e.type?.toLowerCase().includes(search) ||
          e.status?.toLowerCase().includes(search) ||
          e.error?.toLowerCase().includes(search),
      );
    }

    return filtered;
  }, [events, filter, showFailedOnly]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      {showFilter && (
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter logs by name, URL, or error..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 text-sm h-9"
            />
          </div>
          {failedCount > 0 && (
            <button
              onClick={() => setShowFailedOnly(!showFailedOnly)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                showFailedOnly
                  ? "bg-destructive/20 text-destructive"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground",
              )}
            >
              <XCircle className="h-3 w-3" />
              {showFailedOnly
                ? `Showing ${failedCount} failed`
                : `Show ${failedCount} failed only`}
            </button>
          )}
        </div>
      )}

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto font-mono">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No log entries</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredEvents.map((event) => (
              <LogEntry
                key={event.id}
                event={event}
                isExpanded={expandedIds.has(event.id)}
                onToggle={() => toggleExpanded(event.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
