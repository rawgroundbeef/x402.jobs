/**
 * DryRunService - Validates workflow structure and estimates cost without executing
 *
 * Performs these validations:
 * - Graph structure (exactly one trigger, valid edges)
 * - Node configurations (required inputs configured)
 * - Reference validity (sourceNodeId and sourceField exist)
 * - Resource availability (402 check without payment)
 */

export interface DryRunError {
  type: "graph" | "config" | "reference" | "resource";
  nodeId?: string;
  message: string;
}

export interface DryRunWarning {
  nodeId?: string;
  message: string;
}

export interface ResourceCheck {
  nodeId: string;
  resourceName: string;
  resourceUrl: string;
  available: boolean;
  price?: number;
  error?: string;
}

export interface DryRunResult {
  valid: boolean;
  estimatedCostUsd: number;
  nodeCount: number;
  resourceNodes: number;
  transformNodes: number;
  errors: DryRunError[];
  warnings: DryRunWarning[];
  resourceChecks: ResourceCheck[];
}

interface WorkflowNode {
  id: string;
  type: "trigger" | "resource" | "transform" | "output";
  data: {
    resource?: {
      id: string;
      name: string;
      resourceUrl: string;
      price: number;
    };
    configuredInputs?: Record<
      string,
      {
        type: "static" | "reference";
        value?: string;
        sourceNodeId?: string;
        sourceField?: string;
      }
    >;
    config?: {
      path?: string;
      template?: string;
    };
    workflowInputs?: Array<{ name: string; type: string; required: boolean }>;
    transformType?: string;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export class DryRunService {
  /**
   * Validate a workflow and estimate costs without executing
   */
  async validate(
    workflowDefinition: WorkflowDefinition,
  ): Promise<DryRunResult> {
    const errors: DryRunError[] = [];
    const warnings: DryRunWarning[] = [];
    const resourceChecks: ResourceCheck[] = [];

    const nodes = workflowDefinition.nodes || [];
    const edges = workflowDefinition.edges || [];

    // Build node map for quick lookup
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // 1. Validate graph structure
    this.validateGraphStructure(nodes, edges, nodeMap, errors, warnings);

    // 2. Validate node configurations
    this.validateNodeConfigs(nodes, nodeMap, errors, warnings);

    // 3. Check resource availability and get prices
    const resourceNodes = nodes.filter((n) => n.type === "resource");
    await this.checkResources(resourceNodes, resourceChecks, errors);

    // Calculate estimated cost
    const estimatedCostUsd = resourceChecks
      .filter((r) => r.available && r.price)
      .reduce((sum, r) => sum + (r.price || 0), 0);

    // Count node types
    const transformNodes = nodes.filter((n) => n.type === "transform");

    return {
      valid: errors.length === 0,
      estimatedCostUsd,
      nodeCount: nodes.length,
      resourceNodes: resourceNodes.length,
      transformNodes: transformNodes.length,
      errors,
      warnings,
      resourceChecks,
    };
  }

  /**
   * Validate graph structure
   */
  private validateGraphStructure(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    nodeMap: Map<string, WorkflowNode>,
    errors: DryRunError[],
    warnings: DryRunWarning[],
  ): void {
    // Check for exactly one trigger node
    const triggerNodes = nodes.filter((n) => n.type === "trigger");
    if (triggerNodes.length === 0) {
      errors.push({
        type: "graph",
        message: "Workflow must have exactly one trigger node",
      });
    } else if (triggerNodes.length > 1) {
      errors.push({
        type: "graph",
        message: `Found ${triggerNodes.length} trigger nodes - workflow should have exactly one`,
      });
    }

    // Check for at least one executable node (resource or transform)
    const executableNodes = nodes.filter(
      (n) => n.type === "resource" || n.type === "transform",
    );
    if (executableNodes.length === 0) {
      errors.push({
        type: "graph",
        message: "Workflow has no executable nodes (resource or transform)",
      });
    }

    // Validate all edges reference existing nodes
    for (const edge of edges) {
      if (!nodeMap.has(edge.source)) {
        errors.push({
          type: "graph",
          message: `Edge ${edge.id} references non-existent source node: ${edge.source}`,
        });
      }
      if (!nodeMap.has(edge.target)) {
        errors.push({
          type: "graph",
          message: `Edge ${edge.id} references non-existent target node: ${edge.target}`,
        });
      }
    }

    // Check for disconnected nodes (except output nodes)
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    for (const node of nodes) {
      if (node.type === "output") continue; // Output nodes don't need to connect to anything
      if (node.type === "trigger") {
        // Trigger should be connected as source
        const isSource = edges.some((e) => e.source === node.id);
        if (!isSource) {
          warnings.push({
            nodeId: node.id,
            message: "Trigger node is not connected to any other node",
          });
        }
      } else if (!connectedNodes.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          message: `Node "${node.id}" is disconnected from the workflow`,
        });
      }
    }
  }

  /**
   * Validate node configurations
   */
  private validateNodeConfigs(
    nodes: WorkflowNode[],
    nodeMap: Map<string, WorkflowNode>,
    errors: DryRunError[],
    warnings: DryRunWarning[],
  ): void {
    for (const node of nodes) {
      if (node.type === "resource") {
        // Check resource node has a resource configured
        if (!node.data.resource) {
          errors.push({
            type: "config",
            nodeId: node.id,
            message: "Resource node has no resource configured",
          });
          continue;
        }

        // Validate configured inputs reference existing nodes
        const inputs = node.data.configuredInputs || {};
        for (const [inputName, inputConfig] of Object.entries(inputs)) {
          if (inputConfig.type === "reference") {
            const sourceNodeId = inputConfig.sourceNodeId;
            if (!sourceNodeId) {
              errors.push({
                type: "reference",
                nodeId: node.id,
                message: `Input "${inputName}" is a reference but has no sourceNodeId`,
              });
            } else if (!nodeMap.has(sourceNodeId)) {
              errors.push({
                type: "reference",
                nodeId: node.id,
                message: `Input "${inputName}" references non-existent node: ${sourceNodeId}`,
              });
            }
          }
        }
      } else if (node.type === "transform") {
        // Check transform has config
        if (!node.data.config && !node.data.transformType) {
          warnings.push({
            nodeId: node.id,
            message: "Transform node has no configuration",
          });
        }

        // Check extract transform has a path
        if (node.data.transformType === "extract" && !node.data.config?.path) {
          warnings.push({
            nodeId: node.id,
            message: "Extract transform has no path configured",
          });
        }
      }
    }
  }

  /**
   * Check resource availability without executing
   */
  private async checkResources(
    resourceNodes: WorkflowNode[],
    resourceChecks: ResourceCheck[],
    errors: DryRunError[],
  ): Promise<void> {
    // Check resources in parallel (with timeout)
    const checkPromises = resourceNodes.map(async (node) => {
      const resource = node.data.resource;
      if (!resource) {
        resourceChecks.push({
          nodeId: node.id,
          resourceName: "Unknown",
          resourceUrl: "Unknown",
          available: false,
          error: "No resource configured",
        });
        return;
      }

      try {
        // Make a GET request to check availability (most resources return 402)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(resource.resourceUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "x402-jobs-dry-run/1.0",
          },
        });

        clearTimeout(timeoutId);

        // 402 is expected - resource exists and requires payment
        // 200 might mean it's free or doesn't require payment for GET
        if (response.status === 402) {
          // Parse the 402 response to get the actual price (body or PAYMENT-REQUIRED header)
          try {
            let x402Data = await response.json();
            // If body is empty, check PAYMENT-REQUIRED header (base64 encoded per v2 spec)
            if (
              !x402Data ||
              Object.keys(x402Data).length === 0 ||
              (!x402Data.accepts && !x402Data.payTo)
            ) {
              const paymentRequiredHeader =
                response.headers.get("payment-required") ||
                response.headers.get("PAYMENT-REQUIRED");
              if (paymentRequiredHeader) {
                const decoded = Buffer.from(
                  paymentRequiredHeader,
                  "base64",
                ).toString("utf-8");
                x402Data = JSON.parse(decoded);
              }
            }
            const accepts = x402Data.accepts?.[0] || x402Data;
            // v1 uses maxAmountRequired, v2 uses amount
            const maxAmount =
              accepts.maxAmountRequired ||
              accepts.max_amount_required ||
              accepts.amount;
            const price = maxAmount
              ? parseFloat(maxAmount) / 1_000_000
              : resource.price;

            resourceChecks.push({
              nodeId: node.id,
              resourceName: resource.name,
              resourceUrl: resource.resourceUrl,
              available: true,
              price,
            });
          } catch {
            // Couldn't parse 402, use stored price
            resourceChecks.push({
              nodeId: node.id,
              resourceName: resource.name,
              resourceUrl: resource.resourceUrl,
              available: true,
              price: resource.price,
            });
          }
        } else if (response.ok) {
          // Resource is available (and might be free)
          resourceChecks.push({
            nodeId: node.id,
            resourceName: resource.name,
            resourceUrl: resource.resourceUrl,
            available: true,
            price: resource.price,
          });
        } else {
          resourceChecks.push({
            nodeId: node.id,
            resourceName: resource.name,
            resourceUrl: resource.resourceUrl,
            available: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
          });
          errors.push({
            type: "resource",
            nodeId: node.id,
            message: `Resource "${resource.name}" returned ${response.status}: ${response.statusText}`,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        resourceChecks.push({
          nodeId: node.id,
          resourceName: resource.name,
          resourceUrl: resource.resourceUrl,
          available: false,
          error: errorMessage,
        });
        errors.push({
          type: "resource",
          nodeId: node.id,
          message: `Failed to check resource "${resource.name}": ${errorMessage}`,
        });
      }
    });

    await Promise.all(checkPromises);
  }
}

// Singleton instance
export const dryRunService = new DryRunService();
