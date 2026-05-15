/**
 * Conversational Workflow Builder API
 *
 * Uses GPT with tool calling to build workflows through natural conversation.
 */

import { Router, Request, Response } from "express";
import { getSupabase } from "../lib/supabase";
import { authMiddleware } from "../middleware/auth";

export const workflowChatRouter: Router = Router();

// Use OpenRouter for unified model access
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Use Claude Sonnet 4.6 for tool calling
const MODEL = "anthropic/claude-sonnet-4.6";

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
}

interface DraftResource {
  id: string;
  name: string;
  slug: string;
  serverSlug: string;
  description: string;
  cost: number;
  position: number;
}

interface WorkflowDraft {
  name: string | null;
  resources: DraftResource[];
  totalCost: number;
  status: "empty" | "building" | "ready" | "created";
  createdJobId?: string;
  createdJobName?: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  draft: WorkflowDraft;
  network: "solana" | "base";
}

interface ToolResult {
  tool: string;
  result: unknown;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIResponse {
  choices: Array<{
    message: OpenAIMessage;
  }>;
}

// ============================================================================
// Tool Definitions for GPT
// ============================================================================

const tools = [
  {
    type: "function",
    function: {
      name: "search_resources",
      description:
        "Search for resources that can help with the user's request. Use this when the user describes what they want to build or asks about available resources.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query describing what kind of resource is needed",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_workflow",
      description:
        "Add a resource to the current workflow draft. Use this when the user agrees to include a resource or says to add something.",
      parameters: {
        type: "object",
        properties: {
          resourceId: {
            type: "string",
            description: "The ID of the resource to add",
          },
        },
        required: ["resourceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_from_workflow",
      description:
        "Remove a resource from the current workflow draft. Use this when the user wants to remove a step.",
      parameters: {
        type: "object",
        properties: {
          resourceId: {
            type: "string",
            description: "The ID of the resource to remove",
          },
        },
        required: ["resourceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_workflow",
      description:
        "Create the workflow and save it as a job. Use this when the user confirms they want to create the workflow (says things like 'do it', 'create it', 'let's go', 'make it', 'ship it', 'yes').",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A short, descriptive name for the workflow",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_workflow",
      description:
        "Analyze the selected resources and propose the optimal workflow order. Use this when the user says 'continue with these resources' or wants to finalize their selection before creating. This determines the logical execution order.",
      parameters: {
        type: "object",
        properties: {
          proposedOrder: {
            type: "array",
            items: {
              type: "object",
              properties: {
                resourceId: {
                  type: "string",
                  description:
                    "The slug of the resource (e.g., 'enhance-prompt', 'pfpputer', 'veoputer')",
                },
                reason: {
                  type: "string",
                  description:
                    "Brief reason why this step comes at this position",
                },
              },
              required: ["resourceId", "reason"],
            },
            description:
              "The resources in their proposed execution order with brief reasons",
          },
          suggestedName: {
            type: "string",
            description:
              "A suggested name for the workflow based on what it does",
          },
        },
        required: ["proposedOrder", "suggestedName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_draft",
      description:
        "Clear the current workflow draft. Use this when the user wants to start over or abandon the current workflow.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ============================================================================
// Helper: Generate embedding (still using OpenAI for embeddings)
// ============================================================================

async function generateEmbedding(text: string): Promise<number[] | null> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data[0].embedding;
  } catch {
    return null;
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function searchResources(
  query: string,
  network: string,
): Promise<DraftResource[]> {
  const supabase = getSupabase();

  // Generate embedding for semantic search
  const embedding = await generateEmbedding(query);

  if (embedding) {
    // Semantic search
    const { data, error } = await supabase.rpc(
      "search_resources_by_embedding",
      {
        query_embedding: embedding,
        match_threshold: 0.25,
        match_count: 5,
        filter_network: network,
      },
    );

    if (!error && data) {
      return data.map((r: Record<string, unknown>, index: number) => ({
        id: r.id as string,
        name: r.name as string,
        slug: (r.slug as string) || (r.name as string),
        serverSlug: (r.server_slug as string) || "",
        description: (r.description as string) || "",
        cost: r.max_amount_required
          ? parseFloat(r.max_amount_required as string) / 1_000_000
          : 0,
        position: index + 1,
      }));
    }
  }

  // Fallback to keyword search
  const searchTerms = query.trim().split(/\s+/).filter(Boolean);
  if (searchTerms.length === 0) return [];

  const tsquery = searchTerms.map((t) => `${t}:*`).join(" & ");

  const { data, error } = await supabase
    .from("x402_resources")
    .select(
      `
      id, name, slug, description, max_amount_required,
      success_count_30d, failure_count_30d,
      server:x402_servers(slug)
    `,
    )
    .eq("is_active", true)
    .eq("network", network)
    .or("health_status.is.null,health_status.neq.offline") // Exclude offline resources
    .textSearch("search_vector", tsquery, {
      type: "websearch",
      config: "english",
    })
    .limit(20); // Fetch more to filter by success rate

  if (error || !data) return [];

  // Filter by success rate: >= 70% OR no usage data yet
  const filteredData = data
    .filter((r) => {
      const successCount = r.success_count_30d || 0;
      const failureCount = r.failure_count_30d || 0;
      const totalCalls = successCount + failureCount;

      // No usage data - give new resources a chance
      if (totalCalls === 0) return true;

      // Require >= 70% success rate
      const successRate = successCount / totalCalls;
      return successRate >= 0.7;
    })
    .slice(0, 5); // Limit to 5 after filtering

  return filteredData.map((r, index) => ({
    id: r.id,
    name: r.name,
    slug: r.slug || r.name,
    serverSlug: (r.server as unknown as { slug: string } | null)?.slug || "",
    description: r.description || "",
    cost: r.max_amount_required
      ? parseFloat(r.max_amount_required) / 1_000_000
      : 0,
    position: index + 1,
  }));
}

async function getResourceById(
  resourceId: string,
): Promise<DraftResource | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("x402_resources")
    .select(
      `
      id, name, slug, description, max_amount_required, resource_url, network,
      server:x402_servers(id, name, slug)
    `,
    )
    .eq("id", resourceId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug || data.name,
    serverSlug: (data.server as unknown as { slug: string } | null)?.slug || "",
    description: data.description || "",
    cost: data.max_amount_required
      ? parseFloat(data.max_amount_required) / 1_000_000
      : 0,
    position: 0,
  };
}

interface ResourceSchema {
  input?: {
    bodyFields?: Record<
      string,
      { required?: boolean; description?: string; type?: string }
    >;
    queryParams?: Record<
      string,
      { required?: boolean; description?: string; type?: string }
    >;
    headerFields?: Record<
      string,
      { required?: boolean; description?: string; type?: string }
    >;
  };
}

interface WorkflowInput {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "file";
  required: boolean;
  description?: string;
  default?: string;
}

async function createJob(
  userId: string,
  name: string,
  draft: WorkflowDraft,
  network: string,
  userPrompt: string, // Original user request for extracting defaults
): Promise<{ id: string; name: string } | null> {
  const supabase = getSupabase();

  // Generate a unique name by appending a short random suffix
  const uniqueSuffix = Math.random().toString(36).substring(2, 6);
  const uniqueName = `${name} ${uniqueSuffix}`;

  // Fetch full resource details including schemas
  const resourceIds = draft.resources.map((r) => r.id);
  const { data: resourceData, error: fetchError } = await supabase
    .from("x402_resources")
    .select(
      `
      id, name, slug, description, resource_url, network, max_amount_required,
      output_schema, avatar_url,
      server:x402_servers(id, name, slug)
    `,
    )
    .in("id", resourceIds);

  if (fetchError) {
    console.error("[createJob] Failed to fetch resource schemas:", fetchError);
  }

  // Map resource ID to full resource data
  const resourceDetails = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      description: string;
      resourceUrl: string;
      network: string;
      price: number;
      avatarUrl: string | null;
      outputSchema: ResourceSchema;
      serverSlug: string;
    }
  >();

  resourceData?.forEach((r) => {
    const server = r.server as unknown as {
      id: string;
      name: string;
      slug: string;
    } | null;
    resourceDetails.set(r.id, {
      id: r.id,
      name: r.name,
      slug: r.slug || r.name,
      description: r.description || "",
      resourceUrl: r.resource_url || "",
      network: r.network || network,
      price: r.max_amount_required
        ? parseFloat(r.max_amount_required) / 1_000_000
        : 0,
      avatarUrl: r.avatar_url,
      outputSchema: (r.output_schema as ResourceSchema) || {},
      serverSlug: server?.slug || "",
    });
  });

  // Helper to convert field name to param name
  const toParamName = (fieldName: string): string => {
    return fieldName
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, "_")
      .toLowerCase();
  };

  // ============================================================================
  // Step 1: Use GPT to analyze data flow and determine wiring
  // ============================================================================

  // Build a description of each resource for GPT
  const resourceDescriptions = draft.resources.map((resource, index) => {
    const details = resourceDetails.get(resource.id);
    const schema = details?.outputSchema;
    const allFields = schema?.input
      ? {
          ...(schema.input.bodyFields || {}),
          ...(schema.input.queryParams || {}),
        }
      : {};

    // Include REQUIRED fields
    const requiredFields = Object.entries(allFields)
      .filter(([, def]) => def.required)
      .map(([name, def]) => `${name} (REQUIRED): ${def.description || name}`);

    // Include important OPTIONAL fields that are commonly used as main inputs
    const importantOptionalFields = Object.entries(allFields)
      .filter(
        ([name, def]) =>
          !def.required &&
          [
            "prompt",
            "basePrompt",
            "text",
            "query",
            "input",
            "message",
          ].includes(name),
      )
      .map(([name, def]) => `${name} (optional): ${def.description || name}`);

    // Determine what this resource likely outputs based on its description
    const desc = (
      details?.description ||
      resource.description ||
      ""
    ).toLowerCase();
    let outputType = "response"; // default: text/JSON response
    if (
      desc.includes("image") ||
      desc.includes("pfp") ||
      desc.includes("picture") ||
      desc.includes("photo")
    ) {
      outputType = "response.artifactUrl (image URL)";
    } else if (desc.includes("video") || desc.includes("veo")) {
      outputType = "response.artifactUrl (video URL)";
    } else if (
      desc.includes("prompt") ||
      desc.includes("text") ||
      desc.includes("enhance")
    ) {
      outputType = "response (enhanced text)";
    }

    return {
      position: index + 1,
      slug: resource.slug,
      name: details?.name || resource.name,
      description: details?.description || resource.description,
      inputs: [...requiredFields, ...importantOptionalFields],
      outputType,
    };
  });

  // Wiring map: { "resourcePosition:fieldName": { source: "trigger" | "resource-N", field?: string } }
  type WiringSource =
    | { source: "trigger"; inputName: string }
    | { source: string; field: string };
  const wiringMap: Record<string, WiringSource> = {};

  // Ask GPT to analyze the workflow and determine wiring
  if (OPENROUTER_API_KEY) {
    try {
      const wiringPrompt = `Analyze this workflow and determine how to wire ALL inputs.

USER'S INTENT: "${userPrompt}"

WORKFLOW STEPS (in execution order):
${resourceDescriptions
  .map(
    (r) => `
Step ${r.position}: ${r.slug}
- Description: ${r.description}
- Inputs: ${r.inputs.length > 0 ? r.inputs.join(", ") : "none"}
- Output: ${r.outputType}
`,
  )
  .join("\n")}

TASK: Determine the source for EVERY input field (both required AND important optional ones like "prompt", "basePrompt"):

VALID SOURCES (only use these):
1. "trigger" - User-provided value (becomes a job parameter). Use for:
   - ALL inputs on the FIRST resource (step 1)
   - Any value the user specifies (dates, locations, prompts, names, etc.)
   - Any required field that doesn't have data from a previous step
2. "resource-N" - Output from step N. Use for:
   - Chaining outputs between steps (e.g., image URL from step 2 to video input in step 3)

OUTPUT FIELD NAMING:
- For text/prompt outputs: use "response"
- For image generators (pfpputer, image tools): use "response.artifactUrl"  
- For video generators (veoputer, video tools): use "response.artifactUrl"

RULES:
1. For SINGLE-RESOURCE workflows: ALL required inputs must come from "trigger"
2. For MULTI-RESOURCE workflows:
   - First resource inputs come from "trigger"
   - Later resources can get data from previous resource outputs OR from "trigger"
3. User-specified values (dates, airports, prompts) ALWAYS come from "trigger"

Return JSON mapping "stepPosition:fieldName" to source:
{
  "1:departureId": { "source": "trigger", "inputName": "departure_airport" },
  "1:arrivalId": { "source": "trigger", "inputName": "arrival_airport" },
  "1:outboundDate": { "source": "trigger", "inputName": "outbound_date" },
  "2:prompt": { "source": "resource-1", "field": "response" },
  "3:source_image_url": { "source": "resource-2", "field": "response.artifactUrl" }
}

Include ALL required inputs. Use descriptive inputName values.
Return ONLY the JSON object.`;

      console.log("[createJob] Asking GPT to analyze workflow wiring...");

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer":
            process.env.OPENROUTER_HTTP_REFERER || "https://x402.jobs",
          "X-Title":
            process.env.OPENROUTER_X_TITLE || "x402.jobs Workflow Builder",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: wiringPrompt }],
          max_tokens: 1000,
          temperature: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log("[createJob] GPT wiring analysis:", parsed);

          // Populate wiringMap
          for (const [key, value] of Object.entries(parsed)) {
            wiringMap[key] = value as WiringSource;
          }
        }
      }
    } catch (err) {
      console.error("[createJob] Failed to analyze wiring:", err);
      // Continue with fallback (all inputs from trigger)
    }
  }

  // ============================================================================
  // Step 2: Collect workflow inputs from wiring map (fields that come from trigger)
  // ============================================================================

  const workflowInputs: WorkflowInput[] = [];
  const usedNames = new Set<string>();
  const fieldToInputMap: Record<string, string> = {}; // "resourceId:fieldName" -> inputName

  // First, process all trigger-sourced fields from the wiring map
  // Also treat "static" as "trigger" since static values should become job parameters
  for (const [wiringKey, wiring] of Object.entries(wiringMap)) {
    const isTriggerSource =
      wiring.source === "trigger" || wiring.source === "static";
    if (!isTriggerSource) continue;

    const triggerWiring = wiring as {
      source: string;
      inputName?: string;
      field?: string;
    };
    const parts = wiringKey.split(":");
    const posStr = parts[0];
    const fieldName = parts[1];
    if (!posStr || !fieldName) continue;

    const position = parseInt(posStr);
    const resource = draft.resources.find((r) => r.position === position);
    if (!resource) continue;

    const details = resourceDetails.get(resource.id);
    const schema = details?.outputSchema;
    const allFields: Record<
      string,
      { required?: boolean; description?: string }
    > = schema?.input
      ? {
          ...(schema.input.bodyFields || {}),
          ...(schema.input.queryParams || {}),
        }
      : {};
    const fieldDef = allFields[fieldName];

    // Use the inputName from GPT's wiring, or derive from field name
    let paramName =
      triggerWiring.inputName || triggerWiring.field || toParamName(fieldName);
    // Clean up paramName (remove "response" prefix if present)
    if (paramName === "response") {
      paramName = toParamName(fieldName);
    }
    if (usedNames.has(paramName)) {
      paramName = `${paramName}_${position}`;
    }
    usedNames.add(paramName);

    workflowInputs.push({
      name: paramName,
      type: "string",
      required: fieldDef?.required ?? false,
      description: fieldDef?.description || fieldName.replace(/_/g, " "),
    });

    fieldToInputMap[`${resource.id}:${fieldName}`] = paramName;

    // Update wiringMap to use trigger with the actual param name
    wiringMap[wiringKey] = { source: "trigger", inputName: paramName };
  }

  // Also check for any required fields that weren't covered by GPT's wiring
  for (const resource of draft.resources) {
    const details = resourceDetails.get(resource.id);
    const schema = details?.outputSchema;
    if (!schema?.input) continue;

    const allFields = {
      ...(schema.input.bodyFields || {}),
      ...(schema.input.queryParams || {}),
    };

    for (const [fieldName, fieldDef] of Object.entries(allFields)) {
      if (!fieldDef.required) continue;

      const wiringKey = `${resource.position}:${fieldName}`;
      if (wiringMap[wiringKey]) continue; // Already handled

      // Required field not in wiring map - add as job parameter
      let paramName = toParamName(fieldName);
      if (usedNames.has(paramName)) {
        paramName = `${paramName}_${resource.position}`;
      }
      usedNames.add(paramName);

      workflowInputs.push({
        name: paramName,
        type: "string",
        required: true,
        description: fieldDef.description || fieldName.replace(/_/g, " "),
      });

      fieldToInputMap[`${resource.id}:${fieldName}`] = paramName;
      wiringMap[wiringKey] = { source: "trigger", inputName: paramName };
    }
  }

  console.log(
    `[createJob] Created ${workflowInputs.length} workflow inputs (job parameters):`,
    workflowInputs.map((w) => w.name),
  );

  // Use GPT to extract default values from the user's prompt
  if (userPrompt && workflowInputs.length > 0 && OPENROUTER_API_KEY) {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const dateStr = today.toISOString().split("T")[0];

      const extractionPrompt = `Given this user request: "${userPrompt}"

TODAY'S DATE: ${dateStr}
CURRENT YEAR: ${currentYear}

Extract values for these fields (return JSON object with field names as keys):
${workflowInputs.map((input) => `- ${input.name}: ${input.description || input.name}`).join("\n")}

RULES:
1. Only extract values explicitly mentioned or clearly implied by the user.
2. For dates without a year, use ${currentYear} if the date hasn't passed yet, otherwise ${currentYear + 1}.
3. Use formats: dates as YYYY-MM-DD, airport codes as 3-letter codes (e.g., JFK, NRT, TYO).
4. For "Tokyo", use NRT or TYO. For "New York", use JFK. Etc.
5. If a value cannot be determined, omit it from the response.
6. For trip_type: use "round-trip" if return date is mentioned, "one-way" otherwise.

Return ONLY a JSON object like: {"field_name": "value", ...}`;

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer":
            process.env.OPENROUTER_HTTP_REFERER || "https://x402.jobs",
          "X-Title":
            process.env.OPENROUTER_X_TITLE || "x402.jobs Workflow Builder",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: extractionPrompt }],
          max_tokens: 500,
          temperature: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        // Parse JSON from response (handle markdown code blocks)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const defaults = JSON.parse(jsonMatch[0]);
          console.log("[createJob] Extracted defaults from prompt:", defaults);

          // Apply defaults to workflow inputs
          for (const input of workflowInputs) {
            if (defaults[input.name] !== undefined) {
              input.default = String(defaults[input.name]);
            }
          }
        }
      }
    } catch (err) {
      console.error("[createJob] Failed to extract defaults:", err);
      // Continue without defaults - not critical
    }
  }

  // Build workflow definition
  const nodes: unknown[] = [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 300, y: 100 },
      data: {
        label: "Manual Trigger",
        triggerType: "manual",
        workflowInputs,
      },
    },
  ];

  const edges: unknown[] = [];
  let prevNodeId = "trigger-1";
  let yPos = 280;

  for (const resource of draft.resources) {
    const nodeId = `resource-${resource.position}`;
    const details = resourceDetails.get(resource.id);
    const schema = details?.outputSchema;

    // Wire up inputs using the wiring map
    // configuredInputs format: { fieldName: { type: "reference", sourceNodeId, sourceField } }
    const configuredInputs: Record<
      string,
      {
        type: string;
        value?: string;
        sourceNodeId?: string;
        sourceField?: string;
      }
    > = {};

    // Wire ALL fields that are in the wiringMap (required and optional)
    // First, process all wiring entries for this resource
    for (const [wiringKey, wiring] of Object.entries(wiringMap)) {
      const parts = wiringKey.split(":");
      const posStr = parts[0];
      const fieldName = parts[1];
      if (!posStr || !fieldName) continue;
      if (parseInt(posStr) !== resource.position) continue;

      if (wiring.source === "trigger") {
        // Wire from trigger (job parameter)
        configuredInputs[fieldName] = {
          type: "reference",
          sourceNodeId: "trigger-1",
          sourceField: (wiring as { source: "trigger"; inputName: string })
            .inputName,
        };
      } else {
        // Wire from previous resource output
        configuredInputs[fieldName] = {
          type: "reference",
          sourceNodeId: wiring.source,
          sourceField:
            (wiring as { source: string; field: string }).field || "response",
        };
      }
    }

    // Also check for any required fields that might have been missed
    if (schema?.input) {
      const allFields = {
        ...(schema.input.bodyFields || {}),
        ...(schema.input.queryParams || {}),
      };

      for (const [fieldName, fieldDef] of Object.entries(allFields)) {
        if (!fieldDef.required) continue;
        if (configuredInputs[fieldName]) continue; // Already wired

        // Fallback: check if we have a job parameter for this field
        const mapKey = `${resource.id}:${fieldName}`;
        const inputName = fieldToInputMap[mapKey];
        if (inputName) {
          configuredInputs[fieldName] = {
            type: "reference",
            sourceNodeId: "trigger-1",
            sourceField: inputName,
          };
        }
      }
    }

    console.log(
      `[createJob] Resource ${resource.position} (${resource.slug}) configuredInputs:`,
      Object.keys(configuredInputs),
    );

    // Build the resource object in the format the frontend expects
    nodes.push({
      id: nodeId,
      type: "resource",
      position: { x: 300, y: yPos },
      data: {
        resource: details
          ? {
              id: details.id,
              name: details.name,
              slug: details.slug,
              serverSlug: details.serverSlug,
              description: details.description,
              resourceUrl: details.resourceUrl,
              price: details.price,
              network: details.network,
              avatarUrl: details.avatarUrl,
              outputSchema: details.outputSchema,
            }
          : {
              id: resource.id,
              name: resource.name,
              slug: resource.slug,
              serverSlug: resource.serverSlug,
              price: resource.cost,
            },
        configuredInputs,
      },
    });

    edges.push({
      id: `${prevNodeId}-${nodeId}`,
      source: prevNodeId,
      target: nodeId,
    });

    prevNodeId = nodeId;
    yPos += 180;
  }

  // Add output node at the end
  const outputNodeId = "output-1";
  nodes.push({
    id: outputNodeId,
    type: "output",
    position: { x: 300, y: yPos },
    data: {
      label: "Output",
      outputType: "lastResult",
    },
  });
  edges.push({
    id: `${prevNodeId}-${outputNodeId}`,
    source: prevNodeId,
    target: outputNodeId,
  });

  // Create the job
  console.log(
    `[createJob] Creating job "${uniqueName}" for user ${userId} on ${network}`,
  );
  console.log(
    `[createJob] Workflow has ${nodes.length} nodes, ${edges.length} edges`,
  );

  const { data: job, error } = await supabase
    .from("x402_jobs")
    .insert({
      user_id: userId,
      name: uniqueName,
      description: `AI-generated workflow with ${draft.resources.length} step${draft.resources.length !== 1 ? "s" : ""}`,
      network,
      workflow_definition: { nodes, edges },
      trigger_type: "manual",
      trigger_config: {},
      output_type: "ui",
      output_config: {},
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("[createJob] ❌ Failed to create job:", error);
    console.error("[createJob] Error details:", JSON.stringify(error, null, 2));
    return null;
  }

  console.log(`[createJob] ✅ Job created successfully: ${job.id}`);
  return job;
}

// ============================================================================
// System Prompt
// ============================================================================

function getSystemPrompt(draft: WorkflowDraft, network: string): string {
  const draftSummary =
    draft.resources.length > 0
      ? `\n\nCurrent workflow draft (${draft.resources.length} step${draft.resources.length !== 1 ? "s" : ""}, $${draft.totalCost.toFixed(2)}/run, status: ${draft.status}):\n${draft.resources.map((r, i) => `${i + 1}. ${r.serverSlug}/${r.slug} ($${r.cost.toFixed(2)})`).join("\n")}`
      : "\n\nNo workflow draft yet.";

  // Different instructions based on current state
  if (draft.status === "ready") {
    return `You are Jobputer. The user has already confirmed their resource selection and you proposed the workflow order.

STATUS IS "ready" - THE WORKFLOW ORDER HAS BEEN PROPOSED AND ACCEPTED.

When user says ANYTHING positive (yes, ok, create it, do it, looks good, let's go, sure, yeah, nice, cool, perfect, sounds good, go ahead):
→ IMMEDIATELY call create_workflow with the suggested name "${draft.name || "Workflow"}"

DO NOT:
- Search for more resources
- Propose the workflow again
- Ask any questions
- Show any resource cards

JUST CREATE THE WORKFLOW. That's it. One tool call: create_workflow.
${draftSummary}`;
  }

  return `You are Jobputer, an AI that builds automated workflows on x402.jobs (${network} network).

TOOLS:
- search_resources: Search for resources that can help with the user's task
- propose_workflow: Propose the optimal execution order for selected resources
- create_workflow: Create the final workflow
- remove_from_workflow: Remove a resource from the draft
- clear_draft: Start over

CRITICAL RULE - ALWAYS SEARCH FIRST:
When user describes ANY task (flights, images, videos, data, whatever):
→ IMMEDIATELY call search_resources
→ DO NOT say "I can't do that" or "I don't have that capability"
→ DO NOT assume what resources exist or don't exist
→ JUST SEARCH. Let the results speak for themselves.
→ If no results found, THEN tell the user

WORKFLOW FLOW:
1. User describes task → CALL search_resources (ALWAYS)
2. User clicks "Continue" → CALL propose_workflow with logical order
3. User confirms → CALL create_workflow

WHEN PROPOSING (propose_workflow):
- Analyze resources and determine execution order
- Consider data flow (e.g., prompt enhancer → image generator → video maker)
- Use resourceId = the slug (e.g., "enhance-prompt", "pfpputer", "veoputer")
- End with "Ready to create?"

RULES:
- NEVER refuse to search. ALWAYS try search_resources first.
- Keep responses SHORT (1-2 sentences)
- Format costs as $X.XX
${draftSummary}`;
}

// ============================================================================
// Call LLM via OpenRouter
// ============================================================================

async function callLLM(
  messages: Array<{
    role: string;
    content: string | null;
    tool_call_id?: string;
  }>,
  includeTools: boolean = true,
): Promise<OpenAIMessage | null> {
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not set");
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    };

    if (includeTools) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    console.log(
      `[WorkflowChat] Calling ${MODEL} via OpenRouter with ${messages.length} messages, tools=${includeTools}`,
    );

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.OPENROUTER_HTTP_REFERER || "https://x402.jobs",
        "X-Title":
          process.env.OPENROUTER_X_TITLE || "x402.jobs Workflow Builder",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter API error:", error);
      return null;
    }

    const data: OpenAIResponse = await response.json();
    const message = data.choices[0]?.message;

    if (message?.tool_calls) {
      console.log(
        `[WorkflowChat] LLM made ${message.tool_calls.length} tool call(s):`,
        message.tool_calls.map((tc) => tc.function.name).join(", "),
      );
    } else {
      console.log(
        `[WorkflowChat] LLM response (no tools):`,
        message?.content?.slice(0, 100),
      );
    }

    return message || null;
  } catch (error) {
    console.error("OpenRouter API call failed:", error);
    return null;
  }
}

// ============================================================================
// Main Chat Endpoint
// ============================================================================

workflowChatRouter.post(
  "/chat",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { messages, draft, network } = req.body as ChatRequest;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages required" });
      }

      let currentDraft: WorkflowDraft = draft || {
        name: null,
        resources: [],
        totalCost: 0,
        status: "empty",
      };

      console.log(
        `[WorkflowChat] Received request with ${messages.length} messages`,
      );
      console.log(
        `[WorkflowChat] Last message: "${messages[messages.length - 1]?.content}"`,
      );
      console.log(
        `[WorkflowChat] Draft status: ${currentDraft.status}, resources: ${currentDraft.resources.length}`,
      );
      if (currentDraft.resources.length > 0) {
        console.log(
          `[WorkflowChat] Draft resources:`,
          currentDraft.resources.map((r) => r.name),
        );
      }

      const toolResults: ToolResult[] = [];
      let searchResults: DraftResource[] = [];

      // Build messages for GPT
      const gptMessages: Array<{
        role: string;
        content: string | null;
        tool_call_id?: string;
      }> = [
        { role: "system", content: getSystemPrompt(currentDraft, network) },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      // Call LLM with tools
      const assistantMessage = await callLLM(gptMessages);
      if (!assistantMessage) {
        return res.status(500).json({ error: "No response from AI" });
      }

      // Process tool calls
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        for (const toolCall of assistantMessage.tool_calls) {
          const fn = toolCall.function;
          const args = JSON.parse(fn.arguments);

          switch (fn.name) {
            case "search_resources": {
              searchResults = await searchResources(args.query, network);
              toolResults.push({
                tool: "search_resources",
                result: searchResults,
              });

              // Don't auto-add search results - let user click to select
              // This allows users to choose specific resources when multiple
              // have the same name from different servers
              if (searchResults.length > 0 && currentDraft.status === "empty") {
                currentDraft.status = "building";
              }
              break;
            }

            case "add_to_workflow": {
              // Check if resource is in search results or fetch it
              let resource = searchResults.find(
                (r) => r.id === args.resourceId,
              );
              if (!resource) {
                resource =
                  (await getResourceById(args.resourceId)) || undefined;
              }

              if (
                resource &&
                !currentDraft.resources.some((r) => r.id === resource!.id)
              ) {
                resource.position = currentDraft.resources.length + 1;
                currentDraft.resources.push(resource);
                currentDraft.totalCost = currentDraft.resources.reduce(
                  (sum, r) => sum + r.cost,
                  0,
                );
                currentDraft.status = "building";
              }

              toolResults.push({
                tool: "add_to_workflow",
                result: { added: resource?.name || args.resourceId },
              });
              break;
            }

            case "remove_from_workflow": {
              const idx = currentDraft.resources.findIndex(
                (r) => r.id === args.resourceId,
              );
              if (idx >= 0) {
                currentDraft.resources.splice(idx, 1);
                // Reindex positions
                currentDraft.resources.forEach((r, i) => (r.position = i + 1));
                currentDraft.totalCost = currentDraft.resources.reduce(
                  (sum, r) => sum + r.cost,
                  0,
                );
                if (currentDraft.resources.length === 0) {
                  currentDraft.status = "empty";
                }
              }
              toolResults.push({
                tool: "remove_from_workflow",
                result: { removed: args.resourceId },
              });
              break;
            }

            case "propose_workflow": {
              console.log(
                `[WorkflowChat] propose_workflow called with order:`,
                args.proposedOrder,
              );
              console.log(
                `[WorkflowChat] Suggested name: ${args.suggestedName}`,
              );
              console.log(
                `[WorkflowChat] Current draft resources:`,
                currentDraft.resources.map((r) => ({
                  id: r.id,
                  slug: r.slug,
                  name: r.name,
                })),
              );

              // Clear search results - we're past the selection phase
              searchResults = [];

              if (
                currentDraft.resources.length > 0 &&
                args.proposedOrder?.length > 0
              ) {
                // Reorder resources based on proposed order
                const orderedResources: DraftResource[] = [];
                const proposedOrder = args.proposedOrder as Array<{
                  resourceId: string;
                  reason: string;
                }>;

                // Helper to get unique key for a resource
                const getResourceKey = (r: {
                  serverSlug?: string;
                  slug?: string;
                  name?: string;
                  id?: string;
                }) => {
                  if (r.serverSlug && (r.slug || r.name)) {
                    return `${r.serverSlug}/${r.slug || r.name}`.toLowerCase();
                  }
                  return (r.id || r.slug || r.name || "").toLowerCase();
                };

                // Track which resources have been matched by their unique key
                const matchedKeys = new Set<string>();

                for (let i = 0; i < proposedOrder.length; i++) {
                  const item = proposedOrder[i];
                  if (!item) continue;
                  const { resourceId } = item;
                  const normalizedId = resourceId.toLowerCase().trim();

                  // Match by unique key (serverSlug/slug), then ID, then fallbacks
                  // Prioritize exact full path match to handle same-name resources from different servers
                  const resource = currentDraft.resources.find((r) => {
                    const resourceKey = getResourceKey(r);
                    const normalizedSlug = (r.slug || "").toLowerCase();
                    const normalizedName = (r.name || "").toLowerCase();

                    // Skip if this resource was already matched
                    if (matchedKeys.has(resourceKey)) {
                      return false;
                    }

                    // Priority 1: Exact full path match (serverSlug/slug)
                    if (resourceKey === normalizedId) {
                      return true;
                    }

                    // Priority 2: Exact ID match
                    if (r.id === resourceId) {
                      return true;
                    }

                    // Priority 3: Full path contains or is contained (for partial matches)
                    if (
                      resourceKey.includes(normalizedId) ||
                      normalizedId.includes(resourceKey)
                    ) {
                      return true;
                    }

                    // Priority 4: Slug-only match (only if no serverSlug in the query)
                    // This is a fallback - avoid if possible since it can match wrong resource
                    if (!normalizedId.includes("/")) {
                      if (
                        normalizedSlug === normalizedId ||
                        normalizedName.includes(normalizedId)
                      ) {
                        return true;
                      }
                    }

                    return false;
                  });

                  console.log(
                    `[WorkflowChat] Looking for "${resourceId}", found:`,
                    resource
                      ? `${resource.serverSlug}/${resource.slug}`
                      : "NOT FOUND",
                  );

                  if (resource) {
                    const resourceKey = getResourceKey(resource);
                    if (!matchedKeys.has(resourceKey)) {
                      matchedKeys.add(resourceKey);
                      orderedResources.push({
                        ...resource,
                        position: i + 1,
                      });
                    }
                  }
                }

                console.log(
                  `[WorkflowChat] Ordered resources:`,
                  orderedResources.length,
                  orderedResources.map((r) => r.slug),
                );

                // If we couldn't match any resources, keep the original order but still set ready
                if (
                  orderedResources.length === 0 &&
                  currentDraft.resources.length > 0
                ) {
                  console.log(
                    `[WorkflowChat] No matches found, keeping original order`,
                  );
                  orderedResources.push(...currentDraft.resources);
                }

                // Update draft with reordered resources and set status to "ready"
                currentDraft.resources = orderedResources;
                currentDraft.status = "ready";
                currentDraft.name = args.suggestedName;
                currentDraft.totalCost = orderedResources.reduce(
                  (sum, r) => sum + r.cost,
                  0,
                );

                console.log(
                  `[WorkflowChat] After propose - Draft status: ${currentDraft.status}, resources: ${currentDraft.resources.length}`,
                );

                toolResults.push({
                  tool: "propose_workflow",
                  result: {
                    success: true,
                    proposedOrder: proposedOrder.map((p, i) => ({
                      step: i + 1,
                      resourceId: p.resourceId,
                      reason: p.reason,
                    })),
                    suggestedName: args.suggestedName,
                    totalCost: currentDraft.totalCost,
                  },
                });
              } else {
                toolResults.push({
                  tool: "propose_workflow",
                  result: { success: false, error: "No resources to propose" },
                });
              }
              break;
            }

            case "create_workflow": {
              console.log(
                `[WorkflowChat] create_workflow called with name: ${args.name}`,
              );
              console.log(
                `[WorkflowChat] Draft has ${currentDraft.resources.length} resources:`,
                currentDraft.resources.map(
                  (r) => `${r.name} (pos:${r.position})`,
                ),
              );

              // Clear search results - we're creating now
              searchResults = [];

              if (currentDraft.resources.length > 0) {
                // Extract the original user prompt for default value extraction
                const userPrompt = messages
                  .filter((m) => m.role === "user")
                  .map((m) => m.content)
                  .join(" ");

                const job = await createJob(
                  userId,
                  args.name,
                  currentDraft,
                  network,
                  userPrompt,
                );
                if (job) {
                  console.log(
                    `[WorkflowChat] ✅ Job created: ${job.id} - ${job.name}`,
                  );
                  currentDraft.status = "created";
                  currentDraft.name = job.name;
                  currentDraft.createdJobId = job.id;
                  currentDraft.createdJobName = job.name;
                  toolResults.push({
                    tool: "create_workflow",
                    result: { success: true, jobId: job.id, jobName: job.name },
                  });
                } else {
                  console.log(`[WorkflowChat] ❌ createJob returned null`);
                  toolResults.push({
                    tool: "create_workflow",
                    result: {
                      success: false,
                      error: "Failed to create job in database",
                    },
                  });
                }
              } else {
                console.log(
                  `[WorkflowChat] ❌ No resources in draft, cannot create job`,
                );
                toolResults.push({
                  tool: "create_workflow",
                  result: {
                    success: false,
                    error: "No resources in workflow draft",
                  },
                });
              }
              break;
            }

            case "clear_draft": {
              currentDraft = {
                name: null,
                resources: [],
                totalCost: 0,
                status: "empty",
              };
              toolResults.push({
                tool: "clear_draft",
                result: { cleared: true },
              });
              break;
            }
          }
        }

        // If tools were called, get a follow-up response
        if (toolResults.length > 0) {
          const toolMessages = [
            ...gptMessages,
            {
              role: "assistant",
              content: assistantMessage.content,
              tool_calls: assistantMessage.tool_calls,
            },
            ...assistantMessage.tool_calls.map((tc, i) => ({
              role: "tool" as const,
              tool_call_id: tc.id,
              content: JSON.stringify(toolResults[i]?.result || {}),
            })),
          ];

          const followUp = await callLLM(
            toolMessages as Array<{
              role: string;
              content: string | null;
              tool_call_id?: string;
            }>,
            false,
          );
          const followUpContent = followUp?.content || "";

          return res.json({
            message: followUpContent,
            draft: currentDraft,
            toolResults,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
          });
        }
      }

      // No tools called — just return the message
      return res.json({
        message: assistantMessage.content || "",
        draft: currentDraft,
        toolResults: [],
      });
    } catch (error) {
      console.error("Workflow chat error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);
