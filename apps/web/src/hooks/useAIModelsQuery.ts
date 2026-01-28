import useSWR from "swr";
import { publicFetcher } from "@/lib/api";

export interface AIModel {
  id: string;
  openrouter_id: string;
  display_name: string;
  description: string | null;
  provider: string;
  modality: "text" | "image" | "video" | "audio" | "embedding" | "multimodal";
  is_curated: boolean;
  context_length: number | null;
  pricing_prompt: string | null;
  pricing_completion: string | null;
  vision_supported: boolean;
  web_search_supported: boolean;
  tool_calling_supported: boolean;
}

interface AIModelsResponse {
  models: AIModel[];
}

/**
 * Fetch all active AI models from the catalog
 * Uses publicFetcher since this is a public endpoint
 */
export function useAIModelsQuery() {
  const { data, error, isLoading } = useSWR<AIModelsResponse>(
    "/api/v1/ai-models",
    publicFetcher,
    {
      revalidateOnFocus: false, // Don't refetch on tab focus (stable data)
      dedupingInterval: 60000, // Cache for 1 minute
    },
  );

  return {
    models: data?.models || [],
    isLoading,
    error,
  };
}
