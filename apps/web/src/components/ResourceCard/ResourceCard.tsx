"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Box,
  CheckCircle,
  Trash2,
  Loader2,
  ChevronRight,
  Play,
} from "lucide-react";
import { Card } from "@x402jobs/ui/card";
import { Tooltip } from "@x402jobs/ui/tooltip";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { TryResourceButton } from "@/components/TryResourceButton";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice } from "@/lib/format";

export interface ResourceCardData {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  server_slug?: string;
  server_name?: string;
  output_schema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  is_verified?: boolean;
  is_a2a?: boolean;
  supports_refunds?: boolean;
  registered_by?: string;
  call_count?: number;
  resource_type?:
    | "external"
    | "proxy"
    | "prompt"
    | "static"
    | "prompt_template"
    | "openrouter_instant";
}

interface ResourceCardProps {
  resource: ResourceCardData;
  /** Override server slug (used when listing resources within a server) */
  serverSlug?: string;
  /** Fallback favicon from server */
  serverFaviconUrl?: string;
  /** Show delete button */
  canDelete?: boolean;
  /** Callback when resource is deleted */
  onDelete?: (resourceId: string) => void;
  /** Show try button */
  showTryButton?: boolean;
  /** Show chevron arrow (for list navigation) */
  showChevron?: boolean;
  /** Card variant */
  variant?: "default" | "compact";
}

export function ResourceCard({
  resource,
  serverSlug,
  serverFaviconUrl,
  canDelete = false,
  onDelete,
  showTryButton = false,
  showChevron = false,
  variant = "default",
}: ResourceCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(`/resources/${resource.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete?.(resource.id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete resource");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete resource");
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const effectiveServerSlug = serverSlug || resource.server_slug;
  const displayPath = `${effectiveServerSlug}/${resource.slug}`;
  const resourceHref = `/resources/${effectiveServerSlug}/${resource.slug}`;

  const avatarUrl =
    resource.avatar_url ||
    (resource.extra as { avatarUrl?: string })?.avatarUrl ||
    serverFaviconUrl;

  const priceDisplay = formatPrice(resource.max_amount_required);

  const displayUrl = resource.resource_url;

  const isCompact = variant === "compact";

  const cardContent = (
    <div className={`flex items-start ${isCompact ? "gap-3" : "gap-4"}`}>
      {/* Avatar */}
      <div
        className={`${isCompact ? "w-10 h-10" : "w-10 h-10"} rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                parent.innerHTML =
                  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
              }
            }}
          />
        ) : (
          <Box className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold truncate">{displayPath}</span>
          {resource.is_verified && (
            <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          )}
        </div>
        <p
          className="text-sm text-muted-foreground truncate"
          title={displayUrl}
        >
          {displayUrl}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Delete button */}
        {canDelete &&
          (showConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors"
              >
                {isDeleting ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent text-foreground transition-colors border border-border"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowConfirm(true);
              }}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete resource"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ))}

        {/* A2A Badge */}
        {resource.is_a2a && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20"
            title="Agent-to-Agent Protocol"
          >
            A2A
          </span>
        )}

        {/* OpenRouter Badge */}
        {resource.resource_type === "openrouter_instant" && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
            title="OpenRouter AI Model"
          >
            AI
          </span>
        )}

        {/* Refund Badge */}
        {resource.supports_refunds && (
          <Tooltip
            content={
              <>
                Refunds provided by{" "}
                <a
                  href="https://openfacilitator.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-300"
                >
                  OpenFacilitator.io
                </a>
                . If the request fails, you&apos;ll be automatically refunded.
              </>
            }
          >
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 cursor-help">
              <img
                src="/badges/shield-icon.svg"
                alt=""
                className="h-3 w-3 mr-0.5"
              />
              Refund
            </span>
          </Tooltip>
        )}

        {/* Network Badge */}
        <span
          className={`flex items-center justify-center w-6 h-6 rounded ${
            resource.network?.toLowerCase() === "base"
              ? "bg-blue-500/10 text-blue-500"
              : "bg-purple-500/10 text-purple-500"
          }`}
          title={resource.network?.toLowerCase() === "base" ? "Base" : "Solana"}
        >
          <ChainIcon
            network={resource.network || "solana"}
            className="w-3.5 h-3.5"
          />
        </span>

        {/* Price - Green pill style */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          {priceDisplay}
        </span>

        {/* Call count */}
        {resource.call_count !== undefined && resource.call_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Play className="w-3 h-3" />
            {resource.call_count.toLocaleString()} calls
          </span>
        )}

        {/* Try Button */}
        {showTryButton && (
          <TryResourceButton
            size="xs"
            resource={{
              id: resource.id,
              name: resource.name,
              slug: resource.slug,
              server_slug: effectiveServerSlug,
              description: resource.description,
              resource_url: resource.resource_url,
              network: resource.network,
              max_amount_required: resource.max_amount_required,
              avatar_url: avatarUrl,
              output_schema: resource.output_schema as any,
              extra: resource.extra,
            }}
          />
        )}

        {/* Chevron */}
        {showChevron && (
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
    </div>
  );

  // If showChevron, wrap entire card in Link
  if (showChevron) {
    return (
      <Link href={resourceHref} className="block">
        <Card
          className={`${isCompact ? "p-3" : "p-4"} hover:bg-accent/50 transition-colors`}
        >
          {cardContent}
          {resource.description && (
            <p
              className={`text-muted-foreground mt-2 line-clamp-2 ${isCompact ? "text-xs" : "text-sm"}`}
            >
              {resource.description}
            </p>
          )}
        </Card>
      </Link>
    );
  }

  // Otherwise, just the card with clickable title
  return (
    <Card
      className={`${isCompact ? "p-3 bg-muted/50" : "p-4"} hover:bg-accent/50 transition-colors`}
    >
      <div className={`flex items-start ${isCompact ? "gap-3" : "gap-4"}`}>
        {/* Avatar - clickable link */}
        <Link
          href={resourceHref}
          className={`${isCompact ? "w-10 h-10" : "w-10 h-10"} rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border/50 hover:border-primary/50 transition-colors`}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
                }
              }}
            />
          ) : (
            <Box className="w-5 h-5 text-muted-foreground" />
          )}
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={resourceHref}
              className="font-bold truncate hover:text-primary transition-colors"
            >
              {displayPath}
            </Link>
            {resource.is_verified && (
              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            )}
          </div>
          <p
            className="text-xs text-muted-foreground truncate mt-0.5"
            title={displayUrl}
          >
            {displayUrl}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Delete button */}
          {canDelete &&
            (showConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors"
                >
                  {isDeleting ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent text-foreground transition-colors border border-border"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete resource"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ))}

          {/* Network Badge */}
          <span
            className={`flex items-center justify-center w-6 h-6 rounded ${
              resource.network?.toLowerCase() === "base"
                ? "bg-blue-500/10 text-blue-500"
                : "bg-purple-500/10 text-purple-500"
            }`}
            title={
              resource.network?.toLowerCase() === "base" ? "Base" : "Solana"
            }
          >
            <ChainIcon
              network={resource.network || "solana"}
              className="w-3.5 h-3.5"
            />
          </span>

          {/* Price - Green pill style */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            {priceDisplay}
          </span>

          {/* Call count */}
          {resource.call_count !== undefined && resource.call_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Play className="w-3 h-3" />
              {resource.call_count.toLocaleString()}
            </span>
          )}

          {/* Try Button */}
          {showTryButton && (
            <TryResourceButton
              size="xs"
              resource={{
                id: resource.id,
                name: resource.name,
                slug: resource.slug,
                server_slug: effectiveServerSlug,
                description: resource.description,
                resource_url: resource.resource_url,
                network: resource.network,
                max_amount_required: resource.max_amount_required,
                avatar_url: avatarUrl,
                output_schema: resource.output_schema as any,
                extra: resource.extra,
              }}
            />
          )}
        </div>
      </div>

      {/* Description */}
      {resource.description && (
        <p
          className={`text-muted-foreground mt-2 leading-relaxed line-clamp-2 ${isCompact ? "text-xs" : "text-sm"}`}
        >
          {resource.description}
        </p>
      )}
    </Card>
  );
}
