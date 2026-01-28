"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import useSWR from "swr";
import { format, formatDistanceToNow } from "date-fns";
import {
  Play,
  Box,
  Zap,
  Calendar,
  Hash,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Square,
  CheckSquare,
  Plus,
  Trash2,
  Settings2,
  Monitor,
  Send,
  AlertCircle,
  RefreshCw,
  Link2,
} from "lucide-react";
import { Badge } from "@x402jobs/ui/badge";
import { Button } from "@x402jobs/ui/button";
import { Label } from "@x402jobs/ui/label";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Select } from "@x402jobs/ui/select";
import { SlidePanel } from "./SlidePanel";
import { PanelTabs } from "./PanelTabs";
import { DrawerHeaderAvatar } from "./DrawerHeaderAvatar";
import { authenticatedFetcher } from "@/lib/api";
import { useToast } from "@x402jobs/ui/toast";
import { getResourceDisplayName } from "@/lib/format";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { ImageUrlOrUpload } from "@/components/inputs";
import type { Run } from "@/types/runs";
import type { Job } from "@/hooks/useJobQuery";
import type { WorkflowInput } from "@/components/workflow/nodes/TriggerNode";
import {
  SCHEDULE_PRESETS,
  TIMEZONES,
  INTERVAL_VALUES,
  intervalToCron,
  cronToInterval,
  estimatedDailyCost,
  hasScheduleWarning,
  type IntervalUnit,
} from "@/lib/schedule";

// X icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Types for trigger config
type TriggerType = "manual" | "webhook" | "schedule";

interface TriggerMethods {
  manual: boolean;
  webhook: boolean;
  schedule?: boolean;
}

interface ScheduleConfig {
  cron: string;
  timezone: string;
  enabled: boolean;
}

// Schedule input mode
type ScheduleInputMode = "interval" | "preset" | "cron";

// Form types for react-hook-form
interface TriggerFormData {
  methods: TriggerMethods;
  scheduleConfig: ScheduleConfig;
  // Schedule interval input
  scheduleInputMode: ScheduleInputMode;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  selectedPreset: string;
  workflowInputs: WorkflowInput[];
  creatorMarkup: number;
  published: boolean;
  showWorkflow: boolean;
  onSuccessJobId: string | null;
}

// Types for output config
interface OutputDestination {
  type: "app" | "telegram" | "x" | "x402storage";
  enabled: boolean;
  config?: {
    chatId?: string;
    imageField?: string;
    captionField?: string;
  };
}

// Response mode for webhook-triggered jobs
type WebhookResponseMode = "passthrough" | "template" | "confirmation";

interface WebhookResponseConfig {
  mode: WebhookResponseMode;
  template?: string;
  successMessage?: string;
}

interface OutputConfig {
  destinations: OutputDestination[];
  webhookResponse?: WebhookResponseConfig;
}

export type JobPanelTab =
  | "overview"
  | "trigger"
  | "output"
  | "runs"
  | "resources"
  | "settings";

interface JobPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which tab to open to initially */
  initialTab?: JobPanelTab;
  job: Job | null;
  jobId: string | null;
  jobName: string;
  jobSlug?: string;
  username?: string;
  displayId: number | null;
  network: "solana" | "base";
  triggerType: TriggerType;
  triggerMethods: TriggerMethods;
  scheduleConfig?: ScheduleConfig;
  workflowInputs: WorkflowInput[];
  creatorMarkup: number;
  jobPrice: number;
  nodes: unknown[];
  edges: unknown[];
  /** Called when user wants to run the job */
  onRun?: () => void;
  /** Called when trigger config changes */
  onTriggerSave: (config: {
    triggerType: TriggerType;
    triggerMethods: TriggerMethods;
    scheduleConfig?: ScheduleConfig;
    workflowInputs: WorkflowInput[];
    creatorMarkup: number;
    published?: boolean;
    onSuccessJobId?: string | null;
    webhookResponse?: WebhookResponseConfig;
  }) => Promise<void>;
  /** Initial webhook response config */
  webhookResponse?: WebhookResponseConfig;
  /** Current on success job ID */
  onSuccessJobId?: string | null;
  /** Called when output config changes */
  onOutputSave: (nodeId: string, config: OutputConfig) => Promise<void>;
  /** Get output config for an output node */
  getOutputConfig: (nodeId: string) => OutputConfig;
  /** Called when user selects a run to view details */
  onSelectRun?: (run: Run) => void;
  /** Called when job settings (name, description, avatar, published, showWorkflow) change */
  onSettingsSave?: (settings: {
    name: string;
    description?: string;
    avatarUrl?: string;
    published?: boolean;
    showWorkflow?: boolean;
  }) => Promise<void>;
  /** Called when user deletes the job */
  onDelete?: () => Promise<void>;
  /** Current published state */
  published?: boolean;
  /** Whether workflow is visible to public */
  showWorkflow?: boolean;
  /** Called when user wants to configure a resource */
  onConfigureResource?: (nodeId: string) => void;
  /** Is there a panel stacked on top of this one? */
  hasStackedChild?: boolean;
  /** Hide this panel visually (used when 3+ panels are stacked) */
  isHidden?: boolean;
  /** Called when clicked while pushed back - closes child panel */
  onBringToFront?: () => void;
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "success") {
    return <Badge variant="success">Success</Badge>;
  }
  if (s === "failed" || s === "error") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (s === "running" || s === "pending") {
    return <Badge variant="secondary">Running</Badge>;
  }
  if (s === "cancelled") {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function getStatusIcon(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (s === "failed" || s === "error") {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  if (s === "running" || s === "pending") {
    return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null || cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// Collapsible section component for trigger tab sections
interface CollapsibleSectionProps {
  title: string;
  preview?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

function CollapsibleSection({
  title,
  preview,
  defaultExpanded = false,
  children,
  icon,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${
          expanded ? "rounded-t-lg" : "rounded-lg"
        }`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!expanded && preview && (
            <span className="text-sm text-muted-foreground">{preview}</span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              expanded ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      <div
        className={`transition-all duration-200 ease-in-out ${
          expanded ? "opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// Trigger option with nested settings
interface TriggerOptionProps {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconColor?: string;
  children?: React.ReactNode;
}

function TriggerOption({
  enabled,
  onToggle,
  label,
  description,
  icon,
  children,
}: TriggerOptionProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onToggle}
        className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
          enabled
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        {enabled ? (
          <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        ) : (
          <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <span className="font-medium">{label}</span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </button>

      {enabled && children && (
        <div className="ml-7 p-4 bg-card border border-border rounded-lg space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

const DEFAULT_WEBHOOK_TEMPLATE = `{
  "success": true,
  "message": "Payment received",
  "payment": {
    "amount": "{{payment.amount}}",
    "signature": "{{payment.signature}}",
    "payer": "{{payment.payer}}",
    "timestamp": "{{payment.timestamp}}"
  }
}`;

const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  destinations: [
    { type: "app", enabled: true },
    { type: "telegram", enabled: false },
    { type: "x", enabled: false },
  ],
};

/**
 * Comprehensive Job Panel with tabs for Overview, Trigger, Output, Runs, Resources
 */
export function JobPanel({
  isOpen,
  onClose,
  initialTab = "overview",
  job,
  jobId,
  jobName,
  jobSlug,
  username,
  displayId,
  network,
  triggerType: _triggerType,
  triggerMethods: initialTriggerMethods,
  scheduleConfig: initialScheduleConfig,
  workflowInputs: initialWorkflowInputs,
  creatorMarkup: initialCreatorMarkup,
  jobPrice,
  nodes,
  edges: _edges,
  onRun,
  onTriggerSave,
  onOutputSave,
  getOutputConfig,
  onSelectRun,
  onSettingsSave,
  onDelete,
  published: initialPublished,
  showWorkflow: initialShowWorkflow,
  onConfigureResource,
  hasStackedChild,
  isHidden,
  onBringToFront,
  onSuccessJobId: initialOnSuccessJobId,
  webhookResponse: initialWebhookResponse,
}: JobPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<JobPanelTab>(initialTab);

  // Update active tab when initialTab changes (e.g., opening panel to specific tab)
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Trigger form with react-hook-form
  const getInitialScheduleState = () => {
    const cron = initialScheduleConfig?.cron || "0 9 * * *";

    // First, check if it matches a preset
    const preset = SCHEDULE_PRESETS.find((p) => p.cron === cron);
    if (preset) {
      return {
        mode: "preset" as ScheduleInputMode,
        preset: preset.id,
        interval: preset.interval || {
          value: 1,
          unit: "hours" as IntervalUnit,
        },
      };
    }

    // Try to parse as interval
    const interval = cronToInterval(cron);
    if (interval) {
      return {
        mode: "interval" as ScheduleInputMode,
        preset: "",
        interval,
      };
    }

    // Fall back to custom cron
    return {
      mode: "cron" as ScheduleInputMode,
      preset: "",
      interval: { value: 1, unit: "hours" as IntervalUnit },
    };
  };

  const initialScheduleState = getInitialScheduleState();

  const triggerForm = useForm<TriggerFormData>({
    defaultValues: {
      methods: initialTriggerMethods,
      scheduleConfig: initialScheduleConfig || {
        cron: "0 9 * * *",
        timezone: "UTC",
        enabled: true,
      },
      scheduleInputMode: initialScheduleState.mode,
      intervalValue: initialScheduleState.interval.value,
      intervalUnit: initialScheduleState.interval.unit,
      selectedPreset: initialScheduleState.preset,
      workflowInputs: initialWorkflowInputs,
      creatorMarkup: initialCreatorMarkup,
      published: initialPublished ?? true,
      showWorkflow: initialShowWorkflow ?? false,
      onSuccessJobId: initialOnSuccessJobId || null,
    },
  });

  const {
    fields: workflowInputFields,
    append: appendWorkflowInput,
    remove: removeWorkflowInput,
    update: updateWorkflowInput,
  } = useFieldArray({
    control: triggerForm.control,
    name: "workflowInputs",
  });

  // Watch form values for UI
  const methods = triggerForm.watch("methods");
  const scheduleConfig = triggerForm.watch("scheduleConfig");
  const _scheduleInputMode = triggerForm.watch("scheduleInputMode");
  const intervalValue = triggerForm.watch("intervalValue");
  const intervalUnit = triggerForm.watch("intervalUnit");
  const selectedPreset = triggerForm.watch("selectedPreset");
  const creatorMarkup = triggerForm.watch("creatorMarkup");
  const settingsPublished = triggerForm.watch("published");
  const settingsShowWorkflow = triggerForm.watch("showWorkflow");

  // Calculate cost preview for schedule
  const scheduleCostEstimate = estimatedDailyCost(
    intervalValue,
    intervalUnit,
    jobPrice,
  );
  const scheduleHasWarning = hasScheduleWarning(
    intervalValue,
    intervalUnit,
    jobPrice,
  );

  const [isSavingTrigger, setIsSavingTrigger] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Output state
  const [outputDestinations, setOutputDestinations] = useState<
    OutputDestination[]
  >(DEFAULT_OUTPUT_CONFIG.destinations);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramImageField, setTelegramImageField] = useState("");
  const [telegramCaptionField, setTelegramCaptionField] = useState("");
  const [xImageField, setXImageField] = useState("");
  const [xCaptionField, setXCaptionField] = useState("");
  const [isSavingOutput, setIsSavingOutput] = useState(false);

  // Webhook response state - default based on whether there are resources
  const [webhookResponseMode, setWebhookResponseMode] =
    useState<WebhookResponseMode>(
      initialWebhookResponse?.mode || "passthrough",
    );
  const [webhookTemplate, setWebhookTemplate] = useState(
    initialWebhookResponse?.template || DEFAULT_WEBHOOK_TEMPLATE,
  );
  // Track if webhook response has been modified
  const [webhookResponseDirty, setWebhookResponseDirty] = useState(false);
  const [webhookSuccessMessage, setWebhookSuccessMessage] = useState(
    initialWebhookResponse?.successMessage || "Payment successful",
  );

  // Settings state (published is in triggerForm)
  const [settingsName, setSettingsName] = useState(jobName);
  const [settingsDescription, setSettingsDescription] = useState(
    job?.description || "",
  );
  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState(
    job?.avatar_url || "",
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch runs for this job
  const { data: runsData, isLoading: runsLoading } = useSWR<{ runs: Run[] }>(
    isOpen && jobId ? `/runs?jobId=${jobId}` : null,
    authenticatedFetcher,
    { refreshInterval: 5000 },
  );

  // Fetch integration status
  const { data: telegramData } = useSWR<{
    hasBotToken: boolean;
    defaultChatId: string | null;
    isEnabled: boolean;
  }>(isOpen ? "/integrations/telegram/config" : null, authenticatedFetcher);

  const { data: xStatus } = useSWR<{
    connected: boolean;
    profile: { username?: string; display_name?: string };
  }>(isOpen ? "/integrations/x/status" : null, authenticatedFetcher);

  // Fetch jobs for automation chaining
  const { data: userJobsData } = useSWR<{
    jobs: Array<{ id: string; name: string; price?: number }>;
  }>(
    isOpen && activeTab === "trigger" ? "/user/me/jobs" : null,
    authenticatedFetcher,
  );

  const { data: publicJobsData } = useSWR<{
    jobs: Array<{
      id: string;
      name: string;
      owner_username?: string;
      price?: number;
    }>;
  }>(
    isOpen && activeTab === "trigger" ? "/jobs/public?limit=50" : null,
    authenticatedFetcher,
  );

  // Build list of chainable jobs
  const chainableJobs = [
    ...(userJobsData?.jobs || [])
      .filter((j) => j.id !== jobId)
      .map((j) => ({ ...j, isOwn: true })),
    ...(publicJobsData?.jobs || [])
      .filter(
        (j) =>
          j.id !== jobId && !userJobsData?.jobs?.some((uj) => uj.id === j.id),
      )
      .map((j) => ({ ...j, isOwn: false })),
  ];

  const runs = runsData?.runs || [];
  const hasTelegram = telegramData?.hasBotToken;
  const hasX = xStatus?.connected;

  // Count resources and output nodes from workflow
  const resourceNodes =
    (nodes as Array<{ type: string }>)?.filter((n) => n.type === "resource") ||
    [];
  const outputNodes =
    (nodes as Array<{ id: string; type: string }>)?.filter(
      (n) => n.type === "output",
    ) || [];
  const hasResources = resourceNodes.length > 0;

  // Track if panel was previously open to avoid resetting state after save
  const wasOpenRef = useRef(false);

  // Sync state when panel opens (not on every prop change)
  useEffect(() => {
    // Only sync when panel transitions from closed to open
    if (isOpen && !wasOpenRef.current) {
      // Reset trigger form
      const newScheduleConfig = initialScheduleConfig || {
        cron: "0 9 * * *",
        timezone: "UTC",
        enabled: true,
      };

      // Determine schedule input mode from cron
      const matchingPreset = SCHEDULE_PRESETS.find(
        (p) => p.cron === newScheduleConfig.cron,
      );
      const parsedInterval = cronToInterval(newScheduleConfig.cron);
      let scheduleInputMode: ScheduleInputMode = "interval";
      let intervalValue = 1;
      let intervalUnit: IntervalUnit = "hours";
      let selectedPreset = "";

      if (matchingPreset) {
        scheduleInputMode = "preset";
        selectedPreset = matchingPreset.id;
        if (matchingPreset.interval) {
          intervalValue = matchingPreset.interval.value;
          intervalUnit = matchingPreset.interval.unit;
        }
      } else if (parsedInterval) {
        scheduleInputMode = "interval";
        intervalValue = parsedInterval.value;
        intervalUnit = parsedInterval.unit;
      } else {
        scheduleInputMode = "cron";
      }

      triggerForm.reset({
        methods: initialTriggerMethods,
        scheduleConfig: newScheduleConfig,
        scheduleInputMode,
        intervalValue,
        intervalUnit,
        selectedPreset,
        workflowInputs: initialWorkflowInputs,
        creatorMarkup: initialCreatorMarkup,
        published: initialPublished ?? true,
        showWorkflow: initialShowWorkflow ?? false,
        onSuccessJobId: initialOnSuccessJobId || null,
      });

      // Reset settings state
      setSettingsName(jobName);
      setSettingsDescription(job?.description || "");
      setSettingsAvatarUrl(job?.avatar_url || "");

      // Reset webhook response state from props
      setWebhookResponseMode(initialWebhookResponse?.mode || "passthrough");
      setWebhookTemplate(
        initialWebhookResponse?.template || DEFAULT_WEBHOOK_TEMPLATE,
      );
      setWebhookSuccessMessage(
        initialWebhookResponse?.successMessage || "Payment successful",
      );
      setWebhookResponseDirty(false);

      // Load first output node config
      if (outputNodes.length > 0) {
        const config = getOutputConfig(outputNodes[0].id);
        if (config.destinations.length > 0) {
          setOutputDestinations(config.destinations);
          const telegramDest = config.destinations.find(
            (d) => d.type === "telegram",
          );
          setTelegramChatId(telegramDest?.config?.chatId || "");
          setTelegramImageField(telegramDest?.config?.imageField || "");
          setTelegramCaptionField(telegramDest?.config?.captionField || "");

          const xDest = config.destinations.find((d) => d.type === "x");
          setXImageField(xDest?.config?.imageField || "");
          setXCaptionField(xDest?.config?.captionField || "");
        }
      }
    }
    wasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Webhook URL
  const apiUrl =
    process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";
  const webhookUrl = jobId
    ? username && jobSlug
      ? `${apiUrl}/@${username}/${jobSlug}`
      : `${apiUrl}/webhooks/${jobId}`
    : null;

  // Trigger handlers
  const toggleMethod = (method: keyof TriggerMethods) => {
    const currentMethods = triggerForm.getValues("methods");
    triggerForm.setValue(
      "methods",
      { ...currentMethods, [method]: !currentMethods[method] },
      { shouldDirty: true },
    );
  };

  const addWorkflowInput = () => {
    appendWorkflowInput({
      name: "",
      type: "string",
      required: false,
      description: "",
    });
  };

  const handleUpdateWorkflowInput = (
    index: number,
    updates: Partial<WorkflowInput>,
  ) => {
    const current = workflowInputFields[index];
    updateWorkflowInput(index, { ...current, ...updates });
  };

  const handleSaveTrigger = async () => {
    setIsSavingTrigger(true);
    try {
      const formData = triggerForm.getValues();
      // If schedule trigger is off, schedule_enabled must be false
      const effectiveScheduleConfig = {
        cron: formData.scheduleConfig.cron,
        timezone: formData.scheduleConfig.timezone,
        enabled: formData.methods.schedule
          ? formData.scheduleConfig.enabled
          : false,
      };

      // Build webhook response config
      const webhookResponseConfig: WebhookResponseConfig | undefined = formData
        .methods.webhook
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

      await onTriggerSave({
        triggerType: formData.methods.schedule
          ? "schedule"
          : formData.methods.webhook
            ? "webhook"
            : "manual",
        triggerMethods: formData.methods,
        scheduleConfig: effectiveScheduleConfig,
        workflowInputs: formData.workflowInputs.filter((i) => i.name.trim()),
        creatorMarkup: formData.creatorMarkup,
        published: formData.published,
        onSuccessJobId: formData.onSuccessJobId,
        webhookResponse: webhookResponseConfig,
      });

      // Reset form dirty state after successful save
      triggerForm.reset(formData);
      setWebhookResponseDirty(false);

      toast({
        title: "Trigger settings saved",
        variant: "success",
      });
    } finally {
      setIsSavingTrigger(false);
    }
  };

  // Output handlers
  const toggleDestination = (type: OutputDestination["type"]) => {
    setOutputDestinations((prev) =>
      prev.map((dest) =>
        dest.type === type ? { ...dest, enabled: !dest.enabled } : dest,
      ),
    );
  };

  const isDestinationEnabled = (type: OutputDestination["type"]) =>
    outputDestinations.find((d) => d.type === type)?.enabled ?? false;

  const handleSaveOutput = async () => {
    if (outputNodes.length === 0) return;

    setIsSavingOutput(true);
    try {
      const updatedDestinations = outputDestinations.map((dest) => {
        if (dest.type === "telegram") {
          return {
            ...dest,
            config: {
              ...(telegramChatId && { chatId: telegramChatId }),
              ...(telegramImageField && { imageField: telegramImageField }),
              ...(telegramCaptionField && {
                captionField: telegramCaptionField,
              }),
            },
          };
        }
        if (dest.type === "x") {
          return {
            ...dest,
            config: {
              ...(xImageField && { imageField: xImageField }),
              ...(xCaptionField && { captionField: xCaptionField }),
            },
          };
        }
        return dest;
      });

      // Build webhook response config
      const webhookResponse: WebhookResponseConfig | undefined =
        webhookResponseMode !== "passthrough"
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

      await onOutputSave(outputNodes[0].id, {
        destinations: updatedDestinations,
        ...(webhookResponse && { webhookResponse }),
      });
      toast({
        title: "Output settings saved",
        variant: "success",
      });
    } finally {
      setIsSavingOutput(false);
    }
  };

  const copyWebhookUrl = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Trigger is valid if: no triggers enabled (job is "off"), OR if schedule is enabled it has valid cron
  const isScheduleConfigValid =
    !methods.schedule || (scheduleConfig.cron && scheduleConfig.timezone);
  const isTriggerValid = isScheduleConfigValid; // Allow all triggers to be disabled
  const isOutputValid = outputDestinations.some((d) => d.enabled);

  // Dirty state from react-hook-form + webhook response state
  const { isDirty: isFormDirty } = triggerForm.formState;
  const isTriggerDirty = isFormDirty || webhookResponseDirty;

  // Settings handlers
  const handleSaveSettings = async () => {
    if (!onSettingsSave) return;
    setIsSavingSettings(true);
    try {
      await onSettingsSave({
        name: settingsName.trim() || "Untitled Job",
        description: settingsDescription.trim() || undefined,
        avatarUrl: settingsAvatarUrl || undefined,
        published: settingsPublished,
        showWorkflow: settingsShowWorkflow,
      });
      toast({
        title: "Job settings saved",
        variant: "success",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "trigger", label: "Trigger" },
    { id: "output", label: "Output" },
    { id: "runs", label: "Runs", count: runs.length },
    { id: "resources", label: "Resources", count: resourceNodes.length },
    { id: "settings", label: "Settings" },
  ];

  if (!jobId) return null;

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-start gap-4 py-1">
          <DrawerHeaderAvatar
            src={job?.avatar_url}
            fallbackIcon={<Zap className="h-8 w-8 text-primary" />}
            fallbackClassName="bg-primary/10"
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground text-lg truncate">
              {jobName || "Untitled Job"}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <ChainIcon network={network} className="h-3 w-3" />
              <span>
                {network === "base" ? "Base" : "Solana"} • #{displayId || "—"}
              </span>
            </div>
          </div>
        </div>
      }
      headerRight={
        onRun && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </Button>
        )
      }
      fullBleed
      hasStackedChild={hasStackedChild}
      isHidden={isHidden}
      onBringToFront={onBringToFront}
      footer={
        activeTab === "settings" && onSettingsSave ? (
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              disabled={!settingsName.trim()}
              loading={isSavingSettings}
            >
              Save Settings
            </Button>
          </div>
        ) : activeTab === "trigger" ? (
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSaveTrigger}
              disabled={isSavingTrigger || !isTriggerValid || !isTriggerDirty}
              loading={isSavingTrigger}
              className="min-w-[210px]"
            >
              Save Trigger Settings
            </Button>
          </div>
        ) : activeTab === "output" ? (
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSaveOutput}
              disabled={
                isSavingOutput || !isOutputValid || outputNodes.length === 0
              }
              loading={isSavingOutput}
            >
              Save Output Settings
            </Button>
          </div>
        ) : undefined
      }
      subheader={
        <PanelTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as JobPanelTab)}
        />
      }
    >
      {/* Tab content */}
      <div className="flex-1">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-4 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{resourceNodes.length}</div>
                <div className="text-xs text-muted-foreground">Resources</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{runs.length}</div>
                <div className="text-xs text-muted-foreground">Runs</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">${jobPrice.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Cost/Run</div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="text-xs">Job ID</span>
                  </div>
                  <div className="text-sm font-mono truncate" title={jobId}>
                    {displayId ? `#${displayId}` : jobId.slice(0, 8)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="text-xs">Network</span>
                  </div>
                  <div className="text-sm flex items-center gap-1.5">
                    <ChainIcon network={network} className="h-4 w-4" />
                    {network === "base" ? "Base" : "Solana"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-xs">Trigger</span>
                  </div>
                  <div className="text-sm">
                    {methods.webhook ? "Webhook" : "Manual"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs">Created</span>
                  </div>
                  <div className="text-sm">
                    {job?.created_at
                      ? format(new Date(job.created_at), "MMM d, yyyy")
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Webhook URL (if enabled) */}
            {methods.webhook && webhookUrl && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Webhook Endpoint
                </h3>
                <button
                  onClick={copyWebhookUrl}
                  className="w-full p-3 bg-muted/50 rounded-lg border text-left hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono truncate">
                      {webhookUrl}
                    </code>
                    {copiedWebhook ? (
                      <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                    )}
                  </div>
                </button>
              </div>
            )}

            {/* Recent Runs */}
            {runs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recent Runs
                  </h3>
                  <button
                    onClick={() => setActiveTab("runs")}
                    className="text-xs text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-2">
                  {runs.slice(0, 3).map((run) => (
                    <button
                      key={run.id}
                      onClick={() => onSelectRun?.(run)}
                      className="w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(run.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(run.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trigger Tab */}
        {activeTab === "trigger" && (
          <div className="p-4 space-y-4">
            {/* TRIGGERS Section */}
            <CollapsibleSection
              title="Triggers"
              defaultExpanded={true}
              preview={
                [
                  methods.manual && "Manual",
                  methods.webhook && "Webhook",
                  methods.schedule && "Scheduled",
                ]
                  .filter(Boolean)
                  .join(", ") || "None enabled"
              }
              icon={<Zap className="h-4 w-4 text-muted-foreground" />}
            >
              <p className="text-sm text-muted-foreground mb-4">
                Choose how this job can be triggered (disable all to turn off)
              </p>

              {/* Manual Trigger */}
              <TriggerOption
                enabled={methods.manual}
                onToggle={() => toggleMethod("manual")}
                label="Manual"
                description='Click the "Run" button to run the job yourself'
                icon={<Play className="h-4 w-4 text-trigger" />}
              />

              {/* Webhook (x402) Trigger */}
              <TriggerOption
                enabled={methods.webhook}
                onToggle={() => toggleMethod("webhook")}
                label="Webhook (x402)"
                description="External systems can call this job and pay per use"
                icon={<Globe className="h-4 w-4 text-blue-500" />}
              >
                {/* Endpoint URL */}
                {webhookUrl && (
                  <div className="space-y-2">
                    <Label className="text-xs">Endpoint</Label>
                    <button
                      onClick={copyWebhookUrl}
                      className="w-full p-2.5 bg-muted/50 rounded-lg border text-left hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono truncate flex-1">
                          {webhookUrl}
                        </code>
                        {copiedWebhook ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-2.5">
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
                          triggerForm.setValue(
                            "creatorMarkup",
                            parseFloat(e.target.value) || 0,
                            { shouldDirty: true },
                          )
                        }
                        placeholder="0.00"
                        className="w-20 h-7 text-sm text-right font-mono"
                      />
                    </div>
                  </div>
                  <div className="border-t border-border my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total per run</span>
                    <span className="text-lg font-bold text-green-500">
                      ${(jobPrice + creatorMarkup).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Visibility Options */}
                <div className="space-y-3 pt-2">
                  {/* Publish to Marketplace */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsPublished}
                      onChange={() =>
                        triggerForm.setValue("published", !settingsPublished, {
                          shouldDirty: true,
                        })
                      }
                      className="mt-0.5 rounded border-border"
                    />
                    <div>
                      <div className="text-sm font-medium">
                        Publish to Marketplace
                      </div>
                      <div className="text-xs text-muted-foreground">
                        List in public marketplace at x402.jobs
                      </div>
                    </div>
                  </label>

                  {/* Show Workflow */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsShowWorkflow}
                      onChange={() =>
                        triggerForm.setValue(
                          "showWorkflow",
                          !settingsShowWorkflow,
                          { shouldDirty: true },
                        )
                      }
                      className="mt-0.5 rounded border-border"
                    />
                    <div>
                      <div className="text-sm font-medium">
                        Show workflow publicly
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Let visitors see the resources used
                      </div>
                    </div>
                  </label>
                </div>

                {/* Response Section */}
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Response
                    </div>
                    <p className="text-xs text-muted-foreground">
                      What callers receive when the job completes
                    </p>
                  </div>

                  {/* Pass-through - only if there are resources */}
                  {hasResources && (
                    <button
                      onClick={() => {
                        setWebhookResponseMode("passthrough");
                        setWebhookResponseDirty(true);
                      }}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                        webhookResponseMode === "passthrough"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          webhookResponseMode === "passthrough"
                            ? "border-primary"
                            : "border-muted-foreground/50"
                        }`}
                      >
                        {webhookResponseMode === "passthrough" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
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
                    onClick={() => {
                      setWebhookResponseMode("confirmation");
                      setWebhookResponseDirty(true);
                    }}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                      webhookResponseMode === "confirmation"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        webhookResponseMode === "confirmation"
                          ? "border-primary"
                          : "border-muted-foreground/50"
                      }`}
                    >
                      {webhookResponseMode === "confirmation" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Confirmation</div>
                      <div className="text-xs text-muted-foreground">
                        Return simple payment confirmation with status
                      </div>
                    </div>
                  </button>

                  {/* Confirmation Settings */}
                  {webhookResponseMode === "confirmation" && (
                    <div className="ml-8 pl-4 border-l-2 border-primary/20 space-y-2 py-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Success Message</Label>
                        <Input
                          placeholder="Payment successful"
                          value={webhookSuccessMessage}
                          onChange={(e) => {
                            setWebhookSuccessMessage(e.target.value);
                            setWebhookResponseDirty(true);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Template */}
                  <button
                    onClick={() => {
                      setWebhookResponseMode("template");
                      setWebhookResponseDirty(true);
                    }}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                      webhookResponseMode === "template"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        webhookResponseMode === "template"
                          ? "border-primary"
                          : "border-muted-foreground/50"
                      }`}
                    >
                      {webhookResponseMode === "template" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
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
                    <div className="ml-8 pl-4 border-l-2 border-primary/20 space-y-3 py-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Response Template (JSON)
                        </Label>
                        <Textarea
                          value={webhookTemplate}
                          onChange={(e) => {
                            setWebhookTemplate(e.target.value);
                            setWebhookResponseDirty(true);
                          }}
                          className="font-mono text-xs min-h-[120px]"
                          placeholder={DEFAULT_WEBHOOK_TEMPLATE}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">
                          Available Variables:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "{{payment.amount}}",
                            "{{payment.signature}}",
                            "{{payment.payer}}",
                            "{{payment.timestamp}}",
                            "{{inputs.*}}",
                          ].map((variable) => (
                            <code
                              key={variable}
                              className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"
                            >
                              {variable}
                            </code>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TriggerOption>

              {/* Scheduled Trigger */}
              <TriggerOption
                enabled={methods.schedule ?? false}
                onToggle={() => toggleMethod("schedule")}
                label="Scheduled"
                description="Run automatically on a recurring schedule"
                icon={<Clock className="h-4 w-4 text-orange-500" />}
              >
                {/* Interval Input Section */}
                <div className="space-y-2">
                  <Label className="text-xs">Run every</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(intervalValue)}
                      onChange={(value) => {
                        const numValue = parseInt(value, 10);
                        triggerForm.setValue("intervalValue", numValue, {
                          shouldDirty: true,
                        });
                        triggerForm.setValue("scheduleInputMode", "interval", {
                          shouldDirty: true,
                        });
                        triggerForm.setValue("selectedPreset", "", {
                          shouldDirty: true,
                        });
                        const newCron = intervalToCron(numValue, intervalUnit);
                        triggerForm.setValue("scheduleConfig.cron", newCron, {
                          shouldDirty: true,
                        });
                      }}
                      options={INTERVAL_VALUES[intervalUnit].map((v) => ({
                        value: String(v),
                        label: String(v),
                      }))}
                      className="w-20"
                    />
                    <Select
                      value={intervalUnit}
                      onChange={(value) => {
                        const newUnit = value as IntervalUnit;
                        const availableValues = INTERVAL_VALUES[newUnit];
                        let newValue = intervalValue;
                        if (!availableValues.includes(intervalValue)) {
                          newValue = availableValues[0] || 1;
                          triggerForm.setValue("intervalValue", newValue, {
                            shouldDirty: true,
                          });
                        }
                        triggerForm.setValue("intervalUnit", newUnit, {
                          shouldDirty: true,
                        });
                        triggerForm.setValue("scheduleInputMode", "interval", {
                          shouldDirty: true,
                        });
                        triggerForm.setValue("selectedPreset", "", {
                          shouldDirty: true,
                        });
                        const newCron = intervalToCron(newValue, newUnit);
                        triggerForm.setValue("scheduleConfig.cron", newCron, {
                          shouldDirty: true,
                        });
                      }}
                      options={[
                        { value: "minutes", label: "minutes" },
                        { value: "hours", label: "hours" },
                        { value: "days", label: "days" },
                      ]}
                      className="w-28"
                    />
                  </div>
                  {/* Inline cost preview */}
                  <p
                    className={`text-xs ${
                      scheduleHasWarning
                        ? "text-orange-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {scheduleCostEstimate.runs >= 1
                      ? `${scheduleCostEstimate.runs.toLocaleString()} runs/day`
                      : `${(scheduleCostEstimate.runs * 7).toFixed(1)} runs/week`}{" "}
                    · ~$
                    {scheduleCostEstimate.runs >= 1
                      ? scheduleCostEstimate.cost.toFixed(2)
                      : (scheduleCostEstimate.cost * 7).toFixed(2)}
                    {scheduleCostEstimate.runs >= 1 ? "/day" : "/week"}
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Quick presets</Label>
                  <div className="flex gap-1.5">
                    {SCHEDULE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          triggerForm.setValue("selectedPreset", preset.id, {
                            shouldDirty: true,
                          });
                          triggerForm.setValue("scheduleInputMode", "preset", {
                            shouldDirty: true,
                          });
                          triggerForm.setValue(
                            "scheduleConfig.cron",
                            preset.cron,
                            { shouldDirty: true },
                          );
                          if (preset.interval) {
                            triggerForm.setValue(
                              "intervalValue",
                              preset.interval.value,
                              { shouldDirty: true },
                            );
                            triggerForm.setValue(
                              "intervalUnit",
                              preset.interval.unit,
                              { shouldDirty: true },
                            );
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
                <details className="group pt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Custom cron expression
                  </summary>
                  <div className="mt-2 space-y-2 pl-4">
                    <Input
                      value={scheduleConfig.cron}
                      onChange={(e) => {
                        triggerForm.setValue(
                          "scheduleConfig.cron",
                          e.target.value,
                          { shouldDirty: true },
                        );
                        triggerForm.setValue("scheduleInputMode", "cron", {
                          shouldDirty: true,
                        });
                        triggerForm.setValue("selectedPreset", "", {
                          shouldDirty: true,
                        });
                        const parsed = cronToInterval(e.target.value);
                        if (parsed) {
                          triggerForm.setValue("intervalValue", parsed.value, {
                            shouldDirty: true,
                          });
                          triggerForm.setValue("intervalUnit", parsed.unit, {
                            shouldDirty: true,
                          });
                        }
                      }}
                      placeholder="0 9 * * *"
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                </details>

                {/* Timezone */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Timezone</Label>
                  <Select
                    value={scheduleConfig.timezone}
                    onChange={(value) =>
                      triggerForm.setValue("scheduleConfig.timezone", value, {
                        shouldDirty: true,
                      })
                    }
                    options={TIMEZONES.map((tz) => ({
                      value: tz.value,
                      label: tz.label,
                    }))}
                  />
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mt-2">
                  <div>
                    <p className="text-sm font-medium">Schedule Active</p>
                    <p className="text-xs text-muted-foreground">
                      {scheduleConfig.enabled
                        ? "Will run on schedule"
                        : "Paused"}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      triggerForm.setValue(
                        "scheduleConfig.enabled",
                        !scheduleConfig.enabled,
                        { shouldDirty: true },
                      )
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      scheduleConfig.enabled ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        scheduleConfig.enabled
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {!isScheduleConfigValid && (
                  <p className="text-xs text-destructive">
                    Schedule requires a valid cron expression and timezone
                  </p>
                )}
              </TriggerOption>
            </CollapsibleSection>

            {/* PARAMETERS Section */}
            <CollapsibleSection
              title="Parameters"
              defaultExpanded={workflowInputFields.length > 0}
              preview={
                workflowInputFields.length === 0
                  ? "No parameters defined"
                  : `${workflowInputFields.length} parameter${workflowInputFields.length === 1 ? "" : "s"} defined`
              }
              icon={<Settings2 className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  Define parameters that can be passed to this job
                </p>
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

              {workflowInputFields.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                  <p>No parameters defined</p>
                  <p className="text-xs mt-1">
                    Add parameters that resources can reference
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workflowInputFields.map((field, index) => (
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
                            value={field.name}
                            onChange={(e) =>
                              handleUpdateWorkflowInput(index, {
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
                            value={field.type}
                            onChange={(value) =>
                              handleUpdateWorkflowInput(index, {
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

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`required-${index}`}
                          checked={field.required}
                          onChange={(e) =>
                            handleUpdateWorkflowInput(index, {
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addWorkflowInput}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Parameter
                  </Button>
                </div>
              )}
            </CollapsibleSection>

            {/* AUTOMATION Section */}
            <CollapsibleSection
              title="Automation"
              defaultExpanded={false}
              preview={
                triggerForm.watch("onSuccessJobId") === jobId
                  ? "Loop"
                  : triggerForm.watch("onSuccessJobId")
                    ? "Chain to another job"
                    : "Stop (run once)"
              }
              icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
            >
              <p className="text-sm text-muted-foreground mb-3">
                Configure what happens after this job completes successfully
              </p>

              <div className="space-y-2">
                {/* Stop option */}
                <button
                  onClick={() =>
                    triggerForm.setValue("onSuccessJobId", null, {
                      shouldDirty: true,
                    })
                  }
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                    !triggerForm.watch("onSuccessJobId")
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      !triggerForm.watch("onSuccessJobId")
                        ? "border-primary"
                        : "border-muted-foreground/50"
                    }`}
                  >
                    {!triggerForm.watch("onSuccessJobId") && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Stop (run once)</div>
                    <div className="text-xs text-muted-foreground">
                      Job ends after completion — the default behavior
                    </div>
                  </div>
                </button>

                {/* Loop option */}
                <button
                  onClick={() =>
                    jobId &&
                    triggerForm.setValue("onSuccessJobId", jobId, {
                      shouldDirty: true,
                    })
                  }
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                    triggerForm.watch("onSuccessJobId") === jobId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      triggerForm.watch("onSuccessJobId") === jobId
                        ? "border-primary"
                        : "border-muted-foreground/50"
                    }`}
                  >
                    {triggerForm.watch("onSuccessJobId") === jobId && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Loop</span>
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Run this job again on success, continuously
                    </div>
                    {triggerForm.watch("onSuccessJobId") === jobId && (
                      <div className="flex items-start gap-1.5 mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-600 dark:text-amber-400 text-xs">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>
                          Will run until it fails or you run out of funds
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Chain option */}
                <button
                  onClick={() => {
                    const firstOther = chainableJobs[0];
                    if (firstOther) {
                      triggerForm.setValue("onSuccessJobId", firstOther.id, {
                        shouldDirty: true,
                      });
                    }
                  }}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                    triggerForm.watch("onSuccessJobId") &&
                    triggerForm.watch("onSuccessJobId") !== jobId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      triggerForm.watch("onSuccessJobId") &&
                      triggerForm.watch("onSuccessJobId") !== jobId
                        ? "border-primary"
                        : "border-muted-foreground/50"
                    }`}
                  >
                    {triggerForm.watch("onSuccessJobId") &&
                      triggerForm.watch("onSuccessJobId") !== jobId && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Run another job
                      </span>
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Chain to a different job on success
                    </div>
                  </div>
                </button>

                {/* Job selector - shown when chain is selected */}
                {triggerForm.watch("onSuccessJobId") &&
                  triggerForm.watch("onSuccessJobId") !== jobId && (
                    <div className="ml-8 pl-4 border-l-2 border-primary/20 py-2">
                      <Label className="text-xs mb-2 block">Next job</Label>
                      <Select
                        value={triggerForm.watch("onSuccessJobId") || ""}
                        onChange={(value) =>
                          triggerForm.setValue(
                            "onSuccessJobId",
                            value || null,
                            {
                              shouldDirty: true,
                            },
                          )
                        }
                        options={[
                          ...(userJobsData?.jobs || [])
                            .filter((j) => j.id !== jobId)
                            .map((j) => ({
                              value: j.id,
                              label: j.name,
                            })),
                          ...(publicJobsData?.jobs || [])
                            .filter(
                              (j) =>
                                j.id !== jobId &&
                                !userJobsData?.jobs?.some(
                                  (uj) => uj.id === j.id,
                                ),
                            )
                            .map((j) => ({
                              value: j.id,
                              label: `${j.name} (@${j.owner_username})`,
                            })),
                        ]}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Output from this job will be passed as input to the next
                        job
                      </p>
                    </div>
                  )}
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Output Tab */}
        {activeTab === "output" && (
          <div className="p-4 space-y-6">
            <p className="text-sm text-muted-foreground">
              Choose where to send job outputs. You can enable multiple
              destinations.
            </p>

            <div className="space-y-2">
              {/* In-App */}
              <button
                onClick={() => toggleDestination("app")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                  isDestinationEnabled("app")
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {isDestinationEnabled("app") ? (
                  <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Monitor className="h-4 w-4 text-output" />
                    <span className="font-medium">In-App</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Display output in the canvas (always recommended)
                  </p>
                </div>
              </button>

              {/* Telegram */}
              <button
                onClick={() => hasTelegram && toggleDestination("telegram")}
                disabled={!hasTelegram}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                  !hasTelegram
                    ? "border-border/50 opacity-60 cursor-not-allowed"
                    : isDestinationEnabled("telegram")
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                }`}
              >
                {isDestinationEnabled("telegram") && hasTelegram ? (
                  <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Send className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Telegram</span>
                    {!hasTelegram && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        Not configured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hasTelegram
                      ? `Send to Telegram (default: ${telegramData?.defaultChatId || "not set"})`
                      : "Configure in Dashboard → Integrations"}
                  </p>
                </div>
              </button>

              {/* Telegram Settings */}
              {isDestinationEnabled("telegram") && hasTelegram && (
                <div className="ml-8 pl-4 border-l-2 border-primary/20 space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Image Field</Label>
                      <Input
                        placeholder="imageUrl"
                        value={telegramImageField}
                        onChange={(e) => setTelegramImageField(e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Caption Field</Label>
                      <Input
                        placeholder="captions"
                        value={telegramCaptionField}
                        onChange={(e) =>
                          setTelegramCaptionField(e.target.value)
                        }
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Chat ID (optional)</Label>
                    <Input
                      placeholder={
                        telegramData?.defaultChatId || "@channel or -123456"
                      }
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* X */}
              <button
                onClick={() => hasX && toggleDestination("x")}
                disabled={!hasX}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                  !hasX
                    ? "border-border/50 opacity-60 cursor-not-allowed"
                    : isDestinationEnabled("x")
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                }`}
              >
                {isDestinationEnabled("x") && hasX ? (
                  <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <XIcon className="h-4 w-4" />
                    <span className="font-medium">X (Twitter)</span>
                    {!hasX && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hasX
                      ? `Post as @${xStatus?.profile?.username || "connected"}`
                      : "Connect in Dashboard → Integrations"}
                  </p>
                </div>
              </button>

              {/* X Settings */}
              {isDestinationEnabled("x") && hasX && (
                <div className="ml-8 pl-4 border-l-2 border-primary/20 space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Image Field</Label>
                      <Input
                        placeholder="imageUrl"
                        value={xImageField}
                        onChange={(e) => setXImageField(e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Tweet Text Field</Label>
                      <Input
                        placeholder="text"
                        value={xCaptionField}
                        onChange={(e) => setXCaptionField(e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Map output fields to tweet. Common: imageUrl, artifactUrl,
                    text, caption, result
                  </p>
                </div>
              )}
            </div>

            {!isOutputValid && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>At least one output destination must be enabled</span>
              </div>
            )}
          </div>
        )}

        {/* Runs Tab */}
        {activeTab === "runs" && (
          <div className="p-4">
            {runsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Play className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No runs yet</p>
                <p className="text-xs mt-1">Run the job to see history here</p>
                {onRun && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRun}
                    className="mt-4 gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun?.(run)}
                    className="w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        <div>
                          <div className="text-sm font-medium">
                            {formatDistanceToNow(new Date(run.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(run.created_at), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {run.total_cost != null && run.total_cost > 0 && (
                          <span className="text-sm font-mono text-muted-foreground">
                            {formatCost(run.total_cost)}
                          </span>
                        )}
                        {getStatusBadge(run.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {run.error && (
                      <p className="text-xs text-destructive mt-2 truncate">
                        {run.error}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === "resources" && (
          <div className="p-4">
            {resourceNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Box className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No resources in this job</p>
                <p className="text-xs mt-1">Add resources from the canvas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resourceNodes.map((node) => {
                  const nodeData = node as unknown as {
                    id: string;
                    data?: {
                      resource?: {
                        id: string;
                        name: string;
                        slug?: string;
                        serverSlug?: string;
                        price?: number;
                        resourceUrl?: string;
                        avatarUrl?: string;
                      };
                    };
                  };
                  const resource = nodeData.data?.resource;
                  const displayName = getResourceDisplayName(resource);
                  return (
                    <button
                      key={nodeData.id}
                      onClick={() => onConfigureResource?.(nodeData.id)}
                      className="w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-3">
                        {resource?.avatarUrl ? (
                          <img
                            src={resource.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-resource/20 flex items-center justify-center">
                            <Box className="h-4 w-4 text-resource" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {displayName}
                          </div>
                          {resource?.resourceUrl && (
                            <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {resource.resourceUrl}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {resource?.price != null && (
                          <span className="text-sm font-mono text-muted-foreground">
                            ${resource.price.toFixed(2)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="p-4 space-y-6">
            {/* Job Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Job Info</h3>

              <div className="space-y-2">
                <Label htmlFor="job-name">Name</Label>
                <Input
                  id="job-name"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  placeholder="My Job"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-description">Description</Label>
                <textarea
                  id="job-description"
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  placeholder="Optional description of this job"
                  className="w-full h-24 px-3 py-2 text-sm bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              <div className="space-y-2">
                <Label>Avatar Image</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Optional image to represent your job
                </p>
                <ImageUrlOrUpload
                  value={settingsAvatarUrl}
                  onChange={setSettingsAvatarUrl}
                  placeholder="Enter image URL or upload..."
                />
              </div>
            </div>

            {/* Job Details (read-only) */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Job ID</span>
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {displayId ? `#${displayId}` : jobId}
                  </code>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Network</span>
                  <span className="flex items-center gap-1.5">
                    <ChainIcon network={network} className="h-4 w-4" />
                    {network === "base" ? "Base" : "Solana"}
                  </span>
                </div>
                {username && jobSlug && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Slug</span>
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      @{username}/{jobSlug}
                    </code>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Created</span>
                  <span>
                    {job?.created_at
                      ? format(new Date(job.created_at), "MMM d, yyyy")
                      : "—"}
                  </span>
                </div>
                {job?.updated_at && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Updated</span>
                    <span>
                      {format(new Date(job.updated_at), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            {onDelete && (
              <div className="space-y-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <h3 className="text-sm font-medium text-destructive">
                  Danger Zone
                </h3>
                <p className="text-xs text-muted-foreground">
                  Deleting a job is permanent and cannot be undone. All runs and
                  history will be lost.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={isDeleting}
                  loading={isDeleting}
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this job? This action cannot be undone.",
                      )
                    ) {
                      setIsDeleting(true);
                      try {
                        await onDelete();
                      } catch (err) {
                        toast({
                          title: "Failed to delete job",
                          description:
                            err instanceof Error
                              ? err.message
                              : "Unknown error",
                          variant: "destructive",
                        });
                      } finally {
                        setIsDeleting(false);
                      }
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Job
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
