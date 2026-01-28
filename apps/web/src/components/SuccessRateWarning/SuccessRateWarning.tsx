"use client";

import { AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@x402jobs/ui/utils";

interface SuccessRateWarningProps {
  /** Success rate as a percentage (0-100) */
  rate: number | null;
  /** Variant determines the display style */
  variant?: "box" | "inline" | "compact";
  /** Custom class name */
  className?: string;
  /** Show the "Learn about refunds" link */
  showLink?: boolean;
}

/**
 * Warning component for jobs with low success rates.
 *
 * Thresholds:
 * - 90%+ = No warning
 * - 80-89% = Subtle informational note
 * - <80% = Visible yellow warning
 */
export function SuccessRateWarning({
  rate,
  variant = "box",
  className,
  showLink = true,
}: SuccessRateWarningProps) {
  // No warning for high success rates or unknown rates
  if (rate === null || rate >= 90) return null;

  const isHighRisk = rate < 80;

  if (variant === "compact") {
    // Single line for button areas
    return (
      <p
        className={cn(
          "text-xs flex items-center gap-1",
          isHighRisk
            ? "text-yellow-600 dark:text-yellow-500"
            : "text-muted-foreground",
          className,
        )}
      >
        {isHighRisk ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <Info className="w-3 h-3" />
        )}
        {rate}% success — some runs may fail
      </p>
    );
  }

  if (variant === "inline") {
    // Inline text, no box
    return (
      <p
        className={cn(
          "text-sm flex items-center gap-1.5",
          isHighRisk
            ? "text-yellow-600 dark:text-yellow-500"
            : "text-muted-foreground",
          className,
        )}
      >
        {isHighRisk ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <Info className="w-3.5 h-3.5" />
        )}
        This job has a {rate}% success rate.
        {isHighRisk && " Some runs may fail."}
      </p>
    );
  }

  // Box variant (default) - full warning box
  if (!isHighRisk) {
    // 80-89%: subtle inline note
    return (
      <p
        className={cn(
          "text-sm text-muted-foreground flex items-center gap-1.5",
          className,
        )}
      >
        <Info className="w-3.5 h-3.5" />
        This job has an {rate}% success rate. Some runs may fail.
      </p>
    );
  }

  // <80%: visible warning box
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20",
        className,
      )}
    >
      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm space-y-1">
        <p className="text-foreground">
          This job has a <span className="font-semibold">{rate}%</span> success
          rate.
        </p>
        <p className="text-muted-foreground">
          Some runs may fail. You'll be refunded for resources that didn't run,
          but not for resources that ran and failed.
        </p>
        {showLink && (
          <Link
            href="/docs/refunds"
            className="text-primary hover:underline inline-flex items-center gap-1 mt-1"
          >
            Learn about refunds →
          </Link>
        )}
      </div>
    </div>
  );
}

export default SuccessRateWarning;
