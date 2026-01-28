"use client";

import JobCanvas from "@/components/pages/JobCanvas";
import { useJobQuery } from "@/hooks/useJobQuery";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import Link from "next/link";

interface JobLoaderProps {
  jobId: string;
}

/**
 * Component that fetches and displays a job.
 * Only rendered when user is authenticated.
 */
export function JobLoader({ jobId }: JobLoaderProps) {
  const { data, error, isLoading } = useJobQuery(jobId);

  // Loading
  if (isLoading || (!data && !error)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading job...</p>
        </div>
      </div>
    );
  }

  // Error (not found or not owner)
  if (error || !data?.job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-semibold mb-2">Job Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This job doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild>
            <Link href="/">Create a New Job</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <JobCanvas initialJob={data.job} />;
}
