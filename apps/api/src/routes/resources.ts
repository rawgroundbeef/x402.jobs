import { Router } from "express";
import type { Router as RouterType } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { extractConfig } from "x402check";
import { isAdminUser, config } from "../config";
import { getOrCreateServer, getOrCreateHostedServer } from "./servers";
import { getSupabase } from "../lib/supabase";
import { encryptSecret, isEncryptionConfigured } from "../lib/instant";
import { normalizeNetworkId } from "../lib/networks";
import { requireResourceOwnership } from "../middleware/ownership";
import { apiKeyMiddleware } from "../middleware/apiKey";
import { optionalApiKeyMiddleware } from "../middleware/optionalApiKey";
import { discoveryApiRateLimiter } from "../middleware/rateLimit";
import { hasCreatorOpenRouterApiKey } from "./integrations";

// Generate a URL-safe slug from text
function generateSlug(inputText: string): string {
  let slug = inputText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-") // Replace special chars with hyphens (not remove)
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens

  // Truncate if too long (max 60 chars to keep URLs reasonable)
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-$/, ""); // Trim trailing hyphen after truncate
  }

  return slug;
}

// Generate a unique resource slug within a server
async function getUniqueResourceSlug(
  supabase: SupabaseClient,
  serverId: string | null,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    let query = supabase
      .from("x402_resources")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true);

    if (serverId) {
      query = query.eq("server_id", serverId);
    }

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data: existing } = await query.maybeSingle();

    if (!existing) return slug;

    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}

// Public router (no auth required)
export const resourcesVerifyRouter: RouterType = Router();

// Protected router (auth required)
export const resourcesProtectedRouter: RouterType = Router();

const BUCKET_NAME = "x402-cached-images";

// Helper to generate embedding for a resource using OpenAI
async function generateResourceEmbedding(
  resourceId: string,
  data: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    capabilities?: string[];
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    console.warn("OPENAI_API_KEY not set, skipping embedding generation");
    return;
  }

  try {
    // Build embedding text from resource metadata
    const parts: string[] = [
      data.name,
      data.description || "",
      data.category || "",
      ...(data.tags || []),
      ...(data.capabilities || []),
    ];

    // Include relevant extra fields
    if (data.extra) {
      const { agentName, serviceName, commands } = data.extra as {
        agentName?: string;
        serviceName?: string;
        commands?: string[];
      };
      if (agentName) parts.push(agentName);
      if (serviceName) parts.push(serviceName);
      if (commands) parts.push(...commands);
    }

    const embeddingText = parts.filter(Boolean).join(". ").slice(0, 8000);

    // Call OpenAI embeddings API
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: embeddingText,
        dimensions: 1536,
      }),
    });

    if (!response.ok) {
      console.error("Embedding API error:", await response.text());
      return;
    }

    const result = await response.json();
    const embedding = result.data[0].embedding;

    // Update the resource with the embedding (pgvector format)
    const { error } = await getSupabase()
      .from("x402_resources")
      .update({ embedding: `[${embedding.join(",")}]` })
      .eq("id", resourceId);

    if (error) {
      console.error("Failed to store embedding:", error);
    } else {
      console.log(`✅ Generated embedding for resource ${resourceId}`);
    }
  } catch (error) {
    console.error("Embedding generation error:", error);
  }
}

// Helper to cache an image (exported for use in public-api)
export async function cacheImage(
  url: string,
  type: "avatar" | "favicon",
): Promise<string | null> {
  if (!url) return null;

  const supabase = getSupabase();

  // Check if already cached
  const { data: existing } = await supabase
    .from("x402_cached_images")
    .select("cached_url")
    .eq("original_url", url)
    .maybeSingle();

  if (existing?.cached_url) {
    return existing.cached_url;
  }

  try {
    // Download the image
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; X402Bot/1.0)" },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/png";
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/x-icon": "ico",
      "image/vnd.microsoft.icon": "ico",
    };
    const ext = extMap[contentType] || "png";

    const urlHash = crypto
      .createHash("sha256")
      .update(url)
      .digest("hex")
      .substring(0, 16);
    const prefix = type === "favicon" ? "favicons" : "avatars";
    const filename = `${prefix}/${urlHash}.${ext}`;

    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error("Image upload error:", uploadError);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    const cachedUrl = publicUrlData.publicUrl;

    // Store mapping
    await supabase.from("x402_cached_images").upsert(
      {
        original_url: url,
        cached_url: cachedUrl,
        type,
        filename,
      },
      { onConflict: "original_url" },
    );

    return cachedUrl;
  } catch (error) {
    console.error("Image cache error:", error);
    return null;
  }
}

// ============================================================================
// PUBLIC ROUTES (no auth)
// ============================================================================

// POST /api/resources/verify - Verify an X402 endpoint (public)
resourcesVerifyRouter.post("/verify", async (req, res) => {
  try {
    const { url: rawUrl } = req.body;

    if (!rawUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Normalize URL: trim whitespace and add https:// if missing
    let url = rawUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
      console.log(`[Verify] Added https:// prefix: ${url}`);
    }

    // Try to fetch the X402 info from the URL
    // Try BOTH GET and POST, then pick the one with better schema info
    let response;
    let detectedMethod = "GET";

    try {
      // Try GET first
      const getResponse = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      // Try POST
      const postResponse = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      // Determine which response to use
      const getIs402 = getResponse.status === 402;
      const postIs402 = postResponse.status === 402;

      if (getIs402 && postIs402) {
        // Both return 402 - parse both and pick the one with more schema info
        let getData, postData;
        try {
          getData = await getResponse.json();
        } catch {
          getData = null;
        }
        try {
          postData = await postResponse.json();
        } catch {
          postData = null;
        }

        const getAccepts = getData?.accepts?.[0] || getData || {};
        const postAccepts = postData?.accepts?.[0] || postData || {};

        // Count schema fields
        const getBodyFields = Object.keys(
          getAccepts.outputSchema?.input?.bodyFields || {},
        ).length;
        const getQueryParams = Object.keys(
          getAccepts.outputSchema?.input?.queryParams || {},
        ).length;
        const postBodyFields = Object.keys(
          postAccepts.outputSchema?.input?.bodyFields || {},
        ).length;
        const postQueryParams = Object.keys(
          postAccepts.outputSchema?.input?.queryParams || {},
        ).length;

        const getSchemaCount = getBodyFields + getQueryParams;
        const postSchemaCount = postBodyFields + postQueryParams;

        console.log(
          `[Verify] ${url}: GET schema fields: ${getSchemaCount} (body: ${getBodyFields}, query: ${getQueryParams})`,
        );
        console.log(
          `[Verify] ${url}: POST schema fields: ${postSchemaCount} (body: ${postBodyFields}, query: ${postQueryParams})`,
        );

        // Prefer POST if it has more fields, or if it has bodyFields (indicates POST method)
        if (
          postSchemaCount > getSchemaCount ||
          (postBodyFields > 0 && getBodyFields === 0)
        ) {
          response = postResponse;
          detectedMethod = "POST";
          // Re-create response with parsed data since we already consumed it
          response.json = async () => postData;
        } else {
          response = getResponse;
          detectedMethod = "GET";
          response.json = async () => getData;
        }
      } else if (postIs402) {
        response = postResponse;
        detectedMethod = "POST";
      } else if (getIs402) {
        response = getResponse;
        detectedMethod = "GET";
      } else {
        // Neither returned 402
        response = getResponse; // Will fail validation below
      }
    } catch {
      return res.status(400).json({
        error: "Failed to reach URL. Check that the endpoint is accessible.",
      });
    }

    if (response.status !== 402) {
      return res.status(400).json({
        error: `Expected 402 Payment Required, got ${response.status} ${response.statusText}. Tried both GET and POST.`,
        status: response.status,
      });
    }

    // Parse response body (raw JSON)
    let parsedBody = null;
    try {
      parsedBody = await response.json();
    } catch {
      // Body parse failed, that's OK - frontend will use header fallback
    }

    // Collect relevant headers for frontend extraction
    const relevantHeaders: Record<string, string> = {};
    const paymentRequiredHeader =
      response.headers.get("payment-required") ||
      response.headers.get("PAYMENT-REQUIRED");
    if (paymentRequiredHeader) {
      relevantHeaders["payment-required"] = paymentRequiredHeader;
    }

    // Get server preview info
    const urlObj = new URL(url);
    const originUrl = urlObj.origin;
    const hostname = urlObj.hostname;

    // Check if server already exists
    const { data: existingServer } = await getSupabase()
      .from("x402_servers")
      .select("id, slug, name, favicon_url, resource_count")
      .eq("origin_url", originUrl)
      .maybeSingle();

    // Try to get favicon if server doesn't exist
    let faviconUrl = existingServer?.favicon_url || null;
    if (!existingServer) {
      try {
        const faviconPaths = [
          "/favicon.ico",
          "/favicon.png",
          "/apple-touch-icon.png",
        ];
        for (const path of faviconPaths) {
          const faviconResponse = await fetch(`${originUrl}${path}`, {
            method: "HEAD",
          });
          if (faviconResponse.ok) {
            faviconUrl = `${originUrl}${path}`;
            break;
          }
        }
      } catch {
        // Favicon fetch failed, continue without it
      }
    }

    res.json({
      status: response.status,
      body: parsedBody,
      headers: relevantHeaders,
      detectedMethod,
      server: {
        exists: !!existingServer,
        id: existingServer?.id || null,
        slug: existingServer?.slug || null,
        name: existingServer?.name || hostname,
        originUrl,
        faviconUrl,
        resourceCount: existingServer?.resource_count || 0,
      },
    });
  } catch (error) {
    console.error("Resource verify error:", error);
    res.status(400).json({ error: "Failed to verify URL" });
  }
});

// GET /api/resources/search - AI-powered resource search for Jobputer
// Uses full-text search, tags, capabilities, and semantic matching
resourcesVerifyRouter.get("/search", async (req, res) => {
  try {
    const {
      q, // Natural language query
      category, // Filter by category
      network, // Filter by network
      capability, // Filter by capability (e.g., "generate-image")
      inputType, // Filter by input type (e.g., "text", "image-url")
      outputType, // Filter by output type
      tag, // Filter by tag
      limit = "20",
      offset = "0",
    } = req.query;

    const supabase = getSupabase();
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // Build the query
    let query = supabase
      .from("x402_resources")
      .select(
        `
        id, name, description, resource_url, network, max_amount_required,
        category, tags, capabilities, input_types, output_types,
        avatar_url, output_schema, is_verified, call_count, total_earned_usdc,
        success_count_30d, failure_count_30d,
        server:x402_servers(id, slug, name, origin_url, favicon_url)
      `,
        { count: "exact" },
      )
      .eq("is_active", true)
      .or("health_status.is.null,health_status.neq.offline"); // Exclude offline resources

    // Apply filters
    if (category) {
      query = query.eq("category", category);
    }
    if (network) {
      query = query.eq("network", network);
    }
    if (capability) {
      query = query.contains("capabilities", [capability]);
    }
    if (inputType) {
      query = query.contains("input_types", [inputType]);
    }
    if (outputType) {
      query = query.contains("output_types", [outputType]);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // Full-text search if query provided
    if (q && typeof q === "string" && q.trim()) {
      // Use PostgreSQL full-text search with the search_vector column
      // Convert natural language to tsquery format
      const searchTerms = q.trim().split(/\s+/).filter(Boolean);
      const tsquery = searchTerms.map((t) => `${t}:*`).join(" & ");

      query = query.textSearch("search_vector", tsquery, {
        type: "websearch",
        config: "english",
      });
    }

    // Order by relevance (verified first, then by popularity)
    query = query
      .order("is_verified", { ascending: false })
      .order("popularity_score", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    const { data: resources, error, count } = await query;

    if (error) {
      console.error("Error searching resources:", error);
      return res.status(500).json({ error: "Search failed" });
    }

    // Transform for response
    const results = (resources || []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      url: r.resource_url,
      network: r.network,
      price: r.max_amount_required
        ? parseFloat(r.max_amount_required) / 1_000_000
        : 0,
      category: r.category,
      tags: r.tags || [],
      capabilities: r.capabilities || [],
      inputTypes: r.input_types || [],
      outputTypes: r.output_types || [],
      avatarUrl: r.avatar_url,
      isVerified: r.is_verified,
      server: r.server
        ? {
            id: (r.server as any).id,
            name: (r.server as any).name,
            faviconUrl: (r.server as any).favicon_url,
          }
        : null,
    }));

    res.json({
      results,
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Resource search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// POST /api/resources/search/semantic - Semantic search using embeddings
// Use this for natural language queries like "I want to generate twitter images"
resourcesVerifyRouter.post("/search/semantic", async (req, res) => {
  try {
    const {
      query, // Natural language query
      network, // Optional network filter
      limit = 10,
    } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    const supabase = getSupabase();
    const limitNum = Math.min(limit, 50);

    // Generate embedding for the query
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return res
        .status(500)
        .json({ error: "Embedding service not configured" });
    }

    // Call OpenAI to generate embedding
    const embeddingResponse = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: query.slice(0, 8000),
          dimensions: 1536,
        }),
      },
    );

    if (!embeddingResponse.ok) {
      console.error("Embedding API error:", await embeddingResponse.text());
      return res.status(500).json({ error: "Failed to generate embedding" });
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Use pgvector to find similar resources
    // We use a raw query because Supabase JS doesn't support vector operations directly
    const rpcQuery = supabase.rpc("search_resources_by_embedding", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, // Minimum similarity (0-1)
      match_count: limitNum,
      filter_network: network || null,
    });

    const { data: resources, error } = await rpcQuery;

    if (error) {
      console.error("Semantic search error:", error);
      // Fall back to keyword search
      return res.status(500).json({
        error: "Semantic search failed",
        fallback: "Use /api/resources/search for keyword search",
      });
    }

    // Transform results
    const results = (resources || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      url: r.resource_url,
      network: r.network,
      price: r.max_amount_required
        ? parseFloat(r.max_amount_required as string) / 1_000_000
        : 0,
      category: r.category,
      tags: r.tags || [],
      capabilities: r.capabilities || [],
      similarity: r.similarity,
      server: r.server_name
        ? {
            id: r.server_id,
            name: r.server_name,
            faviconUrl: r.server_favicon_url,
          }
        : null,
    }));

    res.json({
      results,
      query,
      searchType: "semantic",
    });
  } catch (error) {
    console.error("Semantic search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/resources/capabilities - List all unique capabilities
resourcesVerifyRouter.get("/capabilities", async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from("x402_resources")
      .select("capabilities")
      .eq("is_active", true);

    if (error) throw error;

    // Flatten and count capabilities
    const capabilityCounts: Record<string, number> = {};
    for (const r of data || []) {
      for (const cap of r.capabilities || []) {
        capabilityCounts[cap] = (capabilityCounts[cap] || 0) + 1;
      }
    }

    // Sort by count
    const sorted = Object.entries(capabilityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([capability, count]) => ({ capability, count }));

    res.json({ capabilities: sorted });
  } catch (error) {
    console.error("Error fetching capabilities:", error);
    res.status(500).json({ error: "Failed to fetch capabilities" });
  }
});

// GET /api/resources/categories - List all categories with counts
resourcesVerifyRouter.get("/categories", async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from("x402_resources")
      .select("category")
      .eq("is_active", true);

    if (error) throw error;

    // Count categories
    const categoryCounts: Record<string, number> = {};
    for (const r of data || []) {
      if (r.category) {
        categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      }
    }

    // Sort by count
    const sorted = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    res.json({ categories: sorted });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/resources/check - Check a resource by URL
// Returns resource data if found, or { found: false } if not
// Rate limited: 100/day free tier, unlimited for paid API keys
resourcesVerifyRouter.get(
  "/check",
  optionalApiKeyMiddleware,
  discoveryApiRateLimiter,
  async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Normalize the URL: strip protocol
      const normalizedUrl = url.replace(/^https?:\/\//, "");

      // Look up resource by normalized_url
      const { data: resource, error } = await getSupabase()
        .from("x402_resources")
        .select(
          `
        id,
        slug,
        name,
        avatar_url,
        resource_url,
        call_count,
        total_earned_usdc,
        success_count_30d,
        failure_count_30d,
        last_called_at,
        server:x402_servers(slug)
      `,
        )
        .eq("normalized_url", normalizedUrl)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!resource) {
        return res.json({ found: false, url });
      }

      // Calculate success rate
      const successCount = resource.success_count_30d || 0;
      const failureCount = resource.failure_count_30d || 0;
      const totalCalls = successCount + failureCount;
      const successRate =
        totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 100;

      const serverSlug = (resource.server as { slug?: string } | null)?.slug;

      res.json({
        found: true,
        resource: {
          id: resource.id,
          name:
            serverSlug && resource.slug
              ? `${serverSlug}/${resource.slug}`
              : resource.name,
          slug: resource.slug,
          server_slug: serverSlug,
          avatar_url: resource.avatar_url,
          resource_url: resource.resource_url,
          success_rate: successRate,
          call_count: resource.call_count || 0,
          last_called_at: resource.last_called_at,
          total_earned_usdc: resource.total_earned_usdc,
        },
      });
    } catch (error) {
      console.error("Error checking resource:", error);
      res.status(500).json({ error: "Failed to check resource" });
    }
  },
);

// GET /api/resources - List all resources (public)
// Supports: search, category, network, a2a, sort (latest|popular|price_low|price_high), limit, offset
resourcesVerifyRouter.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      network,
      a2a,
      sort = "popular",
      limit = "25",
      offset = "0",
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // Determine sort order
    let orderColumn = "created_at";
    let orderAscending = false;
    switch (sort) {
      case "popular":
        orderColumn = "call_count";
        orderAscending = false;
        break;
      case "top_earning":
        orderColumn = "total_earned_usdc";
        orderAscending = false;
        break;
      case "price_low":
        orderColumn = "max_amount_required";
        orderAscending = true;
        break;
      case "price_high":
        orderColumn = "max_amount_required";
        orderAscending = false;
        break;
      case "latest":
      default:
        orderColumn = "created_at";
        orderAscending = false;
    }

    // Build count query (head: true means no data, just count)
    let countQuery = getSupabase()
      .from("x402_resources")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .or("health_status.is.null,health_status.neq.offline");

    // Build data query with pagination
    let dataQuery = getSupabase()
      .from("x402_resources")
      .select(
        "id, slug, name, description, resource_url, network, pay_to, max_amount_required, category, avatar_url, output_schema, extra, is_verified, is_a2a, created_at, call_count, total_earned_usdc, success_count_30d, failure_count_30d, last_called_at, server_id, display_path, pt_parameters, server:x402_servers(id, slug, name, origin_url, favicon_url)",
      )
      .eq("is_active", true)
      .or("health_status.is.null,health_status.neq.offline")
      .order(orderColumn, { ascending: orderAscending })
      .range(offsetNum, offsetNum + limitNum - 1);

    // Apply optional filters to both queries
    if (category) {
      countQuery = countQuery.eq("category", category);
      dataQuery = dataQuery.eq("category", category);
    }
    if (network) {
      countQuery = countQuery.eq("network", network);
      dataQuery = dataQuery.eq("network", network);
    }
    if (a2a === "true") {
      countQuery = countQuery.eq("is_a2a", true);
      dataQuery = dataQuery.eq("is_a2a", true);
    }
    if (search && typeof search === "string") {
      const searchPattern = `%${search}%`;
      const searchFilter = `display_path.ilike.${searchPattern},name.ilike.${searchPattern},slug.ilike.${searchPattern},resource_url.ilike.${searchPattern},description.ilike.${searchPattern},category.ilike.${searchPattern}`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
    }

    // Run both queries in parallel for efficiency
    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countResult.error) {
      console.error("Error fetching resources count:", countResult.error);
      return res.status(500).json({ error: "Failed to fetch resources count" });
    }

    if (dataResult.error) {
      console.error("Error fetching resources:", dataResult.error);
      return res.status(500).json({ error: "Failed to fetch resources" });
    }

    const totalCount = countResult.count || 0;
    const resources = dataResult.data || [];

    // Deduplicate by resource_url (keep first occurrence, which is most relevant due to sort order)
    const seen = new Set<string>();
    const paginatedResources = resources.filter((r) => {
      if (seen.has(r.resource_url)) return false;
      seen.add(r.resource_url);
      return true;
    });

    // Helper to format relative time
    const formatRelativeTime = (date: string | null): string => {
      if (!date) return "never";
      const now = Date.now();
      const then = new Date(date).getTime();
      const diffMs = now - then;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(date).toLocaleDateString();
    };

    // Helper to format currency
    const formatValue = (usdc: number | null): string => {
      if (!usdc) return "$0";
      if (usdc >= 1000000) return `$${(usdc / 1000000).toFixed(1)}m`;
      if (usdc >= 1000) return `$${(usdc / 1000).toFixed(1)}k`;
      return `$${usdc.toFixed(2)}`;
    };

    // Transform to consumer-friendly format
    const transformedResources = paginatedResources.map((r) => {
      const { server } = r as typeof r & {
        server?: {
          id?: string;
          slug?: string;
          name?: string;
          origin_url?: string;
          favicon_url?: string;
        };
      };

      // Calculate success rate (as integer percentage, e.g. 80 for 80%)
      const successCount = r.success_count_30d || 0;
      const failureCount = r.failure_count_30d || 0;
      const totalCalls = successCount + failureCount;
      const successRate =
        totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 100;

      return {
        // Raw fields (for frontend compatibility)
        id: r.id,
        slug: r.slug,
        server_slug: server?.slug,
        resource_url: r.resource_url,
        call_count: r.call_count || 0,
        total_earned_usdc: r.total_earned_usdc,
        success_count_30d: r.success_count_30d || 0,
        failure_count_30d: r.failure_count_30d || 0,
        last_called_at: r.last_called_at,

        // Identity
        name: r.display_path || r.name,
        url: r.resource_url,
        x402jobs_url:
          server?.slug && r.slug
            ? `https://x402.jobs/resources/${server.slug}/${r.slug}`
            : null,
        avatar_url: r.avatar_url || r.extra?.avatarUrl || server?.favicon_url,

        // Stats (consumer-friendly)
        success_rate: successRate,
        calls: r.call_count || 0,
        value_processed: formatValue(r.total_earned_usdc),
        last_called: formatRelativeTime(r.last_called_at),

        // Metadata
        network: r.network,
        description: r.description,
        max_amount_required: r.max_amount_required,
        is_a2a: r.is_a2a || false,
        output_schema: r.output_schema,
        extra: r.extra,
        pt_parameters: r.pt_parameters,
      };
    });

    res.json({
      resources: transformedResources,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Resources fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to check if string is a UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str,
  );
}

// GET /api/resources/:serverSlug/:resourceSlug - Get resource by slugs (public)
resourcesVerifyRouter.get("/:serverSlug/:resourceSlug", async (req, res) => {
  try {
    const { serverSlug, resourceSlug } = req.params;

    // First get the server by slug
    const { data: server, error: serverError } = await getSupabase()
      .from("x402_servers")
      .select(
        "id, name, origin_url, favicon_url, slug, verified_owner_id, is_hosted",
      )
      .eq("slug", serverSlug)
      .single();

    if (serverError || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Get owner profile if server has a verified owner
    let ownerProfile: {
      username: string;
      display_name: string;
      avatar_url: string;
    } | null = null;
    if (server.verified_owner_id) {
      const { data } = await getSupabase()
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", server.verified_owner_id)
        .is("deleted_at", null)
        .single();
      ownerProfile = data;
    }

    // Then get the resource by slug within that server
    // Include ai_models join for OpenRouter resources to get model name/provider
    const { data: resource, error } = await getSupabase()
      .from("x402_resources")
      .select("*, openrouter_model:x402_openrouter_models(display_name, provider)")
      .eq("server_id", server.id)
      .eq("slug", resourceSlug)
      .eq("is_active", true)
      .single();

    if (error || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // For hosted servers, get owner from registered_by if no verified_owner
    if (server.is_hosted && !ownerProfile && resource.registered_by) {
      const { data } = await getSupabase()
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", resource.registered_by)
        .is("deleted_at", null)
        .single();
      ownerProfile = data;
    }

    // Map pt_ prefixed fields to expected names for prompt_template and openrouter_instant resources
    const promptTemplateFields =
      resource.resource_type === "prompt_template" ||
      resource.resource_type === "openrouter_instant"
        ? {
            parameters: resource.pt_parameters || [],
            model: resource.pt_model,
            max_tokens: resource.pt_max_tokens,
            allows_user_message: resource.pt_allows_user_message,
          }
        : {};

    // Extract OpenRouter model info from joined ai_models table
    const openrouterModelInfo = resource.openrouter_model as {
      display_name: string;
      provider: string;
    } | null;

    const flatResource = {
      ...resource,
      ...promptTemplateFields,
      // Add OpenRouter model fields for frontend display
      model_name: openrouterModelInfo?.display_name || null,
      model_provider: openrouterModelInfo?.provider || null,
      server_id: server.id,
      server_name: server.name,
      server_slug: server.slug,
      server_origin_url: server.origin_url,
      server_favicon: server.is_hosted
        ? ownerProfile?.avatar_url || server.favicon_url
        : server.favicon_url,
      server_verified_owner_id: server.verified_owner_id,
      server_owner_username: ownerProfile?.username,
      server_owner_display_name: ownerProfile?.display_name,
      server_owner_avatar_url: ownerProfile?.avatar_url,
      server_is_hosted: server.is_hosted,
    };

    res.json({ resource: flatResource });
  } catch (error) {
    console.error("Resource fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resources/:id - Get single resource by ID (public)
resourcesVerifyRouter.get("/:id", async (req, res) => {
  try {
    const resourceId = req.params.id;

    // Only handle UUID lookups here (slug lookups go through /:serverSlug/:resourceSlug)
    if (!isUUID(resourceId)) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const { data: resource, error } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        *,
        server:x402_servers(id, name, slug, origin_url, favicon_url, verified_owner_id)
      `,
      )
      .eq("id", resourceId)
      .eq("is_active", true)
      .single();

    if (error || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Flatten server info
    const server = resource.server as {
      id: string;
      name: string;
      slug: string;
      origin_url: string;
      favicon_url: string | null;
      verified_owner_id: string | null;
    } | null;

    // Get owner profile if server has a verified owner
    let serverOwner: {
      username: string;
      display_name: string;
      avatar_url: string;
    } | null = null;
    if (server?.verified_owner_id) {
      const { data } = await getSupabase()
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", server.verified_owner_id)
        .is("deleted_at", null)
        .single();
      serverOwner = data;
    }

    const flatResource = {
      ...resource,
      server_id: server?.id || resource.server_id,
      server_name: server?.name,
      server_slug: server?.slug,
      server_origin_url: server?.origin_url,
      server_favicon: server?.favicon_url,
      server_verified_owner_id: server?.verified_owner_id,
      server_owner_username: serverOwner?.username,
      server_owner_display_name: serverOwner?.display_name,
      server_owner_avatar_url: serverOwner?.avatar_url,
      server: undefined, // Remove nested object
    };

    res.json({ resource: flatResource });
  } catch (error) {
    console.error("Resource fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/v1/resources - Register or update a resource (API key auth)
// This endpoint mirrors resourcesProtectedRouter.post("/") but uses API key instead of JWT
resourcesVerifyRouter.post("/", apiKeyMiddleware, async (req, res) => {
  try {
    // Get userId from API key owner
    const userId = req.apiKey?.created_by;
    if (!userId) {
      return res.status(401).json({
        error: "API key has no associated user",
        message: "This API key cannot be used to register resources",
      });
    }

    const {
      resourceUrl,
      network,
      name,
      description,
      payTo,
      maxAmountRequired,
      asset,
      category,
      mimeType,
      maxTimeoutSeconds,
      outputSchema,
      extra,
      avatarUrl,
      isA2A,
      supportsRefunds,
    } = req.body;

    if (!resourceUrl || !network || !name || !payTo) {
      return res.status(400).json({
        error: "Missing required fields: resourceUrl, network, name, payTo",
      });
    }

    // Validate network - normalize CAIP-2 identifiers (e.g., "eip155:8453" → "base")
    const SUPPORTED_NETWORKS = ["solana", "base"];
    const normalizedNetwork = normalizeNetworkId(network);
    if (!SUPPORTED_NETWORKS.includes(normalizedNetwork)) {
      return res.status(400).json({
        error: `Unsupported network: "${network}". We currently only support Solana and Base networks.`,
      });
    }

    // Normalize URL
    const normalizedUrl = resourceUrl.trim();

    // Probe the endpoint to get x402 payment info if not provided
    let extractedMaxAmount = maxAmountRequired;
    let extractedAsset = asset;
    let extractedPayTo = payTo;
    let extractedNetwork = normalizedNetwork;
    
    if (!maxAmountRequired) {
      console.log(`[Resource] Probing endpoint for payment info: ${normalizedUrl}`);
      try {
        // Try GET first
        let probeResponse = await fetch(normalizedUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        
        // If GET doesn't return 402, try POST
        if (probeResponse.status !== 402) {
          console.log(`[Resource] GET returned ${probeResponse.status}, trying POST...`);
          probeResponse = await fetch(normalizedUrl, {
            method: "POST",
            headers: { 
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({})
          });
        }
        
        if (probeResponse.status === 402) {
          const body = await probeResponse.json().catch(() => null);
          const paymentHeader = probeResponse.headers.get("payment-required");
          
          // Use x402check to extract config
          const extraction = extractConfig({ 
            body, 
            headers: paymentHeader ? { "payment-required": paymentHeader } : {} 
          });
          
          if (extraction.config) {
            const cfg = extraction.config as any;
            console.log(`[Resource] x402check config:`, JSON.stringify(cfg, null, 2));
            // Handle v2 format with accepts array
            const accepts = cfg.accepts?.[0] || cfg;
            console.log(`[Resource] Using accepts:`, JSON.stringify(accepts, null, 2));
            extractedMaxAmount = accepts.amount || accepts.maxAmountRequired || accepts.max_amount_required;
            extractedAsset = accepts.asset;
            extractedPayTo = accepts.payTo || accepts.pay_to || payTo;
            extractedNetwork = normalizeNetworkId(accepts.network || normalizedNetwork);
            
            console.log(`[Resource] Extracted: amount=${extractedMaxAmount}, asset=${extractedAsset}, network=${extractedNetwork}, payTo=${extractedPayTo}`);
            
            // Validate that probed network is supported
            if (!SUPPORTED_NETWORKS.includes(extractedNetwork)) {
              return res.status(400).json({
                error: `Unsupported network detected from endpoint: "${extractedNetwork}". We currently only support Solana and Base networks.`,
                detectedNetwork: extractedNetwork,
                supportedNetworks: SUPPORTED_NETWORKS,
              });
            }
          } else {
            console.warn(`[Resource] x402check failed:`, extraction.error);
          }
        } else {
          console.warn(`[Resource] Probe returned ${probeResponse.status}, expected 402`);
        }
      } catch (probeError) {
        console.warn(`[Resource] Failed to probe endpoint: ${probeError}`);
      }
    }

    // Get or create the server for this resource's origin
    const server = await getOrCreateServer(normalizedUrl, userId);

    // Cache avatar if provided
    const originalAvatarUrl = avatarUrl || extra?.avatarUrl;
    let cachedAvatarUrl = originalAvatarUrl;
    if (originalAvatarUrl) {
      const cached = await cacheImage(originalAvatarUrl, "avatar");
      if (cached) {
        cachedAvatarUrl = cached;
      }
    }

    // Normalize URL for uniqueness checking
    const urlWithoutProtocol = normalizedUrl.replace(/^https?:\/\//, "");

    // Check if resource already exists by URL AND network
    const { data: existing } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, network, resource_url, slug, is_active, server_id,
        name, description, category, avatar_url, pay_to, extra,
        registered_by, verified_owner_id,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("normalized_url", urlWithoutProtocol)
      .eq("network", extractedNetwork)
      .maybeSingle();

    let resource;
    let isUpdate = false;

    if (existing) {
      // Check ownership
      const serverData = existing.server as unknown;
      const existingServer = (
        Array.isArray(serverData) ? serverData[0] : serverData
      ) as {
        id: string;
        verified_owner_id: string | null;
        registered_by: string | null;
      } | null;

      const isResourceOwner =
        existing.registered_by === userId ||
        existing.verified_owner_id === userId;
      const isServerOwner =
        existingServer &&
        (existingServer.verified_owner_id === userId ||
          existingServer.registered_by === userId);
      const canFullyEdit = isResourceOwner || isServerOwner;

      // Generate slug if needed
      let slugToUpdate = existing.slug;
      if (!slugToUpdate) {
        const baseSlug = generateSlug(name);
        slugToUpdate = await getUniqueResourceSlug(
          getSupabase(),
          server?.id || null,
          baseSlug,
          existing.id,
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        resource_url: normalizedUrl,
        slug: slugToUpdate,
        server_id: server?.id || existing.server_id || null,
        is_active: true,
        updated_at: new Date().toISOString(),
        network: extractedNetwork,
        pay_to: extractedPayTo || payTo,
        max_amount_required: extractedMaxAmount,
        asset: extractedAsset || asset,
        mime_type: mimeType,
        max_timeout_seconds: maxTimeoutSeconds,
        output_schema: outputSchema,
        is_a2a: isA2A || false,
        supports_refunds: supportsRefunds || false,
      };

      if (canFullyEdit) {
        updateData.name = name;
        updateData.description = description;
        updateData.category = category;
        updateData.extra = extra;
        updateData.avatar_url = cachedAvatarUrl;
      } else {
        updateData.name = existing.name || name;
        updateData.description = existing.description || description;
        updateData.category = existing.category || category;
        updateData.extra = existing.extra
          ? { ...existing.extra, ...extra }
          : extra;
        updateData.avatar_url = existing.avatar_url || cachedAvatarUrl;
      }

      const { data: updated, error } = await getSupabase()
        .from("x402_resources")
        .update(updateData)
        .eq("id", existing.id)
        .select(
          `
          *,
          server:x402_servers(id, slug, origin_url, name, favicon_url)
        `,
        )
        .single();

      if (error) {
        console.error("Error updating resource:", error);
        return res.status(500).json({ error: "Failed to update resource" });
      }

      resource = updated;
      isUpdate = true;
    } else {
      // Create new resource with network suffix in slug
      const baseSlug = generateSlug(`${name}-${normalizedNetwork}`);
      const slug = await getUniqueResourceSlug(
        getSupabase(),
        server?.id || null,
        baseSlug,
      );

      const { data: created, error } = await getSupabase()
        .from("x402_resources")
        .insert({
          registered_by: userId,
          resource_url: normalizedUrl,
          normalized_url: urlWithoutProtocol,
          network: extractedNetwork,
          name,
          slug,
          description,
          pay_to: extractedPayTo || payTo,
          max_amount_required: extractedMaxAmount,
          asset: extractedAsset || asset,
          category,
          mime_type: mimeType,
          max_timeout_seconds: maxTimeoutSeconds,
          output_schema: outputSchema,
          extra,
          avatar_url: cachedAvatarUrl,
          server_id: server?.id || null,
          is_verified: false,
          is_active: true,
          is_a2a: isA2A || false,
          supports_refunds: supportsRefunds || false,
        })
        .select(
          `
          *,
          server:x402_servers(id, slug, origin_url, name, favicon_url)
        `,
        )
        .single();

      if (error) {
        console.error("Error registering resource:", error);
        return res.status(500).json({ error: "Failed to register resource" });
      }

      resource = created;
    }

    // Generate embedding asynchronously
    generateResourceEmbedding(resource.id, {
      name,
      description,
      category,
      tags: extra?.tags as string[] | undefined,
      capabilities: extra?.capabilities as string[] | undefined,
      extra,
    }).catch((err) => console.error("Background embedding error:", err));

    // Build effective endpoint URL for x402jobs UI
    const serverSlug = server?.slug || resource.server?.slug;
    const resourceSlug = resource.slug;
    const effectiveEndpoint = serverSlug && resourceSlug
      ? `https://x402.jobs/resources/${serverSlug}/${resourceSlug}`
      : null;

    res
      .status(isUpdate ? 200 : 201)
      .json({ resource, server, updated: isUpdate, effectiveEndpoint });
  } catch (error) {
    console.error("Resource register (API key) error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// PROTECTED ROUTES (auth required)
// ============================================================================

// POST /api/resources - Register or update a resource (upsert)
resourcesProtectedRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      resourceUrl,
      network,
      name,
      description,
      payTo,
      maxAmountRequired,
      asset,
      category,
      mimeType,
      maxTimeoutSeconds,
      outputSchema,
      extra,
      avatarUrl,
      isA2A,
      supportsRefunds,
    } = req.body;

    if (!resourceUrl || !network || !name || !payTo) {
      return res.status(400).json({
        error: "Missing required fields: resourceUrl, network, name, payTo",
      });
    }

    // Validate network - normalize CAIP-2 identifiers (e.g., "eip155:8453" → "base")
    const SUPPORTED_NETWORKS = ["solana", "base"];
    const normalizedNetwork = normalizeNetworkId(network);
    if (!SUPPORTED_NETWORKS.includes(normalizedNetwork)) {
      return res.status(400).json({
        error: `Unsupported network: "${network}". We currently only support Solana and Base networks. Testnet support coming soon!`,
      });
    }

    // Normalize URL: trim whitespace and ensure consistent format
    const normalizedUrl = resourceUrl.trim();

    // Get or create the server for this resource's origin
    const server = await getOrCreateServer(normalizedUrl, userId);
    console.log(
      `[Resource] getOrCreateServer result for ${normalizedUrl}:`,
      server ? `id=${server.id}, slug=${server.slug}` : "null",
    );

    // Cache the avatar image if provided
    const originalAvatarUrl = avatarUrl || extra?.avatarUrl;
    let cachedAvatarUrl = originalAvatarUrl;
    if (originalAvatarUrl) {
      const cached = await cacheImage(originalAvatarUrl, "avatar");
      if (cached) {
        cachedAvatarUrl = cached;
      }
    }

    // Normalize URL: strip protocol for uniqueness checking
    const urlWithoutProtocol = normalizedUrl.replace(/^https?:\/\//, "");

    // Check if resource already exists by normalized URL AND network
    // Each (URL, network) combination is a unique resource
    // Note: We check ALL resources including inactive ones to properly handle upserts
    const { data: existing } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, network, resource_url, slug, is_active, server_id,
        name, description, category, avatar_url, pay_to, extra,
        registered_by, verified_owner_id,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("normalized_url", urlWithoutProtocol)
      .eq("network", normalizedNetwork)
      .maybeSingle();

    if (existing) {
      console.log(
        `[Resource] Found existing resource:`,
        `id=${existing.id}, slug=${existing.slug}, is_active=${existing.is_active}, server_id=${existing.server_id}`,
      );
    }

    let resource;
    let isUpdate = false;

    if (existing) {
      // Check ownership - can this user fully modify the resource?
      // Note: Supabase join returns object for many-to-one, but TS infers array
      const serverData = existing.server as unknown;
      const existingServer = (
        Array.isArray(serverData) ? serverData[0] : serverData
      ) as {
        id: string;
        verified_owner_id: string | null;
        registered_by: string | null;
      } | null;

      const isResourceOwner =
        existing.registered_by === userId ||
        existing.verified_owner_id === userId;
      const isServerOwner =
        existingServer &&
        (existingServer.verified_owner_id === userId ||
          existingServer.registered_by === userId);
      const canFullyEdit = isResourceOwner || isServerOwner;

      console.log(
        `[Resource] Ownership check: userId=${userId}, isResourceOwner=${isResourceOwner}, isServerOwner=${isServerOwner}, canFullyEdit=${canFullyEdit}`,
      );

      // Generate slug if it doesn't exist
      let slugToUpdate = existing.slug;
      if (!slugToUpdate) {
        const baseSlug = generateSlug(name);
        slugToUpdate = await getUniqueResourceSlug(
          getSupabase(),
          server?.id || null,
          baseSlug,
          existing.id,
        );
      }

      // Build update object based on ownership
      const updateData: Record<string, unknown> = {
        resource_url: normalizedUrl, // Always update URL (protocol may have changed)
        slug: slugToUpdate,
        server_id: server?.id || existing.server_id || null,
        is_active: true, // Re-activate if previously deleted
        updated_at: new Date().toISOString(),
        // x402 metadata can always be synced (comes from the resource itself)
        network: normalizedNetwork,
        pay_to: payTo,
        max_amount_required: maxAmountRequired,
        asset,
        mime_type: mimeType,
        max_timeout_seconds: maxTimeoutSeconds,
        output_schema: outputSchema,
        is_a2a: isA2A || false,
        supports_refunds: supportsRefunds || false,
      };

      if (canFullyEdit) {
        // Owner can override user-customizable fields
        updateData.name = name;
        updateData.description = description;
        updateData.category = category;
        updateData.extra = extra;
        updateData.avatar_url = cachedAvatarUrl;
      } else {
        // Non-owner: only fill in missing fields, don't override existing customizations
        updateData.name = existing.name || name; // Keep existing if set
        updateData.description = existing.description || description;
        updateData.category = existing.category || category;
        updateData.extra = existing.extra
          ? { ...existing.extra, ...extra }
          : extra; // Merge, don't replace
        updateData.avatar_url = existing.avatar_url || cachedAvatarUrl; // Keep existing if set

        console.log(
          `[Resource] Non-owner update: preserving existing name="${existing.name}", description="${existing.description?.substring(0, 50)}..."`,
        );
      }

      // Update existing resource
      const { data: updated, error } = await getSupabase()
        .from("x402_resources")
        .update(updateData)
        .eq("id", existing.id)
        .select(
          `
          *,
          server:x402_servers(id, slug, origin_url, name, favicon_url)
        `,
        )
        .single();

      if (error) {
        console.error("Error updating resource:", error);
        return res.status(500).json({ error: "Failed to update resource" });
      }

      resource = updated;
      isUpdate = true;
    } else {
      // Generate a unique slug from the resource name + network
      // This ensures different network versions have distinct slugs
      const baseSlug = generateSlug(`${name}-${normalizedNetwork}`);
      const slug = await getUniqueResourceSlug(
        getSupabase(),
        server?.id || null,
        baseSlug,
      );

      // Create new resource
      const { data: created, error } = await getSupabase()
        .from("x402_resources")
        .insert({
          registered_by: userId,
          resource_url: normalizedUrl,
          normalized_url: urlWithoutProtocol, // For uniqueness checking
          network: normalizedNetwork,
          name,
          slug,
          description,
          pay_to: payTo,
          max_amount_required: maxAmountRequired,
          asset,
          category,
          mime_type: mimeType,
          max_timeout_seconds: maxTimeoutSeconds,
          output_schema: outputSchema,
          extra,
          avatar_url: cachedAvatarUrl,
          server_id: server?.id || null,
          is_verified: false,
          is_active: true,
          is_a2a: isA2A || false,
          supports_refunds: supportsRefunds || false,
        })
        .select(
          `
          *,
          server:x402_servers(id, slug, origin_url, name, favicon_url)
        `,
        )
        .single();

      if (error) {
        console.error("Error registering resource:", error);
        return res.status(500).json({ error: "Failed to register resource" });
      }

      resource = created;
    }

    // Generate embedding asynchronously (don't block response)
    generateResourceEmbedding(resource.id, {
      name,
      description,
      category,
      tags: extra?.tags as string[] | undefined,
      capabilities: extra?.capabilities as string[] | undefined,
      extra,
    }).catch((err) => console.error("Background embedding error:", err));

    console.log(
      `[Resource] ${isUpdate ? "Updated" : "Created"} resource:`,
      `id=${resource.id}, slug=${resource.slug}, server_id=${resource.server_id}`,
    );

    res
      .status(isUpdate ? 200 : 201)
      .json({ resource, server, updated: isUpdate });
  } catch (error) {
    console.error("Resource register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resources/check-slug - Check if a slug is available for the user's hosted server
resourcesProtectedRouter.get("/check-slug", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { slug, network = "base" } = req.query;

    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "Missing slug parameter" });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return res.json({
        available: false,
        reason:
          "Invalid format. Use lowercase letters, numbers, and hyphens only.",
      });
    }

    // Get user's username for the normalized URL
    const { data: user, error: userError } = await getSupabase()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (userError || !user?.username) {
      return res.status(400).json({ error: "Username not found" });
    }

    // Check if normalized_url + network already exists (the actual unique constraint)
    const normalizedUrl = `${config.publicUrl.replace(/^https?:\/\//, "")}/@${user.username}/${slug}`;
    const networkNormalized = network === "solana" ? "solana" : "base";

    const { data: existingByUrl } = await getSupabase()
      .from("x402_resources")
      .select("id")
      .eq("normalized_url", normalizedUrl)
      .eq("network", networkNormalized)
      .maybeSingle();

    if (existingByUrl) {
      return res.json({
        available: false,
        reason: "This slug is already taken",
      });
    }

    // Also check jobs table for slug collision
    const { data: existingJob } = await getSupabase()
      .from("x402_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .maybeSingle();

    if (existingJob) {
      return res.json({
        available: false,
        reason: "This slug is used by one of your jobs",
      });
    }

    res.json({ available: true });
  } catch (error) {
    console.error("Check slug error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/resources/instant - Create an instant resource (proxy, prompt, or static)
resourcesProtectedRouter.post("/instant", async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      // Common fields
      resourceType,
      name,
      description,
      priceUsdc,
      network = "base",
      category,
      avatarUrl,
      slug: customSlug, // Optional custom slug from user
      // Proxy fields
      proxyOriginUrl,
      proxyMethod,
      proxyAuthHeader,
      proxyTimeoutMs,
      proxyRateLimit,
      proxyRateLimitWindow,
      // Prompt fields (legacy - server holds API key)
      promptProvider,
      promptApiKey,
      promptModel,
      promptSystemPrompt,
      promptParameters,
      promptOutputFormat,
      promptOutputTransform,
      promptRetryOnInvalid,
      // Static fields
      staticContent,
      staticContentType,
      // Prompt template fields (Claude prompts - caller provides API key)
      systemPrompt,
      parameters,
      maxTokens,
      allowsUserMessage,
    } = req.body;

    // Validate required fields
    if (!resourceType || !name || !priceUsdc) {
      return res.status(400).json({
        error: "Missing required fields: resourceType, name, priceUsdc",
      });
    }

    // Validate resource type
    const validTypes = [
      "proxy",
      "prompt",
      "static",
      "prompt_template",
      "openrouter_instant",
    ];
    if (!validTypes.includes(resourceType)) {
      return res.status(400).json({
        error: `Invalid resourceType. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Validate type-specific fields
    if (resourceType === "proxy" && !proxyOriginUrl) {
      return res.status(400).json({
        error: "Proxy resources require proxyOriginUrl",
      });
    }

    if (resourceType === "prompt") {
      if (!promptApiKey) {
        return res.status(400).json({
          error: "Prompt resources require promptApiKey",
        });
      }
      if (!promptSystemPrompt) {
        return res.status(400).json({
          error: "Prompt resources require promptSystemPrompt",
        });
      }
    }

    if (resourceType === "static" && !staticContent) {
      return res.status(400).json({
        error: "Static resources require staticContent",
      });
    }

    if (resourceType === "prompt_template" && !systemPrompt) {
      return res.status(400).json({
        error: "Prompt template resources require systemPrompt",
      });
    }

    if (resourceType === "openrouter_instant") {
      if (!req.body.modelId) {
        return res.status(400).json({
          error: "OpenRouter resources require modelId",
        });
      }
      if (!systemPrompt) {
        return res.status(400).json({
          error: "OpenRouter resources require systemPrompt",
        });
      }
      // Check user has OpenRouter API key configured
      const { hasApiKey } = await hasCreatorOpenRouterApiKey(userId);
      if (!hasApiKey) {
        return res.status(400).json({
          error:
            "OpenRouter API key required. Configure in Settings > Integrations.",
        });
      }
    }

    // Check encryption is configured for sensitive fields
    if ((promptApiKey || proxyAuthHeader) && !isEncryptionConfigured()) {
      return res.status(503).json({
        error: "Encryption not configured. Cannot store sensitive fields.",
      });
    }

    // Get user's username for the hosted server
    const { data: user, error: userError } = await getSupabase()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (userError || !user?.username) {
      return res.status(400).json({
        error: "Username not found. Please set your username first.",
      });
    }

    // Get or create the user's hosted server
    const hostedServer = await getOrCreateHostedServer(userId, user.username);
    if (!hostedServer) {
      return res.status(500).json({
        error: "Failed to create hosted server",
      });
    }

    // Use custom slug if provided, otherwise generate from name
    let slug: string;
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const networkNormalized = network === "solana" ? "solana" : "base";

    if (customSlug && typeof customSlug === "string") {
      // Validate custom slug format
      if (!slugRegex.test(customSlug)) {
        return res.status(400).json({
          error:
            "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
        });
      }
      slug = customSlug;

      // Check the actual unique constraint (normalized_url + network)
      const normalizedUrl = `${config.publicUrl.replace(/^https?:\/\//, "")}/@${user.username}/${slug}`;
      const { data: existingByUrl } = await getSupabase()
        .from("x402_resources")
        .select("id")
        .eq("normalized_url", normalizedUrl)
        .eq("network", networkNormalized)
        .maybeSingle();

      if (existingByUrl) {
        return res.status(409).json({
          error: "This slug is already taken. Please choose a different one.",
          code: "SLUG_TAKEN",
        });
      }

      // Also check jobs table
      const { data: existingJob } = await getSupabase()
        .from("x402_jobs")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", slug)
        .maybeSingle();

      if (existingJob) {
        return res.status(409).json({
          error:
            "This slug is used by one of your jobs. Please choose a different one.",
          code: "SLUG_TAKEN",
        });
      }
    } else {
      // Auto-generate unique slug from name
      const baseSlug = generateSlug(name);
      slug = baseSlug;
      let suffix = 1;
      const maxAttempts = 100;

      while (suffix <= maxAttempts) {
        // Check the actual unique constraint (normalized_url + network)
        const normalizedUrl = `${config.publicUrl.replace(/^https?:\/\//, "")}/@${user.username}/${slug}`;
        const [existingResource, existingJob] = await Promise.all([
          getSupabase()
            .from("x402_resources")
            .select("id")
            .eq("normalized_url", normalizedUrl)
            .eq("network", networkNormalized)
            .maybeSingle(),
          getSupabase()
            .from("x402_jobs")
            .select("id")
            .eq("user_id", userId)
            .eq("slug", slug)
            .maybeSingle(),
        ]);

        if (!existingResource.data && !existingJob.data) {
          break; // Slug is unique
        }
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }

      if (suffix > maxAttempts) {
        return res.status(409).json({
          error:
            "Unable to generate unique slug. Please provide a custom slug.",
          code: "SLUG_GENERATION_FAILED",
        });
      }
    }

    // Build resource URL
    const resourceUrl = `${config.publicUrl}/@${user.username}/${slug}`;

    // Get user's wallet for payTo
    const { data: wallet } = await getSupabase()
      .from("x402_user_wallets")
      .select("address, base_address")
      .eq("user_id", userId)
      .maybeSingle();

    const payTo =
      network === "base"
        ? wallet?.base_address || wallet?.address
        : wallet?.address;

    if (!payTo) {
      return res.status(400).json({
        error: "No wallet configured. Please set up your wallet first.",
      });
    }

    // Build insert data
    const insertData: Record<string, unknown> = {
      registered_by: userId,
      resource_url: resourceUrl,
      normalized_url: resourceUrl.replace(/^https?:\/\//, ""),
      network: network === "base" ? "base" : "solana",
      name,
      slug,
      description: description || null,
      pay_to: payTo,
      price_usdc: priceUsdc,
      max_amount_required: Math.floor(priceUsdc * 1_000_000).toString(),
      asset:
        network === "base"
          ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
          : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      category: category || "API",
      avatar_url: avatarUrl || null,
      mime_type: "application/json",
      max_timeout_seconds: 300,
      server_id: hostedServer.id,
      is_verified: true, // User owns their hosted server
      verified_owner_id: userId,
      is_active: true,
      resource_type: resourceType,
      platform_fee_percent: 0.1, // 10% platform fee
    };

    // Add type-specific fields
    if (resourceType === "proxy") {
      insertData.proxy_origin_url = proxyOriginUrl;
      insertData.proxy_method = proxyMethod || "POST";
      insertData.proxy_timeout_ms = proxyTimeoutMs || 30000;
      insertData.proxy_rate_limit = proxyRateLimit || null;
      insertData.proxy_rate_limit_window = proxyRateLimitWindow || null;

      if (proxyAuthHeader) {
        insertData.proxy_auth_header_encrypted = encryptSecret(proxyAuthHeader);
      }
    }

    if (resourceType === "prompt") {
      insertData.prompt_provider = promptProvider || "anthropic";
      insertData.prompt_model = promptModel || "claude-3-haiku-20240307";
      insertData.prompt_system_prompt = promptSystemPrompt;
      insertData.prompt_parameters = promptParameters || null;
      insertData.prompt_output_format = promptOutputFormat || "raw";
      insertData.prompt_output_transform = promptOutputTransform || null;
      insertData.prompt_retry_on_invalid = promptRetryOnInvalid || false;
      insertData.prompt_api_key_encrypted = encryptSecret(promptApiKey);
    }

    if (resourceType === "static") {
      insertData.static_content = staticContent;
      insertData.static_content_type = staticContentType || "application/json";
    }

    if (resourceType === "prompt_template") {
      insertData.pt_system_prompt = systemPrompt;
      insertData.pt_parameters = parameters || [];
      insertData.pt_model = "claude-sonnet-4-20250514"; // Hardcoded for v1
      insertData.pt_max_tokens = maxTokens || 4096;
      insertData.pt_allows_user_message = allowsUserMessage || false;
    }

    if (resourceType === "openrouter_instant") {
      insertData.openrouter_model_id = req.body.modelId;
      insertData.openrouter_config = {
        systemPrompt: systemPrompt,
        temperature: req.body.temperature ?? 1,
        maxTokens: req.body.maxTokens ?? 4096,
        topP: req.body.topP,
        frequencyPenalty: req.body.frequencyPenalty,
        presencePenalty: req.body.presencePenalty,
      };
      // Also store in pt_ fields for compatibility with prompt template execution
      insertData.pt_system_prompt = systemPrompt;
      insertData.pt_parameters = parameters || [];
      insertData.pt_max_tokens = req.body.maxTokens || 4096;
      insertData.pt_allows_user_message = allowsUserMessage || false;
    }

    // Create the resource
    const { data: resource, error: createError } = await getSupabase()
      .from("x402_resources")
      .insert(insertData)
      .select(
        `
        id, slug, name, description, resource_url, network, price_usdc, resource_type,
        avatar_url, category,
        proxy_origin_url, proxy_method, proxy_timeout_ms,
        prompt_provider, prompt_model, prompt_output_format,
        static_content_type, platform_fee_percent, is_active, created_at,
        server:x402_servers(id, slug, origin_url, name)
      `,
      )
      .single();

    if (createError) {
      console.error("Error creating instant resource:", createError);
      return res.status(500).json({ error: "Failed to create resource" });
    }

    console.log(
      `[Instant Resource] Created: ${resource.slug} (${resourceType}) by user ${userId}`,
    );

    // Generate embedding for discoverability
    generateResourceEmbedding(resource.id, {
      name,
      description,
      category,
    }).catch((err) => console.error("Background embedding error:", err));

    res.status(201).json({
      resource: {
        ...resource,
        url: resourceUrl,
        testUrl: `${resourceUrl}?network=${network}`,
      },
      server: hostedServer,
    });
  } catch (error: any) {
    console.error("Instant resource create error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resources/:id - Get a single resource for editing
resourcesProtectedRouter.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: resource, error } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id,
        slug,
        name,
        description,
        avatar_url,
        resource_url,
        network,
        price_usdc,
        resource_type,
        call_count,
        proxy_origin_url,
        proxy_method,
        proxy_timeout_ms,
        prompt_provider,
        prompt_model,
        prompt_system_prompt,
        prompt_parameters,
        prompt_output_format,
        static_content,
        static_content_type,
        registered_by,
        verified_owner_id,
        is_active,
        server:x402_servers(id, registered_by, is_hosted)
      `,
      )
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Check ownership
    const serverData = resource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      registered_by: string | null;
      is_hosted: boolean;
    } | null;

    const isResourceOwner =
      resource.verified_owner_id === userId ||
      resource.registered_by === userId;
    const isServerOwner = server?.registered_by === userId;

    if (!isResourceOwner && !isServerOwner && !isAdminUser(userId)) {
      return res
        .status(403)
        .json({ error: "You don't have permission to view this resource" });
    }

    // Get user's username for computing URL
    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    // Compute resource URL dynamically for hosted resources
    let resourceUrl = resource.resource_url;
    if (server?.is_hosted && profile?.username) {
      resourceUrl = `${config.publicUrl}/@${profile.username}/${resource.slug}`;
    }

    // Count jobs using this resource
    const { data: jobs } = await getSupabase()
      .from("x402_jobs")
      .select("id, workflow_definition")
      .eq("is_active", true);

    const jobsUsingResource = (jobs || []).filter((job: any) => {
      const nodes = job.workflow_definition?.nodes || [];
      return nodes.some((node: any) => {
        if (node.type !== "resource") return false;
        const nodeResource = node.data?.resource;
        if (!nodeResource) return false;
        return (
          nodeResource.id === resource.id ||
          nodeResource.slug === resource.slug ||
          nodeResource.resourceUrl === resource.resource_url
        );
      });
    });

    res.json({
      resource: {
        ...resource,
        resource_url: resourceUrl,
        // Don't return encrypted secrets
        proxy_auth_header_encrypted: undefined,
        prompt_api_key_encrypted: undefined,
      },
      usage: {
        callCount: resource.call_count || 0,
        jobCount: jobsUsingResource.length,
      },
    });
  } catch (error: any) {
    console.error("Get resource error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/resources/:id - Update an instant resource
resourcesProtectedRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const {
      name,
      description,
      priceUsdc,
      network,
      avatarUrl,
      // Proxy fields
      proxyOriginUrl,
      proxyMethod,
      proxyAuthHeader,
      proxyTimeoutMs,
      // Prompt fields
      promptApiKey,
      promptModel,
      promptSystemPrompt,
      promptParameters,
      promptOutputFormat,
      // Static fields
      staticContent,
      staticContentType,
    } = req.body;

    // Fetch existing resource
    const { data: resource, error: fetchError } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id,
        slug,
        resource_url,
        resource_type,
        registered_by,
        verified_owner_id,
        is_active,
        server:x402_servers(id, registered_by, is_hosted)
      `,
      )
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (fetchError || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Check ownership
    const serverData = resource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      registered_by: string | null;
      is_hosted: boolean;
    } | null;

    const isResourceOwner =
      resource.verified_owner_id === userId ||
      resource.registered_by === userId;
    const isServerOwner = server?.registered_by === userId;

    if (!isResourceOwner && !isServerOwner && !isAdminUser(userId)) {
      return res
        .status(403)
        .json({ error: "You don't have permission to edit this resource" });
    }

    // Only allow editing instant resources (not external)
    if (resource.resource_type === "external") {
      return res.status(400).json({ error: "Cannot edit external resources" });
    }

    // Check if any jobs are using this resource - if so, block edits
    const { data: jobs } = await getSupabase()
      .from("x402_jobs")
      .select("id, workflow_definition")
      .eq("is_active", true);

    const jobsUsingResource = (jobs || []).filter((job: any) => {
      const nodes = job.workflow_definition?.nodes || [];
      return nodes.some((node: any) => {
        if (node.type !== "resource") return false;
        const nodeResource = node.data?.resource;
        if (!nodeResource) return false;
        return (
          nodeResource.id === resource.id ||
          nodeResource.slug === resource.slug ||
          nodeResource.resourceUrl === resource.resource_url
        );
      });
    });

    if (jobsUsingResource.length > 0) {
      return res.status(400).json({
        error: "Cannot edit resource",
        message: `This resource is used in ${jobsUsingResource.length} job${jobsUsingResource.length > 1 ? "s" : ""}. Remove it from all jobs before editing.`,
      });
    }

    // Build update object based on resource type
    const updateData: Record<string, any> = {};

    // Common fields
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (priceUsdc !== undefined) {
      updateData.price_usdc = parseFloat(priceUsdc);
      updateData.max_amount_required = Math.floor(
        parseFloat(priceUsdc) * 1_000_000,
      ).toString();
    }

    // Network change - also update asset and pay_to
    if (network !== undefined && (network === "base" || network === "solana")) {
      updateData.network = network;
      updateData.asset =
        network === "base"
          ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base USDC
          : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Solana USDC

      // Get user's wallet for the new network
      const { data: wallet } = await getSupabase()
        .from("x402_user_wallets")
        .select("address, base_address")
        .eq("user_id", userId)
        .maybeSingle();

      if (wallet) {
        const payTo = network === "base" ? wallet.base_address : wallet.address;
        if (payTo) {
          updateData.pay_to = payTo;
        } else {
          return res.status(400).json({
            error: `No ${network} wallet configured. Please set up your ${network} wallet first.`,
          });
        }
      } else {
        return res.status(400).json({ error: "No wallet configured" });
      }
    }

    // Avatar URL
    if (avatarUrl !== undefined) {
      updateData.avatar_url = avatarUrl || null;
    }

    // Proxy fields
    if (resource.resource_type === "proxy") {
      if (proxyOriginUrl !== undefined)
        updateData.proxy_origin_url = proxyOriginUrl.trim();
      if (proxyMethod !== undefined) updateData.proxy_method = proxyMethod;
      if (proxyTimeoutMs !== undefined)
        updateData.proxy_timeout_ms = parseInt(proxyTimeoutMs) || 30000;
      if (proxyAuthHeader !== undefined && proxyAuthHeader.trim()) {
        if (!isEncryptionConfigured()) {
          return res.status(500).json({ error: "Encryption not configured" });
        }
        updateData.proxy_auth_header_encrypted = encryptSecret(
          proxyAuthHeader.trim(),
        );
      } else if (proxyAuthHeader === "") {
        updateData.proxy_auth_header_encrypted = null;
      }
    }

    // Prompt fields
    if (resource.resource_type === "prompt") {
      if (promptModel !== undefined) updateData.prompt_model = promptModel;
      if (promptSystemPrompt !== undefined)
        updateData.prompt_system_prompt = promptSystemPrompt.trim();
      if (promptParameters !== undefined)
        updateData.prompt_parameters = promptParameters;
      if (promptOutputFormat !== undefined)
        updateData.prompt_output_format = promptOutputFormat;
      if (promptApiKey !== undefined && promptApiKey.trim()) {
        if (!isEncryptionConfigured()) {
          return res.status(500).json({ error: "Encryption not configured" });
        }
        updateData.prompt_api_key_encrypted = encryptSecret(
          promptApiKey.trim(),
        );
      }
    }

    // Static fields
    if (resource.resource_type === "static") {
      if (staticContent !== undefined)
        updateData.static_content = staticContent;
      if (staticContentType !== undefined)
        updateData.static_content_type = staticContentType;
    }

    // Perform update
    const { error: updateError } = await getSupabase()
      .from("x402_resources")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Update resource error:", updateError);
      return res.status(500).json({ error: "Failed to update resource" });
    }

    res.json({ success: true, message: "Resource updated" });
  } catch (error: any) {
    console.error("Update resource error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/resources/:id - Update a resource's metadata (admin, owner, or server owner)
resourcesProtectedRouter.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, avatarUrl, category, parameters } = req.body;

    // First check if the resource exists and is active, including server ownership info
    const { data: resource, error: fetchError } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, registered_by, name, server_id, is_active, verified_owner_id, resource_type, pt_parameters,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (!resource.is_active) {
      return res.status(400).json({ error: "Resource is inactive" });
    }

    // Check ownership - resource owner, registrant, or server owner
    const serverData = resource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;

    const isResourceVerifiedOwner = resource.verified_owner_id === userId;
    const isResourceRegistrant = resource.registered_by === userId;
    const isServerVerifiedOwner = server?.verified_owner_id === userId;
    const isServerRegistrant = server?.registered_by === userId;

    const canEdit =
      isAdminUser(userId) ||
      isResourceVerifiedOwner ||
      isResourceRegistrant ||
      isServerVerifiedOwner ||
      isServerRegistrant;

    if (!canEdit) {
      return res.status(403).json({
        error:
          "Only admins, resource owners, or server owners can edit resources",
      });
    }

    // Validate parameters update (only for instant resources)
    if (parameters !== undefined) {
      const resourceType = (resource as Record<string, unknown>).resource_type;
      if (
        resourceType !== "prompt_template" &&
        resourceType !== "openrouter_instant"
      ) {
        return res.status(400).json({
          error: "Parameters can only be edited on instant resources",
        });
      }

      if (!Array.isArray(parameters)) {
        return res
          .status(400)
          .json({ error: "Parameters must be an array" });
      }

      const existingParams = (
        (resource as Record<string, unknown>).pt_parameters as Array<{
          name: string;
        }>
      ) || [];
      const existingNames = new Set(existingParams.map((p) => p.name));
      const newNames = new Set(parameters.map((p: { name: string }) => p.name));

      // Parameter names must match exactly — no add/remove/rename
      if (
        existingNames.size !== newNames.size ||
        ![...existingNames].every((n) => newNames.has(n))
      ) {
        return res.status(400).json({
          error:
            "Parameter names must match existing parameters exactly. You cannot add, remove, or rename parameters.",
        });
      }

      // Validate each parameter shape
      for (const param of parameters) {
        if (typeof param.name !== "string" || !param.name) {
          return res
            .status(400)
            .json({ error: "Each parameter must have a name string" });
        }
        if (
          param.description !== undefined &&
          typeof param.description !== "string"
        ) {
          return res
            .status(400)
            .json({ error: "Parameter description must be a string" });
        }
        if (
          param.required !== undefined &&
          typeof param.required !== "boolean"
        ) {
          return res
            .status(400)
            .json({ error: "Parameter required must be a boolean" });
        }
        if (param.default !== undefined && typeof param.default !== "string") {
          return res
            .status(400)
            .json({ error: "Parameter default must be a string" });
        }
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (category !== undefined) updateData.category = category;
    if (parameters !== undefined) updateData.pt_parameters = parameters;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Update the resource
    const { data: updatedResource, error: updateError } = await getSupabase()
      .from("x402_resources")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating resource:", updateError);
      return res.status(500).json({ error: "Failed to update resource" });
    }

    res.json({ resource: updatedResource });
  } catch (error) {
    console.error("Resource update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/resources/:id/restore - Restore an archived resource
resourcesProtectedRouter.post("/:id/restore", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // First check if the resource exists and is archived
    const { data: resource, error: fetchError } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, registered_by, name, server_id, is_active, verified_owner_id, normalized_url, network,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (resource.is_active) {
      return res.status(400).json({ error: "Resource is not archived" });
    }

    // Check ownership
    const serverData = resource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;

    const isResourceVerifiedOwner = resource.verified_owner_id === userId;
    const isResourceRegistrant = resource.registered_by === userId;
    const isServerVerifiedOwner = server?.verified_owner_id === userId;
    const isServerRegistrant = server?.registered_by === userId;

    const canRestore =
      isAdminUser(userId) ||
      isResourceVerifiedOwner ||
      isResourceRegistrant ||
      isServerVerifiedOwner ||
      isServerRegistrant;

    if (!canRestore) {
      return res.status(403).json({
        error:
          "Only admins, resource owners, or server owners can restore resources",
      });
    }

    // Extract original URL from archived format: "archived:{timestamp}:{original_url}"
    let originalUrl = resource.normalized_url;
    if (originalUrl.startsWith("archived:")) {
      // Format: archived:{timestamp}:{original_url}
      const parts = originalUrl.split(":");
      // Rejoin everything after the second colon (in case URL has colons)
      originalUrl = parts.slice(2).join(":");
    }

    // Check if the original URL is still available
    const { data: existingResource } = await getSupabase()
      .from("x402_resources")
      .select("id")
      .eq("normalized_url", originalUrl)
      .eq("network", resource.network)
      .neq("id", id)
      .maybeSingle();

    if (existingResource) {
      return res.status(409).json({
        error:
          "Cannot restore: the URL slug has been reused by another resource",
        code: "SLUG_REUSED",
      });
    }

    // Restore by setting is_active = true and restoring original URL
    const { error: restoreError } = await getSupabase()
      .from("x402_resources")
      .update({
        is_active: true,
        normalized_url: originalUrl,
      })
      .eq("id", id);

    if (restoreError) {
      console.error("Error restoring resource:", restoreError);
      return res.status(500).json({ error: "Failed to restore resource" });
    }

    // Increment resource_count on the server
    if (resource.server_id) {
      await getSupabase().rpc("increment_server_resource_count", {
        server_id_param: resource.server_id,
      });
    }

    res.json({ success: true, message: "Resource restored" });
  } catch (error) {
    console.error("Resource restore error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/resources/:id - Archive a resource (admin, owner, or server owner)
// This releases the slug so it can be reused
resourcesProtectedRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // First check if the resource exists and is active, including server ownership info
    const { data: resource, error: fetchError } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id, registered_by, name, server_id, is_active, verified_owner_id, normalized_url,
        server:x402_servers(id, verified_owner_id, registered_by)
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Check if already deleted
    if (!resource.is_active) {
      return res.status(400).json({ error: "Resource already deleted" });
    }

    // Check ownership - resource owner, registrant, or server owner
    const serverData = resource.server as unknown;
    const server = (Array.isArray(serverData) ? serverData[0] : serverData) as {
      id: string;
      verified_owner_id: string | null;
      registered_by: string | null;
    } | null;

    const isResourceVerifiedOwner = resource.verified_owner_id === userId;
    const isResourceRegistrant = resource.registered_by === userId;
    const isServerVerifiedOwner = server?.verified_owner_id === userId;
    const isServerRegistrant = server?.registered_by === userId;

    const canDelete =
      isAdminUser(userId) ||
      isResourceVerifiedOwner ||
      isResourceRegistrant ||
      isServerVerifiedOwner ||
      isServerRegistrant;

    if (!canDelete) {
      return res.status(403).json({
        error:
          "Only admins, resource owners, or server owners can delete resources",
      });
    }

    // Soft delete by setting is_active = false
    // Also release the slug by prefixing normalized_url with archived:{timestamp}:
    // This allows the user to reuse the slug for a new resource
    const archivedUrl = `archived:${Date.now()}:${resource.normalized_url}`;
    const { error: deleteError } = await getSupabase()
      .from("x402_resources")
      .update({
        is_active: false,
        normalized_url: archivedUrl,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Error archiving resource:", deleteError);
      return res.status(500).json({ error: "Failed to archive resource" });
    }

    // Decrement resource_count on the server
    if (resource.server_id) {
      await getSupabase().rpc("decrement_server_resource_count", {
        server_id_param: resource.server_id,
      });
    }

    const deletedBy = isAdminUser(userId)
      ? "admin"
      : isResourceVerifiedOwner
        ? "resource verified owner"
        : isResourceRegistrant
          ? "resource registrant"
          : isServerVerifiedOwner
            ? "server verified owner"
            : "server registrant";
    console.log(
      `[Delete] Resource ${id} (${resource.name}) deleted by ${deletedBy} ${userId}`,
    );
    res.json({ success: true, message: "Resource deleted" });
  } catch (error) {
    console.error("Resource delete error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/resources/:id/slug - Update resource slug (admin, verified owner, or server owner)
resourcesProtectedRouter.patch(
  "/:id/slug",
  requireResourceOwnership(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { slug } = req.body;

      if (!slug || typeof slug !== "string") {
        return res.status(400).json({ error: "Slug is required" });
      }

      // Validate slug format (lowercase, alphanumeric, hyphens only)
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        return res.status(400).json({
          error:
            "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
        });
      }

      const supabase = getSupabase();

      // Check if slug is already taken within the same server
      const { data: existing } = await supabase
        .from("x402_resources")
        .select("id")
        .eq("server_id", req.resource!.server_id)
        .eq("slug", slug)
        .eq("is_active", true)
        .neq("id", id)
        .single();

      if (existing) {
        return res
          .status(409)
          .json({ error: "Slug is already taken on this server" });
      }

      // Update the slug
      const { data: updated, error: updateError } = await supabase
        .from("x402_resources")
        .update({ slug })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating resource slug:", updateError);
        return res.status(500).json({ error: "Failed to update slug" });
      }

      res.json({ resource: updated });
    } catch (error) {
      console.error("Resource slug update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/resources/:id - Update resource details (name, description)
resourcesProtectedRouter.patch(
  "/:id",
  requireResourceOwnership(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, imageUrl } = req.body;

      const updates: Record<string, string> = {};

      // Validate and add name if provided
      if (name !== undefined) {
        if (typeof name !== "string" || name.length === 0) {
          return res.status(400).json({ error: "Name cannot be empty" });
        }
        if (name.length > 200) {
          return res
            .status(400)
            .json({ error: "Name must be 200 characters or less" });
        }
        updates.name = name;
      }

      // Validate and add description if provided
      if (description !== undefined) {
        if (typeof description !== "string") {
          return res
            .status(400)
            .json({ error: "Description must be a string" });
        }
        if (description.length > 1000) {
          return res
            .status(400)
            .json({ error: "Description must be 1000 characters or less" });
        }
        updates.description = description;
      }

      // Handle image URL if provided
      if (imageUrl !== undefined) {
        if (imageUrl && typeof imageUrl === "string") {
          try {
            new URL(imageUrl);
            // Cache the image
            const cachedUrl = await cacheImage(imageUrl, "avatar");
            updates.avatar_url = cachedUrl || imageUrl;
          } catch {
            return res.status(400).json({ error: "Invalid image URL format" });
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const supabase = getSupabase();
      const { data: updated, error: updateError } = await supabase
        .from("x402_resources")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating resource:", updateError);
        return res.status(500).json({ error: "Failed to update resource" });
      }

      console.log(
        `[Resource] Updated details for ${id} by user ${req.user!.id}:`,
        Object.keys(updates),
      );
      res.json({ resource: updated });
    } catch (error) {
      console.error("Resource update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/resources/:id/image - Update resource image (admin, verified owner, or server owner)
resourcesProtectedRouter.patch(
  "/:id/image",
  requireResourceOwnership(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Cache the image
      const cachedUrl = await cacheImage(imageUrl, "avatar");
      const finalUrl = cachedUrl || imageUrl;

      // Update the avatar_url
      const supabase = getSupabase();
      const { data: updated, error: updateError } = await supabase
        .from("x402_resources")
        .update({ avatar_url: finalUrl })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating resource image:", updateError);
        return res.status(500).json({ error: "Failed to update image" });
      }

      console.log(`[Resource] Updated image for ${id} by user ${req.user!.id}`);
      res.json({ resource: updated });
    } catch (error) {
      console.error("Resource image update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// OWNERSHIP VERIFICATION
// ============================================================================

// Generate a deterministic verification code from resource ID
// Same resource always gets the same code (but unpredictable without the secret)
function generateVerificationCode(resourceId: string): string {
  const secret = process.env.VERIFICATION_SECRET || "x402-verify-secret-key";
  const hash = crypto
    .createHmac("sha256", secret)
    .update(resourceId)
    .digest("hex");
  // Take first 12 chars of the hash
  return hash.substring(0, 12);
}

// POST /api/resources/:id/claim/start - Start ownership verification
resourcesProtectedRouter.post("/:id/claim/start", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const supabase = getSupabase();

    // Get the resource
    const { data: resource, error: fetchError } = await supabase
      .from("x402_resources")
      .select("id, name, resource_url, verified_owner_id")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (fetchError || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Check if already verified by someone else
    if (resource.verified_owner_id && resource.verified_owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "This resource is already claimed by another user" });
    }

    // Generate deterministic verification code (same resource = same code)
    const verificationCode = generateVerificationCode(id);

    res.json({
      verificationCode,
      instructions: `Add this to your x402 endpoint's extra field: "x402Verification": "${verificationCode}"`,
    });
  } catch (error) {
    console.error("Claim start error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/resources/:id/claim/verify - Complete ownership verification
resourcesProtectedRouter.post("/:id/claim/verify", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const supabase = getSupabase();

    // Get the resource
    const { data: resource, error: fetchError } = await supabase
      .from("x402_resources")
      .select("id, name, resource_url, verified_owner_id")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (fetchError || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Check if already verified by someone else
    if (resource.verified_owner_id && resource.verified_owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "This resource is already claimed by another user" });
    }

    // Generate the expected verification code (deterministic)
    const expectedCode = generateVerificationCode(id);

    // Call the endpoint and check for the verification code
    try {
      const response = await fetch(resource.resource_url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      // x402 endpoints return 402 with the pricing info
      if (response.status !== 402) {
        return res.status(400).json({
          error: `Endpoint returned ${response.status}, expected 402`,
        });
      }

      const data = await response.json();

      // Check for verification code in extra field
      const endpointCode =
        data.extra?.x402Verification || data.x402Verification;

      if (endpointCode !== expectedCode) {
        return res.status(400).json({
          error: `Verification code not found or doesn't match. Expected "${expectedCode}" in extra.x402Verification`,
          found: endpointCode || null,
        });
      }

      // Verification successful! Mark as verified
      const { error: verifyError } = await supabase
        .from("x402_resources")
        .update({
          verified_owner_id: userId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (verifyError) {
        console.error("Error completing verification:", verifyError);
        return res
          .status(500)
          .json({ error: "Failed to complete verification" });
      }

      console.log(
        `[Claim] Resource ${id} (${resource.name}) verified by user ${userId}`,
      );

      res.json({
        success: true,
        message: "Ownership verified! You can now edit this resource.",
      });
    } catch (fetchError) {
      console.error("Error fetching endpoint for verification:", fetchError);
      return res.status(400).json({
        error: "Failed to reach your endpoint. Make sure it's accessible.",
      });
    }
  } catch (error) {
    console.error("Claim verify error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resources/:id/claim/status - Check claim status
resourcesVerifyRouter.get("/:id/claim/status", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: resource, error } = await getSupabase()
      .from("x402_resources")
      .select("id, verified_owner_id, verified_at")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error || !resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json({
      isClaimed: !!resource.verified_owner_id,
      verifiedAt: resource.verified_at,
    });
  } catch (error) {
    console.error("Claim status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
