"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Copy,
  Check,
  ChevronDown,
  Bot,
  Wrench,
  ExternalLink,
} from "lucide-react";
import { normalizeNetworkId } from "@/lib/networks";
import type { VerifyResponse } from "@/lib/x402-verify";

interface VerifyResultDetailsProps {
  verifyResponse: VerifyResponse;
}

// ============================================================================
// Shared layout primitives
// ============================================================================

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

export function ZoneCard({
  children,
  className = "p-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Kept unchanged
// ============================================================================

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

// ============================================================================
// Zone 2: Verdict Banner
// ============================================================================

function buildFixPrompt(
  errors: Array<{ message: string; field: string }>,
  warnings: Array<{ message: string; field: string }>,
  raw: object | null,
): string {
  const lines: string[] = [
    "I need help fixing my x402 payment configuration.",
    "",
    "Errors:",
  ];
  for (const e of errors) {
    lines.push(`- ${e.message} (${e.field})`);
  }
  if (warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const w of warnings) {
      lines.push(`- ${w.message} (${w.field})`);
    }
  }
  if (raw) {
    lines.push("", "Current config:", JSON.stringify(raw, null, 2));
  }
  lines.push("", "Please help me fix these issues. The x402 v2 format requires...");
  return lines.join("\n");
}

function CopyPromptButton({
  errors,
  warnings,
  raw,
}: {
  errors: Array<{ message: string; field: string }>;
  warnings: Array<{ message: string; field: string }>;
  raw: object | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const prompt = buildFixPrompt(errors, warnings, raw);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md border transition-colors ${
        copied
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-muted/50 border-border hover:bg-muted hover:border-border/80 text-muted-foreground"
      }`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy prompt
        </>
      )}
    </button>
  );
}

function VerdictBanner({
  valid,
  errors,
  warnings,
  warningCount,
  version,
  raw,
}: {
  valid: boolean;
  errors: Array<{ message: string; field: string; fix?: string }>;
  warnings: Array<{ message: string; field: string }>;
  warningCount: number;
  version: string;
  raw: object | null;
}) {
  const tint = valid
    ? "bg-primary/5 border-primary/30"
    : "bg-destructive/10 border-destructive/20 dark:bg-red-950/30 dark:border-red-900/50";
  const textColor = valid
    ? "text-primary"
    : "text-destructive dark:text-red-200";

  return (
    <div className={`rounded-lg border ${tint}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className={`flex items-center gap-2 text-sm font-medium ${textColor}`}>
          {valid ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {valid ? "Valid" : "Invalid"}
        </div>
        {errors.length > 0 && (
          <span className="text-sm text-muted-foreground">
            &middot; {errors.length} error{errors.length > 1 ? "s" : ""}
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-sm text-muted-foreground">
            &middot; {warningCount} warning{warningCount > 1 ? "s" : ""}
          </span>
        )}
        {version !== "unknown" && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-background/80 text-foreground/70">
            {version}
          </span>
        )}
      </div>

      {/* Inline errors */}
      {errors.length > 0 && (
        <div className="border-t border-destructive/20 dark:border-red-900/50 px-4 py-3 space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-destructive dark:text-red-300 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-destructive dark:text-red-200 font-medium">{err.message}</span>
                <span className="text-muted-foreground/60 font-mono text-[10px] ml-1.5">
                  {err.field}
                </span>
                {err.fix && (
                  <p className="text-muted-foreground mt-0.5">{err.fix}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fix help — only on error */}
      {!valid && errors.length > 0 && (
        <div className="border-t border-destructive/20 dark:border-red-900/50 px-4 py-3">
          <p className="text-sm text-muted-foreground mb-3">
            Fix these errors on your server, then re-validate.
          </p>
          <div className="rounded-md border border-border/50 bg-white/[0.03] overflow-hidden">
            {/* Row 1: Fix with AI */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Bot className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Fix with AI</p>
                <p className="text-[13px] text-muted-foreground">
                  Copy a ready-made prompt into any LLM
                </p>
              </div>
              <CopyPromptButton errors={errors} warnings={warnings} raw={raw} />
            </div>
            {/* Row 2: x402lint Skill */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-border/50">
              <Wrench className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">x402lint Skill</p>
                <p className="text-[13px] text-muted-foreground">
                  Install in Claude Code to auto-fix your config
                </p>
              </div>
              <a
                href="https://skills.sh/rawgroundbeef/x402check/x402lint"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[13px] text-primary hover:underline flex-shrink-0"
              >
                Open skill
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Zone 3: Configuration
// ============================================================================

function getNetworkColor(networkName: string): string {
  const normalized = normalizeNetworkId(networkName);
  if (normalized === "solana") return "bg-purple-500";
  if (normalized === "base") return "bg-blue-500";
  return "bg-gray-400";
}

function ChainCard({
  summary,
}: {
  summary: {
    network: string;
    networkName: string;
    payTo: string;
    amount: string;
    asset: string;
    assetSymbol: string | null;
    assetDecimals: number | null;
    scheme: string;
  };
}) {
  const dotColor = getNetworkColor(summary.network);

  return (
    <div className="bg-muted/30 rounded-md p-3">
      {/* Network header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-medium">{summary.networkName}</span>
      </div>

      {/* Key-value grid */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">Address</span>
        <span className="font-mono text-[11px] truncate" title={summary.payTo}>
          {truncateAddress(summary.payTo)}
        </span>

        <span className="text-muted-foreground">Amount</span>
        <span>
          {formatAmount(summary.amount, summary.assetDecimals)}{" "}
          {summary.assetSymbol || summary.asset}
        </span>

        <span className="text-muted-foreground">Asset</span>
        <span className="font-mono text-[11px] truncate" title={summary.asset}>
          {summary.assetSymbol
            ? `${summary.assetSymbol} (${truncateAddress(summary.asset)})`
            : truncateAddress(summary.asset)}
        </span>

        <span className="text-muted-foreground">Scheme</span>
        <span>{summary.scheme}</span>
      </div>
    </div>
  );
}

function ConfigurationZone({
  summary,
  version,
}: {
  summary: Array<{
    index: number;
    network: string;
    networkName: string;
    payTo: string;
    amount: string;
    asset: string;
    assetSymbol: string | null;
    assetDecimals: number | null;
    scheme: string;
  }>;
  version: string;
}) {
  if (summary.length === 0) return null;

  const versionLabel =
    version === "v2"
      ? "v2 (Canonical)"
      : version === "v1"
        ? "v1 (Legacy)"
        : "Unknown";

  return (
    <div>
      <SectionLabel>Configuration</SectionLabel>
      <ZoneCard>
        {/* Chain cards */}
        <div
          className={
            summary.length > 1
              ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
              : undefined
          }
        >
          {summary.map((s) => (
            <ChainCard key={s.index} summary={s} />
          ))}
        </div>

        {/* Format row */}
        <div className="border-t border-border/50 mt-3 pt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Format:</span>
          <span className="font-medium text-foreground">{versionLabel}</span>
        </div>
      </ZoneCard>
    </div>
  );
}

// ============================================================================
// Zone 4: Endpoint Checks
// ============================================================================

function CheckRow({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        {ok === true && (
          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        )}
        {ok === false && (
          <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
        )}
        {ok === null && (
          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className={ok === false ? "text-destructive" : "text-foreground"}>
          {label}
        </span>
      </div>
      <span className="text-muted-foreground">{detail}</span>
    </div>
  );
}

function EndpointChecksZone({
  extracted,
  source,
  version,
}: {
  extracted: boolean;
  source: "body" | "header" | null;
  version: string;
}) {
  // Derive config source detail
  let configDetail: string;
  let configOk: boolean;
  if (!extracted) {
    configDetail = "Not found";
    configOk = false;
  } else if (source === "body") {
    configDetail = "Found in response body";
    configOk = true;
  } else if (source === "header") {
    configDetail = "Found in header";
    configOk = true;
  } else {
    configDetail = "Not found";
    configOk = false;
  }

  // Header check: null if source isn't header (optional)
  const headerOk: boolean | null =
    source === "header" ? true : source === "body" ? null : null;
  const headerDetail =
    source === "header" ? "Present" : "Not present (optional)";

  // Version check
  const versionOk = version !== "unknown";
  const versionDetail =
    version === "v2"
      ? "Canonical format"
      : version === "v1"
        ? "Legacy format"
        : "Unknown";

  return (
    <div>
      <SectionLabel>Endpoint Checks</SectionLabel>
      <ZoneCard className="p-0 divide-y divide-border/50">
        <CheckRow ok={true} label="Returns 402" detail="Status code verified" />
        <CheckRow ok={true} label="CORS accessible" detail="Via proxy" />
        <CheckRow ok={configOk} label="Valid payment config" detail={configDetail} />
        <CheckRow
          ok={headerOk}
          label="PAYMENT-REQUIRED header"
          detail={headerDetail}
        />
        <CheckRow
          ok={versionOk}
          label={`Using ${version} format`}
          detail={versionDetail}
        />
      </ZoneCard>
    </div>
  );
}

// ============================================================================
// Zone 5: Details (expandable)
// ============================================================================

function DetailsRow({
  label,
  badge,
  badgeVariant = "muted",
  defaultOpen = false,
  children,
}: {
  label: string;
  badge?: string;
  badgeVariant?: "muted" | "warning";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const badgeColors = {
    muted: "bg-muted text-muted-foreground",
    warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
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
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function DetailsZone({
  warnings,
  raw,
}: {
  warnings: Array<{ field: string; message: string; fix?: string }>;
  raw: object | null;
}) {
  const hasWarnings = warnings.length > 0;
  const hasRaw = raw !== null;

  if (!hasWarnings && !hasRaw) return null;

  return (
    <div>
      <SectionLabel>Details</SectionLabel>
      <ZoneCard className="p-0 divide-y divide-border/50">
        {hasWarnings && (
          <DetailsRow
            label="Warnings"
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
          </DetailsRow>
        )}

        {hasRaw && (
          <DetailsRow label="Response body">
            <RawJsonBlock data={raw} />
          </DetailsRow>
        )}
      </ZoneCard>
    </div>
  );
}

// ============================================================================
// Main export
// ============================================================================

export function VerifyResultDetails({
  verifyResponse,
}: VerifyResultDetailsProps) {
  const cr = verifyResponse.checkResult;

  // Legacy fallback: no checkResult means old-style response
  if (!cr) {
    return <LegacyDisplay verifyResponse={verifyResponse} />;
  }

  const { valid, errors, warnings, summary, source, version, extracted } = cr;

  return (
    <div className="space-y-8">
      {/* Zone 2: Verdict */}
      <VerdictBanner
        valid={valid}
        errors={errors}
        warnings={warnings}
        warningCount={warnings.length}
        version={version}
        raw={cr.raw}
      />

      {/* Zone 3: Configuration */}
      <ConfigurationZone summary={summary} version={version} />

      {/* Zone 4: Endpoint Checks */}
      <EndpointChecksZone
        extracted={extracted}
        source={source}
        version={version}
      />

      {/* Zone 5: Details */}
      <DetailsZone warnings={warnings} raw={cr.raw} />
    </div>
  );
}
