// Re-export shared LRO types for backwards compatibility
export type {
  PollStep,
  LROResult as JobResult,
  LROPayment as JobPayment,
} from "@/components/lro";

export interface WorkflowNode {
  id: string;
  type: string;
  data: {
    resource?: {
      id: string;
      name: string;
      displayName?: string;
      description?: string;
      price?: string | number;
      avatarUrl?: string;
      resourceUrl?: string;
      server?: { slug?: string };
      slug?: string;
      serverSlug?: string;
      server_slug?: string;
      success_count_30d?: number;
      failure_count_30d?: number;
      outputSchema?: {
        input?: {
          type?: string;
          method?: string;
          bodyType?: string;
          bodyFields?: Record<
            string,
            {
              type?: string;
              required?: boolean;
              description?: string;
            }
          >;
        };
      };
    };
  };
}

export interface PublicJobData {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  network: string;
  owner_username?: string;
  avatar_url?: string;
  workflow_definition?: {
    nodes?: WorkflowNode[];
    edges?: Array<{ source: string; target: string }>;
  };
  trigger_methods?: Record<string, boolean>;
  trigger_type?: string;
  webhook_url?: string;
  webhook_input_schema?: Record<
    string,
    {
      type?: string;
      required?: boolean;
      description?: string;
    }
  >;
  creator_markup?: number;
  total_earnings_usdc?: string;
  run_count?: number;
  success_count_30d?: number;
  failure_count_30d?: number;
  created_at: string;
  is_active: boolean;
  is_public?: boolean;
  show_workflow?: boolean;
}

export type TabType = "overview" | "api" | "activity";
