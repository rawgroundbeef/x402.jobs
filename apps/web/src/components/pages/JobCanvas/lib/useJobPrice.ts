import { useMemo } from "react";
import { Node, Edge } from "@xyflow/react";

const PLATFORM_FEE = 0.05;
const STORAGE_FEE = 0.01;

interface JobPriceResult {
  /** Total price including resources and platform fee */
  total: number;
  /** Price of connected resources only */
  resourcesPrice: number;
  /** Platform fee */
  platformFee: number;
  /** Storage fee (if x402storage is enabled) */
  storageFee: number;
}

/**
 * Calculate the total job price including resources and platform fee
 *
 * Uses BFS from trigger nodes to find all reachable resource nodes,
 * sums their prices, and adds the platform fee.
 */
export function useJobPrice(nodes: Node[], edges: Edge[]): JobPriceResult {
  return useMemo(() => {
    // Build outgoing edges map
    const outgoingEdges = new Map<string, string[]>();
    for (const edge of edges) {
      if (!outgoingEdges.has(edge.source)) {
        outgoingEdges.set(edge.source, []);
      }
      outgoingEdges.get(edge.source)!.push(edge.target);
    }

    // BFS from trigger nodes to find all reachable nodes
    const triggerNodes = nodes.filter((n) => n.type === "trigger");
    const reachableNodeIds = new Set<string>();
    const visitQueue = [...triggerNodes.map((n) => n.id)];
    const visited = new Set<string>();

    while (visitQueue.length > 0) {
      const nodeId = visitQueue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        if (node.type === "resource" && node.data?.resource) {
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

    // Sum prices of only reachable resource nodes
    const resourcesPrice = nodes
      .filter((n) => reachableNodeIds.has(n.id))
      .reduce(
        (sum, n) =>
          sum +
          ((n.data as { resource?: { price?: number } })?.resource?.price || 0),
        0,
      );

    // Check if any output node has x402storage enabled
    const hasStorageEnabled = nodes
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

    const storageFee = hasStorageEnabled ? STORAGE_FEE : 0;

    return {
      total: resourcesPrice + PLATFORM_FEE + storageFee,
      resourcesPrice,
      platformFee: PLATFORM_FEE,
      storageFee,
    };
  }, [nodes, edges]);
}
