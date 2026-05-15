import { Router, Request, Response } from "express";
import { inngest } from "../lib/inngest";
import { getSupabase } from "../lib/supabase";
import { loadDecryptedUserWallet } from "../lib/wallet-keys";
import { redactPayer, hashSignature } from "../lib/redact";

export const runsRouter: Router = Router();

// POST /api/runs - Create a new run and trigger workflow execution
runsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { jobId, inputs, resources, steps, stepLevels, workflowInputs } =
      req.body;

    // Accept either resources (legacy) or steps (new unified format)
    if (
      !jobId ||
      (!resources && !steps) ||
      (resources && !Array.isArray(resources)) ||
      (steps && !Array.isArray(steps))
    ) {
      return res.status(400).json({
        error: "Missing required fields: jobId and (resources or steps)",
      });
    }

    // Verify job belongs to user
    const { data: job, error: jobError } = await getSupabase()
      .from("x402_jobs")
      .select("id, name")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Get user's wallet (Solana + optional Base) — decrypted.
    const wallet = await loadDecryptedUserWallet(userId);
    if (!wallet) {
      return res
        .status(400)
        .json({ error: "No wallet found. Please set up your wallet first." });
    }

    // Count resources (for legacy) or resource-type steps (for new format)
    const resourceCount = steps
      ? steps.filter((s: any) => s.type === "resource").length
      : resources.length;

    // Create the run record
    const { data: run, error: runError } = await getSupabase()
      .from("x402_job_runs")
      .insert({
        job_id: jobId,
        user_id: userId,
        status: "pending",
        inputs: inputs || {},
        resources_total: resourceCount,
      })
      .select()
      .single();

    if (runError || !run) {
      console.error("Error creating run:", runError);
      return res.status(500).json({ error: "Failed to create run" });
    }

    // Determine job network from resources/steps
    const jobNetwork = (steps || resources || []).some((item: any) => {
      const network = item.data?.network || item.network || "solana";
      return network === "base";
    })
      ? "base"
      : "solana";

    // Send event to Inngest - support both legacy resources and new unified steps
    const eventData: Record<string, unknown> = {
      runId: run.id,
      jobId: jobId,
      userId: userId,
      walletPublicKey: wallet.address,
      walletSecretKey: wallet.solanaSecretBase64,
      // Base wallet (optional - for Base network resources)
      baseWalletAddress: wallet.baseAddress || null,
      baseWalletKey: wallet.baseSecretBase64 || null,
      jobNetwork: jobNetwork, // Network for platform fee
      workflowInputs: workflowInputs || {}, // Top-level inputs from trigger
    };

    if (steps) {
      // New unified format - pass steps with dependencies
      eventData.steps = steps.map((s: any) => {
        if (s.type === "resource") {
          return {
            type: s.type,
            nodeId: s.nodeId,
            dependencies: s.dependencies || [],
            data: {
              resourceId: s.data.id,
              resourceUrl: s.data.resourceUrl,
              resourceName: s.data.name,
              resourcePrice: s.data.price || 0,
              resourceNetwork: s.data.network || "solana",
              resourceMethod: s.data.output_schema?.input?.method || "POST",
              nodeId: s.nodeId,
              inputs: s.data.configuredInputs || inputs?.[s.data.id] || {},
            },
          };
        } else if (s.type === "source") {
          return {
            type: s.type,
            nodeId: s.nodeId,
            dependencies: s.dependencies || [],
            data: {
              nodeId: s.nodeId,
              sourceType: s.data.sourceType,
              config: s.data.config || {},
            },
          };
        } else {
          // Transform
          return {
            type: s.type,
            nodeId: s.nodeId,
            dependencies: s.dependencies || [],
            data: {
              nodeId: s.nodeId,
              transformType: s.data.transformType,
              config: s.data.config,
              sourceNodeId: s.data.sourceNodeId,
            },
          };
        }
      });

      // Pass stepLevels for backwards compatibility (array of arrays of nodeIds)
      if (stepLevels && Array.isArray(stepLevels)) {
        eventData.stepLevels = stepLevels;
      }
    } else {
      // Legacy format - just resources
      eventData.resources = resources.map((r: any) => ({
        resourceId: r.id,
        resourceUrl: r.resourceUrl,
        resourceName: r.name,
        resourcePrice: r.price || 0,
        resourceMethod: r.output_schema?.input?.method || "POST",
        network: r.network || "solana-mainnet",
        nodeId: r.nodeId,
        inputs: inputs?.[r.id] || {},
      }));
    }

    await inngest.send({
      name: "x402/workflow.run",
      data: eventData,
    });

    res.status(201).json({
      run: {
        id: run.id,
        status: run.status,
        created_at: run.created_at,
      },
      message: "Workflow run started",
    });
  } catch (error) {
    console.error("Run create error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/runs/events - Get all events across all runs (flat timeline)
runsRouter.get("/events", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const statusFilter = req.query.status as string | undefined;

    // First get user's run IDs
    const { data: userRuns, error: runsError } = await getSupabase()
      .from("x402_job_runs")
      .select("id")
      .eq("user_id", userId);

    if (runsError) {
      console.error("Error fetching user runs:", runsError);
      return res.status(500).json({ error: "Failed to fetch runs" });
    }

    const runIds = (userRuns || []).map((r) => r.id);

    if (runIds.length === 0) {
      return res.json({ events: [], total: 0, limit, offset });
    }

    // Get events for those runs
    let query = getSupabase()
      .from("x402_job_run_events")
      .select(
        `
        id, sequence, status, resource_name, resource_url, resource_price,
        amount_paid, payment_signature, error, created_at, started_at, completed_at,
        run_id
      `,
        { count: "exact" },
      )
      .in("run_id", runIds);

    // Apply status filter
    if (statusFilter === "completed") {
      query = query.eq("status", "completed");
    } else if (statusFilter === "failed") {
      query = query.eq("status", "failed");
    }

    const {
      data: events,
      error,
      count,
    } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching events timeline:", error);
      return res.status(500).json({ error: "Failed to fetch events" });
    }

    // Get run details for the events we found
    const eventRunIds = [...new Set((events || []).map((e) => e.run_id))];
    const { data: runs } = await getSupabase()
      .from("x402_job_runs")
      .select(
        "id, status, total_cost, job_id, job:x402_jobs(id, name, slug), refund:x402_refunds(id, refund_number, status)",
      )
      .in("id", eventRunIds);

    const runMap = new Map(
      (runs || []).map((r) => {
        // Supabase returns joined relations as arrays
        const jobData = Array.isArray(r.job) ? r.job[0] : r.job;
        const refundData = Array.isArray(r.refund) ? r.refund[0] : r.refund;
        return [
          r.id,
          {
            status: r.status,
            total_cost: r.total_cost,
            job_id: r.job_id,
            job: jobData as { id: string; name: string; slug: string } | null,
            refund: refundData as {
              id: string;
              refund_number: number;
              status: string;
            } | null,
          },
        ];
      }),
    );

    // Format for flat timeline display
    const formattedEvents = (events || []).map((event) => {
      const runData = runMap.get(event.run_id);
      return {
        id: event.id,
        type: "resource_call",
        resource_name: event.resource_name,
        resource_url: event.resource_url,
        status: event.status,
        cost: event.amount_paid || event.resource_price || 0,
        // HIGH-12: hash payment_signature in public events shape.
        payment_signature: hashSignature(event.payment_signature),
        error: event.error,
        created_at: event.created_at,
        started_at: event.started_at,
        completed_at: event.completed_at,
        run_id: event.run_id,
        run_status: runData?.status || "unknown",
        run_total_cost: runData?.total_cost || 0,
        run_refund: runData?.refund || null,
        job_id: runData?.job?.id || runData?.job_id,
        job_name: runData?.job?.name || "Unknown Job",
        job_slug: runData?.job?.slug,
      };
    });

    res.json({
      events: formattedEvents,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Events timeline error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/runs/:id - Get run status with events
runsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const runId = req.params.id;

    // Get run
    const { data: run, error: runError } = await getSupabase()
      .from("x402_job_runs")
      .select(
        `
        *,
        job:x402_jobs(id, name)
      `,
      )
      .eq("id", runId)
      .eq("user_id", userId)
      .single();

    if (runError || !run) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Get events for this run
    const { data: events, error: eventsError } = await getSupabase()
      .from("x402_job_run_events")
      .select("*")
      .eq("run_id", runId)
      .order("sequence", { ascending: true });

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
    }

    // HIGH-12: redact payer/signature on both the run row and each event.
    const runAny = run as Record<string, unknown>;
    res.json({
      run: {
        ...runAny,
        payer_address: redactPayer(runAny.payer_address as string | null),
        payment_signature: hashSignature(
          runAny.payment_signature as string | null,
        ),
        events: (events || []).map((event) => {
          const e = event as Record<string, unknown>;
          return {
            ...e,
            payment_signature: hashSignature(
              e.payment_signature as string | null,
            ),
          };
        }),
      },
    });
  } catch (error) {
    console.error("Run fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/runs - List all runs for the user (optionally filtered by job)
runsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const jobId = req.query.jobId as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let query = getSupabase()
      .from("x402_job_runs")
      .select(
        `
        id, status, inputs, total_cost,
        resources_total, resources_completed, resources_failed,
        error, created_at, started_at, completed_at,
        total_payment, payment_signature, creator_markup_earned,
        payer_address, payment_network, triggered_by,
        job:x402_jobs(id, name),
        refund:x402_refunds(id, refund_number, amount, status)
      `,
        { count: "exact" },
      )
      .eq("user_id", userId);

    if (jobId) {
      query = query.eq("job_id", jobId);
    }

    // Apply status filter
    if (statusFilter === "completed") {
      query = query.eq("status", "completed");
    } else if (statusFilter === "failed") {
      query = query.eq("status", "failed");
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: runs, error, count } = await query;

    if (error) {
      console.error("Error fetching runs:", error);
      return res.status(500).json({ error: "Failed to fetch runs" });
    }

    // Format refund data (Supabase returns array for one-to-one relations).
    // HIGH-12: redact payer_address and hash payment_signature so the
    // public response does not leak on-chain identifiers. The spread
    // intentionally comes BEFORE the redacted fields so they override.
    const formattedRuns = (runs || []).map((run) => {
      const refundData = run.refund;
      const refundRaw = Array.isArray(refundData) ? refundData[0] : refundData;
      const refund = refundRaw
        ? {
            id: refundRaw.id,
            refund_number: refundRaw.refund_number,
            amount: parseFloat(refundRaw.amount) || 0,
            status: refundRaw.status || "pending",
          }
        : null;
      return {
        ...run,
        payer_address: redactPayer(run.payer_address as string | null),
        payment_signature: hashSignature(
          run.payment_signature as string | null,
        ),
        refund,
      };
    });

    res.json({ runs: formattedRuns, total: count || 0, limit, offset });
  } catch (error) {
    console.error("Runs fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/runs/:id/cancel - Cancel a running run
runsRouter.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const runId = req.params.id;

    // Verify run belongs to user and is still running
    const { data: run, error: findError } = await getSupabase()
      .from("x402_job_runs")
      .select("id, status")
      .eq("id", runId)
      .eq("user_id", userId)
      .single();

    if (findError || !run) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Only cancel if still pending or running
    if (run.status !== "pending" && run.status !== "running") {
      return res.status(400).json({
        error: "Cannot cancel run",
        reason: `Run is already ${run.status}`,
      });
    }

    // Update run status to cancelled
    const { error: updateError } = await getSupabase()
      .from("x402_job_runs")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        error: "Cancelled by user",
      })
      .eq("id", runId);

    if (updateError) {
      console.error("Error cancelling run:", updateError);
      return res.status(500).json({ error: "Failed to cancel run" });
    }

    // TODO: In the future, we could also cancel the Inngest function
    // if Inngest supports cancellation via API

    console.log(`🛑 Run ${runId} cancelled by user ${userId}`);

    res.json({ success: true, message: "Run cancelled" });
  } catch (error) {
    console.error("Run cancel error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/runs/:id - Delete a run and its events
runsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const runId = req.params.id;

    // Verify run belongs to user
    const { data: run, error: findError } = await getSupabase()
      .from("x402_job_runs")
      .select("id")
      .eq("id", runId)
      .eq("user_id", userId)
      .single();

    if (findError || !run) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Delete events first (cascade should handle this, but be explicit)
    await getSupabase()
      .from("x402_job_run_events")
      .delete()
      .eq("run_id", runId);

    // Delete the run
    const { error: deleteError } = await getSupabase()
      .from("x402_job_runs")
      .delete()
      .eq("id", runId);

    if (deleteError) {
      console.error("Error deleting run:", deleteError);
      return res.status(500).json({ error: "Failed to delete run" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Run delete error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
