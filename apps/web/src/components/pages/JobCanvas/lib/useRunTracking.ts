"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Node, Edge } from "@xyflow/react";
import { authenticatedFetch } from "@/lib/api";
import type { Run, RunEvent } from "@/types/runs";
import {
  useWebSocket,
  RunStartedEvent,
  RunStepEvent,
  RunCompletedEvent,
} from "@/hooks/useWebSocket";
// x402.storage upload is now handled by the backend (post-to-destinations.ts)

type ExecutionStatus = "idle" | "pending" | "running" | "completed" | "failed";

interface UseRunTrackingOptions {
  currentJobId: string | null;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
}

interface UseRunTrackingResult {
  currentRunId: string | null;
  isInitiating: boolean;
  viewingRunId: string | null;
  setCurrentRunId: (id: string | null) => void;
  setIsInitiating: (value: boolean) => void;
  setViewingRunId: (id: string | null) => void;
  startTracking: (runId: string) => void;
  handleCancelRun: () => Promise<void>;
  handleSelectRun: (run: Run, events: RunEvent[]) => void;
}

/**
 * Hook for tracking workflow runs via WebSocket
 */
export function useRunTracking({
  currentJobId,
  setNodes,
  edges,
}: UseRunTrackingOptions): UseRunTrackingResult {
  const [currentRunId, setCurrentRunIdState] = useState<string | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);

  // Ref to avoid stale closures in WS handlers
  const currentRunIdRef = useRef<string | null>(null);

  // Custom setter that updates both state and ref
  const setCurrentRunId = useCallback((id: string | null) => {
    currentRunIdRef.current = id;
    setCurrentRunIdState(id);
  }, []);

  const { isAvailable: wsAvailable, subscribe } = useWebSocket();

  // Check if x402.storage destination is enabled
  const hasX402StorageEnabled = useCallback((nds: Node[]) => {
    return nds
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
  }, []);

  // Reset all nodes to pending state
  const resetNodesToPending = useCallback(() => {
    console.log("[RunTracking] Resetting nodes to pending");
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === "resource" || node.type === "transform") {
          return {
            ...node,
            data: { ...node.data, executionStatus: "pending" },
          };
        }
        if (node.type === "output") {
          return {
            ...node,
            data: { ...node.data, result: null, isLoading: true },
          };
        }
        return node;
      }),
    );
  }, [setNodes]);

  // Reset all nodes to idle state
  const resetNodesToIdle = useCallback(() => {
    console.log("[RunTracking] Resetting nodes to idle");
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === "resource" || node.type === "transform") {
          return {
            ...node,
            data: { ...node.data, executionStatus: "idle" },
          };
        }
        // Also reset output nodes that are still loading
        if (node.type === "output") {
          const isLoading = (node.data as { isLoading?: boolean })?.isLoading;
          const existingResult = (node.data as { result?: unknown })?.result;
          if (isLoading) {
            return {
              ...node,
              data: {
                ...node.data,
                isLoading: false,
                // If no result yet, show completion message
                result: existingResult || "✅ Run completed (no output)",
              },
            };
          }
        }
        return node;
      }),
    );
  }, [setNodes]);

  // Update a specific node's status
  const updateNodeStatus = useCallback(
    (nodeId: string, status: ExecutionStatus, output?: unknown) => {
      console.log("[RunTracking] Updating node:", nodeId, "status:", status);
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, executionStatus: status },
            };
          }
          // Update output nodes that source from this node (supports fan-in)
          if (node.type === "output") {
            // Find ALL edges feeding into this output node
            const incomingEdges = edges.filter((e) => e.target === node.id);
            const isSourceOfThisOutput = incomingEdges.some(
              (e) => e.source === nodeId,
            );
            if (isSourceOfThisOutput && output !== undefined) {
              // Get existing combined output or start fresh
              const existingResult = (node.data as { result?: string })?.result;
              let combinedOutput: Record<string, unknown> = {};

              // Try to parse existing result as combined output
              if (existingResult && existingResult.startsWith("{")) {
                try {
                  combinedOutput = JSON.parse(existingResult);
                } catch {
                  // Not valid JSON, start fresh
                }
              }

              // Add this node's output to the combined output
              combinedOutput[nodeId] = output;

              const outputText = JSON.stringify(combinedOutput);
              return {
                ...node,
                data: { ...node.data, result: outputText, isLoading: false },
              };
            }
          }
          return node;
        }),
      );
    },
    [setNodes, edges],
  );

  // Start tracking a run
  const startTracking = useCallback(
    (runId: string) => {
      console.log("[RunTracking] Starting to track run:", runId);
      setCurrentRunId(runId);
      resetNodesToPending();
    },
    [setCurrentRunId, resetNodesToPending],
  );

  // Cancel current run
  const handleCancelRun = useCallback(async () => {
    if (currentRunIdRef.current) {
      try {
        await authenticatedFetch(`/runs/${currentRunIdRef.current}/cancel`, {
          method: "POST",
        });
      } catch (err) {
        console.error("Failed to cancel run:", err);
      }
    }
    setCurrentRunId(null);
    setIsInitiating(false);
    resetNodesToIdle();
  }, [setCurrentRunId, resetNodesToIdle]);

  // View historical run
  const handleSelectRun = useCallback(
    (run: Run, events: RunEvent[]) => {
      const nodeStatusMap: Record<string, ExecutionStatus> = {};
      const nodeOutputMap: Record<string, unknown> = {};

      for (const event of events) {
        if (event.node_id) {
          nodeStatusMap[event.node_id] = event.status as ExecutionStatus;
          if (event.status === "completed" && event.output !== undefined) {
            nodeOutputMap[event.node_id] = event.output;
          }
        }
      }

      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === "resource" || node.type === "transform") {
            return {
              ...node,
              data: {
                ...node.data,
                executionStatus: nodeStatusMap[node.id] || "idle",
              },
            };
          }
          if (node.type === "output") {
            // Find ALL edges feeding into this output node (fan-in support)
            const incomingEdges = edges.filter((e) => e.target === node.id);

            // Collect outputs from all source nodes
            const combinedOutput: Record<string, unknown> = {};
            for (const edge of incomingEdges) {
              const sourceOutput = nodeOutputMap[edge.source];
              if (sourceOutput !== undefined) {
                combinedOutput[edge.source] = sourceOutput;
              }
            }

            // Show meaningful message for empty/null outputs
            const hasOutputs = Object.keys(combinedOutput).length > 0;
            let resultText: string | null;
            if (!hasOutputs) {
              resultText = null; // No output recorded
            } else if (Object.keys(combinedOutput).length === 1) {
              // Single source - show its output directly
              const singleOutput = Object.values(combinedOutput)[0];
              resultText =
                singleOutput === null
                  ? "⚠️ No output (null)"
                  : typeof singleOutput === "string"
                    ? singleOutput
                    : JSON.stringify(singleOutput);
            } else {
              // Multiple sources - show combined object
              resultText = JSON.stringify(combinedOutput);
            }

            return {
              ...node,
              data: {
                ...node.data,
                result: resultText,
                isLoading: false,
              },
            };
          }
          return node;
        }),
      );

      setViewingRunId(events.length > 0 ? "historical" : null);
    },
    [setNodes, edges],
  );

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!wsAvailable || !currentJobId) {
      console.log("[RunTracking] WS not available or no jobId");
      return;
    }

    console.log(
      "[RunTracking] Setting up WS subscriptions for job:",
      currentJobId,
    );

    // run:started - new run began (manual, webhook, schedule, or chained)
    const unsubStarted = subscribe<RunStartedEvent>("run:started", (event) => {
      console.log("[RunTracking] run:started event:", event);
      if (event.jobId !== currentJobId) {
        console.log("[RunTracking] Ignoring - wrong job");
        return;
      }
      console.log(
        "[RunTracking] Starting to track chained/new run:",
        event.runId,
      );
      currentRunIdRef.current = event.runId;
      setCurrentRunIdState(event.runId);
      resetNodesToPending();
    });

    // run:step - a step started, completed, or failed
    const unsubStep = subscribe<RunStepEvent>("run:step", (event) => {
      console.log("[RunTracking] run:step event:", event);
      if (event.runId !== currentRunIdRef.current) {
        console.log("[RunTracking] Ignoring step - wrong run");
        return;
      }
      // Map event status to our ExecutionStatus type
      let status: ExecutionStatus;
      if (event.status === "completed") {
        status = "completed";
      } else if (event.status === "failed") {
        status = "failed";
      } else if (event.status === "running") {
        status = "running";
      } else {
        status = "pending";
      }
      updateNodeStatus(event.nodeId, status, event.output);
    });

    // run:completed - entire run finished
    const unsubCompleted = subscribe<RunCompletedEvent>(
      "run:completed",
      (event) => {
        console.log("[RunTracking] run:completed event:", event);
        if (event.runId !== currentRunIdRef.current) {
          console.log("[RunTracking] Ignoring completed - wrong run");
          return;
        }

        // If run failed, immediately reset and show error
        if (event.status === "failed") {
          console.log("[RunTracking] Run failed:", event.error);
          setCurrentRunId(null);
          // Show error on output nodes that don't already have a result
          // This preserves successful outputs so user can debug what happened
          setNodes((nds) =>
            nds.map((node) => {
              if (node.type === "output") {
                const existingResult = (node.data as { result?: unknown })
                  ?.result;
                // Only show error if no result yet (still loading/pending)
                if (
                  !existingResult ||
                  existingResult === null ||
                  existingResult === ""
                ) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      result: `❌ Run failed: ${event.error || "Unknown error"}`,
                      isLoading: false,
                    },
                  };
                }
                // Preserve existing result, just stop loading
                return {
                  ...node,
                  data: {
                    ...node.data,
                    isLoading: false,
                  },
                };
              }
              if (node.type === "resource" || node.type === "transform") {
                return {
                  ...node,
                  data: { ...node.data, executionStatus: "idle" },
                };
              }
              return node;
            }),
          );
          return;
        }

        // NOTE: x402.storage upload is now handled by the backend in post-to-destinations.ts
        // The frontend upload code below is disabled but kept for reference
        if (event.status === "completed" || event.status === "success") {
          // Storage upload handled by backend - no frontend action needed
          // The backend stores the URL in x402_job_runs.x402_storage_url
          /*
          // Get current nodes to check config
          setNodes((currentNodes) => {
            const storageEnabled = hasX402StorageEnabled(currentNodes);

            if (storageEnabled) {
              // Find output node and its result
              const outputNode = currentNodes.find((n) => n.type === "output");
              const outputResult = (outputNode?.data as { result?: string })?.result;

              if (outputResult) {
                // Fire-and-forget storage upload (don't block completion)
                uploadToStorage(outputResult).then((storageResult) => {
                  // Update output node with storage result
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.type === "output") {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            x402storageUrls: [storageResult],
                            x402storageError: storageResult.success ? undefined : storageResult.error,
                          },
                        };
                      }
                      return node;
                    })
                  );
                }).catch((err) => {
                  console.error("[RunTracking] Storage upload failed:", err);
                  // Update with error state
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.type === "output") {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            x402storageUrls: [],
                            x402storageError: err.message || "Storage upload failed",
                          },
                        };
                      }
                      return node;
                    })
                  );
                });
              }
            }
            return currentNodes; // Return unchanged for this setNodes call
          });
          */
        }

        // Wait for potential chained run:started, then reset if none comes
        setTimeout(() => {
          if (currentRunIdRef.current === event.runId) {
            console.log("[RunTracking] No chain detected, resetting to idle");
            setCurrentRunId(null);
            resetNodesToIdle();
          }
        }, 3000);
      },
    );

    return () => {
      console.log("[RunTracking] Cleaning up WS subscriptions");
      unsubStarted();
      unsubStep();
      unsubCompleted();
    };
  }, [
    wsAvailable,
    currentJobId,
    subscribe,
    setCurrentRunId,
    resetNodesToPending,
    resetNodesToIdle,
    updateNodeStatus,
    hasX402StorageEnabled,
    setNodes,
  ]);

  return {
    currentRunId,
    isInitiating,
    viewingRunId,
    setCurrentRunId,
    setIsInitiating,
    setViewingRunId,
    startTracking,
    handleCancelRun,
    handleSelectRun,
  };
}
