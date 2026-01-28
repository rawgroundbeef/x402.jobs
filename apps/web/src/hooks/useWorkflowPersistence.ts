"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Node, Edge } from "@xyflow/react";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";
import useSWR from "swr";

const LOCAL_STORAGE_KEY = "x402-workflow-draft";
const DEBOUNCE_MS = 1000;

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

interface WorkflowState {
  jobId: string | null;
  jobName: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: WorkflowViewport;
  savedAt?: number; // timestamp of last DB save
  localAt?: number; // timestamp of last local save
}

export type NetworkType = "solana" | "base";

export interface SavedJob {
  id: string;
  display_id?: number;
  name: string;
  slug?: string;
  network?: NetworkType;
  workflow_data?: {
    nodes: Node[];
    edges: Edge[];
    viewport?: WorkflowViewport;
  };
  updated_at?: string;
  created_at: string;
  description?: string;
  trigger_type?: string;
  trigger_methods?: { manual: boolean; webhook: boolean; schedule?: boolean };
  creator_markup?: number;
  output_type?: string;
  is_active?: boolean;
  last_run_at?: string;
}

// Get draft from localStorage
function getLocalDraft(): WorkflowState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Save draft to localStorage
function saveLocalDraft(state: WorkflowState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        ...state,
        localAt: Date.now(),
      }),
    );
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

// Clear localStorage draft
function clearLocalDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

// Sanitize nodes when loading - clear runtime state (output results, execution status)
function sanitizeNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.type === "output") {
      // Clear output result and loading state - these are runtime state from runs
      return {
        ...node,
        data: {
          ...node.data,
          result: null,
          isLoading: false,
        },
      };
    }
    if (node.type === "resource" || node.type === "transform") {
      // Clear execution status - it's runtime state from runs
      const { executionStatus: _executionStatus, ...restData } = (node.data ||
        {}) as Record<string, unknown>;
      return {
        ...node,
        data: restData,
      };
    }
    return node;
  });
}

// Initial job type (from useJobQuery)
interface InitialJob {
  id: string;
  name: string;
  network?: "solana" | "base";
  display_id?: number;
  trigger_type?: string;
  trigger_methods?: { manual: boolean; webhook: boolean; schedule?: boolean };
  creator_markup?: number;
  workflow_definition?: {
    nodes?: unknown[];
    edges?: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
}

export function useWorkflowPersistence(
  nodes: Node[],
  edges: Edge[],
  jobName: string,
  viewport: WorkflowViewport | undefined,
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void,
  setJobName: (name: string) => void,
  setViewport: (viewport: WorkflowViewport | undefined) => void,
  isAuthenticated: boolean = true,
  initialJob?: InitialJob,
) {
  const [jobId, setJobId] = useState<string | null>(initialJob?.id || null);
  const [displayId, setDisplayId] = useState<number | null>(
    initialJob?.display_id || null,
  );
  const [network, setNetwork] = useState<NetworkType>(
    initialJob?.network || "solana",
  );
  const [triggerType, setTriggerType] = useState<string>(
    initialJob?.trigger_type || "manual",
  );
  const [triggerMethods, setTriggerMethods] = useState<{
    manual: boolean;
    webhook: boolean;
    schedule?: boolean;
  }>(
    initialJob?.trigger_methods || {
      manual: true,
      webhook: false,
      schedule: false,
    },
  );
  const [creatorMarkup, setCreatorMarkup] = useState<number>(
    initialJob?.creator_markup || 0,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialJob); // Not loading if we have initial job
  const lastSavedRef = useRef<string>("");
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedRef = useRef(!!initialJob); // Already initialized if we have initial job
  const initialJobRef = useRef(initialJob); // Track initial job to avoid re-initialization

  // Ref to always have latest nodes - avoids stale closure in saveToDatabase
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  // Keep refs in sync
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Initialize from initialJob on first render
  useEffect(() => {
    if (!initialJob || initialJobRef.current !== initialJob) return;

    // Already set via useState defaults, but need to initialize nodes/edges/viewport
    const workflowData = initialJob.workflow_definition || {};
    const hasNodes =
      workflowData.nodes && (workflowData.nodes as unknown[]).length > 0;

    // Debug: log output node data including outputConfig
    if (hasNodes) {
      const outputNodes = (workflowData.nodes as Node[]).filter(
        (n) => n.type === "output",
      );
      console.log(
        "[WorkflowPersistence] Loading output nodes:",
        outputNodes.map((n) => ({ id: n.id, data: n.data })),
      );
    }

    if (hasNodes) {
      setNodes(sanitizeNodes(workflowData.nodes as Node[]));
    }
    if (workflowData.edges) {
      setEdges(workflowData.edges as Edge[]);
    }
    if (workflowData.viewport) {
      setViewport(workflowData.viewport as WorkflowViewport);
    }

    setJobName(initialJob.name);

    // Set last saved state to match initial job
    lastSavedRef.current = JSON.stringify({
      nodes: workflowData.nodes || [],
      edges: workflowData.edges || [],
      jobName: initialJob.name,
      viewport: workflowData.viewport,
    });
    setHasUnsavedChanges(false);
    setIsLoading(false);
  }, [initialJob, setNodes, setEdges, setJobName, setViewport]);

  // Fetch user's jobs (only if authenticated)
  const { data: jobsData, mutate: mutateJobs } = useSWR<{ jobs: SavedJob[] }>(
    isAuthenticated ? "/jobs" : null,
    authenticatedFetcher,
    { revalidateOnFocus: false },
  );

  // Generate a hash of current state for comparison
  const getStateHash = useCallback(() => {
    return JSON.stringify({ nodes, edges, jobName, viewport });
  }, [nodes, edges, jobName, viewport]);

  // Check if current state differs from last saved
  useEffect(() => {
    const currentHash = getStateHash();
    setHasUnsavedChanges(currentHash !== lastSavedRef.current);
  }, [getStateHash]);

  // Clean nodes for saving - strip runtime data that shouldn't be persisted
  const cleanNodesForSave = useCallback((nodesToClean: Node[]) => {
    return nodesToClean.map((node) => {
      // Strip runtime data from node.data
      if (node.type === "output") {
        // Create a completely new data object without result
        const {
          result: _result,
          isLoading: _isLoading,
          ...restData
        } = (node.data || {}) as Record<string, unknown>;
        return {
          ...node,
          data: {
            ...restData,
            result: null,
            isLoading: false,
          },
        };
      } else if (node.type === "resource" || node.type === "transform") {
        // Remove executionStatus - it's runtime state
        const { executionStatus: _executionStatus, ...restData } = (node.data ||
          {}) as Record<string, unknown>;
        return {
          ...node,
          data: restData,
        };
      }

      return node;
    });
  }, []);

  // Auto-save to localStorage (debounced) - clean nodes before saving
  useEffect(() => {
    if (isLoading) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      // Clean nodes before saving to localStorage too
      const cleanedNodes = cleanNodesForSave(nodes);
      saveLocalDraft({
        jobId,
        jobName,
        nodes: cleanedNodes,
        edges,
        viewport,
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [nodes, edges, jobName, jobId, viewport, isLoading, cleanNodesForSave]);

  // Handle auth state changes
  useEffect(() => {
    if (!isAuthenticated) {
      // Not authenticated - stop loading and clear state
      setIsLoading(false);
      setJobId(null);
      setJobName("");
      hasInitializedRef.current = false; // Reset so next login loads properly
      return;
    }

    // If we already have an initial job (e.g., deep link /jobs/[id]),
    // we should not block the UI waiting for the jobs list.
    if (initialJobRef.current) {
      setIsLoading(false);
      return;
    }

    // Authenticated without an initial job: wait for jobs list to load.
    setIsLoading(true);
  }, [isAuthenticated, setJobName]);

  // Initial load - from localStorage draft or most recent job
  useEffect(() => {
    if (!isAuthenticated || !jobsData) return;

    // Skip if we've already initialized (prevents overwriting state after job creation)
    if (hasInitializedRef.current) return;

    const loadWorkflow = async () => {
      setIsLoading(true);
      hasInitializedRef.current = true;

      // First check localStorage for a draft
      const localDraft = getLocalDraft();

      // Get the most recent job from DB
      const jobs = jobsData.jobs || [];
      const mostRecentJob = jobs[0]; // Already sorted by updated_at desc

      // Decide what to load
      if (localDraft && localDraft.localAt) {
        // If local draft exists and is newer than the DB job, use it
        const dbUpdatedAt = mostRecentJob
          ? new Date(
              mostRecentJob.updated_at || mostRecentJob.created_at,
            ).getTime()
          : 0;

        if (localDraft.localAt > dbUpdatedAt) {
          // Use local draft
          setJobId(localDraft.jobId);
          setJobName(localDraft.jobName);
          if (localDraft.nodes?.length > 0) {
            setNodes(sanitizeNodes(localDraft.nodes));
          }
          if (localDraft.edges) {
            setEdges(localDraft.edges);
          }
          if (localDraft.viewport) {
            setViewport(localDraft.viewport);
          }
          // Mark as having unsaved changes since it's from local
          lastSavedRef.current = "";
          setIsLoading(false);
          return;
        }
      }

      // Otherwise, load from DB
      if (mostRecentJob) {
        // Load the most recent job
        setJobId(mostRecentJob.id);
        setDisplayId(mostRecentJob.display_id ?? null);
        setJobName(mostRecentJob.name);
        setTriggerType(mostRecentJob.trigger_type || "manual");
        setTriggerMethods(
          mostRecentJob.trigger_methods || {
            manual:
              mostRecentJob.trigger_type !== "webhook" &&
              mostRecentJob.trigger_type !== "schedule",
            webhook: mostRecentJob.trigger_type === "webhook",
            schedule: mostRecentJob.trigger_type === "schedule",
          },
        );
        setCreatorMarkup(mostRecentJob.creator_markup || 0);
        const workflowNodes = sanitizeNodes(
          mostRecentJob.workflow_data?.nodes || [],
        );
        const workflowEdges = mostRecentJob.workflow_data?.edges || [];
        const workflowViewport = mostRecentJob.workflow_data?.viewport;
        if (workflowNodes.length > 0) {
          setNodes(workflowNodes);
        }
        if (workflowEdges.length > 0) {
          setEdges(workflowEdges);
        }
        if (workflowViewport) {
          setViewport(workflowViewport);
        }
        // This is the saved state
        lastSavedRef.current = JSON.stringify({
          nodes: workflowNodes,
          edges: workflowEdges,
          jobName: mostRecentJob.name,
          viewport: workflowViewport,
        });
        clearLocalDraft(); // Clear any old draft
      } else {
        // No jobs - just show empty state (don't auto-create)
        setJobId(null);
        setDisplayId(null);
        setJobName("");
        setNodes([]);
        setEdges([]);
        setViewport(undefined);
        lastSavedRef.current = "";
        clearLocalDraft();
      }

      setIsLoading(false);
    };

    loadWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsData, setNodes, setEdges, setJobName, mutateJobs]);

  // Default nodes for a new job
  const getDefaultNodes = useCallback(
    () => [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {},
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 500, y: 200 },
        data: { result: null, isLoading: false },
      },
    ],
    [],
  );

  // Save to database
  const saveToDatabase = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      // Use refs to get latest nodes/edges - avoids stale closure issue
      // when saveToDatabase is called immediately after setNodes
      const cleanedNodes = cleanNodesForSave(nodesRef.current);
      const workflowData = {
        nodes: cleanedNodes,
        edges: edgesRef.current,
        viewport,
      };

      if (jobId) {
        // Update existing job
        const res = await authenticatedFetch(`/jobs/${jobId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: jobName,
            workflow_data: workflowData,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || data.error || "Failed to update job");
        }
      } else {
        // Create new job
        const res = await authenticatedFetch("/jobs", {
          method: "POST",
          body: JSON.stringify({
            name: jobName,
            workflow_data: workflowData,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to create job");
        }
        if (data.job) {
          setJobId(data.job.id);
        }
      }

      // Update saved reference
      lastSavedRef.current = getStateHash();
      setHasUnsavedChanges(false);

      // Clear local draft since it's now saved
      clearLocalDraft();

      // Refresh jobs list
      mutateJobs();
    } catch (e) {
      console.error("Failed to save:", e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [
    jobId,
    jobName,
    viewport,
    isSaving,
    getStateHash,
    mutateJobs,
    cleanNodesForSave,
  ]);

  // Load a specific job - fetches fresh data from API
  const loadJob = useCallback(
    async (job: SavedJob) => {
      try {
        // Fetch fresh job data to ensure we have latest workflow
        const res = await authenticatedFetch(`/jobs/${job.id}`);
        const data = await res.json();
        const freshJob = data.job;

        if (!freshJob) {
          console.error("Job not found:", job.id);
          return;
        }

        // API returns workflow_definition, map to workflow_data
        const workflowData =
          freshJob.workflow_definition || freshJob.workflow_data || {};

        setJobId(freshJob.id);
        setDisplayId(freshJob.display_id || null);
        setJobName(freshJob.name);
        setNetwork(freshJob.network || "solana");
        setTriggerType(freshJob.trigger_type || "manual");
        setTriggerMethods(
          freshJob.trigger_methods || {
            manual:
              freshJob.trigger_type !== "webhook" &&
              freshJob.trigger_type !== "schedule",
            webhook: freshJob.trigger_type === "webhook",
            schedule: freshJob.trigger_type === "schedule",
          },
        );
        setCreatorMarkup(freshJob.creator_markup || 0);

        // If job has no nodes, use default nodes (backwards compatibility)
        const hasNodes = workflowData.nodes && workflowData.nodes.length > 0;
        const workflowNodes = hasNodes
          ? sanitizeNodes(workflowData.nodes)
          : getDefaultNodes();
        const workflowEdges = workflowData.edges || [];
        const workflowViewport = workflowData.viewport;

        setNodes(workflowNodes);
        setEdges(workflowEdges);
        setViewport(workflowViewport);

        lastSavedRef.current = JSON.stringify({
          nodes: workflowNodes,
          edges: workflowEdges,
          jobName: freshJob.name,
          viewport: workflowViewport,
        });
        setHasUnsavedChanges(false);
        clearLocalDraft();
      } catch (e) {
        console.error("Failed to load job:", e);
      }
    },
    [setNodes, setEdges, setJobName, setViewport, getDefaultNodes],
  );

  // Create a new job, optionally with an initial resource to add
  const createNewJob = useCallback(
    async (
      networkForJob: NetworkType = "solana",
      initialResource?: {
        id: string;
        name: string;
        slug?: string;
        server_slug?: string;
        description?: string;
        resource_url: string;
        network: string;
        max_amount_required?: string;
        extra?: {
          agentName?: string;
          serviceName?: string;
          avatarUrl?: string;
          [key: string]: unknown;
        };
        avatar_url?: string;
        output_schema?: unknown;
      },
      customName?: string, // Optional custom name from the create job form
    ) => {
      // Save current job first if there are unsaved changes
      if (hasUnsavedChanges && jobId) {
        await saveToDatabase();
      }

      const defaultNodes = getDefaultNodes();

      try {
        const res = await authenticatedFetch("/jobs", {
          method: "POST",
          body: JSON.stringify({
            name: customName || "x402job", // Use custom name or placeholder
            network: networkForJob,
            workflow_data: { nodes: defaultNodes, edges: [] }, // Save default nodes!
          }),
        });
        const data = await res.json();
        if (data.job) {
          // If custom name was provided, use it; otherwise use display_id pattern
          const newJobName = customName
            ? customName
            : data.job.display_id
              ? `x402job ${data.job.display_id}`
              : `x402job ${data.job.id.slice(0, 6)}`;

          setJobId(data.job.id);
          setDisplayId(data.job.display_id);
          setJobName(newJobName);
          setNetwork(networkForJob);

          // Update the job name in the database if we generated a name with display_id
          if (!customName) {
            await authenticatedFetch(`/jobs/${data.job.id}`, {
              method: "PUT",
              body: JSON.stringify({ name: newJobName }),
            });
          }

          // Build initial nodes - add resource node if provided
          let initialNodes: Node[] = defaultNodes;
          let initialEdges: Edge[] = [];

          if (initialResource) {
            const triggerNode = defaultNodes.find((n) => n.type === "trigger");
            const outputNode = defaultNodes.find((n) => n.type === "output");

            if (triggerNode && outputNode) {
              const resourceNodeId = `resource-${Date.now()}`;
              const price =
                parseFloat(initialResource.max_amount_required || "0") /
                1_000_000;

              const resourceNode: Node = {
                id: resourceNodeId,
                type: "resource",
                position: { x: 300, y: 200 },
                data: {
                  resource: {
                    id: initialResource.id,
                    name: initialResource.name,
                    slug: initialResource.slug,
                    serverSlug: initialResource.server_slug,
                    displayName:
                      initialResource.extra?.agentName ||
                      initialResource.extra?.serviceName ||
                      initialResource.name,
                    description: initialResource.description,
                    price,
                    avatarUrl:
                      initialResource.avatar_url ||
                      initialResource.extra?.avatarUrl,
                    resourceUrl: initialResource.resource_url,
                    network: initialResource.network,
                    outputSchema: initialResource.output_schema,
                    extra: initialResource.extra,
                  },
                  configuredInputs: {},
                },
              };

              initialNodes = [...defaultNodes, resourceNode];
              initialEdges = [
                {
                  id: `e-trigger-${resourceNodeId}`,
                  source: triggerNode.id,
                  target: resourceNodeId,
                },
                {
                  id: `e-${resourceNodeId}-output`,
                  source: resourceNodeId,
                  target: outputNode.id,
                },
              ];
            }
          }

          // Set nodes in state
          setNodes(initialNodes);
          setEdges(initialEdges);
          setViewport(undefined); // Reset to default (fitView)

          // If we added a resource, save the workflow to DB so it persists
          if (initialResource) {
            await authenticatedFetch(`/jobs/${data.job.id}`, {
              method: "PUT",
              body: JSON.stringify({
                workflow_data: {
                  nodes: initialNodes,
                  edges: initialEdges,
                  viewport: undefined,
                },
              }),
            });
          }

          lastSavedRef.current = JSON.stringify({
            nodes: initialNodes,
            edges: initialEdges,
            jobName: newJobName,
            viewport: undefined,
          });
          clearLocalDraft();
          mutateJobs();

          // Update URL to reflect the new job (so refresh stays on this job)
          window.history.replaceState(null, "", `/jobs/${data.job.id}`);
        }
      } catch (e) {
        console.error("Failed to create new job:", e);
      }
    },
    [
      hasUnsavedChanges,
      jobId,
      saveToDatabase,
      setNodes,
      setEdges,
      setJobName,
      setViewport,
      mutateJobs,
      getDefaultNodes,
    ],
  );

  // Save job name (auto-save on blur, default to x402job {id} if empty)
  // Returns error message if name is taken
  const saveJobName = useCallback(
    async (name: string): Promise<string | null> => {
      if (!jobId) return null;

      // If empty, reset to default
      const finalName =
        name.trim() ||
        (displayId ? `x402job ${displayId}` : `x402job ${jobId.slice(0, 6)}`);

      // Update local state
      setJobName(finalName);

      // Save to database
      try {
        const res = await authenticatedFetch(`/jobs/${jobId}`, {
          method: "PUT",
          body: JSON.stringify({ name: finalName }),
        });
        if (!res.ok) {
          const data = await res.json();
          const errorMsg = data.message || data.error || "Failed to rename job";
          // Revert to previous name if update failed
          mutateJobs();
          return errorMsg;
        }
        mutateJobs();
        return null;
      } catch (e) {
        console.error("Failed to save job name:", e);
        return e instanceof Error ? e.message : "Failed to rename job";
      }
    },
    [jobId, displayId, setJobName, mutateJobs],
  );

  // Clear current job (used when job is deleted)
  const clearJob = useCallback(() => {
    setJobId(null);
    setDisplayId(null);
    setJobName("");
    setNodes([]);
    setEdges([]);
    setViewport(undefined);
    lastSavedRef.current = "";
    setHasUnsavedChanges(false);
    hasInitializedRef.current = false; // Allow initial load to run again
    clearLocalDraft();
  }, [setNodes, setEdges, setJobName, setViewport]);

  // Save current workflow as a new job (Save As)
  const saveAsNewJob = useCallback(
    async (newName: string) => {
      setIsSaving(true);

      try {
        // Clean nodes before saving - strip runtime data
        const cleanedNodes = cleanNodesForSave(nodes);
        const workflowData = { nodes: cleanedNodes, edges, viewport };

        // Create new job with current workflow
        const res = await authenticatedFetch("/jobs", {
          method: "POST",
          body: JSON.stringify({
            name: newName,
            workflow_data: workflowData,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to create job");
        }

        if (data.job) {
          // Switch to the new job
          setJobId(data.job.id);
          setDisplayId(data.job.display_id || null);
          setJobName(newName);

          // Mark as saved
          lastSavedRef.current = JSON.stringify({
            nodes,
            edges,
            jobName: newName,
            viewport,
          });
          setHasUnsavedChanges(false);
          clearLocalDraft();

          // Refresh jobs list
          mutateJobs();

          return data.job;
        }
      } catch (e) {
        console.error("Failed to save as new job:", e);
        throw e;
      } finally {
        setIsSaving(false);
      }
    },
    [nodes, edges, viewport, setJobName, mutateJobs, cleanNodesForSave],
  );

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but we still need to set returnValue
      e.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    jobId,
    displayId,
    network,
    setNetwork,
    triggerType,
    triggerMethods,
    creatorMarkup,
    hasUnsavedChanges,
    isSaving,
    isLoading,
    saveToDatabase,
    saveAsNewJob,
    saveJobName,
    loadJob,
    createNewJob,
    clearJob,
    jobs: jobsData?.jobs || [],
    mutateJobs, // expose for refreshing after delete
  };
}
