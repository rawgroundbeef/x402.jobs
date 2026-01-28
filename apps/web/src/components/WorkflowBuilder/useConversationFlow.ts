"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "./ConversationContext";
import { authenticatedFetch } from "@/lib/api";
import type { ResourceMatch, WorkflowStep, JobParameter } from "./types";

interface ProposalStep {
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
}

interface Clarification {
  nodeId: string;
  fieldName: string;
  fieldDescription: string;
  inferredValue: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

interface WorkflowProposal {
  name: string;
  description: string;
  network: string;
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
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  steps: ProposalStep[];
  estimatedCost: number;
  clarifications?: Clarification[];
}

interface ProposalResponse {
  proposal: WorkflowProposal;
  resources: ResourceMatch[];
  reasoning?: string;
  planningMethod: string;
}

interface CreateJobResponse {
  job: {
    id: string;
    name: string;
    slug?: string;
  };
  estimatedCost: number;
}

export function useConversationFlow() {
  const router = useRouter();
  const {
    state,
    setLoading,
    setError,
    addUserMessage,
    addAssistantMessage,
    updateWorkflow,
    setStep,
    setResources,
    setParameters,
    selectedResources,
    exposedParameters,
  } = useConversation();

  const abortControllerRef = useRef<AbortController | null>(null);
  const proposalRef = useRef<WorkflowProposal | null>(null);

  // Cancel any ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Generate workflow proposal using existing API (POST request)
  const generateProposal = useCallback(
    async (prompt: string): Promise<ProposalResponse> => {
      const response = await authenticatedFetch("/workflow/propose", {
        method: "POST",
        body: JSON.stringify({
          request: prompt,
          network: state.workflow.network,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [state.workflow.network],
  );

  // Create job from proposal (POST request)
  const createJob = useCallback(
    async (proposal: WorkflowProposal): Promise<CreateJobResponse> => {
      const response = await authenticatedFetch("/workflow/create", {
        method: "POST",
        body: JSON.stringify({ proposal }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [],
  );

  // Handle initial prompt - generate proposal directly (simplified flow)
  const handleInitialPrompt = useCallback(
    async (prompt: string) => {
      cancelRequest();
      abortControllerRef.current = new AbortController();

      addUserMessage(prompt);
      setLoading(true);
      setError(null);

      try {
        // Generate proposal directly using the working /workflow/propose endpoint
        const response = await generateProposal(prompt);
        proposalRef.current = response.proposal;

        // Extract resources from proposal steps
        const resources: ResourceMatch[] = response.proposal.steps.map(
          (step) => ({
            id: step.resourceId,
            name: step.resourceName,
            slug: step.resourceSlug,
            description: step.purpose,
            price: step.price,
            serverSlug: step.serverSlug,
            serverName: step.serverName,
            network: response.proposal.network,
            outputSchema: step.outputSchema,
            selected: true, // All selected since they're from the proposal
          }),
        );

        if (resources.length === 0) {
          addAssistantMessage(
            "I couldn't find any resources matching your request. Could you try describing what you want to build differently?",
            { type: "error", message: "No matching resources found" },
          );
          setLoading(false);
          return;
        }

        setResources(resources);
        updateWorkflow({
          name: response.proposal.name,
          selectedResourceIds: resources.map((r) => r.id),
          estimatedCost: response.proposal.estimatedCost,
        });

        // Convert steps to workflow steps
        const steps: WorkflowStep[] = response.proposal.steps.map((step) => ({
          order: step.order,
          resourceId: step.resourceId,
          resourceName: step.resourceName,
          resourceSlug: step.resourceSlug,
          serverSlug: step.serverSlug,
          price: step.price,
          inputs: [],
          outputs: [],
        }));

        updateWorkflow({ steps });

        // Add AI response with resource suggestions
        addAssistantMessage(
          `I found ${resources.length} resource${resources.length !== 1 ? "s" : ""} that can help with "${response.proposal.name}":`,
          {
            type: "resource_suggestion",
            resources,
            query: prompt,
          },
        );

        setStep("resource_selection");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        addAssistantMessage(
          "Sorry, I encountered an error while building your workflow.",
          { type: "error", message },
        );
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      cancelRequest,
      addUserMessage,
      setLoading,
      setError,
      generateProposal,
      setResources,
      updateWorkflow,
      addAssistantMessage,
      setStep,
    ],
  );

  // Handle continuing with selected resources - show wiring proposal
  const handleConfirmResources = useCallback(async () => {
    if (selectedResources.length === 0) return;

    // Add user confirmation message
    addUserMessage(
      `Selected: ${selectedResources.map((r) => r.slug || r.name).join(", ")}`,
    );

    // We already have the proposal from the initial step
    const proposal = proposalRef.current;
    if (!proposal) {
      addAssistantMessage("Something went wrong. Please try again.", {
        type: "error",
        message: "No proposal found",
      });
      return;
    }

    // Add AI response with wiring proposal
    addAssistantMessage(
      `Here's how I'd wire these ${state.workflow.steps.length} step${state.workflow.steps.length !== 1 ? "s" : ""} together:`,
      {
        type: "wiring_proposal",
        steps: state.workflow.steps,
        connections: [],
        explanation: proposal.description,
      },
    );

    setStep("wiring");
  }, [
    selectedResources,
    state.workflow.steps,
    addUserMessage,
    addAssistantMessage,
    setStep,
  ]);

  // Handle confirming the wiring - show parameters
  const handleConfirmWiring = useCallback(async () => {
    // Add user confirmation
    addUserMessage("Looks good!");

    // Extract parameters from the proposal's clarifications or workflow inputs
    const proposal = proposalRef.current;
    if (!proposal) {
      addAssistantMessage("Something went wrong - no proposal found.", {
        type: "error",
        message: "Missing proposal",
      });
      return;
    }

    // Get workflow inputs from trigger node
    const triggerNode = proposal.nodes.find((n) => n.type === "trigger");
    const workflowInputs =
      (triggerNode?.data?.workflowInputs as Array<{
        name: string;
        type: string;
        required: boolean;
        description?: string;
        default?: string;
      }>) || [];

    // Convert to JobParameters
    const parameters: JobParameter[] = workflowInputs.map((input) => ({
      name: input.name,
      type: input.type.includes("date")
        ? "date"
        : input.type === "number"
          ? "number"
          : input.type === "boolean"
            ? "boolean"
            : "string",
      defaultValue: input.default || "",
      description: input.description,
      exposed: true, // Default all to exposed
      required: input.required,
    }));

    setParameters(parameters);

    if (parameters.length > 0) {
      // Add AI response with parameter selection
      addAssistantMessage(
        "What should users configure when they run this job? I've exposed all parameters by default:",
        {
          type: "parameter_selection",
          parameters,
          explanation:
            "Checked parameters will be configurable each time the job runs. Uncheck parameters you want to use fixed default values.",
        },
      );
      setStep("parameters");
    } else {
      // No parameters to configure, go straight to review
      handleFinalizeParameters();
    }
  }, [addUserMessage, addAssistantMessage, setParameters, setStep]);

  // Handle finalizing parameters
  const handleFinalizeParameters = useCallback(() => {
    // Add user selection message
    const paramNames = exposedParameters.map((p) => p.name).join(", ");
    addUserMessage(
      exposedParameters.length > 0
        ? `Exposing: ${paramNames}`
        : "Using all default values",
    );

    // Add final summary
    addAssistantMessage("Your workflow is ready!", {
      type: "final_summary",
      workflow: state.workflow,
    });

    setStep("review");
  }, [
    exposedParameters,
    state.workflow,
    addUserMessage,
    addAssistantMessage,
    setStep,
  ]);

  // Handle creating the job
  const handleCreateJob = useCallback(async () => {
    const proposal = proposalRef.current;
    if (!proposal) {
      addAssistantMessage("Something went wrong - no proposal found.", {
        type: "error",
        message: "Missing proposal",
      });
      return;
    }

    setLoading(true);

    try {
      // Update proposal name if user changed it
      if (state.workflow.name) {
        proposal.name = state.workflow.name;
      }

      // Update workflow input defaults based on exposed parameters
      const triggerNodeIndex = proposal.nodes.findIndex(
        (n) => n.type === "trigger",
      );
      if (triggerNodeIndex >= 0) {
        const triggerNode = proposal.nodes[triggerNodeIndex];
        const workflowInputs =
          (triggerNode?.data?.workflowInputs as Array<{
            name: string;
            type: string;
            required: boolean;
            description?: string;
            default?: string;
          }>) || [];

        // Update defaults from user-edited values
        const updatedInputs = workflowInputs.map((input) => {
          const param = state.workflow.parameters.find(
            (p) => p.name === input.name,
          );
          if (param && param.defaultValue) {
            return { ...input, default: param.defaultValue };
          }
          return input;
        });

        proposal.nodes[triggerNodeIndex] = {
          ...triggerNode!,
          data: {
            ...triggerNode!.data,
            workflowInputs: updatedInputs,
          },
        };
      }

      const result = await createJob(proposal);

      addAssistantMessage(
        `Job "${result.job.name}" created successfully! Redirecting...`,
        {
          type: "thinking",
          text: "Redirecting to your new job...",
        },
      );

      setStep("complete");

      // Redirect to the job page
      setTimeout(() => {
        router.push(`/jobs/${result.job.id}`);
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create job";
      addAssistantMessage("Sorry, I couldn't create the job.", {
        type: "error",
        message,
        suggestion: "Please try again or check your connection.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    state.workflow,
    createJob,
    addAssistantMessage,
    setStep,
    router,
    setLoading,
  ]);

  // Handle free-form message during conversation
  const handleMessage = useCallback(
    async (message: string) => {
      const currentStep = state.step;

      if (currentStep === "initial") {
        await handleInitialPrompt(message);
        return;
      }

      // For other steps, add the message and interpret intent
      addUserMessage(message);

      const lowerMessage = message.toLowerCase();

      // Simple intent detection
      if (
        currentStep === "resource_selection" &&
        (lowerMessage.includes("continue") ||
          lowerMessage.includes("looks good") ||
          lowerMessage.includes("yes"))
      ) {
        await handleConfirmResources();
      } else if (
        currentStep === "wiring" &&
        (lowerMessage.includes("confirm") ||
          lowerMessage.includes("looks good") ||
          lowerMessage.includes("yes"))
      ) {
        await handleConfirmWiring();
      } else if (
        currentStep === "parameters" &&
        (lowerMessage.includes("finalize") ||
          lowerMessage.includes("done") ||
          lowerMessage.includes("ready"))
      ) {
        handleFinalizeParameters();
      } else if (
        currentStep === "review" &&
        (lowerMessage.includes("create") || lowerMessage.includes("yes"))
      ) {
        await handleCreateJob();
      } else {
        // Generic response
        addAssistantMessage(
          `Got it! Use the buttons above to continue, or type "continue" to proceed.`,
        );
      }
    },
    [
      state.step,
      handleInitialPrompt,
      handleConfirmResources,
      handleConfirmWiring,
      handleFinalizeParameters,
      handleCreateJob,
      addUserMessage,
      addAssistantMessage,
    ],
  );

  return {
    handleMessage,
    handleInitialPrompt,
    handleConfirmResources,
    handleConfirmWiring,
    handleFinalizeParameters,
    handleCreateJob,
    cancelRequest,
    currentStep: state.step,
    isLoading: state.isLoading,
  };
}
