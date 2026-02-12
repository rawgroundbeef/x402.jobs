import { useState, useCallback, useMemo } from "react";
import { Node } from "@xyflow/react";
import type { ConfiguredInputs } from "@/components/modals/ResourceConfigModal";
import type {
  TransformConfig,
  AvailableNode,
} from "@/components/modals/TransformConfigModal";
import type { TransformType } from "@/components/workflow/nodes/TransformNode";
import type { WorkflowCanvasRef } from "@/components/workflow/WorkflowCanvas";
import type { WorkflowInput } from "@/components/workflow/nodes/TriggerNode";

interface ResourceData {
  id: string;
  name: string;
  slug?: string;
  serverSlug?: string;
  description?: string;
  price: number;
  avatarUrl?: string;
  resourceUrl?: string;
  network?: string;
  extra?: Record<string, unknown>;
  outputSchema?: {
    input?: {
      method?: string;
      bodyFields?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
      queryParams?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
    };
  };
  // Prompt template fields
  resource_type?: string;
  pt_parameters?: Array<{
    name: string;
    description?: string;
    required?: boolean;
    default?: string;
  }>;
  allows_user_message?: boolean;
  model?: string;
}

interface CombineField {
  fieldName: string;
  sourceNodeId: string;
  sourcePath?: string;
}

interface UseNodeConfigurationOptions {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  canvasRef: React.RefObject<WorkflowCanvasRef | null>;
  workflowInputs: WorkflowInput[];
}

interface UseNodeConfigurationResult {
  // Resource configuration
  configureNodeId: string | null;
  setConfigureNodeId: (id: string | null) => void;
  handleConfigureResource: (nodeId: string) => void;
  configureResource: ResourceData | null;
  configureCurrentInputs: ConfiguredInputs | undefined;
  getUpstreamNodesForConfig: () => Array<{
    id: string;
    name: string;
    type: string;
  }>;
  handleSaveResourceConfig: (inputs: ConfiguredInputs) => void;
  saveResourceConfigOnly: (inputs: ConfiguredInputs) => void;

  // Transform configuration
  configureTransformId: string | null;
  setConfigureTransformId: (id: string | null) => void;
  handleConfigureTransform: (nodeId: string) => void;
  currentTransformConfig: TransformConfig | undefined;
  getUpstreamNodesForTransformConfig: () => AvailableNode[];
  handleSaveTransformConfig: (config: TransformConfig) => void;
}

/**
 * Hook for managing resource and transform node configuration
 */
export function useNodeConfiguration({
  nodes,
  setNodes,
  canvasRef,
  workflowInputs,
}: UseNodeConfigurationOptions): UseNodeConfigurationResult {
  const [configureNodeId, setConfigureNodeId] = useState<string | null>(null);
  const [configureTransformId, setConfigureTransformId] = useState<
    string | null
  >(null);

  // Handle configuring a resource node
  const handleConfigureResource = useCallback((nodeId: string) => {
    setConfigureNodeId(nodeId);
  }, []);

  // Handle configuring a transform node
  const handleConfigureTransform = useCallback((nodeId: string) => {
    setConfigureTransformId(nodeId);
  }, []);

  // Get the resource data for the node being configured
  const configureNode = useMemo(
    () =>
      configureNodeId ? nodes.find((n) => n.id === configureNodeId) : null,
    [configureNodeId, nodes],
  );

  const configureResource = useMemo(
    () => (configureNode?.data?.resource as ResourceData) || null,
    [configureNode],
  );

  const configureCurrentInputs = useMemo(
    () => configureNode?.data?.configuredInputs as ConfiguredInputs | undefined,
    [configureNode],
  );

  // Get upstream nodes that can provide input to the configured node
  const getUpstreamNodesForConfig = useCallback(() => {
    if (!configureNodeId || !canvasRef.current) return [];
    const upstreamNodes = canvasRef.current.getUpstreamNodes(configureNodeId);

    // Also ensure trigger is included if we have workflowInputs defined
    if (workflowInputs.length > 0) {
      const hasTrigger = upstreamNodes.some((n) => n.type === "trigger");
      if (!hasTrigger) {
        const triggerNode = nodes.find((n) => n.type === "trigger");
        if (triggerNode) {
          upstreamNodes.unshift({
            id: triggerNode.id,
            name: "Job Parameters",
            type: "trigger",
          });
        }
      }
    }

    return upstreamNodes;
  }, [configureNodeId, workflowInputs, nodes, canvasRef]);

  // Save configured inputs for a resource node (and close)
  const handleSaveResourceConfig = useCallback(
    (inputs: ConfiguredInputs) => {
      if (configureNodeId && canvasRef.current) {
        canvasRef.current.updateResourceConfig(configureNodeId, inputs);
      }
      setConfigureNodeId(null);
    },
    [configureNodeId, canvasRef],
  );

  // Save configured inputs without closing (for panels that stay open)
  const saveResourceConfigOnly = useCallback(
    (inputs: ConfiguredInputs) => {
      if (configureNodeId && canvasRef.current) {
        canvasRef.current.updateResourceConfig(configureNodeId, inputs);
      }
    },
    [configureNodeId, canvasRef],
  );

  // Get transform config for the node being configured
  const configureTransformNode = useMemo(
    () =>
      configureTransformId
        ? nodes.find((n) => n.id === configureTransformId)
        : null,
    [configureTransformId, nodes],
  );

  const currentTransformConfig = useMemo((): TransformConfig | undefined => {
    if (!configureTransformNode?.data) return undefined;

    const data = configureTransformNode.data as {
      transformType?: string;
      label?: string;
      config?: {
        path?: string;
        template?: string;
        code?: string;
        combineFields?: CombineField[];
      };
    };

    return {
      transformType: (data.transformType || "extract") as TransformType,
      label: data.label,
      path: data.config?.path,
      template: data.config?.template,
      code: data.config?.code,
      combineFields: data.config?.combineFields,
    };
  }, [configureTransformNode]);

  // Get upstream nodes for transform config (connected nodes only)
  const getUpstreamNodesForTransformConfig =
    useCallback((): AvailableNode[] => {
      if (!configureTransformId || !canvasRef.current) return [];
      const upstreamNodes =
        canvasRef.current.getUpstreamNodes(configureTransformId);
      return upstreamNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.name,
      }));
    }, [configureTransformId, canvasRef]);

  // Save transform config
  const handleSaveTransformConfig = useCallback(
    (config: TransformConfig) => {
      if (configureTransformId) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === configureTransformId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    transformType: config.transformType,
                    label: config.label, // Save label at node level
                    config: {
                      path: config.path,
                      template: config.template,
                      code: config.code,
                      combineFields: config.combineFields,
                    },
                  },
                }
              : node,
          ),
        );
      }
      setConfigureTransformId(null);
    },
    [configureTransformId, setNodes],
  );

  return {
    configureNodeId,
    setConfigureNodeId,
    handleConfigureResource,
    configureResource,
    configureCurrentInputs,
    getUpstreamNodesForConfig,
    handleSaveResourceConfig,
    saveResourceConfigOnly,
    configureTransformId,
    setConfigureTransformId,
    handleConfigureTransform,
    currentTransformConfig,
    getUpstreamNodesForTransformConfig,
    handleSaveTransformConfig,
  };
}
