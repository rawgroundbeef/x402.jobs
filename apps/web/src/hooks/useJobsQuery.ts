import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";
import type { SavedJob } from "@/hooks/useWorkflowPersistence";

interface JobsResponse {
  jobs: SavedJob[];
}

/**
 * Fetch the current user's jobs
 * Returns empty array if not authenticated
 */
export function useJobsQuery(isAuthenticated: boolean) {
  return useSWR<JobsResponse>(
    isAuthenticated ? "/jobs" : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
    },
  );
}
