"use client";

import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { Tooltip } from "@x402jobs/ui/tooltip";
import { EntityAvatar } from "@/components/EntityAvatar";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { getSuccessRate, getSuccessRateColor } from "@/lib/format";
import { getNetwork } from "@/lib/networks";
import { Pencil, LayoutGrid, Layers } from "lucide-react";
import type { PublicJobData, WorkflowNode } from "../../types";

interface JobHeaderProps {
  job: PublicJobData;
  isOwner: boolean;
  jobPath: string;
  totalEarned: number;
  runCount: number;
  resourceNodes: WorkflowNode[];
  onEditClick: () => void;
}

export default function JobHeader({
  job,
  isOwner,
  jobPath,
  totalEarned,
  runCount,
  resourceNodes,
  onEditClick,
}: JobHeaderProps) {
  return (
    <div className="text-center pt-8 md:pt-12 pb-6">
      {/* Avatar */}
      <div className="flex justify-center mb-4">
        <EntityAvatar
          src={job.avatar_url}
          alt={job.name}
          type="job"
          size="3xl"
          className="border-2 border-border"
        />
      </div>

      {/* Name - Username portion clickable */}
      <h1 className="text-2xl md:text-3xl font-bold mb-3">
        {job.owner_username ? (
          <>
            <Link
              href={`/@${job.owner_username}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              @{job.owner_username}
            </Link>
            <span className="text-muted-foreground/50 mx-1">/</span>
            <span>
              {job.slug || job.name.toLowerCase().replace(/\s+/g, "-")}
            </span>
          </>
        ) : (
          jobPath
        )}
      </h1>

      {/* Description */}
      {job.description && (
        <p className="text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed">
          {job.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {/* Show "Chains N resources" for non-owners when workflow is hidden */}
          {!job.show_workflow && resourceNodes.length > 0 && (
            <>
              <Layers className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />
              Chains {resourceNodes.length} resource
              {resourceNodes.length !== 1 ? "s" : ""}
              <span className="mx-2">•</span>
            </>
          )}
          {/* Success Rate */}
          {(() => {
            const successRate = getSuccessRate(
              job.success_count_30d,
              job.failure_count_30d,
            );
            if (successRate !== null) {
              return (
                <>
                  <Tooltip
                    content={`${successRate}% of runs completed successfully in the last 30 days. If a job fails, unused resources are refunded.`}
                    maxWidth="xs"
                  >
                    <span
                      className={`font-medium ${getSuccessRateColor(successRate)} cursor-help`}
                    >
                      {successRate}% success
                    </span>
                  </Tooltip>
                  <span className="mx-2">•</span>
                </>
              );
            }
            return null;
          })()}
          {runCount.toLocaleString()} runs
          {/* Show earned badge for owners or when there are earnings */}
          {totalEarned > 0 && (
            <>
              <span className="mx-2">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                $
                {totalEarned > 1000
                  ? `${(totalEarned / 1000).toFixed(1)}k`
                  : totalEarned.toFixed(2)}{" "}
                earned
              </span>
            </>
          )}
          <span className="mx-2">•</span>
          <ChainIcon
            network={job.network}
            className={`inline h-3.5 w-3.5 -mt-0.5 ${getNetwork(job.network).id === "base" ? "text-blue-500" : "text-purple-500"}`}
          />
          <span className="ml-1">{getNetwork(job.network).name}</span>
        </p>
      </div>

      {/* Owner Actions */}
      {isOwner && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button variant="outline" onClick={onEditClick}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/jobs/${job.id}`} className="inline-flex items-center">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Open Canvas
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
