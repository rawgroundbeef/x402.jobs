import { useCallback, useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";

interface WorkflowStep {
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
  inputMapping?: Record<
    string,
    string | { type: "reference"; sourceNodeId: string; sourceField: string }
  >;
}

// Clarification for ambiguous/inferred values
export interface Clarification {
  nodeId: string;
  resourceName: string;
  fieldName: string;
  fieldDescription: string;
  inferredValue: string;
  question: string;
  confidence: "high" | "medium" | "low";
}

interface WorkflowProposal {
  name: string;
  description: string;
  network: string;
  estimatedCost: number;
  steps: WorkflowStep[];
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
  clarifications?: Clarification[];
}

export interface ProposalResponse {
  proposal: WorkflowProposal;
  reasoning: string;
  planningMethod: string;
}

interface GenerateWorkflowParams {
  request: string;
  network: NetworkType;
}

export interface GenerateError {
  message: string;
  suggestion?: string;
  isNoResourcesError?: boolean;
}

export function useGenerateWorkflowProposalMutation() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<GenerateError | null>(null);

  const generateProposal = useCallback(
    async (params: GenerateWorkflowParams): Promise<ProposalResponse> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await authenticatedFetch("/workflow/propose", {
          method: "POST",
          body: JSON.stringify({
            request: params.request.trim(),
            network: params.network,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          const errorMessage = data.error || "Failed to generate workflow";
          const isNoResourcesError =
            response.status === 404 &&
            errorMessage.includes("No matching resources");

          const errorObj: GenerateError = {
            message: errorMessage,
            suggestion: data.suggestion,
            isNoResourcesError,
          };
          setError(errorObj);
          throw errorObj;
        }

        return await response.json();
      } catch (err) {
        // If it's already our error object, just rethrow
        if (
          err &&
          typeof err === "object" &&
          "message" in err &&
          "isNoResourcesError" in err
        ) {
          throw err;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong";
        const errorObj: GenerateError = { message: errorMessage };
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { generateProposal, isGenerating, error, clearError };
}
