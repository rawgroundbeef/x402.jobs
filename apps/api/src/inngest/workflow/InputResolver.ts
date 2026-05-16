/**
 * InputResolver - Resolves input references to actual values
 *
 * Handles:
 * - Static values (strings, objects)
 * - References to other node outputs
 * - References to trigger/workflow inputs
 * - Auto-parsing of JSON strings
 * - Smart field matching (camelCase to snake_case)
 */

import type { InputValue, InputReference } from "./types";

export interface ResolverContext {
  outputs: Record<string, unknown>; // Node outputs from previous steps
  workflowInputs: Record<string, unknown>; // Top-level trigger inputs
}

/**
 * Check if a value is a reference to another node
 */
function isReference(value: unknown): value is InputReference {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as InputReference).type === "reference"
  );
}

/**
 * Check if a node ID refers to the trigger node
 */
function isTriggerNode(nodeId: string): boolean {
  return nodeId === "trigger" || nodeId.startsWith("trigger");
}

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Try to parse a string as JSON if it looks like JSON
 */
function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON
    }
  }
  return value;
}

/**
 * Extract a field from an object, handling JSON strings
 */
function extractField(obj: unknown, field: string): unknown {
  if (typeof obj !== "object" || obj === null) return obj;
  if (field in (obj as Record<string, unknown>)) {
    return (obj as Record<string, unknown>)[field];
  }
  return obj;
}

/**
 * Resolve a single reference value
 */
function resolveReference(
  ref: InputReference,
  destinationKey: string,
  ctx: ResolverContext,
): unknown {
  const { outputs, workflowInputs } = ctx;

  if (isTriggerNode(ref.sourceNodeId)) {
    // Resolve from workflow inputs
    let inputField = ref.sourceField;

    // Smart fallback: try to match destination key name
    if (!inputField && workflowInputs) {
      if (destinationKey in workflowInputs) {
        inputField = destinationKey;
        console.log(
          `   ℹ️ Auto-mapping trigger input: "${destinationKey}" matches destination input`,
        );
      } else {
        // Try snake_case match
        const snakeKey = toSnakeCase(destinationKey);
        if (snakeKey in workflowInputs) {
          inputField = snakeKey;
          console.log(
            `   ℹ️ Auto-mapping trigger input: "${snakeKey}" matches destination input "${destinationKey}"`,
          );
        }
      }
    }

    if (inputField) {
      const value = workflowInputs[inputField];
      console.log(
        `   Resolved from workflow input "${inputField}":`,
        typeof value === "string"
          ? value.substring(0, 100)
          : JSON.stringify(value)?.substring(0, 100),
      );
      return value;
    }

    // Fallback: return all workflow inputs
    return workflowInputs;
  }

  // Resolve from a previous node's output
  const sourceOutput = outputs[ref.sourceNodeId];
  console.log(
    `   Resolving input "${destinationKey}" from node: ${ref.sourceNodeId}`,
  );
  console.log(`   Source output type: ${typeof sourceOutput}`);
  console.log(
    `   Source output:`,
    typeof sourceOutput === "string"
      ? sourceOutput.substring(0, 200)
      : JSON.stringify(sourceOutput, null, 2)?.substring(0, 300),
  );

  if (sourceOutput === undefined) {
    console.warn(
      `   ⚠️ Output from ${ref.sourceNodeId} not found - dependency may not have completed`,
    );
    return undefined; // Return undefined so validation can catch it properly
  }

  // Extract the specified field or use "response" as default
  const sourceField = ref.sourceField || "response";
  let resolvedValue = extractField(sourceOutput, sourceField);

  // Auto-parse JSON strings
  if (typeof resolvedValue === "string") {
    try {
      const parsed = JSON.parse(resolvedValue);
      // Common pattern: extract data.items
      if (parsed && typeof parsed === "object" && "data" in parsed) {
        resolvedValue = parsed.data;
        if (
          resolvedValue &&
          typeof resolvedValue === "object" &&
          "items" in (resolvedValue as Record<string, unknown>)
        ) {
          resolvedValue = (resolvedValue as Record<string, unknown>).items;
        }
      } else {
        resolvedValue = parsed;
      }
    } catch {
      // Not valid JSON, keep as string
    }
  }

  return resolvedValue;
}

/**
 * Resolve a static value (not a reference)
 */
function resolveStaticValue(value: unknown): unknown {
  // Handle InputValue objects with { type: "static", value: "..." }
  if (typeof value === "object" && value !== null && "value" in value) {
    value = (value as { value: unknown }).value;
  }

  return tryParseJson(value);
}

export interface ResolveResult {
  resolved: Record<string, unknown>;
  consumedWorkflowInputs: Set<string>; // Track which workflow inputs were used
}

/**
 * Resolve all inputs for a resource step
 *
 * @param inputs - The input configuration (static values or references)
 * @param ctx - Resolver context with outputs and workflow inputs
 * @returns Resolved inputs and set of consumed workflow input keys
 */
export function resolveInputs(
  inputs: Record<string, InputValue>,
  ctx: ResolverContext,
): ResolveResult {
  const resolved: Record<string, unknown> = {};
  const consumedWorkflowInputs = new Set<string>();

  for (const [key, value] of Object.entries(inputs)) {
    if (isReference(value)) {
      // Track if this reference consumes a workflow input
      if (isTriggerNode(value.sourceNodeId) && value.sourceField) {
        consumedWorkflowInputs.add(value.sourceField);
      }
      resolved[key] = resolveReference(value, key, ctx);
    } else {
      resolved[key] = resolveStaticValue(value);
    }
  }

  return { resolved, consumedWorkflowInputs };
}
