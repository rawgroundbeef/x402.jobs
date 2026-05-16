import { Router, Request, Response } from "express";
import { getSupabase } from "../lib/supabase";

export const dashboardRouter: Router = Router();

/**
 * GET /user/dashboard/stats
 * Get the authenticated user's earnings aggregates and trends
 */
dashboardRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const supabase = getSupabase();
    const now = new Date();

    // Calculate date boundaries
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Week boundaries (Sunday to Saturday)
    const today = new Date(now);
    const dayOfWeek = today.getDay();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - dayOfWeek);
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // Fetch jobs, servers, and resources first
    const [jobsResult, serversResult] = await Promise.all([
      supabase
        .from("x402_jobs")
        .select("id, total_earnings_usdc, run_count, creator_markup")
        .eq("user_id", userId)
        .eq("is_active", true),
      supabase
        .from("x402_servers")
        .select("id, total_earned_usdc, total_calls")
        .eq("verified_owner_id", userId),
    ]);

    const jobs = jobsResult.data || [];
    const servers = serversResult.data || [];
    const jobIds = jobs.map((j) => j.id);
    const serverIds = servers.map((s) => s.id);

    // Fetch resource IDs for user's servers (for counting calls)
    let resourceIds: string[] = [];
    if (serverIds.length > 0) {
      const { data: resources } = await supabase
        .from("x402_resources")
        .select("id")
        .in("server_id", serverIds)
        .eq("is_active", true);
      resourceIds = (resources || []).map((r) => r.id);
    }

    // Calculate total earnings (all-time)
    const jobEarnings = jobs.reduce(
      (sum, j) => sum + (parseFloat(j.total_earnings_usdc) || 0),
      0,
    );
    const serverEarnings = servers.reduce(
      (sum, s) => sum + (parseFloat(s.total_earned_usdc) || 0),
      0,
    );
    const totalEarnings = jobEarnings + serverEarnings;

    // Fetch time-based data in parallel
    const queries: PromiseLike<any>[] = [];

    // Job runs queries (only if user has jobs)
    if (jobIds.length > 0) {
      queries.push(
        supabase
          .from("x402_job_runs")
          .select("id, job_id, x402_jobs!inner(user_id, creator_markup)")
          .eq("x402_jobs.user_id", userId)
          .in("status", ["completed", "success"])
          .gte("created_at", thisMonthStart.toISOString())
          .then((r) => r),
        supabase
          .from("x402_job_runs")
          .select("id, job_id, x402_jobs!inner(user_id, creator_markup)")
          .eq("x402_jobs.user_id", userId)
          .in("status", ["completed", "success"])
          .gte("created_at", lastMonthStart.toISOString())
          .lte("created_at", lastMonthEnd.toISOString())
          .then((r) => r),
      );
    } else {
      queries.push(
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
      );
    }

    // Resource earnings from x402_transactions (on-chain payments via Helius)
    // Resource calls from x402_job_run_events (all calls including Base)
    if (serverIds.length > 0) {
      queries.push(
        // Monthly earnings from transactions
        supabase
          .from("x402_transactions")
          .select("id, amount_usdc")
          .in("server_id", serverIds)
          .eq("status", "confirmed")
          .gte("block_time", thisMonthStart.toISOString())
          .then((r) => r),
        supabase
          .from("x402_transactions")
          .select("id, amount_usdc")
          .in("server_id", serverIds)
          .eq("status", "confirmed")
          .gte("block_time", lastMonthStart.toISOString())
          .lte("block_time", lastMonthEnd.toISOString())
          .then((r) => r),
      );
    } else {
      queries.push(
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
      );
    }

    // Resource call counts from x402_job_run_events (counts ALL resource calls, not just Solana)
    if (resourceIds.length > 0) {
      queries.push(
        supabase
          .from("x402_job_run_events")
          .select("id", { count: "exact", head: true })
          .in("resource_id", resourceIds)
          .in("status", ["completed", "failed"])
          .gte("created_at", thisWeekStart.toISOString())
          .then((r) => r),
        supabase
          .from("x402_job_run_events")
          .select("id", { count: "exact", head: true })
          .in("resource_id", resourceIds)
          .in("status", ["completed", "failed"])
          .gte("created_at", lastWeekStart.toISOString())
          .lte("created_at", lastWeekEnd.toISOString())
          .then((r) => r),
      );
    } else {
      queries.push(
        Promise.resolve({ count: 0 }),
        Promise.resolve({ count: 0 }),
      );
    }

    const [
      thisMonthJobRunsResult,
      lastMonthJobRunsResult,
      thisMonthTransactionsResult,
      lastMonthTransactionsResult,
      thisWeekEventsResult,
      lastWeekEventsResult,
    ] = await Promise.all(queries);

    // Calculate job markup earnings per period
    const jobMap = new Map(
      jobs.map((j) => [j.id, parseFloat(j.creator_markup) || 0]),
    );

    const thisMonthJobRuns = thisMonthJobRunsResult.data || [];
    const lastMonthJobRuns = lastMonthJobRunsResult.data || [];

    const thisMonthJobEarnings = thisMonthJobRuns.reduce(
      (sum: number, run: any) => sum + (jobMap.get(run.job_id) || 0),
      0,
    );
    const lastMonthJobEarnings = lastMonthJobRuns.reduce(
      (sum: number, run: any) => sum + (jobMap.get(run.job_id) || 0),
      0,
    );

    // Calculate resource earnings per period from x402_transactions
    const thisMonthTransactions = thisMonthTransactionsResult.data || [];
    const lastMonthTransactions = lastMonthTransactionsResult.data || [];

    const thisMonthResourceEarnings = thisMonthTransactions.reduce(
      (sum: number, tx: any) => sum + (parseFloat(tx.amount_usdc) || 0),
      0,
    );
    const lastMonthResourceEarnings = lastMonthTransactions.reduce(
      (sum: number, tx: any) => sum + (parseFloat(tx.amount_usdc) || 0),
      0,
    );

    // Total monthly earnings
    const thisMonthEarnings = thisMonthJobEarnings + thisMonthResourceEarnings;
    const lastMonthEarnings = lastMonthJobEarnings + lastMonthResourceEarnings;

    // Count calls this week (from x402_job_run_events - all resource calls)
    const thisWeekResourceCalls = thisWeekEventsResult.count || 0;
    const lastWeekResourceCalls = lastWeekEventsResult.count || 0;

    // Calculate trends
    const earningsPercent =
      lastMonthEarnings > 0
        ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
        : thisMonthEarnings > 0
          ? 100
          : 0;

    const callsPercent =
      lastWeekResourceCalls > 0
        ? ((thisWeekResourceCalls - lastWeekResourceCalls) /
            lastWeekResourceCalls) *
          100
        : thisWeekResourceCalls > 0
          ? 100
          : 0;

    res.json({
      totalEarnings,
      thisMonth: thisMonthEarnings,
      lastMonth: lastMonthEarnings,
      callsThisWeek: thisWeekResourceCalls,
      callsLastWeek: lastWeekResourceCalls,
      trends: {
        earningsPercent: Math.round(earningsPercent * 10) / 10,
        callsPercent: Math.round(callsPercent * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

/**
 * GET /user/dashboard/earnings
 * Get earnings time series for chart (includes both job markup and resource earnings)
 */
dashboardRouter.get("/earnings", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const period = (req.query.period as string) || "30d";
    const supabase = getSupabase();

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "all":
        startDate = new Date("2024-01-01"); // Platform start date
        break;
      case "30d":
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
    }

    // Fetch user's jobs and servers in parallel
    const [jobsResult, serversResult] = await Promise.all([
      supabase
        .from("x402_jobs")
        .select("id, creator_markup")
        .eq("user_id", userId)
        .eq("is_active", true),
      supabase
        .from("x402_servers")
        .select("id")
        .eq("verified_owner_id", userId),
    ]);

    const jobs = jobsResult.data || [];
    const servers = serversResult.data || [];

    const jobMap = new Map(
      jobs.map((j) => [j.id, parseFloat(j.creator_markup) || 0]),
    );
    const jobIds = Array.from(jobMap.keys());
    const serverIds = servers.map((s) => s.id);

    // Get resource IDs for user's servers
    let resourceIds: string[] = [];
    if (serverIds.length > 0) {
      const { data: resources } = await supabase
        .from("x402_resources")
        .select("id")
        .in("server_id", serverIds)
        .eq("is_active", true);
      resourceIds = (resources || []).map((r) => r.id);
    }

    // Aggregate by day
    const dailyData = new Map<string, { earnings: number; runCount: number }>();

    // 1. Job earnings from completed runs (creator markup)
    if (jobIds.length > 0) {
      const { data: runs } = await supabase
        .from("x402_job_runs")
        .select("id, job_id, created_at")
        .in("job_id", jobIds)
        .in("status", ["completed", "success"])
        .gte("created_at", startDate.toISOString());

      for (const run of runs || []) {
        const date = run.created_at.split("T")[0] ?? "";
        const markup = jobMap.get(run.job_id) || 0;

        const existing = dailyData.get(date) || { earnings: 0, runCount: 0 };
        existing.earnings += markup;
        existing.runCount += 1;
        dailyData.set(date, existing);
      }
    }

    // 2. Resource earnings from x402_job_run_events (all resource calls, not just Solana)
    if (resourceIds.length > 0) {
      const { data: events } = await supabase
        .from("x402_job_run_events")
        .select("amount_paid, created_at")
        .in("resource_id", resourceIds)
        .in("status", ["completed", "success"])
        .gte("created_at", startDate.toISOString());

      for (const event of events || []) {
        const date = event.created_at.split("T")[0] ?? "";
        const amount = parseFloat(event.amount_paid) || 0;

        const existing = dailyData.get(date) || { earnings: 0, runCount: 0 };
        existing.earnings += amount;
        existing.runCount += 1;
        dailyData.set(date, existing);
      }
    }

    // Fill in missing dates with zeros
    const data: Array<{ date: string; earnings: number; runCount: number }> =
      [];
    const currentDate = new Date(startDate);

    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split("T")[0] ?? "";
      const dayData = dailyData.get(dateStr) || { earnings: 0, runCount: 0 };
      data.push({
        date: dateStr,
        earnings: Math.round(dayData.earnings * 100) / 100,
        runCount: dayData.runCount,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const totalForPeriod = data.reduce((sum, d) => sum + d.earnings, 0);

    res.json({
      data,
      period,
      totalForPeriod: Math.round(totalForPeriod * 100) / 100,
    });
  } catch (error) {
    console.error("Dashboard earnings error:", error);
    res.status(500).json({ error: "Failed to fetch earnings data" });
  }
});

/**
 * GET /user/dashboard/top-performers
 * Get user's top 3 earning items (jobs or resources)
 */
dashboardRouter.get("/top-performers", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const supabase = getSupabase();

    // Fetch user's profile for username (skip soft-deleted — HIGH-03)
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    // Fetch top jobs by earnings
    const { data: topJobs } = await supabase
      .from("x402_jobs")
      .select("id, name, slug, avatar_url, total_earnings_usdc, run_count")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("total_earnings_usdc", { ascending: false })
      .limit(3);

    // Fetch user's servers with favicon for fallback
    const { data: servers } = await supabase
      .from("x402_servers")
      .select("id, slug, favicon_url")
      .eq("verified_owner_id", userId);

    const serverIds = (servers || []).map((s) => s.id);
    const serverSlugMap = new Map((servers || []).map((s) => [s.id, s.slug]));
    const serverFaviconMap = new Map(
      (servers || []).map((s) => [s.id, s.favicon_url]),
    );

    // Fetch top resources from user's servers (include extra for avatarUrl fallback)
    let topResources: any[] = [];
    if (serverIds.length > 0) {
      const { data: resources } = await supabase
        .from("x402_resources")
        .select(
          "id, name, slug, avatar_url, extra, total_earned_usdc, call_count, server_id",
        )
        .in("server_id", serverIds)
        .eq("is_active", true)
        .order("total_earned_usdc", { ascending: false })
        .limit(3);
      topResources = resources || [];
    }

    // Combine and sort to get overall top 3
    const items: Array<{
      type: "job" | "resource";
      id: string;
      name: string;
      slug: string;
      avatarUrl: string | null;
      earnings: number;
      runCount: number;
      ownerUsername?: string;
      serverSlug?: string;
    }> = [];

    for (const job of topJobs || []) {
      items.push({
        type: "job",
        id: job.id,
        name: job.name,
        slug: job.slug,
        avatarUrl: job.avatar_url,
        earnings: parseFloat(job.total_earnings_usdc) || 0,
        runCount: job.run_count || 0,
        ownerUsername: profile?.username,
      });
    }

    for (const resource of topResources) {
      // Use fallback chain: avatar_url -> extra.avatarUrl -> server favicon
      const avatarUrl =
        resource.avatar_url ||
        (resource.extra as { avatarUrl?: string })?.avatarUrl ||
        serverFaviconMap.get(resource.server_id) ||
        null;

      items.push({
        type: "resource",
        id: resource.id,
        name: resource.name,
        slug: resource.slug,
        avatarUrl,
        earnings: parseFloat(resource.total_earned_usdc) || 0,
        runCount: resource.call_count || 0,
        serverSlug: serverSlugMap.get(resource.server_id),
      });
    }

    // Sort by earnings descending and take top 3
    items.sort((a, b) => b.earnings - a.earnings);
    const top3 = items.slice(0, 3);

    res.json({ items: top3 });
  } catch (error) {
    console.error("Dashboard top performers error:", error);
    res.status(500).json({ error: "Failed to fetch top performers" });
  }
});

/**
 * GET /user/dashboard/activity
 * Get recent activity events (job runs, resource calls)
 */
dashboardRouter.get("/activity", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const supabase = getSupabase();

    // Fetch user's job IDs
    const { data: jobs } = await supabase
      .from("x402_jobs")
      .select("id, name, slug, avatar_url, creator_markup")
      .eq("user_id", userId)
      .eq("is_active", true);

    const jobMap = new Map(
      (jobs || []).map((j) => [
        j.id,
        {
          name: j.name,
          slug: j.slug,
          avatarUrl: j.avatar_url,
          markup: parseFloat(j.creator_markup) || 0,
        },
      ]),
    );
    const jobIds = Array.from(jobMap.keys());

    // Fetch recent runs for user's jobs
    let runs: any[] = [];
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from("x402_job_runs")
        .select("id, job_id, status, created_at")
        .in("job_id", jobIds)
        .in("status", ["completed", "success"])
        .order("created_at", { ascending: false })
        .limit(limit);
      runs = data || [];
    }

    // Transform to activity events
    const events = runs.map((run) => {
      const job = jobMap.get(run.job_id);
      return {
        id: run.id,
        type: "earning" as const,
        timestamp: run.created_at,
        itemName: job?.name || "Unknown Job",
        itemType: "job" as const,
        amount: job?.markup || 0,
        job: job
          ? {
              id: run.job_id,
              name: job.name,
              slug: job.slug,
              avatarUrl: job.avatarUrl,
            }
          : undefined,
      };
    });

    res.json({ events });
  } catch (error) {
    console.error("Dashboard activity error:", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

/**
 * GET /user/dashboard/action-context
 * Get contextual data for action suggestion cards
 */
dashboardRouter.get("/action-context", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const supabase = getSupabase();

    // Fetch all needed data in parallel
    const [profileResult, jobsResult, serversResult, walletResult] =
      await Promise.all([
        // User profile (skip soft-deleted — HIGH-03)
        supabase
          .from("profiles")
          .select("bio, username")
          .eq("id", userId)
          .is("deleted_at", null)
          .single(),

        // User's jobs
        supabase
          .from("x402_jobs")
          .select("id, created_at, total_earnings_usdc")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),

        // User's owned servers with resource count
        supabase
          .from("x402_servers")
          .select("id, name, resource_count")
          .eq("verified_owner_id", userId),

        // User wallet balance
        supabase
          .from("x402_user_wallets")
          .select("balance_usdc")
          .eq("user_id", userId)
          .single(),
      ]);

    const profile = profileResult.data;
    const jobs = jobsResult.data || [];
    const servers = serversResult.data || [];
    const wallet = walletResult.data;

    // Calculate total resources from servers
    const resourceCount = servers.reduce(
      (sum, s) => sum + (s.resource_count || 0),
      0,
    );

    // Find server with fewest resources (for "add more resources" suggestion)
    const serverWithFewResources = servers.find(
      (s) => (s.resource_count || 0) < 3,
    );

    // Get most recent creation date
    const firstJob = jobs[0];
    const lastCreatedAt = firstJob ? firstJob.created_at : null;

    // Check if bio is empty or just default
    const hasBio =
      profile?.bio &&
      profile.bio.trim() !== "" &&
      profile.bio.toLowerCase() !== "founder";

    // Find top earning job/resource for pricing suggestion
    const topJob =
      jobs.length > 0
        ? jobs.reduce((max, j) =>
            (parseFloat(j.total_earnings_usdc) || 0) >
            (parseFloat(max.total_earnings_usdc) || 0)
              ? j
              : max,
          )
        : null;

    res.json({
      jobCount: jobs.length,
      serverCount: servers.length,
      resourceCount,
      hasBio,
      lastCreatedAt,
      serverWithFewResources: serverWithFewResources
        ? {
            id: serverWithFewResources.id,
            name: serverWithFewResources.name,
            resourceCount: serverWithFewResources.resource_count || 0,
          }
        : null,
      topJobEarnings: topJob
        ? parseFloat(topJob.total_earnings_usdc) || 0
        : null,
      walletBalance: parseFloat(wallet?.balance_usdc || "0") || 0,
    });
  } catch (error) {
    console.error("Dashboard action context error:", error);
    res.status(500).json({ error: "Failed to fetch action context" });
  }
});
