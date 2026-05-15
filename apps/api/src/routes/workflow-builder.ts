import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { generateRandomJobName } from "../lib/randomNames";
import { getSupabase } from "../lib/supabase";

// Single router - auth is applied per-route
export const workflowBuilderRouter: Router = Router();

// OpenAI API for embeddings and planning
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ResourceMatch {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  url: string;
  network: string;
  price: number;
  category: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
  avatarUrl: string | null;
  similarity: number;
  outputSchema: Record<string, unknown> | null;
  server: {
    id: string;
    name: string;
    slug: string | null;
    faviconUrl: string | null;
  } | null;
}

interface WorkflowProposal {
  name: string;
  description: string;
  network: string;
  estimatedCost: number;
  steps: Array<{
    order: number;
    resourceId: string;
    resourceName: string;
    resourceSlug?: string;
    resourceUrl: string;
    price: number;
    purpose: string;
    inputMapping: Record<
      string,
      string | { type: "reference"; sourceNodeId: string; sourceField: string }
    >; // Maps input fields to sources
    serverId?: string;
    serverName?: string;
    serverSlug?: string;
    outputSchema?: Record<string, unknown>;
  }>;
  nodes: Array<{
    id: string;
    type: "trigger" | "resource" | "output" | "transform";
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

// Generate embedding for a query
async function generateEmbedding(text: string): Promise<number[] | null> {
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

// Search resources using semantic search
async function searchResources(
  query: string,
  network?: string,
  limit = 10,
): Promise<ResourceMatch[]> {
  const supabase = getSupabase();

  // Generate embedding
  const embedding = await generateEmbedding(query);

  if (embedding) {
    // Use semantic search
    const { data, error } = await supabase.rpc(
      "search_resources_by_embedding",
      {
        query_embedding: embedding,
        match_threshold: 0.25,
        match_count: limit,
        filter_network: network || null,
      },
    );

    if (!error && data) {
      return data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: r.name as string,
        slug: r.slug as string | null,
        description: r.description as string | null,
        url: r.resource_url as string,
        network: r.network as string,
        price: r.max_amount_required
          ? parseFloat(r.max_amount_required as string) / 1_000_000
          : 0,
        category: r.category as string,
        capabilities: (r.capabilities as string[]) || [],
        inputTypes: (r.input_types as string[]) || [],
        outputTypes: (r.output_types as string[]) || [],
        avatarUrl: r.avatar_url as string | null,
        similarity: r.similarity as number,
        outputSchema: (r.output_schema as Record<string, unknown>) || null,
        server: r.server_name
          ? {
              id: r.server_id as string,
              name: r.server_name as string,
              slug: r.server_slug as string | null,
              faviconUrl: r.server_favicon_url as string | null,
            }
          : null,
      }));
    }
  }

  // Fallback to keyword search
  const searchTerms = query.trim().split(/\s+/).filter(Boolean);
  const tsquery = searchTerms.map((t) => `${t}:*`).join(" & ");

  let dbQuery = supabase
    .from("x402_resources")
    .select(
      `
      id, name, slug, description, resource_url, network, max_amount_required,
      category, capabilities, input_types, output_types, avatar_url, output_schema,
      server:x402_servers(id, name, slug, favicon_url)
    `,
    )
    .eq("is_active", true)
    .or("health_status.is.null,health_status.neq.offline") // Exclude offline resources
    .textSearch("search_vector", tsquery, {
      type: "websearch",
      config: "english",
    })
    .limit(limit);

  if (network) {
    dbQuery = dbQuery.eq("network", network);
  }

  const { data, error } = await dbQuery;

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug || null,
    description: r.description,
    url: r.resource_url,
    network: r.network,
    price: r.max_amount_required
      ? parseFloat(r.max_amount_required) / 1_000_000
      : 0,
    category: r.category,
    capabilities: r.capabilities || [],
    inputTypes: r.input_types || [],
    outputTypes: r.output_types || [],
    avatarUrl: r.avatar_url,
    similarity: 0.5, // Placeholder for keyword search
    outputSchema: r.output_schema || null,
    server: r.server
      ? {
          id: (r.server as unknown as { id: string }).id,
          name: (r.server as unknown as { name: string }).name,
          slug: (r.server as unknown as { slug: string | null }).slug,
          faviconUrl: (r.server as unknown as { favicon_url: string | null })
            .favicon_url,
        }
      : null,
  }));
}

// Use GPT to plan the workflow
async function planWorkflow(
  userRequest: string,
  availableResources: ResourceMatch[],
): Promise<{
  selectedResources: string[]; // Resource IDs in order
  reasoning: string;
  suggestedName: string;
} | null> {
  if (!OPENAI_API_KEY) return null;

  const resourceDescriptions = availableResources
    .map(
      (r, i) =>
        `${i + 1}. [${r.id}] "${r.name}" - ${r.description || "No description"} 
   Price: $${r.price}, Capabilities: ${r.capabilities.join(", ")}
   Inputs: ${r.inputTypes.join(", ")}, Outputs: ${r.outputTypes.join(", ")}`,
    )
    .join("\n");

  const prompt = `You are a workflow builder for x402.jobs. Given a user's request and available resources, select the resources needed and order them for a workflow.

USER REQUEST: "${userRequest}"

AVAILABLE RESOURCES:
${resourceDescriptions}

Respond with JSON only:
{
  "selectedResourceIds": ["id1", "id2"], // Resource IDs in execution order
  "reasoning": "Brief explanation of why these resources were selected",
  "suggestedName": "Short workflow name"
}

Rules:
- Select 1-5 resources that best accomplish the user's goal
- Order them logically (output of one feeds into input of next)
- Only select resources that are actually needed
- If no resources match, return empty selectedResourceIds array`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("GPT planning error:", await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      selectedResources: parsed.selectedResourceIds || [],
      reasoning: parsed.reasoning || "",
      suggestedName: parsed.suggestedName || "New Workflow",
    };
  } catch (error) {
    console.error("GPT planning error:", error);
    return null;
  }
}

// Common output fields from different resource types
const COMMON_OUTPUT_FIELDS = [
  "artifactUrl", // Async LRO resources (image/video generators)
  "imageUrl",
  "image_url",
  "url",
  "videoUrl",
  "video_url",
  "result",
  "output",
  "response",
  "data",
];

// Use GPT to generate smart input mappings between resources
async function generateInputMappings(
  resources: ResourceMatch[],
  userRequest: string,
): Promise<
  Record<
    string,
    Record<
      string,
      { type: "reference"; sourceNodeId: string; sourceField: string }
    >
  >
> {
  if (!OPENAI_API_KEY || resources.length < 2) {
    return {};
  }

  // Build resource descriptions with their input/output schemas
  const resourceDetails = resources.map((r, i) => {
    const schema = r.outputSchema as {
      input?: {
        bodyFields?: Record<string, unknown>;
        queryParams?: Record<string, unknown>;
        headerFields?: Record<string, unknown>;
      };
      output?: { properties?: Record<string, unknown> };
    } | null;
    // Merge all input field types (bodyFields, queryParams, headerFields)
    const inputFields = {
      ...(schema?.input?.bodyFields || {}),
      ...(schema?.input?.queryParams || {}),
      ...(schema?.input?.headerFields || {}),
    };
    const outputFields = schema?.output?.properties || {};

    return {
      index: i + 1,
      nodeId: `resource-${i + 1}`,
      name: r.name,
      inputFields: Object.entries(inputFields).map(
        ([name, field]: [string, unknown]) => ({
          name,
          type: (field as { type?: string }).type || "string",
          required: (field as { required?: boolean }).required || false,
          description: (field as { description?: string }).description || "",
        }),
      ),
      outputFields:
        Object.keys(outputFields).length > 0
          ? Object.keys(outputFields)
          : COMMON_OUTPUT_FIELDS, // Use common fields as fallback
    };
  });

  const prompt = `You are wiring up a workflow. Given the user's goal and the resources in order, determine how to connect outputs from earlier steps to inputs of later steps.

USER GOAL: "${userRequest}"

RESOURCES (in execution order):
${resourceDetails
  .map(
    (r) => `
Step ${r.index} (nodeId: "${r.nodeId}"): ${r.name}
  Inputs: ${r.inputFields.map((f) => `${f.name}${f.required ? "*" : ""} (${f.type})`).join(", ") || "none"}
  Likely outputs: ${r.outputFields.join(", ")}
`,
  )
  .join("\n")}

For each resource after the first, determine which input fields should be connected to outputs from previous steps.

IMPORTANT OUTPUT FIELD RULES:
- Image/video generators (pfp, dalle, stable diffusion, veo, etc.) are async LROs that output "artifactUrl"
- Text/data APIs typically output "response" or "data"
- When connecting image generators to video generators, use "artifactUrl" as the source field

Respond with JSON:
{
  "mappings": {
    "resource-2": {
      "input_field_name": {
        "sourceNodeId": "resource-1",
        "sourceField": "artifactUrl"
      }
    },
    "resource-3": { ... }
  },
  "reasoning": "Brief explanation of the connections"
}

Rules:
- Image/video generators output "artifactUrl" (this is critical!)
- For image-to-video workflows: artifactUrl → source_image_url
- Text outputs: response → prompt
- If a field should come from user input (trigger), use sourceNodeId: "trigger-1"
- Don't map every field - only the ones that logically flow from previous steps`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error("GPT mapping error:", await response.text());
      return {};
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content);
    console.log("🔗 Generated input mappings:", parsed.reasoning);

    // Convert to the expected format with type: "reference"
    const mappings: Record<
      string,
      Record<
        string,
        { type: "reference"; sourceNodeId: string; sourceField: string }
      >
    > = {};
    for (const [nodeId, fields] of Object.entries(parsed.mappings || {})) {
      mappings[nodeId] = {};
      for (const [fieldName, ref] of Object.entries(
        fields as Record<string, { sourceNodeId: string; sourceField: string }>,
      )) {
        mappings[nodeId][fieldName] = {
          type: "reference",
          sourceNodeId: ref.sourceNodeId,
          sourceField: ref.sourceField,
        };
      }
    }

    return mappings;
  } catch (error) {
    console.error("GPT mapping error:", error);
    return {};
  }
}

// Clarification request for ambiguous/inferred values
interface Clarification {
  nodeId: string;
  resourceName: string;
  fieldName: string;
  fieldDescription: string;
  inferredValue: string;
  question: string;
  confidence: "high" | "medium" | "low";
}

interface ExtractedInputsResult {
  values: Record<string, Record<string, string>>;
  clarifications: Clarification[];
}

// Use GPT to extract static input values from the user's prompt
// Returns both extracted values and clarification questions for ambiguous inputs
async function extractStaticInputValues(
  resources: ResourceMatch[],
  userRequest: string,
): Promise<ExtractedInputsResult> {
  if (!OPENAI_API_KEY || resources.length === 0) {
    return { values: {}, clarifications: [] };
  }

  // Build resource descriptions with their input schemas
  const resourceDetails = resources.map((r, i) => {
    const schema = r.outputSchema as {
      input?: {
        bodyFields?: Record<string, unknown>;
        queryParams?: Record<string, unknown>;
        headerFields?: Record<string, unknown>;
      };
    } | null;

    const inputFields = {
      ...(schema?.input?.bodyFields || {}),
      ...(schema?.input?.queryParams || {}),
      ...(schema?.input?.headerFields || {}),
    };

    return {
      nodeId: `resource-${i + 1}`,
      name: r.name,
      inputFields: Object.entries(inputFields).map(
        ([name, field]: [string, unknown]) => ({
          name,
          type: (field as { type?: string }).type || "string",
          required: (field as { required?: boolean }).required || false,
          description: (field as { description?: string }).description || "",
          enum: (field as { enum?: string[] }).enum,
        }),
      ),
    };
  });

  // Get current date in a localized, human-readable format
  const now = new Date();
  const currentDateISO = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentDateReadable = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }); // e.g., "Monday, December 30, 2024"
  const currentYear = now.getFullYear();

  const prompt = `You are setting up a workflow. Extract ONLY the values that the user explicitly or implicitly mentioned in their request.

TODAY'S DATE: ${currentDateReadable} (${currentDateISO})
CURRENT YEAR: ${currentYear}

USER REQUEST: "${userRequest}"

RESOURCES AND THEIR INPUT FIELDS:
${resourceDetails
  .map(
    (r) => `
${r.nodeId} (${r.name}):
${r.inputFields
  .map(
    (f) =>
      `  - ${f.name}${f.required ? " (REQUIRED)" : ""}: ${f.description || f.type}${f.enum ? ` [options: ${f.enum.join(", ")}]` : ""}`,
  )
  .join("\n")}
`,
  )
  .join("\n")}

IMPORTANT RULES:
1. ONLY extract values that are explicitly or implicitly mentioned in the user's request
2. Do NOT include optional fields that the user didn't mention (like airline preferences, number of stops, etc.)
3. For REQUIRED fields that the user mentioned, always include them
4. For dates: use YYYY-MM-DD format, infer the correct year based on context

DATE RULES:
- Today is ${currentDateReadable}
- If user mentions a month BEFORE or SAME as current month (${now.toLocaleDateString("en-US", { month: "long" })}) without a year, use NEXT year (${currentYear + 1})
- If user mentions a month AFTER current month, use current year (${currentYear})
- Flag dates for clarification if year was not explicitly stated

LOCATION RULES:
- For airports, use standard 3-letter IATA codes
- Convert city names to airport codes (e.g., "New York" → "JFK", "Bali" → "DPS")

Respond with JSON:
{
  "values": {
    "resource-1": {
      "fieldName": "extracted_value"
    }
  },
  "clarifications": [
    {
      "nodeId": "resource-1",
      "fieldName": "outbound_date",
      "inferredValue": "2026-01-10",
      "question": "Departure: January 10, 2026",
      "confidence": "medium"
    }
  ],
  "reasoning": "Brief explanation"
}

Clarification rules:
- Keep questions SHORT (e.g., "Departure: January 10, 2026" not "You mentioned January 10th - I've set this to...")
- Only include clarifications for values where year was inferred or location was ambiguous
- Confidence: "high" = explicitly stated, "medium" = reasonably inferred, "low" = significant assumption`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      return { values: {}, clarifications: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { values: {}, clarifications: [] };

    const parsed = JSON.parse(content);
    console.log("📝 Extracted static input values:", parsed.reasoning);

    // Build clarifications with resource names
    const clarifications: Clarification[] = (parsed.clarifications || []).map(
      (c: {
        nodeId: string;
        fieldName: string;
        inferredValue: string;
        question: string;
        confidence?: "high" | "medium" | "low";
      }) => {
        const resourceIndex = parseInt(c.nodeId.replace("resource-", "")) - 1;
        const resource = resources[resourceIndex];
        return {
          nodeId: c.nodeId,
          resourceName: resource?.name || c.nodeId,
          fieldName: c.fieldName,
          fieldDescription:
            resourceDetails[resourceIndex]?.inputFields.find(
              (f) => f.name === c.fieldName,
            )?.description || c.fieldName,
          inferredValue: c.inferredValue,
          question: c.question,
          confidence: c.confidence || "medium",
        };
      },
    );

    return {
      values: parsed.values || {},
      clarifications,
    };
  } catch (error) {
    console.error("Error extracting input values:", error);
    return { values: {}, clarifications: [] };
  }
}

// Extended proposal that includes clarifications
interface WorkflowProposalWithClarifications extends WorkflowProposal {
  clarifications: Clarification[];
}

// Build the workflow proposal with nodes and edges
async function buildProposal(
  request: string,
  selectedResources: ResourceMatch[],
  suggestedName: string,
  reasoning: string,
  network: string,
): Promise<WorkflowProposalWithClarifications> {
  const nodes: WorkflowProposal["nodes"] = [];
  const edges: WorkflowProposal["edges"] = [];
  const steps: WorkflowProposal["steps"] = [];

  // Starting positions - vertical layout (top to bottom)
  const startX = 300;
  const startY = 100;
  const nodeSpacingY = 180; // Vertical spacing between nodes

  let prevNodeId = "trigger-1";
  let totalCost = 0;

  // Generate smart input mappings using GPT (for connecting nodes)
  const inputMappings = await generateInputMappings(selectedResources, request);
  console.log(
    "🔗 Generated input mappings:",
    JSON.stringify(inputMappings, null, 2),
  );

  // Extract static input values from the user's prompt (now includes clarifications)
  const { values: staticInputValues, clarifications } =
    await extractStaticInputValues(selectedResources, request);
  console.log(
    "📝 Static input values:",
    JSON.stringify(staticInputValues, null, 2),
  );
  console.log(
    "❓ Clarifications needed:",
    JSON.stringify(clarifications, null, 2),
  );

  // Build workflow inputs (job parameters) from extracted static values
  // This exposes them in the Run panel instead of hiding them in resource config
  interface WorkflowInput {
    name: string;
    type: "string" | "number" | "boolean" | "object" | "file";
    required: boolean;
    description?: string;
    default?: string;
  }

  const workflowInputs: WorkflowInput[] = [];
  // Map from "nodeId:fieldName" to the workflow input name
  const fieldToInputMap: Record<string, string> = {};

  // Helper to convert field name to user-friendly param name
  function toParamName(fieldName: string): string {
    // Convert snake_case or camelCase to readable format
    return fieldName
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, "_")
      .toLowerCase();
  }

  // Helper to infer input type from field name/value
  function inferInputType(
    fieldName: string,
    value: string,
  ): WorkflowInput["type"] {
    const lowerName = fieldName.toLowerCase();
    if (lowerName.includes("date")) return "string"; // Dates are strings in YYYY-MM-DD format
    if (lowerName.includes("count") || lowerName.includes("number"))
      return "number";
    if (
      lowerName.includes("enabled") ||
      lowerName.includes("is_") ||
      value === "true" ||
      value === "false"
    )
      return "boolean";
    return "string";
  }

  // Helper to create user-friendly description
  function createDescription(fieldName: string, _resourceName: string): string {
    const readable = fieldName
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase();
    return readable.charAt(0).toUpperCase() + readable.slice(1);
  }

  // Helper to get field schema from resource
  function getFieldSchema(
    resource: ResourceMatch | undefined,
    fieldName: string,
  ): { required: boolean; description?: string } | null {
    if (!resource) return null;

    const schema = resource.outputSchema as {
      input?: {
        bodyFields?: Record<
          string,
          { required?: boolean; description?: string }
        >;
        queryParams?: Record<
          string,
          { required?: boolean; description?: string }
        >;
        headerFields?: Record<
          string,
          { required?: boolean; description?: string }
        >;
      };
    } | null;

    const allFields = {
      ...(schema?.input?.bodyFields || {}),
      ...(schema?.input?.queryParams || {}),
      ...(schema?.input?.headerFields || {}),
    };

    // Try exact match first, then camelCase conversion
    const field =
      allFields[fieldName] ||
      allFields[fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
    if (!field) return null;

    return {
      required: field.required ?? false,
      description: field.description,
    };
  }

  // Collect all static values and create workflow inputs
  for (const [nodeId, fields] of Object.entries(staticInputValues)) {
    const resourceIndex = parseInt(nodeId.replace("resource-", "")) - 1;
    const resource = selectedResources[resourceIndex];

    for (const [fieldName, value] of Object.entries(fields)) {
      // Skip empty, null, undefined values
      if (value === undefined || value === null || value === "") continue;

      // Skip empty arrays (stringified as "[]" or actual empty array)
      const strValue = String(value);
      if (strValue === "[]" || strValue === "null" || strValue === "undefined")
        continue;

      // Get the field schema to check if it's required
      const fieldSchema = getFieldSchema(resource, fieldName);
      const isRequired = fieldSchema?.required ?? false;

      // Skip optional fields that have default-like values
      // (we only want to expose fields that the user actually cares about)
      if (!isRequired) {
        const lowerValue = strValue.toLowerCase();
        // Skip common default values for optional fields
        if (
          lowerValue === "0" ||
          lowerValue === "1" ||
          lowerValue === "false" ||
          lowerValue === "true" ||
          lowerValue === "usd" ||
          lowerValue === "[]"
        ) {
          continue;
        }
      }

      const paramName = toParamName(fieldName);
      // Ensure unique names by appending resource index if needed
      let uniqueName = paramName;
      if (workflowInputs.some((i) => i.name === uniqueName)) {
        uniqueName = `${paramName}_${resourceIndex + 1}`;
      }

      // Use a cleaner description
      const cleanDescription =
        fieldSchema?.description || createDescription(fieldName, "");

      workflowInputs.push({
        name: uniqueName,
        type: inferInputType(fieldName, strValue),
        required: isRequired,
        description: cleanDescription,
        default: strValue,
      });

      fieldToInputMap[`${nodeId}:${fieldName}`] = uniqueName;
    }
  }

  console.log(
    "📋 Created workflow inputs:",
    JSON.stringify(workflowInputs, null, 2),
  );

  // Add trigger node with workflow inputs
  const triggerId = "trigger-1";
  nodes.push({
    id: triggerId,
    type: "trigger",
    position: { x: startX, y: startY },
    data: {
      label: "Start",
      workflowInputs, // Job parameters visible in Run panel
    },
  });

  // Track transform nodes we create
  let transformCount = 0;
  const transformSpacingY = 100; // Smaller vertical spacing for transform nodes
  // Track current Y position as we build the workflow vertically
  let currentY = startY + nodeSpacingY; // Start below trigger

  // Add resource nodes with transform nodes for mappings
  selectedResources.forEach((resource, index) => {
    const resourceNodeId = `resource-${index + 1}`;

    // Get the generated input mappings for this node
    const nodeMappings = inputMappings[resourceNodeId] || {};

    // Check if we need a transform node (if there are mappings from previous node)
    const hasMappingsFromPrev = Object.values(nodeMappings).some(
      (m) => typeof m === "object" && m.type === "reference",
    );
    console.log(
      `📦 ${resourceNodeId}: nodeMappings=`,
      JSON.stringify(nodeMappings),
      `hasMappingsFromPrev=${hasMappingsFromPrev}`,
    );

    // If there are mappings from the previous resource, create extract transform nodes
    if (hasMappingsFromPrev && index > 0) {
      // Get all the references from previous nodes
      const references = Object.entries(nodeMappings)
        .filter(([_, m]) => typeof m === "object" && m.type === "reference")
        .map(([fieldName, mapping]) => {
          const ref = mapping as { sourceNodeId: string; sourceField: string };
          return { fieldName, ...ref };
        });

      // Create an extract transform for the first mapping (typically artifactUrl)
      // This extracts the field we need from the previous step
      const firstRef = references[0];
      if (firstRef) {
        transformCount++;
        const transformNodeId = `transform-${transformCount}`;

        nodes.push({
          id: transformNodeId,
          type: "transform",
          position: { x: startX, y: currentY },
          data: {
            transformType: "extract",
            config: {
              path: firstRef.sourceField, // e.g., "artifactUrl"
            },
          },
        });
        currentY += transformSpacingY; // Move down for next node

        // Edge from source node to transform
        edges.push({
          id: `edge-${firstRef.sourceNodeId}-${transformNodeId}`,
          source: firstRef.sourceNodeId,
          target: transformNodeId,
        });

        // Edge from transform to current resource
        edges.push({
          id: `edge-${transformNodeId}-${resourceNodeId}`,
          source: transformNodeId,
          target: resourceNodeId,
        });

        // Update the node mappings to reference the transform node instead of the original
        // The transform outputs the extracted value directly, so no sourceField needed
        nodeMappings[firstRef.fieldName] = {
          type: "reference",
          sourceNodeId: transformNodeId,
          sourceField: "output", // Transform output
        };
      }
    } else {
      // No transform needed, connect directly to previous node
      edges.push({
        id: `edge-${prevNodeId}-${resourceNodeId}`,
        source: prevNodeId,
        target: resourceNodeId,
      });
    }

    // Convert nodeMappings to configuredInputs format expected by ResourceNode
    const configuredInputs: Record<
      string,
      {
        type?: string;
        value?: string;
        sourceNodeId?: string;
        sourceField?: string;
      }
    > = {};

    // First, check for extracted static values and wire them to trigger inputs
    const nodeStaticValues = staticInputValues[resourceNodeId] || {};
    for (const [fieldName, value] of Object.entries(nodeStaticValues)) {
      if (value !== undefined && value !== null && value !== "") {
        const inputKey = `${resourceNodeId}:${fieldName}`;
        const inputName = fieldToInputMap[inputKey];

        if (inputName) {
          // Wire to trigger input (job parameter) - this shows in Run panel!
          configuredInputs[fieldName] = {
            type: "reference",
            sourceNodeId: triggerId,
            sourceField: inputName,
          };
        } else {
          // Fallback to static value if not mapped
          configuredInputs[fieldName] = {
            type: "static",
            value: String(value),
          };
        }
      }
    }

    // Then, add/override with reference mappings (connections between nodes)
    for (const [fieldName, mapping] of Object.entries(nodeMappings)) {
      if (typeof mapping === "object" && mapping.type === "reference") {
        configuredInputs[fieldName] = {
          type: "reference",
          sourceNodeId: mapping.sourceNodeId,
          sourceField: mapping.sourceField,
        };
      } else if (typeof mapping === "string") {
        configuredInputs[fieldName] = { type: "static", value: mapping };
      }
    }

    nodes.push({
      id: resourceNodeId,
      type: "resource",
      position: { x: startX, y: currentY },
      data: {
        resource: {
          id: resource.id,
          name: resource.name,
          slug: resource.slug,
          serverSlug: resource.server?.slug,
          description: resource.description,
          resourceUrl: resource.url,
          price: resource.price,
          network: resource.network,
          avatarUrl: resource.avatarUrl,
          outputSchema: resource.outputSchema || {}, // Contains input schema too
        },
        configuredInputs, // Pre-configured input mappings in correct format
      },
    });

    steps.push({
      order: index + 1,
      resourceId: resource.id,
      resourceName: resource.name,
      resourceSlug: resource.slug || undefined,
      resourceUrl: resource.url,
      price: resource.price,
      purpose: `Step ${index + 1}: ${resource.name}`,
      inputMapping: nodeMappings, // Pre-configured input mappings
      serverId: resource.server?.id,
      serverName: resource.server?.name,
      serverSlug: resource.server?.slug || undefined,
      outputSchema: resource.outputSchema || undefined,
    });

    totalCost += resource.price;
    prevNodeId = resourceNodeId;
    currentY += nodeSpacingY; // Move down for next node
  });

  // Determine if we need an output transform based on the last resource's output schema
  const lastResource = selectedResources[selectedResources.length - 1];
  const lastOutputSchema = lastResource?.outputSchema as {
    output?: { properties?: Record<string, unknown> };
  } | null;
  const lastOutputFields = lastOutputSchema?.output?.properties
    ? Object.keys(lastOutputSchema.output.properties)
    : [];

  // Check if the last resource outputs artifactUrl (LRO/async resources like image generators)
  const outputsArtifactUrl = lastOutputFields.includes("artifactUrl");

  // Add output node - position after all resources and transforms
  const outputId = "output-1";

  if (outputsArtifactUrl) {
    // LRO resource: add extract transform for artifactUrl
    transformCount++;
    const outputTransformId = `transform-${transformCount}`;

    nodes.push({
      id: outputTransformId,
      type: "transform",
      position: { x: startX, y: currentY },
      data: {
        transformType: "extract",
        config: {
          path: "artifactUrl",
        },
      },
    });
    currentY += transformSpacingY; // Move down for output node

    // Edge from last resource to output transform
    edges.push({
      id: `edge-${prevNodeId}-${outputTransformId}`,
      source: prevNodeId,
      target: outputTransformId,
    });

    nodes.push({
      id: outputId,
      type: "output",
      position: { x: startX, y: currentY },
      data: {
        label: "Output",
      },
    });

    edges.push({
      id: `edge-${outputTransformId}-${outputId}`,
      source: outputTransformId,
      target: outputId,
    });
  } else {
    // Simple resource: connect directly to output (no transform needed)
    nodes.push({
      id: outputId,
      type: "output",
      position: { x: startX, y: currentY },
      data: {
        label: "Output",
      },
    });

    edges.push({
      id: `edge-${prevNodeId}-${outputId}`,
      source: prevNodeId,
      target: outputId,
    });
  }

  return {
    name: suggestedName,
    description: reasoning,
    network,
    estimatedCost: totalCost,
    steps,
    nodes,
    edges,
    clarifications,
  };
}

// POST /api/workflow/propose - Propose a workflow from natural language (requires auth)
workflowBuilderRouter.post(
  "/propose",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { request, network } = req.body;

      if (!request || typeof request !== "string") {
        return res.status(400).json({ error: "Missing 'request' field" });
      }

      console.log(
        `🔍 Proposing workflow for: "${request.substring(0, 50)}..."`,
      );

      // Step 1: Search for relevant resources
      const resources = await searchResources(request, network, 15);

      if (resources.length === 0) {
        return res.status(404).json({
          error: "No matching resources found",
          suggestion:
            "Try a different description or browse available resources",
        });
      }

      console.log(`   Found ${resources.length} relevant resources`);

      // Step 2: Use GPT to plan the workflow
      const plan = await planWorkflow(request, resources);

      if (!plan || plan.selectedResources.length === 0) {
        // Fallback: just use top 1-2 resources by similarity
        const topResources = resources.slice(0, 2);
        const proposal = await buildProposal(
          request,
          topResources,
          "New Workflow",
          "Auto-selected top matching resources",
          network || topResources[0]?.network || "solana",
        );

        return res.json({
          proposal,
          resources: resources.slice(0, 10), // Also return resources for manual selection
          planningMethod: "fallback",
        });
      }

      // Step 3: Build the proposal
      const selectedResources = plan.selectedResources
        .map((id) => resources.find((r) => r.id === id))
        .filter(Boolean) as ResourceMatch[];

      const proposal = await buildProposal(
        request,
        selectedResources,
        plan.suggestedName,
        plan.reasoning,
        network || selectedResources[0]?.network || "solana",
      );

      console.log(
        `✅ Proposed: "${proposal.name}" with ${proposal.steps.length} steps, ~$${proposal.estimatedCost}`,
      );

      res.json({
        proposal,
        resources: resources.slice(0, 10), // Also return resources for manual adjustment
        reasoning: plan.reasoning,
        planningMethod: "ai",
      });
    } catch (error) {
      console.error("Workflow proposal error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

// POST /api/workflow/create - Create a job from a proposal (requires auth)
workflowBuilderRouter.post(
  "/create",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // User is guaranteed by auth middleware
      const userId = req.user!.id;
      const { proposal } = req.body as { proposal: WorkflowProposal };

      if (!proposal || !proposal.nodes || !proposal.edges) {
        return res.status(400).json({ error: "Invalid proposal" });
      }

      const supabase = getSupabase();

      // Try to create with proposed name, fall back to random names if taken
      let jobName = proposal.name;
      let job = null;
      let lastError = null;
      const maxAttempts = 10;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data, error } = await supabase
          .from("x402_jobs")
          .insert({
            user_id: userId,
            name: jobName,
            description: proposal.description,
            network: proposal.network || "solana",
            workflow_definition: {
              nodes: proposal.nodes,
              edges: proposal.edges,
            },
            trigger_type: "manual",
            trigger_config: {},
            output_type: "ui",
            output_config: {},
          })
          .select()
          .single();

        if (!error) {
          job = data;
          break;
        }

        // If name is taken (unique constraint), try a random name
        if (error.code === "23505") {
          jobName = generateRandomJobName();
          lastError = error;
          continue;
        }

        // Other error - fail immediately
        console.error("Job creation error:", error);
        return res.status(500).json({ error: "Failed to create job" });
      }

      if (!job) {
        console.error("Failed to create job after max attempts:", lastError);
        return res
          .status(500)
          .json({ error: "Could not generate unique job name" });
      }

      console.log(`✅ Created job "${job.name}" (${job.id})`);

      res.status(201).json({
        job: {
          ...job,
          workflow_data: job.workflow_definition,
        },
        estimatedCost: proposal.estimatedCost,
      });
    } catch (error) {
      console.error("Workflow creation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

// GET /api/workflow/resources/search - Search resources for manual workflow building (public)
workflowBuilderRouter.get(
  "/resources/search",
  async (req: Request, res: Response) => {
    try {
      const { q, network, capability, category, limit = "10" } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Missing search query 'q'" });
      }

      const resources = await searchResources(
        q,
        network as string | undefined,
        parseInt(limit as string, 10),
      );

      // Apply additional filters
      let filtered = resources;
      if (capability) {
        filtered = filtered.filter((r) =>
          r.capabilities.includes(capability as string),
        );
      }
      if (category) {
        filtered = filtered.filter((r) => r.category === category);
      }

      res.json({ resources: filtered });
    } catch (error) {
      console.error("Resource search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  },
);
