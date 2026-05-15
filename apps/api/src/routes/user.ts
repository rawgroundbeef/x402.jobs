import { Router, Request, Response } from "express";
import { getSupabase } from "../lib/supabase";
import { getSolanaUsdcBalance } from "../lib/solana";
import { getBaseUsdcBalance } from "../lib/base";
import { sweepWalletsToAddress } from "../lib/wallet-sweep";
import { config } from "../config";

// HIGH-03 (Phase 28 plan 28-07): combined wallet balance above this threshold
// blocks deletion unless the caller provides `externalWithdrawalAddress` for
// auto-sweep. $0.01 absorbs gas-dust and rounding while still routing real
// balances through the explicit withdrawal flow.
const DELETE_BALANCE_GATE_USDC = 0.01;

export const userRouter: Router = Router();
export const userPublicRouter: Router = Router();

/**
 * GET /api/user/me/jobs
 * Get the current user's jobs for job chaining
 */
userRouter.get("/me/jobs", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { data: jobs, error } = await getSupabase()
      .from("x402_jobs")
      .select("id, name, price")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("User jobs fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch jobs" });
    }

    res.json({ jobs: jobs || [] });
  } catch (error) {
    console.error("User jobs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/user/profile
 * Get the current user's profile from the profiles table
 */
userRouter.get("/profile", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { data: profile, error } = await getSupabase()
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, bio, created_at, updated_at",
      )
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
      // Profile might not exist yet for OAuth users
      if (error.code === "PGRST116") {
        return res.json({
          profile: null,
          needsSetup: true,
        });
      }
      return res.status(500).json({ error: "Failed to fetch profile" });
    }

    res.json({ profile });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/user/profile
 * Update the current user's profile
 */
userRouter.put("/profile", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { username, display_name, avatar_url, bio } = req.body;

    // If updating username, validate and check availability
    if (username !== undefined) {
      const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

      if (sanitized.length < 3 || sanitized.length > 20) {
        return res.status(400).json({
          error: "Username must be 3-20 characters",
        });
      }

      // Check if username is taken by another user
      const { data: existing } = await getSupabase()
        .from("profiles")
        .select("id")
        .eq("username", sanitized)
        .neq("id", userId)
        .is("deleted_at", null)
        .single();

      if (existing) {
        return res.status(409).json({
          error: "Username is already taken",
        });
      }
    }

    // Build update object
    const updates: Record<string, string | undefined> = {};
    if (username !== undefined) {
      updates.username = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    }
    if (display_name !== undefined) {
      updates.display_name = display_name;
    }
    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
    }
    if (bio !== undefined) {
      // Limit bio to 500 characters
      updates.bio = typeof bio === "string" ? bio.slice(0, 500) : bio;
    }

    // HIGH-03: refuse to upsert into a soft-deleted profile (would silently
    // resurrect a tombstoned row without clearing deleted_at). Pre-check first.
    const { data: tombstoneCheck } = await getSupabase()
      .from("profiles")
      .select("id, deleted_at")
      .eq("id", userId)
      .maybeSingle();

    if (tombstoneCheck?.deleted_at) {
      return res.status(410).json({
        error: "account_deleted",
        message: "This account is pending deletion and cannot be updated.",
      });
    }

    // Upsert profile (create if doesn't exist)
    const { data: profile, error } = await getSupabase()
      .from("profiles")
      .upsert(
        {
          id: userId,
          ...updates,
        },
        { onConflict: "id" },
      )
      .select(
        "id, username, display_name, avatar_url, bio, created_at, updated_at",
      )
      .single();

    if (error) {
      console.error("Profile update error:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        return res.status(409).json({ error: "Username is already taken" });
      }
      return res.status(500).json({ error: "Failed to update profile" });
    }

    res.json({ profile });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/user/check-username/:username
 * Check if a username is available
 */
userRouter.get(
  "/check-username/:username",
  async (req: Request, res: Response) => {
    try {
      const username = req.params.username as string;
      const userId = req.user?.id;

      const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

      if (sanitized.length < 3 || sanitized.length > 20) {
        return res.json({
          available: false,
          reason: "Username must be 3-20 characters",
        });
      }

      // Check if username exists (soft-deleted users free their username)
      const query = getSupabase()
        .from("profiles")
        .select("id")
        .eq("username", sanitized)
        .is("deleted_at", null);

      // Exclude current user if authenticated
      if (userId) {
        query.neq("id", userId);
      }

      const { data: existing } = await query.single();

      res.json({
        available: !existing,
        sanitized,
      });
    } catch (error) {
      console.error("Username check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * DELETE /api/user/account
 *
 * HIGH-03 hardened (Phase 28 plan 28-07):
 *   1. Reads the user's wallet (Solana + Base) and sums live USDC balance.
 *   2. If combined balance > $0.01 AND no `externalWithdrawalAddress` is in
 *      the request body → 409 `wallet_has_balance` with options the caller
 *      can choose from. (No funds are touched; the user can withdraw
 *      manually or POST again with a sweep address.)
 *   3. If `externalWithdrawalAddress` is provided, the entire combined
 *      balance is swept to that address BEFORE the soft-delete. A sweep
 *      failure aborts deletion entirely (`sweep_failed` 500).
 *   4. Soft-delete is performed via the `soft_delete_user_tx` Supabase
 *      RPC — a PL/pgSQL function that wraps profile tombstone + private
 *      side-table cleanup in a single transaction. Any step failing rolls
 *      back the whole operation.
 *   5. Successful deletion sets `profiles.deleted_at = NOW()` (not a hard
 *      DELETE). The Inngest `hard-delete-stale-users` cron purges rows
 *      older than 30 days. During the recovery window the user can
 *      re-auth and request restoration.
 */
userRouter.delete("/account", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const externalAddress =
      typeof req.body?.externalWithdrawalAddress === "string"
        ? req.body.externalWithdrawalAddress.trim()
        : undefined;

    // 1) Look up the wallet (if any) and compute live balance.
    const { data: wallet } = await getSupabase()
      .from("x402_user_wallets")
      .select("address, base_address")
      .eq("user_id", userId)
      .maybeSingle();

    let combinedUsdc = 0;
    if (wallet?.address) {
      const [solanaBalance, baseBalance] = await Promise.all([
        getSolanaUsdcBalance(wallet.address),
        wallet.base_address ? getBaseUsdcBalance(wallet.base_address) : 0,
      ]);
      combinedUsdc = Number(solanaBalance) + Number(baseBalance);
    }

    // 2) Balance gate. Block if there's anything worth recovering and the
    //    caller hasn't told us where to send it.
    if (combinedUsdc > DELETE_BALANCE_GATE_USDC) {
      if (!externalAddress) {
        return res.status(409).json({
          error: "wallet_has_balance",
          balance_usdc: combinedUsdc,
          message:
            "Your wallet still holds USDC. Withdraw before deleting, or POST again with `externalWithdrawalAddress` to sweep first.",
          options: [
            {
              action: "withdraw_external",
              hint: "POST DELETE /api/user/account again with body { externalWithdrawalAddress: \"<your-address>\" } to sweep your wallet to that address before deletion.",
            },
            {
              action: "cancel",
              hint: "Do not delete. Use /wallet/export-key to move funds manually first.",
            },
          ],
        });
      }

      // 3) Sweep funds before deletion. Any error here aborts; we do NOT
      //    proceed to soft-delete with funds still in the wallet.
      try {
        await sweepWalletsToAddress(userId, externalAddress);
      } catch (sweepErr) {
        console.error(
          `[user/delete] sweep failed for user ${userId.slice(0, 8)}:`,
          sweepErr,
        );
        return res.status(500).json({
          error: "sweep_failed",
          message:
            sweepErr instanceof Error
              ? sweepErr.message
              : "Wallet sweep failed; deletion aborted.",
        });
      }
    }

    // 4) Transactional soft-delete via Supabase RPC. PL/pgSQL function body
    //    runs inside an implicit transaction — any RAISE inside the function
    //    rolls back every UPDATE/DELETE it issued.
    const { error: rpcErr } = await getSupabase().rpc("soft_delete_user_tx", {
      p_user_id: userId,
    });

    if (rpcErr) {
      console.error(
        `[user/delete] soft_delete_user_tx failed for user ${userId.slice(0, 8)}:`,
        rpcErr,
      );
      return res.status(500).json({ error: "delete_failed" });
    }

    console.log(`✅ Account soft-deleted: ${userId.slice(0, 8)}…`);

    return res.status(200).json({ ok: true, recoveryWindowDays: 30 });
  } catch (error) {
    console.error("Account deletion error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/user/email
 * Update the current user's email (requires verification)
 */
userRouter.put("/email", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Update email via Supabase Auth Admin API
    const { error } = await getSupabase().auth.admin.updateUserById(userId, {
      email: email.trim(),
    });

    if (error) {
      console.error("Email update error:", error);
      if (error.message.includes("already registered")) {
        return res.status(409).json({
          error: "This email is already associated with another account",
        });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Email update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/user/password
 * Update the current user's password
 */
userRouter.put("/password", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { password } = req.body;

    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Update password via Supabase Auth Admin API
    const { error } = await getSupabase().auth.admin.updateUserById(userId, {
      password,
    });

    if (error) {
      console.error("Password update error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/user/resources
 * Get the current user's x402 resources (both external and instant)
 */
userRouter.get("/resources", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's username for computing instant resource URLs
    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    const username = profile?.username;

    // Get resources where user is the registered_by or verified_owner
    const { data: resources, error } = await getSupabase()
      .from("x402_resources")
      .select(
        `
        id,
        slug,
        name,
        description,
        resource_url,
        network,
        max_amount_required,
        resource_type,
        call_count,
        total_earned_usdc,
        is_active,
        created_at,
        avatar_url,
        category,
        server:x402_servers(slug, name, is_hosted, favicon_url),
        pt_system_prompt,
        pt_parameters,
        pt_model,
        pt_max_tokens,
        pt_allows_user_message
      `,
      )
      .or(`registered_by.eq.${userId},verified_owner_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("User resources fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch resources" });
    }

    // Process resources: compute URLs and avatar fallbacks
    const processedResources = (resources || []).map((r: any) => {
      const result = { ...r };

      // For hosted (instant) resources, compute the URL dynamically
      if (r.server?.is_hosted && username) {
        result.resource_url = `${config.publicUrl}/@${username}/${r.slug}`;
      }

      // Compute avatar_url with server favicon fallback
      result.avatar_url = r.avatar_url || r.server?.favicon_url || null;

      // Compute price_usdc from max_amount_required (which is the source of truth)
      result.price_usdc = r.max_amount_required
        ? (parseFloat(r.max_amount_required) / 1_000_000).toString()
        : "0";

      return result;
    });

    res.json({ resources: processedResources });
  } catch (error) {
    console.error("User resources error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/user/public/:username
 * Get a user's public profile by username (no auth required)
 * Returns profile info + their published jobs
 */
userPublicRouter.get(
  "/public/:username",
  async (req: Request, res: Response) => {
    try {
      const username = req.params.username as string;

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

      // Fetch profile (soft-deleted users return 404 to public callers)
      const { data: profile, error: profileError } = await getSupabase()
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, created_at")
        .eq("username", sanitized)
        .is("deleted_at", null)
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          return res.status(404).json({ error: "User not found" });
        }
        console.error("Profile fetch error:", profileError);
        return res.status(500).json({ error: "Failed to fetch profile" });
      }

      // Fetch user's published jobs (webhook-enabled and published = true)
      const { data: jobs, error: jobsError } = await getSupabase()
        .from("x402_jobs")
        .select(
          `
        id,
        display_id,
        name,
        slug,
        description,
        avatar_url,
        run_count,
        created_at,
        trigger_methods,
        creator_markup,
        workflow_definition,
        total_earnings_usdc
      `,
        )
        .eq("user_id", profile.id)
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (jobsError) {
        console.error("Jobs fetch error:", jobsError);
      }

      // Fetch user's owned servers (including personal hosted server)
      const { data: servers, error: serversError } = await getSupabase()
        .from("x402_servers")
        .select(
          "id, slug, name, origin_url, favicon_url, description, resource_count, total_calls, total_earned_usdc, is_hosted",
        )
        .eq("verified_owner_id", profile.id)
        .order("resource_count", { ascending: false });

      if (serversError) {
        console.error("Servers fetch error:", serversError);
      }

      // Also fetch the user's personal hosted server (@{username}) if not already owned
      const personalServerSlug = `@${sanitized}`;
      let personalServer: any = null;
      const serverSlugs = (servers || []).map((s) => s.slug);
      if (!serverSlugs.includes(personalServerSlug)) {
        const { data: pServer } = await getSupabase()
          .from("x402_servers")
          .select(
            "id, slug, name, origin_url, favicon_url, description, resource_count, total_calls, total_earned_usdc, is_hosted",
          )
          .eq("slug", personalServerSlug)
          .eq("is_hosted", true)
          .single();

        if (pServer) {
          personalServer = pServer;
        }
      }

      // Combine servers - personal server first, labeled as @username
      // Use user's avatar for the personal server
      const allServers = [
        ...(personalServer
          ? [
              {
                ...personalServer,
                name: `@${sanitized}`,
                slug: personalServerSlug,
                favicon_url: profile.avatar_url || personalServer.favicon_url,
              },
            ]
          : []),
        ...(servers || []),
      ];

      // Fetch resources from owned servers AND resources registered by user
      const serverIds = allServers.map((s) => s.id);
      let resources: any[] = [];

      // Get resources from owned servers
      if (serverIds.length > 0) {
        const { data: serverResources, error: resourcesError } =
          await getSupabase()
            .from("x402_resources")
            .select(
              `id, slug, name, description, resource_url, network, max_amount_required, avatar_url, call_count,
             server:x402_servers(id, slug, name, favicon_url, is_hosted)`,
            )
            .in("server_id", serverIds)
            .eq("is_active", true)
            .order("call_count", { ascending: false })
            .limit(10);

        if (resourcesError) {
          console.error("Resources fetch error:", resourcesError);
        } else {
          resources = serverResources || [];
        }
      }

      // Also fetch resources directly registered by this user (in case they're on other servers)
      const { data: registeredResources } = await getSupabase()
        .from("x402_resources")
        .select(
          `id, slug, name, description, resource_url, network, max_amount_required, avatar_url, call_count,
           server:x402_servers(id, slug, name, favicon_url, is_hosted)`,
        )
        .eq("registered_by", profile.id)
        .eq("is_active", true)
        .order("call_count", { ascending: false })
        .limit(10);

      // Merge and dedupe resources
      if (registeredResources) {
        const existingIds = new Set(resources.map((r) => r.id));
        for (const r of registeredResources) {
          if (!existingIds.has(r.id)) {
            resources.push(r);
          }
        }
      }

      // Calculate total resources
      const totalResources =
        allServers.reduce((sum, s) => sum + (s.resource_count || 0), 0) +
        (registeredResources || []).filter(
          (r: any) => !serverIds.includes(r.server?.id),
        ).length;

      // Calculate total earnings (from jobs and servers/resources)
      // Job owners earn their creator_markup per run, NOT the total_cost (which is volume)
      const jobEarnings = (jobs || []).reduce((sum, j) => {
        const markup = parseFloat(j.creator_markup) || 0;
        const runs = j.run_count || 0;
        return sum + markup * runs;
      }, 0);
      // Server/resource owners earn from their resources
      const serverEarnings = allServers.reduce(
        (sum, s) => sum + (parseFloat(s.total_earned_usdc) || 0),
        0,
      );
      const totalEarnings = jobEarnings + serverEarnings;

      // Filter to only webhook-enabled jobs and calculate prices
      // Platform fee is 1.5% of resource cost (minimum $0.01)
      const publicJobs = (jobs || [])
        .filter((job) => job.trigger_methods?.webhook === true)
        .map((job) => {
          // Calculate price from resources - match the calculation in webhooks.ts
          const nodes = job.workflow_definition?.nodes || [];
          const resourceNodes = nodes.filter((n: any) => n.type === "resource");
          const resourcesCost = resourceNodes.reduce((sum: number, n: any) => {
            // Access price via node.data.resource.price (same as webhooks.ts calculateJobPrice)
            const resource = n.data?.resource || n.data;
            const price = resource?.price || 0;
            return sum + price;
          }, 0);

          const markup = parseFloat(job.creator_markup) || 0;
          // Platform fee = 1.5% of resource cost (minimum $0.01)
          const platformFee = Math.max(
            resourcesCost * config.platformFee.percentage,
            config.platformFee.minimumUsdc,
          );
          const totalPrice = resourcesCost + platformFee + markup;

          return {
            id: job.id,
            display_id: job.display_id,
            name: job.name,
            slug: job.slug,
            description: job.description,
            avatar_url: job.avatar_url,
            run_count: job.run_count || 0,
            created_at: job.created_at,
            price: totalPrice,
          };
        });

      // For resources on hosted servers, rewrite the server_slug to @username format
      // and use user's avatar as server favicon
      const formattedResources = resources.map((r) => {
        const isHosted = r.server?.is_hosted;
        const serverSlug = isHosted ? `@${sanitized}` : r.server?.slug;
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          description: r.description,
          resource_url: r.resource_url,
          network: r.network,
          max_amount_required: r.max_amount_required,
          avatar_url: r.avatar_url,
          call_count: r.call_count || 0,
          server_slug: serverSlug,
          server_name: isHosted ? `@${sanitized}` : r.server?.name,
          server_favicon: isHosted
            ? profile.avatar_url || r.server?.favicon_url
            : r.server?.favicon_url,
        };
      });

      res.json({
        profile: {
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          created_at: profile.created_at,
        },
        jobs: publicJobs,
        servers: allServers,
        resources: formattedResources,
        stats: {
          jobCount: publicJobs.length,
          serverCount: allServers.length,
          resourceCount: totalResources,
          totalEarnings: totalEarnings,
        },
      });
    } catch (error) {
      console.error("Public profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/user/public/:username/resources - Get user's resources with pagination/search/sort
userPublicRouter.get(
  "/public/:username/resources",
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const {
        search,
        sort = "popular",
        limit = "25",
        offset = "0",
      } = req.query as Record<string, string>;

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const limitNum = Math.min(parseInt(limit) || 25, 100);
      const offsetNum = parseInt(offset) || 0;

      // Fetch profile to get user ID and avatar (skip soft-deleted users)
      const { data: profile, error: profileError } = await getSupabase()
        .from("profiles")
        .select("id, avatar_url")
        .eq("username", sanitized)
        .is("deleted_at", null)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get servers owned by this user
      const { data: servers } = await getSupabase()
        .from("x402_servers")
        .select("id, is_hosted")
        .eq("verified_owner_id", profile.id);

      // Also get user's personal hosted server
      const personalServerSlug = `@${sanitized}`;
      const { data: personalServer } = await getSupabase()
        .from("x402_servers")
        .select("id, is_hosted")
        .eq("slug", personalServerSlug)
        .eq("is_hosted", true)
        .single();

      const allServerIds = [
        ...(servers || []).map((s) => s.id),
        ...(personalServer && !servers?.find((s) => s.id === personalServer.id)
          ? [personalServer.id]
          : []),
      ];

      // Fetch resources from owned servers OR registered by user
      let allResources: any[] = [];

      if (allServerIds.length > 0) {
        const { data: serverResources } = await getSupabase()
          .from("x402_resources")
          .select(
            `id, slug, name, description, resource_url, network, max_amount_required, avatar_url, call_count, created_at,
             server:x402_servers(id, slug, name, favicon_url, is_hosted)`,
          )
          .in("server_id", allServerIds)
          .eq("is_active", true);

        allResources = serverResources || [];
      }

      // Also fetch resources registered by this user
      const { data: registeredResources } = await getSupabase()
        .from("x402_resources")
        .select(
          `id, slug, name, description, resource_url, network, max_amount_required, avatar_url, call_count, created_at,
           server:x402_servers(id, slug, name, favicon_url, is_hosted)`,
        )
        .eq("registered_by", profile.id)
        .eq("is_active", true);

      // Merge and dedupe
      if (registeredResources) {
        const existingIds = new Set(allResources.map((r) => r.id));
        for (const r of registeredResources) {
          if (!existingIds.has(r.id)) {
            allResources.push(r);
          }
        }
      }

      // Cast to any[] to handle Supabase's nested relation typing
      let filtered: any[] = allResources;

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.name?.toLowerCase().includes(searchLower) ||
            r.description?.toLowerCase().includes(searchLower) ||
            r.slug?.toLowerCase().includes(searchLower) ||
            r.server?.name?.toLowerCase().includes(searchLower),
        );
      }

      // Apply sorting
      switch (sort) {
        case "latest":
          filtered.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
          break;
        case "price_low":
          filtered.sort(
            (a, b) =>
              parseFloat(a.max_amount_required || "0") -
              parseFloat(b.max_amount_required || "0"),
          );
          break;
        case "price_high":
          filtered.sort(
            (a, b) =>
              parseFloat(b.max_amount_required || "0") -
              parseFloat(a.max_amount_required || "0"),
          );
          break;
        case "popular":
        default:
          filtered.sort((a, b) => (b.call_count || 0) - (a.call_count || 0));
          break;
      }

      const totalCount = filtered.length;

      // Apply pagination
      const paginated = filtered.slice(offsetNum, offsetNum + limitNum);

      // Transform response - use @username for hosted servers
      const resources = paginated.map((r) => {
        const isHosted = r.server?.is_hosted;
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          description: r.description,
          resource_url: r.resource_url,
          network: r.network,
          max_amount_required: r.max_amount_required,
          avatar_url: r.avatar_url,
          call_count: r.call_count || 0,
          server_slug: isHosted ? `@${sanitized}` : r.server?.slug,
          server_name: isHosted ? `@${sanitized}` : r.server?.name,
          server_favicon: isHosted
            ? profile.avatar_url || r.server?.favicon_url
            : r.server?.favicon_url,
        };
      });

      res.json({
        resources,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < totalCount,
        },
      });
    } catch (error) {
      console.error("User resources error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/user/public/:username/jobs - Get user's jobs with pagination/search/sort
userPublicRouter.get(
  "/public/:username/jobs",
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const {
        search,
        sort = "earnings",
        limit = "25",
        offset = "0",
      } = req.query as Record<string, string>;

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const limitNum = Math.min(parseInt(limit) || 25, 100);
      const offsetNum = parseInt(offset) || 0;

      // Fetch profile to get user ID (skip soft-deleted users)
      const { data: profile, error: profileError } = await getSupabase()
        .from("profiles")
        .select("id, username")
        .eq("username", sanitized)
        .is("deleted_at", null)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch user's published jobs
      const { data: allJobs, error: jobsError } = await getSupabase()
        .from("x402_jobs")
        .select(
          `
          id,
          display_id,
          name,
          slug,
          description,
          avatar_url,
          run_count,
          created_at,
          trigger_methods,
          creator_markup,
          workflow_definition,
          total_earnings_usdc
        `,
        )
        .eq("user_id", profile.id)
        .eq("published", true);

      if (jobsError) {
        console.error("Jobs fetch error:", jobsError);
        return res.status(500).json({ error: "Failed to fetch jobs" });
      }

      // Filter to only webhook-enabled jobs
      let filtered = (allJobs || []).filter(
        (job) => job.trigger_methods?.webhook === true,
      );

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (job) =>
            job.name?.toLowerCase().includes(searchLower) ||
            job.description?.toLowerCase().includes(searchLower) ||
            job.slug?.toLowerCase().includes(searchLower),
        );
      }

      // Calculate prices and earnings for all jobs
      const jobsWithPrices = filtered.map((job) => {
        const nodes = job.workflow_definition?.nodes || [];
        const resourceNodes = nodes.filter((n: any) => n.type === "resource");
        const resourcesCost = resourceNodes.reduce((sum: number, n: any) => {
          const resource = n.data?.resource || n.data;
          const price = resource?.price || 0;
          return sum + price;
        }, 0);

        const markup = parseFloat(job.creator_markup) || 0;
        const platformFee = Math.max(
          resourcesCost * config.platformFee.percentage,
          config.platformFee.minimumUsdc,
        );
        const totalPrice = resourcesCost + platformFee + markup;
        const runCount = job.run_count || 0;
        // Total earnings from database (matches what's displayed on main jobs page)
        const totalEarnings = parseFloat(job.total_earnings_usdc) || 0;

        return {
          id: job.id,
          display_id: job.display_id,
          name: job.name,
          slug: job.slug,
          description: job.description,
          avatar_url: job.avatar_url,
          run_count: runCount,
          created_at: job.created_at,
          price: totalPrice,
          earnings: totalEarnings,
        };
      });

      // Apply sorting
      switch (sort) {
        case "latest":
          jobsWithPrices.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
          break;
        case "price_low":
          jobsWithPrices.sort((a, b) => a.price - b.price);
          break;
        case "price_high":
          jobsWithPrices.sort((a, b) => b.price - a.price);
          break;
        case "popular":
          jobsWithPrices.sort(
            (a, b) => (b.run_count || 0) - (a.run_count || 0),
          );
          break;
        case "earnings":
        default:
          // Default to highest earning (total_earnings_usdc from DB)
          jobsWithPrices.sort((a, b) => b.earnings - a.earnings);
          break;
      }

      const totalCount = jobsWithPrices.length;

      // Apply pagination
      const paginated = jobsWithPrices.slice(offsetNum, offsetNum + limitNum);

      res.json({
        jobs: paginated,
        username: profile.username,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < totalCount,
        },
      });
    } catch (error) {
      console.error("User jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
