"use client";

import { useState, useRef } from "react";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { useToast } from "@x402jobs/ui/toast";
import { Zap, AlertCircle, Upload, FileJson } from "lucide-react";
import { getAllNetworks } from "@/lib/networks";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api";
import { type GenerateError } from "@/hooks/useGenerateWorkflowProposalMutation";

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional callback for canvas-context job creation. If not provided, creates via API. */
  onCreate?: (name: string, network: NetworkType) => void;
}

export function CreateJobModal({
  isOpen,
  onClose,
  onCreate,
}: CreateJobModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "import">("create");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<NetworkType>("solana");

  const { toast } = useToast();

  // State
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Display error
  const displayError: GenerateError | null = localError
    ? { message: localError }
    : null;

  // Import state
  const [jsonContent, setJsonContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    // Reset all state
    setMode("create");
    setName("");
    setNetwork("solana");
    setLocalError(null);
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
      // Pre-fill name and network from imported job
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
          name: name || parsed.name || "", // Backend will generate random name if empty or taken
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
        toast({ title: "Job imported", variant: "success" });
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

    const finalName = name.trim();

    // If onCreate callback provided (canvas context), use it
    if (onCreate) {
      onCreate(finalName, network);
      handleClose();
      return;
    }

    // Otherwise create via API (global modal context)
    await handleCreateBlankJob(finalName);
  };

  const handleCreateBlankJob = async (jobName: string) => {
    setIsCreatingBlank(true);
    setLocalError(null);

    try {
      const response = await authenticatedFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          name: jobName || "", // Backend will generate random name if empty or taken
          network,
          workflow_data: { nodes: [], edges: [] },
        }),
      });

      if (response.ok) {
        const { job } = await response.json();
        handleClose();
        toast({ title: "Job created", variant: "success" });
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

  const isLoading = isCreatingBlank;

  return (
    <AnimatedDialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <AnimatedDialogContent className="max-w-lg" onClose={handleClose}>
        <DialogHeader>
          <AnimatedDialogTitle>
            {mode === "create" ? "Create New Job" : "Import Job"}
          </AnimatedDialogTitle>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setMode("create");
              setLocalError(null);
            }}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === "create"
                ? "bg-primary text-primary-foreground"
                : "bg-background border border-input hover:bg-accent text-muted-foreground disabled:hover:bg-background"
            }`}
          >
            <Zap className="h-3.5 w-3.5 inline mr-1.5" />
            Create
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setMode("import");
              setLocalError(null);
            }}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === "import"
                ? "bg-primary text-primary-foreground"
                : "bg-background border border-input hover:bg-accent text-muted-foreground disabled:hover:bg-background"
            }`}
          >
            <FileJson className="h-3.5 w-3.5 inline mr-1.5" />
            Import JSON
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-6 pb-2">
              {mode === "import" ? (
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
                        : "bg-background border-input"
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
                    <p className="text-sm text-muted-foreground">
                      Drop a JSON file or click to browse
                    </p>
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
                    <p className="text-xs text-muted-foreground">
                      Leave empty for a random name
                    </p>
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
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all bg-background disabled:opacity-50 ${
                              isSelected
                                ? "border-primary"
                                : "border-input hover:bg-accent"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-muted-foreground/10 ${
                                isSelected
                                  ? iconColors
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium">{net.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {net.tagline}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {displayError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p>{displayError.message}</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogBody>

          <DialogFooter className="mt-6 pb-2">
            {mode === "import" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isCreatingBlank}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleImport}
                  disabled={!jsonContent || !!displayError}
                  loading={isCreatingBlank}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Job
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
                  loading={isCreatingBlank}
                >
                  <Zap className="w-4 h-4" />
                  Create Job
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
