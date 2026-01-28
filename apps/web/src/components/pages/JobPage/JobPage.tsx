"use client";

import { useAuth } from "@/contexts/AuthContext";
import { JobLoader } from "./components/JobLoader";
import { PublicJobView, type PublicJobData } from "./components/PublicJobView";
import { Loader2 } from "lucide-react";
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";

interface JobPageProps {
  jobId: string;
}

/**
 * Job page that shows either the editable canvas (for owners) or a public view.
 * Uses a single endpoint that returns isOwner based on the auth token.
 */
export default function JobPage({ jobId }: JobPageProps) {
  const { loading: authLoading } = useAuth();

  // Single endpoint - returns isOwner based on auth token
  const { data, isLoading } = useSWR<{ job: PublicJobData; isOwner: boolean }>(
    `/jobs/view/${jobId}`,
    authenticatedFetcher,
  );

  // If we have data, show the appropriate view
  if (data?.job) {
    if (data.isOwner) {
      return <JobLoader jobId={jobId} />;
    }
    return <PublicJobView job={data.job} />;
  }

  // Only show loading on initial load
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Job not found
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Job Not Found</h1>
        <p className="text-muted-foreground">
          This job doesn&apos;t exist or has been deleted.
        </p>
      </div>
    </div>
  );
}
