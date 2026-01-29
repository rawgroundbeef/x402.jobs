"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useModals } from "@/contexts/ModalContext";
import { useNodesState, useEdgesState, Node, Edge } from "@xyflow/react";
import { useRunTracking } from "./lib/useRunTracking";
import { buildWorkflowSteps } from "./lib/workflowBuilder";
import { useJobPrice } from "./lib/useJobPrice";
import { useNodeConfiguration } from "./lib/useNodeConfiguration";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Dropdown, DropdownItem } from "@x402jobs/ui/dropdown";
import {
  WorkflowCanvas,
  type WorkflowCanvasRef,
  type WorkflowViewport,
  getInitialNodes,
} from "@/components/workflow/WorkflowCanvas";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Logo } from "@/components/Logo";
import { type Resource } from "@/components/modals/ResourcesModal";
import { ResourceInteractionModal } from "@/components/modals/ResourceInteractionModal";
import {
  JobPanel,
  RunDetailsPanel,
  ResourcesPanel,
  CreateJobPanel,
  RunWorkflowPanel,
  ResourceConfigPanel,
  ResourceInteractionPanel,
  type JobPanelTab,
  type ResourcesPanelTab,
} from "@/components/panels";
import { JobDropdown } from "@/components/JobDropdown";
import { ActivityDrawer } from "@/components/ActivityDrawer";
import { useSaveJobMutation } from "@/hooks/useSaveJobMutation";
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";
import type { Run } from "@/types/runs";
import type {
  ResourceInputs,
  WorkflowInputValues,
} from "@/components/panels/RunWorkflowPanel";
// OutputViewerPanel replaced by RunDetailsPanel for unified experience
import {
  TransformConfigPanel,
  type TransformConfig,
} from "@/components/panels/TransformConfigPanel";
import { SourcesPanel } from "@/components/panels/SourcesPanel";
import { SourceConfigPanel } from "@/components/panels/SourceConfigPanel";
import { TriggerConfigPanel } from "@/components/panels/TriggerConfigPanel";
import { OutputConfigPanel } from "@/components/panels/OutputConfigPanel";
import type {
  SourceType,
  SourceConfig,
} from "@/components/workflow/nodes/SourceNode";
import { useWorkflowPersistence } from "@/hooks/useWorkflowPersistence";
import { useWallet } from "@/hooks/useWallet";
import { authenticatedFetch } from "@/lib/api";
import {
  Box,
  Save,
  Loader2,
  Check,
  Plus,
  Zap,
  Settings2,
  HelpCircle,
  Copy,
  MessageCircle,
  Menu,
  X,
  LogOut,
  Layers,
  Shuffle,
  Monitor,
  Bell,
  Database,
  Search,
} from "lucide-react";
import { DocsPanel } from "@/components/DocsPanel";
import { MemeputerBadge } from "@/components/MemeputerBadge";
import { PlatformStats } from "@/components/PlatformStats";
import { SaveAsModal } from "@/components/modals/SaveAsModal";
import { JobputerChatButton } from "@/components/JobputerChatButton";
import {
  TriggerConfigModal,
  type TriggerType,
} from "@/components/modals/TriggerConfigModal";
import type { OutputConfig } from "@/types/output-config";
import { JOBPUTER_HELP_COST } from "@/lib/config";
import type { WorkflowInput } from "@/components/workflow/nodes/TriggerNode";
import { useAuth } from "@/contexts/AuthContext";
import { SolanaIcon, BaseIcon } from "@/components/icons/ChainIcons";
import { NotificationBell } from "@/components/NotificationBell";
import { useWebSocket, type ScheduleUpdatedEvent } from "@/hooks/useWebSocket";

import type { Job } from "@/hooks/useJobQuery";

interface JobCanvasProps {
  initialJob?: Job;
}

export default function JobCanvas({ initialJob }: JobCanvasProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<WorkflowCanvasRef>(null);
  const { user, loading: authLoading, signOut } = useAuth();
  const isAuthenticated = !!user;

  // Modal state from context (for global modals only)
  const { openJobputerChat, openSearch } = useModals();

  // Panel state for Railway-style floating panels
  const [showResourcesPanel, setShowResourcesPanel] = useState(false);
  const [resourcesPanelInitialTab, setResourcesPanelInitialTab] =
    useState<ResourcesPanelTab>("resources");
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [configureSourceId, setConfigureSourceId] = useState<string | null>(
    null,
  );
  const [configureSourceType, setConfigureSourceType] =
    useState<SourceType>("job_history");
  const [showCreateJobPanel, setShowCreateJobPanel] = useState(false);
  const [showJobDetailsPanel, setShowJobDetailsPanel] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [jobPanelInitialTab, setJobPanelInitialTab] =
    useState<JobPanelTab>("overview");
  const [configureFromPanel, setConfigureFromPanel] = useState(false); // Track if configuring resource from panel

  // Panel stacking state machine - max 2 panels visible at a time
  // Stack: [back, top] or [top] or []
  // Panel keys can be:
  //   - Simple: "run", "trigger", "output"
  //   - With node ID: "resource:node-123", "transform:node-456", "source:node-789"
  type PanelKey = string;
  const [panelStack, setPanelStack] = useState<PanelKey[]>([]);

  // Trigger and Output config panel state
  const [showTriggerConfigPanel, setShowTriggerConfigPanel] = useState(false);
  const [showOutputConfigPanel, setShowOutputConfigPanel] = useState(false);
  const [configuringOutputNodeId, setConfiguringOutputNodeId] = useState<
    string | null
  >(null);

  // Helper to get panel type from key
  const getPanelType = useCallback((key: PanelKey): string => key.split(":")[0], []);

  // Open a panel - adds to top, evicts oldest if stack > 2
  const openPanel = useCallback((panelKey: PanelKey) => {
    setPanelStack((prev) => {
      // Remove if this exact panel is already in stack
      const filtered = prev.filter((p) => p !== panelKey);
      // Add to top
      const newStack = [...filtered, panelKey];
      // Keep only last 2
      return newStack.slice(-2);
    });
  }, []);

  // Close a panel - removes from stack
  const closePanel = useCallback((panelKey: PanelKey) => {
    setPanelStack((prev) => prev.filter((p) => p !== panelKey));
  }, []);

  // Get visual state for a panel by its key
  const getPanelState = useCallback(
    (panelKey: PanelKey) => {
      const index = panelStack.indexOf(panelKey);
      if (index === -1) {
        return { isInStack: false, stackLevel: 1, hasStackedChild: false };
      }
      const isTop = index === panelStack.length - 1;
      return {
        isInStack: true,
        stackLevel: isTop ? 2 : 1,
        hasStackedChild: !isTop,
      };
    },
    [panelStack],
  );

  // Track previous stack for detecting evicted panels
  const prevStackRef = useRef<PanelKey[]>([]);

  // Workflow state - lifted up for persistence
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node>(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [jobName, setJobName] = useState("Untitled Job");
  const [viewport, setViewport] = useState<WorkflowViewport | undefined>(
    undefined,
  );

  // Local modal state
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runPanelInitialTriggerId, setRunPanelInitialTriggerId] = useState<
    string | null
  >(null);
  const [tryResource, setTryResource] = useState<Resource | null>(null);
  const [_tryResourceSource, setTryResourceSource] = useState<
    "resources" | "config" | "servers" | null
  >(null);
  const [_savedConfigureNodeId, setSavedConfigureNodeId] = useState<
    string | null
  >(null);
  const [showTryPanel, setShowTryPanel] = useState(false);
  const [tryPanelResource, setTryPanelResource] = useState<Resource | null>(
    null,
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  // viewingOutputNodeId removed - now using RunDetailsPanel directly
  const [showDocs, setShowDocs] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>("manual");
  const [triggerMethods, setTriggerMethods] = useState<{
    manual: boolean;
    webhook: boolean;
    schedule: boolean;
  }>({
    manual: true,
    webhook: false,
    schedule: false,
  });
  const [workflowInputs, setWorkflowInputs] = useState<WorkflowInput[]>([]);
  const [creatorMarkup, setCreatorMarkup] = useState<number>(0);
  const [scheduleConfig, setScheduleConfig] = useState<{
    cron: string;
    timezone: string;
    enabled: boolean;
  }>({ cron: "0 9 * * *", timezone: "UTC", enabled: false });
  const [scheduleNextRunAt, setScheduleNextRunAt] = useState<
    string | undefined
  >(undefined);
  const [published, setPublished] = useState<boolean>(true);
  const [showWorkflow, setShowWorkflow] = useState<boolean>(false);
  const [onSuccessJobId, setOnSuccessJobId] = useState<string | null>(null);
  const [webhookResponse, setWebhookResponse] = useState<
    | {
        mode: "passthrough" | "template" | "confirmation";
        template?: string;
        successMessage?: string;
      }
    | undefined
  >(undefined);

  // Use shared wallet hook
  const { wallet: walletData } = useWallet();

  // Persistence hook (warns on unsaved changes when navigating away)
  const {
    jobId: currentJobId,
    displayId,
    triggerType: savedTriggerType,
    triggerMethods: savedTriggerMethods,
    creatorMarkup: savedCreatorMarkup,
    hasUnsavedChanges,
    isSaving,
    isLoading,
    saveToDatabase,
    saveAsNewJob,
    saveJobName,
    loadJob: _loadJob,
    createNewJob,
    clearJob,
    mutateJobs,
    network: currentNetwork,
    setNetwork: _setCurrentNetwork,
  } = useWorkflowPersistence(
    nodes,
    edges,
    jobName,
    viewport,
    setNodes as (nodes: Node[]) => void,
    setEdges as (edges: Edge[]) => void,
    setJobName,
    setViewport,
    isAuthenticated,
    initialJob,
  );

  const { saveJob } = useSaveJobMutation();

  // Handle URL query params to open panels (e.g., ?panel=trigger from jobs list)
  useEffect(() => {
    const panel = searchParams.get("panel");
    if (panel === "trigger" && initialJob) {
      setShowTriggerConfigPanel(true);
      openPanel("trigger");
      // Clear the query param from URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("panel");
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, initialJob, router, openPanel]);

  // Track if we've done the initial sync to prevent re-syncing after saves
  const hasSyncedRef = useRef(false);
  const initialJobIdRef = useRef(initialJob?.id);

  // Sync trigger type, methods, creator markup, and schedule when job is FIRST loaded
  // Only runs once per job (not after saves)
  useEffect(() => {
    // Only sync when:
    // 1. We haven't synced yet, OR
    // 2. We're loading a DIFFERENT job (job ID changed)
    const isNewJob = initialJob?.id !== initialJobIdRef.current;
    if (hasSyncedRef.current && !isNewJob) {
      return; // Skip - already synced this job
    }

    console.log("[JobCanvas] Initial sync from saved data:", {
      savedTriggerType,
      savedTriggerMethods,
      savedCreatorMarkup,
      isNewJob,
      initialJobId: initialJob?.id,
    });

    hasSyncedRef.current = true;
    initialJobIdRef.current = initialJob?.id;

    if (savedTriggerType) {
      setTriggerType(savedTriggerType as TriggerType);
    }
    if (savedTriggerMethods) {
      setTriggerMethods({
        manual: savedTriggerMethods.manual,
        webhook: savedTriggerMethods.webhook,
        schedule: savedTriggerMethods.schedule ?? false,
      });
    }
    if (savedCreatorMarkup !== undefined) {
      setCreatorMarkup(savedCreatorMarkup);
    }
    // Sync schedule config, published, and onSuccessJobId from initialJob if available
    if (initialJob) {
      const job = initialJob as {
        schedule_cron?: string;
        schedule_timezone?: string;
        schedule_next_run_at?: string;
        published?: boolean;
        show_workflow?: boolean;
        on_success_job_id?: string | null;
        trigger_methods?: {
          manual: boolean;
          webhook: boolean;
          schedule?: boolean;
        };
        webhook_response?: {
          mode: "passthrough" | "template" | "confirmation";
          template?: string;
          successMessage?: string;
        };
      };
      if (job.schedule_cron) {
        // Use trigger_methods.schedule as the source of truth for schedule enabled state
        const scheduleEnabled = job.trigger_methods?.schedule ?? false;
        console.log("[JobCanvas] Setting scheduleConfig from initialJob:", {
          cron: job.schedule_cron,
          timezone: job.schedule_timezone || "UTC",
          enabled: scheduleEnabled,
        });
        setScheduleConfig({
          cron: job.schedule_cron,
          timezone: job.schedule_timezone || "UTC",
          enabled: scheduleEnabled,
        });
      }
      // Set next run time for countdown display
      if (job.schedule_next_run_at) {
        setScheduleNextRunAt(job.schedule_next_run_at);
      }
      // Sync published state
      if (job.published !== undefined) {
        setPublished(job.published);
      }
      // Sync showWorkflow state
      if (job.show_workflow !== undefined) {
        setShowWorkflow(job.show_workflow);
      }
      // Sync onSuccessJobId (job chaining)
      if (job.on_success_job_id !== undefined) {
        setOnSuccessJobId(job.on_success_job_id);
      }
      // Sync webhookResponse
      if (job.webhook_response) {
        setWebhookResponse(job.webhook_response);
      }
    }
  }, [savedTriggerType, savedTriggerMethods, savedCreatorMarkup, initialJob]);

  // Subscribe to websocket for schedule updates
  const { subscribe, isAvailable: wsAvailable } = useWebSocket();

  useEffect(() => {
    if (!currentJobId) return;

    // Subscribe to schedule:updated events
    const unsubscribe = subscribe<ScheduleUpdatedEvent>(
      "schedule:updated",
      (event) => {
        if (event.jobId === currentJobId && event.schedule_next_run_at) {
          setScheduleNextRunAt(event.schedule_next_run_at);
        }
      },
    );

    return unsubscribe;
  }, [currentJobId, subscribe]);

  // Fallback polling for schedule_next_run_at when WS is not available
  useEffect(() => {
    // Only poll if: WS unavailable, schedule enabled, no next run time, and we have a job ID
    if (
      wsAvailable ||
      !scheduleConfig.enabled ||
      scheduleNextRunAt ||
      !currentJobId
    ) {
      return;
    }

    const pollForNextRun = async () => {
      try {
        const res = await authenticatedFetch(`/jobs/${currentJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.schedule_next_run_at) {
          setScheduleNextRunAt(data.schedule_next_run_at);
        }
      } catch (err) {
        console.error("[JobCanvas] Error polling for schedule:", err);
      }
    };

    // Poll every 5 seconds until we get a next run time
    const interval = setInterval(pollForNextRun, 5000);
    // Also poll immediately
    pollForNextRun();

    return () => clearInterval(interval);
  }, [wsAvailable, scheduleConfig.enabled, scheduleNextRunAt, currentJobId]);

  // Sync workflowInputs from trigger node when nodes change (e.g., job loaded)
  useEffect(() => {
    const triggerNode = nodes.find((n) => n.type === "trigger");
    const inputs = (triggerNode?.data as { workflowInputs?: WorkflowInput[] })
      ?.workflowInputs;
    if (inputs && JSON.stringify(inputs) !== JSON.stringify(workflowInputs)) {
      setWorkflowInputs(inputs);
    }
  }, [nodes, workflowInputs]);

  // Canvas-specific search handler that allows adding resources to the canvas
  const handleCanvasSearch = useCallback(() => {
    openSearch({
      filterNetwork: currentJobId ? currentNetwork : undefined,
      onAddResource: (resource) => {
        if (currentJobId && canvasRef.current) {
          // Job exists, add resource directly
          canvasRef.current.addResource(resource as Resource);
        } else {
          // No job yet, create one with the resource included
          createNewJob(
            (resource.network as "solana" | "base") || "solana",
            resource as Resource,
          );
        }
      },
    });
  }, [openSearch, currentJobId, currentNetwork, createNewJob]);

  // Global keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleCanvasSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCanvasSearch]);

  // Calculate total job price (resources + platform fee)
  const { total: jobPrice } = useJobPrice(nodes, edges);

  // Node configuration (resource and transform nodes)
  const {
    configureNodeId,
    setConfigureNodeId,
    handleConfigureResource,
    configureResource,
    configureCurrentInputs,
    getUpstreamNodesForConfig,
    saveResourceConfigOnly,
    configureTransformId,
    setConfigureTransformId,
    handleConfigureTransform,
    currentTransformConfig,
    getUpstreamNodesForTransformConfig,
    handleSaveTransformConfig,
  } = useNodeConfiguration({
    nodes,
    setNodes,
    canvasRef,
    workflowInputs,
  });

  // Track when panels open to add to stack (using panel keys with node IDs)
  useEffect(() => {
    if (configureTransformId) {
      openPanel(`transform:${configureTransformId}`);
    }
  }, [configureTransformId, openPanel]);

  useEffect(() => {
    if (configureSourceId) {
      openPanel(`source:${configureSourceId}`);
    }
  }, [configureSourceId, openPanel]);

  useEffect(() => {
    if (configureNodeId && configureFromPanel) {
      openPanel(`resource:${configureNodeId}`);
    }
  }, [configureNodeId, configureFromPanel, openPanel]);

  useEffect(() => {
    if (showRunPanel) {
      openPanel("run");
    }
  }, [showRunPanel, openPanel]);

  useEffect(() => {
    if (showTriggerConfigPanel) {
      openPanel("trigger");
    }
  }, [showTriggerConfigPanel, openPanel]);

  useEffect(() => {
    if (showOutputConfigPanel) {
      openPanel("output");
    }
  }, [showOutputConfigPanel, openPanel]);

  // Auto-close panels that get evicted from the stack (when 3rd panel opens)
  // TODO: Fix issue where clicking same panel type (e.g., resource A then resource B)
  // replaces instead of stacking. Likely a stale closure issue with state values.
  useEffect(() => {
    const evicted = prevStackRef.current.filter((p) => !panelStack.includes(p));

    // Close evicted panels by clearing their state
    // For node-specific panels, only close if the evicted node matches the current state
    evicted.forEach((panelKey) => {
      const panelType = getPanelType(panelKey);
      const nodeId = panelKey.includes(":") ? panelKey.split(":")[1] : null;

      switch (panelType) {
        case "transform":
          if (nodeId && configureTransformId === nodeId) {
            setConfigureTransformId(null);
          }
          break;
        case "source":
          if (nodeId && configureSourceId === nodeId) {
            setConfigureSourceId(null);
          }
          break;
        case "resource":
          if (nodeId && configureNodeId === nodeId) {
            setConfigureNodeId(null);
            setConfigureFromPanel(false);
          }
          break;
        case "run":
          setShowRunPanel(false);
          break;
        case "trigger":
          setShowTriggerConfigPanel(false);
          break;
        case "output":
          setShowOutputConfigPanel(false);
          break;
        // outputViewer case removed - using RunDetailsPanel directly
      }
    });

    prevStackRef.current = panelStack;
  }, [
    panelStack,
    setConfigureTransformId,
    setConfigureNodeId,
    configureTransformId,
    configureSourceId,
    configureNodeId,
    getPanelType,
  ]);

  // Run polling hook - handles all run status polling and event application
  const {
    currentRunId,
    isInitiating,
    viewingRunId: _viewingRunId,
    setCurrentRunId,
    setIsInitiating,
    setViewingRunId,
    handleCancelRun,
    handleSelectRun,
    startTracking,
  } = useRunTracking({
    currentJobId,
    setNodes,
    edges,
  });

  // Fetch runs for Activity drawer
  const { data: runsData, mutate: _mutateRuns } = useSWR<{ runs: Run[] }>(
    currentJobId ? `/runs?jobId=${currentJobId}` : null,
    authenticatedFetcher,
    { refreshInterval: currentRunId ? 2000 : 10000 }, // Poll faster when running
  );
  const runs = runsData?.runs || [];

  // outputViewerData removed - using RunDetailsPanel directly

  // Fetch integration statuses for output config
  const { data: telegramConfigData } = useSWR<{
    hasBotToken: boolean;
    defaultChatId: string | null;
    isEnabled: boolean;
  }>(
    showOutputConfigPanel ? "/integrations/telegram/config" : null,
    authenticatedFetcher,
  );

  const { data: xStatusData } = useSWR<{
    connected: boolean;
    profile: { username?: string; display_name?: string };
  }>(
    showOutputConfigPanel ? "/integrations/x/status" : null,
    authenticatedFetcher,
  );

  // Fetch user's jobs for chaining dropdown (in run panel)
  const { data: userJobsData } = useSWR<{
    jobs: Array<{ id: string; name: string }>;
  }>(showRunPanel ? "/jobs" : null, authenticatedFetcher);

  // Fetch public jobs for chaining dropdown
  const { data: publicJobsData } = useSWR<{
    jobs: Array<{
      id: string;
      name: string;
      owner_username?: string;
      price?: number;
    }>;
  }>(showRunPanel ? "/jobs/public?limit=50" : null, authenticatedFetcher);

  // Build list of chainable jobs
  const userJobsForChaining = (userJobsData?.jobs || []).map((j) => ({
    ...j,
    isOwn: true,
    isCurrent: j.id === currentJobId,
  }));

  const publicJobsForChaining = (publicJobsData?.jobs || [])
    .filter((j) => !userJobsData?.jobs?.some((uj) => uj.id === j.id))
    .map((j) => ({ ...j, isOwn: false, isCurrent: false }));

  // Handle workflow execution - creates a run and starts polling
  const handleRunWorkflow = useCallback(
    async (
      inputs: ResourceInputs,
      workflowInputValues?: WorkflowInputValues,
      startingTriggerIds?: string[],
    ) => {
      // Clear any historical run view and show initiating state
      setViewingRunId(null);
      setIsInitiating(true);

      try {
        // Build execution plan from canvas (includes parallel execution levels)
        // If startingTriggerIds provided, only execute nodes reachable from those triggers
        const { steps, stepLevels } = buildWorkflowSteps(
          nodes,
          edges,
          startingTriggerIds,
        );

        // Save workflow data first
        await saveToDatabase();

        // Must have a saved job to create a run
        if (!currentJobId) {
          throw new Error("Please save the job before running");
        }
        const jobId = currentJobId;

        // Save onSuccessJobId separately (saveToDatabase doesn't include it)
        // This ensures chaining/looping config is persisted before the run starts
        console.log("[Run] Saving onSuccessJobId:", onSuccessJobId);
        await saveJob(jobId, { onSuccessJobId });

        // Set all outputs to loading
        setNodes((nds) =>
          nds.map((node) =>
            node.type === "output"
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    result: "Starting workflow...",
                    isLoading: true,
                  },
                }
              : node,
          ),
        );

        // Create the run with unified steps format + parallel execution levels
        const res = await authenticatedFetch("/runs", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            inputs,
            steps,
            stepLevels, // For parallel execution
            workflowInputs: workflowInputValues, // Top-level inputs from trigger
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setNodes((nds) =>
            nds.map((node) =>
              node.type === "output"
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      result: `❌ Error: ${data.error}`,
                      isLoading: false,
                    },
                  }
                : node,
            ),
          );
          throw new Error(data.error || "Failed to start run");
        }

        // Stop initiating, start running
        setIsInitiating(false);

        // Start polling
        const runId = data.run.id;
        setCurrentRunId(runId);

        // Set all resource/transform nodes to "pending" state
        setNodes((nds) =>
          nds.map((node) => {
            if (node.type === "resource" || node.type === "transform") {
              return {
                ...node,
                data: {
                  ...node.data,
                  executionStatus: "pending",
                },
              };
            }
            return node;
          }),
        );

        // Start polling for run status
        startTracking(runId);
      } catch (error) {
        // Always reset initiating state on error
        setIsInitiating(false);
        throw error;
      }
    },
    [
      nodes,
      edges,
      setNodes,
      currentJobId,
      saveToDatabase,
      saveJob,
      onSuccessJobId,
      startTracking,
      setCurrentRunId,
      setIsInitiating,
      setViewingRunId,
    ],
  );

  const handleSave = async () => {
    try {
      await saveToDatabase();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const handleExportJson = () => {
    // Export the job definition as JSON
    const exportData = {
      name: jobName,
      network: currentNetwork,
      workflow_definition: {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        })),
        edges: edges,
        viewport: viewport,
      },
      trigger_type: triggerType,
      trigger_methods: triggerMethods,
      creator_markup: creatorMarkup,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(jobName || "job").toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Node configuration logic is now in useNodeConfiguration hook

  // Show loading state until we know:
  // 1. Whether user is authenticated
  // 2. If authenticated, whether jobs have loaded
  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-[53px] border-b border-border bg-background px-4 flex-shrink-0 flex items-center">
        <div className="flex items-center justify-between w-full gap-4">
          {/* Left: Brand + Job dropdown */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Logo href={undefined} />
            <span className="text-muted-foreground/50 hidden sm:inline px-2">
              /
            </span>
            <JobDropdown
              currentJobId={currentJobId}
              currentJobName={jobName}
              currentNetwork={currentNetwork}
              onSelectJob={(job) => {
                router.push(`/jobs/${job.id}`);
              }}
              onDeleteJob={(deletedId) => {
                if (deletedId === currentJobId) {
                  clearJob();
                }
                mutateJobs();
              }}
              onOpenSettings={() => {
                setJobPanelInitialTab("settings");
                setShowJobDetailsPanel(true);
              }}
              onNewJob={() => setShowCreateJobPanel(true)}
              className="hidden sm:block"
            />
          </div>

          {/* Right: Actions - Desktop */}
          <div className="hidden lg:flex items-center gap-1">
            {currentJobId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setJobPanelInitialTab("overview");
                  setShowJobDetailsPanel(true);
                }}
                className="gap-1.5 text-xs"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Settings
              </Button>
            )}
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              }
              placement="bottom-end"
              className="min-w-[140px]"
            >
              <DropdownItem onClick={() => canvasRef.current?.addTrigger()}>
                <Zap className="h-4 w-4 mr-2 text-trigger" />
                Trigger
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  setResourcesPanelInitialTab("resources");
                  setShowResourcesPanel(true);
                }}
              >
                <Box className="h-4 w-4 mr-2 text-resource" />
                Resource
              </DropdownItem>
              <DropdownItem
                onClick={() => canvasRef.current?.addTransform("extract")}
              >
                <Shuffle className="h-4 w-4 mr-2 text-transform" />
                Transform
              </DropdownItem>
              <DropdownItem onClick={() => setShowSourcesPanel(true)}>
                <Database className="h-4 w-4 mr-2 text-source" />
                Source
              </DropdownItem>
              <DropdownItem onClick={() => canvasRef.current?.addOutput()}>
                <Monitor className="h-4 w-4 mr-2 text-output" />
                Output
              </DropdownItem>
            </Dropdown>
            <button
              onClick={() => {
                setResourcesPanelInitialTab("resources");
                setShowResourcesPanel(true);
              }}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="Search resources (⌘K)"
            >
              <Search className="h-5 w-5" />
            </button>
            <JobputerChatButton />
            <button
              onClick={() => setShowDocs(true)}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="Help & Documentation"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>

          {/* Right: Actions - Mobile */}
          <div className="flex lg:hidden items-center gap-1">
            <ThemeToggle />
            <UserMenu />
            <button
              onClick={() => setShowMobileMenu(true)}
              className="p-2 rounded hover:bg-accent text-foreground/70 hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Sidebar */}
          <div className="absolute right-0 top-0 h-full w-64 bg-card border-l border-border shadow-xl">
            <div className="h-[53px] flex items-center justify-between px-4 border-b border-border">
              <span className="font-semibold">Menu</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1.5 rounded hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {currentJobId && (
                <>
                  <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                    Current Job
                  </div>
                  <Input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    onBlur={(e) => saveJobName(e.target.value)}
                    placeholder="x402job"
                    className="mx-2 mb-2 w-[calc(100%-16px)]"
                  />
                  <button
                    onClick={() => {
                      handleSave();
                      setShowMobileMenu(false);
                    }}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveAs(true);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Save As...
                  </button>
                  <div className="h-px bg-border my-2" />
                </>
              )}
              <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                Navigation
              </div>
              <button
                onClick={() => {
                  setShowCreateJobPanel(true);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Job
              </button>
              <Link
                href="/dashboard/notifications"
                onClick={() => setShowMobileMenu(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </Link>
              <div className="h-px bg-border my-2" />
              <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                Add to Canvas
              </div>
              <button
                onClick={() => {
                  canvasRef.current?.addTrigger();
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Zap className="h-4 w-4 text-trigger" />
                Trigger
              </button>
              <button
                onClick={() => {
                  setResourcesPanelInitialTab("resources");
                  setShowResourcesPanel(true);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Box className="h-4 w-4 text-resource" />
                Resource
              </button>
              <button
                onClick={() => {
                  canvasRef.current?.addTransform("extract");
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Shuffle className="h-4 w-4 text-transform" />
                Transform
              </button>
              <button
                onClick={() => {
                  setShowSourcesPanel(true);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Database className="h-4 w-4 text-source" />
                Source
              </button>
              <button
                onClick={() => {
                  canvasRef.current?.addOutput();
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <Monitor className="h-4 w-4 text-output" />
                Output
              </button>
              {currentJobId && (
                <button
                  onClick={() => {
                    setJobPanelInitialTab("overview");
                    setShowJobDetailsPanel(true);
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
                >
                  <Settings2 className="h-4 w-4" />
                  Settings
                </button>
              )}
              <div className="h-px bg-border my-2" />
              <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                Help
              </div>
              <button
                onClick={() => {
                  openJobputerChat();
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Ask Jobputer
                <span className="ml-auto text-xs text-muted-foreground">
                  ${JOBPUTER_HELP_COST.toFixed(2)}
                </span>
              </button>
              <button
                onClick={() => {
                  setShowDocs(true);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                Documentation
              </button>

              {/* Wallet Section */}
              {isAuthenticated && (
                <>
                  <div className="h-px bg-border my-2" />
                  <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                    Wallet
                  </div>
                  {walletData ? (
                    <div className="px-2 space-y-1.5">
                      {/* Total Balance */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">
                          Balance
                        </span>
                        <span className="text-sm font-mono font-semibold text-primary">
                          $
                          {(
                            walletData.totalBalanceUsdc ??
                            walletData.balanceUsdc ??
                            0
                          ).toFixed(2)}
                        </span>
                      </div>

                      {/* Solana Wallet */}
                      {walletData.address && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                          <SolanaIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <code className="text-xs flex-1 truncate">
                            {walletData.address.slice(0, 6)}...
                            {walletData.address.slice(-4)}
                          </code>
                          <span className="text-xs font-mono text-muted-foreground">
                            ${(walletData.balanceUsdc ?? 0).toFixed(2)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(walletData.address);
                              setCopiedWallet("solana");
                              setTimeout(() => setCopiedWallet(null), 2000);
                            }}
                            className="p-1 hover:bg-accent rounded"
                          >
                            {copiedWallet === "solana" ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Base Wallet */}
                      {walletData.baseAddress && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                          <BaseIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <code className="text-xs flex-1 truncate">
                            {walletData.baseAddress.slice(0, 6)}...
                            {walletData.baseAddress.slice(-4)}
                          </code>
                          <span className="text-xs font-mono text-muted-foreground">
                            ${(walletData.baseBalanceUsdc ?? 0).toFixed(2)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                walletData.baseAddress!,
                              );
                              setCopiedWallet("base");
                              setTimeout(() => setCopiedWallet(null), 2000);
                            }}
                            className="p-1 hover:bg-accent rounded"
                          >
                            {copiedWallet === "base" ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground text-center py-1">
                        Send USDC to fund jobs
                      </p>
                    </div>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-xs text-muted-foreground italic">
                        Loading wallet...
                      </p>
                    </div>
                  )}

                  {/* Sign Out */}
                  <div className="h-px bg-border my-2" />
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Canvas */}
      <div className="flex-1 relative">
        {!currentJobId ? (
          /* Empty state - landing page or no job loaded */
          <div className="absolute inset-0 flex flex-col items-center md:justify-center bg-background overflow-y-auto py-12 md:py-8">
            {/* Hero section - constrained width */}
            <div className="flex flex-col items-center gap-8 max-w-xl text-center px-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Zap className="h-12 w-12 text-primary" />
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-display font-bold">x402.jobs</h1>
                <p className="text-muted-foreground text-xl leading-relaxed">
                  The visual workflow builder for AI agents.
                  <br />
                  Chain resources together. Pay only when they run.
                </p>
              </div>
              {isAuthenticated ? (
                <div className="flex gap-4 justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setResourcesPanelInitialTab("jobs");
                      setShowResourcesPanel(true);
                    }}
                    className="gap-2"
                  >
                    <Layers className="h-4 w-4" />
                    Browse Jobs
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setShowCreateJobPanel(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Job
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => (window.location.href = "/login")}
                >
                  Get Started
                </Button>
              )}
            </div>

            {/* Stats section - wider, outside the max-w-xl constraint */}
            <div className="w-full max-w-6xl px-4 mt-8">
              <PlatformStats />
            </div>

            <div className="mt-8">
              <MemeputerBadge />
            </div>
          </div>
        ) : (
          <WorkflowCanvas
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            viewport={viewport}
            onViewportChange={setViewport}
            onRun={(triggerId) => {
              setRunPanelInitialTriggerId(triggerId || null);
              setShowRunPanel(true);
            }}
            onCancel={handleCancelRun}
            onAddResource={() => {
              setResourcesPanelInitialTab("resources");
              setShowResourcesPanel(true);
            }}
            onConfigureResource={(nodeId) => {
              // Close other panels to maintain max 2 stack
              setShowTryPanel(false);
              setShowJobDetailsPanel(false);
              setConfigureFromPanel(true);
              handleConfigureResource(nodeId);
              // Always bring to top of stack (even if same node clicked again)
              openPanel(`resource:${nodeId}`);
            }}
            onConfigureTransform={(nodeId) => {
              // Close JobPanel when configuring from canvas
              setShowJobDetailsPanel(false);
              handleConfigureTransform(nodeId);
              // Always bring to top of stack (even if same node clicked again)
              openPanel(`transform:${nodeId}`);
            }}
            onConfigureSource={(nodeId) => {
              // Close JobPanel when configuring from canvas
              setShowJobDetailsPanel(false);
              const sourceNode = nodes.find((n) => n.id === nodeId);
              const sourceType =
                (sourceNode?.data as { sourceType?: SourceType })?.sourceType ||
                "job_history";
              setConfigureSourceType(sourceType);
              setConfigureSourceId(nodeId);
              // Always bring to top of stack (even if same node clicked again)
              openPanel(`source:${nodeId}`);
            }}
            onConfigureTrigger={() => {
              // Close JobPanel if open
              setShowJobDetailsPanel(false);
              // Open the trigger config panel and bring to top of stack
              setShowTriggerConfigPanel(true);
              openPanel("trigger");
            }}
            onConfigureOutput={(nodeId) => {
              // Close JobPanel if open
              setShowJobDetailsPanel(false);
              // Track which output node is being configured
              setConfiguringOutputNodeId(nodeId);
              // Open the output config panel and bring to top of stack
              setShowOutputConfigPanel(true);
              openPanel("output");
            }}
            onViewOutput={(_result, _nodeId) => {
              // Open RunDetailsPanel with the most recent run (same as clicking run in sidebar)
              const mostRecentRun = runs[0]; // runs are sorted by created_at desc
              if (mostRecentRun) {
                setSelectedRun(mostRecentRun);
                setShowJobDetailsPanel(true);
              }
            }}
            isRunning={!!currentRunId}
            isInitiating={isInitiating}
            triggerType={triggerType}
            triggerMethods={triggerMethods}
            scheduleConfig={scheduleConfig}
            scheduleNextRunAt={scheduleNextRunAt}
            onSave={currentJobId ? handleSave : undefined}
            onSaveAs={currentJobId ? () => setShowSaveAs(true) : undefined}
            onExportJson={currentJobId ? handleExportJson : undefined}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        )}
      </div>

      {/* Resources Panel with Resources and Jobs tabs */}
      <ResourcesPanel
        isOpen={showResourcesPanel}
        onClose={() => setShowResourcesPanel(false)}
        initialTab={resourcesPanelInitialTab}
        filterNetwork={currentJobId ? currentNetwork : undefined}
        onSelectResource={(resource) => {
          setShowResourcesPanel(false);
          if (currentJobId && canvasRef.current) {
            // Job exists, add resource directly
            canvasRef.current.addResource(resource as Resource);
          } else {
            // No job yet, create one with the resource included
            createNewJob(
              (resource.network as "solana" | "base") || "solana",
              resource as Resource,
            );
          }
        }}
        onTryResource={(resource) => {
          setShowResourcesPanel(false);
          setTryResource(resource as Resource);
          setTryResourceSource("resources");
        }}
      />

      {/* Create Job Panel */}
      <CreateJobPanel
        isOpen={showCreateJobPanel}
        onClose={() => setShowCreateJobPanel(false)}
        onCreate={(name, network) => {
          setShowCreateJobPanel(false);
          createNewJob(network, undefined, name);
        }}
      />

      {/* Comprehensive Job Panel with tabs for Overview, Trigger, Output, Runs, Resources */}
      <JobPanel
        isOpen={showJobDetailsPanel && !selectedRun}
        onClose={() => setShowJobDetailsPanel(false)}
        initialTab={jobPanelInitialTab}
        job={
          currentJobId
            ? ({
                id: currentJobId,
                name: jobName,
                network: currentNetwork,
                trigger_type: triggerType,
                created_at: initialJob?.created_at || new Date().toISOString(),
                updated_at: initialJob?.updated_at,
                last_run_at: initialJob?.last_run_at,
                display_id: displayId,
                slug: initialJob?.slug,
                avatar_url: initialJob?.avatar_url,
                workflow_definition: { nodes, edges, viewport },
              } as Job)
            : null
        }
        jobId={currentJobId}
        jobName={jobName}
        jobSlug={initialJob?.slug}
        username={initialJob?.owner_username}
        displayId={displayId}
        network={currentNetwork}
        triggerType={triggerType}
        triggerMethods={triggerMethods}
        scheduleConfig={scheduleConfig}
        workflowInputs={workflowInputs}
        creatorMarkup={creatorMarkup}
        jobPrice={jobPrice}
        published={published}
        showWorkflow={showWorkflow}
        onSuccessJobId={onSuccessJobId}
        webhookResponse={webhookResponse}
        nodes={nodes}
        edges={edges}
        onRun={() => {
          // Open run panel stacked on top of job panel
          setShowRunPanel(true);
        }}
        onTriggerSave={async (config) => {
          setTriggerType(config.triggerType);
          setTriggerMethods({
            manual: config.triggerMethods.manual,
            webhook: config.triggerMethods.webhook,
            schedule: config.triggerMethods.schedule ?? false,
          });
          if (config.creatorMarkup !== undefined) {
            setCreatorMarkup(config.creatorMarkup);
          }
          if (config.scheduleConfig) {
            setScheduleConfig(config.scheduleConfig);
            // Clear next run time - Inngest will set a fresh one
            setScheduleNextRunAt(undefined);
          }
          if (config.published !== undefined) {
            setPublished(config.published);
          }
          if (config.onSuccessJobId !== undefined) {
            setOnSuccessJobId(config.onSuccessJobId);
          }
          if (config.webhookResponse !== undefined) {
            setWebhookResponse(config.webhookResponse);
          }

          const updatedNodes = config.workflowInputs
            ? nodes.map((node) =>
                node.type === "trigger"
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        workflowInputs: config.workflowInputs,
                      },
                    }
                  : node,
              )
            : nodes;

          if (config.workflowInputs) {
            setWorkflowInputs(config.workflowInputs);
            setNodes(updatedNodes);
          }

          if (currentJobId) {
            const workflowData = {
              nodes: updatedNodes.map((node) => {
                if (node.type === "output") {
                  const {
                    result: _r,
                    isLoading: _l,
                    ...restData
                  } = (node.data || {}) as Record<string, unknown>;
                  return {
                    ...node,
                    data: { ...restData, result: null, isLoading: false },
                  };
                }
                if (node.type === "resource" || node.type === "transform") {
                  const { executionStatus: _e, ...restData } = (node.data ||
                    {}) as Record<string, unknown>;
                  return { ...node, data: restData };
                }
                return node;
              }),
              edges,
              viewport,
            };

            await saveJob(currentJobId, {
              triggerType: config.triggerType,
              triggerMethods: config.triggerMethods,
              creatorMarkup: config.creatorMarkup,
              scheduleConfig: config.scheduleConfig,
              published: config.published,
              onSuccessJobId: config.onSuccessJobId,
              webhookResponse: config.webhookResponse,
              workflow_data: workflowData,
            });
          }
        }}
        onOutputSave={async (nodeId, config) => {
          console.log(
            "[OutputSave] Called with nodeId:",
            nodeId,
            "config:",
            config,
          );
          console.log(
            "[OutputSave] Current node IDs:",
            nodes.map((n) => n.id),
          );

          setNodes((nds) =>
            nds.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, outputConfig: config } }
                : node,
            ),
          );

          if (currentJobId) {
            const updatedNodes = nodes.map((node) => {
              console.log(
                "[OutputSave] Checking node:",
                node.id,
                "against nodeId:",
                nodeId,
                "match:",
                node.id === nodeId,
              );
              if (node.id === nodeId) {
                // Clean result/isLoading AND add outputConfig
                const {
                  result: _r,
                  isLoading: _l,
                  ...restData
                } = (node.data || {}) as Record<string, unknown>;
                const newData = {
                  ...restData,
                  outputConfig: config,
                  result: null,
                  isLoading: false,
                };
                console.log(
                  "[OutputSave] ✅ MATCH! Saving node with outputConfig:",
                  { nodeId, newData },
                );
                return {
                  ...node,
                  data: newData,
                };
              }
              if (node.type === "output") {
                const {
                  result: _r,
                  isLoading: _l,
                  ...restData
                } = (node.data || {}) as Record<string, unknown>;
                return {
                  ...node,
                  data: { ...restData, result: null, isLoading: false },
                };
              }
              if (node.type === "resource" || node.type === "transform") {
                const { executionStatus: _e, ...restData } = (node.data ||
                  {}) as Record<string, unknown>;
                return { ...node, data: restData };
              }
              return node;
            });

            const workflowToSave = { nodes: updatedNodes, edges, viewport };
            const outputNodesBeingSaved = updatedNodes.filter(
              (n) => n.type === "output",
            );
            console.log(
              "[OutputSave] About to save workflow, output nodes:",
              outputNodesBeingSaved,
            );
            await saveJob(currentJobId, {
              workflow_data: workflowToSave,
            });
          }
        }}
        getOutputConfig={(nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          return (
            (node?.data as { outputConfig?: OutputConfig })?.outputConfig || {
              destinations: [],
            }
          );
        }}
        onSelectRun={(run) => {
          setSelectedRun(run);
        }}
        onSettingsSave={async (settings) => {
          setJobName(settings.name);
          if (settings.published !== undefined) {
            setPublished(settings.published);
          }
          if (settings.showWorkflow !== undefined) {
            setShowWorkflow(settings.showWorkflow);
          }
          if (currentJobId) {
            await saveJob(currentJobId, {
              name: settings.name,
              description: settings.description,
              avatarUrl: settings.avatarUrl,
              published: settings.published,
              showWorkflow: settings.showWorkflow,
            });
          }
        }}
        onDelete={
          currentJobId
            ? async () => {
                const res = await authenticatedFetch(`/jobs/${currentJobId}`, {
                  method: "DELETE",
                });
                if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error || "Failed to delete job");
                }
                router.push("/dashboard/jobs");
              }
            : undefined
        }
        onConfigureResource={(nodeId) => {
          setConfigureFromPanel(true);
          handleConfigureResource(nodeId);
        }}
        hasStackedChild={!!selectedRun || configureFromPanel || showRunPanel}
        isHidden={configureFromPanel && showTryPanel}
        onBringToFront={() => {
          // Close the stacked panel(s) and bring job panel to front
          if (showRunPanel) {
            setShowRunPanel(false);
            setRunPanelInitialTriggerId(null);
          }
          if (configureFromPanel) {
            setConfigureNodeId(null);
            setConfigureFromPanel(false);
            setShowTryPanel(false);
            setTryPanelResource(null);
          }
          if (selectedRun) {
            setSelectedRun(null);
          }
        }}
      />

      <RunDetailsPanel
        isOpen={showJobDetailsPanel && !!selectedRun}
        onClose={() => {
          setSelectedRun(null);
          setShowJobDetailsPanel(false);
        }}
        run={selectedRun}
        jobName={jobName}
        onReRun={() => {
          setSelectedRun(null);
          setShowRunPanel(true);
        }}
        onViewOnCanvas={(run, events) => {
          handleSelectRun(run, events);
          setSelectedRun(null);
          setShowJobDetailsPanel(false);
        }}
        onDelete={() => {
          setSelectedRun(null);
        }}
      />

      <ResourceInteractionModal
        isOpen={!!tryResource}
        onClose={() => {
          setTryResource(null);
          setTryResourceSource(null);
          setSavedConfigureNodeId(null);
        }}
        resource={tryResource}
      />

      <RunWorkflowPanel
        isOpen={showRunPanel}
        onClose={() => {
          setShowRunPanel(false);
          setRunPanelInitialTriggerId(null);
          closePanel("run");
          // Save job when closing run panel (to persist onSuccessJobId changes)
          if (currentJobId) {
            saveToDatabase().catch(console.error);
          }
        }}
        onConfirm={handleRunWorkflow}
        nodes={nodes}
        edges={edges}
        walletData={walletData as Record<string, unknown> | null}
        network={currentNetwork}
        workflowInputs={workflowInputs}
        jobId={currentJobId}
        initialTriggerId={runPanelInitialTriggerId}
        onSuccessJobId={onSuccessJobId}
        onSuccessJobIdChange={setOnSuccessJobId}
        userJobs={userJobsForChaining}
        publicJobs={publicJobsForChaining}
        stackLevel={getPanelState("run").stackLevel}
        hasStackedChild={getPanelState("run").hasStackedChild}
      />

      {/* ResourceConfigPanel - shown when configuring resource (from canvas or JobPanel) */}
      <ResourceConfigPanel
        isOpen={!!configureNodeId && configureFromPanel}
        onClose={() => {
          const nodeId = configureNodeId;
          setConfigureNodeId(null);
          setConfigureFromPanel(false);
          if (nodeId) closePanel(`resource:${nodeId}`);
        }}
        onSave={(inputs) => {
          const nodeId = configureNodeId;
          saveResourceConfigOnly(inputs);
          // Small delay to let React state propagate before saving to DB
          setTimeout(() => {
            saveToDatabase().catch(console.error);
          }, 50);
          // Close the panel to reveal the panel below it
          setConfigureNodeId(null);
          setConfigureFromPanel(false);
          if (nodeId) closePanel(`resource:${nodeId}`);
        }}
        onTry={() => {
          // Open try panel on top of config panel (keep config panel open)
          if (configureResource) {
            setTryPanelResource({
              id: configureResource.id,
              name: configureResource.name,
              description: configureResource.description,
              resource_url: configureResource.resourceUrl || "",
              network: configureResource.network || "solana",
              max_amount_required: String(
                (configureResource.price || 0) * 1_000_000,
              ),
              avatar_url: configureResource.avatarUrl,
              output_schema: configureResource.outputSchema,
              extra: configureResource.extra,
            } as Resource);
            setShowTryPanel(true);
          }
        }}
        nodeId={configureNodeId ?? undefined}
        resource={configureResource}
        currentInputs={configureCurrentInputs}
        availableNodes={getUpstreamNodesForConfig()}
        workflowInputs={workflowInputs}
        stackLevel={
          configureNodeId
            ? getPanelState(`resource:${configureNodeId}`).stackLevel
            : 1
        }
        hasStackedChild={
          (configureNodeId
            ? getPanelState(`resource:${configureNodeId}`).hasStackedChild
            : false) || showTryPanel
        }
      />

      {/* ResourceInteractionPanel - try resource as stacked drawer */}
      <ResourceInteractionPanel
        isOpen={showTryPanel && !!tryPanelResource}
        onClose={() => {
          setShowTryPanel(false);
          setTryPanelResource(null);
        }}
        resource={tryPanelResource}
      />

      {/* OutputViewerPanel removed - using RunDetailsPanel instead */}

      <TransformConfigPanel
        isOpen={!!configureTransformId}
        onClose={() => {
          const nodeId = configureTransformId;
          setConfigureTransformId(null);
          if (nodeId) closePanel(`transform:${nodeId}`);
        }}
        onSave={(config) => {
          handleSaveTransformConfig(config);
          // Small delay to let React state propagate before saving to DB
          setTimeout(() => {
            saveToDatabase().catch(console.error);
          }, 50);
        }}
        currentConfig={currentTransformConfig as TransformConfig | undefined}
        availableNodes={getUpstreamNodesForTransformConfig()}
        onAskJobputer={() => {
          const nodeId = configureTransformId;
          setConfigureTransformId(null);
          if (nodeId) closePanel(`transform:${nodeId}`);
          openJobputerChat();
        }}
        stackLevel={
          configureTransformId
            ? getPanelState(`transform:${configureTransformId}`).stackLevel
            : 1
        }
        hasStackedChild={
          configureTransformId
            ? getPanelState(`transform:${configureTransformId}`).hasStackedChild
            : false
        }
      />

      {/* Sources Panel - for selecting source type */}
      <SourcesPanel
        isOpen={showSourcesPanel}
        onClose={() => setShowSourcesPanel(false)}
        onSelectSource={(sourceType) => {
          setShowSourcesPanel(false);
          canvasRef.current?.addSource(sourceType);
        }}
      />

      {/* Source Config Panel - for configuring a source node */}
      <SourceConfigPanel
        isOpen={!!configureSourceId}
        onClose={() => {
          const nodeId = configureSourceId;
          setConfigureSourceId(null);
          if (nodeId) closePanel(`source:${nodeId}`);
        }}
        onSave={(config) => {
          const nodeId = configureSourceId;
          // Update the source node's config
          setNodes((nds) =>
            nds.map((node) =>
              node.id === configureSourceId
                ? { ...node, data: { ...node.data, config: config.config } }
                : node,
            ),
          );
          setConfigureSourceId(null);
          if (nodeId) closePanel(`source:${nodeId}`);
          // Save to database
          setTimeout(() => {
            saveToDatabase().catch(console.error);
          }, 50);
        }}
        sourceType={configureSourceType}
        currentConfig={
          configureSourceId
            ? (
                nodes.find((n) => n.id === configureSourceId)?.data as {
                  config?: SourceConfig;
                }
              )?.config
            : undefined
        }
        currentJobId={currentJobId || undefined}
        stackLevel={
          configureSourceId
            ? getPanelState(`source:${configureSourceId}`).stackLevel
            : 1
        }
        hasStackedChild={
          configureSourceId
            ? getPanelState(`source:${configureSourceId}`).hasStackedChild
            : false
        }
      />

      {/* TriggerConfigPanel - shown when double-clicking trigger node */}
      <TriggerConfigPanel
        isOpen={showTriggerConfigPanel}
        onClose={() => {
          setShowTriggerConfigPanel(false);
          closePanel("trigger");
        }}
        onSave={async (config) => {
          // Update local state
          const newTriggerMethods = {
            manual: config.methods.manual,
            webhook: config.methods.webhook,
            schedule: config.methods.schedule ?? false,
          };
          setTriggerMethods(newTriggerMethods);
          if (config.scheduleConfig) {
            setScheduleConfig(config.scheduleConfig);
          }
          setCreatorMarkup(config.creatorMarkup);

          // Update workflow inputs in trigger node and state
          if (config.workflowInputs) {
            const updatedNodes = config.workflowInputs
              ? nodes.map((node) =>
                  node.type === "trigger"
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          workflowInputs: config.workflowInputs,
                        },
                      }
                    : node,
                )
              : nodes;
            setNodes(updatedNodes);
            setWorkflowInputs(config.workflowInputs);
          }

          setShowTriggerConfigPanel(false);
          closePanel("trigger");

          // Save trigger config to database (saveJob includes triggerMethods/scheduleConfig)
          if (currentJobId) {
            try {
              await saveJob(currentJobId, {
                triggerMethods: newTriggerMethods,
                scheduleConfig: config.scheduleConfig,
                creatorMarkup: config.creatorMarkup,
                published: config.published,
                showWorkflow: config.showWorkflow,
              });
            } catch (error) {
              console.error("Failed to save trigger config:", error);
            }
          }
        }}
        currentConfig={{
          methods: triggerMethods,
          scheduleConfig,
          creatorMarkup,
          published: initialJob?.published || false,
          showWorkflow: initialJob?.show_workflow || false,
          workflowInputs,
        }}
        jobPrice={jobPrice}
        webhookUrl={
          initialJob?.owner_username && initialJob?.slug
            ? `https://api.x402.jobs/@${initialJob.owner_username}/${initialJob.slug}`
            : undefined
        }
        hasResources={nodes.some((n) => n.type === "resource")}
        stackLevel={getPanelState("trigger").stackLevel}
        hasStackedChild={getPanelState("trigger").hasStackedChild}
      />

      {/* OutputConfigPanel - shown when double-clicking output node */}
      <OutputConfigPanel
        isOpen={showOutputConfigPanel}
        onClose={() => {
          setShowOutputConfigPanel(false);
          setConfiguringOutputNodeId(null);
          closePanel("output");
        }}
        onSave={async (config) => {
          // Save output config to the node being configured
          if (configuringOutputNodeId) {
            console.log(
              "[OutputConfigPanel] Saving config for node:",
              configuringOutputNodeId,
              config,
            );
            // Update node data
            setNodes((nds) =>
              nds.map((node) =>
                node.id === configuringOutputNodeId
                  ? { ...node, data: { ...node.data, outputConfig: config } }
                  : node,
              ),
            );
            // Save to database
            if (currentJobId) {
              const updatedNodes = nodes.map((node) => {
                if (node.id === configuringOutputNodeId) {
                  const {
                    result: _r,
                    isLoading: _l,
                    ...restData
                  } = (node.data || {}) as Record<string, unknown>;
                  return {
                    ...node,
                    data: {
                      ...restData,
                      outputConfig: config,
                      result: null,
                      isLoading: false,
                    },
                  };
                }
                if (node.type === "output") {
                  const {
                    result: _r,
                    isLoading: _l,
                    ...restData
                  } = (node.data || {}) as Record<string, unknown>;
                  return {
                    ...node,
                    data: { ...restData, result: null, isLoading: false },
                  };
                }
                if (node.type === "resource" || node.type === "transform") {
                  const { executionStatus: _e, ...restData } = (node.data ||
                    {}) as Record<string, unknown>;
                  return { ...node, data: restData };
                }
                return node;
              });
              const workflowToSave = { nodes: updatedNodes, edges, viewport };
              await saveJob(currentJobId, {
                workflow_data: workflowToSave,
              });
            }
          }
          setShowOutputConfigPanel(false);
          setConfiguringOutputNodeId(null);
          closePanel("output");
        }}
        currentConfig={
          configuringOutputNodeId
            ? (
                nodes.find((n) => n.id === configuringOutputNodeId)?.data as {
                  outputConfig?: OutputConfig;
                }
              )?.outputConfig
            : undefined
        }
        telegramStatus={{
          connected: telegramConfigData?.hasBotToken || false,
          defaultChatId: telegramConfigData?.defaultChatId || undefined,
        }}
        xStatus={{
          connected: xStatusData?.connected || false,
          profile: xStatusData?.profile,
        }}
        stackLevel={getPanelState("output").stackLevel}
        hasStackedChild={getPanelState("output").hasStackedChild}
      />

      {/* Docs Panel */}
      <DocsPanel isOpen={showDocs} onClose={() => setShowDocs(false)} />

      {/* Save As Modal */}
      <SaveAsModal
        isOpen={showSaveAs}
        onClose={() => setShowSaveAs(false)}
        onSave={saveAsNewJob}
        currentName={jobName}
      />

      {/* Trigger Config Modal */}
      <TriggerConfigModal
        isOpen={showTriggerConfig}
        onClose={() => setShowTriggerConfig(false)}
        jobId={currentJobId}
        jobSlug={initialJob?.slug}
        username={initialJob?.owner_username}
        displayId={displayId}
        currentConfig={{
          triggerType,
          triggerMethods: {
            ...triggerMethods,
            schedule: triggerMethods.schedule ?? false,
          },
          workflowInputs,
          creatorMarkup,
          scheduleConfig,
          published,
        }}
        jobPrice={jobPrice}
        onSave={async (config) => {
          setTriggerType(config.triggerType);
          if (config.triggerMethods) {
            setTriggerMethods({
              manual: config.triggerMethods.manual,
              webhook: config.triggerMethods.webhook,
              schedule: config.triggerMethods.schedule ?? false,
            });
          }
          if (config.creatorMarkup !== undefined) {
            setCreatorMarkup(config.creatorMarkup);
          }
          if (config.scheduleConfig) {
            setScheduleConfig(config.scheduleConfig);
            // Clear next run time - Inngest will set a fresh one
            setScheduleNextRunAt(undefined);
          }
          if (config.published !== undefined) {
            setPublished(config.published);
          }

          // Build updated nodes with workflowInputs NOW (before async operations)
          const updatedNodes = config.workflowInputs
            ? nodes.map((node) =>
                node.type === "trigger"
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        workflowInputs: config.workflowInputs,
                      },
                    }
                  : node,
              )
            : nodes;

          if (config.workflowInputs) {
            setWorkflowInputs(config.workflowInputs);
            setNodes(updatedNodes);
          }

          // Save trigger config and workflow to database
          if (currentJobId) {
            // Save everything in one call - trigger config AND workflow with updated nodes
            const workflowData = {
              nodes: updatedNodes.map((node) => {
                // Clean runtime data
                if (node.type === "output") {
                  const {
                    result: _result,
                    isLoading: _isLoading,
                    ...restData
                  } = (node.data || {}) as Record<string, unknown>;
                  return {
                    ...node,
                    data: { ...restData, result: null, isLoading: false },
                  };
                }
                if (node.type === "resource" || node.type === "transform") {
                  const { executionStatus: _executionStatus, ...restData } =
                    (node.data || {}) as Record<string, unknown>;
                  return { ...node, data: restData };
                }
                return node;
              }),
              edges,
              viewport,
            };

            await saveJob(currentJobId, {
              triggerType: config.triggerType,
              triggerMethods: config.triggerMethods,
              creatorMarkup: config.creatorMarkup,
              scheduleConfig: config.scheduleConfig,
              published: config.published,
              onSuccessJobId: config.onSuccessJobId,
              webhookResponse: (
                config as {
                  webhookResponse?: {
                    mode: "passthrough" | "template" | "confirmation";
                    template?: string;
                    successMessage?: string;
                  };
                }
              ).webhookResponse,
              workflow_data: workflowData,
            });
          }
        }}
      />

      {/* Activity Drawer - shows job runs and events */}
      {currentJobId && (
        <ActivityDrawer
          runs={
            // Show optimistic "starting" run immediately when initiating
            isInitiating && !currentRunId
              ? [
                  {
                    id: "optimistic-run",
                    status: "pending",
                    created_at: new Date().toISOString(),
                  } as Run,
                  ...runs,
                ]
              : runs
          }
          currentRunId={
            currentRunId || (isInitiating ? "optimistic-run" : null)
          }
          isRunning={!!currentRunId || isInitiating}
          onSelectRun={(run) => {
            // Don't allow selecting the optimistic run
            if (run.id === "optimistic-run") return;
            setSelectedRun(run);
            setJobPanelInitialTab("runs");
            setShowJobDetailsPanel(true);
          }}
        />
      )}
    </div>
  );
}
