import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authenticatedFetch } from "@/lib/api";

interface TransferResult {
  success: boolean;
  message: string;
  newOwner: {
    id: string;
    username: string;
  };
}

export function useTransferJobMutation() {
  const { mutate } = useSWRConfig();

  const transferJob = useCallback(
    async (jobId: string, username: string): Promise<TransferResult> => {
      const response = await authenticatedFetch(`/jobs/${jobId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || "Failed to transfer job");
      }

      // Revalidate jobs list
      await mutate("/jobs");

      return await response.json();
    },
    [mutate],
  );

  return { transferJob };
}
