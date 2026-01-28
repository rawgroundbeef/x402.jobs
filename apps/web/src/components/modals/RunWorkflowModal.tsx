"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Switch } from "@x402jobs/ui/switch";
import {
  Play,
  Loader2,
  AlertTriangle,
  DollarSign,
  Settings,
  Settings2,
} from "lucide-react";
import { Node, Edge } from "@xyflow/react";
import type { ConfiguredInputs } from "./ResourceConfigModal";
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

interface RunWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    inputs: ResourceInputs,
    workflowInputValues?: WorkflowInputValues,
  ) => Promise<void>;
  nodes: Node[];
  edges: Edge[];
  walletData?: Record<string, unknown> | null; // Full wallet data object
  network?: string; // Job's network
  workflowInputs?: WorkflowInput[];
  jobId?: string | null; // Used to persist parameter values
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

export function RunWorkflowModal({
  isOpen,
  onClose,
  onConfirm,
  nodes,
  edges,
  walletData,
  network = "solana",
  workflowInputs = [],
  jobId,
}: RunWorkflowModalProps) {
  // Get network config and balance
  const networkConfig = getNetwork(network);
  const effectiveBalance = getNetworkBalance(walletData, network);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowInputValues, setWorkflowInputValues] =
    useState<WorkflowInputValues>(() => loadSavedParams(jobId));

  // Load values when modal opens or jobId changes
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
    },
    [jobId],
  );

  // Platform fee (matches backend config)
  const PLATFORM_FEE = 0.05;

  // Get connected node IDs (reachable from trigger via edges)
  const connectedNodeIds = useMemo(() => {
    const outgoingEdges = new Map<string, string[]>();
    for (const edge of edges) {
      if (!outgoingEdges.has(edge.source)) {
        outgoingEdges.set(edge.source, []);
      }
      outgoingEdges.get(edge.source)!.push(edge.target);
    }

    const triggerNodes = nodes.filter((n) => n.type === "trigger");
    const reachableNodeIds = new Set<string>();
    const visitQueue = [...triggerNodes.map((n) => n.id)];
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
  }, [nodes, edges]);

  // Extract resources from CONNECTED nodes only with their configured inputs
  const { resources, resourceCost, totalCost } = useMemo(() => {
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
    // Total includes platform fee
    const totalCost = resourceCost + PLATFORM_FEE;
    return { resources, resourceCost, totalCost };
  }, [nodes, connectedNodeIds]);

  const hasInsufficientBalance = effectiveBalance < totalCost;

  // Check if all required fields are filled (either static value or linked)
  const missingRequired = useMemo(() => {
    const missing: string[] = [];

    // Check required workflow inputs
    for (const input of workflowInputs) {
      if (input.required) {
        const value = workflowInputValues[input.name];
        if (value === undefined || value === null || value === "") {
          missing.push(`Trigger: ${input.name}`);
        }
      }
    }

    // Check required resource inputs
    for (const { resource, configuredInputs } of resources) {
      const fields = resource.outputSchema?.input?.bodyFields || {};
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

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);

    try {
      // Build the inputs object for execution using configured values
      const inputs: ResourceInputs = {};

      for (const { resource, configuredInputs } of resources) {
        inputs[resource.id] = {};
        const fields = resource.outputSchema?.input?.bodyFields || {};

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

      await onConfirm(inputs, workflowInputValues);
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Run Workflow</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {/* Job Parameters */}
            {workflowInputs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-trigger" />
                  <span>Job Parameters</span>
                </div>
                <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-lg">
                  {workflowInputs.map((input) => (
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
                          className="font-mono text-xs h-20"
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
                          className="text-sm h-8"
                        />
                      )}
                    </div>
                  ))}
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

            {missingRequired.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Missing required inputs:</span>
                  <ul className="mt-1 ml-4 list-disc text-xs">
                    {missingRequired.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2 flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    Configure resources on the canvas first
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={
              isRunning || hasInsufficientBalance || missingRequired.length > 0
            }
            variant="primary"
            className="flex-1"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1.5" />
                Run
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
