import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";

export interface Job {
  id: string;
  user_id?: string;
  name: string;
  slug?: string;
  owner_username?: string;
  description?: string;
  network: "solana" | "base";
  display_id?: number;
  trigger_type?: string;
  trigger_methods?: {
    manual: boolean;
    webhook: boolean;
  };
  creator_markup?: number;
  avatar_url?: string;
  published?: boolean;
  show_workflow?: boolean; // Whether to show workflow publicly (default: false)
  workflow_definition?: {
    nodes?: unknown[];
    edges?: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
  created_at: string;
  updated_at?: string;
  last_run_at?: string;
  on_success_job_id?: string | null;
}

interface JobResponse {
  job: Job;
  isOwner?: boolean;
}

/**
 * Fetch a single job by ID
 * Uses the unified view endpoint that returns owner status
 */
export function useJobQuery(jobId: string | null) {
  return useSWR<JobResponse>(
    jobId ? `/jobs/view/${jobId}` : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true, // Always fetch on mount
      shouldRetryOnError: false, // Don't retry on 404/403
    },
  );
}
