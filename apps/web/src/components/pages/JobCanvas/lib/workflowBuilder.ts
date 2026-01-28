import { Node, Edge } from "@xyflow/react";

/**
 * Resource data extracted from a node
 */
interface NodeResource {
  id: string;
  name: string;
  price: number;
  resourceUrl?: string;
  network?: string;
}

/**
 * A step in the workflow execution
 */
export interface WorkflowStep {
  type: "resource" | "transform" | "source";
  nodeId: string;
  dependencies: string[]; // Node IDs this step depends on (must complete first)
  data: {
    id?: string;
    name?: string;
    price?: number;
    resourceUrl?: string;
    network?: string;
    transformType?: string;
    config?: Record<string, unknown>;
    sourceNodeId?: string;
    // Source-specific fields
    sourceType?: string;
  };
}

/**
 * Result of building the workflow execution plan
 */
export interface WorkflowBuildResult {
  steps: WorkflowStep[];
  stepLevels: string[][]; // Kept for backwards compatibility
}

/**
 * Find all executable nodes reachable from trigger nodes
 * @param nodes - All canvas nodes
 * @param edges - All canvas edges
 * @param startingTriggerIds - Optional: specific trigger node IDs to start from.
 *                             If not provided, uses all trigger nodes.
 */
function findReachableNodes(
  nodes: Node[],
  edges: Edge[],
  startingTriggerIds?: string[],
): Set<string> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoingEdges = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, []);
    }
    outgoingEdges.get(edge.source)!.push(edge.target);
  }

  // BFS from trigger nodes to find all reachable executable nodes
  // If startingTriggerIds provided, only use those triggers
  const triggerNodes = startingTriggerIds
    ? nodes.filter(
        (n) => n.type === "trigger" && startingTriggerIds.includes(n.id),
      )
    : nodes.filter((n) => n.type === "trigger");

  const reachableNodeIds = new Set<string>();
  const visitQueue = [...triggerNodes.map((n) => n.id)];
  const visited = new Set<string>();

  while (visitQueue.length > 0) {
    const nodeId = visitQueue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeById.get(nodeId);
    if (node) {
      const isExecutable =
        (node.type === "resource" && node.data?.resource) ||
        node.type === "transform" ||
        node.type === "source";
      if (isExecutable) {
        reachableNodeIds.add(nodeId);
      }
      // Follow outgoing edges
      for (const targetId of outgoingEdges.get(nodeId) || []) {
        if (!visited.has(targetId)) {
          visitQueue.push(targetId);
        }
      }
    }
  }

  return reachableNodeIds;
}

/**
 * Perform topological sort and group nodes into levels for parallel execution
 *
 * Level 0: nodes with no dependencies (inDegree === 0)
 * Level N: nodes whose dependencies are all in levels 0 to N-1
 */
function topologicalSortWithLevels(
  nodes: Node[],
  edges: Edge[],
  reachableNodeIds: Set<string>,
): string[][] {
  const executableNodes = nodes.filter((n) => reachableNodeIds.has(n.id));

  // Build in-degree map and outgoing edges for executable nodes only
  const inDegree = new Map<string, number>();
  const execOutEdges = new Map<string, string[]>();

  for (const node of executableNodes) {
    inDegree.set(node.id, 0);
    execOutEdges.set(node.id, []);
  }

  for (const edge of edges) {
    if (
      reachableNodeIds.has(edge.source) &&
      reachableNodeIds.has(edge.target)
    ) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      execOutEdges.get(edge.source)?.push(edge.target);
    }
    // Edges from trigger to executable don't increment in-degree
  }

  // Group by levels using Kahn's algorithm variant
  const stepLevels: string[][] = [];
  const processed = new Set<string>();

  // Find initial level (all nodes with inDegree === 0)
  let currentLevel: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) currentLevel.push(nodeId);
  }

  while (currentLevel.length > 0) {
    stepLevels.push(currentLevel);
    currentLevel.forEach((id) => processed.add(id));

    // Find next level - nodes whose dependencies are now all processed
    const nextLevel: string[] = [];
    for (const nodeId of currentLevel) {
      for (const targetId of execOutEdges.get(nodeId) || []) {
        const newDegree = (inDegree.get(targetId) || 0) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0 && !processed.has(targetId)) {
          nextLevel.push(targetId);
        }
      }
    }
    currentLevel = nextLevel;
  }

  return stepLevels;
}

/**
 * Convert node IDs to step objects for API submission
 * Now includes dependencies for each step
 */
function buildStepObjects(
  nodeIds: string[],
  nodes: Node[],
  edges: Edge[],
  _reachableNodeIds: Set<string>,
): WorkflowStep[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const executableNodeIds = new Set(nodeIds);

  return nodeIds.map((nodeId) => {
    const node = nodeById.get(nodeId)!;

    // Find all incoming edges from executable nodes (dependencies)
    // Only include edges from other executable nodes (not triggers)
    const dependencies = edges
      .filter((e) => e.target === nodeId && executableNodeIds.has(e.source))
      .map((e) => e.source);

    // Also check if there's a direct trigger connection (no executable dependencies)
    // In that case, dependencies is empty (can start immediately)
    const incomingEdge = edges.find((e) => e.target === nodeId);
    const sourceNodeId = incomingEdge?.source;

    if (node.type === "resource") {
      const r = node.data.resource as NodeResource;
      // Include configuredInputs per node - this is critical for multiple nodes using the same resource
      const configuredInputs =
        (node.data.configuredInputs as Record<string, unknown>) || {};
      return {
        type: "resource" as const,
        nodeId: node.id,
        dependencies,
        data: {
          id: r.id,
          name: r.name,
          price: r.price,
          resourceUrl: r.resourceUrl,
          network: r.network,
          configuredInputs, // Each node has its own inputs!
        },
      };
    } else if (node.type === "source") {
      return {
        type: "source" as const,
        nodeId: node.id,
        dependencies,
        data: {
          nodeId: node.id,
          sourceType: (node.data.sourceType as string) || "job_history",
          config: (node.data.config as Record<string, unknown>) || {},
        },
      };
    } else {
      return {
        type: "transform" as const,
        nodeId: node.id,
        dependencies,
        data: {
          transformType: (node.data.transformType as string) || "extract",
          config: (node.data.config as Record<string, unknown>) || {},
          sourceNodeId,
        },
      };
    }
  });
}

/**
 * Build the workflow execution plan from canvas nodes and edges
 *
 * Finds all executable nodes reachable from triggers, performs topological sort,
 * groups into levels for parallel execution, and builds step objects.
 *
 * @param nodes - All canvas nodes
 * @param edges - All canvas edges
 * @param startingTriggerIds - Optional: specific trigger node IDs to start from.
 *                             If not provided, uses all trigger nodes.
 * @returns Steps array and stepLevels for parallel execution
 */
export function buildWorkflowSteps(
  nodes: Node[],
  edges: Edge[],
  startingTriggerIds?: string[],
): WorkflowBuildResult {
  // Find all executable nodes reachable from specified triggers (or all triggers)
  const reachableNodeIds = findReachableNodes(nodes, edges, startingTriggerIds);

  // Group into levels for parallel execution (kept for backwards compatibility)
  const stepLevels = topologicalSortWithLevels(nodes, edges, reachableNodeIds);

  // Flatten for step ordering
  const sortedNodeIds = stepLevels.flat();

  // Build step objects with dependencies
  const steps = buildStepObjects(sortedNodeIds, nodes, edges, reachableNodeIds);

  return { steps, stepLevels };
}

/**
 * Get all trigger nodes from a workflow
 */
export function getTriggerNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.type === "trigger");
}

/**
 * Get a display name for a trigger node
 */
export function getTriggerDisplayName(node: Node, index: number): string {
  // Check if trigger has a custom label in data
  const label = (node.data as { label?: string })?.label;
  if (label) return label;

  // Use a default name based on index
  return `Trigger ${index + 1}`;
}
