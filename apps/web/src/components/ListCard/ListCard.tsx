"use client";

import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { Card } from "@x402jobs/ui/card";
import { EntityAvatar, EntityType } from "@/components/EntityAvatar";

export interface ListCardProps {
  /** Navigation href */
  href: string;
  /** Avatar/icon image URL */
  avatarUrl?: string | null;
  /** Display name (e.g., @username/job-name or server/resource) */
  name: string;
  /** Optional description - truncated to one line */
  description?: string | null;
  /** Price to display in green pill */
  price?: string;
  /** Optional suffix for price (e.g., "earned") */
  priceSuffix?: string;
  /** Count label (e.g., "187 runs" or "234 calls") */
  countLabel?: string;
  /** Success rate display (e.g., "94%") with optional color class */
  successRate?: { text: string; colorClass?: string; isNew?: boolean };
  /** Type of card - affects fallback icon */
  type?: "job" | "resource" | "server";
  /** Card variant */
  variant?: "default" | "featured";
}

/**
 * Unified list card component for jobs, resources, and servers.
 * Used across homepage, list pages, and profile pages.
 */
export function ListCard({
  href,
  avatarUrl,
  name,
  description,
  price,
  priceSuffix,
  countLabel,
  successRate,
  type = "job",
  variant = "default",
}: ListCardProps) {
  const isFeatured = variant === "featured";

  return (
    <Link href={href} className="block group">
      <Card
        className={`${isFeatured ? "p-4 sm:p-6" : "p-3 sm:p-4"} h-full hover:bg-accent/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01] transition-all duration-200 ease-out`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          <EntityAvatar
            src={avatarUrl}
            type={type as EntityType}
            size={isFeatured ? "lg" : "md"}
            className="group-hover:scale-105 transition-transform mt-0.5 flex-shrink-0"
          />

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p
              className={`font-bold ${isFeatured ? "text-base sm:text-lg" : ""} truncate mb-1`}
            >
              {name}
            </p>
            {description && (
              <p
                className={`text-sm text-muted-foreground ${isFeatured ? "line-clamp-2 leading-relaxed" : "truncate"}`}
              >
                {description}
              </p>
            )}
            {/* Price, success rate, and count */}
            <div
              className={`flex items-center gap-4 ${isFeatured ? "mt-4" : "mt-2"}`}
            >
              {price && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  {price}
                  {priceSuffix ? ` ${priceSuffix}` : ""}
                </span>
              )}
              {successRate && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    successRate.isNew
                      ? "px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      : successRate.colorClass || "text-muted-foreground"
                  }`}
                >
                  {successRate.isNew
                    ? successRate.text
                    : `${successRate.text} success`}
                </span>
              )}
              {countLabel && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Play className="w-3 h-3" />
                  {countLabel}
                </span>
              )}
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>
      </Card>
    </Link>
  );
}
