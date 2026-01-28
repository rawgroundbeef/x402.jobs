"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";
import { ChatInput } from "@x402jobs/ui/chat-input";
import { Button } from "@x402jobs/ui/button";
import { ChainIcon } from "@/components/icons/ChainIcons";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
import {
  useGenerateWorkflowProposalMutation,
  type ProposalResponse,
  type GenerateError,
  type Clarification,
} from "@/hooks/useGenerateWorkflowProposalMutation";
import { useCreateWorkflowJobMutation } from "@/hooks/useCreateWorkflowJobMutation";
import { formatUsd } from "@/lib/format";
import {
  AlertCircle,
  Loader2,
  ExternalLink,
  Info,
  HelpCircle,
  Check,
  Calendar,
} from "lucide-react";
import { Card } from "@x402jobs/ui/card";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { Tooltip } from "@x402jobs/ui/tooltip";
import { Input } from "@x402jobs/ui/input";

interface InputReference {
  type: "reference";
  sourceNodeId: string;
  sourceField: string;
}

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
  inputMapping?: Record<string, string | InputReference>;
}

/**
 * Format step resource path as server-slug/resource-slug
 */
function formatStepPath(step: WorkflowStep): React.ReactNode {
  // Prefer slugs if available
  if (step.serverSlug && step.resourceSlug) {
    return (
      <span className="font-mono text-xs">
        {step.serverSlug}/{step.resourceSlug}
      </span>
    );
  }

  // Fall back to extracting from URL
  try {
    const url = new URL(step.resourceUrl);
    const serverHost = url.hostname;
    const pathParts = url.pathname.split("/").filter(Boolean);
    const resourceSlug = pathParts[pathParts.length - 1] || pathParts.join("/");

    return (
      <span className="font-mono text-xs">
        {step.serverSlug || serverHost}/{step.resourceSlug || resourceSlug}
      </span>
    );
  } catch {
    return step.resourceName;
  }
}

/**
 * AI-powered job creation component.
 * Allows users to describe what they want to build,
 * generates a workflow proposal, and creates the job.
 */
export function AIJobCreator() {
  const router = useRouter();
  const { user } = useAuth();
  const { openResourceModal } = useModals();
  const isAuthenticated = !!user;

  // Mutation hooks
  const {
    generateProposal,
    isGenerating,
    error: generateError,
    clearError: clearGenerateError,
  } = useGenerateWorkflowProposalMutation();
  const {
    createFromProposal,
    isCreating,
    error: createError,
    clearError: clearCreateError,
  } = useCreateWorkflowJobMutation();

  const [prompt, setPrompt] = useState("");
  const [network, setNetwork] = useState<NetworkType>("solana");
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [isMobile, setIsMobile] = useState(true);
  // Track edited clarification values
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  // Combine errors - generateError is an object, createError is a string
  const displayError: GenerateError | null = generateError
    ? generateError
    : createError
      ? { message: createError }
      : null;

  // Get clarifications from proposal
  const clarifications = proposal?.proposal.clarifications || [];
  const hasClarifications = clarifications.length > 0;

  // Get the current value for a clarification (edited or original)
  const getClarificationValue = (c: Clarification) => {
    const key = `${c.nodeId}:${c.fieldName}`;
    return editedValues[key] ?? c.inferredValue;
  };

  // Update a clarification value
  const updateClarificationValue = (c: Clarification, value: string) => {
    const key = `${c.nodeId}:${c.fieldName}`;
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  // Check screen size for responsive placeholder
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle AI prompt submission
  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    // If not logged in, redirect to login
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setProposal(null);
    clearGenerateError();

    try {
      const data = await generateProposal({
        request: prompt.trim(),
        network,
      });
      setProposal(data);
    } catch {
      // Error is already set by the hook
    }
  };

  // Handle creating job from proposal (applies any edited clarification values)
  const handleCreateFromProposal = async () => {
    if (!proposal) return;

    clearCreateError();

    try {
      // Apply edited clarification values to the workflow inputs (job parameters)
      const updatedProposal = { ...proposal.proposal };
      if (Object.keys(editedValues).length > 0) {
        updatedProposal.nodes = updatedProposal.nodes.map((node) => {
          if (node.type !== "trigger") return node;

          const nodeData = node.data as {
            workflowInputs?: Array<{
              name: string;
              type: string;
              required: boolean;
              description?: string;
              default?: string;
            }>;
          };

          if (!nodeData.workflowInputs) return node;

          // Update default values for edited clarifications
          const updatedInputs = nodeData.workflowInputs.map((input) => {
            // Find if any edited value matches this input
            for (const [key, value] of Object.entries(editedValues)) {
              // The key is "nodeId:fieldName", we need to match the param name
              const fieldName = key.split(":")[1];
              // Convert to param name format (same logic as backend)
              const paramName = fieldName
                .replace(/_/g, " ")
                .replace(/([a-z])([A-Z])/g, "$1 $2")
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase())
                .replace(/\s+/g, "_")
                .toLowerCase();

              if (
                input.name === paramName ||
                input.name.startsWith(paramName)
              ) {
                return { ...input, default: value };
              }
            }
            return input;
          });

          return {
            ...node,
            data: { ...node.data, workflowInputs: updatedInputs },
          };
        });
      }

      const result = await createFromProposal(updatedProposal);
      const jobId = result.job?.id;

      if (jobId) {
        router.push(`/jobs/${jobId}`);
      }
    } catch {
      // Error is already set by the hook
    }
  };

  // Clear proposal and start over
  const handleStartOver = () => {
    setProposal(null);
    setEditedValues({});
    clearGenerateError();
    clearCreateError();
    setPrompt("");
  };

  // Handle clicking on a step to view resource details
  const handleStepClick = (step: WorkflowStep) => {
    openResourceModal({
      id: step.resourceId,
      name: step.resourceName,
      slug: step.resourceSlug,
      description: step.purpose,
      resource_url: step.resourceUrl,
      network: proposal?.proposal.network || "solana",
      max_amount_required: String(step.price * 1_000_000), // Convert to micro units
      server_id: step.serverId,
      server_name: step.serverName,
      server_slug: step.serverSlug,
      output_schema: step.outputSchema,
    });
  };

  // Show proposal preview
  if (proposal) {
    return (
      <div className="text-left bg-card border border-border rounded-xl p-6 shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{proposal.proposal.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {proposal.proposal.description}
            </p>
          </div>
          <span
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              proposal.proposal.network === "base"
                ? "bg-blue-500/10 text-blue-500"
                : "bg-purple-500/10 text-purple-500"
            }`}
          >
            <ChainIcon
              network={(proposal.proposal.network as NetworkType) || "solana"}
              className="w-3 h-3"
            />
            {proposal.proposal.network === "base" ? "Base" : "Solana"}
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-2 mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Workflow Steps
          </p>
          {proposal.proposal.steps.map((step, i) => (
            <Card
              key={i}
              as="button"
              onClick={() => handleStepClick(step)}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left group"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                {step.order}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {formatStepPath(step)}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-xs text-muted-foreground">
                {formatUsd(step.price)}
              </span>
            </Card>
          ))}

          {/* Cost Summary */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-3 border-t border-border/50">
            <span>Estimated cost per run:</span>
            <span className="font-medium text-foreground">
              {formatUsd(proposal.proposal.estimatedCost)}
            </span>
            <Tooltip content="You're only charged when the job runs. Creating jobs is free.">
              <Info className="w-3.5 h-3.5 cursor-help" />
            </Tooltip>
          </div>
        </div>

        {/* Clarifications - show if AI inferred values that need confirmation */}
        {hasClarifications && (
          <div className="space-y-3 mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <HelpCircle className="w-4 h-4" />
              <span>Please confirm these details</span>
            </div>
            <div className="space-y-3">
              {clarifications.map((c, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">{c.question}</p>
                  <div className="flex items-center gap-2">
                    {c.fieldName.toLowerCase().includes("date") ? (
                      <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={getClarificationValue(c)}
                          onChange={(e) =>
                            updateClarificationValue(c, e.target.value)
                          }
                          className="pl-10 h-9 text-sm"
                        />
                      </div>
                    ) : (
                      <Input
                        type="text"
                        value={getClarificationValue(c)}
                        onChange={(e) =>
                          updateClarificationValue(c, e.target.value)
                        }
                        className="h-9 text-sm"
                        placeholder={c.fieldDescription}
                      />
                    )}
                    {c.confidence === "high" && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.resourceName} → {c.fieldDescription || c.fieldName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={handleStartOver}
            disabled={isCreating}
          >
            Start Over
          </Button>
          <Button
            onClick={handleCreateFromProposal}
            disabled={isCreating}
            variant="primary"
            className="gap-2"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Job
          </Button>
        </div>

        {displayError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p>{displayError.message}</p>
              {displayError.suggestion && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {displayError.suggestion}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Show input form
  return (
    <>
      <ChatInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={handlePromptSubmit}
        placeholder={
          isMobile
            ? "Describe your workflow..."
            : "e.g., Summarize a YouTube video and post it to Telegram"
        }
        isLoading={isGenerating}
        disabled={isGenerating}
        gradientBorder
        className="shadow-xl shadow-primary/10 [&_textarea]:text-base [&_textarea]:py-4 [&_textarea]:min-h-[56px] [&_button]:h-10 [&_button]:w-10 [&_button_svg]:h-5 [&_button_svg]:w-5"
        leftAdornments={
          <button
            type="button"
            onClick={() => setNetwork(network === "solana" ? "base" : "solana")}
            className={`p-1.5 rounded-lg transition-colors hover:bg-muted ${
              network === "base" ? "text-blue-500" : "text-purple-500"
            }`}
            title={`${network === "base" ? "Base" : "Solana"} • Click to switch`}
          >
            <ChainIcon network={network} className="w-5 h-5" />
          </button>
        }
      />
      {displayError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p>{displayError.message}</p>
            {displayError.suggestion && (
              <p className="text-muted-foreground mt-1 text-xs">
                {displayError.suggestion}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
