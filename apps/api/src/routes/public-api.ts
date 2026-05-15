import { Router } from "express";
import type { Router as RouterType } from "express";
import pLimit from "p-limit";
import { getSupabase } from "../lib/supabase";
import { apiKeyMiddleware } from "../middleware/apiKey";
import {
  minuteRateLimiter,
  hourlyRateLimiter,
  bulkResourceRateLimiter,
} from "../middleware/rateLimit";
import {
  httpClient,
  isBlockedRequestError,
  BlockedRequestError,
} from "../lib/http-client";
import { getOrCreateServer } from "./servers";
import { cacheImage } from "./resources";

export const publicApiRouter: RouterType = Router();

// Apply API key middleware to all public API routes
publicApiRouter.use(apiKeyMiddleware);

// Apply rate limiting (per API key)
// 100 requests per minute, 1000 requests per hour
publicApiRouter.use(minuteRateLimiter);
publicApiRouter.use(hourlyRateLimiter);

// Helper to generate a URL-safe slug from text
function generateSlug(inputText: string): string {
  let slug = inputText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-$/, "");
  }

  return slug;
}

// Helper to generate a unique resource slug
async function getUniqueResourceSlug(
  serverId: string | null,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    let query = getSupabase()
      .from("x402_resources")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true);

    if (serverId) {
      query = query.eq("server_id", serverId);
    }

    const { data: existing } = await query.maybeSingle();

    if (!existing) return slug;

    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}

// Valid networks for x402 resources
const VALID_NETWORKS = [
  "solana",
  "base",
  "ethereum",
  "polygon",
  "base-sepolia",
  "ethereum-sepolia",
  "solana-devnet",
];

// Bulk endpoint limits. See PRD-bulk-resource-registration §Limits:
//   - Max items per request: 25 (timeout math: 25 / concurrency=5 × ~3s ≈ 15s).
//   - In-flight concurrency: 5 (p-limit).
const BULK_MAX_ITEMS = 25;
const BULK_CONCURRENCY = 5;

// Helper to fetch x402 metadata from a resource URL
interface X402Metadata {
  description?: string;
  network?: string;
  payTo?: string;
  maxAmountRequired?: string;
  asset?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  avatarUrl?: string;
  serviceName?: string;
  agentName?: string;
  category?: string;
}

// NOTE: httpClient enforces SSRF protection via request-filtering-agent
// (Phase 28 HIGH-13, plan 28-09). The agent blocks non-unicast targets at
// CONNECT time — closes the DNS-rebinding window the old safeFetch left
// open. Blocked-request errors must NOT be swallowed here so
// registerOneResource can map them to a specific "URL not allowed" 400
// rather than the generic "Invalid x402 resource" path. Non-SSRF failures
// still resolve to `null` to preserve the existing observable behavior.
//
// TODO (out of scope, deferred per Phase 29 threat model T-29-03): per-fetch
// timeout via axios `timeout` (already 30s default in httpClient) is enough
// for now; tighten to ~5s for bulk-register concurrency in a follow-up.
async function fetchX402Metadata(url: string): Promise<X402Metadata | null> {
  try {
    // Try GET first, then POST. axios responses use .status / .data.
    let response = await httpClient.get(url, {
      headers: { Accept: "application/json" },
    });

    if (response.status !== 402) {
      response = await httpClient.post(
        url,
        {},
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (response.status !== 402) {
      console.log(`[x402] URL ${url} did not return 402: ${response.status}`);
      return null;
    }

    // axios auto-parses application/json responses; if the server sent JSON,
    // response.data is already the parsed object. If text came back, it's a
    // string we attempt to parse defensively.
    const data =
      typeof response.data === "string"
        ? safeJsonParse(response.data)
        : response.data;
    const accepts = data?.accepts?.[0] || data;

    if (!accepts) return null;

    return {
      description: accepts.description,
      network: accepts.network,
      payTo: accepts.payTo,
      maxAmountRequired: accepts.maxAmountRequired,
      asset: accepts.asset,
      mimeType: accepts.mimeType,
      maxTimeoutSeconds: accepts.maxTimeoutSeconds,
      outputSchema: accepts.outputSchema,
      extra: accepts.extra,
      avatarUrl: accepts.extra?.avatarUrl,
      serviceName: accepts.extra?.serviceName,
      agentName: accepts.extra?.agentName,
      category: accepts.extra?.category,
    };
  } catch (error) {
    if (isBlockedRequestError(error)) {
      // Re-throw as BlockedRequestError so registerOneResource can
      // distinguish a private-IP block from "no x402 metadata" and return
      // a more specific error code. We normalize the error class here
      // (the library throws plain Errors with library-specific messages).
      const msg = (error as Error).message || "URL not allowed";
      throw new BlockedRequestError(msg);
    }
    console.error(`[x402] Failed to fetch metadata from ${url}:`, error);
    return null;
  }
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ============================================================================
// Shared per-item registration logic
// ============================================================================
//
// Both POST /resources (single) and POST /resources/bulk (added in plan 29-01
// task 2) funnel through registerOneResource. The single endpoint maps the
// discriminated RegisterResult back to its pre-refactor HTTP response shape
// (verified by the unchanged integration test suite). The bulk endpoint maps
// it to a per-item entry. See the plan's <interfaces> block for the full
// mapping tables.

// Caller's API-key identity, as exposed by apiKeyMiddleware on req.apiKey.
export type ApiKeyUser = {
  id: string;
  name: string;
  created_by: string;
  tier?: "free" | "paid";
};

// Body shape for a single resource item. Fields are typed `unknown` because
// they cross the trust boundary from JSON; registerOneResource narrows them.
export type RegisterInput = {
  name?: unknown;
  description?: unknown;
  resource_url?: unknown;
  category?: unknown;
  tags?: unknown;
  capabilities?: unknown;
  // server_name is accepted but unused (server is auto-detected from URL).
  // We don't include it in the type so consumers know it's ignored.
  extra?: unknown;
  avatar_url?: unknown;
  network?: unknown;
  pay_to?: unknown;
};

// Resource shape returned in the data field of the existing single-endpoint
// response. Bulk uses the same shape under result.resource.
export type ResourceResponseData = {
  id: string;
  name: string;
  slug: string;
  url: string;
  resource_url: string;
  network: string;
  category: string;
  server_id: string;
  server_slug: string;
  created_at: string;
};

// Discriminated union returned by registerOneResource. The status names map
// 1:1 to bulk per-item statuses with one nuance: `noop` is bulk-only synonym
// for "matched but no fields to update AND caller IS owner" — bulk callers
// see this as `updated`. `skipped` is bulk-specific for the non-owner /
// no-fields-to-fill case, where the single endpoint historically returned
// the "Resource already exists" message; both map back through
// mapRegisterResultToSingleEndpointResponse so the single endpoint's
// external contract is preserved.
export type RegisterResult =
  | { status: "created"; resource: ResourceResponseData }
  | {
      status: "updated";
      resource: ResourceResponseData;
      updated_fields: string[];
    }
  | { status: "noop"; resource: ResourceResponseData }
  | {
      status: "skipped";
      error: "not_owner";
      message: string;
      resource: ResourceResponseData;
    }
  | {
      status: "error";
      error: string;
      message: string;
      http_hint: 400 | 500;
    };

export async function registerOneResource(
  input: RegisterInput,
  apiKeyUser: ApiKeyUser,
): Promise<RegisterResult> {
  const {
    name,
    description,
    resource_url,
    category,
    tags,
    capabilities,
    // server_name is accepted but not used - server is auto-detected from URL
    extra,
    avatar_url, // User can provide custom avatar
    // Required x402 fields
    network: networkRaw,
    pay_to,
  } = input;
  const network = (networkRaw as string | undefined) ?? "solana";

  // Validate required fields
  if (!name || !resource_url) {
    return {
      status: "error",
      error: "Missing required fields",
      message: "name and resource_url are required",
      http_hint: 400,
    };
  }

  // Validate network
  if (!VALID_NETWORKS.includes(network)) {
    return {
      status: "error",
      error: "Invalid network",
      message: `network must be one of: ${VALID_NETWORKS.join(", ")}`,
      http_hint: 400,
    };
  }

  // Validate URL format
  if (typeof resource_url !== "string") {
    return {
      status: "error",
      error: "Invalid URL",
      message: "resource_url must be a valid URL",
      http_hint: 400,
    };
  }
  try {
    new URL(resource_url);
  } catch {
    return {
      status: "error",
      error: "Invalid URL",
      message: "resource_url must be a valid URL",
      http_hint: 400,
    };
  }

  // Normalize URL (without protocol for uniqueness)
  const normalizedUrl = resource_url.replace(/^https?:\/\//, "");

  const supabase = getSupabase();

  // Fetch and validate x402 metadata from the resource URL.
  // BlockedRequestError is re-thrown by fetchX402Metadata so we can surface
  // a specific "URL not allowed" 400 rather than the generic
  // "Invalid x402 resource".
  console.log(`[PublicAPI] Fetching x402 metadata from ${resource_url}...`);
  let x402: X402Metadata | null;
  try {
    x402 = await fetchX402Metadata(resource_url);
  } catch (err) {
    if (err instanceof BlockedRequestError) {
      return {
        status: "error",
        error: "URL not allowed",
        message: "resource_url resolves to a private IP range",
        http_hint: 400,
      };
    }
    // Other unexpected errors bubble up to the caller's try/catch (single
    // endpoint maps to 500; bulk catches per item).
    throw err;
  }

  if (!x402) {
    return {
      status: "error",
      error: "Invalid x402 resource",
      message:
        "The resource_url must return a valid 402 Payment Required response with x402 metadata. Make sure the endpoint exists and is properly configured.",
      http_hint: 400,
    };
  }

  console.log(
    `[PublicAPI] Got x402 metadata: network=${x402.network}, payTo=${x402.payTo}, avatarUrl=${x402.avatarUrl ? "yes" : "no"}`,
  );

  // Cache avatar - user-provided takes priority over x402 metadata
  let cachedAvatarUrl: string | null = null;
  const avatarSource =
    (avatar_url as string | undefined) || x402?.avatarUrl;
  if (avatarSource) {
    console.log(`[PublicAPI] Caching avatar from ${avatarSource}...`);
    cachedAvatarUrl = await cacheImage(avatarSource, "avatar");
  }

  // Get or create server for this resource's origin URL
  const userId = apiKeyUser.created_by || "system";
  const server = await getOrCreateServer(resource_url, userId);

  if (!server) {
    return {
      status: "error",
      error: "Failed to create server",
      message: "Could not find or create server for this resource",
      http_hint: 500,
    };
  }

  const serverId = server.id;

  // Use request body as overrides, x402 metadata as defaults
  const effectiveNetwork = network || x402?.network || "solana";
  const effectivePayTo =
    (pay_to as string | undefined) || x402?.payTo || "unknown";
  const effectiveDescription =
    (description as string | undefined) || x402?.description;
  const effectiveCategory =
    (category as string | undefined) || x402?.category || "api";

  // Check if resource already exists by normalized URL
  const { data: existingResource } = await supabase
    .from("x402_resources")
    .select(
      `
      id, name, slug, server_id, network, category, resource_url, created_at,
      avatar_url, pay_to, description, tags, capabilities,
      registered_by, verified_owner_id,
      server:x402_servers(id, verified_owner_id, registered_by)
    `,
    )
    .eq("normalized_url", normalizedUrl)
    .maybeSingle();

  if (existingResource) {
    // Check ownership - can this user modify the resource?
    const apiKeyUserId = apiKeyUser.created_by;
    // Note: Supabase join returns object for many-to-one, but TS infers array
    const serverData = existingResource.server as unknown;
    const resourceServer = (
      Array.isArray(serverData) ? serverData[0] : serverData
    ) as {
      id: string;
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;

    const isResourceOwner =
      apiKeyUserId &&
      (existingResource.registered_by === apiKeyUserId ||
        existingResource.verified_owner_id === apiKeyUserId);
    const isServerOwner =
      apiKeyUserId &&
      resourceServer &&
      (resourceServer.verified_owner_id === apiKeyUserId ||
        resourceServer.registered_by === apiKeyUserId);
    const canFullyEdit = isResourceOwner || isServerOwner;

    console.log(
      `[PublicAPI] Resource ownership check: apiKeyUser=${apiKeyUserId}, isResourceOwner=${isResourceOwner}, isServerOwner=${isServerOwner}, canFullyEdit=${canFullyEdit}`,
    );

    // Build updates based on ownership
    const updates: Record<string, unknown> = {};

    // These can always be filled in if missing (server linkage, x402 metadata)
    if (!existingResource.server_id && serverId) {
      updates.server_id = serverId;
    }

    // x402 metadata can always be synced (it comes from the resource itself)
    if (x402?.outputSchema) {
      updates.output_schema = x402.outputSchema;
    }
    if (x402?.maxAmountRequired) {
      updates.max_amount_required = x402.maxAmountRequired;
    }
    if (x402?.asset) {
      updates.asset = x402.asset;
    }
    if (x402?.mimeType) {
      updates.mime_type = x402.mimeType;
    }
    if (x402?.maxTimeoutSeconds) {
      updates.max_timeout_seconds = x402.maxTimeoutSeconds;
    }
    if (
      effectivePayTo &&
      effectivePayTo !== "unknown" &&
      existingResource.pay_to === "unknown"
    ) {
      updates.pay_to = effectivePayTo;
    }

    // Avatar from x402 can be set if resource has none
    if (cachedAvatarUrl && !existingResource.avatar_url) {
      updates.avatar_url = cachedAvatarUrl;
    }

    // x402 extra block can be merged/synced
    if (x402?.extra) {
      updates.extra = x402.extra;
    }

    if (canFullyEdit) {
      // Owner can override user-customizable fields
      if (name && name !== existingResource.name) {
        updates.name = name;
      }
      if (description && description !== existingResource.description) {
        updates.description = description;
      }
      if (category && category !== existingResource.category) {
        updates.category = category;
      }
      if (
        Array.isArray(tags) &&
        tags.length > 0
      ) {
        updates.tags = tags;
      }
      if (
        Array.isArray(capabilities) &&
        capabilities.length > 0
      ) {
        updates.capabilities = capabilities;
      }
      if (network && network !== existingResource.network) {
        updates.network = network;
      }
      // Owner can override avatar
      if (cachedAvatarUrl) {
        updates.avatar_url = cachedAvatarUrl;
      }
    } else {
      // Non-owner: only fill in missing fields, don't override
      if (!existingResource.description && effectiveDescription) {
        updates.description = effectiveDescription;
      }
      if (
        (!existingResource.tags || existingResource.tags.length === 0) &&
        Array.isArray(tags) &&
        tags.length > 0
      ) {
        updates.tags = tags;
      }
      if (
        (!existingResource.capabilities ||
          existingResource.capabilities.length === 0) &&
        Array.isArray(capabilities) &&
        capabilities.length > 0
      ) {
        updates.capabilities = capabilities;
      }
    }

    if (Object.keys(updates).length > 0) {
      // Apply updates
      const { data: updatedResource, error: updateError } = await supabase
        .from("x402_resources")
        .update(updates)
        .eq("id", existingResource.id)
        .select(
          "id, name, slug, server_id, network, category, resource_url, created_at",
        )
        .single();

      if (updateError) {
        console.error("Error updating resource:", updateError);
        return {
          status: "error",
          error: "Failed to update resource",
          message: "Could not update resource in database",
          http_hint: 500,
        };
      }

      // Build the x402.jobs URL
      const x402JobsUrl = `https://www.x402.jobs/resources/${server.slug}/${updatedResource.slug}`;

      console.log(
        `✅ Resource updated via API: ${updatedResource.id} (${updatedResource.name}) - fields: ${Object.keys(updates).join(", ")}`,
      );

      return {
        status: "updated",
        updated_fields: Object.keys(updates),
        resource: {
          id: updatedResource.id,
          name: updatedResource.name,
          slug: updatedResource.slug,
          url: x402JobsUrl,
          resource_url: updatedResource.resource_url,
          network: updatedResource.network,
          category: updatedResource.category,
          server_id: updatedResource.server_id,
          server_slug: server.slug ?? "",
          created_at: updatedResource.created_at,
        },
      };
    }

    // No updates needed - return existing.
    // PRD note: the single endpoint historically does NOT emit a `warning`
    // field when caller's body differs from the stored row but no fields are
    // applied; bulk matches that behavior for parity (no warnings).
    const x402JobsUrlExisting = `https://www.x402.jobs/resources/${server.slug}/${existingResource.slug}`;
    const existingResourceResponse: ResourceResponseData = {
      id: existingResource.id,
      name: existingResource.name,
      slug: existingResource.slug,
      url: x402JobsUrlExisting,
      resource_url: existingResource.resource_url,
      network: existingResource.network,
      category: existingResource.category,
      server_id: existingResource.server_id,
      server_slug: server.slug ?? "",
      created_at: existingResource.created_at,
    };

    // Bulk-only distinction: a non-owner who matched an existing resource and
    // had nothing to fill in is `skipped` with `error: "not_owner"`. The
    // single endpoint maps this back to its existing "updated: false" reply
    // (preserving external contract) via mapRegisterResultToSingleEndpointResponse.
    if (!canFullyEdit) {
      return {
        status: "skipped",
        error: "not_owner",
        message:
          "Resource already registered by another user; no fields could be updated.",
        resource: existingResourceResponse,
      };
    }

    return { status: "noop", resource: existingResourceResponse };
  }

  // Generate unique slug for resource
  const baseSlug = generateSlug(name as string);
  const resourceSlug = await getUniqueResourceSlug(serverId, baseSlug);

  // Create the resource with x402 metadata
  const resourceData = {
    name,
    description: effectiveDescription || null,
    resource_url,
    normalized_url: normalizedUrl,
    network: effectiveNetwork,
    pay_to: effectivePayTo,
    slug: resourceSlug,
    category: effectiveCategory,
    tags: Array.isArray(tags) ? tags : [],
    capabilities: Array.isArray(capabilities) ? capabilities : [],
    server_id: serverId,
    avatar_url: cachedAvatarUrl,
    max_amount_required: x402?.maxAmountRequired || null,
    asset: x402?.asset || null,
    mime_type: x402?.mimeType || null,
    max_timeout_seconds: x402?.maxTimeoutSeconds || null,
    output_schema: x402?.outputSchema || null,
    extra: {
      ...(x402?.extra || {}), // x402 metadata first
      ...((extra as Record<string, unknown> | undefined) || {}), // then request overrides
      created_via: "public_api",
      api_key_id: apiKeyUser.id,
      api_key_name: apiKeyUser.name,
    },
    is_active: true,
    registered_by: apiKeyUser.created_by || null,
  };

  const { data: resource, error: resourceError } = await supabase
    .from("x402_resources")
    .insert(resourceData)
    .select()
    .single();

  if (resourceError) {
    console.error("Error creating resource:", resourceError);
    return {
      status: "error",
      error: "Failed to create resource",
      message: "Could not save resource to database",
      http_hint: 500,
    };
  }

  // Build the x402.jobs URL
  const x402JobsUrl = `https://www.x402.jobs/resources/${server.slug}/${resource.slug}`;

  console.log(
    `✅ Resource created via API: ${resource.id} (${resource.name}) by ${apiKeyUser.name}`,
  );

  return {
    status: "created",
    resource: {
      id: resource.id,
      name: resource.name,
      slug: resource.slug,
      url: x402JobsUrl,
      resource_url: resource.resource_url,
      network: resource.network,
      category: resource.category,
      server_id: resource.server_id,
      server_slug: server.slug ?? "",
      created_at: resource.created_at,
    },
  };
}

// Maps a RegisterResult back to the legacy single-endpoint HTTP response shape.
// External contract here MUST be byte-identical to pre-refactor behavior.
function sendSingleEndpointResponse(
  res: import("express").Response,
  result: RegisterResult,
): void {
  switch (result.status) {
    case "created":
      res.status(201).json({
        success: true,
        created: true,
        data: result.resource,
      });
      return;
    case "updated":
      res.status(200).json({
        success: true,
        updated: true,
        data: result.resource,
      });
      return;
    case "noop":
    case "skipped":
      // Both map to the historical "updated: false" reply so the single
      // endpoint's external contract is preserved.
      res.status(200).json({
        success: true,
        updated: false,
        message: "Resource already exists with all provided fields",
        data: result.resource,
      });
      return;
    case "error":
      res.status(result.http_hint).json({
        error: result.error,
        message: result.message,
      });
      return;
  }
}

// Per-item bulk-response entry. Bulk treats `noop` (matched + caller owns it +
// no fields actually changed) as `updated` semantically — callers see "we
// matched and processed this one." `skipped` is the bulk-only non-owner case.
type BulkResultEntry =
  | { index: number; status: "created"; resource: ResourceResponseData }
  | { index: number; status: "updated"; resource: ResourceResponseData }
  | {
      index: number;
      status: "skipped";
      error: "not_owner";
      message: string;
      resource: ResourceResponseData;
    }
  | {
      index: number;
      status: "error";
      error: string;
      message: string;
    };

function mapResultToBulkEntry(
  result: RegisterResult,
  index: number,
): BulkResultEntry {
  switch (result.status) {
    case "created":
      return { index, status: "created", resource: result.resource };
    case "updated":
    case "noop":
      // PRD: bulk treats noop as updated semantically.
      return { index, status: "updated", resource: result.resource };
    case "skipped":
      return {
        index,
        status: "skipped",
        error: result.error,
        message: result.message,
        resource: result.resource,
      };
    case "error":
      return {
        index,
        status: "error",
        error: result.error,
        message: result.message,
      };
  }
}

// POST /api/v1/resources/bulk - Register up to BULK_MAX_ITEMS resources in one request.
//
// Concurrency: BULK_CONCURRENCY in-flight per request via p-limit.
// Rate limit: 6 req/min per API key via bulkResourceRateLimiter (separate
// keyspace from the broader minute/hour buckets, which still also apply).
//
// HTTP semantics:
//   - 200: structurally valid request. Per-item statuses indicate partial
//     success/failure. `summary.errored > 0` is a partial-success signal,
//     NOT a top-level failure.
//   - 400: structurally invalid request (missing/non-array/empty/over-cap
//     `resources`). No per-item work performed.
//   - 500: unexpected internal error wrapping the whole batch.
publicApiRouter.post(
  "/resources/bulk",
  bulkResourceRateLimiter,
  async (req, res) => {
    const batchStart = Date.now();
    try {
      const { resources } = req.body || {};
      if (!Array.isArray(resources)) {
        return res.status(400).json({
          error: "Invalid bulk request",
          message: "`resources` must be an array.",
        });
      }
      if (resources.length === 0) {
        return res.status(400).json({
          error: "Invalid bulk request",
          message: "`resources` must contain at least 1 item.",
        });
      }
      if (resources.length > BULK_MAX_ITEMS) {
        return res.status(400).json({
          error: "Invalid bulk request",
          message: `\`resources\` cannot exceed ${BULK_MAX_ITEMS} items per request (got ${resources.length}).`,
        });
      }

      const limit = pLimit(BULK_CONCURRENCY);
      const results = await Promise.all(
        resources.map((input: unknown, index: number) =>
          limit(async (): Promise<BulkResultEntry> => {
            const itemStart = Date.now();
            try {
              const result = await registerOneResource(
                input as RegisterInput,
                req.apiKey!,
              );
              const itemMs = Date.now() - itemStart;
              console.log(
                `[bulk] item ${index} status=${result.status} wallMs=${itemMs}`,
              );
              return mapResultToBulkEntry(result, index);
            } catch (err) {
              // Defense in depth: registerOneResource catches its own
              // input/validation errors and returns RegisterResult, so a throw
              // here is either an unexpected runtime fault or a downstream
              // dependency (supabase, getOrCreateServer) blowing up. Don't
              // fail the whole batch — sanitize the message and continue.
              const itemMs = Date.now() - itemStart;
              console.error(
                `[bulk] item ${index} threw after ${itemMs}ms:`,
                err,
              );
              return {
                index,
                status: "error",
                error: "Internal error",
                message:
                  err instanceof Error ? err.message : "Unknown error",
              };
            }
          }),
        ),
      );

      const summary = {
        total: results.length,
        created: results.filter((r) => r.status === "created").length,
        updated: results.filter((r) => r.status === "updated").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errored: results.filter((r) => r.status === "error").length,
      };
      const batchMs = Date.now() - batchStart;
      console.log(
        `[bulk] batch total=${summary.total} wallMs=${batchMs} created=${summary.created} updated=${summary.updated} skipped=${summary.skipped} errored=${summary.errored}`,
      );

      res.status(200).json({ summary, results });
    } catch (error) {
      console.error("[bulk] unexpected error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to process bulk request",
      });
    }
  },
);

// POST /api/v1/resources - Add a new resource
publicApiRouter.post("/resources", async (req, res) => {
  try {
    const result = await registerOneResource(req.body, req.apiKey!);
    sendSingleEndpointResponse(res, result);
  } catch (error) {
    console.error("Public API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// GET /api/v1/resources - List resources created by this API key
publicApiRouter.get("/resources", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data: resources, error } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id,
        name,
        slug,
        description,
        resource_url,
        category,
        tags,
        capabilities,
        server_id,
        created_at,
        updated_at,
        is_active
      `,
      )
      .eq("registered_by", req.apiKey!.created_by)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      console.error("Error fetching resources:", error);
      return res.status(500).json({
        error: "Failed to fetch resources",
        message: "Could not retrieve resources from database",
      });
    }

    res.json({
      success: true,
      data: resources || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        has_more: (resources || []).length === Number(limit),
      },
    });
  } catch (error) {
    console.error("Public API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// GET /api/v1/resources/:id - Get a specific resource
publicApiRouter.get("/resources/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: resource, error } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id,
        name,
        slug,
        description,
        resource_url,
        category,
        tags,
        capabilities,
        server_id,
        extra,
        created_at,
        updated_at,
        is_active
      `,
      )
      .eq("id", id)
      .eq("registered_by", req.apiKey!.created_by)
      .eq("is_active", true)
      .single();

    if (error || !resource) {
      return res.status(404).json({
        error: "Resource not found",
        message: "Resource does not exist or you don't have access to it",
      });
    }

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    console.error("Public API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// PUT /api/v1/resources/:id - Update a resource
publicApiRouter.put("/resources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const apiKeyUserId = req.apiKey!.created_by;
    const {
      name,
      description,
      resource_url,
      category,
      tags,
      capabilities,
      extra,
    } = req.body;

    // First fetch the resource with ownership info
    const { data: existingResource, error: fetchError } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, name, is_active, registered_by, verified_owner_id,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingResource) {
      return res.status(404).json({
        error: "Resource not found",
        message: "Resource does not exist",
      });
    }

    if (!existingResource.is_active) {
      return res.status(404).json({
        error: "Resource not found",
        message: "Resource has been deleted",
      });
    }

    // Check ownership - must be owner to update
    const serverData = existingResource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;

    const isResourceVerifiedOwner =
      existingResource.verified_owner_id === apiKeyUserId;
    const isResourceRegistrant =
      existingResource.registered_by === apiKeyUserId;
    const isServerVerifiedOwner = server?.verified_owner_id === apiKeyUserId;
    const isServerRegistrant = server?.registered_by === apiKeyUserId;

    // Can only update if: verified owner, OR registrant when no one has claimed ownership
    const resourceIsClaimed = !!existingResource.verified_owner_id;
    const serverIsClaimed = !!server?.verified_owner_id;

    const canUpdate =
      isResourceVerifiedOwner ||
      isServerVerifiedOwner ||
      (isResourceRegistrant && !resourceIsClaimed && !serverIsClaimed) ||
      (isServerRegistrant && !serverIsClaimed);

    if (!canUpdate) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You don't have permission to update this resource. The resource or server has been claimed by another user.",
      });
    }

    // Validate URL if provided
    if (resource_url) {
      try {
        new URL(resource_url);
      } catch {
        return res.status(400).json({
          error: "Invalid URL",
          message: "resource_url must be a valid URL",
        });
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      updateData.name = name;
      updateData.slug = await getUniqueResourceSlug(null, generateSlug(name));
    }
    if (description !== undefined) updateData.description = description;
    if (resource_url !== undefined) updateData.resource_url = resource_url;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (capabilities !== undefined) updateData.capabilities = capabilities;
    if (extra !== undefined) updateData.extra = extra;

    const { data: resource, error } = await getSupabase()
      .from("x402_resources")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !resource) {
      return res.status(500).json({
        error: "Failed to update resource",
        message: "Could not update resource in database",
      });
    }

    console.log(
      `✅ Resource updated via API: ${resource.id} (${resource.name}) by ${req.apiKey!.name}`,
    );

    res.json({
      success: true,
      data: {
        id: resource.id,
        name: resource.name,
        slug: resource.slug,
        resource_url: resource.resource_url,
        category: resource.category,
        updated_at: resource.updated_at,
      },
    });
  } catch (error) {
    console.error("Public API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});

// DELETE /api/v1/resources/:id - Delete a resource (soft delete)
publicApiRouter.delete("/resources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const apiKeyUserId = req.apiKey!.created_by;

    // First fetch the resource with ownership info
    const { data: existingResource, error: fetchError } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, name, is_active, registered_by, verified_owner_id,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingResource) {
      return res.status(404).json({
        error: "Resource not found",
        message: "Resource does not exist",
      });
    }

    if (!existingResource.is_active) {
      return res.status(400).json({
        error: "Resource already deleted",
        message: "This resource has already been deleted",
      });
    }

    // Check ownership - must be owner to delete
    const serverData = existingResource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;

    const isResourceVerifiedOwner =
      existingResource.verified_owner_id === apiKeyUserId;
    const isResourceRegistrant =
      existingResource.registered_by === apiKeyUserId;
    const isServerVerifiedOwner = server?.verified_owner_id === apiKeyUserId;
    const isServerRegistrant = server?.registered_by === apiKeyUserId;

    // Can only delete if: verified owner, OR registrant when no one has claimed ownership
    const resourceIsClaimed = !!existingResource.verified_owner_id;
    const serverIsClaimed = !!server?.verified_owner_id;

    const canDelete =
      isResourceVerifiedOwner ||
      isServerVerifiedOwner ||
      (isResourceRegistrant && !resourceIsClaimed && !serverIsClaimed) ||
      (isServerRegistrant && !serverIsClaimed);

    if (!canDelete) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You don't have permission to delete this resource. The resource or server has been claimed by another user.",
      });
    }

    // Soft delete
    const { error } = await getSupabase()
      .from("x402_resources")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return res.status(500).json({
        error: "Failed to delete resource",
        message: "Could not delete resource from database",
      });
    }

    console.log(
      `✅ Resource deleted via API: ${existingResource.id} (${existingResource.name}) by ${req.apiKey!.name}`,
    );

    res.json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error) {
    console.error("Public API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request",
    });
  }
});
