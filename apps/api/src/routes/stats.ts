import { Router } from "express";
import type { Router as RouterType } from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

const router: RouterType = Router();

// Supabase client with service role for reading stats
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

// GET /stats - Public platform stats and leaderboards
router.get("/", async (req, res) => {
  // Ensure CORS headers for this public endpoint
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  try {
    // Fetch all stats in parallel
    const [
      platformStats,
      topJobs,
      topResources,
      topServers,
      publicJobsData,
      resourcesCount,
    ] = await Promise.all([
      // Platform totals (for volume and jobs run)
      supabase.from("x402_platform_stats").select("id, value, count"),

      // Top earning jobs (public only)
      supabase
        .from("x402_jobs")
        .select("id, name, total_earnings_usdc, run_count, user_id")
        .eq("is_active", true)
        .order("total_earnings_usdc", { ascending: false })
        .limit(10),

      // Top earning resources (with server slug for URL building)
      supabase
        .from("x402_resources")
        .select(
          "id, slug, name, resource_url, total_earned_usdc, call_count, network, server:x402_servers(slug)",
        )
        .eq("is_active", true)
        .order("total_earned_usdc", { ascending: false })
        .limit(10),

      // Top servers by earnings (aggregated from resources)
      supabase
        .from("x402_servers")
        .select(
          "id, slug, name, origin_url, favicon_url, resource_count, total_earned_usdc, total_calls",
        )
        .order("total_earned_usdc", { ascending: false })
        .limit(10),

      // Public jobs - fetch all webhook-enabled jobs to filter (matching /jobs/public endpoint)
      supabase
        .from("x402_jobs")
        .select("id, published, trigger_type, trigger_methods")
        .or('trigger_type.eq.webhook,trigger_methods.cs.{"webhook":true}'),

      // Resources count - real-time count matching /api/v1/resources endpoint
      supabase
        .from("x402_resources")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .or("health_status.is.null,health_status.neq.offline"),
    ]);

    // Count public jobs (published !== false for backwards compatibility)
    const publicJobsCount =
      (publicJobsData.data || []).filter((j) => j.published !== false).length ||
      0;

    // Parse platform stats into object
    const platform: Record<string, { value: number; count: number }> = {};
    for (const stat of platformStats.data || []) {
      platform[stat.id] = {
        value: parseFloat(stat.value) || 0,
        count: stat.count || 0,
      };
    }

    // Format jobs for response
    const jobs = (topJobs.data || []).map((job) => ({
      id: job.id,
      name: job.name,
      earnings: parseFloat(job.total_earnings_usdc) || 0,
      runs: job.run_count || 0,
    }));

    // Format resources for response
    const resources = (topResources.data || []).map((resource) => {
      const server = resource.server as { slug?: string } | null;
      return {
        id: resource.id,
        slug: resource.slug,
        serverSlug: server?.slug,
        name: resource.name,
        url: resource.resource_url,
        network: resource.network,
        earnings: parseFloat(resource.total_earned_usdc) || 0,
        calls: resource.call_count || 0,
      };
    });

    // Format servers for response
    const servers = (topServers.data || []).map((server) => ({
      id: server.id,
      slug: server.slug,
      name: server.name,
      url: server.origin_url,
      faviconUrl: server.favicon_url,
      resourceCount: server.resource_count || 0,
      earnings: parseFloat(server.total_earned_usdc) || 0,
      calls: server.total_calls || 0,
    }));

    res.json({
      platform: {
        totalVolumeUsdc: platform.total_volume_usdc?.value || 0,
        totalJobsRun: platform.total_jobs_run?.count || 0,
        totalResources: resourcesCount.count || 0,
        activeJobs: platform.active_jobs?.count || 0,
        publicJobs: publicJobsCount,
      },
      leaderboards: {
        topJobs: jobs,
        topResources: resources,
        topServers: servers,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export { router as statsRouter };
