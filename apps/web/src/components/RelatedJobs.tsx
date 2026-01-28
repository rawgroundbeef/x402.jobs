"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { publicFetcher } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { EntityAvatar } from "@/components/EntityAvatar";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { Button } from "@x402jobs/ui/button";
import { Play, ChevronRight, Loader2, Zap } from "lucide-react";

interface RelatedJob {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  network: string;
  price: number;
  owner_username?: string;
  owner_avatar_url?: string;
  run_count: number;
  avatar_url?: string;
  created_at: string;
}

interface RelatedJobsProps {
  resourceId: string;
  onUseInJob?: () => void;
  isCreatingJob?: boolean;
}

export function RelatedJobs({
  resourceId,
  onUseInJob,
  isCreatingJob,
}: RelatedJobsProps) {
  const [jobs, setJobs] = useState<RelatedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        const data = (await publicFetcher(
          `/jobs/by-resource/${resourceId}?limit=6`,
        )) as {
          jobs: RelatedJob[];
          total: number;
          hasMore: boolean;
        };
        setJobs(data.jobs || []);
        setTotal(data.total || 0);
        setHasMore(data.hasMore || false);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch related jobs:", err);
        setError("Failed to load jobs");
      } finally {
        setLoading(false);
      }
    }

    if (resourceId) {
      fetchJobs();
    }
  }, [resourceId]);

  // Don't render anything while loading initially
  if (loading) {
    return (
      <section className="mt-12 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-6">Jobs using this resource</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  // Error state - just don't show the section
  if (error) {
    return null;
  }

  // Empty state with CTA
  if (jobs.length === 0) {
    return (
      <section className="mt-12 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-6">Jobs using this resource</h2>
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-1">No jobs yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Be the first to build with this resource.
          </p>
          <div className="flex items-center justify-center gap-2">
            {onUseInJob && (
              <Button onClick={onUseInJob} disabled={isCreatingJob}>
                {isCreatingJob ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Use in Job
                  </>
                )}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/jobs/new">Create New Job</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Jobs using this resource</h2>
        {hasMore && (
          <Link
            href={`/jobs?resource=${resourceId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View all {total} jobs
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}

function JobCard({ job }: { job: RelatedJob }) {
  const jobUrl =
    job.owner_username && job.slug
      ? `/@${job.owner_username}/${job.slug}`
      : `/jobs/${job.id}`;

  const priceDisplay = formatPrice(String(job.price * 1_000_000));

  return (
    <Link
      href={jobUrl}
      className="group block p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Job Avatar */}
        <EntityAvatar src={job.avatar_url} type="job" size="sm" />

        <div className="flex-1 min-w-0">
          {/* Job Name */}
          <p className="font-medium truncate group-hover:text-primary transition-colors">
            {job.name}
          </p>

          {/* Creator */}
          <div className="flex items-center gap-1.5 mt-1">
            {job.owner_avatar_url ? (
              <img
                src={job.owner_avatar_url}
                alt=""
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-muted" />
            )}
            <span className="text-xs text-muted-foreground truncate">
              @{job.owner_username || "unknown"}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Play className="h-3 w-3" />
              {job.run_count.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Price and Network */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {priceDisplay}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ChainIcon
            network={job.network}
            className={`h-3.5 w-3.5 ${
              job.network === "base" ? "text-blue-500" : "text-purple-500"
            }`}
          />
          <span className="capitalize">{job.network}</span>
        </div>
      </div>
    </Link>
  );
}
