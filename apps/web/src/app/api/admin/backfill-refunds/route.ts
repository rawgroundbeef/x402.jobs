import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

interface AcceptOption {
  network: string;
  normalizedNetwork: string;
  payTo: string;
  amount: string;
  asset?: string;
  scheme?: string;
  extra?: Record<string, unknown>;
}

interface VerifyResponse {
  valid: boolean;
  x402Version?: number;
  accepts?: AcceptOption[];
  resource: {
    description?: string;
    network?: string;
    [key: string]: unknown;
  };
}

interface BackfillResult {
  id: string;
  slug: string;
  name: string;
  resourceUrl: string;
  supportsRefunds: boolean;
  updated: boolean;
  error?: string;
}

/**
 * Admin endpoint to backfill supports_refunds for existing resources.
 * Re-verifies each resource URL and extracts supportsRefunds from x402 response.
 *
 * Authentication: Requires ADMIN_API_KEY in x-admin-key header
 *
 * Query params:
 * - limit: Number of resources to process (default 10)
 * - offset: Pagination offset (default 0)
 *
 * POST /api/admin/backfill-refunds?limit=50&offset=0
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication: Check admin API key
    const adminKey = request.headers.get("x-admin-key");
    if (!ADMIN_API_KEY || adminKey !== ADMIN_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing admin key" },
        { status: 401 },
      );
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10", 10),
      100,
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // 3. Fetch resources that need backfill (supports_refunds IS NULL)
    // Use the public API to get resources list
    const resourcesRes = await fetch(
      `${API_URL}/api/v1/resources?limit=${limit}&offset=${offset}&needs_refund_backfill=true`,
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!resourcesRes.ok) {
      // Fallback: if the API doesn't support the filter, get all resources
      const fallbackRes = await fetch(
        `${API_URL}/api/v1/resources?limit=${limit}&offset=${offset}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!fallbackRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch resources from API" },
          { status: 500 },
        );
      }

      const fallbackData = await fallbackRes.json();
      return processResources(fallbackData.resources || [], adminKey);
    }

    const data = await resourcesRes.json();
    return processResources(data.resources || [], adminKey);
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

async function processResources(
  resources: Array<{
    id: string;
    slug: string;
    name: string;
    resource_url: string;
  }>,
  adminKey: string,
): Promise<NextResponse> {
  const results: BackfillResult[] = [];
  let processed = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const resource of resources) {
    processed++;

    // Rate limiting: 500ms delay between requests
    if (processed > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      // Verify the resource URL to get current x402 response
      const verifyRes = await fetch(`${API_URL}/api/v1/resources/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resource.resource_url }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Verify failed: ${verifyRes.status}`,
        );
      }

      const verifyData: VerifyResponse = await verifyRes.json();

      // Extract supportsRefunds from accepts[].extra
      const supportsRefunds =
        verifyData.accepts?.some(
          (accept: { extra?: Record<string, unknown> }) =>
            accept.extra?.supportsRefunds === true,
        ) ?? false;

      // Update the resource via PATCH
      const updateRes = await fetch(
        `${API_URL}/api/v1/resources/${resource.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ supportsRefunds }),
        },
      );

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Update failed: ${updateRes.status}`,
        );
      }

      updated++;
      results.push({
        id: resource.id,
        slug: resource.slug,
        name: resource.name,
        resourceUrl: resource.resource_url,
        supportsRefunds,
        updated: true,
      });
    } catch (err) {
      failed++;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push({ id: resource.id, error: errorMsg });
      results.push({
        id: resource.id,
        slug: resource.slug,
        name: resource.name,
        resourceUrl: resource.resource_url,
        supportsRefunds: false,
        updated: false,
        error: errorMsg,
      });
    }
  }

  return NextResponse.json({
    processed,
    updated,
    failed,
    results,
    errors,
  });
}
