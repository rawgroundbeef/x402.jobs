"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Globe,
  Calendar,
  Zap,
  Copy,
  Check,
  ChevronRight,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Select } from "@x402jobs/ui/select";
import { SlidePanel } from "./SlidePanel";
import { DrawerHeaderAvatar } from "./DrawerHeaderAvatar";
import { useToast } from "@x402jobs/ui/toast";
import {
  INTERVAL_VALUES,
  SCHEDULE_PRESETS,
  intervalToCron,
  cronToInterval,
  estimatedDailyCost,
  hasScheduleWarning,
  type IntervalUnit,
} from "@/lib/schedule";
import type { WorkflowInput } from "@/components/workflow/nodes/TriggerNode";

export interface TriggerMethods {
  manual: boolean;
  webhook: boolean;
  schedule?: boolean;
}

export interface ScheduleConfig {
  cron: string;
  timezone: string;
  enabled: boolean;
}

export type WebhookResponseMode = "passthrough" | "confirmation" | "template";

export interface WebhookResponseConfig {
  mode: WebhookResponseMode;
  template?: string;
  successMessage?: string;
}

export interface TriggerConfigPanelConfig {
  methods: TriggerMethods;
  scheduleConfig?: ScheduleConfig;
  creatorMarkup: number;
  published: boolean;
  showWorkflow: boolean;
  webhookResponse?: WebhookResponseConfig;
  workflowInputs?: WorkflowInput[];
}

interface TriggerConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TriggerConfigPanelConfig) => void;
  currentConfig?: TriggerConfigPanelConfig;
  jobPrice: number;
  webhookUrl?: string;
  /** Whether the job has resources (affects webhook response options) */
  hasResources?: boolean;
  /** Stack level for z-index ordering */
  stackLevel?: number;
  /** Is there a panel stacked on top of this one? */
  hasStackedChild?: boolean;
}

const DEFAULT_WEBHOOK_TEMPLATE = `{
  "success": true,
  "message": "{{payment.message}}",
  "payment": {
    "amount": "{{payment.amount}}",
    "payer": "{{payment.payer}}"
  }
}`;

export function TriggerConfigPanel({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  jobPrice,
  webhookUrl,
  hasResources = false,
  stackLevel = 1,
  hasStackedChild = false,
}: TriggerConfigPanelProps) {
  const { toast } = useToast();
  const wasOpenRef = useRef(false);

  // Local state
  const [methods, setMethods] = useState<TriggerMethods>(
    currentConfig?.methods || { manual: true, webhook: false },
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(
    currentConfig?.scheduleConfig?.enabled || false,
  );
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("hours");
  const [customCron, setCustomCron] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [useCustomCron, setUseCustomCron] = useState(false);
  const [creatorMarkup, setCreatorMarkup] = useState(
    currentConfig?.creatorMarkup || 0,
  );
  const [published, setPublished] = useState(currentConfig?.published || false);
  const [showWorkflow, setShowWorkflow] = useState(
    currentConfig?.showWorkflow || false,
  );
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Webhook response state
  const [webhookResponseMode, setWebhookResponseMode] =
    useState<WebhookResponseMode>(
      currentConfig?.webhookResponse?.mode ||
        (hasResources ? "passthrough" : "confirmation"),
    );
  const [webhookSuccessMessage, setWebhookSuccessMessage] = useState(
    currentConfig?.webhookResponse?.successMessage || "Payment successful",
  );
  const [webhookTemplate, setWebhookTemplate] = useState(
    currentConfig?.webhookResponse?.template || DEFAULT_WEBHOOK_TEMPLATE,
  );

  // Workflow inputs state
  const [workflowInputs, setWorkflowInputs] = useState<WorkflowInput[]>(
    currentConfig?.workflowInputs || [],
  );

  // Reset form when panel opens
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened && currentConfig) {
      setMethods(currentConfig.methods || { manual: true, webhook: false });
      setScheduleEnabled(currentConfig.scheduleConfig?.enabled || false);
      setCreatorMarkup(currentConfig.creatorMarkup || 0);
      setPublished(currentConfig.published || false);
      setShowWorkflow(currentConfig.showWorkflow || false);

      // Reset webhook response state
      setWebhookResponseMode(
        currentConfig.webhookResponse?.mode ||
          (hasResources ? "passthrough" : "confirmation"),
      );
      setWebhookSuccessMessage(
        currentConfig.webhookResponse?.successMessage || "Payment successful",
      );
      setWebhookTemplate(
        currentConfig.webhookResponse?.template || DEFAULT_WEBHOOK_TEMPLATE,
      );

      // Reset workflow inputs
      setWorkflowInputs(currentConfig.workflowInputs || []);

      // Parse cron to interval if schedule exists
      if (currentConfig.scheduleConfig?.cron) {
        const cron = currentConfig.scheduleConfig.cron;
        setCustomCron(cron);

        // Check if it matches a preset
        const matchingPreset = SCHEDULE_PRESETS.find((p) => p.cron === cron);
        if (matchingPreset) {
          setSelectedPreset(matchingPreset.id);
          setUseCustomCron(false);
          if (matchingPreset.interval) {
            setIntervalValue(matchingPreset.interval.value);
            setIntervalUnit(matchingPreset.interval.unit);
          }
        } else {
          // Try to parse as interval
          const parsed = cronToInterval(cron);
          if (parsed) {
            setIntervalValue(parsed.value);
            setIntervalUnit(parsed.unit);
            setSelectedPreset("");
            setUseCustomCron(false);
          } else {
            // It's a custom cron expression
            setUseCustomCron(true);
            setSelectedPreset("");
          }
        }
      } else {
        // Reset to defaults
        setIntervalValue(1);
        setIntervalUnit("hours");
        setCustomCron("");
        setSelectedPreset("");
        setUseCustomCron(false);
      }
    }
  }, [isOpen, currentConfig, hasResources]);

  const toggleMethod = (method: keyof TriggerMethods) => {
    setMethods((prev) => ({ ...prev, [method]: !prev[method] }));
  };

  // Workflow input handlers
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

  const handleSave = () => {
    // Determine the cron expression to use
    let cronExpression: string;
    if (useCustomCron && customCron.trim()) {
      cronExpression = customCron.trim();
    } else if (selectedPreset) {
      const preset = SCHEDULE_PRESETS.find((p) => p.id === selectedPreset);
      cronExpression =
        preset?.cron || intervalToCron(intervalValue, intervalUnit);
    } else {
      cronExpression = intervalToCron(intervalValue, intervalUnit);
    }

    // Build webhook response config if webhook is enabled
    const webhookResponseConfig: WebhookResponseConfig | undefined =
      methods.webhook
        ? {
            mode: webhookResponseMode,
            ...(webhookResponseMode === "template" && {
              template: webhookTemplate,
            }),
            ...(webhookResponseMode === "confirmation" && {
              successMessage: webhookSuccessMessage,
            }),
          }
        : undefined;

    const config: TriggerConfigPanelConfig = {
      methods: {
        ...methods,
        schedule: scheduleEnabled,
      },
      scheduleConfig: scheduleEnabled
        ? {
            cron: cronExpression,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            enabled: true,
          }
        : undefined,
      creatorMarkup,
      published,
      showWorkflow,
      webhookResponse: webhookResponseConfig,
      workflowInputs: workflowInputs.filter((i) => i.name.trim()), // Remove empty inputs
    };

    onSave(config);
    toast({
      title: "Trigger configuration saved",
      variant: "success",
    });
  };

  const copyWebhookUrl = async () => {
    if (webhookUrl) {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Get interval values for current unit
  const intervalOptions = INTERVAL_VALUES[intervalUnit] || [1, 2, 3, 4, 5];

  const headerAvatar = (
    <DrawerHeaderAvatar
      fallbackIcon={<Zap className="h-8 w-8 text-trigger" />}
      fallbackClassName="bg-trigger/20"
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
            <div className="font-semibold text-foreground text-lg">
              Configure Trigger
            </div>
            <p className="text-sm text-muted-foreground/80 mt-1 font-normal">
              How this job can be started
            </p>
          </div>
        </div>
      }
      stackLevel={stackLevel}
      hasStackedChild={hasStackedChild}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-trigger hover:bg-trigger/90 text-white"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Trigger Methods */}
        <div className="space-y-4">
          <div className="text-sm font-medium text-foreground">
            Trigger Methods
          </div>

          {/* Manual */}
          <div className="rounded-lg border border-border overflow-hidden">
            <label className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-trigger/20 flex items-center justify-center">
                  <Play className="h-4 w-4 text-trigger" />
                </div>
                <div>
                  <div className="text-sm font-medium">Manual</div>
                  <div className="text-xs text-muted-foreground">
                    Click "Run" to start manually
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={methods.manual}
                onChange={() => toggleMethod("manual")}
                className="h-4 w-4 rounded border-border"
              />
            </label>
          </div>

          {/* Webhook */}
          <div className="rounded-lg border border-border overflow-hidden">
            <label className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">Webhook (x402)</div>
                  <div className="text-xs text-muted-foreground">
                    External systems can call this job
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={methods.webhook}
                onChange={() => toggleMethod("webhook")}
                className="h-4 w-4 rounded border-border"
              />
            </label>

            {methods.webhook && (
              <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50 bg-muted/20">
                <div className="pt-3">
                  {/* Webhook URL */}
                  {webhookUrl && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Endpoint URL</Label>
                      <button
                        onClick={copyWebhookUrl}
                        className="w-full p-2 bg-background rounded-lg border text-left hover:bg-muted transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs font-mono truncate flex-1">
                            {webhookUrl}
                          </code>
                          {copiedUrl ? (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                          )}
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="space-y-2 p-3 bg-background rounded-lg border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Base cost</span>
                    <span className="font-mono">${jobPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your markup</span>
                    <div className="flex items-center gap-1">
                      <span>$</span>
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
                  <div className="border-t border-border pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total per run</span>
                      <span className="text-lg font-bold text-green-500">
                        ${(jobPrice + creatorMarkup).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={() => setPublished(!published)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Publish to Marketplace</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWorkflow}
                      onChange={() => setShowWorkflow(!showWorkflow)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Show workflow publicly</span>
                  </label>
                </div>

                {/* Webhook Response Mode */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <Label className="text-xs font-medium">Response Mode</Label>

                  {/* Pass-through - only if there are resources */}
                  {hasResources && (
                    <button
                      type="button"
                      onClick={() => setWebhookResponseMode("passthrough")}
                      className={`w-full p-2.5 rounded-lg border transition-all text-left flex items-start gap-2.5 ${
                        webhookResponseMode === "passthrough"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          webhookResponseMode === "passthrough"
                            ? "border-primary"
                            : "border-muted-foreground/50"
                        }`}
                      >
                        {webhookResponseMode === "passthrough" && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Pass-through</div>
                        <div className="text-xs text-muted-foreground">
                          Return the workflow result as-is
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Confirmation */}
                  <button
                    type="button"
                    onClick={() => setWebhookResponseMode("confirmation")}
                    className={`w-full p-2.5 rounded-lg border transition-all text-left flex items-start gap-2.5 ${
                      webhookResponseMode === "confirmation"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        webhookResponseMode === "confirmation"
                          ? "border-primary"
                          : "border-muted-foreground/50"
                      }`}
                    >
                      {webhookResponseMode === "confirmation" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Confirmation</div>
                      <div className="text-xs text-muted-foreground">
                        Return payment confirmation with custom message
                      </div>
                    </div>
                  </button>

                  {/* Confirmation Settings */}
                  {webhookResponseMode === "confirmation" && (
                    <div className="ml-6 pl-3 border-l-2 border-primary/20 space-y-2 py-1">
                      <div className="space-y-1">
                        <Label className="text-xs">Success Message</Label>
                        <Input
                          placeholder="Payment successful"
                          value={webhookSuccessMessage}
                          onChange={(e) =>
                            setWebhookSuccessMessage(e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Template */}
                  <button
                    type="button"
                    onClick={() => setWebhookResponseMode("template")}
                    className={`w-full p-2.5 rounded-lg border transition-all text-left flex items-start gap-2.5 ${
                      webhookResponseMode === "template"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        webhookResponseMode === "template"
                          ? "border-primary"
                          : "border-muted-foreground/50"
                      }`}
                    >
                      {webhookResponseMode === "template" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Custom Template</div>
                      <div className="text-xs text-muted-foreground">
                        Define a custom JSON response with variables
                      </div>
                    </div>
                  </button>

                  {/* Template Editor */}
                  {webhookResponseMode === "template" && (
                    <div className="ml-6 pl-3 border-l-2 border-primary/20 space-y-2 py-1">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Response Template (JSON)
                        </Label>
                        <textarea
                          value={webhookTemplate}
                          onChange={(e) => setWebhookTemplate(e.target.value)}
                          placeholder={DEFAULT_WEBHOOK_TEMPLATE}
                          className="w-full h-32 p-2 text-xs font-mono rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-xs text-muted-foreground">
                          Variables: {"{{payment.amount}}"},{" "}
                          {"{{payment.payer}}"}, {"{{payment.signature}}"},{" "}
                          {"{{inputs.*}}"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-lg border border-border overflow-hidden">
            <label className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-medium">Scheduled</div>
                  <div className="text-xs text-muted-foreground">
                    Run automatically on a schedule
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={() => setScheduleEnabled(!scheduleEnabled)}
                className="h-4 w-4 rounded border-border"
              />
            </label>

            {scheduleEnabled && (
              <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50 bg-muted/20">
                <div className="pt-3">
                  {/* Interval Input */}
                  <div className="space-y-2">
                    <Label className="text-xs">Run every</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(intervalValue)}
                        onChange={(v) => {
                          setIntervalValue(Number(v));
                          setSelectedPreset("");
                          setUseCustomCron(false);
                        }}
                        options={intervalOptions.map((v) => ({
                          value: String(v),
                          label: String(v),
                        }))}
                        className="w-20"
                      />
                      <Select
                        value={intervalUnit}
                        onChange={(v) => {
                          const newUnit = v as IntervalUnit;
                          const availableValues = INTERVAL_VALUES[newUnit];
                          let newValue = intervalValue;
                          if (!availableValues.includes(intervalValue)) {
                            newValue = availableValues[0] || 1;
                            setIntervalValue(newValue);
                          }
                          setIntervalUnit(newUnit);
                          setSelectedPreset("");
                          setUseCustomCron(false);
                        }}
                        options={[
                          { value: "minutes", label: "minutes" },
                          { value: "hours", label: "hours" },
                          { value: "days", label: "days" },
                        ]}
                        className="w-28"
                      />
                    </div>
                    {/* Cost preview */}
                    {(() => {
                      const costEstimate = estimatedDailyCost(
                        intervalValue,
                        intervalUnit,
                        jobPrice,
                      );
                      const scheduleHasWarning = hasScheduleWarning(
                        intervalValue,
                        intervalUnit,
                        jobPrice,
                      );
                      return (
                        <p
                          className={`text-xs ${scheduleHasWarning ? "text-orange-500" : "text-muted-foreground"}`}
                        >
                          {costEstimate.runs >= 1
                            ? `${costEstimate.runs.toLocaleString()} runs/day`
                            : `${(costEstimate.runs * 7).toFixed(1)} runs/week`}{" "}
                          · ~$
                          {costEstimate.runs >= 1
                            ? costEstimate.cost.toFixed(2)
                            : (costEstimate.cost * 7).toFixed(2)}
                          {costEstimate.runs >= 1 ? "/day" : "/week"}
                        </p>
                      );
                    })()}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2">
                  <Label className="text-xs">Quick presets</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SCHEDULE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset.id);
                          setUseCustomCron(false);
                          setCustomCron(preset.cron);
                          if (preset.interval) {
                            setIntervalValue(preset.interval.value);
                            setIntervalUnit(preset.interval.unit);
                          }
                        }}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          selectedPreset === preset.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-border hover:bg-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced: Custom Cron */}
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Custom cron expression
                  </summary>
                  <div className="mt-2 space-y-2 pl-4">
                    <Input
                      value={
                        useCustomCron
                          ? customCron
                          : intervalToCron(intervalValue, intervalUnit)
                      }
                      onChange={(e) => {
                        setCustomCron(e.target.value);
                        setUseCustomCron(true);
                        setSelectedPreset("");
                      }}
                      placeholder="0 9 * * *"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>
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
              Add
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
                        placeholder="param_name"
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
                      placeholder="Brief description"
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
      </div>
    </SlidePanel>
  );
}
