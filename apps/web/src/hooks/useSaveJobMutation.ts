import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authenticatedFetch } from "@/lib/api";

interface SaveJobParams {
  name?: string;
  description?: string;
  triggerType?: string;
  triggerMethods?: {
    manual: boolean;
    webhook: boolean;
    schedule?: boolean;
  };
  creatorMarkup?: number;
  avatarUrl?: string;
  workflow_data?: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: unknown;
  };
  scheduleConfig?: {
    cron: string;
    timezone: string;
    enabled: boolean;
  };
  published?: boolean;
  showWorkflow?: boolean;
  onSuccessJobId?: string | null;
  webhookResponse?: {
    mode: "passthrough" | "template" | "confirmation";
    template?: string;
    successMessage?: string;
  };
}

export function useSaveJobMutation() {
  const { mutate } = useSWRConfig();

  const saveJob = useCallback(
    async (jobId: string, params: SaveJobParams) => {
      const response = await authenticatedFetch(`/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save job");
      }

      // Revalidate jobs list and the specific job
      await mutate("/jobs");
      await mutate(`/jobs/${jobId}`);
      await mutate(`/jobs/view/${jobId}`);

      return await response.json();
    },
    [mutate],
  );

  return { saveJob };
}
