"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import type { VerifyResponse } from "@/lib/x402-verify";

interface VerifyResultDetailsProps {
  verifyResponse: VerifyResponse;
}

// Inline collapsible for this component — lighter than the shared one
function Details({
  label,
  badge,
  badgeVariant = "muted",
  defaultOpen = false,
  children,
}: {
  label: string;
  badge?: string;
  badgeVariant?: "muted" | "warning" | "destructive";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const badgeColors = {
    muted: "bg-muted text-muted-foreground",
    warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="border border-border/50 rounded-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors rounded-md"
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {badge && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badgeColors[badgeVariant]}`}
            >
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30">{children}</div>
      )}
    </div>
  );
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatAmount(amount: string, decimals: number | null): string {
  if (decimals == null) return amount;
  const num = parseInt(amount, 10);
  if (isNaN(num)) return amount;
  return (num / 10 ** decimals).toFixed(decimals > 2 ? 2 : decimals);
}

export function VerifyResultDetails({
  verifyResponse,
}: VerifyResultDetailsProps) {
  const cr = verifyResponse.checkResult;

  // Legacy fallback: no checkResult means old-style response
  if (!cr) {
    return <LegacyDisplay verifyResponse={verifyResponse} />;
  }

  const { valid, errors, warnings, summary, source, version } = cr;

  return (
    <div className="space-y-3">
      {/* Verdict banner */}
      <VerdictBanner
        valid={valid}
        errorCount={errors.length}
        warningCount={warnings.length}
        version={version}
      />

      {/* Errors — always visible when present */}
      {errors.length > 0 && (
        <div className="space-y-1.5">
          {errors.map((err, i) => (
            <div
              key={i}
              className="flex gap-2 p-2 bg-destructive/5 border border-destructive/20 rounded-md text-xs"
            >
              <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-destructive font-medium">
                  {err.message}
                </span>
                {err.fix && (
                  <p className="text-muted-foreground mt-0.5">{err.fix}</p>
                )}
                <span className="text-muted-foreground/60 font-mono text-[10px] ml-1">
                  {err.field}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings — collapsible */}
      {warnings.length > 0 && (
        <Details
          label="View warnings"
          badge={`${warnings.length}`}
          badgeVariant="warning"
        >
          <div className="space-y-1.5 mt-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-mono text-[10px] text-muted-foreground/60 mr-1.5">
                    {w.field}
                  </span>
                  <span className="text-foreground">{w.message}</span>
                  {w.fix && (
                    <span className="text-muted-foreground ml-1">{w.fix}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Details>
      )}

      {/* Parsed config — collapsible table */}
      {summary.length > 0 && (
        <Details label="View parsed config">
          <div className="mt-1 space-y-2">
            {summary.map((s) => (
              <div
                key={s.index}
                className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs"
              >
                <span className="text-muted-foreground">Chain</span>
                <span className="font-medium">{s.networkName}</span>
                <span className="text-muted-foreground">Address</span>
                <span className="font-mono text-[11px]" title={s.payTo}>
                  {truncateAddress(s.payTo)}
                </span>
                <span className="text-muted-foreground">Amount</span>
                <span>
                  {formatAmount(s.amount, s.assetDecimals)}{" "}
                  {s.assetSymbol || s.asset}
                </span>
                <span className="text-muted-foreground">Asset</span>
                <span className="font-mono text-[11px]" title={s.asset}>
                  {s.assetSymbol
                    ? `${s.assetSymbol} (${truncateAddress(s.asset)})`
                    : truncateAddress(s.asset)}
                </span>
                <span className="text-muted-foreground">Scheme</span>
                <span>{s.scheme}</span>
                {summary.length > 1 && s.index < summary.length - 1 && (
                  <div className="col-span-2 border-t border-border/30 my-1" />
                )}
              </div>
            ))}
          </div>
        </Details>
      )}

      {/* Endpoint checks — collapsible */}
      <Details label="View endpoint checks">
        <div className="mt-1 space-y-1.5 text-xs">
          <CheckRow ok={true} label="Returns 402" />
          <CheckRow
            ok={source !== null}
            label={`Config source: ${source || "not found"}`}
          />
          <CheckRow ok={valid} label={valid ? "Validates" : "Validation failed"} />
        </div>
      </Details>

      {/* Raw response body — collapsible with copy */}
      {cr.raw && (
        <Details label="View response body">
          <RawJsonBlock data={cr.raw} />
        </Details>
      )}
    </div>
  );
}

function VerdictBanner({
  valid,
  errorCount,
  warningCount,
  version,
}: {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  version: string;
}) {
  if (valid) {
    return (
      <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Valid x402 endpoint
        </div>
        <div className="flex items-center gap-2">
          {warningCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              {warningCount} warning{warningCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            {version}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Invalid
        {errorCount > 0 && (
          <span className="font-normal">
            {" "}
            &middot; {errorCount} error{errorCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {version !== "unknown" && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {version}
        </span>
      )}
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      )}
      <span className={ok ? "text-foreground" : "text-destructive"}>
        {label}
      </span>
    </div>
  );
}

function RawJsonBlock({ data }: { data: object }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-1">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 text-muted-foreground"
        title="Copy JSON"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className="text-[11px] font-mono bg-muted/30 rounded-md p-3 overflow-x-auto max-h-60 text-foreground/80">
        {json}
      </pre>
    </div>
  );
}

/** Legacy display for responses without checkResult (backward compat) */
function LegacyDisplay({
  verifyResponse,
}: {
  verifyResponse: VerifyResponse;
}) {
  const { valid, warnings } = verifyResponse;

  return (
    <div className="space-y-3">
      {valid ? (
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Valid x402 endpoint found!
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          Invalid x402 configuration
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Validation warnings
          </div>
          <ul className="list-disc list-inside text-xs space-y-0.5 ml-6">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
