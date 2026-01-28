"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Box, Link2, Play, Unlink } from "lucide-react";
import { Switch } from "@x402jobs/ui/switch";
import { Select } from "@x402jobs/ui/select";
import type { WorkflowInput } from "@/components/workflow/nodes/TriggerNode";
import { getResourceDisplayName } from "@/lib/format";

interface BodyField {
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
}

// Input can be either a static value or reference another node's output
export interface InputValue {
  type: "static" | "reference";
  value?: string; // For static values
  sourceNodeId?: string; // For references - which node to get output from
  sourceField?: string; // Optional - specific field from output (default: "response")
}

export type ConfiguredInputs = Record<string, InputValue>;

interface AvailableNode {
  id: string;
  name: string;
  type: string;
}

interface PromptTemplateParameter {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

interface ResourceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (inputs: ConfiguredInputs) => void;
  onTry?: () => void; // Open the Try It modal for this resource
  /** The unique node ID being configured (different from resource.id - multiple nodes can use same resource) */
  nodeId?: string;
  resource: {
    id: string;
    name: string;
    slug?: string;
    serverSlug?: string;
    description?: string;
    price: number;
    avatarUrl?: string;
    resourceUrl?: string;
    outputSchema?: {
      input?: {
        method?: string;
        bodyFields?: Record<string, BodyField>;
        queryParams?: Record<string, BodyField>;
      };
    };
    // Prompt template specific fields
    resource_type?: string;
    pt_parameters?: PromptTemplateParameter[];
    allows_user_message?: boolean;
    model?: string;
  } | null;
  currentInputs?: ConfiguredInputs;
  availableNodes: AvailableNode[]; // Nodes that can provide input (upstream resources)
  workflowInputs?: WorkflowInput[]; // Trigger-level inputs that can be referenced
}

export function ResourceConfigModal({
  isOpen,
  onClose,
  onSave,
  onTry,
  nodeId,
  resource,
  currentInputs = {},
  availableNodes = [],
  workflowInputs = [],
}: ResourceConfigModalProps) {
  const [inputs, setInputs] = useState<ConfiguredInputs>(currentInputs);
  const [initialInputs, setInitialInputs] =
    useState<ConfiguredInputs>(currentInputs);

  // Track if modal was previously open to detect open transitions
  const wasOpenRef = useRef(false);
  // Track by NODE ID (not resource ID) - multiple nodes can use the same resource
  const lastNodeIdRef = useRef(nodeId);

  // Reset inputs only when modal OPENS (not on every re-render) or node changes
  // IMPORTANT: Track by nodeId, not resource.id - multiple nodes can use the same resource!
  // Also clean up stale references (linked to nodes that no longer exist)
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const nodeChanged = nodeId !== lastNodeIdRef.current;

    // Update refs
    wasOpenRef.current = isOpen;
    lastNodeIdRef.current = nodeId;

    // Only reset inputs when modal first opens or different node is being configured
    if (isOpen && (justOpened || nodeChanged)) {
      const availableNodeIds = new Set(availableNodes.map((n) => n.id));
      const cleanedInputs: ConfiguredInputs = {};

      for (const [key, value] of Object.entries(currentInputs)) {
        if (
          value?.type === "reference" &&
          value.sourceNodeId &&
          !availableNodeIds.has(value.sourceNodeId)
        ) {
          // Source node no longer exists, convert to static with empty value
          cleanedInputs[key] = { type: "static", value: "" };
        } else {
          cleanedInputs[key] = value;
        }
      }

      setInputs(cleanedInputs);
      setInitialInputs(cleanedInputs); // Store initial state for dirty checking
    }
  }, [isOpen, currentInputs, availableNodes, nodeId]);

  // Check if form is dirty (has unsaved changes)
  const isDirty = useMemo(() => {
    const currentKeys = Object.keys(inputs);
    const initialKeys = Object.keys(initialInputs);

    // Check if keys are different
    if (currentKeys.length !== initialKeys.length) return true;

    // Check each value
    for (const key of currentKeys) {
      const current = inputs[key];
      const initial = initialInputs[key];

      if (!initial) return true;
      if (current?.type !== initial?.type) return true;
      if (current?.type === "static" && current.value !== initial.value)
        return true;
      if (current?.type === "reference") {
        if (current.sourceNodeId !== initial.sourceNodeId) return true;
        if (current.sourceField !== initial.sourceField) return true;
      }
    }

    return false;
  }, [inputs, initialInputs]);

  // Check if this is a prompt_template resource
  const isPromptTemplate = resource?.resource_type === "prompt_template";

  // Extract input fields from outputSchema (bodyFields for POST, queryParams for GET)
  // For prompt_templates, convert pt_parameters array to bodyFields format
  const bodyFields = useMemo(() => {
    // Handle prompt_template parameters
    if (isPromptTemplate && resource?.pt_parameters) {
      const ptFields: Record<string, BodyField> = {};
      for (const param of resource.pt_parameters) {
        ptFields[param.name] = {
          type: "string",
          required: param.required,
          description: param.description,
          default: param.default,
        };
      }
      // Add user_message field if allowed
      if (resource.allows_user_message) {
        ptFields["user_message"] = {
          type: "string",
          required: false,
          description: "Optional message to accompany your request",
        };
      }
      return ptFields;
    }

    // Standard resource with outputSchema
    const fields = resource?.outputSchema?.input?.bodyFields || {};
    const queryParams = resource?.outputSchema?.input?.queryParams || {};
    // Merge both - queryParams for GET requests, bodyFields for POST
    return { ...fields, ...queryParams };
  }, [resource, isPromptTemplate]);

  // Sort field entries: required fields first, then optional
  const fieldEntries = useMemo(() => {
    return Object.entries(bodyFields).sort(([, a], [, b]) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });
  }, [bodyFields]);

  const handleStaticValueChange = (fieldName: string, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [fieldName]: { type: "static", value },
    }));
  };

  const handleSourceChange = (fieldName: string, sourceNodeId: string) => {
    if (sourceNodeId === "static") {
      // Switch to static mode, preserve any existing static value
      const existingValue =
        inputs[fieldName]?.type === "static" ? inputs[fieldName]?.value : "";
      setInputs((prev) => ({
        ...prev,
        [fieldName]: { type: "static", value: existingValue || "" },
      }));
    } else {
      // Check if this is a trigger node - if so, default to first workflow input
      const sourceNode = availableNodes.find((n) => n.id === sourceNodeId);
      const isTrigger = sourceNode?.type === "trigger";
      const defaultSourceField =
        isTrigger && workflowInputs.length > 0
          ? workflowInputs[0].name
          : "response";

      // Switch to reference mode
      setInputs((prev) => ({
        ...prev,
        [fieldName]: {
          type: "reference",
          sourceNodeId,
          sourceField: defaultSourceField,
        },
      }));
    }
  };

  const handleSave = () => {
    onSave(inputs);
    onClose();
  };

  if (!resource) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex-row items-center gap-3">
          {resource.avatarUrl ? (
            <img
              src={resource.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-resource/20 flex items-center justify-center">
              <Box className="w-5 h-5 text-resource" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <DialogTitle className="truncate">
              Configure {getResourceDisplayName(resource)}
            </DialogTitle>
            {resource.description && (
              <DialogDescription className="truncate">
                {resource.description}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <DialogBody>
          {fieldEntries.length > 0 ? (
            <div className="space-y-4">
              {fieldEntries.map(([fieldName, field]) => {
                const currentValue = inputs[fieldName];
                const isReference = currentValue?.type === "reference";

                // Format type for display
                const formatType = (type: string) => {
                  switch (type) {
                    case "string":
                      return "text";
                    case "integer":
                      return "whole number";
                    case "number":
                      return "number";
                    case "boolean":
                      return "true/false";
                    case "array":
                      return "list";
                    case "object":
                      return "object";
                    default:
                      return type;
                  }
                };

                return (
                  <div key={fieldName} className="space-y-2">
                    <Label
                      htmlFor={fieldName}
                      className="flex items-center gap-1.5 capitalize text-sm font-medium"
                    >
                      {fieldName.replace(/([A-Z])/g, " $1").trim()}
                      {field.required && (
                        <span className="text-destructive">*</span>
                      )}
                      <span className="text-xs text-muted-foreground font-normal normal-case">
                        ({formatType(field.type)}
                        {!field.required && ", optional"})
                      </span>
                    </Label>

                    {/* Source selector - show tabs/buttons if there are upstream nodes */}
                    {availableNodes.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <span className="text-xs text-muted-foreground">
                          Value source
                        </span>
                        <div className="flex rounded-lg border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              handleSourceChange(fieldName, "static")
                            }
                            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                              !isReference
                                ? "bg-blue-600 text-white"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            Manual Input
                          </button>
                          {availableNodes.map((node) => (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() =>
                                handleSourceChange(fieldName, node.id)
                              }
                              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                                isReference &&
                                currentValue?.sourceNodeId === node.id
                                  ? "bg-resource text-white"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              <span className="truncate">
                                Link to {node.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Input field - only show for static values */}
                    {!isReference && (
                      <div className="space-y-1">
                        {field.enum ? (
                          <Select
                            value={(currentValue?.value as string) || ""}
                            onChange={(value) =>
                              handleStaticValueChange(fieldName, value)
                            }
                            placeholder="Select..."
                            options={field.enum.map((opt) => ({
                              value: opt,
                              label: opt,
                            }))}
                          />
                        ) : field.type === "boolean" ? (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-muted-foreground">
                              {field.description || "Enable this option"}
                            </span>
                            <Switch
                              checked={
                                (currentValue?.value as string) === "true"
                              }
                              onCheckedChange={(checked) =>
                                handleStaticValueChange(
                                  fieldName,
                                  checked ? "true" : "false",
                                )
                              }
                            />
                          </div>
                        ) : field.type === "number" ||
                          field.type === "integer" ? (
                          <Input
                            id={fieldName}
                            type="number"
                            placeholder={
                              field.description || `Enter ${fieldName}...`
                            }
                            value={(currentValue?.value as string) || ""}
                            onChange={(e) =>
                              handleStaticValueChange(fieldName, e.target.value)
                            }
                          />
                        ) : (
                          <textarea
                            id={fieldName}
                            placeholder={
                              field.description || `Enter ${fieldName}...`
                            }
                            value={(currentValue?.value as string) || ""}
                            onChange={(e) =>
                              handleStaticValueChange(fieldName, e.target.value)
                            }
                            className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                            rows={4}
                          />
                        )}
                        {field.description && field.type !== "boolean" && (
                          <p className="text-xs text-muted-foreground">
                            {field.description}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show reference info when linked */}
                    {isReference &&
                      (() => {
                        const sourceNode = availableNodes.find(
                          (n) => n.id === currentValue.sourceNodeId,
                        );
                        const isTriggerSource = sourceNode?.type === "trigger";

                        return (
                          <div
                            className={`p-4 rounded-lg ${isTriggerSource ? "bg-trigger/10 border border-trigger/30" : "bg-resource/10 border border-resource/30"}`}
                          >
                            <div className="flex items-center justify-between">
                              <div
                                className={`flex items-center gap-2 font-medium ${isTriggerSource ? "text-trigger" : "text-resource"}`}
                              >
                                <Link2 className="w-5 h-5" />
                                <span>Linked to {sourceNode?.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSourceChange(fieldName, "static")
                                }
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                              >
                                <Unlink className="w-3 h-3" />
                                Unlink
                              </button>
                            </div>

                            {/* For trigger sources, show workflow input selector */}
                            {isTriggerSource && workflowInputs.length > 0 && (
                              <div className="mt-3">
                                <label className="block text-xs text-muted-foreground mb-1">
                                  Select input field
                                </label>
                                <Select
                                  value={currentValue.sourceField || ""}
                                  onChange={(value) =>
                                    setInputs((prev) => ({
                                      ...prev,
                                      [fieldName]: {
                                        ...prev[fieldName],
                                        sourceField: value,
                                      },
                                    }))
                                  }
                                  options={[
                                    { value: "", label: "Select input..." },
                                    ...workflowInputs.map((input) => ({
                                      value: input.name,
                                      label: `${input.name} (${input.type})`,
                                    })),
                                  ]}
                                />
                              </div>
                            )}

                            <p className="text-muted-foreground text-xs mt-2">
                              {isTriggerSource
                                ? "This value will come from the job parameter when the workflow runs."
                                : "The response from this resource will automatically be used as input when the workflow runs."}
                            </p>
                          </div>
                        );
                      })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>This resource has no input fields</p>
              <p className="text-sm mt-1">
                It will run with default parameters
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="justify-between">
          {onTry ? (
            <Button
              onClick={() => {
                onClose();
                onTry();
              }}
              variant="outline"
              className="gap-1.5"
            >
              <Play className="h-4 w-4" />
              Try It
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} variant="primary" disabled={!isDirty}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
