"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Select } from "@x402jobs/ui/select";
import {
  Shuffle,
  Plus,
  Trash2,
  Layers,
  MessageCircleQuestion,
} from "lucide-react";
import type {
  TransformType,
  CombineField,
} from "@/components/workflow/nodes/TransformNode";
import Editor from "@monaco-editor/react";

export interface TransformConfig {
  transformType: TransformType;
  label?: string;
  path?: string;
  template?: string;
  code?: string;
  combineFields?: CombineField[];
}

// Node info for combine field selection
export interface AvailableNode {
  id: string;
  type: string;
  label: string; // Display name
}

interface TransformConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TransformConfig) => void;
  currentConfig?: TransformConfig;
  availableNodes?: AvailableNode[]; // Nodes that can be sources for combine
  onAskJobputer?: () => void;
}

export function TransformConfigModal({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  availableNodes = [],
  onAskJobputer,
}: TransformConfigModalProps) {
  const [transformType, setTransformType] = useState<TransformType>(
    currentConfig?.transformType || "extract",
  );
  const [label, setLabel] = useState(currentConfig?.label || "");
  const [path, setPath] = useState(currentConfig?.path || "");
  const [template, setTemplate] = useState(currentConfig?.template || "");
  const [code, setCode] = useState(currentConfig?.code || "");
  const [combineFields, setCombineFields] = useState<CombineField[]>(
    currentConfig?.combineFields || [],
  );

  // Reset form when modal opens with new config
  useEffect(() => {
    if (isOpen && currentConfig) {
      setTransformType(currentConfig.transformType || "extract");
      setLabel(currentConfig.label || "");
      setPath(currentConfig.path || "");
      setTemplate(currentConfig.template || "");
      setCode(currentConfig.code || "");
      setCombineFields(currentConfig.combineFields || []);
    }
  }, [isOpen, currentConfig]);

  const handleSave = () => {
    onSave({
      transformType,
      label: label.trim() || undefined,
      path: transformType === "extract" ? path : undefined,
      template: transformType === "template" ? template : undefined,
      code: transformType === "code" ? code : undefined,
      combineFields: transformType === "combine" ? combineFields : undefined,
    });
  };

  const addCombineField = () => {
    setCombineFields([
      ...combineFields,
      { fieldName: "", sourceNodeId: "", sourcePath: "" },
    ]);
  };

  const removeCombineField = (index: number) => {
    setCombineFields(combineFields.filter((_, i) => i !== index));
  };

  const updateCombineField = (
    index: number,
    updates: Partial<CombineField>,
  ) => {
    setCombineFields(
      combineFields.map((field, i) =>
        i === index ? { ...field, ...updates } : field,
      ),
    );
  };

  const isValid =
    (transformType === "extract" && path.trim().length > 0) ||
    (transformType === "template" && template.trim().length > 0) ||
    (transformType === "code" && code.trim().length > 0) ||
    (transformType === "combine" &&
      combineFields.length > 0 &&
      combineFields.every((f) => f.fieldName.trim() && f.sourceNodeId));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-card max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-transform/20 rounded-lg flex items-center justify-center text-transform">
              <Shuffle className="w-4 h-4" />
            </div>
            <DialogTitle>Configure Transform</DialogTitle>
          </div>
          {onAskJobputer && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAskJobputer}
              className="gap-1.5 h-8 text-trigger border-trigger/30 hover:bg-trigger/10"
            >
              <MessageCircleQuestion className="w-3.5 h-3.5" />
              Ask Jobputer
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transform Type */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">
              Transform Type
            </label>
            <Select
              value={transformType}
              onChange={(value) => setTransformType(value as TransformType)}
              options={[
                { value: "extract", label: "Extract Field" },
                { value: "template", label: "Template" },
                { value: "code", label: "JavaScript Code" },
                { value: "combine", label: "Combine (Merge Multiple)" },
              ]}
            />
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Parse X Coord, Extract Title"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A unique name to identify this transform in your workflow
            </p>
          </div>

          {/* Extract Field Config */}
          {transformType === "extract" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-2">
                Field Path
              </label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="data.items[0].name"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use dot notation to extract a nested field from the input.
                <br />
                Example:{" "}
                <code className="bg-muted px-1 rounded">openAreas[0].x</code>
              </p>
            </div>
          )}

          {/* Template Config */}
          {transformType === "template" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-2">
                Template
              </label>
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="The result is: {{input}}"
                className="font-mono text-sm min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use <code className="bg-muted px-1 rounded">{"{{input}}"}</code>{" "}
                to insert the incoming data.
                <br />
                Use{" "}
                <code className="bg-muted px-1 rounded">
                  {"{{input.field}}"}
                </code>{" "}
                to insert a specific field.
              </p>
            </div>
          )}

          {/* Code Config */}
          {transformType === "code" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-2">
                JavaScript Code
              </label>
              <div className="border border-border rounded-lg overflow-hidden">
                <Editor
                  height="200px"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                    padding: { top: 8, bottom: 8 },
                    tabSize: 2,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                The upstream output is available as{" "}
                <code className="bg-muted px-1 rounded">input</code>. Return the
                transformed result.
              </p>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p className="font-medium text-foreground/70">Examples:</p>
                <p>
                  <code className="bg-muted px-1 rounded text-[11px]">
                    return input.data.items.map(i =&gt; i.title);
                  </code>
                </p>
                <p>
                  <code className="bg-muted px-1 rounded text-[11px]">
                    return {"{"} name: input.user.name, count:
                    input.items.length {"}"};
                  </code>
                </p>
              </div>
            </div>
          )}

          {/* Combine Config */}
          {transformType === "combine" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-muted-foreground">
                  Fields to Combine
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addCombineField}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Field
                </Button>
              </div>

              {availableNodes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg bg-amber-500/10 border-amber-500/30">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-500" />
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    No inputs connected
                  </p>
                  <p className="text-xs mt-1">
                    Connect resources to this transform node with edges,
                    <br />
                    then their outputs will appear here to combine.
                  </p>
                </div>
              ) : combineFields.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No fields configured</p>
                  <p className="text-xs mt-1">
                    {availableNodes.length} connected node
                    {availableNodes.length > 1 ? "s" : ""} available to combine
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {combineFields.map((field, index) => (
                    <div
                      key={index}
                      className="p-3 border border-border rounded-lg space-y-2 bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Field {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCombineField(index)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Output Field Name
                          </label>
                          <Input
                            value={field.fieldName}
                            onChange={(e) =>
                              updateCombineField(index, {
                                fieldName: e.target.value,
                              })
                            }
                            placeholder="imageUrl"
                            className="font-mono text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Source Node
                          </label>
                          {availableNodes.length > 0 ? (
                            <Select
                              value={field.sourceNodeId}
                              onChange={(value) =>
                                updateCombineField(index, {
                                  sourceNodeId: value,
                                })
                              }
                              options={[
                                { value: "", label: "Select node..." },
                                ...availableNodes.map((node) => ({
                                  value: node.id,
                                  label: node.label,
                                })),
                              ]}
                            />
                          ) : (
                            <Input
                              value={field.sourceNodeId}
                              onChange={(e) =>
                                updateCombineField(index, {
                                  sourceNodeId: e.target.value,
                                })
                              }
                              placeholder="node-id"
                              className="font-mono text-sm h-8"
                            />
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Extract Path (optional)
                        </label>
                        <Input
                          value={field.sourcePath || ""}
                          onChange={(e) =>
                            updateCombineField(index, {
                              sourcePath: e.target.value,
                            })
                          }
                          placeholder="Leave empty for full output, or e.g. artifactUrl"
                          className="font-mono text-sm h-8"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Combine merges outputs from connected upstream nodes into a
                single object.
                <br />
                <span className="text-transform">Tip:</span> Draw edges from
                each resource node to this transform to add them as sources.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="bg-transform hover:bg-transform/90 text-white"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
