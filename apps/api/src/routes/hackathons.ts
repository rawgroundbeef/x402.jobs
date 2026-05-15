import { Router, Request, Response, type Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";
import { authMiddleware } from "../middleware/auth";
import { createNotification } from "../services/notifications.service";

const router: RouterType = Router();

interface Hackathon {
  id: string;
  slug: string;
  name: string;
  number: number | null; // Sequential hackathon number (1, 2, 3...)
  description: string | null;
  rules: string | null;
  judging_criteria: string | null;
  prize: number; // Single winner-take-all prize
  prizes?: { first: number; second: number; third: number }; // Legacy field
  starts_at: string;
  ends_at: string;
  resolved_at: string | null; // When winner was selected
  status: "upcoming" | "active" | "judging" | "complete";
  created_at: string;
}

interface Sponsor {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  x_url: string | null;
  telegram_url: string | null;
}

interface HackathonSponsor extends Sponsor {
  contribution_amount: number;
  display_order: number;
}

interface Submission {
  id: string;
  hackathon_id: string;
  user_id: string;
  job_id: string;
  x_post_url: string | null;
  submitted_at: string;
  submitter_username?: string;
  job?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    avatar_url: string | null;
    run_count: number;
    total_earnings_usdc: string;
    owner_username?: string;
  };
}

interface Winner {
  id: string;
  hackathon_id: string;
  submission_id: string;
  place: number; // Default 1 for winner-take-all
  prize_amount: number;
  awarded_at: string;
  submission?: Submission;
}

// GET /hackathons - List all hackathons
router.get("/", async (req: Request, res: Response) => {
  try {
    const { data: hackathons, error } = await getSupabase()
      .from("x402_hackathons")
      .select("*")
      .order("ends_at", { ascending: false });

    if (error) {
      console.error("Error fetching hackathons:", error);
      return res.status(500).json({ error: "Failed to fetch hackathons" });
    }

    // Get submission counts for each hackathon
    const hackathonIds = (hackathons || []).map((h: Hackathon) => h.id);
    const { data: submissionCounts } = await getSupabase()
      .from("x402_hackathon_submissions")
      .select("hackathon_id")
      .in("hackathon_id", hackathonIds);

    const countMap: Record<string, number> = {};
    (submissionCounts || []).forEach((s: { hackathon_id: string }) => {
      countMap[s.hackathon_id] = (countMap[s.hackathon_id] || 0) + 1;
    });

    // Get winners for completed hackathons
    const completedIds = (hackathons || [])
      .filter((h: Hackathon) => h.status === "complete")
      .map((h: Hackathon) => h.id);

    const winnersMap: Record<string, Winner[]> = {};
    if (completedIds.length > 0) {
      const { data: winners } = await getSupabase()
        .from("x402_hackathon_winners")
        .select(
          `
          *,
          submission:x402_hackathon_submissions(
            id,
            user_id,
            job_id,
            x_post_url,
            job:x402_jobs(
              id, name, slug, description, avatar_url, run_count, total_earnings_usdc, user_id
            )
          )
        `,
        )
        .in("hackathon_id", completedIds)
        .order("place", { ascending: true });

      // Get usernames for winner job owners
      const winnerJobOwnerIds = [
        ...new Set(
          (winners || [])
            .map((w: any) => w.submission?.job?.user_id)
            .filter(Boolean),
        ),
      ];
      const winnerOwnerUsernames: Record<string, string> = {};

      if (winnerJobOwnerIds.length > 0) {
        const { data: owners } = await getSupabase()
          .from("users")
          .select("id, username")
          .in("id", winnerJobOwnerIds);

        (owners || []).forEach((u: { id: string; username: string }) => {
          if (u.username) winnerOwnerUsernames[u.id] = u.username;
        });
      }

      // Get usernames for winner submitters
      const winnerSubmitterIds = [
        ...new Set(
          (winners || [])
            .map((w: any) => w.submission?.user_id)
            .filter(Boolean),
        ),
      ];
      const winnerSubmitterUsernames: Record<string, string> = {};

      if (winnerSubmitterIds.length > 0) {
        const { data: submitters } = await getSupabase()
          .from("users")
          .select("id, username")
          .in("id", winnerSubmitterIds);

        (submitters || []).forEach((u: { id: string; username: string }) => {
          if (u.username) winnerSubmitterUsernames[u.id] = u.username;
        });
      }

      (winners || []).forEach((w: any) => {
        if (!winnersMap[w.hackathon_id]) {
          winnersMap[w.hackathon_id] = [];
        }
        const job = w.submission?.job;
        if (job) {
          job.owner_username = winnerOwnerUsernames[job.user_id] || "unknown";
        }
        if (w.submission) {
          w.submission.submitter_username =
            winnerSubmitterUsernames[w.submission.user_id] || "unknown";
        }
        winnersMap[w.hackathon_id]!.push(w);
      });
    }

    // Get sponsors for all hackathons
    const sponsorsMap: Record<string, HackathonSponsor[]> = {};
    if (hackathonIds.length > 0) {
      const { data: hackathonSponsors } = await getSupabase()
        .from("x402_hackathon_sponsors")
        .select(
          `
          hackathon_id,
          contribution_amount,
          display_order,
          sponsor:x402_sponsors(*)
        `,
        )
        .in("hackathon_id", hackathonIds)
        .order("display_order", { ascending: true });

      (hackathonSponsors || []).forEach((hs: any) => {
        if (!sponsorsMap[hs.hackathon_id]) {
          sponsorsMap[hs.hackathon_id] = [];
        }
        if (hs.sponsor) {
          sponsorsMap[hs.hackathon_id]!.push({
            ...hs.sponsor,
            contribution_amount: hs.contribution_amount || 0,
            display_order: hs.display_order || 0,
          });
        }
      });
    }

    const result = (hackathons || []).map((h: Hackathon) => {
      // Calculate prize from new field or legacy prizes field
      const prize =
        h.prize ||
        (h.prizes ? h.prizes.first + h.prizes.second + h.prizes.third : 0);

      return {
        ...h,
        prize, // Include computed prize
        submissionCount: countMap[h.id] || 0,
        winners: winnersMap[h.id] || [],
        sponsors: sponsorsMap[h.id] || [],
      };
    });

    res.json({ hackathons: result });
  } catch (error) {
    console.error("Error in hackathons list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /hackathons/active - Get the currently active hackathon (for homepage banner)
router.get("/active", async (req: Request, res: Response) => {
  try {
    // Simple query: find hackathon with status 'active'
    const { data: hackathons, error } = await getSupabase()
      .from("x402_hackathons")
      .select("*")
      .eq("status", "active")
      .order("ends_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Error fetching active hackathon:", error);
      return res.status(500).json({ error: "Failed to fetch hackathon" });
    }

    const hackathon = hackathons?.[0] || null;

    // Get sponsors if hackathon exists
    let sponsors: HackathonSponsor[] = [];
    if (hackathon) {
      const { data: hackathonSponsors } = await getSupabase()
        .from("x402_hackathon_sponsors")
        .select(
          `
          contribution_amount,
          display_order,
          sponsor:x402_sponsors(*)
        `,
        )
        .eq("hackathon_id", hackathon.id)
        .order("display_order", { ascending: true });

      sponsors = (hackathonSponsors || [])
        .filter((hs: any) => hs.sponsor)
        .map((hs: any) => ({
          ...hs.sponsor,
          contribution_amount: hs.contribution_amount || 0,
          display_order: hs.display_order || 0,
        }));
    }

    res.json({
      hackathon: hackathon ? { ...hackathon, sponsors } : null,
    });
  } catch (error) {
    console.error("Error in active hackathon:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /hackathons/:slug - Get single hackathon with submissions
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

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

    // Get hackathon
    const { data: hackathon, error: hackathonError } = await getSupabase()
      .from("x402_hackathons")
      .select("*")
      .eq("slug", slug)
      .single();

    if (hackathonError) {
      if (hackathonError.code === "PGRST116") {
        return res.status(404).json({ error: "Hackathon not found" });
      }
      console.error("Error fetching hackathon:", hackathonError);
      return res.status(500).json({ error: "Failed to fetch hackathon" });
    }

    // Get submissions with job details and URL fields
    const { data: submissions, error: submissionsError } = await getSupabase()
      .from("x402_hackathon_submissions")
      .select(
        `
        id,
        hackathon_id,
        user_id,
        job_id,
        x_post_url,
        submitted_at,
        job:x402_jobs(
          id, name, slug, description, avatar_url, run_count, total_earnings_usdc, user_id
        )
      `,
      )
      .eq("hackathon_id", hackathon.id)
      .order("submitted_at", { ascending: false });

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
    }

    // Get usernames for job owners
    const jobOwnerIds = [
      ...new Set(
        (submissions || []).map((s: any) => s.job?.user_id).filter(Boolean),
      ),
    ];
    const ownerUsernames: Record<string, string> = {};

    if (jobOwnerIds.length > 0) {
      const { data: owners } = await getSupabase()
        .from("users")
        .select("id, username")
        .in("id", jobOwnerIds);

      (owners || []).forEach((u: { id: string; username: string }) => {
        if (u.username) ownerUsernames[u.id] = u.username;
      });
    }

    // Get usernames for submitters
    const submitterIds = [
      ...new Set(
        (submissions || []).map((s: any) => s.user_id).filter(Boolean),
      ),
    ];
    const submitterUsernames: Record<string, string> = {};

    if (submitterIds.length > 0) {
      const { data: submitters } = await getSupabase()
        .from("users")
        .select("id, username")
        .in("id", submitterIds);

      (submitters || []).forEach((u: { id: string; username: string }) => {
        if (u.username) submitterUsernames[u.id] = u.username;
      });
    }

    // Format submissions with owner username and submitter username
    const formattedSubmissions = (submissions || []).map((s: any) => {
      const job = s.job as any;
      return {
        ...s,
        submitter_username: submitterUsernames[s.user_id] || "unknown",
        job: job
          ? {
              ...job,
              owner_username: ownerUsernames[job.user_id] || "unknown",
            }
          : null,
      };
    });

    // Get winners if complete
    let winners: Winner[] = [];
    if (hackathon.status === "complete") {
      const { data: winnersData } = await getSupabase()
        .from("x402_hackathon_winners")
        .select(
          `
          *,
          submission:x402_hackathon_submissions(
            id,
            user_id,
            job_id,
            x_post_url,
            job:x402_jobs(
              id, name, slug, description, avatar_url, run_count, total_earnings_usdc, user_id
            )
          )
        `,
        )
        .eq("hackathon_id", hackathon.id)
        .order("place", { ascending: true });

      // Get usernames for winner job owners
      const winnerJobOwnerIds = [
        ...new Set(
          (winnersData || [])
            .map((w: any) => w.submission?.job?.user_id)
            .filter(Boolean),
        ),
      ];

      if (winnerJobOwnerIds.length > 0) {
        const { data: winnerOwners } = await getSupabase()
          .from("users")
          .select("id, username")
          .in("id", winnerJobOwnerIds);

        (winnerOwners || []).forEach((u: { id: string; username: string }) => {
          if (u.username) ownerUsernames[u.id] = u.username;
        });
      }

      // Get usernames for winner submitters
      const winnerSubmitterIds = [
        ...new Set(
          (winnersData || [])
            .map((w: any) => w.submission?.user_id)
            .filter(Boolean),
        ),
      ];

      if (winnerSubmitterIds.length > 0) {
        const { data: winnerSubmitters } = await getSupabase()
          .from("users")
          .select("id, username")
          .in("id", winnerSubmitterIds);

        (winnerSubmitters || []).forEach(
          (u: { id: string; username: string }) => {
            if (u.username) submitterUsernames[u.id] = u.username;
          },
        );
      }

      winners = (winnersData || []).map((w: any) => {
        const submission = w.submission as any;
        const job = submission?.job;
        return {
          ...w,
          submission: submission
            ? {
                ...submission,
                submitter_username:
                  submitterUsernames[submission.user_id] || "unknown",
                job: job
                  ? {
                      ...job,
                      owner_username: ownerUsernames[job.user_id] || "unknown",
                    }
                  : null,
              }
            : null,
        };
      });
    }

    // Calculate prize from new field or legacy prizes field
    const prize =
      hackathon.prize ||
      (hackathon.prizes
        ? hackathon.prizes.first +
          hackathon.prizes.second +
          hackathon.prizes.third
        : 0);

    // Get sponsors for this hackathon
    const { data: hackathonSponsors } = await getSupabase()
      .from("x402_hackathon_sponsors")
      .select(
        `
        contribution_amount,
        display_order,
        sponsor:x402_sponsors(*)
      `,
      )
      .eq("hackathon_id", hackathon.id)
      .order("display_order", { ascending: true });

    const sponsors: HackathonSponsor[] = (hackathonSponsors || [])
      .filter((hs: any) => hs.sponsor)
      .map((hs: any) => ({
        ...hs.sponsor,
        contribution_amount: hs.contribution_amount || 0,
        display_order: hs.display_order || 0,
      }));

    res.json({
      hackathon: {
        ...hackathon,
        prize, // Include computed prize
        sponsors, // Include sponsors
      },
      submissions: formattedSubmissions,
      winners,
      submissionCount: formattedSubmissions.length,
      isAdmin, // Include admin status
    });
  } catch (error) {
    console.error("Error in hackathon detail:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /hackathons/:slug/submit - Submit job to hackathon with URLs
router.post(
  "/:slug/submit",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const { jobId, xPostUrl } = req.body;
      const userId = req.user!.id;

      // Validate required fields
      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }
      if (!xPostUrl) {
        return res.status(400).json({
          error: "X post URL with video demo is required",
        });
      }

      // Validate X post URL format
      const isValidXUrl =
        xPostUrl.startsWith("https://x.com/") ||
        xPostUrl.startsWith("https://twitter.com/");
      if (!isValidXUrl) {
        return res.status(400).json({
          error: "X post URL must be from x.com or twitter.com",
        });
      }

      // Get hackathon
      const { data: hackathon, error: hackathonError } = await getSupabase()
        .from("x402_hackathons")
        .select("*")
        .eq("slug", slug)
        .single();

      if (hackathonError || !hackathon) {
        return res.status(404).json({ error: "Hackathon not found" });
      }

      // Check if hackathon is active
      if (hackathon.status !== "active") {
        return res
          .status(400)
          .json({ error: "Hackathon is not accepting submissions" });
      }

      // Check deadline (only if hackathon has a deadline set)
      if (hackathon.ends_at && new Date() > new Date(hackathon.ends_at)) {
        return res
          .status(400)
          .json({ error: "Submission deadline has passed" });
      }

      // Verify job belongs to user and is public
      const { data: job, error: jobError } = await getSupabase()
        .from("x402_jobs")
        .select("id, name, published, trigger_methods, user_id")
        .eq("id", jobId)
        .single();

      if (jobError || !job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "You can only submit your own jobs" });
      }

      if (!job.published || !job.trigger_methods?.webhook) {
        return res
          .status(400)
          .json({ error: "Job must be public with webhook trigger" });
      }

      // Upsert submission (allows changing submission)
      const { data: submission, error: submitError } = await getSupabase()
        .from("x402_hackathon_submissions")
        .upsert(
          {
            hackathon_id: hackathon.id,
            user_id: userId,
            job_id: jobId,
            x_post_url: xPostUrl,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "hackathon_id,user_id",
          },
        )
        .select()
        .single();

      if (submitError) {
        console.error("Error submitting:", submitError);
        return res.status(500).json({ error: "Failed to submit" });
      }

      res.json({ submission, message: "Successfully submitted!" });
    } catch (error) {
      console.error("Error in submit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// DELETE /hackathons/:slug/submit - Withdraw submission
router.delete(
  "/:slug/submit",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const userId = req.user!.id;

      // Get hackathon
      const { data: hackathon, error: hackathonError } = await getSupabase()
        .from("x402_hackathons")
        .select("id, status, ends_at")
        .eq("slug", slug)
        .single();

      if (hackathonError || !hackathon) {
        return res.status(404).json({ error: "Hackathon not found" });
      }

      // Check if still active
      if (hackathon.status !== "active") {
        return res
          .status(400)
          .json({ error: "Cannot withdraw after hackathon ends" });
      }

      // Delete submission
      const { error: deleteError } = await getSupabase()
        .from("x402_hackathon_submissions")
        .delete()
        .eq("hackathon_id", hackathon.id)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Error withdrawing:", deleteError);
        return res.status(500).json({ error: "Failed to withdraw" });
      }

      res.json({ message: "Submission withdrawn" });
    } catch (error) {
      console.error("Error in withdraw:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /hackathons/:slug/my-submission - Get current user's submission
router.get(
  "/:slug/my-submission",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const userId = req.user!.id;

      // Get hackathon
      const { data: hackathon } = await getSupabase()
        .from("x402_hackathons")
        .select("id")
        .eq("slug", slug)
        .single();

      if (!hackathon) {
        return res.status(404).json({ error: "Hackathon not found" });
      }

      // Get user's submission
      const { data: submission } = await getSupabase()
        .from("x402_hackathon_submissions")
        .select(
          `
          *,
          job:x402_jobs(id, name, slug, description, avatar_url)
        `,
        )
        .eq("hackathon_id", hackathon.id)
        .eq("user_id", userId)
        .single();

      res.json({ submission: submission || null });
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /hackathons/:slug/winner - Select winner (admin only)
router.post(
  "/:slug/winner",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const { submissionId } = req.body;
      const userId = req.user!.id;

      // Check if user is admin
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || [];
      if (!adminUserIds.includes(userId)) {
        return res.status(403).json({ error: "Unauthorized - admin only" });
      }

      if (!submissionId) {
        return res.status(400).json({ error: "Submission ID is required" });
      }

      // Get hackathon
      const { data: hackathon, error: hackathonError } = await getSupabase()
        .from("x402_hackathons")
        .select("*")
        .eq("slug", slug)
        .single();

      if (hackathonError || !hackathon) {
        return res.status(404).json({ error: "Hackathon not found" });
      }

      // Check if hackathon already has a winner
      const { data: existingWinner } = await getSupabase()
        .from("x402_hackathon_winners")
        .select("id")
        .eq("hackathon_id", hackathon.id)
        .single();

      if (existingWinner) {
        return res.status(400).json({ error: "Winner already selected" });
      }

      // Get submission
      const { data: submission, error: submissionError } = await getSupabase()
        .from("x402_hackathon_submissions")
        .select(
          `
          *,
          job:x402_jobs(id, name, slug, owner:profiles(username))
        `,
        )
        .eq("id", submissionId)
        .eq("hackathon_id", hackathon.id)
        .single();

      if (submissionError || !submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Calculate prize amount
      const prizeAmount =
        hackathon.prize ||
        (hackathon.prizes
          ? hackathon.prizes.first +
            hackathon.prizes.second +
            hackathon.prizes.third
          : 0);

      // Set winner
      const { error: winnerError } = await getSupabase()
        .from("x402_hackathon_winners")
        .insert({
          hackathon_id: hackathon.id,
          submission_id: submissionId,
          prize_amount: prizeAmount,
          place: 1,
        });

      if (winnerError) {
        console.error("Error setting winner:", winnerError);
        return res.status(500).json({ error: "Failed to set winner" });
      }

      // Mark hackathon as complete with resolved_at timestamp
      const { error: updateError } = await getSupabase()
        .from("x402_hackathons")
        .update({
          status: "complete",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", hackathon.id);

      if (updateError) {
        console.error("Error updating hackathon status:", updateError);
      }

      // Create notification for winner
      const jobData = submission.job as any;
      const jobName = jobData?.name || "your job";
      const hackathonDisplayName = hackathon.number
        ? `Hackathon #${hackathon.number}`
        : hackathon.name;

      try {
        await createNotification({
          user_id: submission.user_id,
          type: "hackathon_winner",
          title: "🏆 You won!",
          message: `Congratulations! ${jobName} won ${hackathonDisplayName} — $${prizeAmount} USDC`,
          link: `/hackathons/${hackathon.slug}`,
          metadata: {
            hackathon_id: hackathon.id,
            submission_id: submissionId,
            prize_amount: prizeAmount,
          },
        });
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
        // Don't fail the request if notification fails
      }

      res.json({
        success: true,
        message: "Winner selected successfully",
        winner: {
          submission_id: submissionId,
          prize_amount: prizeAmount,
        },
      });
    } catch (error) {
      console.error("Error selecting winner:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
