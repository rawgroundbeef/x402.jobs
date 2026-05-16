/**
 * Bazaar Discovery API Aggregator
 *
 * Polls facilitator discovery APIs (CDP Bazaar, etc.) to index
 * x402-enabled servers and resources across the ecosystem.
 */

import { getSupabase } from "../lib/supabase";

// Known facilitator discovery endpoints
export const FACILITATOR_ENDPOINTS = [
  {
    slug: "cdp",
    name: "CDP (Coinbase)",
    discoveryUrl:
      "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources",
    supportedUrl: "https://api.cdp.coinbase.com/platform/v2/x402/supported",
  },
  // Add more facilitators as their discovery APIs are documented
  // { slug: 'dexter', name: 'Dexter', discoveryUrl: 'https://api.dexter.cash/discovery', ... },
  // { slug: 'payai', name: 'PayAI', discoveryUrl: 'https://...', ... },
];

// CDP Bazaar response types
interface CDPBazaarItem {
  resource: string;
  accepts: Array<{
    asset: string;
    network: string;
    maxAmountRequired?: string; // v1
    amount?: string; // v2
    payTo: string;
    scheme: string;
    outputSchema?: {
      input?: {
        method?: string;
        type?: string;
        bodyFields?: object;
        queryParams?: object;
      };
      output?: object | null;
    };
  }>;
  lastUpdated?: string;
  x402Version?: number;
  description?: string;
  extra?: Record<string, unknown>;
}

interface CDPBazaarResponse {
  items: CDPBazaarItem[];
  nextPageToken?: string;
}

// Facilitator supported endpoint response
interface FacilitatorSupportedResponse {
  success: boolean;
  schemes?: Array<{
    scheme: string;
    networks: string[];
    assets: string[];
  }>;
}

/**
 * Fetch resources from CDP Bazaar discovery API
 */
export async function fetchCDPBazaar(): Promise<CDPBazaarItem[]> {
  const allItems: CDPBazaarItem[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(
      "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources",
    );
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "x402jobs-indexer/1.0",
      },
    });

    if (!response.ok) {
      console.error(`[Bazaar] CDP fetch failed: ${response.status}`);
      break;
    }

    const data: CDPBazaarResponse = await response.json();
    allItems.push(...(data.items || []));
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return allItems;
}

/**
 * Fetch /supported endpoint from a facilitator to get capabilities
 */
export async function fetchFacilitatorSupported(
  url: string,
): Promise<FacilitatorSupportedResponse | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "x402jobs-indexer/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Normalize network identifier to standard format
 * Converts EIP-155 chain IDs and variations to canonical names
 */
function normalizeNetwork(network: string): string {
  const normalized = network.toLowerCase().trim();

  // EIP-155 chain IDs
  if (normalized === "eip155:8453" || normalized === "base-mainnet")
    return "base";
  if (normalized === "eip155:84532" || normalized === "base-sepolia")
    return "base-sepolia";
  if (normalized === "eip155:1" || normalized === "ethereum-mainnet")
    return "ethereum";
  if (normalized === "eip155:11155111" || normalized === "ethereum-sepolia")
    return "ethereum-sepolia";
  if (normalized === "eip155:137" || normalized === "polygon-mainnet")
    return "polygon";

  // Solana variations
  if (normalized.includes("solana")) return "solana";

  // Already normalized
  if (["base", "ethereum", "solana", "polygon"].includes(normalized)) {
    return normalized;
  }

  // Return as-is for unknown networks (will fail DB constraint, logged as error)
  return normalized;
}

/**
 * Generate URL-safe slug from hostname
 */
function generateSlug(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/\./g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get or create a unique slug for a server
 */
async function getUniqueServerSlug(baseSlug: string): Promise<string> {
  const supabase = getSupabase();
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

/**
 * Get or create a unique slug for a resource within a server
 */
async function getUniqueResourceSlug(
  serverId: string,
  baseSlug: string,
): Promise<string> {
  const supabase = getSupabase();
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data: existing } = await supabase
      .from("x402_resources")
      .select("id")
      .eq("server_id", serverId)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!existing) return slug;

    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}

/**
 * Generate a resource slug from its URL path or description
 */
function generateResourceSlug(url: string, description?: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  // Use last path segment, or description, or 'resource'
  const base =
    pathParts[pathParts.length - 1] || description?.slice(0, 30) || "resource";

  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Upsert a server discovered from Bazaar
 */
async function upsertServer(
  originUrl: string,
  facilitatorId: string,
): Promise<string | null> {
  const supabase = getSupabase();

  try {
    const urlObj = new URL(originUrl);
    const normalizedOrigin = urlObj.origin.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();

    // Check if server exists
    const { data: existing } = await supabase
      .from("x402_servers")
      .select("id, facilitator_ids")
      .ilike("origin_url", normalizedOrigin)
      .maybeSingle();

    if (existing) {
      // Update facilitator_ids if not already included
      const currentFacilitators = existing.facilitator_ids || [];
      if (!currentFacilitators.includes(facilitatorId)) {
        await supabase
          .from("x402_servers")
          .update({
            facilitator_ids: [...currentFacilitators, facilitatorId],
            discovered_via: "bazaar",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
      return existing.id;
    }

    // Create new server
    const slug = await getUniqueServerSlug(generateSlug(hostname));

    const { data: newServer, error } = await supabase
      .from("x402_servers")
      .insert({
        origin_url: normalizedOrigin,
        name: hostname,
        slug,
        discovered_via: "bazaar",
        facilitator_ids: [facilitatorId],
      })
      .select("id")
      .single();

    if (error) {
      console.error(`[Bazaar] Failed to create server ${hostname}:`, error);
      return null;
    }

    return newServer.id;
  } catch (error) {
    console.error(`[Bazaar] Error upserting server:`, error);
    return null;
  }
}

/**
 * Upsert a resource discovered from Bazaar
 */
async function upsertResource(
  item: CDPBazaarItem,
  serverId: string,
  facilitatorId: string,
): Promise<boolean> {
  const supabase = getSupabase();

  try {
    const accept = item.accepts[0];
    if (!accept) return false;

    const normalizedUrl = item.resource.trim();
    const urlWithoutProtocol = normalizedUrl.replace(/^https?:\/\//, "");

    // Check if resource exists
    const { data: existing } = await supabase
      .from("x402_resources")
      .select("id")
      .eq("normalized_url", urlWithoutProtocol)
      .maybeSingle();

    // Normalize the network identifier
    const network = normalizeNetwork(accept.network);

    if (existing) {
      // Update existing resource
      // v1 uses maxAmountRequired, v2 uses amount
      const maxAmount = accept.maxAmountRequired || accept.amount;
      await supabase
        .from("x402_resources")
        .update({
          resource_url: normalizedUrl,
          network,
          pay_to: accept.payTo,
          max_amount_required: maxAmount,
          asset: accept.asset,
          output_schema: accept.outputSchema,
          extra: item.extra,
          description: item.description,
          server_id: serverId,
          facilitator_id: facilitatorId,
          discovered_via: "bazaar",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      return true;
    }

    // Generate slug for new resource
    const baseSlug = generateResourceSlug(normalizedUrl, item.description);
    const slug = await getUniqueResourceSlug(serverId, baseSlug);

    // Create new resource
    // v1 uses maxAmountRequired, v2 uses amount
    const maxAmount = accept.maxAmountRequired || accept.amount;
    const { error } = await supabase.from("x402_resources").insert({
      resource_url: normalizedUrl,
      normalized_url: urlWithoutProtocol,
      network,
      name: item.description || new URL(normalizedUrl).pathname,
      slug,
      description: item.description,
      pay_to: accept.payTo,
      max_amount_required: maxAmount,
      asset: accept.asset,
      output_schema: accept.outputSchema,
      extra: item.extra,
      server_id: serverId,
      facilitator_id: facilitatorId,
      discovered_via: "bazaar",
      is_active: true,
    });

    if (error) {
      console.error(`[Bazaar] Failed to create resource:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Bazaar] Error upserting resource:`, error);
    return false;
  }
}

/**
 * Poll all facilitator discovery APIs and index resources
 */
export async function pollAllBazaars(): Promise<{
  facilitators: number;
  servers: number;
  resources: number;
  errors: number;
}> {
  const supabase = getSupabase();
  const stats = { facilitators: 0, servers: 0, resources: 0, errors: 0 };

  // Get facilitators from database
  const { data: facilitators } = await supabase
    .from("x402_facilitators")
    .select("id, slug, discovery_url")
    .eq("is_active", true)
    .not("discovery_url", "is", null);

  if (!facilitators || facilitators.length === 0) {
    console.log("[Bazaar] No facilitators with discovery URLs configured");
    return stats;
  }

  for (const facilitator of facilitators) {
    console.log(`[Bazaar] Polling ${facilitator.slug}...`);
    stats.facilitators++;

    try {
      let items: CDPBazaarItem[] = [];

      // Fetch based on facilitator type
      if (facilitator.slug === "cdp") {
        items = await fetchCDPBazaar();
      }
      // Add more facilitator-specific fetchers here

      console.log(
        `[Bazaar] ${facilitator.slug}: fetched ${items.length} resources`,
      );

      // Group items by origin for server creation
      const byOrigin = new Map<string, CDPBazaarItem[]>();
      for (const item of items) {
        try {
          const origin = new URL(item.resource).origin;
          if (!byOrigin.has(origin)) {
            byOrigin.set(origin, []);
          }
          byOrigin.get(origin)!.push(item);
        } catch {
          stats.errors++;
        }
      }

      // Process each origin
      for (const [origin, originItems] of byOrigin) {
        const serverId = await upsertServer(origin, facilitator.id);
        if (serverId) {
          stats.servers++;

          for (const item of originItems) {
            const success = await upsertResource(
              item,
              serverId,
              facilitator.id,
            );
            if (success) {
              stats.resources++;
            } else {
              stats.errors++;
            }
          }
        } else {
          stats.errors++;
        }
      }

      // Update facilitator last_polled_at
      await supabase
        .from("x402_facilitators")
        .update({
          last_polled_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", facilitator.id);
    } catch (error) {
      console.error(`[Bazaar] Error polling ${facilitator.slug}:`, error);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Discover new facilitators by probing known URLs
 */
export async function discoverFacilitators(): Promise<number> {
  const supabase = getSupabase();
  let updated = 0;

  // Get all facilitators
  const { data: facilitators } = await supabase
    .from("x402_facilitators")
    .select("id, slug, url")
    .eq("is_active", true);

  if (!facilitators) return 0;

  for (const facilitator of facilitators) {
    try {
      // Try to fetch /supported endpoint
      const supportedUrl = `${facilitator.url}/supported`;
      const supported = await fetchFacilitatorSupported(supportedUrl);

      if (supported?.success && supported.schemes) {
        // Extract networks and assets from schemes
        const networks = new Set<string>();
        const assets = new Set<string>();
        const schemes = new Set<string>();

        for (const scheme of supported.schemes) {
          schemes.add(scheme.scheme);
          for (const network of scheme.networks) {
            networks.add(network);
          }
          for (const asset of scheme.assets) {
            assets.add(asset);
          }
        }

        // Update facilitator with discovered capabilities
        await supabase
          .from("x402_facilitators")
          .update({
            supported_networks: Array.from(networks),
            supported_assets: Array.from(assets),
            supported_schemes: Array.from(schemes),
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", facilitator.id);

        updated++;
        console.log(
          `[Bazaar] Updated ${facilitator.slug} capabilities:`,
          Array.from(schemes),
        );
      }
    } catch {
      // Facilitator might not have /supported endpoint
    }
  }

  return updated;
}
