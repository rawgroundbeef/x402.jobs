"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@x402jobs/ui/alert";
import { Button } from "@x402jobs/ui/button";
import { Label } from "@x402jobs/ui/label";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import {
  Play,
  Copy,
  Check,
  Globe,
  DollarSign,
  Square,
  CheckSquare,
  Plus,
  Trash2,
  Settings2,
  Clock,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  WorkflowInput,
  ScheduleConfig,
} from "@/components/workflow/nodes/TriggerNode";

// Legacy type for backwards compatibility
export type TriggerType = "manual" | "webhook" | "schedule";

// New type for multiple activation methods
export interface TriggerMethods {
  manual: boolean;
  webhook: boolean;
  schedule: boolean;
}

// Common cron presets for easy selection
const CRON_PRESETS = [
  {
    label: "Every hour",
    value: "0 * * * *",
    description: "At minute 0 of every hour",
  },
  {
    label: "Every day at 9 AM",
    value: "0 9 * * *",
    description: "Daily at 9:00 AM",
  },
  {
    label: "Every day at 6 PM",
    value: "0 18 * * *",
    description: "Daily at 6:00 PM",
  },
  {
    label: "Every Monday at 9 AM",
    value: "0 9 * * 1",
    description: "Weekly on Monday",
  },
  {
    label: "Every weekday at 9 AM",
    value: "0 9 * * 1-5",
    description: "Mon-Fri at 9:00 AM",
  },
  {
    label: "First of month at 9 AM",
    value: "0 9 1 * *",
    description: "Monthly on the 1st",
  },
  {
    label: "Custom",
    value: "custom",
    description: "Enter your own cron expression",
  },
];

// Common timezones
const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

interface TriggerConfig {
  triggerType: TriggerType; // Legacy - kept for backwards compatibility
  triggerMethods?: TriggerMethods; // New - multiple methods enabled
  webhookSecret?: string; // Kept for backwards compatibility but not used
  workflowInputs?: WorkflowInput[]; // Configurable workflow parameters
  creatorMarkup?: number; // Creator's markup in USDC (e.g., 0.10 for 10 cents)
  scheduleConfig?: ScheduleConfig; // Schedule configuration
  published?: boolean; // Whether job appears in public marketplace
  onSuccessJobId?: string | null; // Job to trigger on successful completion
}

interface TriggerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  jobSlug?: string;
  username?: string;
  displayId: number | null;
  currentConfig: TriggerConfig;
  onSave: (config: TriggerConfig) => Promise<void>;
  jobPrice?: number; // Base cost (resources + platform fee) - without creator markup
}

// Convert legacy single type to methods object
function legacyToMethods(
  triggerType: TriggerType,
  methods?: TriggerMethods,
): TriggerMethods {
  if (methods) return { ...methods, schedule: methods.schedule ?? false };
  return {
    manual: triggerType === "manual",
    webhook: triggerType === "webhook",
    schedule: triggerType === "schedule",
  };
}

// Convert methods object to legacy type (for backwards compatibility)
function methodsToLegacy(methods: TriggerMethods): TriggerType {
  // Priority: webhook > schedule > manual
  if (methods.webhook) return "webhook";
  if (methods.schedule) return "schedule";
  return "manual";
}

export function TriggerConfigModal({
  isOpen,
  onClose,
  jobId,
  jobSlug,
  username,
  currentConfig,
  onSave,
  jobPrice = 0,
}: TriggerConfigModalProps) {
  const [methods, setMethods] = useState<TriggerMethods>(() =>
    legacyToMethods(currentConfig.triggerType, currentConfig.triggerMethods),
  );
  const [workflowInputs, setWorkflowInputs] = useState<WorkflowInput[]>(
    currentConfig.workflowInputs || [],
  );
  const [creatorMarkup, setCreatorMarkup] = useState<number>(
    currentConfig.creatorMarkup || 0,
  );
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(
    currentConfig.scheduleConfig || {
      cron: "0 9 * * *",
      timezone: "UTC",
      enabled: true,
    },
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const cron = currentConfig.scheduleConfig?.cron || "0 9 * * *";
    const preset = CRON_PRESETS.find((p) => p.value === cron);
    return preset ? preset.value : "custom";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState<boolean>(
    currentConfig.published ?? true,
  );

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMethods(
        legacyToMethods(
          currentConfig.triggerType,
          currentConfig.triggerMethods,
        ),
      );
      setWorkflowInputs(currentConfig.workflowInputs || []);
      setCreatorMarkup(currentConfig.creatorMarkup || 0);
      setPublished(currentConfig.published ?? true);
      const newScheduleConfig = currentConfig.scheduleConfig || {
        cron: "0 9 * * *",
        timezone: "UTC",
        enabled: true,
      };
      setScheduleConfig(newScheduleConfig);
      const preset = CRON_PRESETS.find(
        (p) => p.value === newScheduleConfig.cron,
      );
      setSelectedPreset(preset ? preset.value : "custom");
    }
  }, [isOpen, currentConfig]);

  // Use nice URL format if username and slug are available, otherwise fall back to UUID
  const apiUrl =
    process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";
  const webhookUrl = jobId
    ? username && jobSlug
      ? `${apiUrl}/@${username}/${jobSlug}`
      : `${apiUrl}/webhooks/${jobId}`
    : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // If schedule trigger is off, schedule_enabled must be false
      const effectiveScheduleConfig = {
        cron: scheduleConfig.cron,
        timezone: scheduleConfig.timezone,
        enabled: methods.schedule ? scheduleConfig.enabled : false,
      };

      await onSave({
        triggerType: methodsToLegacy(methods),
        triggerMethods: methods,
        workflowInputs: workflowInputs.filter((i) => i.name.trim()), // Remove empty inputs
        creatorMarkup: creatorMarkup,
        scheduleConfig: effectiveScheduleConfig,
        published: published,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save trigger config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addWorkflowInput = () => {
    setWorkflowInputs([
      ...workflowInputs,
      { name: "", type: "string", required: false, description: "" },
    ]);
  };

  const removeWorkflowInput = (index: number) => {
    setWorkflowInputs(workflowInputs.filter((_, i) => i !== index));
  };

  const updateWorkflowInput = (
    index: number,
    updates: Partial<WorkflowInput>,
  ) => {
    setWorkflowInputs(
      workflowInputs.map((input, i) =>
        i === index ? { ...input, ...updates } : input,
      ),
    );
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMethod = (method: keyof TriggerMethods) => {
    setMethods((prev) => ({
      ...prev,
      [method]: !prev[method],
    }));
  };

  // Schedule must have valid cron if enabled (but all methods can be disabled to turn job "off")
  const isScheduleValid =
    !methods.schedule || (scheduleConfig.cron && scheduleConfig.timezone);
  const isValid = isScheduleValid; // Allow all triggers to be disabled

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Trigger Settings</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6 py-4">
          {/* Activation Methods */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose how this job can be triggered (disable all to turn off)
            </p>
            <div className="space-y-2">
              {/* Manual */}
              <button
                onClick={() => toggleMethod("manual")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                  methods.manual
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {methods.manual ? (
                  <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Play className="h-4 w-4 text-trigger" />
                    <span className="font-medium">Manual</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click the &quot;Go&quot; button to run the job yourself
                  </p>
                </div>
              </button>

              {/* Webhook (x402) */}
              <button
                onClick={() => toggleMethod("webhook")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                  methods.webhook
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {methods.webhook ? (
                  <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Webhook (x402)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    External systems can call this job and pay per use
                  </p>
                </div>
              </button>

              {/* Schedule */}
              <button
                onClick={() => toggleMethod("schedule")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                  methods.schedule
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {methods.schedule ? (
                  <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Scheduled</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Run automatically on a recurring schedule (e.g., daily at 9
                    AM)
                  </p>
                </div>
              </button>
            </div>

            {methods.schedule && !isScheduleValid && (
              <p className="text-xs text-destructive">
                Schedule requires a valid cron expression and timezone
              </p>
            )}
          </div>

          {/* Job Parameters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Job Parameters
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Define parameters that can be passed to this job
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addWorkflowInput}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Parameter
              </Button>
            </div>

            {workflowInputs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                <p>No parameters defined</p>
                <p className="text-xs mt-1">
                  Add parameters that resources can reference
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {workflowInputs.map((input, index) => (
                  <div
                    key={index}
                    className="p-3 border border-border rounded-lg space-y-2 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Parameter {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWorkflowInput(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Name
                        </label>
                        <Input
                          value={input.name}
                          onChange={(e) =>
                            updateWorkflowInput(index, {
                              name: e.target.value.replace(/\s/g, "_"),
                            })
                          }
                          placeholder="brand_agent_id"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Type
                        </label>
                        <Select
                          value={input.type}
                          onChange={(value) =>
                            updateWorkflowInput(index, {
                              type: value as WorkflowInput["type"],
                            })
                          }
                          options={[
                            { value: "string", label: "String" },
                            { value: "number", label: "Number" },
                            { value: "boolean", label: "Boolean" },
                            { value: "object", label: "Object (JSON)" },
                            { value: "file", label: "File Upload" },
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Description (optional)
                      </label>
                      <Input
                        value={input.description || ""}
                        onChange={(e) =>
                          updateWorkflowInput(index, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Brief description of this input"
                        className="text-sm h-8"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`required-${index}`}
                        checked={input.required}
                        onChange={(e) =>
                          updateWorkflowInput(index, {
                            required: e.target.checked,
                          })
                        }
                        className="rounded border-border"
                      />
                      <label
                        htmlFor={`required-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        Required
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhook Settings */}
          {methods.webhook && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg overflow-hidden">
              {/* Publish to Marketplace Toggle */}
              <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div className="flex items-start gap-3">
                  {published ? (
                    <Eye className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      Publish to Marketplace
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {published
                        ? "Visible in public jobs list at x402.jobs"
                        : "Hidden from public list (endpoint still works)"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPublished(!published)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    published ? "bg-green-500" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      published ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Pricing Section */}
              <div className="space-y-3 p-3 bg-background rounded-lg border">
                {/* Base Cost */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Base cost (resources + platform)
                  </span>
                  <span className="text-sm font-mono">
                    ${jobPrice.toFixed(2)}
                  </span>
                </div>

                {/* Creator Markup */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Your markup (profit)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={creatorMarkup || ""}
                      onChange={(e) =>
                        setCreatorMarkup(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-20 h-7 text-sm text-right font-mono"
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Total Price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      Total price per run
                    </span>
                  </div>
                  <span className="text-lg font-bold text-green-500">
                    ${(jobPrice + creatorMarkup).toFixed(2)} USDC
                  </span>
                </div>

                {/* Disclaimer */}
                <p className="text-[10px] text-muted-foreground/70 leading-tight">
                  Callers pay the total price upfront. Payment is
                  non-refundable. Job execution is not guaranteed.
                </p>
              </div>

              {/* Endpoint URL */}
              <div className="space-y-2 min-w-0">
                <Label>Endpoint</Label>
                {webhookUrl ? (
                  <button
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="w-full p-2 bg-background rounded border text-left hover:bg-accent transition-colors group overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <code className="text-xs font-mono truncate min-w-0">
                        {webhookUrl}
                      </code>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                      )}
                    </div>
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Save the job first to get an endpoint URL
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Schedule Configuration */}
          {methods.schedule && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              {/* Schedule Notice */}
              <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <Clock className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Scheduled Execution</p>
                  <p className="text-xs text-muted-foreground">
                    This job will run automatically on the schedule you
                    configure. Each run will be charged to your wallet.
                  </p>
                </div>
              </div>

              {/* Schedule Preset */}
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select
                  value={selectedPreset}
                  onChange={(value) => {
                    setSelectedPreset(value);
                    if (value !== "custom") {
                      setScheduleConfig((prev) => ({ ...prev, cron: value }));
                    }
                  }}
                  options={CRON_PRESETS.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                />
                {selectedPreset !== "custom" && (
                  <p className="text-xs text-muted-foreground">
                    {
                      CRON_PRESETS.find((p) => p.value === selectedPreset)
                        ?.description
                    }
                  </p>
                )}
              </div>

              {/* Custom Cron Expression */}
              {selectedPreset === "custom" && (
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <Input
                    value={scheduleConfig.cron}
                    onChange={(e) =>
                      setScheduleConfig((prev) => ({
                        ...prev,
                        cron: e.target.value,
                      }))
                    }
                    placeholder="0 9 * * *"
                    className="font-mono"
                  />
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Format: minute hour day month weekday (e.g., &quot;0 9 * *
                      *&quot; = daily at 9 AM)
                    </span>
                  </div>
                </div>
              )}

              {/* Timezone */}
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={scheduleConfig.timezone}
                  onChange={(value) =>
                    setScheduleConfig((prev) => ({ ...prev, timezone: value }))
                  }
                  options={TIMEZONES}
                />
              </div>

              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Schedule Enabled</p>
                  <p className="text-xs text-muted-foreground">
                    {scheduleConfig.enabled
                      ? "Job will run on schedule"
                      : "Schedule is paused"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setScheduleConfig((prev) => ({
                      ...prev,
                      enabled: !prev.enabled,
                    }))
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    scheduleConfig.enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      scheduleConfig.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Cost Warning */}
              <Alert variant="warning">
                <DollarSign className="h-4 w-4" />
                <AlertTitle>Automatic Charges</AlertTitle>
                <AlertDescription>
                  Each scheduled run will charge ${jobPrice.toFixed(2)} USDC
                  from your wallet. Make sure you have sufficient balance.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || !isValid}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
