/**
 * TransformExecutor - Executes data transformation steps
 *
 * Supports:
 * - extract: Extract a nested value using dot notation
 * - template: Apply template substitution
 * - code: Execute JavaScript code
 * - combine: Combine multiple node outputs into one object
 */

import type { WorkflowTransform, CombineField } from "./types";
import { extractByPath, applyTemplate, executeCode } from "./utils";

export interface TransformResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface TransformContext {
  outputs: Record<string, unknown>;
}

/**
 * Get the input for a transform from previous outputs
 */
function getTransformInput(
  transform: WorkflowTransform,
  outputs: Record<string, unknown>,
): unknown {
  if (transform.sourceNodeId) {
    return outputs[transform.sourceNodeId];
  }

  // Find the most recent output if no specific source
  const outputEntries = Object.entries(outputs);
  return outputEntries.length > 0
    ? outputEntries[outputEntries.length - 1]![1]
    : undefined;
}

/**
 * Execute an extract transform
 */
function executeExtract(input: unknown, path: string): unknown {
  console.log(`   Extract path: "${path}"`);
  const output = extractByPath(input, path);

  if (output === undefined) {
    console.log(`   ⚠️ Extract path "${path}" not found in input!`);
    console.log(
      `   Available keys:`,
      typeof input === "object" && input !== null
        ? Object.keys(input as Record<string, unknown>).join(", ")
        : "N/A (not an object)",
    );
  }

  console.log(`   Extract result type: ${typeof output}`);
  console.log(
    `   Extract result:`,
    output === undefined
      ? "undefined"
      : typeof output === "string"
        ? output.substring(0, 200)
        : JSON.stringify(output, null, 2)?.substring(0, 300),
  );

  return output;
}

/**
 * Execute a combine transform - merge multiple node outputs into one object
 */
function executeCombine(
  fields: CombineField[],
  outputs: Record<string, unknown>,
): Record<string, unknown> {
  console.log(`   Combining ${fields.length} fields:`);
  const combined: Record<string, unknown> = {};

  for (const field of fields) {
    console.log(
      `     - ${field.fieldName} from ${field.sourceNodeId}${field.sourcePath ? ` (path: ${field.sourcePath})` : ""}`,
    );

    const sourceValue = outputs[field.sourceNodeId];
    if (sourceValue === undefined) {
      console.log(
        `       ⚠️ Source node ${field.sourceNodeId} not found in outputs`,
      );
      combined[field.fieldName] = null;
    } else if (field.sourcePath) {
      combined[field.fieldName] = extractByPath(sourceValue, field.sourcePath);
      console.log(
        `       → Extracted: ${JSON.stringify(combined[field.fieldName])?.substring(0, 100)}`,
      );
    } else {
      combined[field.fieldName] = sourceValue;
      console.log(
        `       → Full value: ${JSON.stringify(sourceValue)?.substring(0, 100)}`,
      );
    }
  }

  return combined;
}

/**
 * Execute a transform step
 */
export async function executeTransform(
  transform: WorkflowTransform,
  ctx: TransformContext,
): Promise<TransformResult> {
  try {
    const input = getTransformInput(transform, ctx.outputs);

    console.log(`🔄 Executing transform: ${transform.transformType}`);
    console.log(`   Input type: ${typeof input}`);
    console.log(
      `   Input:`,
      typeof input === "string"
        ? input.substring(0, 200)
        : JSON.stringify(input, null, 2)?.substring(0, 500),
    );

    let output: unknown;

    switch (transform.transformType) {
      case "extract":
        if (!transform.config.path) {
          throw new Error("Extract transform requires a path");
        }
        output = executeExtract(input, transform.config.path);
        break;

      case "template":
        if (!transform.config.template) {
          throw new Error("Template transform requires a template");
        }
        output = applyTemplate(transform.config.template, input);
        break;

      case "code":
        if (!transform.config.code) {
          throw new Error("Code transform requires code");
        }
        output = await executeCode(transform.config.code, input);
        break;

      case "combine":
        if (
          !transform.config.combineFields ||
          transform.config.combineFields.length === 0
        ) {
          throw new Error(
            "Combine transform requires at least one field mapping",
          );
        }
        output = executeCombine(transform.config.combineFields, ctx.outputs);
        break;

      default:
        throw new Error(`Unknown transform type: ${transform.transformType}`);
    }

    console.log(
      `   ✅ Transform output:`,
      typeof output === "string" ? output.substring(0, 100) : output,
    );

    return { success: true, output };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Transform failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

