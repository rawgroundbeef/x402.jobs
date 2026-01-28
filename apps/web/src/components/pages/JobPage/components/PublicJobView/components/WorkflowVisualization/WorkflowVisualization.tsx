"use client";

import Link from "next/link";
import { EntityAvatar } from "@/components/EntityAvatar";
import {
  getResourceDisplayName,
  getSuccessRate,
  getSuccessRateColor,
} from "@/lib/format";
import {
  Webhook,
  ArrowRight,
  ArrowDown,
  FileOutput,
  Eye,
  Lock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { PublicJobData, WorkflowNode } from "../../types";

interface WorkflowVisualizationProps {
  job: PublicJobData;
  isOwner: boolean;
  resourceNodes: WorkflowNode[];
  triggerLabel: string;
}

export default function WorkflowVisualization({
  job,
  isOwner,
  resourceNodes,
  triggerLabel,
}: WorkflowVisualizationProps) {
  if (resourceNodes.length === 0 || (!isOwner && !job.show_workflow)) {
    return null;
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          WORKFLOW
        </h2>
        {/* Owner visibility indicator */}
        {isOwner && (
          <Link
            href={`/jobs/${job.id}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              job.show_workflow
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {job.show_workflow ? (
              <>
                <Eye className="h-3 w-3" />
                Visible to public
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                Hidden from public
              </>
            )}
          </Link>
        )}
      </div>

      {/* Desktop: Adaptive density based on resource count */}
      <div className="hidden md:block">
        {resourceNodes.length === 1 ? (
          /* Compact Inline: Single resource - minimal trigger/output, focused resource */
          <div className="flex items-center justify-center gap-2">
            {/* Trigger Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {triggerLabel}
              </span>
            </div>

            <span className="text-muted-foreground text-sm">→</span>

            {/* Single Resource - slightly wider */}
            <ResourceNode
              node={resourceNodes[0]}
              isLast={true}
              variant="compact"
            />

            <span className="text-muted-foreground text-sm">→</span>

            {/* Output Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
              <FileOutput className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Output
              </span>
            </div>
          </div>
        ) : resourceNodes.length <= 3 ? (
          /* Tighter Spacing: 2-3 resources - reduced gaps, centered */
          <div className="flex items-center justify-center gap-2">
            {/* Trigger Node */}
            <div className="flex-shrink-0 w-24 p-2.5 rounded-xl bg-muted/50 border border-border text-center">
              <Webhook className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs font-medium">{triggerLabel}</p>
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* Resource Nodes */}
            {resourceNodes.map((node, index) => (
              <ResourceNode
                key={node.id}
                node={node}
                isLast={index === resourceNodes.length - 1}
                variant="tight"
              />
            ))}

            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* Output Node */}
            <div className="flex-shrink-0 w-24 p-2.5 rounded-xl bg-muted/50 border border-border text-center">
              <FileOutput className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs font-medium">Output</p>
            </div>
          </div>
        ) : (
          /* Full Layout: 4+ resources - scrollable with fixed trigger/output */
          <div className="flex items-center gap-3">
            {/* Trigger Node - fixed left */}
            <div className="flex-shrink-0 w-28 p-3 rounded-xl bg-muted/50 border border-border text-center">
              <Webhook className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-xs font-medium">{triggerLabel}</p>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />

            {/* Resource Nodes - scrollable middle section */}
            <div className="flex-1 min-w-0 relative">
              {/* Fade edges for scroll hint */}
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

              <div
                className="overflow-x-auto px-2"
                style={{ scrollbarWidth: "thin" }}
              >
                <div className="flex items-center gap-3 py-1">
                  {resourceNodes.map((node, index) => (
                    <ResourceNode
                      key={node.id}
                      node={node}
                      isLast={index === resourceNodes.length - 1}
                      variant="desktop"
                    />
                  ))}
                </div>
              </div>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />

            {/* Output Node - fixed right */}
            <div className="flex-shrink-0 w-28 p-3 rounded-xl bg-muted/50 border border-border text-center">
              <FileOutput className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-xs font-medium">Output</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Vertical */}
      <div className="flex md:hidden flex-col items-center gap-2">
        {/* Trigger Node */}
        <div className="w-full max-w-xs p-3 rounded-xl bg-muted/50 border border-border text-center">
          <div className="flex items-center justify-center gap-2">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{triggerLabel}</span>
          </div>
        </div>

        <ArrowDown className="h-5 w-5 text-muted-foreground" />

        {/* Resource Nodes */}
        {resourceNodes.map((node, index) => (
          <ResourceNode
            key={node.id}
            node={node}
            isLast={index === resourceNodes.length - 1}
            variant="mobile"
          />
        ))}

        <ArrowDown className="h-5 w-5 text-muted-foreground" />

        {/* Output Node */}
        <div className="w-full max-w-xs p-3 rounded-xl bg-muted/50 border border-border text-center">
          <div className="flex items-center justify-center gap-2">
            <FileOutput className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Output</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ResourceNodeProps {
  node: WorkflowNode;
  isLast: boolean;
  variant: "desktop" | "mobile" | "compact" | "tight";
}

function ResourceNode({ node, isLast, variant }: ResourceNodeProps) {
  const resource = node.data.resource!;
  const resourcePrice =
    typeof resource.price === "number"
      ? resource.price
      : parseFloat(String(resource.price).replace(/[^0-9.]/g, "")) || 0;

  // Get server slug from various possible fields
  const serverSlug =
    resource.serverSlug || resource.server?.slug || resource.server_slug || "";
  const resourceSlug = resource.slug || "";

  // Use the utility function for display name
  const displayName = getResourceDisplayName({
    ...resource,
    serverSlug,
  });

  // Build href - only link if we have both slugs
  const resourceHref =
    serverSlug && resourceSlug
      ? `/resources/${serverSlug}/${resourceSlug}`
      : "#";

  // Calculate success rate if available
  const successRate = getSuccessRate(
    resource.success_count_30d,
    resource.failure_count_30d,
  );

  // Determine if resource has a low success rate (warning indicator)
  const isHighRisk = successRate !== null && successRate < 80;
  const isReliable = successRate !== null && successRate >= 90;

  // Compact variant: Single resource, wider card, more prominent
  if (variant === "compact") {
    return (
      <Link
        href={resourceHref}
        className={`flex-shrink-0 w-48 p-4 rounded-xl bg-accent border transition-colors text-center group relative ${
          isHighRisk
            ? "border-yellow-500/50 hover:border-yellow-500"
            : "border-border hover:border-primary/50"
        }`}
      >
        {/* Status indicator */}
        {isHighRisk && (
          <AlertTriangle className="absolute -top-1.5 -right-1.5 h-4 w-4 text-yellow-500" />
        )}
        {isReliable && (
          <CheckCircle className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-500" />
        )}
        <EntityAvatar
          src={resource.avatarUrl}
          type="resource"
          size="md"
          className="mx-auto mb-2"
        />
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {displayName}
        </p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
          ${resourcePrice.toFixed(2)}
        </p>
        {successRate !== null && (
          <p
            className={`text-xs mt-1 flex items-center justify-center gap-1 ${getSuccessRateColor(successRate)}`}
          >
            {successRate}% success
          </p>
        )}
      </Link>
    );
  }

  // Tight variant: 2-3 resources, slightly smaller with tighter spacing
  if (variant === "tight") {
    return (
      <div className="contents">
        <Link
          href={resourceHref}
          className={`flex-shrink-0 w-36 p-2.5 rounded-xl bg-accent border transition-colors text-center group relative ${
            isHighRisk
              ? "border-yellow-500/50 hover:border-yellow-500"
              : "border-border hover:border-primary/50"
          }`}
        >
          {/* Status indicator */}
          {isHighRisk && (
            <AlertTriangle className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-yellow-500" />
          )}
          {isReliable && (
            <CheckCircle className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-emerald-500" />
          )}
          <EntityAvatar
            src={resource.avatarUrl}
            type="resource"
            size="sm"
            className="mx-auto mb-1"
          />
          <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
            {displayName}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            ${resourcePrice.toFixed(2)}
          </p>
          {successRate !== null && (
            <p className={`text-xs mt-0.5 ${getSuccessRateColor(successRate)}`}>
              {successRate}%
            </p>
          )}
        </Link>
        {!isLast && (
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    );
  }

  // Desktop variant: 4+ resources, original full-size layout
  if (variant === "desktop") {
    return (
      <div className="contents">
        <Link
          href={resourceHref}
          className={`flex-shrink-0 w-40 p-3 rounded-xl bg-accent border transition-colors text-center group relative ${
            isHighRisk
              ? "border-yellow-500/50 hover:border-yellow-500"
              : "border-border hover:border-primary/50"
          }`}
        >
          {/* Status indicator */}
          {isHighRisk && (
            <AlertTriangle className="absolute -top-1.5 -right-1.5 h-4 w-4 text-yellow-500" />
          )}
          {isReliable && (
            <CheckCircle className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-500" />
          )}
          <EntityAvatar
            src={resource.avatarUrl}
            type="resource"
            size="sm"
            className="mx-auto mb-1.5"
          />
          <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
            {displayName}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            ${resourcePrice.toFixed(2)}
          </p>
          {successRate !== null && (
            <p
              className={`text-xs mt-0.5 flex items-center justify-center gap-1 ${getSuccessRateColor(successRate)}`}
            >
              {successRate}%
            </p>
          )}
        </Link>
        {!isLast && (
          <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    );
  }

  // Mobile variant: Vertical layout
  return (
    <div className="contents">
      <Link
        href={resourceHref}
        className={`w-full max-w-xs p-3 rounded-xl bg-accent border transition-colors group relative ${
          isHighRisk
            ? "border-yellow-500/50 hover:border-yellow-500"
            : "border-border hover:border-primary/50"
        }`}
      >
        {/* Status indicator */}
        {isHighRisk && (
          <AlertTriangle className="absolute -top-1.5 -right-1.5 h-4 w-4 text-yellow-500" />
        )}
        {isReliable && (
          <CheckCircle className="absolute -top-1.5 -right-1.5 h-4 w-4 text-emerald-500" />
        )}
        <div className="flex items-center gap-3">
          <EntityAvatar src={resource.avatarUrl} type="resource" size="sm" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {displayName}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ${resourcePrice.toFixed(2)}
              </p>
              {successRate !== null && (
                <span className={`text-xs ${getSuccessRateColor(successRate)}`}>
                  • {successRate}%
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      {!isLast && <ArrowDown className="h-5 w-5 text-muted-foreground" />}
    </div>
  );
}
