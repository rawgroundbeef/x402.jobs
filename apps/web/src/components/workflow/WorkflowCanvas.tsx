"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useMemo,
  useState,
} from "react";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
  OnNodesChange,
  OnEdgesChange,
  Viewport,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Square, Loader2, Save, ChevronDown } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Dropdown, DropdownItem } from "@x402jobs/ui/dropdown";

import {
  TriggerNode,
  type TriggerMethods,
  type ScheduleConfig,
} from "./nodes/TriggerNode";
import { MemeputerBadge } from "../MemeputerBadge";
import { ResourceNode } from "./nodes/ResourceNode";
import { TransformNode, type TransformType } from "./nodes/TransformNode";
import { OutputNode } from "./nodes/OutputNode";
import { SourceNode, type SourceType } from "./nodes/SourceNode";
import { NodeContextMenu } from "./NodeContextMenu";

import type { ConfiguredInputs } from "@/components/modals/ResourceConfigModal";

// Type for clipboard data
interface ClipboardNode {
  type: string;
  data: Record<string, unknown>;
}

// Type for context menu state
interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  nodeType?: string;
}

// Resource type for adding to canvas
export interface CanvasResource {
  id: string;
  name: string;
  slug?: string;
  server_slug?: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  output_schema?: {
    input?: {
      method?: string;
      bodyFields?: Record<
        string,
        {
          type: string;
          required?: boolean;
          description?: string;
        }
      >;
      queryParams?: Record<
        string,
        {
          type: string;
          required?: boolean;
          description?: string;
        }
      >;
    };
  };
  extra?: {
    serviceName?: string;
    agentName?: string;
    avatarUrl?: string;
    pricing?: { amount?: number };
  };
  // Prompt template parameters
  pt_parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
}

// Expose methods via ref
export interface WorkflowCanvasRef {
  addResource: (resource: CanvasResource) => void;
  addTrigger: () => void;
  addTransform: (type?: TransformType) => void;
  addOutput: () => void;
  addSource: (sourceType: SourceType) => void;
  updateResourceConfig: (
    nodeId: string,
    configuredInputs: ConfiguredInputs,
  ) => void;
  getUpstreamNodes: (
    nodeId: string,
  ) => { id: string; name: string; type: string }[];
}

// Custom node types
const nodeTypes = {
  trigger: TriggerNode,
  resource: ResourceNode,
  transform: TransformNode,
  output: OutputNode,
  source: SourceNode,
};

// Initial nodes
export const getInitialNodes = (): Node[] => [
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
];

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export type TriggerType = "manual" | "webhook" | "schedule";

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  viewport?: WorkflowViewport;
  onViewportChange?: (viewport: WorkflowViewport) => void;
  onRun?: (triggerId?: string) => void;
  onCancel?: () => void;
  onAddResource?: () => void;
  onConfigureResource?: (nodeId: string) => void;
  onConfigureTransform?: (nodeId: string) => void;
  onConfigureSource?: (nodeId: string) => void;
  onConfigureTrigger?: () => void;
  onConfigureOutput?: (nodeId: string) => void;
  onViewOutput?: (result: string | null | undefined, nodeId?: string) => void;
  isRunning?: boolean;
  isInitiating?: boolean;
  triggerType?: TriggerType;
  triggerMethods?: TriggerMethods;
  scheduleConfig?: ScheduleConfig;
  scheduleNextRunAt?: string; // ISO timestamp of next scheduled run
  // Save functionality
  onSave?: () => void;
  onSaveAs?: () => void;
  onExportJson?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

// Inner component that uses React Flow hooks
const WorkflowCanvasInner = forwardRef<WorkflowCanvasRef, WorkflowCanvasProps>(
  function WorkflowCanvasInner(
    {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      setNodes,
      setEdges,
      viewport,
      onViewportChange,
      onRun,
      onCancel,
      onAddResource,
      onConfigureResource,
      onConfigureTransform,
      onConfigureSource,
      onConfigureTrigger,
      onConfigureOutput,
      onViewOutput,
      isRunning,
      isInitiating,
      triggerType = "manual",
      triggerMethods,
      scheduleConfig,
      scheduleNextRunAt,
      onSave,
      onSaveAs,
      onExportJson,
      isSaving,
      hasUnsavedChanges,
    },
    ref,
  ) {
    // Use refs for stable callback references to avoid infinite loops
    const onRunRef = useRef(onRun);
    const onCancelRef = useRef(onCancel);
    const onAddResourceRef = useRef(onAddResource);
    const onConfigureResourceRef = useRef(onConfigureResource);
    const onConfigureTransformRef = useRef(onConfigureTransform);
    const onConfigureSourceRef = useRef(onConfigureSource);
    const onConfigureTriggerRef = useRef(onConfigureTrigger);
    const onConfigureOutputRef = useRef(onConfigureOutput);
    const onViewOutputRef = useRef(onViewOutput);
    const setNodesRef = useRef(setNodes);
    const setEdgesRef = useRef(setEdges);
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);

    // Keep refs updated
    useEffect(() => {
      onRunRef.current = onRun;
      onCancelRef.current = onCancel;
      onAddResourceRef.current = onAddResource;
      onConfigureResourceRef.current = onConfigureResource;
      onConfigureTransformRef.current = onConfigureTransform;
      onConfigureSourceRef.current = onConfigureSource;
      onConfigureTriggerRef.current = onConfigureTrigger;
      onConfigureOutputRef.current = onConfigureOutput;
      onViewOutputRef.current = onViewOutput;
      setNodesRef.current = setNodes;
      setEdgesRef.current = setEdges;
      nodesRef.current = nodes;
      edgesRef.current = edges;
    });

    // Get React Flow instance for viewport calculations
    const reactFlowInstance = useReactFlow();

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
      null,
    );
    const [clipboard, setClipboard] = useState<ClipboardNode | null>(null);
    const contextMenuPositionRef = useRef<{ x: number; y: number } | null>(
      null,
    );

    // Helper to get the center of the current viewport in flow coordinates
    const getViewportCenter = useCallback(() => {
      const { x, y, zoom } = reactFlowInstance.getViewport();
      // Get the container dimensions
      const container = document.querySelector(".react-flow");
      if (!container) {
        return { x: 300, y: 200 }; // Fallback position
      }
      const { width, height } = container.getBoundingClientRect();

      // Convert screen center to flow coordinates
      // The viewport x, y represents the offset of the flow origin from the container origin
      // Negative x means the flow is shifted right, so the visible area is more to the right
      const centerX = (-x + width / 2) / zoom;
      const centerY = (-y + height / 2) / zoom;

      return { x: centerX, y: centerY };
    }, [reactFlowInstance]);

    // Stable delete function using ref
    const deleteNode = useCallback((nodeId: string) => {
      setNodesRef.current((nds: Node[]) => nds.filter((n) => n.id !== nodeId));
      setEdgesRef.current((eds: Edge[]) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
    }, []);

    // Stable run function using ref - accepts optional triggerId for specific trigger runs
    const handleRun = useCallback((triggerId?: string) => {
      onRunRef.current?.(triggerId);
    }, []);

    // Stable cancel function using ref
    const handleCancel = useCallback(() => {
      onCancelRef.current?.();
    }, []);

    // Stable configure function using ref
    const handleConfigure = useCallback((nodeId: string) => {
      onConfigureResourceRef.current?.(nodeId);
    }, []);

    // Stable configure transform function using ref
    const handleConfigureTransform = useCallback((nodeId: string) => {
      onConfigureTransformRef.current?.(nodeId);
    }, []);

    // Stable configure source function using ref
    const handleConfigureSource = useCallback((nodeId: string) => {
      onConfigureSourceRef.current?.(nodeId);
    }, []);

    // Stable view output function using ref
    const handleViewOutput = useCallback(
      (result: string | null | undefined, nodeId?: string) => {
        onViewOutputRef.current?.(result, nodeId);
      },
      [],
    );

    // Stable configure trigger function using ref
    const handleConfigureTrigger = useCallback(() => {
      onConfigureTriggerRef.current?.();
    }, []);

    // Stable configure output function using ref
    const handleConfigureOutput = useCallback((nodeId: string) => {
      onConfigureOutputRef.current?.(nodeId);
    }, []);

    // Context menu handlers
    const handleNodeContextMenu: NodeMouseHandler = useCallback(
      (event, node) => {
        event.preventDefault();
        // Store the flow position for potential paste
        contextMenuPositionRef.current = reactFlowInstance.screenToFlowPosition(
          {
            x: event.clientX,
            y: event.clientY,
          },
        );
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          nodeId: node.id,
          nodeType: node.type,
        });
      },
      [reactFlowInstance],
    );

    const handlePaneContextMenu = useCallback(
      (event: MouseEvent | React.MouseEvent) => {
        event.preventDefault();
        // Store the flow position for paste
        contextMenuPositionRef.current = reactFlowInstance.screenToFlowPosition(
          {
            x: event.clientX,
            y: event.clientY,
          },
        );
        // Only show pane context menu if we have something to paste
        if (clipboard) {
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
          });
        }
      },
      [reactFlowInstance, clipboard],
    );

    const closeContextMenu = useCallback(() => {
      setContextMenu(null);
    }, []);

    // Copy node to clipboard
    const handleCopyNode = useCallback(() => {
      if (!contextMenu?.nodeId) return;
      const node = nodesRef.current.find((n) => n.id === contextMenu.nodeId);
      if (!node) return;

      // Clone the node data (without callbacks)
      const {
        onDelete: _onDelete,
        onConfigure: _onConfigure,
        ...cleanData
      } = node.data as Record<string, unknown>;
      setClipboard({
        type: node.type || "resource",
        data: cleanData,
      });
    }, [contextMenu?.nodeId]);

    // Paste node from clipboard
    const handlePasteNode = useCallback(() => {
      if (!clipboard) return;

      const position = contextMenuPositionRef.current || getViewportCenter();

      const timestamp = Date.now();
      const newNodeId = `${clipboard.type}-${timestamp}`;

      // Clone the data and generate new ID for nested resource if present
      const clonedData = JSON.parse(JSON.stringify(clipboard.data));

      const newNode: Node = {
        id: newNodeId,
        type: clipboard.type,
        position: { x: position.x - 80, y: position.y - 40 },
        data: {
          ...clonedData,
          // Clear any references that would be invalid
          configuredInputs: {},
        },
      };

      setNodesRef.current((nds: Node[]) => [...nds, newNode]);
    }, [clipboard, getViewportCenter]);

    // Keyboard shortcuts for copy/paste
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Check if user is typing in an input/textarea or Monaco Editor
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest(".monaco-editor")
        ) {
          return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        const modKey = isMac ? event.metaKey : event.ctrlKey;

        if (modKey && event.key === "c") {
          // Copy selected node
          const selectedNode = nodesRef.current.find((n) => n.selected);
          if (
            selectedNode &&
            selectedNode.type !== "trigger" &&
            selectedNode.type !== "output"
          ) {
            event.preventDefault();
            const {
              onDelete: _onDelete,
              onConfigure: _onConfigure,
              ...cleanData
            } = selectedNode.data as Record<string, unknown>;
            setClipboard({
              type: selectedNode.type || "resource",
              data: cleanData,
            });
          }
        } else if (modKey && event.key === "v") {
          // Paste
          if (clipboard) {
            event.preventDefault();
            const center = getViewportCenter();
            const timestamp = Date.now();
            const newNodeId = `${clipboard.type}-${timestamp}`;
            const clonedData = JSON.parse(JSON.stringify(clipboard.data));

            const newNode: Node = {
              id: newNodeId,
              type: clipboard.type,
              position: { x: center.x - 80, y: center.y - 40 },
              data: {
                ...clonedData,
                configuredInputs: {},
              },
            };

            setNodesRef.current((nds: Node[]) => [...nds, newNode]);
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [clipboard, getViewportCenter]);

    // Get nodes that can provide input to a given node (upstream resources, transforms, and trigger)
    const getUpstreamNodes = useCallback((nodeId: string) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      // Find all edges that target this node
      const incomingEdges = currentEdges.filter((e) => e.target === nodeId);
      const sourceNodeIds = incomingEdges.map((e) => e.source);

      // Get the source nodes (resources, transforms, and sources can provide output)
      const upstreamNodes = currentNodes
        .filter(
          (n) =>
            sourceNodeIds.includes(n.id) &&
            (n.type === "resource" ||
              n.type === "transform" ||
              n.type === "source"),
        )
        .map((n) => {
          if (n.type === "transform") {
            const transformData = n.data as {
              transformType?: string;
              label?: string;
            };
            // Use label if available, otherwise fall back to type-based name
            const name =
              transformData.label ||
              `Transform (${transformData.transformType || "transform"})`;
            return {
              id: n.id,
              name,
              type: "transform",
            };
          }
          if (n.type === "source") {
            const sourceType =
              (n.data as { sourceType?: string })?.sourceType || "source";
            const sourceLabels: Record<string, string> = {
              job_history: "Job History",
              url_fetch: "URL Fetch",
            };
            return {
              id: n.id,
              name: `Source (${sourceLabels[sourceType] || sourceType})`,
              type: "source",
            };
          }
          return {
            id: n.id,
            name:
              (n.data as { resource?: { name?: string } })?.resource?.name ||
              "Resource",
            type: n.type || "resource",
          };
        });

      // Also add the trigger node if it has workflowInputs defined
      // This allows any node to reference trigger inputs
      const triggerNode = currentNodes.find((n) => n.type === "trigger");
      if (triggerNode) {
        const workflowInputs = (
          triggerNode.data as { workflowInputs?: { name: string }[] }
        )?.workflowInputs;
        if (workflowInputs && workflowInputs.length > 0) {
          upstreamNodes.unshift({
            id: triggerNode.id,
            name: "Job Parameters",
            type: "trigger",
          });
        }
      }

      return upstreamNodes;
    }, []);

    // Update a resource node's configured inputs
    const updateResourceConfig = useCallback(
      (nodeId: string, configuredInputs: ConfiguredInputs) => {
        setNodesRef.current((nds: Node[]) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, configuredInputs } }
              : node,
          ),
        );
      },
      [],
    );

    const onConnect = useCallback((params: Connection) => {
      setEdgesRef.current((eds: Edge[]) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
          eds,
        ),
      );
    }, []);

    // Add a trigger node
    const addTrigger = useCallback(() => {
      const center = getViewportCenter();
      setNodesRef.current((nds: Node[]) => {
        const newNode: Node = {
          id: `trigger-${Date.now()}`,
          type: "trigger",
          position: { x: center.x - 80, y: center.y - 60 }, // Offset to center the node
          data: { onRun: handleRun, onDelete: deleteNode },
        };
        return [...nds, newNode];
      });
    }, [handleRun, deleteNode, getViewportCenter]);

    // Add an output node
    const addOutput = useCallback(() => {
      const center = getViewportCenter();
      setNodesRef.current((nds: Node[]) => {
        const newNode: Node = {
          id: `output-${Date.now()}`,
          type: "output",
          position: { x: center.x - 80, y: center.y - 60 }, // Offset to center the node
          data: { result: null, isLoading: false, onDelete: deleteNode },
        };
        return [...nds, newNode];
      });
    }, [deleteNode, getViewportCenter]);

    // Add a transform node
    const addTransform = useCallback(
      (transformType: TransformType = "extract") => {
        const center = getViewportCenter();
        setNodesRef.current((nds: Node[]) => {
          // Count existing transforms of this type to generate unique label
          const existingOfType = nds.filter(
            (n) =>
              n.type === "transform" &&
              (n.data as { transformType?: string })?.transformType ===
                transformType,
          ).length;
          const typeLabel =
            transformType.charAt(0).toUpperCase() + transformType.slice(1);
          const label = `${typeLabel} ${existingOfType + 1}`;

          const newNode: Node = {
            id: `transform-${Date.now()}`,
            type: "transform",
            position: { x: center.x - 80, y: center.y - 60 }, // Offset to center the node
            data: {
              transformType,
              label,
              config: {},
              onDelete: deleteNode,
              onConfigure: handleConfigureTransform,
            },
          };
          return [...nds, newNode];
        });
      },
      [deleteNode, handleConfigureTransform, getViewportCenter],
    );

    // Add a source node
    const addSource = useCallback(
      (sourceType: SourceType) => {
        const center = getViewportCenter();
        setNodesRef.current((nds: Node[]) => {
          const newNode: Node = {
            id: `source-${Date.now()}`,
            type: "source",
            position: { x: center.x - 80, y: center.y - 60 },
            data: {
              sourceType,
              config: {},
              onDelete: deleteNode,
              onConfigure: handleConfigureSource,
            },
          };
          return [...nds, newNode];
        });
      },
      [deleteNode, handleConfigureSource, getViewportCenter],
    );

    // Add a resource node with data
    const addResource = useCallback(
      (resource: CanvasResource) => {
        // Debug: log what we're receiving
        console.log("Adding resource to canvas:", {
          name: resource.name,
          extra: resource.extra,
          agentName: resource.extra?.agentName,
          serviceName: resource.extra?.serviceName,
          pt_parameters: resource.pt_parameters,
        });

        const center = getViewportCenter();
        setNodesRef.current((nds: Node[]) => {
          // Always use max_amount_required (the authoritative X402 field)
          const price =
            parseFloat(resource.max_amount_required || "0") / 1_000_000;

          const newNode: Node = {
            id: `resource-${Date.now()}`,
            type: "resource",
            position: { x: center.x - 80, y: center.y - 60 }, // Offset to center the node
            data: {
              resource: {
                id: resource.id,
                name: resource.name, // Original name from DB
                slug: resource.slug,
                serverSlug: resource.server_slug,
                displayName:
                  resource.extra?.agentName ||
                  resource.extra?.serviceName ||
                  resource.name, // Resolved display name
                description: resource.description,
                price,
                avatarUrl: resource.avatar_url || resource.extra?.avatarUrl,
                resourceUrl: resource.resource_url,
                network: resource.network,
                outputSchema: resource.output_schema, // Store schema for input fields
                extra: resource.extra, // Store full extra for name resolution
                pt_parameters: resource.pt_parameters, // Store prompt template parameters
              },
              configuredInputs: {}, // Start with empty config
              onDelete: deleteNode,
              onConfigure: handleConfigure,
            },
          };
          return [...nds, newNode];
        });
      },
      [deleteNode, handleConfigure, getViewportCenter],
    );

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        addResource,
        addTrigger,
        addTransform,
        addOutput,
        addSource,
        updateResourceConfig,
        getUpstreamNodes,
      }),
      [
        addResource,
        addTrigger,
        addTransform,
        addOutput,
        addSource,
        updateResourceConfig,
        getUpstreamNodes,
      ],
    );

    // Inject callbacks into nodes - use useMemo to avoid recreating on every render
    const nodesWithCallbacks = useMemo(() => {
      return nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: deleteNode,
          ...(node.type === "trigger"
            ? {
                onRun: handleRun,
                onCancel: handleCancel,
                onConfigure: handleConfigureTrigger,
                isRunning,
                isInitiating,
                triggerType,
                triggerMethods,
                scheduleConfig,
                scheduleNextRunAt,
              }
            : {}),
          ...(node.type === "resource" ? { onConfigure: handleConfigure } : {}),
          ...(node.type === "transform"
            ? { onConfigure: handleConfigureTransform }
            : {}),
          ...(node.type === "source"
            ? { onConfigure: handleConfigureSource }
            : {}),
          ...(node.type === "output"
            ? {
                onViewOutput: handleViewOutput,
                onConfigure: handleConfigureOutput,
              }
            : {}),
        },
      }));
    }, [
      nodes,
      deleteNode,
      handleRun,
      handleConfigure,
      handleConfigureTransform,
      handleConfigureSource,
      handleConfigureTrigger,
      handleConfigureOutput,
      handleCancel,
      handleViewOutput,
      isRunning,
      isInitiating,
      triggerType,
      triggerMethods,
      scheduleConfig,
      scheduleNextRunAt,
    ]);

    // Handle viewport changes
    const handleMoveEnd = useCallback(
      (_event: unknown, newViewport: Viewport) => {
        onViewportChange?.({
          x: newViewport.x,
          y: newViewport.y,
          zoom: newViewport.zoom,
        });
      },
      [onViewportChange],
    );

    return (
      <>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={handleMoveEnd}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          nodeTypes={nodeTypes}
          fitView={!viewport} // Only fit view if no saved viewport
          defaultViewport={viewport}
          deleteKeyCode={["Backspace", "Delete"]}
          snapToGrid
          snapGrid={[20, 20]} // Match background dot spacing
          className="bg-background"
          edgesReconnectable
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            selectable: true,
            interactionWidth: 20, // Wider click area for easier selection
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="[&>pattern>circle]:fill-zinc-400/30 dark:[&>pattern>circle]:fill-white/20"
          />
          <Controls position="top-left" />

          {/* Top-right controls panel - Railway style */}
          <Panel position="top-right" className="m-4">
            <div className="flex items-center gap-2">
              {/* Save button with dropdown */}
              {onSave && (
                <div className="flex items-stretch">
                  <Button
                    variant="outline"
                    onClick={onSave}
                    disabled={isSaving || !hasUnsavedChanges}
                    loading={isSaving}
                    className="gap-1.5 min-w-[90px] rounded-r-none border-r-0"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <Dropdown
                    trigger={
                      <Button
                        variant="outline"
                        className="px-1.5 rounded-l-none"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    }
                    placement="bottom-end"
                    className="min-w-[140px]"
                  >
                    {onSaveAs && (
                      <DropdownItem onClick={onSaveAs}>Save As</DropdownItem>
                    )}
                    {onExportJson && (
                      <DropdownItem onClick={onExportJson}>
                        Export JSON
                      </DropdownItem>
                    )}
                  </Dropdown>
                </div>
              )}

              {/* Run button */}
              {isRunning || isInitiating ? (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  className="gap-1.5"
                >
                  {isInitiating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {isInitiating ? "Starting..." : "Cancel"}
                </Button>
              ) : (
                <Button
                  onClick={() => handleRun()}
                  className="gap-1.5 bg-trigger hover:bg-trigger-dark text-white"
                >
                  <Play className="h-4 w-4" />
                  Run
                </Button>
              )}
            </div>
          </Panel>

          {/* Memeputer branding */}
          <Panel position="bottom-center" className="mb-4">
            <MemeputerBadge />
          </Panel>
        </ReactFlow>

        {/* Context Menu */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            nodeType={contextMenu.nodeType}
            canPaste={!!clipboard}
            onCopy={handleCopyNode}
            onPaste={handlePasteNode}
            onDelete={() => {
              if (contextMenu.nodeId) {
                deleteNode(contextMenu.nodeId);
              }
            }}
            onConfigure={() => {
              if (contextMenu.nodeId) {
                if (contextMenu.nodeType === "resource") {
                  handleConfigure(contextMenu.nodeId);
                } else if (contextMenu.nodeType === "transform") {
                  handleConfigureTransform(contextMenu.nodeId);
                } else if (contextMenu.nodeType === "source") {
                  handleConfigureSource(contextMenu.nodeId);
                } else if (contextMenu.nodeType === "trigger") {
                  handleConfigureTrigger();
                } else if (contextMenu.nodeType === "output") {
                  handleConfigureOutput(contextMenu.nodeId);
                }
              }
            }}
            onClose={closeContextMenu}
          />
        )}
      </>
    );
  },
);

// Wrapper component that provides ReactFlow context
export const WorkflowCanvas = forwardRef<
  WorkflowCanvasRef,
  WorkflowCanvasProps
>(function WorkflowCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
