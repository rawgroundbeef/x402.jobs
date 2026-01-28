"use client";

import { useState, useMemo } from "react";
import { SlidePanel } from "./SlidePanel";
import {
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  Loader2,
  RotateCcw,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { format } from "date-fns";

// x402.storage icon (cardboard box)
function X402StorageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 222 222" className={className} fill="none">
      <path
        d="M110.56 125.46L177.16 92.16V158.76L110.56 192.06L43.96 158.76V92.16L110.56 125.46Z"
        fill="#8B7355"
      />
      <path
        d="M43.96 92.16L110.56 125.46V192.06L43.96 158.76V92.16Z"
        fill="#7A6345"
      />
      <path
        d="M110.56 125.46L177.16 92.16V158.76L110.56 192.06V125.46Z"
        fill="#6B5344"
      />
      <path
        d="M43.96 92.16L110.56 61.08L177.16 92.16L110.56 125.46L43.96 92.16Z"
        fill="#A08060"
      />
      <path
        d="M43.96 92.16L110.56 61.08L79.48 30L4 65.52L43.96 92.16Z"
        fill="#C4A77D"
      />
      <path
        d="M177.16 92.16L110.56 61.08L141.64 30L217.12 65.52L177.16 92.16Z"
        fill="#B8956F"
      />
    </svg>
  );
}

// Delivery result for each destination
export interface DeliveryResult {
  type: "app" | "telegram" | "x" | "x402storage";
  success: boolean;
  url?: string; // For x402storage CID URL, X tweet URL, Telegram message link
  error?: string;
}

interface OutputViewerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  output: string | null | undefined;
  /** Delivery results for each enabled destination */
  deliveryResults?: DeliveryResult[];
  /** Job execution cost */
  jobCost?: number;
  /** Storage cost (if x402.storage used) */
  storageCost?: number;
  /** Timestamp of completion */
  completedAt?: string | Date;
  /** Whether the job is still running */
  isLoading?: boolean;
  /** Retry storage upload callback */
  onRetryStorage?: () => void;
  stackLevel?: number;
  hasStackedChild?: boolean;
}

export function OutputViewerPanel({
  isOpen,
  onClose,
  output,
  deliveryResults = [],
  jobCost = 0,
  storageCost = 0,
  completedAt,
  isLoading = false,
  onRetryStorage,
  stackLevel = 1,
  hasStackedChild = false,
}: OutputViewerPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"json" | "text">("json");

  // Detect if this is an error output
  const isError = output?.startsWith("❌");
  const isSuccess = output && !isError && !isLoading;

  // Try to parse and format JSON
  const { isJson, formattedJson, plainText } = useMemo(() => {
    if (!output) return { isJson: false, formattedJson: "", plainText: "" };

    try {
      const parsed = JSON.parse(output);

      // Custom replacer to truncate base64 data URLs for display
      const formatted = JSON.stringify(
        parsed,
        (key, value) => {
          if (typeof value === "string" && value.startsWith("data:")) {
            const sizeKB = Math.round(value.length / 1024);
            const mimeMatch = value.match(/^data:([^;]+)/);
            const mimeType = mimeMatch?.[1] || "unknown";
            return `[${mimeType} - ${sizeKB}KB base64]`;
          }
          return value;
        },
        2,
      );

      // Extract plain text value if it's a simple response
      let plain = output;
      if (typeof parsed === "object" && parsed !== null) {
        // Try common response field names
        const responseValue =
          parsed.response ||
          parsed.result ||
          parsed.output ||
          parsed.text ||
          parsed.content ||
          parsed.message;
        if (typeof responseValue === "string") {
          plain = responseValue;
        }
      }

      return { isJson: true, formattedJson: formatted, plainText: plain };
    } catch {
      return { isJson: false, formattedJson: "", plainText: output };
    }
  }, [output]);

  const handleCopy = async () => {
    if (!output) return;
    const textToCopy =
      viewMode === "json" && formattedJson ? formattedJson : plainText;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  // Truncate URL for display
  const truncateUrl = (url: string, maxLen = 20) => {
    if (url.length <= maxLen) return url;
    const start = Math.ceil((maxLen - 3) / 2);
    const end = Math.floor((maxLen - 3) / 2);
    return url.slice(0, start) + "..." + url.slice(-end);
  };

  // Calculate total cost
  const totalCost = jobCost + storageCost;

  // Format cost
  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  // Title with status icon
  const title = (
    <div className="flex items-center gap-2">
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : isError ? (
        <AlertCircle className="w-4 h-4 text-destructive" />
      ) : isSuccess ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : null}
      <span className={isError ? "text-destructive" : ""}>Output</span>
    </div>
  );

  // Header right: toggle + copy + close handled by SlidePanel
  const headerRight = (
    <div className="flex items-center gap-2">
      {/* JSON | Text toggle */}
      {output && isJson && (
        <div className="flex bg-muted rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode("json")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "json"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setViewMode("text")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "text"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Text
          </button>
        </div>
      )}

      {/* Copy button */}
      {output && (
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );

  // Check if we have any delivery results to show
  const hasDeliveryResults = deliveryResults.length > 0;
  const hasReceipt = totalCost > 0 || completedAt;

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      headerRight={headerRight}
      fullBleed
      stackLevel={stackLevel}
      hasStackedChild={hasStackedChild}
    >
      <div className="flex flex-col h-full">
        {/* Output Content (top half) */}
        <div className="flex-1 overflow-y-auto min-h-0 basis-1/2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running...</span>
              </div>
            </div>
          ) : output ? (
            viewMode === "json" && isJson && formattedJson ? (
              <Editor
                height="100%"
                defaultLanguage="json"
                theme="vs-dark"
                value={formattedJson}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  folding: true,
                }}
              />
            ) : isError ? (
              <div className="p-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <pre className="text-destructive whitespace-pre-wrap break-words font-mono text-sm">
                    {output}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-foreground">
                  {plainText}
                </pre>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm italic">
                No output yet. Run the workflow to see results.
              </p>
            </div>
          )}
        </div>

        {/* Delivery & Receipt (bottom half) */}
        {(hasDeliveryResults || hasReceipt) && !isLoading && (
          <div className="flex-1 basis-1/2 border-t border-border p-4 space-y-4 bg-background overflow-y-auto">
            {/* Delivery section */}
            {hasDeliveryResults && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  Delivered to
                </div>
                <div className="space-y-1.5">
                  {deliveryResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className="text-foreground">
                          {result.type === "app" && "In-app"}
                          {result.type === "x402storage" && (
                            <span className="flex items-center gap-1.5">
                              <X402StorageIcon className="w-3.5 h-3.5" />
                              x402.storage
                            </span>
                          )}
                          {result.type === "x" && "X"}
                          {result.type === "telegram" && "Telegram"}
                        </span>
                        {result.url && result.type === "x402storage" && (
                          <span className="text-muted-foreground font-mono text-xs">
                            {truncateUrl(
                              result.url.replace("https://x402.storage/", ""),
                            )}
                          </span>
                        )}
                        {!result.success && result.error && (
                          <span className="text-muted-foreground text-xs">
                            {result.error}
                          </span>
                        )}
                      </div>

                      {/* Action button */}
                      <div>
                        {result.success &&
                          result.url &&
                          result.type === "x402storage" && (
                            <button
                              onClick={() => handleCopyUrl(result.url!)}
                              className="text-xs text-[#C4A77D] hover:text-[#d4b78d] transition-colors"
                            >
                              {copiedUrl === result.url ? "Copied" : "Copy"}
                            </button>
                          )}
                        {result.success &&
                          result.url &&
                          (result.type === "x" ||
                            result.type === "telegram") && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-[#C4A77D] hover:text-[#d4b78d] transition-colors"
                            >
                              View
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        {!result.success &&
                          result.type === "x402storage" &&
                          onRetryStorage && (
                            <button
                              onClick={onRetryStorage}
                              className="flex items-center gap-1 text-xs text-[#C4A77D] hover:text-[#d4b78d] transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Receipt divider */}
            {hasDeliveryResults && hasReceipt && (
              <div className="border-t border-border" />
            )}

            {/* Receipt line */}
            {hasReceipt && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">
                  {jobCost > 0 && storageCost > 0 ? (
                    <>
                      Job: {formatCost(jobCost)} · x402.storage:{" "}
                      {formatCost(storageCost)} ·{" "}
                      <span className="text-foreground">
                        Total: {formatCost(totalCost)}
                      </span>
                    </>
                  ) : totalCost > 0 ? (
                    <>Total: {formatCost(totalCost)}</>
                  ) : null}
                </div>
                {completedAt && (
                  <div className="text-[11px] text-muted-foreground/70">
                    {format(new Date(completedAt), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
