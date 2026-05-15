/**
 * Workflow utility functions for data extraction and transformation
 */

/**
 * Strip markdown code blocks from a string
 * e.g., "```json\n{...}\n```" -> "{...}"
 */
export function stripMarkdownCodeBlock(str: string): string {
  const trimmed = str.trim();
  // Match ```json or ``` at start and ``` at end
  const codeBlockMatch = trimmed.match(
    /^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/,
  );
  if (codeBlockMatch) {
    return codeBlockMatch[1]!.trim();
  }
  return str;
}

/**
 * Extract a nested value from an object using dot notation
 * e.g., "response.data.text" extracts obj.response.data.text
 * Handles JSON strings by parsing them automatically
 */
function extractByPathDirect(obj: unknown, path: string): unknown {
  // No path means return the whole object
  if (!path) {
    return obj;
  }

  // Can't traverse a non-object with a path
  if (typeof obj !== "object" || obj === null) {
    return undefined;
  }

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // If current is a JSON string, try to parse it (strip markdown code blocks first)
    if (typeof current === "string") {
      try {
        const stripped = stripMarkdownCodeBlock(current);
        current = JSON.parse(stripped);
      } catch {
        // Not valid JSON, treat as regular string
        return undefined;
      }
    }

    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    // Handle array access like "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      if (key! in (current as Record<string, unknown>)) {
        const arr = (current as Record<string, unknown>)[key!];
        if (Array.isArray(arr)) {
          current = arr[parseInt(index!, 10)];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    } else {
      if (part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
  }

  // If final result is a JSON string, parse it (strip markdown code blocks first)
  if (typeof current === "string") {
    try {
      const stripped = stripMarkdownCodeBlock(current);
      current = JSON.parse(stripped);
    } catch {
      // Not valid JSON, return as-is
    }
  }

  return current;
}

/**
 * Smart extract - tries direct path first, then falls back to looking in 'response' field
 * This handles the common pattern where X402 responses have { response: "{ json string }" }
 */
export function extractByPath(obj: unknown, path: string): unknown {
  // Try direct extraction first
  const directResult = extractByPathDirect(obj, path);
  if (directResult !== undefined) {
    return directResult;
  }

  // If that didn't work and obj has a 'response' field, try extracting from there
  if (
    typeof obj === "object" &&
    obj !== null &&
    "response" in (obj as Record<string, unknown>)
  ) {
    const responseField = (obj as Record<string, unknown>).response;

    // Parse response if it's a JSON string (strip markdown code blocks first)
    let parsedResponse = responseField;
    if (typeof responseField === "string") {
      try {
        const stripped = stripMarkdownCodeBlock(responseField);
        parsedResponse = JSON.parse(stripped);
      } catch {
        // Not valid JSON
      }
    }

    // Try extracting from the parsed response
    const fromResponse = extractByPathDirect(parsedResponse, path);
    if (fromResponse !== undefined) {
      return fromResponse;
    }
  }

  return undefined;
}

/**
 * Apply template substitution
 * e.g., "The answer is: {{input}}" with input="hello" => "The answer is: hello"
 */
export function applyTemplate(template: string, input: unknown): string {
  // Replace {{input}} with the full input
  let result = template.replace(
    /\{\{input\}\}/g,
    typeof input === "string" ? input : JSON.stringify(input),
  );

  // Replace {{input.field}} with nested fields
  result = result.replace(/\{\{input\.([^}]+)\}\}/g, (_, path) => {
    const value = extractByPath(input, path);
    return typeof value === "string" ? value : JSON.stringify(value);
  });

  return result;
}

import ivm from "isolated-vm";

const SANDBOX_MEMORY_LIMIT_MB = 32;
const SANDBOX_TIMEOUT_MS = 5000;

/**
 * Execute user-supplied JavaScript inside an isolated V8 sandbox.
 *
 * Security boundaries enforced:
 *   - No access to process, require, global, fetch, console, setTimeout, or
 *     any Node-runtime globals. The isolate's global scope contains only
 *     `input`.
 *   - Hard memory cap (32 MB). Exceeding it throws.
 *   - Hard wall-clock timeout (5 s). Exceeding it throws.
 *   - Isolate is disposed after each call — no state leaks between executions.
 *
 * The user's code is wrapped in `(function(input){ ... })(input)` so they can
 * write a function body using `return value;`. Same contract the legacy
 * `new Function(...)`-based implementation exposed.
 *
 * Replaces an unsandboxed `new Function(...)` implementation that allowed
 * any authenticated user to read process.env and exfiltrate every server
 * secret. See Phase 28 security review (CRIT-01).
 */
export async function executeCode(
  code: string,
  input: unknown,
): Promise<unknown> {
  const isolate = new ivm.Isolate({ memoryLimit: SANDBOX_MEMORY_LIMIT_MB });
  try {
    const context = await isolate.createContext();
    await context.global.set(
      "input",
      new ivm.ExternalCopy(input).copyInto(),
    );
    const wrapped = `(function(input){${code}})(input)`;
    const script = await isolate.compileScript(wrapped, {
      filename: "user-transform.js",
    });
    return await script.run(context, {
      timeout: SANDBOX_TIMEOUT_MS,
      copy: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Code execution failed: ${msg}`);
  } finally {
    isolate.dispose();
  }
}

