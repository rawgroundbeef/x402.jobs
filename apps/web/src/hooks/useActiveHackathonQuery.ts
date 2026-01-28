/**
 * Hook for fetching the active hackathon (for banner display)
 */

import useSWR from "swr";
import { publicFetcher } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

export interface ActiveHackathon {
  id: string;
  slug: string;
  name: string;
  number: number | null; // Sequential hackathon number (1, 2, 3...)
  ends_at: string | null; // Null means no deadline
  status: "upcoming" | "active" | "judging" | "complete";
}

interface ActiveHackathonResponse {
  hackathon: ActiveHackathon | null;
}

/**
 * Fetch the currently active hackathon
 */
export function useActiveHackathonQuery() {
  return useSWR<ActiveHackathonResponse>(
    `${API_URL}/hackathons/active`,
    publicFetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // Dedupe requests for 1 minute
    },
  );
}
