import { Router, type Router as RouterType } from "express";
import { config } from "../config";
import { generateRandomJobName } from "../lib/randomNames";
import { getSupabase } from "../lib/supabase";

// Public routes (no auth required)
export const jobsPublicRouter: RouterType = Router();
// Protected routes (auth required)
export const jobsRouter: RouterType = Router();

/**
 * Generate a short unique ID (6 chars)
 */
function shortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Generate a URL-friendly slug from a job name with unique suffix
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

  return `${base}-${shortId()}`;
}

// GET /api/jobs/by-resource/:resourceId - Get public jobs that use a specific resource
// Only returns jobs where show_workflow = true so the resource relationship is visible
jobsPublicRouter.get("/by-resource/:resourceId", async (req, res) => {
  try {
    const resourceId = req.params.resourceId;
    const { limit = "6", offset = "0" } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10) || 6, 20);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // First, verify the resource exists and get its details for matching
    const { data: resource } = await getSupabase()
      .from("x402_resources")
      .select("id, slug, resource_url")
      .eq("id", resourceId)
      .single();

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Fetch all active, published jobs with visible workflows
    // We'll filter client-side for workflow containing this resource
    const { data: jobs, error } = await getSupabase()
      .from("x402_jobs")
      .select(
        `
        id,
        name,
        slug,
        description,
        network,
        workflow_definition,
        created_at,
        user_id,
        creator_markup,
        avatar_url,
        run_count,
        show_workflow
      `,
      )
      .eq("is_active", true)
      .eq("show_workflow", true)
      .or("published.eq.true,published.is.null")
      .order("run_count", { ascending: false });

    if (error) {
      console.error("Error fetching jobs by resource:", error);
      return res.status(500).json({ error: "Failed to fetch jobs" });
    }

    // Filter jobs that contain this resource in their workflow
    const matchingJobs = (jobs || []).filter((job) => {
      const nodes = job.workflow_definition?.nodes || [];
      return nodes.some((node: any) => {
        if (node.type !== "resource") return false;
        const nodeResource = node.data?.resource;
        if (!nodeResource) return false;
        // Match by resource ID, slug, or URL
        return (
          nodeResource.id === resource.id ||
          nodeResource.slug === resource.slug ||
          nodeResource.resourceUrl === resource.resource_url
        );
      });
    });

    // Get user info for job owners
    const userIds = [...new Set(matchingJobs.map((j) => j.user_id))];
    const usernames: Record<string, { username: string; avatar_url?: string }> =
      {};

    if (userIds.length > 0) {
      const { data: users } = await getSupabase()
        .from("users")
        .select("id, username, avatar_url")
        .in("id", userIds);

      (users || []).forEach(
        (u: { id: string; username: string; avatar_url?: string }) => {
          if (u.username)
            usernames[u.id] = {
              username: u.username,
              avatar_url: u.avatar_url,
            };
        },
      );
    }

    // Calculate price and format response for each job
    const formattedJobs = matchingJobs.map((job) => {
      const nodes = job.workflow_definition?.nodes || [];
      const resourceNodes = nodes.filter((n: any) => n.type === "resource");
      const resourcePrice = resourceNodes.reduce(
        (sum: number, n: any) => sum + (n.data?.resource?.price || 0),
        0,
      );
      const creatorMarkup = parseFloat(job.creator_markup) || 0;
      const platformFee = Math.max(
        resourcePrice * config.platformFee.percentage,
        config.platformFee.minimumUsdc,
      );
      const totalPrice = resourcePrice + platformFee + creatorMarkup;

      const ownerInfo = usernames[job.user_id];

      return {
        id: job.id,
        name: job.name,
        slug: job.slug,
        description: job.description,
        network: job.network || "solana",
        price: totalPrice,
        owner_username: ownerInfo?.username,
        owner_avatar_url: ownerInfo?.avatar_url,
        run_count: job.run_count || 0,
        avatar_url: job.avatar_url,
        created_at: job.created_at,
      };
    });

    // Total count before pagination
    const totalCount = formattedJobs.length;

    // Apply pagination
    const paginatedJobs = formattedJobs.slice(offsetNum, offsetNum + limitNum);

    res.json({
      jobs: paginatedJobs,
      total: totalCount,
      hasMore: offsetNum + limitNum < totalCount,
    });
  } catch (error) {
    console.error("Jobs by resource fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/public - List public jobs (webhook-enabled jobs from all users)
// Includes the current user's own jobs (marked with isOwn: true) so they can reuse them
// Supports: search, network, sort (earnings|popular|latest|price_low|price_high), limit, offset
jobsPublicRouter.get("/public", async (req, res) => {
  try {
    const userId = req.user?.id; // May be authenticated or not
    const {
      search,
      network,
      sort = "earnings",
      limit = "25",
      offset = "0",
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // Determine sort order - we'll apply this after processing
    let orderColumn = "run_count";
    let orderAscending = false;
    switch (sort) {
      case "latest":
        orderColumn = "created_at";
        orderAscending = false;
        break;
      case "price_low":
      case "price_high":
      case "earnings":
        // Price/earnings sorting will be done after calculating prices
        orderColumn = "created_at";
        orderAscending = false;
        break;
      case "popular":
      default:
        orderColumn = "run_count";
        orderAscending = false;
    }

    // Fetch all published webhook-enabled jobs (including current user's jobs)
    // Jobs with webhook in trigger_methods object OR legacy trigger_type = "webhook"
    // Using @> (contains) operator for JSONB object matching
    // Only show jobs where published = true OR published IS NULL (backwards compatibility)
    const { data: jobs, error } = await getSupabase()
      .from("x402_jobs")
      .select(
        `
        id,
        name,
        slug,
        description,
        network,
        workflow_definition,
        created_at,
        user_id,
        creator_markup,
        trigger_methods,
        trigger_type,
        avatar_url,
        run_count,
        published,
        total_earnings_usdc,
        success_count_30d,
        failure_count_30d
      `,
      )
      .or('trigger_type.eq.webhook,trigger_methods.cs.{"webhook":true}')
      .order(orderColumn, { ascending: orderAscending });

    if (error) {
      console.error("Error fetching public jobs:", error);
      return res.status(500).json({ error: "Failed to fetch public jobs" });
    }

    // Filter out jobs where published is explicitly false
    // Jobs with published = true OR published = null (backwards compatibility) are shown
    const publishedJobs = (jobs || []).filter((j) => j.published !== false);

    // Get user info for job owners (usernames)
    const userIds = [...new Set(publishedJobs.map((j) => j.user_id))];
    const usernames: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: users } = await getSupabase()
        .from("users")
        .select("id, username")
        .in("id", userIds);

      (users || []).forEach((u: { id: string; username: string }) => {
        if (u.username) usernames[u.id] = u.username;
      });
    }

    // Get run counts for jobs
    const jobIds = publishedJobs.map((j) => j.id);
    const runCounts: Record<string, number> = {};

    if (jobIds.length > 0) {
      const { data: counts } = await getSupabase()
        .from("x402_job_runs")
        .select("job_id")
        .in("job_id", jobIds);

      (counts || []).forEach((run: { job_id: string }) => {
        runCounts[run.job_id] = (runCounts[run.job_id] || 0) + 1;
      });
    }

    // Calculate price for each job (sum of resources + platform fee + creator markup)
    // Platform fee is 1.5% of resource cost (minimum $0.01)
    const publicJobs = publishedJobs.map((job) => {
      const nodes = job.workflow_definition?.nodes || [];
      const resourceNodes = nodes.filter((n: any) => n.type === "resource");
      const resourcePrice = resourceNodes.reduce(
        (sum: number, n: any) => sum + (n.data?.resource?.price || 0),
        0,
      );
      const creatorMarkup = parseFloat(job.creator_markup) || 0;
      // Platform fee = 1.5% of resource cost (minimum $0.01)
      const platformFee = Math.max(
        resourcePrice * config.platformFee.percentage,
        config.platformFee.minimumUsdc,
      );
      const baseCost = resourcePrice + platformFee;
      // creator_markup is a static amount in USD
      const totalPrice = baseCost + creatorMarkup;

      // Extract job parameters from trigger node (without exposing workflow internals)
      const triggerNode = nodes.find((n: any) => n.type === "trigger");
      const jobParameters =
        triggerNode?.data?.workflowInputs?.map((input: any) => ({
          name: input.name,
          type: input.type || "string",
          required: input.required || false,
          description: input.description || "",
        })) || [];

      // Build webhook URLs - prefer nice URL if username and slug available
      const ownerUsername = usernames[job.user_id];
      const webhookUrl =
        ownerUsername && job.slug
          ? `${config.publicUrl}/@${ownerUsername}/${job.slug}`
          : `${config.publicUrl}/webhooks/${job.id}`;

      // Calculate actual creator earnings (markup × runs)
      const runCount = runCounts[job.id] || 0;
      const earnings = creatorMarkup * runCount;

      return {
        id: job.id,
        name: job.name,
        slug: job.slug,
        description: job.description,
        network: job.network || "solana", // Default to solana for old jobs
        price: totalPrice,
        baseCost, // Cost without creator markup
        creatorMarkup, // Creator's markup (static amount in USD)
        owner_username: ownerUsername,
        run_count: runCount,
        earnings, // Actual creator earnings (markup × runs)
        total_earnings_usdc: parseFloat(job.total_earnings_usdc) || 0,
        success_count_30d: job.success_count_30d || 0,
        failure_count_30d: job.failure_count_30d || 0,
        created_at: job.created_at,
        webhook_url: webhookUrl,
        legacy_webhook_url: `${config.publicUrl}/webhooks/${job.id}`,
        isOwn: userId ? job.user_id === userId : false, // Flag for user's own jobs
        jobParameters, // Exposed job parameters for configuration
        avatar_url: job.avatar_url,
      };
    });

    // Filter by network if provided
    let filteredJobs = publicJobs;
    if (network && typeof network === "string") {
      filteredJobs = filteredJobs.filter(
        (j) => j.network?.toLowerCase() === network.toLowerCase(),
      );
    }

    // Filter by search if provided
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      filteredJobs = filteredJobs.filter(
        (j) =>
          j.name?.toLowerCase().includes(searchLower) ||
          j.description?.toLowerCase().includes(searchLower) ||
          j.owner_username?.toLowerCase().includes(searchLower) ||
          j.slug?.toLowerCase().includes(searchLower),
      );
    }

    // Apply price/earnings sorting if needed (after we've calculated prices)
    if (sort === "price_low") {
      filteredJobs.sort((a, b) => a.price - b.price);
    } else if (sort === "price_high") {
      filteredJobs.sort((a, b) => b.price - a.price);
    } else if (sort === "earnings") {
      // Sort by highest earnings (total_earnings_usdc) - matches what's displayed
      filteredJobs.sort(
        (a, b) => b.total_earnings_usdc - a.total_earnings_usdc,
      );
    } else {
      // Sort to show user's own jobs first, then by the already-applied order
      filteredJobs.sort((a, b) => {
        if (a.isOwn && !b.isOwn) return -1;
        if (!a.isOwn && b.isOwn) return 1;
        return 0;
      });
    }

    // Total count before pagination
    const totalCount = filteredJobs.length;

    // Apply pagination
    const paginatedJobs = filteredJobs.slice(offsetNum, offsetNum + limitNum);

    res.json({
      jobs: paginatedJobs,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error("Public jobs fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs - List user's jobs
jobsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data: jobs, error } = await getSupabase()
      .from("x402_jobs")
      .select(
        "id, display_id, name, slug, description, network, trigger_type, trigger_methods, creator_markup, output_type, is_active, last_run_at, created_at, updated_at, workflow_definition, avatar_url, schedule_cron, schedule_timezone, schedule_enabled, schedule_next_run_at, published, on_success_job_id, run_count, total_earnings_usdc, webhook_response",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching jobs:", error);
      return res.status(500).json({ error: "Failed to fetch jobs" });
    }

    // Calculate summary stats
    const totalEarnings = (jobs || []).reduce(
      (sum, job) => sum + (parseFloat(job.total_earnings_usdc) || 0),
      0,
    );
    const totalRuns = (jobs || []).reduce(
      (sum, job) => sum + (job.run_count || 0),
      0,
    );
    const publicJobsCount = (jobs || []).filter(
      (job) => job.published && job.trigger_methods?.webhook,
    ).length;

    // Map workflow_definition to workflow_data for frontend compatibility
    const mappedJobs = (jobs || []).map((job) => ({
      ...job,
      workflow_data: job.workflow_definition,
      run_count: job.run_count || 0,
      total_earnings_usdc: parseFloat(job.total_earnings_usdc) || 0,
    }));

    res.json({
      jobs: mappedJobs,
      stats: {
        totalEarnings,
        totalRuns,
        publicJobsCount,
        totalJobs: (jobs || []).length,
      },
    });
  } catch (error) {
    console.error("Jobs fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id - Get a single job (authenticated, owner only)
jobsRouter.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;

    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .select(
        "id, display_id, name, slug, description, network, trigger_type, trigger_methods, creator_markup, output_type, is_active, last_run_at, created_at, updated_at, workflow_definition, avatar_url, schedule_cron, schedule_timezone, schedule_enabled, schedule_next_run_at, published, on_success_job_id, run_count, total_earnings_usdc, webhook_response",
      )
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Map workflow_definition to workflow_data for frontend compatibility
    res.json({
      ...job,
      workflow_data: job.workflow_definition,
      run_count: job.run_count || 0,
      total_earnings_usdc: parseFloat(job.total_earnings_usdc) || 0,
    });
  } catch (error) {
    console.error("Job fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/view/:id - View a job (returns full data for owner, public data for others)
// This is on the PUBLIC router - auth is optional but used to determine ownership
jobsPublicRouter.get("/view/:id", async (req, res) => {
  try {
    const jobId = req.params.id;

    // Optional auth - extract user ID from token if provided
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const {
          data: { user },
        } = await getSupabase().auth.getUser(token);
        userId = user?.id;
      } catch {
        // Ignore auth errors - just proceed without user
      }
    }

    // Check if user is admin
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || [];
    const isAdmin = userId ? adminUserIds.includes(userId) : false;

    // Always fetch all fields - we'll filter based on ownership
    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Check if job is active (unless owner or admin)
    const isOwner = userId === job.user_id;
    if (!job.is_active && !isOwner && !isAdmin) {
      return res.status(404).json({ error: "Job has been deleted" });
    }

    // Get owner username for nice URL
    const { data: owner } = await getSupabase()
      .from("users")
      .select("username")
      .eq("id", job.user_id)
      .single();
    const ownerUsername = owner?.username;

    // Generate webhook URL if webhook is enabled (use nice URL if possible)
    const hasWebhook =
      job.trigger_methods?.webhook || job.trigger_type === "webhook";
    const webhookUrl = hasWebhook
      ? ownerUsername && job.slug
        ? `${config.publicUrl}/@${ownerUsername}/${job.slug}`
        : `${config.publicUrl}/webhooks/${job.id}`
      : undefined;

    // Extract workflow inputs from trigger node
    let webhookInputSchema:
      | Record<string, { type: string; required: boolean; description: string }>
      | undefined;

    if (hasWebhook && job.workflow_definition?.nodes) {
      const triggerNode = job.workflow_definition.nodes.find(
        (n: { type?: string }) => n.type === "trigger",
      );
      const workflowInputs = triggerNode?.data?.workflowInputs as
        | Array<{
            name: string;
            type: string;
            required?: boolean;
            description?: string;
          }>
        | undefined;

      if (workflowInputs && workflowInputs.length > 0) {
        // Convert workflow inputs to schema format
        webhookInputSchema = {};
        for (const input of workflowInputs) {
          webhookInputSchema[input.name] = {
            type: input.type || "string",
            required: input.required || false,
            description: input.description || "",
          };
        }
      } else {
        // Default schema if no inputs defined
        webhookInputSchema = {
          payload: {
            type: "object",
            required: false,
            description: "JSON data to pass to the workflow",
          },
        };
      }
    }

    // For owners or admins: return all fields
    // For non-owners: return limited public fields
    if (isOwner || isAdmin) {
      res.json({
        job: {
          ...job,
          owner_username: ownerUsername,
          webhook_url: webhookUrl,
          webhook_input_schema: webhookInputSchema,
        },
        isOwner,
        isAdmin,
      });
    } else {
      // For non-owners: only include workflow_definition if show_workflow is true
      const showWorkflow = job.show_workflow === true;
      res.json({
        job: {
          id: job.id,
          name: job.name,
          slug: job.slug,
          description: job.description,
          network: job.network,
          workflow_definition: showWorkflow
            ? job.workflow_definition
            : job.workflow_definition,
          trigger_methods: job.trigger_methods,
          trigger_type: job.trigger_type,
          creator_markup: job.creator_markup,
          total_earnings_usdc: job.total_earnings_usdc,
          run_count: job.run_count,
          created_at: job.created_at,
          is_active: job.is_active,
          show_workflow: showWorkflow,
          owner_username: ownerUsername,
          webhook_url: webhookUrl,
          webhook_input_schema: webhookInputSchema,
        },
        isOwner: false,
        isAdmin: false,
      });
    }
  } catch (error) {
    console.error("Job view error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/view/:username/:slug - View a job by username and slug
jobsPublicRouter.get("/view/:username/:slug", async (req, res) => {
  try {
    const username = req.params.username;
    const slug = req.params.slug;

    // Optional auth - extract user ID from token if provided
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const {
          data: { user },
        } = await getSupabase().auth.getUser(token);
        userId = user?.id;
      } catch {
        // Ignore auth errors
      }
    }

    // Check if user is admin
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || [];
    const isAdmin = userId ? adminUserIds.includes(userId) : false;

    // Find user by username
    const { data: owner } = await getSupabase()
      .from("users")
      .select("id, username")
      .eq("username", username)
      .single();

    if (!owner) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find job by slug and owner
    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .select("*")
      .eq("user_id", owner.id)
      .eq("slug", slug)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const isOwner = userId === job.user_id;

    // Check if job is active (unless owner or admin)
    if (!job.is_active && !isOwner && !isAdmin) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Generate webhook URL if webhook is enabled
    const hasWebhook =
      job.trigger_methods?.webhook || job.trigger_type === "webhook";
    const webhookUrl = hasWebhook
      ? `${config.publicUrl}/@${username}/${slug}`
      : undefined;

    // Extract webhook input schema from trigger node
    let webhookInputSchema:
      | Record<string, { type: string; required: boolean; description: string }>
      | undefined;

    if (hasWebhook && job.workflow_definition?.nodes) {
      const triggerNode = job.workflow_definition.nodes.find(
        (n: { type?: string }) => n.type === "trigger",
      );
      const workflowInputs = triggerNode?.data?.workflowInputs as
        | Array<{
            name: string;
            type: string;
            required?: boolean;
            description?: string;
          }>
        | undefined;

      if (workflowInputs && workflowInputs.length > 0) {
        webhookInputSchema = {};
        for (const input of workflowInputs) {
          webhookInputSchema[input.name] = {
            type: input.type || "string",
            required: input.required || false,
            description: input.description || "",
          };
        }
      }
    }

    // For owners or admins: return all fields
    if (isOwner || isAdmin) {
      res.json({
        job: {
          ...job,
          owner_username: username,
          webhook_url: webhookUrl,
          webhook_input_schema: webhookInputSchema,
        },
        isOwner,
        isAdmin,
      });
    } else {
      // For non-owners: include show_workflow flag for frontend to decide what to show
      const showWorkflow = job.show_workflow === true;
      res.json({
        job: {
          id: job.id,
          name: job.name,
          slug: job.slug,
          description: job.description,
          network: job.network,
          workflow_definition: job.workflow_definition,
          trigger_methods: job.trigger_methods,
          trigger_type: job.trigger_type,
          creator_markup: job.creator_markup,
          created_at: job.created_at,
          is_active: job.is_active,
          show_workflow: showWorkflow,
          owner_username: username,
          webhook_url: webhookUrl,
          webhook_input_schema: webhookInputSchema,
          avatar_url: job.avatar_url,
          run_count: job.run_count || 0,
          total_earnings_usdc: job.total_earnings_usdc,
          success_count_30d: job.success_count_30d || 0,
          failure_count_30d: job.failure_count_30d || 0,
        },
        isOwner: false,
        isAdmin: false,
      });
    }
  } catch (error) {
    console.error("Job view by slug error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs - Create a new job
jobsRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      name: requestedName,
      description,
      network, // solana or base
      workflow_data, // Frontend uses this
      workflowDefinition, // Legacy field name
      triggerType,
      triggerConfig,
      outputType,
      outputConfig,
    } = req.body;

    const workflowDef = workflow_data ||
      workflowDefinition || { nodes: [], edges: [] };

    // Use provided name or generate a random one
    const finalName =
      requestedName && requestedName.trim()
        ? requestedName.trim()
        : generateRandomJobName();

    const slug = generateSlug(finalName);

    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .insert({
        user_id: userId,
        name: finalName,
        slug,
        description,
        network: network || "solana",
        workflow_definition: workflowDef,
        trigger_type: triggerType || "manual",
        trigger_config: triggerConfig || {},
        output_type: outputType || "ui",
        output_config: outputConfig || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating job:", error);
      // Check for unique constraint violation (rare slug collision)
      if (error.code === "23505") {
        return res.status(409).json({
          error: "Please try again",
          message: "A temporary conflict occurred. Please try again.",
        });
      }
      return res.status(500).json({ error: "Failed to create job" });
    }

    // Map for frontend compatibility
    const mappedJob = {
      ...job,
      workflow_data: job.workflow_definition,
    };

    res.status(201).json({ job: mappedJob });
  } catch (error) {
    console.error("Job create error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/jobs/:id - Update a job
jobsRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;
    console.log(`📝 [JOBS] PUT /${jobId} - User: ${userId}`);

    const {
      name,
      description,
      workflow_data,
      triggerType,
      triggerMethods,
      triggerConfig,
      outputType,
      outputConfig,
      creatorMarkup, // Creator's markup in USDC (e.g., 0.10 for 10 cents)
      avatarUrl, // Optional job avatar image
      scheduleConfig, // Schedule configuration { cron, timezone, enabled }
      published, // Whether job appears in public marketplace
      onSuccessJobId, // ID of job to trigger on successful completion
      showWorkflow, // Whether to show workflow publicly (default: false)
      webhookResponse, // Webhook response config { mode, template, success_message }
    } = req.body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      updateData.name = name;
      updateData.slug = generateSlug(name);
    }
    if (description !== undefined) updateData.description = description;
    if (workflow_data !== undefined) {
      // Debug: log output nodes being saved
      const outputNodes =
        workflow_data.nodes?.filter((n: any) => n.type === "output") || [];
      console.log(
        "[Jobs API] Saving output nodes - full data:",
        JSON.stringify(
          outputNodes.map((n: any) => ({ id: n.id, data: n.data })),
          null,
          2,
        ),
      );
      updateData.workflow_definition = workflow_data;
    }
    if (triggerType !== undefined) updateData.trigger_type = triggerType;
    if (triggerMethods !== undefined)
      updateData.trigger_methods = triggerMethods;
    if (triggerConfig !== undefined) updateData.trigger_config = triggerConfig;
    if (outputType !== undefined) updateData.output_type = outputType;
    if (outputConfig !== undefined) updateData.output_config = outputConfig;
    if (creatorMarkup !== undefined) updateData.creator_markup = creatorMarkup;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (published !== undefined) updateData.published = published;
    // Handle job chaining - can be set to a job ID or null to clear
    if (onSuccessJobId !== undefined)
      updateData.on_success_job_id = onSuccessJobId || null;
    // Handle workflow visibility setting
    if (showWorkflow !== undefined) updateData.show_workflow = !!showWorkflow;
    // Handle webhook response configuration
    if (webhookResponse !== undefined)
      updateData.webhook_response = webhookResponse;

    // Handle schedule configuration
    // Note: schedule_enabled is deprecated - we use trigger_methods.schedule instead
    if (scheduleConfig !== undefined) {
      updateData.schedule_cron = scheduleConfig.cron || null;
      updateData.schedule_timezone = scheduleConfig.timezone || "UTC";
      // Always clear next run time - Inngest will set a fresh one when it starts
      updateData.schedule_next_run_at = null;
    }

    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .update(updateData)
      .eq("id", jobId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !job) {
      // Check for unique constraint violation (likely slug)
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "Job URL conflict",
          message: `A job with a similar name already exists. Try a different name.`,
        });
      }
      console.log(
        `❌ [JOBS] Update failed - jobId: ${jobId}, userId: ${userId}, error:`,
        error,
      );
      return res.status(404).json({ error: "Job not found or update failed" });
    }

    console.log(`✅ [JOBS] Job updated successfully: ${jobId}`);

    // If schedule is enabled (via triggerMethods.schedule), trigger next run calculation
    const scheduleEnabled = triggerMethods?.schedule === true;
    const cronExpression = scheduleConfig?.cron || job.schedule_cron;
    let scheduleInitialized = false;

    if (scheduleEnabled && cronExpression) {
      const eventData = {
        jobId,
        cron: cronExpression,
        timezone: scheduleConfig?.timezone || job.schedule_timezone || "UTC",
      };

      // Retry sending the schedule event up to 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { inngest } = await import("../inngest");
          await inngest.send({
            name: "x402/schedule.enabled",
            data: eventData,
          });
          console.log(
            `📅 [JOBS] Schedule enabled event sent for job: ${jobId} (attempt ${attempt})`,
          );
          scheduleInitialized = true;
          break;
        } catch (scheduleError) {
          console.error(
            `❌ [JOBS] Failed to send schedule enabled event (attempt ${attempt}/3):`,
            scheduleError,
          );
          if (attempt < 3) {
            // Wait 100ms before retrying
            await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
      }

      if (!scheduleInitialized) {
        console.error(
          `❌ [JOBS] All attempts to send schedule enabled event failed for job: ${jobId}`,
        );
      }
    }

    // Map for frontend compatibility
    const mappedJob = {
      ...job,
      workflow_data: job.workflow_definition,
    };

    res.json({ job: mappedJob });
  } catch (error) {
    console.error("Job update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/jobs/:id/slug - Update job slug
jobsRouter.put("/:id/slug", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;
    const { slug } = req.body;

    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "Slug is required" });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({
        error: "Invalid slug format",
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      });
    }

    // Check if slug is unique for this user
    const { data: existingJob } = await getSupabase()
      .from("x402_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .neq("id", jobId)
      .maybeSingle();

    if (existingJob) {
      return res.status(409).json({
        error: "Slug already in use",
        message: "You already have a job with this slug",
      });
    }

    // Update the slug
    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .update({ slug, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({ job });
  } catch (error) {
    console.error("Slug update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/transfer - Transfer job ownership to another user
jobsRouter.post("/:id/transfer", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;
    const { username } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }

    // Verify the current user owns the job
    const { data: job, error: jobError } = await getSupabase()
      .from("x402_jobs")
      .select("id, name, slug, user_id")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Find the target user by username
    const { data: targetUser, error: userError } = await getSupabase()
      .from("users")
      .select("id, username")
      .eq("username", username)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({
        error: "User not found",
        message: `No user found with username "${username}"`,
      });
    }

    // Cannot transfer to self
    if (targetUser.id === userId) {
      return res.status(400).json({
        error: "Cannot transfer to yourself",
      });
    }

    // Check if target user already has a job with the same name
    const { data: conflictingJob } = await getSupabase()
      .from("x402_jobs")
      .select("id")
      .eq("user_id", targetUser.id)
      .ilike("name", job.name)
      .maybeSingle();

    if (conflictingJob) {
      return res.status(409).json({
        error: "Name conflict",
        message: `User "${username}" already has a job named "${job.name}"`,
      });
    }

    // Check if target user already has a job with the same slug
    if (job.slug) {
      const { data: slugConflict } = await getSupabase()
        .from("x402_jobs")
        .select("id")
        .eq("user_id", targetUser.id)
        .eq("slug", job.slug)
        .maybeSingle();

      if (slugConflict) {
        // Generate a new unique slug for the transferred job
        let newSlug = job.slug;
        let counter = 1;
        let isUnique = false;

        while (!isUnique) {
          newSlug = `${job.slug}-${counter}`;
          const { data: check } = await getSupabase()
            .from("x402_jobs")
            .select("id")
            .eq("user_id", targetUser.id)
            .eq("slug", newSlug)
            .maybeSingle();

          if (!check) {
            isUnique = true;
          } else {
            counter++;
          }
        }

        // Update slug before transfer
        await getSupabase()
          .from("x402_jobs")
          .update({ slug: newSlug })
          .eq("id", jobId);
      }
    }

    // Transfer ownership
    const { error: transferError } = await getSupabase()
      .from("x402_jobs")
      .update({
        user_id: targetUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (transferError) {
      console.error("Transfer error:", transferError);
      return res.status(500).json({ error: "Failed to transfer job" });
    }

    res.json({
      success: true,
      message: `Job "${job.name}" has been transferred to ${username}`,
      newOwner: {
        id: targetUser.id,
        username: targetUser.username,
      },
    });
  } catch (error) {
    console.error("Job transfer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id - Delete a job
jobsRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;

    const { error } = await getSupabase()
      .from("x402_jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting job:", error);
      return res.status(500).json({ error: "Failed to delete job" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Job delete error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/run - Execute a job
jobsRouter.post("/:id/run", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;
    const { input } = req.body;

    // Get the job
    const { data: job, error: jobError } = await getSupabase()
      .from("x402_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Create a job run record
    const { data: jobRun, error: runError } = await getSupabase()
      .from("x402_job_runs")
      .insert({
        job_id: jobId,
        user_id: userId,
        status: "pending",
        input: input || {},
      })
      .select()
      .single();

    if (runError) {
      console.error("Error creating job run:", runError);
      return res.status(500).json({ error: "Failed to start job" });
    }

    // TODO: Trigger actual job execution (queue, event, etc.)
    // For now, just return the pending run

    res.status(202).json({
      message: "Job execution started",
      runId: jobRun.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Job run error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id/runs - Get job run history
jobsRouter.get("/:id/runs", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;

    // Verify job belongs to user
    const { data: job } = await getSupabase()
      .from("x402_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const { data: runs, error } = await getSupabase()
      .from("x402_job_runs")
      .select(
        "id, status, input, output, error, total_cost_usdc, started_at, completed_at, duration_ms",
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching runs:", error);
      return res.status(500).json({ error: "Failed to fetch runs" });
    }

    res.json({ runs: runs || [] });
  } catch (error) {
    console.error("Runs fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /jobs/:id/dry-run - Validate workflow and estimate cost without executing
jobsRouter.post("/:id/dry-run", async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;

    // Verify job belongs to user
    const { data: job, error: jobError } = await getSupabase()
      .from("x402_jobs")
      .select("id, name, workflow_definition")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Import and run dry run validation
    const { dryRunService } = await import("../services/dry-run.service");
    const result = await dryRunService.validate(
      job.workflow_definition || { nodes: [], edges: [] },
    );

    res.json({
      jobId: job.id,
      jobName: job.name,
      ...result,
    });
  } catch (error) {
    console.error("Dry run error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
