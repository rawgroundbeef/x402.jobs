import { Inngest } from "inngest";

// Create the Inngest client for x402-jobs
export const inngest = new Inngest({
  id: "x402-jobs",
  // In production, set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY env vars
});

// Resource input from the workflow
interface ResourceInput {
  resourceId: string;
  resourceUrl: string;
  resourceName: string;
  resourcePrice: number;
  network: string;
  inputs: Record<string, string>; // Form data for this resource
}

// Event: Start a workflow run
export interface WorkflowRunEvent {
  name: "x402/workflow.run";
  data: {
    runId: string;
    jobId: string;
    userId: string;
    walletPublicKey: string;
    walletSecretKey: string; // Encrypted or from secure storage
    resources: ResourceInput[];
  };
}

// Union type for all events
export type X402Events = {
  "x402/workflow.run": WorkflowRunEvent;
};
