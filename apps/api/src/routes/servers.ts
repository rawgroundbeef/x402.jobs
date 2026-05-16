import { Router } from "express";
import type { Router as RouterType } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { config, isAdminUser } from "../config";
import { getSupabase } from "../lib/supabase";
import { requireServerOwnership } from "../middleware/ownership";

// Public router (no auth required)
export const serversRouter: RouterType = Router();

// Protected router (auth required)
export const serversProtectedRouter: RouterType = Router();

const BUCKET_NAME = "x402-cached-images";

// Helper to cache a favicon
async function cacheFavicon(url: string): Promise<string | null> {
  if (!url) return null;

  const supabase = getSupabase();

  // Check if already cached
  const { data: existing } = await supabase
    .from("x402_cached_images")
    .select("cached_url")
    .eq("original_url", url)
    .maybeSingle();

  if (existing?.cached_url) {
    console.log(`[Favicon] Using cached: ${existing.cached_url}`);
    return existing.cached_url;
  }

  try {
    console.log(`[Favicon] Fetching: ${url}`);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; X402Bot/1.0)" },
    });

    if (!response.ok) {
      console.log(`[Favicon] Fetch failed: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    console.log(`[Favicon] Content-Type: ${contentType}`);

    // Check if it's actually an image (not HTML/text)
    if (!contentType.startsWith("image/")) {
      console.log(`[Favicon] Not an image, skipping: ${contentType}`);
      return null;
    }
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
    const ext = extMap[contentType] || "ico";

    const urlHash = crypto
      .createHash("sha256")
      .update(url)
      .digest("hex")
      .substring(0, 16);
    const filename = `favicons/${urlHash}.${ext}`;
    console.log(`[Favicon] Uploading to: ${filename}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[Favicon] Buffer size: ${buffer.length} bytes`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error("[Favicon] Upload error:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    const cachedUrl = publicUrlData.publicUrl;
    console.log(`[Favicon] Cached to: ${cachedUrl}`);

    await supabase.from("x402_cached_images").upsert(
      {
        original_url: url,
        cached_url: cachedUrl,
        type: "favicon",
        filename,
      },
      { onConflict: "original_url" },
    );

    return cachedUrl;
  } catch (error) {
    console.error("[Favicon] Cache error:", error);
    return null;
  }
}

// Helper to try fetching favicon from common locations
async function tryFetchFavicon(originUrl: string): Promise<string | null> {
  const faviconPaths = [
    "/favicon.ico",
    "/favicon.png",
    "/apple-touch-icon.png",
  ];

  for (const path of faviconPaths) {
    const fullFaviconUrl = `${originUrl}${path}`;
    try {
      const response = await fetch(fullFaviconUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      const contentType = response.headers.get("content-type") || "";
      console.log(
        `[Server] ${fullFaviconUrl}: ${response.status} (${contentType})`,
      );
      // Only proceed if it's an image
      if (response.ok && contentType.startsWith("image/")) {
        const cachedUrl = await cacheFavicon(fullFaviconUrl);
        if (cachedUrl) {
          return cachedUrl;
        }
      }
    } catch {
      // Continue to next path
    }
  }
  return null;
}

// GET /api/servers - List all servers (only those with active resources)
// Supports: search, sort (popular|latest|resources), limit, offset
serversRouter.get("/", async (req, res) => {
  try {
    const { search, sort = "popular", limit = "25", offset = "0" } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // Determine sort order
    let orderColumn = "total_calls";
    let orderAscending = false;
    switch (sort) {
      case "latest":
        orderColumn = "created_at";
        orderAscending = false;
        break;
      case "resources":
        orderColumn = "resource_count";
        orderAscending = false;
        break;
      case "popular":
      default:
        orderColumn = "total_calls";
        orderAscending = false;
    }

    const { data: servers, error } = await getSupabase()
      .from("x402_servers")
      .select(
        "id, slug, origin_url, name, favicon_url, description, resource_count, total_calls, total_earned_usdc, created_at",
      )
      .gt("resource_count", 0) // Only show servers with active resources
      .order(orderColumn, { ascending: orderAscending });

    if (error) {
      console.error("Error fetching servers:", error);
      return res.status(500).json({ error: "Failed to fetch servers" });
    }

    // Filter by search if provided
    let filtered = servers || [];
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name?.toLowerCase().includes(searchLower) ||
          s.slug?.toLowerCase().includes(searchLower) ||
          s.description?.toLowerCase().includes(searchLower) ||
          s.origin_url?.toLowerCase().includes(searchLower),
      );
    }

    // Total count before pagination
    const totalCount = filtered.length;

    // Apply pagination
    const paginatedServers = filtered.slice(offsetNum, offsetNum + limitNum);

    res.json({
      servers: paginatedServers,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Servers fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to check if string is a UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str,
  );
}

// Generate a URL-safe slug from text
function generateSlug(inputText: string): string {
  return inputText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

// Generate a unique slug, adding suffix if needed
async function getUniqueServerSlug(
  supabase: SupabaseClient,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data: existing } = await supabase
      .from("x402_servers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) return slug;

    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}

// GET /api/servers/:idOrSlug - Get single server with its resources
// Supports: search, sort (latest|popular|price_low|price_high), network, limit, offset
serversRouter.get("/:idOrSlug", async (req, res) => {
  try {
    const idOrSlug = req.params.idOrSlug;
    const {
      search,
      sort = "latest",
      network,
      limit = "25",
      offset = "0",
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // Get server by ID or slug
    let query = getSupabase().from("x402_servers").select("*");

    if (isUUID(idOrSlug)) {
      query = query.eq("id", idOrSlug);
    } else {
      query = query.eq("slug", idOrSlug);
    }

    const { data: server, error: serverError } = await query.single();

    if (serverError || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Get owner profile if server has a verified owner
    if (server.verified_owner_id) {
      const { data: ownerProfile } = await getSupabase()
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", server.verified_owner_id)
        .is("deleted_at", null)
        .single();

      if (ownerProfile) {
        (server as any).owner_username = ownerProfile.username;
        (server as any).owner_display_name = ownerProfile.display_name;
        (server as any).owner_avatar_url = ownerProfile.avatar_url;
      }
    } else if (server.is_hosted && server.slug?.startsWith("@")) {
      // For hosted servers (@{username}), extract username from slug
      const username = server.slug.slice(1);
      const { data: ownerProfile } = await getSupabase()
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("username", username)
        .is("deleted_at", null)
        .single();

      if (ownerProfile) {
        (server as any).owner_username = ownerProfile.username;
        (server as any).owner_display_name = ownerProfile.display_name;
        (server as any).owner_avatar_url = ownerProfile.avatar_url;
        // Use user's avatar as server favicon
        if (!server.favicon_url) {
          (server as any).favicon_url = ownerProfile.avatar_url;
        }
      }
    }

    // Determine sort order for resources
    let orderColumn = "created_at";
    let orderAscending = false;
    switch (sort) {
      case "popular":
        orderColumn = "call_count";
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

    // Get resources for this server
    let resourceQuery = getSupabase()
      .from("x402_resources")
      .select(
        "id, slug, name, description, resource_url, network, max_amount_required, avatar_url, output_schema, extra, is_verified, created_at, registered_by, call_count",
      )
      .eq("server_id", server.id)
      .eq("is_active", true)
      .or("health_status.is.null,health_status.neq.offline") // Exclude offline resources
      .order(orderColumn, { ascending: orderAscending });

    // Apply search filter in SQL for efficiency
    if (search && typeof search === "string") {
      const searchPattern = `%${search}%`;
      resourceQuery = resourceQuery.or(
        `name.ilike.${searchPattern},slug.ilike.${searchPattern},resource_url.ilike.${searchPattern},description.ilike.${searchPattern}`,
      );
    }

    // Apply network filter
    if (network && typeof network === "string") {
      resourceQuery = resourceQuery.eq("network", network.toLowerCase());
    }

    const { data: resources, error: resourcesError } = await resourceQuery;

    if (resourcesError) {
      console.error("Error fetching server resources:", resourcesError);
    }

    // Deduplicate resources by (resource_url, network) tuple (keep most recent)
    // This allows the same URL to appear for different chains (e.g., Base and Solana)
    const seen = new Set<string>();
    const dedupedResources = (resources || []).filter((r) => {
      const key = `${r.resource_url}:${r.network}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Total count after deduping
    const totalCount = dedupedResources.length;

    // Apply pagination
    const paginatedResources = dedupedResources.slice(
      offsetNum,
      offsetNum + limitNum,
    );

    // Return actual resource count (not the potentially stale stored value)
    res.json({
      server: {
        ...server,
        resource_count: totalCount,
      },
      resources: paginatedResources,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Server fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper: Get or create server from URL
export async function getOrCreateServer(
  url: string,
  userId: string,
): Promise<{
  id: string;
  origin_url: string;
  name: string;
  slug?: string;
} | null> {
  try {
    const urlObj = new URL(url);
    // Normalize to lowercase since domain names are case-insensitive
    const originUrl = urlObj.origin.toLowerCase(); // e.g., "https://api.memeputer.com"
    const hostname = urlObj.hostname.toLowerCase(); // e.g., "api.memeputer.com"

    const supabase = getSupabase();

    // Check if server exists (case-insensitive since domains are case-insensitive)
    const { data: existing } = await supabase
      .from("x402_servers")
      .select("id, origin_url, name, slug, favicon_url")
      .ilike("origin_url", originUrl)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {};

      // Normalize origin_url to lowercase if it's not already
      if (existing.origin_url !== originUrl) {
        updates.origin_url = originUrl;
      }

      // If server exists but has no slug, generate one
      if (!existing.slug) {
        const baseSlug = generateSlug(hostname.replace(/\./g, "-"));
        updates.slug = await getUniqueServerSlug(supabase, baseSlug);
      }

      // Refresh favicon if missing or if current URL is not a cached URL
      const isCachedUrl =
        existing.favicon_url?.includes("supabase.co/storage") ||
        existing.favicon_url?.includes("memeputer.com/storage");
      const needsFaviconRefresh = !existing.favicon_url || !isCachedUrl;
      if (needsFaviconRefresh) {
        console.log(
          `[Server] Refreshing favicon for ${originUrl} (current: ${existing.favicon_url || "none"})...`,
        );
        let cachedUrl = await tryFetchFavicon(originUrl);

        // If no favicon found, try to use an avatar from one of the server's resources
        if (!cachedUrl) {
          console.log(
            `[Server] No favicon found, checking resources for avatar...`,
          );
          const { data: resourceWithAvatar } = await supabase
            .from("x402_resources")
            .select("avatar_url")
            .eq("server_id", existing.id)
            .not("avatar_url", "is", null)
            .limit(1)
            .maybeSingle();

          if (resourceWithAvatar?.avatar_url) {
            console.log(
              `[Server] Using resource avatar as fallback: ${resourceWithAvatar.avatar_url}`,
            );
            cachedUrl = resourceWithAvatar.avatar_url;
          }
        }

        if (cachedUrl) {
          console.log(`[Server] Updated favicon: ${cachedUrl}`);
          updates.favicon_url = cachedUrl;
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("x402_servers")
          .update(updates)
          .eq("id", existing.id);

        // Merge updates into existing
        Object.assign(existing, updates);
      }

      return existing;
    }

    // Try to get and cache favicon
    const faviconUrl = await tryFetchFavicon(originUrl);

    // Generate a unique slug from hostname
    const baseSlug = generateSlug(hostname.replace(/\./g, "-"));
    const slug = await getUniqueServerSlug(supabase, baseSlug);

    // Create new server
    const { data: newServer, error } = await supabase
      .from("x402_servers")
      .insert({
        origin_url: originUrl,
        name: hostname,
        slug,
        favicon_url: faviconUrl,
        registered_by: userId,
      })
      .select("id, origin_url, name, slug")
      .single();

    if (error) {
      console.error("Error creating server:", error);
      return null;
    }

    return newServer;
  } catch (error) {
    console.error("getOrCreateServer error:", error);
    return null;
  }
}

/**
 * Get or create a user's personal hosted server for instant resources.
 * Each user gets one hosted server at https://x402.jobs/p/[username]
 */
export async function getOrCreateHostedServer(
  userId: string,
  username: string,
): Promise<{
  id: string;
  origin_url: string;
  name: string;
  slug: string;
  is_hosted: boolean;
} | null> {
  try {
    const supabase = getSupabase();
    const originUrl = `https://x402.jobs/p/${username}`;

    // Get user's avatar for the server favicon
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    // Check if hosted server already exists for this user
    const { data: existing } = await supabase
      .from("x402_servers")
      .select("id, origin_url, name, slug, is_hosted, favicon_url")
      .eq("registered_by", userId)
      .eq("is_hosted", true)
      .maybeSingle();

    if (existing) {
      // Update origin_url/slug if username changed, or favicon if missing
      const needsUpdate =
        existing.origin_url !== originUrl ||
        (!existing.favicon_url && profile?.avatar_url);

      if (needsUpdate) {
        await supabase
          .from("x402_servers")
          .update({
            origin_url: originUrl,
            slug: `@${username}`,
            ...(profile?.avatar_url && !existing.favicon_url
              ? { favicon_url: profile.avatar_url }
              : {}),
          })
          .eq("id", existing.id);

        existing.origin_url = originUrl;
        existing.slug = `@${username}`;
      }
      return existing;
    }

    // Create new hosted server with user's avatar as favicon
    const { data: newServer, error } = await supabase
      .from("x402_servers")
      .insert({
        origin_url: originUrl,
        name: `@${username}`,
        slug: `@${username}`,
        registered_by: userId,
        is_hosted: true,
        ...(profile?.avatar_url ? { favicon_url: profile.avatar_url } : {}),
      })
      .select("id, origin_url, name, slug, is_hosted")
      .single();

    if (error) {
      console.error("Error creating hosted server:", error);
      return null;
    }

    console.log(
      `[Server] Created hosted server for ${username}: ${newServer.id}`,
    );
    return newServer;
  } catch (error) {
    console.error("getOrCreateHostedServer error:", error);
    return null;
  }
}

// DELETE /api/servers/:id - Delete a server (admin only, soft-deletes all resources first)
serversProtectedRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Only admins can delete servers
    if (!isAdminUser(userId)) {
      return res.status(403).json({ error: "Only admins can delete servers" });
    }

    const supabase = getSupabase();

    // First check if the server exists
    const { data: server, error: fetchError } = await supabase
      .from("x402_servers")
      .select("id, name, origin_url")
      .eq("id", id)
      .single();

    if (fetchError || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Soft-delete all active resources for this server
    const { data: deactivatedResources, error: deactivateError } =
      await supabase
        .from("x402_resources")
        .update({ is_active: false })
        .eq("server_id", id)
        .eq("is_active", true)
        .select("id");

    if (deactivateError) {
      console.error("Error deactivating resources:", deactivateError);
      return res
        .status(500)
        .json({ error: "Failed to deactivate server resources" });
    }

    const resourceCount = deactivatedResources?.length || 0;
    console.log(
      `[Delete] Deactivated ${resourceCount} resources for server ${id}`,
    );

    // Now delete the server
    const { error: deleteError } = await supabase
      .from("x402_servers")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting server:", deleteError);
      return res.status(500).json({ error: "Failed to delete server" });
    }

    console.log(
      `[Delete] Server ${id} (${server.name}) deleted by admin ${userId}`,
    );
    res.json({
      success: true,
      message: `Server "${server.name}" deleted`,
      resourcesDeactivated: resourceCount,
    });
  } catch (error) {
    console.error("Server delete error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/servers/:id/slug - Update server slug (admin or owner)
serversProtectedRouter.patch(
  "/:id/slug",
  requireServerOwnership(),
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

      // Check if slug is already taken
      const { data: existing } = await supabase
        .from("x402_servers")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .single();

      if (existing) {
        return res.status(409).json({ error: "Slug is already taken" });
      }

      // Update the slug
      const { data: updated, error: updateError } = await supabase
        .from("x402_servers")
        .update({ slug })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating server slug:", updateError);
        return res.status(500).json({ error: "Failed to update slug" });
      }

      res.json({ server: updated });
    } catch (error) {
      console.error("Server slug update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/servers/:id/image - Update server favicon (admin or owner)
serversProtectedRouter.patch(
  "/:id/image",
  requireServerOwnership(),
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

      // Cache the favicon image
      const cachedUrl = await cacheFavicon(imageUrl);
      const finalUrl = cachedUrl || imageUrl;

      // Update the favicon_url
      const supabase = getSupabase();
      const { data: updated, error: updateError } = await supabase
        .from("x402_servers")
        .update({ favicon_url: finalUrl })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating server image:", updateError);
        return res.status(500).json({ error: "Failed to update image" });
      }

      console.log(`[Server] Updated favicon for ${id} by user ${req.user!.id}`);
      res.json({ server: updated });
    } catch (error) {
      console.error("Server image update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/servers/:id - Update server details (admin or owner)
serversProtectedRouter.patch(
  "/:id",
  requireServerOwnership(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, slug, imageUrl } = req.body;

      const updates: Record<string, unknown> = {};

      // Validate and add name if provided
      if (name !== undefined) {
        if (typeof name !== "string" || name.length === 0) {
          return res.status(400).json({ error: "Name cannot be empty" });
        }
        if (name.length > 50) {
          return res
            .status(400)
            .json({ error: "Name must be 50 characters or less" });
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
        if (description.length > 500) {
          return res
            .status(400)
            .json({ error: "Description must be 500 characters or less" });
        }
        updates.description = description || null;
      }

      // Validate and add slug if provided
      if (slug !== undefined) {
        if (typeof slug !== "string" || slug.length === 0) {
          return res.status(400).json({ error: "Slug cannot be empty" });
        }
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
          return res.status(400).json({
            error:
              "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
          });
        }

        // Check if slug is already taken
        const supabase = getSupabase();
        const { data: existing } = await supabase
          .from("x402_servers")
          .select("id")
          .eq("slug", slug)
          .neq("id", id)
          .single();

        if (existing) {
          return res.status(409).json({ error: "Slug is already taken" });
        }
        updates.slug = slug;
      }

      // Handle image URL if provided (from image upload)
      if (imageUrl !== undefined) {
        updates.favicon_url = imageUrl;
      }

      // If no updates, return success
      if (Object.keys(updates).length === 0) {
        return res.json({ message: "No changes to save" });
      }

      // Update the server
      const supabase = getSupabase();
      const { data: updated, error: updateError } = await supabase
        .from("x402_servers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating server:", updateError);
        return res.status(500).json({ error: "Failed to update server" });
      }

      console.log(
        `[Server] Updated ${id} by user ${req.user!.id}:`,
        Object.keys(updates),
      );
      res.json({ server: updated });
    } catch (error) {
      console.error("Server update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/servers/:id/image/upload - Upload server image (multipart/form-data)
serversProtectedRouter.post(
  "/:id/image/upload",
  requireServerOwnership(),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check for file in request
      // Note: This requires multer or similar middleware to be set up
      // For now, we'll accept base64 encoded image or URL
      const { image, imageUrl } = req.body;

      if (!image && !imageUrl) {
        return res.status(400).json({ error: "No image provided" });
      }

      const supabase = getSupabase();
      let finalUrl: string;

      if (imageUrl) {
        // If URL provided, cache it
        const cached = await cacheFavicon(imageUrl);
        finalUrl = cached || imageUrl;
      } else if (image) {
        // Handle base64 image
        const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          return res.status(400).json({ error: "Invalid image format" });
        }

        const [, ext, base64Data] = matches;
        const buffer = Buffer.from(base64Data, "base64");

        // Check size (2MB limit)
        if (buffer.length > 2 * 1024 * 1024) {
          return res.status(400).json({ error: "Image must be less than 2MB" });
        }

        // Generate filename
        const filename = `servers/${id}-${Date.now()}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("x402-cached-images")
          .upload(filename, buffer, {
            contentType: `image/${ext}`,
            upsert: true,
          });

        if (uploadError) {
          console.error("Image upload error:", uploadError);
          return res.status(500).json({ error: "Failed to upload image" });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("x402-cached-images")
          .getPublicUrl(filename);

        finalUrl = publicUrlData.publicUrl;
      } else {
        return res.status(400).json({ error: "No valid image provided" });
      }

      // Update server with new favicon URL
      const { data: updated, error: updateError } = await supabase
        .from("x402_servers")
        .update({ favicon_url: finalUrl })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating server image:", updateError);
        return res.status(500).json({ error: "Failed to update server" });
      }

      console.log(`[Server] Uploaded image for ${id} by user ${req.user!.id}`);
      res.json({ imageUrl: finalUrl, server: updated });
    } catch (error) {
      console.error("Server image upload error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * Generate a deterministic verification code for a server
 * Same server = same code (makes it easier for users)
 */
function generateServerVerificationCode(serverId: string): string {
  const secret = config.supabase.serviceRoleKey || "fallback-secret";
  const hash = crypto
    .createHmac("sha256", secret)
    .update(`server-verify-${serverId}`)
    .digest("hex");
  return hash.substring(0, 12);
}

// POST /api/servers/:id/claim/start - Start server ownership verification
serversProtectedRouter.post("/:id/claim/start", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const supabase = getSupabase();

    // Get the server
    const { data: server, error: fetchError } = await supabase
      .from("x402_servers")
      .select("id, slug, origin_url, verified_owner_id")
      .eq("id", id)
      .single();

    if (fetchError || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Check if already verified by someone else
    if (server.verified_owner_id && server.verified_owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "This server is already claimed by another user" });
    }

    // Generate deterministic verification code
    const verificationCode = generateServerVerificationCode(id);

    // Build the well-known URL
    const originUrl = new URL(server.origin_url);
    const wellKnownUrl = `${originUrl.origin}/.well-known/x402-verification.json`;

    res.json({
      verificationCode,
      wellKnownUrl,
      instructions: `Create a file at ${wellKnownUrl} with content: { "x402": "${verificationCode}" }`,
    });
  } catch (error) {
    console.error("Server claim start error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/servers/:id/claim/verify - Complete server ownership verification
serversProtectedRouter.post("/:id/claim/verify", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const supabase = getSupabase();

    // Get the server
    const { data: server, error: fetchError } = await supabase
      .from("x402_servers")
      .select("id, slug, origin_url, verified_owner_id")
      .eq("id", id)
      .single();

    if (fetchError || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Check if already verified by someone else
    if (server.verified_owner_id && server.verified_owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "This server is already claimed by another user" });
    }

    // Generate the expected verification code
    const expectedCode = generateServerVerificationCode(id);

    // Build the well-known URL and fetch it
    const originUrl = new URL(server.origin_url);
    const wellKnownUrl = `${originUrl.origin}/.well-known/x402-verification.json`;

    try {
      const response = await fetch(wellKnownUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return res.status(400).json({
          error: `Could not fetch ${wellKnownUrl} - returned ${response.status}`,
          hint: "Make sure the file exists and is publicly accessible",
        });
      }

      const data = await response.json();

      // Check for verification code
      const foundCode = data.x402 || data.x402Verification;

      if (foundCode !== expectedCode) {
        return res.status(400).json({
          error: `Verification code doesn't match`,
          expected: expectedCode,
          found: foundCode || null,
          hint: `File should contain: { "x402": "${expectedCode}" }`,
        });
      }

      // Verification successful! Mark server as verified
      const { error: verifyError } = await supabase
        .from("x402_servers")
        .update({
          verified_owner_id: userId,
          verified_at: new Date().toISOString(),
          verification_code: null,
          verification_expires_at: null,
        })
        .eq("id", id);

      if (verifyError) {
        console.error("Error completing server verification:", verifyError);
        return res
          .status(500)
          .json({ error: "Failed to complete verification" });
      }

      // Also mark all resources under this server as owned by this user
      const { error: resourcesError } = await supabase
        .from("x402_resources")
        .update({
          verified_owner_id: userId,
          verified_at: new Date().toISOString(),
        })
        .eq("server_id", id);

      if (resourcesError) {
        console.error("Error updating resource ownership:", resourcesError);
        // Don't fail - server is still verified
      }

      console.log(
        `[Claim] Server ${id} (${server.slug}) verified by user ${userId}`,
      );

      res.json({
        success: true,
        message:
          "Server ownership verified! You now own this server and all its resources.",
      });
    } catch (fetchError) {
      console.error("Error fetching well-known file:", fetchError);
      return res.status(400).json({
        error: `Failed to fetch ${wellKnownUrl}`,
        hint: "Make sure the file exists and is publicly accessible",
      });
    }
  } catch (error) {
    console.error("Server claim verify error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/servers/:slug/claim/status - Check server claim status (public)
serversRouter.get("/:slug/claim/status", async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: server, error } = await getSupabase()
      .from("x402_servers")
      .select("id, verified_owner_id, verified_at")
      .eq("slug", slug)
      .single();

    if (error || !server) {
      return res.status(404).json({ error: "Server not found" });
    }

    res.json({
      isClaimed: !!server.verified_owner_id,
      verifiedAt: server.verified_at,
    });
  } catch (error) {
    console.error("Server claim status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
