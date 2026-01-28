"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Box, Play, Copy, Check } from "lucide-react";
import { Switch } from "@x402jobs/ui/switch";
import { Select } from "@x402jobs/ui/select";
import { useToast } from "@x402jobs/ui/toast";
import { SlidePanel } from "./SlidePanel";
import { DrawerHeaderAvatar } from "./DrawerHeaderAvatar";
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

interface ResourceConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (inputs: ConfiguredInputs) => void;
  onTry?: () => void;
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
        headerFields?: Record<string, BodyField>;
      };
    };
    // Prompt template parameters (alternative to outputSchema for prompt_template resources)
    pt_parameters?: Array<{
      name: string;
      description?: string;
      required?: boolean;
      default?: string;
    }>;
  } | null;
  currentInputs?: ConfiguredInputs;
  availableNodes: AvailableNode[];
  workflowInputs?: WorkflowInput[];
  /** Stack level for z-index ordering */
  stackLevel?: number;
  /** Is there a panel stacked on top of this one? */
  hasStackedChild?: boolean;
}

// Helper to determine source type from InputValue
type SourceType = "static" | "job-params" | string; // string = node ID

function getSourceType(input: InputValue, triggerNodeId?: string): SourceType {
  if (input.type === "static") return "static";
  if (
    input.sourceNodeId === triggerNodeId ||
    input.sourceNodeId?.startsWith("trigger")
  ) {
    return "job-params";
  }
  return input.sourceNodeId || "static";
}

export function ResourceConfigPanel({
  isOpen,
  onClose,
  onSave,
  onTry,
  nodeId,
  resource,
  currentInputs = {},
  availableNodes = [],
  workflowInputs = [],
  stackLevel = 1,
  hasStackedChild = false,
}: ResourceConfigPanelProps) {
  const [inputs, setInputs] = useState<ConfiguredInputs>(currentInputs);
  const [initialInputs, setInitialInputs] =
    useState<ConfiguredInputs>(currentInputs);
  const [urlCopied, setUrlCopied] = useState(false);
  const { toast } = useToast();

  // Track if panel was previously open to detect open transitions
  const wasOpenRef = useRef(false);
  // Track by NODE ID (not resource ID) - multiple nodes can use the same resource
  const lastNodeIdRef = useRef(nodeId);

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    if (!resource?.resourceUrl) return;
    try {
      await navigator.clipboard.writeText(resource.resourceUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy URL", variant: "destructive" });
    }
  };

  // Find trigger node from available nodes
  const triggerNode = useMemo(
    () => availableNodes.find((n) => n.type === "trigger"),
    [availableNodes],
  );

  // Filter out trigger node from upstream nodes (we handle it separately as "Job Parameters")
  const upstreamNodes = useMemo(
    () => availableNodes.filter((n) => n.type !== "trigger"),
    [availableNodes],
  );

  // Reset inputs only when panel OPENS (not on every re-render) or node changes
  // IMPORTANT: Track by nodeId, not resource.id - multiple nodes can use the same resource!
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const nodeChanged = nodeId !== lastNodeIdRef.current;

    // Update refs
    wasOpenRef.current = isOpen;
    lastNodeIdRef.current = nodeId;

    // Only reset inputs when panel first opens or different node is being configured
    if (isOpen && (justOpened || nodeChanged)) {
      const availableNodeIds = new Set(availableNodes.map((n) => n.id));
      const cleanedInputs: ConfiguredInputs = {};

      for (const [key, value] of Object.entries(currentInputs)) {
        if (
          value?.type === "reference" &&
          value.sourceNodeId &&
          !availableNodeIds.has(value.sourceNodeId) &&
          !value.sourceNodeId.startsWith("trigger")
        ) {
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

  // Debug: log what resource we're receiving
  console.log("ResourceConfigPanel resource:", {
    name: resource?.name,
    outputSchema: resource?.outputSchema,
    pt_parameters: resource?.pt_parameters,
  });

  // Get all input fields from resource schema (bodyFields, queryParams, headerFields)
  // Also supports pt_parameters for prompt_template resources
  const inputFields = useMemo(() => {
    const fields: Record<string, BodyField> = {};

    // Check for traditional outputSchema fields
    const input = resource?.outputSchema?.input;
    if (input) {
      // Merge bodyFields, queryParams, and headerFields
      // bodyFields are typically for POST requests
      // queryParams are for GET requests
      // headerFields are HTTP headers that can be configured
      Object.assign(fields, input.bodyFields || {});
      Object.assign(fields, input.queryParams || {});
      Object.assign(fields, input.headerFields || {});
    }

    // Check for pt_parameters (prompt_template resources)
    if (resource?.pt_parameters && resource.pt_parameters.length > 0) {
      for (const param of resource.pt_parameters) {
        fields[param.name] = {
          type: "string",
          required: param.required,
          description: param.description || undefined,
          default: param.default || undefined,
        };
      }
    }

    return fields;
  }, [resource]);

  const fieldEntries = useMemo(() => {
    return Object.entries(inputFields);
  }, [inputFields]);

  const updateInput = (fieldName: string, value: InputValue) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }));
  };

  // Handle source type change
  const handleSourceTypeChange = (
    fieldName: string,
    sourceType: SourceType,
  ) => {
    if (sourceType === "static") {
      updateInput(fieldName, { type: "static", value: "" });
    } else if (sourceType === "job-params") {
      // Use trigger node ID, default to first workflow input
      updateInput(fieldName, {
        type: "reference",
        sourceNodeId: triggerNode?.id || "trigger-1",
        sourceField: workflowInputs[0]?.name || "",
      });
    } else {
      // It's a node ID
      updateInput(fieldName, {
        type: "reference",
        sourceNodeId: sourceType,
        sourceField: "response",
      });
    }
  };

  // Build source type options for dropdown
  const getSourceTypeOptions = () => {
    const options: { value: string; label: string; disabled?: boolean }[] = [
      { value: "static", label: "Static" },
    ];

    // Job Parameters option - disabled if no workflow inputs
    const hasJobParams = workflowInputs.length > 0;
    options.push({
      value: "job-params",
      label: "Job Parameters",
      disabled: !hasJobParams,
    });

    // Upstream node options
    for (const node of upstreamNodes) {
      options.push({
        value: node.id,
        label: `From ${node.name}`,
      });
    }

    return options;
  };

  const handleSave = () => {
    onSave(inputs);
    toast({
      title: "Configuration saved",
      variant: "success",
    });
  };

  if (!resource) return null;

  const displayName = getResourceDisplayName(resource);

  // Build resource page URL if we have the slugs
  const resourcePageUrl =
    resource.serverSlug && resource.slug
      ? `/resources/${resource.serverSlug}/${resource.slug}`
      : null;

  // Avatar for header
  const headerAvatar = (
    <DrawerHeaderAvatar
      src={resource.avatarUrl}
      fallbackIcon={<Box className="h-8 w-8 text-resource" />}
      fallbackClassName="bg-resource/20"
    />
  );

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-start gap-4 py-1 pr-6">
          {headerAvatar}
          <div className="flex-1 min-w-0 overflow-hidden">
            {resourcePageUrl ? (
              <a
                href={resourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground text-lg truncate block hover:text-primary transition-colors"
              >
                {displayName}
              </a>
            ) : (
              <div className="font-semibold text-foreground text-lg truncate">
                {displayName}
              </div>
            )}
            {resource.description && (
              <p className="text-sm text-muted-foreground/80 mt-0.5 font-normal line-clamp-2">
                {resource.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground font-normal">
                ${resource.price.toFixed(2)} per call
              </span>
              {resource.resourceUrl && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleCopyUrl();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  title="Copy API URL"
                >
                  {urlCopied ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy API URL</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      }
      stackLevel={stackLevel}
      hasStackedChild={hasStackedChild}
      footer={
        <div className="flex justify-end gap-2">
          {onTry && (
            <Button variant="outline" onClick={onTry} className="gap-1.5">
              <Play className="h-4 w-4" />
              Try It
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Input Fields - no section header needed */}
        {fieldEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No configuration needed</p>
            <p className="text-xs mt-1">
              This resource has no input parameters
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {fieldEntries.map(([fieldName, field]) => {
              const inputConfig = inputs[fieldName] || {
                type: "static",
                value: "",
              };
              const sourceType = getSourceType(inputConfig, triggerNode?.id);

              return (
                <div key={fieldName} className="space-y-2">
                  {/* Field Label */}
                  <Label className="text-sm flex items-center gap-1.5">
                    {fieldName}
                    {field.required && (
                      <span className="text-destructive">*</span>
                    )}
                    <span className="text-muted-foreground font-normal text-xs">
                      ({field.type})
                    </span>
                  </Label>

                  {field.description && (
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  )}

                  {/* Source Type + Value Layout */}
                  {sourceType === "static" &&
                  !field.enum &&
                  field.type !== "boolean" ? (
                    // Static text input: dropdown above, full-width textarea below
                    <div className="space-y-2">
                      <Select
                        value={sourceType}
                        onChange={(value) =>
                          handleSourceTypeChange(fieldName, value)
                        }
                        options={getSourceTypeOptions()}
                      />
                      <textarea
                        value={inputConfig.value || ""}
                        onChange={(e) =>
                          updateInput(fieldName, {
                            type: "static",
                            value: e.target.value,
                          })
                        }
                        placeholder={
                          field.default !== undefined
                            ? String(field.default)
                            : `Enter ${fieldName}`
                        }
                        className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                        rows={4}
                      />
                    </div>
                  ) : (
                    // Other types: 50-50 grid layout
                    <div className="grid grid-cols-2 gap-2">
                      {/* Left: Source Type Dropdown */}
                      <Select
                        value={sourceType}
                        onChange={(value) =>
                          handleSourceTypeChange(fieldName, value)
                        }
                        options={getSourceTypeOptions()}
                      />

                      {/* Right: Value Input (changes based on source type) */}
                      {sourceType === "static" ? (
                        // Static enum or boolean
                        field.enum ? (
                          <Select
                            value={inputConfig.value || ""}
                            onChange={(value) =>
                              updateInput(fieldName, { type: "static", value })
                            }
                            options={field.enum.map((opt) => ({
                              value: opt,
                              label: opt,
                            }))}
                          />
                        ) : (
                          // Boolean
                          <div className="flex items-center gap-2 px-3">
                            <Switch
                              checked={inputConfig.value === "true"}
                              onCheckedChange={(checked) =>
                                updateInput(fieldName, {
                                  type: "static",
                                  value: String(checked),
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {inputConfig.value === "true" ? "Yes" : "No"}
                            </span>
                          </div>
                        )
                      ) : sourceType === "job-params" ? (
                        // Job Parameters: show dropdown of workflow inputs
                        <Select
                          value={inputConfig.sourceField || ""}
                          onChange={(value) =>
                            updateInput(fieldName, {
                              ...inputConfig,
                              sourceField: value,
                            })
                          }
                          options={workflowInputs.map((input) => ({
                            value: input.name,
                            label: input.name,
                          }))}
                          placeholder="Select parameter..."
                        />
                      ) : (
                        // From Node: show text input for field path
                        <Input
                          value={inputConfig.sourceField || "response"}
                          onChange={(e) =>
                            updateInput(fieldName, {
                              ...inputConfig,
                              sourceField: e.target.value,
                            })
                          }
                          placeholder="response"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
