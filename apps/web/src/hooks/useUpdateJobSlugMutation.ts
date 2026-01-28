import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authenticatedFetch } from "@/lib/api";

export function useUpdateJobSlugMutation() {
  const { mutate } = useSWRConfig();

  const updateSlug = useCallback(
    async (jobId: string, slug: string) => {
      const response = await authenticatedFetch(`/jobs/${jobId}/slug`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || "Failed to update slug");
      }

      // Revalidate jobs list
      await mutate("/jobs");

      return await response.json();
    },
    [mutate],
  );

  return { updateSlug };
}
