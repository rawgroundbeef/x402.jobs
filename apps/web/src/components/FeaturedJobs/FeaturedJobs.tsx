"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ListCard } from "@/components/ListCard";
import { formatUsd } from "@/lib/format";

interface PublicJob {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_username: string;
  price: number;
  run_count: number;
  total_earnings_usdc: number;
  avatar_url: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

export function FeaturedJobs() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch(
          `${API_BASE}/jobs/public?sort=earnings&limit=6`,
        );
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (e) {
        console.error("Failed to fetch public jobs:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <div className="py-8 px-4 sm:px-6">
        <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
          Featured Jobs
        </h2>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 bg-muted/30 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="py-8 px-4 sm:px-6">
      <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
        Featured Jobs
      </h2>
      <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
        {jobs.map((job) => (
          <ListCard
            key={job.id}
            href={`/@${job.owner_username}/${job.slug}`}
            avatarUrl={job.avatar_url}
            name={`@${job.owner_username}/${job.slug}`}
            description={job.description}
            price={
              job.total_earnings_usdc > 0
                ? formatUsd(job.total_earnings_usdc)
                : undefined
            }
            priceSuffix="earned"
            countLabel={
              job.run_count > 0
                ? `${job.run_count.toLocaleString()} runs`
                : undefined
            }
            type="job"
            variant="featured"
          />
        ))}
      </div>
      <div className="text-center mt-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          Browse all jobs
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
