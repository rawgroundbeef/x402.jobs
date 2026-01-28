import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { authenticatedFetch } from "@/lib/api";

interface WorkflowProposal {
  name: string;
  description: string;
  network: string;
  estimatedCost: number;
  steps: Array<{
    order: number;
    resourceId: string;
    resourceName: string;
    resourceSlug?: string;
    resourceUrl: string;
    price: number;
    purpose: string;
    serverId?: string;
    serverName?: string;
    serverSlug?: string;
    outputSchema?: Record<string, unknown>;
  }>;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

interface CreateWorkflowJobResult {
  job: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
}

export function useCreateWorkflowJobMutation() {
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFromProposal = useCallback(
    async (proposal: WorkflowProposal): Promise<CreateWorkflowJobResult> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await authenticatedFetch("/workflow/create", {
          method: "POST",
          body: JSON.stringify({ proposal }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || "Failed to create job");
        }

        const result = await response.json();

        // Revalidate jobs list
        await mutate("/jobs");

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create job";
        setError(errorMessage);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [mutate],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { createFromProposal, isCreating, error, clearError };
}
