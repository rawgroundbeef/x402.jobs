"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  PublicJobView,
  type PublicJobData,
} from "@/components/pages/JobPage/components/PublicJobView";
import { Loader2 } from "lucide-react";
import useSWR from "swr";
import { authenticatedFetcher, publicFetcher } from "@/lib/api";

interface PublicJobPageProps {
  username: string;
  slug: string;
}

interface JobResponse {
  job: PublicJobData & { id: string };
  isOwner: boolean;
}

/**
 * Public job page at /@username/slug
 * Always shows the public view, with an edit button if the viewer owns the job.
 */
export default function PublicJobPage({ username, slug }: PublicJobPageProps) {
  const { user, loading: authLoading } = useAuth();

  // Fetch job by username and slug
  // Include user id in key so it re-fetches when auth state changes
  const { data, isLoading, error } = useSWR<JobResponse>(
    authLoading
      ? null
      : `/jobs/view/${username}/${slug}?uid=${user?.id || "anon"}`,
    user ? authenticatedFetcher : publicFetcher,
  );

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error or not found
  if (error || !data?.job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-xl font-semibold mb-2">Job Not Found</h1>
          <p className="text-muted-foreground">
            This job doesn&apos;t exist or is not publicly available.
          </p>
        </div>
      </div>
    );
  }

  return <PublicJobView job={data.job} isOwner={data.isOwner} />;
}
