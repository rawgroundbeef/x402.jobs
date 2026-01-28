"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Node, Edge } from "@xyflow/react";
import {
  Play,
  Loader2,
  AlertTriangle,
  DollarSign,
  Settings2,
  Zap,
  Check,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Switch } from "@x402jobs/ui/switch";
import { SlidePanel } from "./SlidePanel";
import type { ConfiguredInputs } from "@/components/modals/ResourceConfigModal";
import type { WorkflowInput } from "@/components/workflow/nodes/TriggerNode";
import { getNetwork, getNetworkBalance } from "@/lib/networks";
import { ImageUrlOrUpload } from "@/components/inputs";

const PARAM_STORAGE_PREFIX = "x402-job-params-";

interface BodyField {
  type: string;
  required?: boolean;
  description?: string;
}

interface ResourceData {
  id: string;
  name: string;
  price: number;
  resourceUrl?: string;
  network?: string;
  outputSchema?: {
    input?: {
      bodyFields?: Record<string, BodyField>;
      queryParams?: Record<string, BodyField>;
      headerFields?: Record<string, BodyField>;
    };
  };
}

interface NodeWithConfig extends Node {
  data: {
    resource?: ResourceData;
    configuredInputs?: ConfiguredInputs;
  };
}

// Input values keyed by resourceId -> fieldName -> value (for the run)
export type ResourceInputs = Record<
  string,
  Record<
    string,
    string | { type: "reference"; sourceNodeId: string; sourceField?: string }
  >
>;

// Workflow-level input values (from trigger)
export type WorkflowInputValues = Record<string, unknown>;

// Type for jobs available for chaining
interface ChainableJob {
  id: string;
  name: string;
  owner_username?: string;
  price?: number;
  isOwn: boolean;
  isCurrent?: boolean;
}

interface RunWorkflowPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    inputs: ResourceInputs,
    workflowInputValues?: WorkflowInputValues,
    startingTriggerIds?: string[],
  ) => Promise<void>;
  nodes: Node[];
  edges: Edge[];
  walletData?: Record<string, unknown> | null;
  network?: string;
  workflowInputs?: WorkflowInput[];
  jobId?: string | null;
  /** If provided, only this trigger will be selected by default */
  initialTriggerId?: string | null;
  /** Current on-success job ID for chaining */
  onSuccessJobId?: string | null;
  /** Callback when on-success job ID changes */
  onSuccessJobIdChange?: (jobId: string | null) => void;
  /** User's own jobs available for chaining */
  userJobs?: ChainableJob[];
  /** Public jobs available for chaining */
  publicJobs?: ChainableJob[];
  /** Stack level for z-index ordering */
  stackLevel?: number;
  /** Is there a panel stacked on top of this one? */
  hasStackedChild?: boolean;
}

// Load saved parameter values from localStorage
function loadSavedParams(
  jobId: string | null | undefined,
): WorkflowInputValues {
  if (!jobId || typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(`${PARAM_STORAGE_PREFIX}${jobId}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save parameter values to localStorage
function saveParams(
  jobId: string | null | undefined,
  values: WorkflowInputValues,
) {
  if (!jobId || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${PARAM_STORAGE_PREFIX}${jobId}`,
      JSON.stringify(values),
    );
  } catch (e) {
    console.error("Failed to save params to localStorage:", e);
  }
}

export function RunWorkflowPanel({
  isOpen,
  onClose,
  onConfirm,
  nodes,
  edges,
  walletData,
  network = "solana",
  workflowInputs = [],
  jobId,
  initialTriggerId,
  onSuccessJobId,
  onSuccessJobIdChange,
  userJobs = [],
  publicJobs = [],
  stackLevel = 1,
  hasStackedChild = false,
}: RunWorkflowPanelProps) {
  const networkConfig = getNetwork(network);
  const effectiveBalance = getNetworkBalance(walletData, network);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowInputValues, setWorkflowInputValues] =
    useState<WorkflowInputValues>(() => loadSavedParams(jobId));

  // Get all trigger nodes
  const triggerNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "trigger");
  }, [nodes]);

  // Selected trigger IDs - if initialTriggerId provided, only select that one
  const [selectedTriggerIds, setSelectedTriggerIds] = useState<Set<string>>(
    () => new Set(triggerNodes.map((t) => t.id)),
  );

  // Update selected triggers when panel opens or initialTriggerId changes
  useEffect(() => {
    if (isOpen) {
      if (
        initialTriggerId &&
        triggerNodes.some((t) => t.id === initialTriggerId)
      ) {
        // If a specific trigger was clicked, only select that one
        setSelectedTriggerIds(new Set([initialTriggerId]));
      } else {
        // Otherwise select all triggers (e.g. when clicking Run button in header)
        setSelectedTriggerIds(new Set(triggerNodes.map((t) => t.id)));
      }
    }
  }, [isOpen, initialTriggerId, triggerNodes]);

  const hasMultipleTriggers = triggerNodes.length > 1;

  // Load values when panel opens or jobId changes
  // Priority: saved values (localStorage) > default values from workflow inputs
  useEffect(() => {
    if (isOpen) {
      // Start with default values from workflow inputs
      const defaults: WorkflowInputValues = {};
      for (const input of workflowInputs) {
        if (input.default !== undefined && input.default !== "") {
          defaults[input.name] = input.default;
        }
      }

      // Override with any saved values from localStorage
      const saved = jobId ? loadSavedParams(jobId) : {};

      // Merge: defaults first, then saved values override
      const merged = { ...defaults, ...saved };

      if (Object.keys(merged).length > 0) {
        setWorkflowInputValues(merged);
      }
    }
  }, [isOpen, jobId, workflowInputs]);

  // Save values whenever they change
  const updateWorkflowInputValue = useCallback(
    (name: string, value: unknown) => {
      setWorkflowInputValues((prev) => {
        const updated = { ...prev, [name]: value };
        saveParams(jobId, updated);
        return updated;
      });
      // Clear error when user starts typing
      if (error) setError(null);
    },
    [jobId, error],
  );

  // Platform fee (matches backend config)
  const PLATFORM_FEE = 0.05;

  // Get connected node IDs (reachable from SELECTED triggers via edges)
  const connectedNodeIds = useMemo(() => {
    const outgoingEdges = new Map<string, string[]>();
    for (const edge of edges) {
      if (!outgoingEdges.has(edge.source)) {
        outgoingEdges.set(edge.source, []);
      }
      outgoingEdges.get(edge.source)!.push(edge.target);
    }

    // Only start from selected triggers
    const activeTriggers = nodes.filter(
      (n) => n.type === "trigger" && selectedTriggerIds.has(n.id),
    );
    const reachableNodeIds = new Set<string>();
    const visitQueue = [...activeTriggers.map((n) => n.id)];
    const visited = new Set<string>();

    while (visitQueue.length > 0) {
      const nodeId = visitQueue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        // Track resources and sources
        if (node.type === "resource" && node.data?.resource) {
          reachableNodeIds.add(nodeId);
        } else if (node.type === "source") {
          reachableNodeIds.add(nodeId);
        }
        for (const targetId of outgoingEdges.get(nodeId) || []) {
          if (!visited.has(targetId)) {
            visitQueue.push(targetId);
          }
        }
      }
    }
    return reachableNodeIds;
  }, [nodes, edges, selectedTriggerIds]);

  // Storage fee for x402.storage
  const STORAGE_FEE = 0.01;

  // Check if x402storage is enabled in any output node
  const hasStorageEnabled = useMemo(() => {
    return nodes
      .filter((n) => n.type === "output")
      .some((n) => {
        const config = (
          n.data as {
            outputConfig?: {
              destinations?: Array<{ type: string; enabled: boolean }>;
            };
          }
        )?.outputConfig;
        return config?.destinations?.some(
          (d) => d.type === "x402storage" && d.enabled,
        );
      });
  }, [nodes]);

  // Extract resources from CONNECTED nodes only with their configured inputs
  const { resources, resourceCost, storageCost, totalCost } = useMemo(() => {
    const resourceNodes = nodes.filter(
      (n): n is NodeWithConfig =>
        n.type === "resource" &&
        !!n.data?.resource &&
        connectedNodeIds.has(n.id),
    );
    const resources = resourceNodes.map((n) => ({
      resource: n.data.resource!,
      configuredInputs: n.data.configuredInputs || {},
      nodeId: n.id,
    }));
    const resourceCost = resources.reduce(
      (sum, r) => sum + (r.resource.price || 0),
      0,
    );
    const storageCost = hasStorageEnabled ? STORAGE_FEE : 0;
    const totalCost = resourceCost + PLATFORM_FEE + storageCost;
    return { resources, resourceCost, storageCost, totalCost };
  }, [nodes, connectedNodeIds, hasStorageEnabled]);

  const hasInsufficientBalance = effectiveBalance < totalCost;

  // Check if all required fields are filled
  const missingRequired = useMemo(() => {
    const missing: string[] = [];

    for (const input of workflowInputs) {
      if (input.required) {
        const value = workflowInputValues[input.name];
        if (value === undefined || value === null || value === "") {
          missing.push(`Trigger: ${input.name}`);
        }
      }
    }

    for (const { resource, configuredInputs } of resources) {
      // Get all input fields (bodyFields, queryParams, headerFields)
      const input = resource.outputSchema?.input;
      const fields = {
        ...(input?.bodyFields || {}),
        ...(input?.queryParams || {}),
        ...(input?.headerFields || {}),
      };
      for (const [fieldName, field] of Object.entries(fields)) {
        if (field.required) {
          const configured = configuredInputs[fieldName];
          const hasStatic = configured?.type === "static" && configured.value;
          const hasReference =
            configured?.type === "reference" && configured.sourceNodeId;
          if (!hasStatic && !hasReference) {
            missing.push(`${resource.name}: ${fieldName}`);
          }
        }
      }
    }
    return missing;
  }, [resources, workflowInputs, workflowInputValues]);

  // Track which inputs have been touched (for showing validation errors)
  const [touchedInputs, setTouchedInputs] = useState<Set<string>>(new Set());

  const handleRun = async () => {
    // Validate required inputs before running
    if (missingRequired.length > 0) {
      // Mark all required inputs as touched to show validation errors
      const allRequired = new Set<string>();
      for (const input of workflowInputs) {
        if (input.required) {
          allRequired.add(input.name);
        }
      }
      setTouchedInputs(allRequired);
      setError("Please fill in all required fields");
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const inputs: ResourceInputs = {};

      for (const { resource, configuredInputs } of resources) {
        inputs[resource.id] = {};
        // Get all input fields (bodyFields, queryParams, headerFields)
        const input = resource.outputSchema?.input;
        const fields = {
          ...(input?.bodyFields || {}),
          ...(input?.queryParams || {}),
          ...(input?.headerFields || {}),
        };

        for (const fieldName of Object.keys(fields)) {
          const configured = configuredInputs[fieldName];

          if (configured?.type === "reference" && configured.sourceNodeId) {
            inputs[resource.id][fieldName] = {
              type: "reference",
              sourceNodeId: configured.sourceNodeId,
              sourceField: configured.sourceField || "response",
            };
          } else if (configured?.type === "static" && configured.value) {
            inputs[resource.id][fieldName] = configured.value;
          }
        }
      }

      // Pass selected trigger IDs if not all triggers are selected
      const startingTriggers =
        hasMultipleTriggers && selectedTriggerIds.size < triggerNodes.length
          ? Array.from(selectedTriggerIds)
          : undefined;
      await onConfirm(inputs, workflowInputValues, startingTriggers);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Workflow execution failed",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Run Job"
      stackLevel={stackLevel}
      hasStackedChild={hasStackedChild}
    >
      <div className="space-y-4">
        {/* Trigger Selection - only show when multiple triggers */}
        {hasMultipleTriggers && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-trigger" />
              <span>Start From</span>
            </div>
            <div className="space-y-2 p-3 bg-muted/30 border border-border rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">
                Select which trigger(s) to run. Only nodes downstream of
                selected triggers will execute.
              </p>
              {triggerNodes.map((trigger, index) => {
                const isSelected = selectedTriggerIds.has(trigger.id);
                const label =
                  (trigger.data as { label?: string })?.label ||
                  `Trigger ${index + 1}`;
                return (
                  <button
                    key={trigger.id}
                    onClick={() => {
                      setSelectedTriggerIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(trigger.id)) {
                          // Don't allow deselecting all triggers
                          if (next.size > 1) {
                            next.delete(trigger.id);
                          }
                        } else {
                          next.add(trigger.id);
                        }
                        return next;
                      });
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? "bg-trigger/20 border border-trigger/50"
                        : "bg-muted/50 border border-transparent hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center ${
                        isSelected
                          ? "bg-trigger text-white"
                          : "bg-muted border border-border"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Node ID: {trigger.id}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Job Parameters */}
        {workflowInputs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4 text-trigger" />
              <span>Job Parameters</span>
            </div>
            <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-lg">
              {workflowInputs.map((input) => {
                const value = workflowInputValues[input.name];
                const isEmpty =
                  value === undefined || value === null || value === "";
                const showError =
                  input.required && isEmpty && touchedInputs.has(input.name);

                return (
                  <div key={input.name} className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <span className="font-mono">{input.name}</span>
                      {input.required && (
                        <span className="text-destructive">*</span>
                      )}
                      <span className="text-muted-foreground font-normal">
                        ({input.type})
                      </span>
                    </label>
                    {input.description && (
                      <p className="text-xs text-muted-foreground">
                        {input.description}
                      </p>
                    )}
                    {input.type === "boolean" ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={
                            workflowInputValues[input.name] === true ||
                            workflowInputValues[input.name] === "true"
                          }
                          onCheckedChange={(checked) =>
                            updateWorkflowInputValue(input.name, checked)
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {workflowInputValues[input.name] ? "Yes" : "No"}
                        </span>
                      </div>
                    ) : input.type === "object" ? (
                      <Textarea
                        value={
                          typeof workflowInputValues[input.name] === "string"
                            ? (workflowInputValues[input.name] as string)
                            : JSON.stringify(
                                workflowInputValues[input.name] || {},
                                null,
                                2,
                              )
                        }
                        onChange={(e) =>
                          updateWorkflowInputValue(input.name, e.target.value)
                        }
                        placeholder='{"key": "value"}'
                        className={`font-mono text-xs h-20 ${showError ? "border-destructive" : ""}`}
                      />
                    ) : input.type === "file" ? (
                      <ImageUrlOrUpload
                        value={
                          (workflowInputValues[input.name] as string) || ""
                        }
                        onChange={(value) =>
                          updateWorkflowInputValue(input.name, value)
                        }
                        placeholder={`Upload or enter URL for ${input.name}`}
                      />
                    ) : (
                      <Input
                        type={input.type === "number" ? "number" : "text"}
                        value={
                          (workflowInputValues[input.name] as string) || ""
                        }
                        onChange={(e) =>
                          updateWorkflowInputValue(
                            input.name,
                            input.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                        placeholder={`Enter ${input.name}`}
                        className={`text-sm h-8 ${showError ? "border-destructive" : ""}`}
                      />
                    )}
                    {showError && (
                      <p className="text-xs text-destructive">
                        This field is required
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Resources ({resources.length})
            </span>
            <span className="font-mono">${resourceCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Platform fee</span>
            <span className="font-mono">${PLATFORM_FEE.toFixed(2)}</span>
          </div>
          {hasStorageEnabled && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">x402.storage</span>
              <span className="font-mono">${storageCost.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium">Total</span>
            </div>
            <span className="text-lg font-bold font-mono">
              ${totalCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Wallet balance */}
        <div className="flex items-center justify-between text-sm px-1">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <networkConfig.icon className="w-3.5 h-3.5" />
            Your {networkConfig.name} balance
          </span>
          <span
            className={`font-mono ${hasInsufficientBalance ? "text-destructive" : ""}`}
          >
            ${effectiveBalance.toFixed(2)} USDC
          </span>
        </div>

        {hasInsufficientBalance && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Insufficient {networkConfig.name} balance. Please fund your
              wallet.
            </span>
          </div>
        )}

        {/* Automation Indicator - read-only display if loop/chain is configured */}
        {onSuccessJobId && (
          <div className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              {onSuccessJobId === jobId ? (
                <>
                  <RefreshCw className="h-4 w-4 text-amber-500" />
                  <span>Will loop until stopped</span>
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 text-blue-500" />
                  <span>
                    Will run{" "}
                    <span className="font-medium">
                      {[...userJobs, ...publicJobs].find(
                        (j) => j.id === onSuccessJobId,
                      )?.name || "another job"}
                    </span>{" "}
                    next
                  </span>
                </>
              )}
            </div>
            {onSuccessJobIdChange && (
              <button
                onClick={() => onSuccessJobIdChange(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Run button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleRun}
            disabled={isRunning || hasInsufficientBalance}
            className="gap-1.5 bg-trigger hover:bg-trigger-dark text-white disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>
    </SlidePanel>
  );
}
