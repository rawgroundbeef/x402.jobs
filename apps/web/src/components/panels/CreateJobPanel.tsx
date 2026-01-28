"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Sparkles,
  Loader2,
  AlertCircle,
  Upload,
  Search,
  Info,
} from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { Tooltip } from "@x402jobs/ui/tooltip";
import { SlidePanel } from "./SlidePanel";
import { PanelTabs } from "./PanelTabs";
import { getAllNetworks } from "@/lib/networks";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
import { authenticatedFetch } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import {
  useGenerateWorkflowProposalMutation,
  type ProposalResponse,
  type GenerateError,
} from "@/hooks/useGenerateWorkflowProposalMutation";
import { useCreateWorkflowJobMutation } from "@/hooks/useCreateWorkflowJobMutation";

// Format resource name in GitHub-style: server-slug/resource-slug
function formatResourcePath(step: {
  resourceName: string;
  resourceSlug?: string;
  resourceUrl: string;
  serverName?: string;
  serverSlug?: string;
}): { server: string; resource: string } {
  if (step.serverSlug && step.resourceSlug) {
    return {
      server: step.serverSlug,
      resource: step.resourceSlug,
    };
  }

  try {
    const url = new URL(step.resourceUrl);
    const hostname = url.hostname
      .replace(/^(www|api|agents)\./, "")
      .replace(/\.com$|\.io$|\.ai$|\.org$/, "");
    const pathParts = url.pathname
      .replace(/^\//, "")
      .split("/")
      .filter(Boolean);
    const resourceSlug =
      step.resourceSlug || pathParts[pathParts.length - 1] || step.resourceName;
    return {
      server: step.serverSlug || hostname,
      resource: resourceSlug,
    };
  } catch {
    return {
      server: step.serverSlug || step.serverName || "unknown",
      resource: step.resourceSlug || step.resourceName,
    };
  }
}

type CreateJobPanelTab = "create" | "import";

interface CreateJobPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional callback for canvas-context job creation. If not provided, creates via API. */
  onCreate?: (name: string, network: NetworkType) => void;
}

export function CreateJobPanel({
  isOpen,
  onClose,
  onCreate,
}: CreateJobPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CreateJobPanelTab>("create");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<NetworkType>("solana");

  // AI assistance hooks
  const {
    generateProposal,
    isGenerating,
    error: generateError,
    clearError: clearGenerateError,
  } = useGenerateWorkflowProposalMutation();
  const {
    createFromProposal,
    isCreating: isCreatingFromProposal,
    error: createError,
    clearError: clearCreateError,
  } = useCreateWorkflowJobMutation();

  // AI assistance state
  const [aiRequest, setAiRequest] = useState("");
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);

  // Import state
  const [jsonContent, setJsonContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine errors - generateError is an object, others are strings
  const displayError: GenerateError | null = generateError
    ? generateError
    : createError
      ? { message: createError }
      : localError
        ? { message: localError }
        : null;
  const isCreating = isCreatingFromProposal || isCreatingBlank;

  const handleClose = () => {
    setActiveTab("create");
    setName("");
    setNetwork("solana");
    setAiRequest("");
    setProposal(null);
    setLocalError(null);
    clearGenerateError();
    clearCreateError();
    setJsonContent("");
    setDragOver(false);
    onClose();
  };

  // Import helpers
  const parseAndValidateJson = (content: string): boolean => {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.name || typeof parsed.name !== "string") {
        setLocalError("Job must have a name");
        return false;
      }
      if (!parsed.workflow_definition?.nodes) {
        setLocalError("Job must have workflow_definition with nodes");
        return false;
      }
      setLocalError(null);
      setName(parsed.name);
      if (parsed.network) {
        setNetwork(parsed.network as NetworkType);
      }
      return true;
    } catch {
      setLocalError("Invalid JSON format");
      return false;
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".json")) {
      setLocalError("Please select a JSON file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonContent(content);
      parseAndValidateJson(content);
    };
    reader.onerror = () => setLocalError("Failed to read file");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!jsonContent) return;

    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      setLocalError("Invalid JSON");
      return;
    }

    setIsCreatingBlank(true);
    setLocalError(null);

    try {
      const response = await authenticatedFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          name: name || parsed.name || "",
          description: parsed.description,
          network: network || parsed.network || "solana",
          workflow_data: parsed.workflow_definition,
          trigger_type: parsed.trigger_type || "manual",
          trigger_methods: parsed.trigger_methods,
          creator_markup: parsed.creator_markup || 0,
        }),
      });

      if (response.ok) {
        const { job } = await response.json();
        handleClose();
        router.push(`/jobs/${job.id}`);
        return;
      }

      const data = await response.json();
      throw new Error(data.message || data.error || "Failed to import job");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to import job");
    } finally {
      setIsCreatingBlank(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (aiRequest.trim() && !proposal) {
      await handleGenerate();
      return;
    }

    if (proposal) {
      await handleCreateFromProposal();
      return;
    }

    const finalName = name.trim();

    if (onCreate) {
      onCreate(finalName, network);
      handleClose();
      return;
    }

    await handleCreateBlankJob(finalName);
  };

  const handleCreateBlankJob = async (jobName: string) => {
    setIsCreatingBlank(true);
    setLocalError(null);

    try {
      const response = await authenticatedFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          name: jobName || "",
          network,
          workflow_data: { nodes: [], edges: [] },
        }),
      });

      if (response.ok) {
        const { job } = await response.json();
        handleClose();
        router.push(`/jobs/${job.id}`);
        return;
      }

      const data = await response.json();
      throw new Error(data.message || data.error || "Failed to create job");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setIsCreatingBlank(false);
    }
  };

  const handleGenerate = async () => {
    if (!aiRequest.trim()) return;

    setProposal(null);
    clearGenerateError();

    try {
      const data = await generateProposal({
        request: aiRequest.trim(),
        network,
      });
      if (!name.trim() && data.proposal.name) {
        setName(data.proposal.name);
      }
      setProposal(data);
    } catch {
      // Error is already set by the hook
    }
  };

  const handleCreateFromProposal = async () => {
    if (!proposal) return;

    clearCreateError();

    try {
      const finalProposal = {
        ...proposal.proposal,
        name: name.trim() || proposal.proposal.name,
      };

      const result = await createFromProposal(finalProposal);
      const jobId = result.job?.id;

      if (jobId) {
        handleClose();
        router.push(`/jobs/${jobId}`);
      }
    } catch {
      // Error is already set by the hook
    }
  };

  const isLoading = isGenerating || isCreating;

  const tabs = [
    { id: "create", label: "Create" },
    { id: "import", label: "Import JSON" },
  ];

  return (
    <SlidePanel isOpen={isOpen} onClose={handleClose} title="New Job" fullBleed>
      {/* Tabs */}
      <PanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId as CreateJobPanelTab);
          setLocalError(null);
          clearGenerateError();
          clearCreateError();
        }}
      />

      {/* Content */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === "import" ? (
            <>
              {/* Import Mode */}
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-lg h-32 flex items-center justify-center cursor-pointer transition-colors border text-center ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "bg-muted/30 border-border hover:bg-muted/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a JSON file or click to browse
                  </p>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                or paste JSON
              </div>

              <textarea
                value={jsonContent}
                onChange={(e) => {
                  setJsonContent(e.target.value);
                  if (e.target.value) {
                    parseAndValidateJson(e.target.value);
                  } else {
                    setLocalError(null);
                  }
                }}
                placeholder='{"name": "My Job", "workflow_definition": {...}}'
                className="w-full h-32 px-3 py-2 bg-background border border-input rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {jsonContent && !displayError && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium">{name || "Imported Job"}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Ready to import
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Create Mode - Job Name */}
              <div className="space-y-2">
                <label htmlFor="job-name" className="text-sm font-medium">
                  Job Name
                </label>
                <Input
                  id="job-name"
                  placeholder="My awesome job"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              {/* Network Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Network</label>
                <div className="grid grid-cols-2 gap-3">
                  {getAllNetworks().map((net) => {
                    const isSelected = network === net.id;
                    const Icon = net.icon;
                    const iconColors =
                      {
                        purple: "text-purple-500",
                        blue: "text-blue-500",
                        indigo: "text-indigo-500",
                      }[net.color] || "text-gray-500";

                    return (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setNetwork(net.id as NetworkType)}
                        disabled={isLoading}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all bg-background disabled:opacity-50 ${
                          isSelected
                            ? "border-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-muted ${
                            isSelected ? iconColors : "text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium">{net.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {net.tagline}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Assistance (Optional) */}
              {!proposal && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    What do you want to build?{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={aiRequest}
                    onChange={(e) => setAiRequest(e.target.value)}
                    placeholder="e.g., Generate a video from an image"
                    className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    AI will find matching resources and pre-populate your
                    workflow.
                  </p>
                </div>
              )}

              {/* Proposal Preview */}
              {proposal && (
                <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">AI Suggestion</span>
                  </div>

                  {/* Steps */}
                  <div className="space-y-1.5">
                    {proposal.proposal.steps.map((step, i) => {
                      const { server, resource } = formatResourcePath(step);
                      return (
                        <div
                          key={step.resourceId}
                          className="flex items-center gap-2 p-2 rounded bg-background"
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                          </div>
                          <span className="text-sm font-mono">
                            <span className="text-muted-foreground">
                              {server}
                            </span>
                            <span className="text-muted-foreground/50 mx-0.5">
                              /
                            </span>
                            <span className="text-foreground">{resource}</span>
                            <span className="text-muted-foreground/60 ml-2 text-xs">
                              {formatUsd(step.price)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cost Summary */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Estimated cost per run:</span>
                      <span className="font-medium text-foreground">
                        {formatUsd(proposal.proposal.estimatedCost)}
                      </span>
                      <Tooltip content="You're only charged when the job runs. Creating jobs is free.">
                        <Info className="w-3.5 h-3.5 cursor-help" />
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {displayError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p>{displayError.message}</p>
                {displayError.suggestion && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {displayError.suggestion}
                  </p>
                )}
                {displayError.isNoResourcesError && (
                  <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-destructive/20">
                    <p className="text-xs text-muted-foreground">
                      You can still create a blank job and add resources
                      manually
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearGenerateError();
                        setAiRequest("");
                        handleCreateBlankJob(name.trim());
                      }}
                      disabled={isLoading}
                      className="shrink-0"
                    >
                      <Search className="w-3 h-3 mr-1.5" />
                      Create Blank
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          {activeTab === "import" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleImport}
                disabled={!jsonContent || !!displayError || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Job
                  </>
                )}
              </Button>
            </>
          ) : proposal ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setProposal(null);
                  setAiRequest("");
                }}
                disabled={isLoading}
              >
                Start Over
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Job"
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="gap-2"
                disabled={isLoading}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding resources...
                  </>
                ) : aiRequest.trim() ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate & Create
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Create Job
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </form>
    </SlidePanel>
  );
}
