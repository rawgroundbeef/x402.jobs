import { Router, Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { inngest } from "../lib/inngest";
import { processHeliusWebhook } from "../indexers/helius";
import { getSupabase } from "../lib/supabase";
import { getSolanaConnection } from "../lib/solana";
import { OpenFacilitator } from "@openfacilitator/sdk";
import { loadDecryptedUserWallet } from "../lib/wallet-keys";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { dollarsToAtomicString } from "../lib/usdc-amount";
import {
  signedStatusQuery,
  verifyStatusSignature,
} from "../lib/run-status-signing";

export const webhooksRouter: Router = Router();
export const jobsWebhookRouter: Router = Router(); // For /@username/job-slug routes
export const heliusWebhookRouter: Router = Router(); // For Helius transaction webhooks

// USDC token mint on Solana mainnet (string form retained for legacy call sites)
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// HIGH-07 + HIGH-10: USDC mint addresses as PublicKey instances for ATA derivation.
const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

/**
 * Map a solana cluster string to its USDC mint.
 * The codebase is mainnet-only today; devnet is wired for forward compatibility
 * and to mirror the fix spec in 28-CONTEXT.md.
 */
function getUsdcMint(solanaCluster: "mainnet" | "devnet"): PublicKey {
  return solanaCluster === "devnet" ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
}

// USDC on Base
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Platform fee recipient (could be moved to config)
const PLATFORM_WALLET = "6Yw8BnPU6sadbsZtB6LykxTVfhj8qmEVL2cyjdh5ChKh";

// Facilitator public key (pays for ATA creation on Solana)
const FACILITATOR_FEE_PAYER =
  process.env.SOLANA_FACILITATOR_ADDRESS ||
  "561oabzy81vXYYbs1ZHR1bvpiEr6Nbfd6PGTxPshoz4p";

// Base facilitator (pays gas for EIP-3009 transfers)
const BASE_FACILITATOR_FEE_PAYER =
  process.env.BASE_FACILITATOR_ADDRESS ||
  "0x94a6d89C53e2d44aa5F4882B1604150e9f5c7D83";

/**
 * Determine the network of a job based on its workflow resources.
 * If any resource is Base, the job is a Base job.
 */
function getJobNetwork(workflowDef: any): "solana" | "base" {
  const nodes = workflowDef?.nodes || [];
  const resourceNodes = nodes.filter((n: any) => n.type === "resource");

  for (const node of resourceNodes) {
    const resource = node.data?.resource || node.data;
    const network = resource?.network || "solana";
    if (network === "base") {
      return "base";
    }
  }

  return "solana";
}

/**
 * Calculate total job price from workflow definition
 * Returns { resourceCost, platformFee, baseCost, creatorMarkup, totalPrice } in USD
 *
 * Platform fee is 1.5% of resource cost (with minimum of $0.01)
 */
function calculateJobPrice(
  workflowDef: any,
  creatorMarkup: number = 0,
): {
  resourceCost: number;
  platformFee: number;
  baseCost: number;
  creatorMarkup: number;
  totalPrice: number;
} {
  const nodes = workflowDef?.nodes || [];
  const resourceNodes = nodes.filter((n: any) => n.type === "resource");

  let resourceCost = 0;
  for (const node of resourceNodes) {
    const resource = node.data?.resource || node.data;
    const price = resource?.price || 0;
    resourceCost += price;
  }

  // Platform fee = 1.5% of resource cost (minimum $0.01)
  const platformFeePercentage = config.platformFee.percentage;
  const platformFeeMinimum = config.platformFee.minimumUsdc;
  const platformFee = Math.max(
    resourceCost * platformFeePercentage,
    platformFeeMinimum,
  );

  // Base cost = resources + platform fee
  const baseCost = resourceCost + platformFee;

  // Total = base cost + creator markup
  const totalPrice = baseCost + creatorMarkup;

  return { resourceCost, platformFee, baseCost, creatorMarkup, totalPrice };
}

/**
 * Build webhook response from output config template
 * Supports variable substitution: {{payment.amount}}, {{payment.signature}}, {{payment.payer}},
 * {{payment.timestamp}}, {{payment.network}}, {{inputs.fieldName}}
 */
function buildWebhookResponse(
  config: {
    mode?: "passthrough" | "template" | "confirmation";
    template?: string;
    successMessage?: string;
  },
  payment: {
    amount: number;
    signature: string;
    payer: string;
    timestamp: string;
    network: string;
  },
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  if (config.mode === "confirmation") {
    // Simple confirmation mode
    return {
      success: true,
      message: config.successMessage || "Payment successful",
      payment: {
        amount: payment.amount,
        amountFormatted: `$${payment.amount.toFixed(2)} USDC`,
        signature: payment.signature,
        payer: payment.payer,
        timestamp: payment.timestamp,
        network: payment.network,
      },
    };
  }

  if (config.mode === "template" && config.template) {
    // Custom template mode - replace variables
    let templateStr = config.template;

    // Replace payment variables
    templateStr = templateStr.replace(
      /\{\{payment\.amount\}\}/g,
      String(payment.amount),
    );
    templateStr = templateStr.replace(
      /\{\{payment\.signature\}\}/g,
      payment.signature,
    );
    templateStr = templateStr.replace(/\{\{payment\.payer\}\}/g, payment.payer);
    templateStr = templateStr.replace(
      /\{\{payment\.timestamp\}\}/g,
      payment.timestamp,
    );
    templateStr = templateStr.replace(
      /\{\{payment\.network\}\}/g,
      payment.network,
    );

    // Replace input variables ({{inputs.fieldName}})
    templateStr = templateStr.replace(
      /\{\{inputs\.([^}]+)\}\}/g,
      (_, fieldPath) => {
        const value = getNestedValue(inputs, fieldPath);
        if (value === undefined || value === null) {
          return "";
        }
        return typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      },
    );

    // Try to parse as JSON, fallback to returning as message
    try {
      return JSON.parse(templateStr);
    } catch {
      return {
        success: true,
        message: templateStr,
        payment: {
          amount: payment.amount,
          signature: payment.signature,
          payer: payment.payer,
        },
      };
    }
  }

  // Default: passthrough mode (shouldn't reach here for payment collectors)
  return {
    success: true,
    payment: {
      amount: payment.amount,
      signature: payment.signature,
      payer: payment.payer,
      timestamp: payment.timestamp,
      network: payment.network,
    },
  };
}

/**
 * Get nested value from object using dot notation (e.g., "user.name")
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let value: unknown = obj;
  for (const part of parts) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Verify a Solana USDC payment from transaction signature
 * Note: SDK now waits for confirmation before returning, so tx should be indexed
 */
/**
 * Verify the parsed-tx payload of a Solana USDC payment.
 *
 * HIGH-07: requires `info.destination === recipient's USDC ATA` (derived from
 *          `recipientWallet` + USDC mint via `getAssociatedTokenAddress`).
 *          Before this fix the destination was not checked — a compromised
 *          facilitator could reroute payment.
 * HIGH-10: requires `parsed.type === "transferChecked"` AND
 *          `info.mint === USDC_MINT_ADDRESS`. Legacy `parsed.type === "transfer"`
 *          is REJECTED outright because the mint cannot be inferred from the
 *          instruction (the legacy variant has no `mint` field).
 *
 * Pure function — takes the parsed transaction directly. The RPC-fetching
 * wrapper `verifySolanaPayment` below delegates to this. Exported so the
 * test suite can drive it with canned fixtures without mocking
 * @solana/web3.js Connection.
 *
 * @param parsedTx - The parsed-tx shape returned by Connection.getParsedTransaction.
 * @param recipientWallet - The merchant/recipient's *wallet* pubkey (not the ATA).
 * @param solanaCluster - "mainnet" or "devnet" — selects the USDC mint constant.
 * @param expectedAtomic - Expected payment in atomic USDC units (USDC × 10^6) as bigint.
 * @returns { valid, reason?, payer?, amountAtomic? }. `reason` populated on failure for log diagnostics.
 */
export async function verifyParsedSolanaPayment(
  parsedTx: any,
  recipientWallet: string,
  solanaCluster: "mainnet" | "devnet",
  expectedAtomic: bigint,
): Promise<{
  valid: boolean;
  reason?: string;
  payer?: string;
  amountAtomic?: bigint;
}> {
  if (!parsedTx) {
    return { valid: false, reason: "tx_not_found" };
  }
  if (parsedTx.meta?.err) {
    return { valid: false, reason: "tx_failed" };
  }

  const usdcMint = getUsdcMint(solanaCluster);
  let recipientUsdcAta: string;
  try {
    const recipientPubkey = new PublicKey(recipientWallet);
    recipientUsdcAta = (
      await getAssociatedTokenAddress(usdcMint, recipientPubkey)
    ).toBase58();
  } catch {
    return { valid: false, reason: "invalid_recipient_wallet" };
  }
  const usdcMintB58 = usdcMint.toBase58();

  // Iterate both top-level and inner instructions. For each spl-token
  // instruction, enforce: transferChecked + USDC mint + destination === recipient ATA.
  // Legacy `transfer` is rejected outright (mint cannot be inferred).
  let totalAtomic = 0n;
  let payer: string | undefined;

  const allInstructions: any[] = [
    ...(parsedTx.transaction?.message?.instructions ?? []),
  ];
  for (const inner of parsedTx.meta?.innerInstructions ?? []) {
    for (const ix of inner.instructions ?? []) {
      allInstructions.push(ix);
    }
  }

  for (const ix of allInstructions) {
    if (!("parsed" in ix)) continue;
    // Accept either the legacy spl-token program name or none — the fixtures
    // explicitly set `program: "spl-token"` and production parsed-tx output
    // always includes it for SPL Token instructions.
    if (ix.program && ix.program !== "spl-token") continue;

    const parsed = ix.parsed;
    if (!parsed) continue;

    if (parsed.type === "transfer") {
      // HIGH-10: legacy transfer instruction has no `mint` field, so we cannot
      // prove this is USDC. Reject rather than infer.
      return { valid: false, reason: "legacy_transfer_rejected" };
    }
    if (parsed.type !== "transferChecked") {
      // Other instruction types (createAccount, closeAccount, etc.) — skip.
      continue;
    }

    const info = parsed.info ?? {};
    // HIGH-10: mint must be USDC for the configured cluster.
    if (info.mint !== usdcMintB58) {
      return { valid: false, reason: "wrong_mint" };
    }
    // HIGH-07: destination must be the recipient's USDC ATA.
    if (info.destination !== recipientUsdcAta) {
      return { valid: false, reason: "wrong_destination" };
    }
    const amountStr: string | undefined =
      info.tokenAmount?.amount ?? info.amount;
    if (typeof amountStr !== "string") {
      return { valid: false, reason: "malformed_amount" };
    }
    try {
      totalAtomic += BigInt(amountStr);
    } catch {
      return { valid: false, reason: "malformed_amount" };
    }
    if (!payer) payer = info.authority || info.source;
  }

  if (totalAtomic < expectedAtomic) {
    return {
      valid: false,
      reason: "insufficient_amount",
      amountAtomic: totalAtomic,
      payer,
    };
  }

  return { valid: true, payer, amountAtomic: totalAtomic };
}

/**
 * Fetch a confirmed Solana transaction by signature and verify it matches the
 * expected USDC payment to `recipientWallet`. Thin wrapper around
 * `verifyParsedSolanaPayment` — performs the RPC fetch, then delegates.
 *
 * `solanaCluster` defaults to "mainnet" (production today). The codebase is
 * mainnet-only; the parameter is wired through for forward compatibility.
 */
async function verifySolanaPayment(
  transactionSignature: string,
  expectedAmount: number,
  recipientWallet: string,
  solanaCluster: "mainnet" | "devnet" = "mainnet",
): Promise<{
  valid: boolean;
  payer?: string;
  amountPaid?: number;
  error?: string;
}> {
  try {
    const connection = getSolanaConnection();

    // Fetch the parsed transaction (SDK now confirms before returning)
    const tx = await connection.getParsedTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });

    // Convert dollar amount → atomic units (USDC is 6 decimals).
    // We use Math.round to match the HIGH-08 (Batch D) fix that lands later
    // for the same root cause (float math) but at the maxAmountRequired sites.
    const expectedAtomic = BigInt(Math.round(expectedAmount * 1_000_000));

    const result = await verifyParsedSolanaPayment(
      tx,
      recipientWallet,
      solanaCluster,
      expectedAtomic,
    );

    if (!result.valid) {
      const reason = result.reason ?? "unknown";
      // HIGH-07 + HIGH-10: log the reason for diagnostics, but do not echo it
      // upstream — public response surface stays generic.
      console.warn("[verifySolanaPayment] rejected:", reason);
      const amountPaid =
        result.amountAtomic !== undefined
          ? Number(result.amountAtomic) / 1_000_000
          : undefined;
      // Preserve the legacy `error` field shape for existing callers.
      const errorMsg =
        reason === "insufficient_amount" && amountPaid !== undefined
          ? `Insufficient payment: paid $${amountPaid.toFixed(4)}, required $${expectedAmount.toFixed(4)}`
          : reason === "tx_not_found"
            ? "Transaction not found"
            : reason === "tx_failed"
              ? "Transaction failed"
              : `Verification failed: ${reason}`;
      return {
        valid: false,
        error: errorMsg,
        amountPaid,
        payer: result.payer,
      };
    }

    const amountPaid =
      result.amountAtomic !== undefined
        ? Number(result.amountAtomic) / 1_000_000
        : undefined;
    return { valid: true, payer: result.payer, amountPaid };
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return { valid: false, error: error.message };
  }
}

// Initialize OpenFacilitator using @openfacilitator/sdk
const FACILITATOR_URL = process.env.FACILITATOR_URL;
if (!FACILITATOR_URL) {
  throw new Error("FACILITATOR_URL environment variable is required");
}

const facilitator = new OpenFacilitator({
  url: FACILITATOR_URL,
  timeout: 60000,
});

/**
 * Verify and broadcast a signed transaction via Facilitator
 * Uses @openfacilitator/sdk for settlement
 * Supports both Solana (transaction) and Base (EIP-3009 authorization)
 */
async function verifyAndBroadcastPayment(
  x402PaymentHeader: string,
  expectedAmount: number,
  recipientWallet: string,
  resourceUrl: string,
  description: string,
  jobNetwork: "solana" | "base" = "solana",
): Promise<{
  valid: boolean;
  payer?: string;
  amountPaid?: number;
  signature?: string;
  error?: string;
}> {
  try {
    // Decode the X402 payment header to validate format
    let paymentPayload: any;
    try {
      paymentPayload = JSON.parse(
        Buffer.from(x402PaymentHeader, "base64").toString("utf-8"),
      );
    } catch {
      return { valid: false, error: "Invalid X-Payment header format" };
    }

    // Check for valid payment payload based on network
    const network = paymentPayload.network || jobNetwork;
    const isBase = network === "base";

    if (isBase) {
      // Base uses EIP-3009 authorization
      if (!paymentPayload.payload?.authorization) {
        console.log(`   Payment payload keys:`, Object.keys(paymentPayload));
        console.log(
          `   Payload.payload keys:`,
          paymentPayload.payload ? Object.keys(paymentPayload.payload) : "none",
        );
        return {
          valid: false,
          error: "Missing authorization in X-Payment payload for Base",
        };
      }
    } else {
      // Solana uses signed transaction
      if (!paymentPayload.payload?.transaction) {
        console.log(`   Payment payload keys:`, Object.keys(paymentPayload));
        console.log(
          `   Payload.payload keys:`,
          paymentPayload.payload ? Object.keys(paymentPayload.payload) : "none",
        );
        return {
          valid: false,
          error: "Missing transaction in X-Payment payload",
        };
      }
    }

    console.log(
      `   Sending to Facilitator for settlement (${network}) via @openfacilitator/sdk...`,
    );

    // Build payment object for the SDK
    const payment = {
      x402Version: paymentPayload.x402Version || 1,
      scheme: paymentPayload.scheme || "exact",
      network: network,
      payload: paymentPayload.payload,
    };

    // Build payment requirements for validation
    const usdcAsset = isBase ? BASE_USDC_ADDRESS : USDC_MINT;

    const paymentRequirements = {
      scheme: "exact",
      network: network,
      maxAmountRequired: dollarsToAtomicString(expectedAmount),
      resource: resourceUrl,
      description: description,
      mimeType: "application/json",
      payTo: recipientWallet,
      maxTimeoutSeconds: 300,
      asset: usdcAsset,
    };

    // Use the OpenFacilitator SDK to settle the payment (with requirements)
    const result = await facilitator.settle(payment, paymentRequirements);

    if (!result.success) {
      console.error(`   ❌ Facilitator settlement failed:`, result.errorReason);
      return { valid: false, error: result.errorReason };
    }

    const signature = result.transaction;

    // If facilitator didn't return signature, trust the settlement
    if (!signature || signature.startsWith("1111111111")) {
      console.log(
        `   ⚠️ No real signature from facilitator - trusting the settlement`,
      );
      return {
        valid: true,
        payer: "unknown",
        amountPaid: expectedAmount,
        signature: "facilitator-settled",
      };
    }

    console.log(
      `   ✅ Transaction broadcast by facilitator: ${signature.substring(0, 20)}...`,
    );

    // For Solana, verify the transaction on-chain
    if (!isBase) {
      const verification = await verifySolanaPayment(
        signature,
        expectedAmount,
        recipientWallet,
      );

      return {
        ...verification,
        signature,
      };
    }

    // For Base, trust the facilitator response
    return {
      valid: true,
      payer: "unknown",
      amountPaid: expectedAmount,
      signature,
    };
  } catch (error: any) {
    console.error("Payment settlement error:", error);
    return { valid: false, error: error.message };
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 * Supports: X-Webhook-Signature, X-Hub-Signature-256 (GitHub style)
 */
function verifySignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;

  // Handle "sha256=..." prefix (GitHub style)
  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expectedSig, "hex"),
  );
}

/**
 * POST /api/webhooks/:jobId
 *
 * Trigger a job via webhook. The job must have trigger_type = "webhook".
 *
 * Authentication modes (checked in order):
 * 1. X-Webhook-Signature / X-Hub-Signature-256: Owner pays (authenticated webhook)
 * 2. X-Payment header: Caller pays via X402 protocol (Solana USDC)
 * 3. Neither: Return 402 Payment Required with X402 pricing info
 */
webhooksRouter.post("/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const rawBody = JSON.stringify(req.body);

    console.log(`🪝 Webhook received for job: ${jobId}`);

    // Look up job by ID (UUID)
    const { data: job, error: jobError } = await getSupabase()
      .from("x402_jobs")
      .select(
        "id, user_id, name, description, trigger_type, trigger_config, workflow_definition, creator_markup",
      )
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.log(`❌ Webhook job not found: ${jobId}`, jobError);
      return res.status(404).json({ error: "Job not found" });
    }

    // Verify trigger type is webhook
    if (job.trigger_type !== "webhook") {
      console.log(`❌ Job ${jobId} is not configured for webhook triggers`);
      return res.status(400).json({
        error: "Job is not configured for webhook triggers",
      });
    }

    // Determine job network from workflow resources
    const jobNetwork = getJobNetwork(job.workflow_definition);

    // Calculate price for all payment modes (needed for payment collector as well)
    const creatorMarkup = parseFloat(job.creator_markup) || 0;
    const { totalPrice, baseCost } = calculateJobPrice(
      job.workflow_definition,
      creatorMarkup,
    );

    // Check for authentication/payment
    const webhookSecret = job.trigger_config?.webhook_secret;
    const webhookSignature =
      (req.headers["x-webhook-signature"] as string) ||
      (req.headers["x-hub-signature-256"] as string);
    const x402PaymentHeader = req.headers["x-payment"] as string;

    let paymentMode: "owner" | "x402" = "owner";
    let x402Payer: string | undefined;
    let x402PaymentSignature: string | undefined;
    // Creator wallet addresses for escrow payouts (populated in Mode 2)
    let creatorSolanaWallet: string | undefined;
    let creatorBaseWallet: string | undefined;

    // Mode 1: Authenticated webhook (owner pays)
    if (webhookSecret && webhookSignature) {
      if (!verifySignature(rawBody, webhookSignature, webhookSecret)) {
        console.log(`❌ Invalid webhook signature for job: ${jobId}`);
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log(
        `✅ Webhook signature verified for job: ${jobId} (owner pays)`,
      );
      paymentMode = "owner";
    }
    // Mode 2: X402 payment (caller pays)
    else if (x402PaymentHeader && x402PaymentHeader.length > 10) {
      console.log(`💰 X402 payment header detected for job: ${jobId}`);

      // Get job owner's wallet for later escrow payout
      const { data: ownerWallet } = await getSupabase()
        .from("x402_user_wallets")
        .select("address, base_address")
        .eq("user_id", job.user_id)
        .single();

      // Store creator wallet addresses for escrow payout after job completion
      creatorSolanaWallet = ownerWallet?.address;
      creatorBaseWallet = ownerWallet?.base_address;

      // ESCROW: Payment goes to platform wallet (not directly to creator)
      // Creator markup will be paid out after job succeeds via pending_payouts
      const payTo =
        jobNetwork === "base" ? config.base.platformWallet : PLATFORM_WALLET;
      const resourceUrl = `${config.publicUrl}/webhooks/${job.id}`;
      const description = job.description || `Execute workflow: ${job.name}`;

      console.log(
        `   Required: $${totalPrice.toFixed(4)} USDC to ${payTo} (ESCROW) on ${jobNetwork} (includes $${creatorMarkup.toFixed(2)} creator markup)`,
      );

      // Verify and broadcast the payment transaction
      // The X-Payment header contains a signed-but-not-broadcast transaction
      const verification = await verifyAndBroadcastPayment(
        x402PaymentHeader,
        totalPrice,
        payTo,
        resourceUrl,
        description,
        jobNetwork,
      );

      if (!verification.valid) {
        console.log(
          `❌ X402 payment verification failed: ${verification.error}`,
        );
        return res.status(402).json({
          error: "Payment verification failed",
          reason: verification.error,
          required: totalPrice,
        });
      }

      console.log(
        `✅ X402 payment verified: $${verification.amountPaid?.toFixed(4)} from ${verification.payer}`,
      );
      console.log(`   Transaction: ${verification.signature}`);
      paymentMode = "x402";
      x402Payer = verification.payer;
      x402PaymentSignature = verification.signature;
    }
    // Mode 3: No authentication - return 402 with payment requirements
    else if (!webhookSecret) {
      // No secret configured and no payment - require X402 payment
      console.log(`💳 No auth provided, returning 402 for job: ${jobId}`);

      const priceInBaseUnits = dollarsToAtomicString(totalPrice);

      // ESCROW: All payments go to platform wallet (not directly to creator)
      // Creator markup will be paid out after job succeeds via pending_payouts
      const payTo =
        jobNetwork === "base" ? config.base.platformWallet : PLATFORM_WALLET;
      const asset = jobNetwork === "base" ? BASE_USDC_ADDRESS : USDC_MINT;
      const feePayer =
        jobNetwork === "base"
          ? BASE_FACILITATOR_FEE_PAYER
          : FACILITATOR_FEE_PAYER;
      const resourceUrl = `${config.publicUrl}/webhooks/${job.id}`;

      // Extract job parameters from trigger node
      const workflowDef = job.workflow_definition as {
        nodes?: { type: string; data?: { workflowInputs?: unknown[] } }[];
      };
      const triggerNode = workflowDef?.nodes?.find((n) => n.type === "trigger");
      const jobParameters = (triggerNode?.data?.workflowInputs || []) as Array<{
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }>;

      // Build bodyFields from job parameters
      const bodyFields: Record<
        string,
        { type: string; required: boolean; description: string }
      > = {};
      for (const param of jobParameters) {
        bodyFields[param.name] = {
          type: param.type,
          required: param.required,
          description: param.description || `Job parameter: ${param.name}`,
        };
      }

      return res.status(402).json({
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: jobNetwork,
            maxAmountRequired: priceInBaseUnits,
            resource: resourceUrl,
            description: job.description || `Execute workflow: ${job.name}`,
            mimeType: "application/json",
            payTo: payTo,
            maxTimeoutSeconds: 300,
            asset: asset,
            outputSchema: {
              input: {
                type: "http",
                method: "POST",
                bodyType: "json",
                bodyFields:
                  Object.keys(bodyFields).length > 0 ? bodyFields : undefined,
              },
              output: {
                type: "lro",
                statusUrlField: "statusUrl",
                runIdField: "runId",
                responseFields: {
                  success: {
                    type: "boolean",
                    description: "Whether the job was accepted",
                  },
                  runId: {
                    type: "string",
                    description: "Unique identifier for this job run",
                  },
                  statusUrl: {
                    type: "string",
                    description: "URL to poll for job status",
                  },
                  retryAfterSeconds: {
                    type: "number",
                    description: "Suggested polling interval",
                  },
                },
                finalResponseFields: {
                  state: {
                    type: "string",
                    enum: ["pending", "processing", "succeeded", "failed"],
                  },
                  response: {
                    type: "object",
                    description: "The final output of the job",
                  },
                  artifactUrl: {
                    type: "string",
                    description:
                      "URL to any generated artifact (if applicable)",
                  },
                },
              },
            },
            extra: {
              serviceName: "x402.jobs",
              serviceUrl: "https://x402.jobs",
              feePayer: feePayer,
              jobId: job.id,
              jobName: job.name,
              jobParameters,
              pricing: {
                amount: totalPrice,
                baseCost,
                creatorMarkup,
                currency: "USDC",
                network: jobNetwork === "base" ? "Base" : "Solana",
              },
            },
          },
        ],
        error: "Payment required",
        price: totalPrice,
        baseCost, // Cost without creator markup
        creatorMarkup, // Creator's cut
        currency: "USDC",
      });
    }
    // Mode 4: Secret configured but not provided - require signature
    else {
      console.log(
        `❌ Webhook secret required but not provided for job: ${jobId}`,
      );
      return res.status(401).json({ error: "Webhook signature required" });
    }

    // Get user's wallet (for executing the workflow) — decrypted.
    const wallet = await loadDecryptedUserWallet(job.user_id);
    if (!wallet) {
      console.log(`❌ No wallet found for job owner: ${jobId}`);
      return res.status(400).json({
        error: "Job owner has no wallet configured",
      });
    }

    // Extract steps from workflow definition
    const workflowDef = job.workflow_definition || { nodes: [], edges: [] };
    const nodes = workflowDef.nodes || [];
    const edges = workflowDef.edges || [];

    // Build dependency map from edges (target -> source nodes)
    const dependencyMap = new Map<string, string[]>();
    for (const edge of edges) {
      const target = edge.target;
      const source = edge.source;
      if (!dependencyMap.has(target)) {
        dependencyMap.set(target, []);
      }
      // Only add as dependency if source is a resource or transform (not trigger)
      const sourceNode = nodes.find((n: any) => n.id === source);
      if (sourceNode?.type === "resource" || sourceNode?.type === "transform") {
        dependencyMap.get(target)!.push(source);
      }
    }

    // Build execution steps from nodes
    const steps = nodes
      .filter((n: any) => n.type === "resource" || n.type === "transform")
      .map((n: any) => ({
        type: n.type,
        nodeId: n.id,
        data: n.data,
        dependencies: dependencyMap.get(n.id) || [],
      }));

    console.log(`🔧 Built ${steps.length} steps from workflow:`);
    for (const s of steps) {
      const name =
        s.type === "resource"
          ? s.data.resource?.name || s.data.name || s.nodeId
          : `Transform (${s.data.transformType || "unknown"})`;
      console.log(
        `   ${s.nodeId} | ${s.type} | ${name} | deps: [${s.dependencies.join(", ")}]`,
      );
    }

    // Find output node and check for webhook response config
    const outputNode = nodes.find((n: any) => n.type === "output");
    const webhookResponseConfig = outputNode?.data?.outputConfig
      ?.webhookResponse as
      | {
          mode?: "passthrough" | "template" | "confirmation";
          template?: string;
          successMessage?: string;
        }
      | undefined;

    // If no steps AND we have a webhook response config, this is a "payment collector" job
    // Return immediately with the configured response (no async workflow needed)
    if (steps.length === 0) {
      // Check if this is a valid payment collector (has webhook response config)
      if (
        !webhookResponseConfig ||
        webhookResponseConfig.mode === "passthrough"
      ) {
        return res.status(400).json({
          error:
            "Job has no executable steps. Configure a webhook response in the output node for payment-only jobs.",
        });
      }

      console.log(
        `💸 Payment collector job detected - returning immediate response`,
      );

      // Create a completed run record for tracking
      const { data: run, error: runError } = await getSupabase()
        .from("x402_job_runs")
        .insert({
          job_id: job.id,
          user_id: job.user_id,
          status: "completed",
          inputs: {
            _webhook: {
              payload: req.body,
              headers: {
                "content-type": req.headers["content-type"],
                "user-agent": req.headers["user-agent"],
              },
              received_at: new Date().toISOString(),
              paymentMode: paymentMode,
              ...(paymentMode === "x402" && {
                x402: {
                  payer: x402Payer,
                  network: jobNetwork,
                },
              }),
            },
          },
          resources_total: 0,
          resources_completed: 0,
          total_cost: baseCost,
          // Payment tracking fields
          ...(paymentMode === "x402" && {
            total_payment: totalPrice,
            payment_signature: x402PaymentSignature,
            creator_markup_earned: creatorMarkup,
            payer_address: x402Payer,
            payment_network: jobNetwork,
            // Creator wallet addresses for escrow payout
            creator_wallet_address: creatorSolanaWallet,
            creator_base_wallet_address: creatorBaseWallet,
          }),
          output: buildWebhookResponse(
            webhookResponseConfig,
            {
              amount: totalPrice,
              signature: x402PaymentSignature || "none",
              payer: x402Payer || "unknown",
              timestamp: new Date().toISOString(),
              network: jobNetwork,
            },
            req.body,
          ),
          completed_at: new Date().toISOString(),
          triggered_by: "webhook",
        })
        .select()
        .single();

      if (runError) {
        console.error("Error creating payment collector run:", runError);
      }

      // ESCROW: Payment collector jobs complete immediately - create payout record
      if (run && paymentMode === "x402" && creatorMarkup > 0) {
        const creatorWallet =
          jobNetwork === "base" ? creatorBaseWallet : creatorSolanaWallet;
        if (creatorWallet) {
          await getSupabase().from("x402_pending_payouts").insert({
            run_id: run.id,
            job_id: job.id,
            type: "creator_payout",
            recipient_address: creatorWallet,
            creator_id: job.user_id,
            amount: creatorMarkup,
            network: jobNetwork,
            status: "pending",
          });
          console.log(
            `📤 Created escrow payout record: $${creatorMarkup} to ${creatorWallet}`,
          );
        }
      }

      // Build and return the custom response
      const response = buildWebhookResponse(
        webhookResponseConfig,
        {
          amount: totalPrice,
          signature: paymentMode === "x402" ? "x402-verified" : "none",
          payer: x402Payer || "unknown",
          timestamp: new Date().toISOString(),
          network: jobNetwork,
        },
        req.body,
      );

      return res.status(200).json({
        ...response,
        runId: run?.id,
        paymentMode: paymentMode,
        ...(paymentMode === "x402" && {
          x402Receipt: {
            verified: true,
            network: jobNetwork,
            payer: x402Payer,
          },
        }),
      });
    }

    // Create the run record
    const { data: run, error: runError } = await getSupabase()
      .from("x402_job_runs")
      .insert({
        job_id: job.id,
        user_id: job.user_id,
        status: "pending",
        inputs: {
          _webhook: {
            payload: req.body,
            headers: {
              "content-type": req.headers["content-type"],
              "user-agent": req.headers["user-agent"],
            },
            received_at: new Date().toISOString(),
            paymentMode: paymentMode,
            ...(paymentMode === "x402" && {
              x402: {
                payer: x402Payer,
                network: jobNetwork,
              },
            }),
          },
        },
        resources_total: steps.length, // Count ALL steps (resources + transforms)
        // Payment tracking fields for x402 runs
        ...(paymentMode === "x402" && {
          total_payment: totalPrice,
          payment_signature: x402PaymentSignature,
          creator_markup_earned: creatorMarkup,
          payer_address: x402Payer,
          payment_network: jobNetwork,
          // Creator wallet addresses for escrow payout
          creator_wallet_address: creatorSolanaWallet,
          creator_base_wallet_address: creatorBaseWallet,
        }),
        triggered_by: "webhook",
      })
      .select()
      .single();

    if (runError || !run) {
      console.error("Error creating webhook run:", runError);
      return res.status(500).json({ error: "Failed to create run" });
    }

    // Build steps for Inngest
    // Note: resource data is nested under s.data.resource, not directly in s.data
    console.log(`🪝 Building ${steps.length} steps for Inngest`);

    const inngestSteps = steps.map((s: any) => {
      if (s.type === "resource") {
        const resource = s.data.resource || s.data; // Handle both structures
        const resourceMethod = resource.output_schema?.input?.method || "POST";
        console.log(`   Resource: ${resource.name} (${resource.id})`);
        console.log(`   URL: ${resource.resourceUrl}`);
        console.log(`   Method: ${resourceMethod}`);
        console.log(`   Dependencies: ${s.dependencies.join(", ") || "none"}`);
        return {
          type: s.type,
          nodeId: s.nodeId,
          dependencies: s.dependencies,
          data: {
            resourceId: resource.id,
            resourceUrl: resource.resourceUrl,
            resourceName: resource.name,
            resourcePrice: resource.price || 0,
            resourceNetwork: resource.network || "solana",
            resourceMethod: resourceMethod,
            nodeId: s.nodeId,
            inputs: {
              ...s.data.configuredInputs,
              // Inject webhook payload as available input
              _webhookPayload: req.body,
            },
          },
        };
      } else {
        // Transform node
        console.log(`   Transform: ${s.data.transformType} (${s.nodeId})`);
        console.log(`   Dependencies: ${s.dependencies.join(", ") || "none"}`);
        return {
          type: s.type,
          nodeId: s.nodeId,
          dependencies: s.dependencies,
          data: {
            nodeId: s.nodeId,
            transformType: s.data.transformType,
            config: s.data.transformConfig || s.data.config,
            sourceNodeId: s.data.sourceNodeId,
          },
        };
      }
    });

    // Extract workflow inputs from request body
    // The caller can pass inputs directly in the body, which will be available to all nodes
    const workflowInputs = req.body || {};

    // Trigger the workflow via Inngest
    await inngest.send({
      name: "x402/workflow.run",
      data: {
        runId: run.id,
        jobId: job.id,
        userId: job.user_id,
        walletPublicKey: wallet.address,
        walletSecretKey: wallet.solanaSecretBase64,
        baseWalletAddress: wallet.baseAddress || null,
        baseWalletKey: wallet.baseSecretBase64 || null,
        jobNetwork: jobNetwork, // Pass job network for platform fee
        steps: inngestSteps,
        triggeredBy: "webhook",
        workflowInputs, // Pass the entire request body as workflow inputs
      },
    });

    console.log(`✅ Webhook triggered job run: ${run.id} (${paymentMode})`);

    // Build status URL for async polling.
    //
    // HIGH-09 (28-06): URL is HMAC-signed so a leaked URL (via Referer,
    // share button, or log dump) cannot be used to read the paid output.
    // Signature is verified on the corresponding GET handler below.
    // We sign the runId + exp; query-string shorthand because the route
    // path is already templated.
    const statusUrl = `${config.publicUrl}/webhooks/${job.id}/runs/${run.id}/status?${signedStatusQuery(run.id)}`;

    res.status(202).json({
      success: true,
      runId: run.id,
      statusUrl: statusUrl,
      retryAfterSeconds: 2,
      message: "Webhook received, job execution started",
      paymentMode: paymentMode,
      ...(paymentMode === "x402" && {
        paidBy: x402Payer,
        x402Receipt: {
          verified: true,
          network: jobNetwork,
        },
      }),
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/webhooks/:jobId
 *
 * Get webhook info for a job.
 * Returns X402 resource info including pricing for public (unauthenticated) access.
 */
webhooksRouter.get("/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await getSupabase()
      .from("x402_jobs")
      .select(
        "id, display_id, name, description, trigger_type, workflow_definition, user_id, creator_markup",
      )
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.trigger_type !== "webhook") {
      return res.status(400).json({
        error: "Job is not configured for webhook triggers",
      });
    }

    // Calculate total price for X402 (includes creator markup)
    const creatorMarkup = parseFloat(job.creator_markup) || 0;
    const { baseCost, totalPrice } = calculateJobPrice(
      job.workflow_definition,
      creatorMarkup,
    );
    const priceInBaseUnits = dollarsToAtomicString(totalPrice); // USDC has 6 decimals (HIGH-08)

    // Extract job parameters from trigger node
    const workflowDef = job.workflow_definition as {
      nodes?: { type: string; data?: { workflowInputs?: unknown[] } }[];
    };
    const triggerNode = workflowDef?.nodes?.find((n) => n.type === "trigger");
    const jobParameters = (triggerNode?.data?.workflowInputs || []) as Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;

    // Build bodyFields from job parameters
    const bodyFields: Record<
      string,
      { type: string; required: boolean; description: string }
    > = {};
    for (const param of jobParameters) {
      bodyFields[param.name] = {
        type: param.type,
        required: param.required,
        description: param.description || `Job parameter: ${param.name}`,
      };
    }

    // Determine job network from workflow resources
    const jobNetwork = getJobNetwork(job.workflow_definition);

    // Get job owner's wallet for payment (Solana + Base)
    const { data: ownerWallet } = await getSupabase()
      .from("x402_user_wallets")
      .select("address, base_address")
      .eq("user_id", job.user_id)
      .single();

    // Use network-appropriate wallet
    const payTo =
      jobNetwork === "base"
        ? ownerWallet?.base_address || config.base.platformWallet
        : ownerWallet?.address || PLATFORM_WALLET;
    const asset = jobNetwork === "base" ? BASE_USDC_ADDRESS : USDC_MINT;
    const feePayer =
      jobNetwork === "base"
        ? BASE_FACILITATOR_FEE_PAYER
        : FACILITATOR_FEE_PAYER;
    const resourceUrl = `${config.publicUrl}/webhooks/${job.id}`;

    // Return X402 resource info with 402 status (required for x402scan)
    res.status(402).json({
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: jobNetwork,
          maxAmountRequired: priceInBaseUnits,
          resource: resourceUrl,
          description: job.description || `Execute workflow: ${job.name}`,
          mimeType: "application/json",
          payTo: payTo,
          maxTimeoutSeconds: 300,
          asset: asset,
          outputSchema: {
            input: {
              type: "http",
              method: "POST",
              bodyType: "json",
              bodyFields:
                Object.keys(bodyFields).length > 0
                  ? bodyFields
                  : {
                      // Default if no parameters defined
                      payload: {
                        type: "object",
                        required: false,
                        description: "Optional data to pass to the workflow",
                      },
                    },
            },
            output: {
              type: "lro",
              statusUrlField: "statusUrl",
              runIdField: "runId",
              responseFields: {
                success: {
                  type: "boolean",
                  description: "Whether the job was accepted",
                },
                runId: {
                  type: "string",
                  description: "Unique identifier for this job run",
                },
                statusUrl: {
                  type: "string",
                  description: "URL to poll for job status",
                },
                retryAfterSeconds: {
                  type: "number",
                  description: "Suggested polling interval",
                },
              },
              finalResponseFields: {
                state: {
                  type: "string",
                  enum: ["pending", "processing", "succeeded", "failed"],
                },
                response: {
                  type: "object",
                  description: "The final output of the job",
                },
                artifactUrl: {
                  type: "string",
                  description: "URL to any generated artifact (if applicable)",
                },
              },
            },
          },
          extra: {
            serviceName: "x402.jobs",
            serviceUrl: "https://x402.jobs",
            feePayer: feePayer,
            jobId: job.id,
            jobName: job.name,
            jobParameters: jobParameters, // Include full parameter definitions
            pricing: {
              amount: totalPrice,
              baseCost, // Cost before creator markup
              creatorMarkup, // Creator's cut
              currency: "USDC",
              network: jobNetwork === "base" ? "Base" : "Solana",
            },
          },
        },
      ],
      // Also include basic info for non-X402 clients
      jobId: job.id,
      displayId: job.display_id,
      name: job.name,
      webhookUrl: resourceUrl,
      method: "POST",
      contentType: "application/json",
      price: totalPrice,
      baseCost, // Cost before creator markup
      creatorMarkup, // Creator's cut
      parameters: jobParameters, // Also at top level for easy access
    });
  } catch (error) {
    console.error("Webhook info error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/webhooks/:jobId/runs/:runId/status
 *
 * Get the status of a job run for async polling.
 * Returns state: pending | running | succeeded | failed
 */
webhooksRouter.get(
  "/:jobId/runs/:runId/status",
  async (req: Request, res: Response) => {
    try {
      const { jobId, runId } = req.params;

      // HIGH-09 (28-06): HMAC signature verification with dual-acceptance
      // rollout. When REQUIRE_STATUS_SIGNATURE=true, missing or invalid sig
      // returns 401. When unset/false (default during transition), unsigned
      // URLs continue to work — BUT a present-but-invalid sig still 401s
      // (we always enforce on attempted signatures, never silently fall
      // back). Flip the env flag once the frontend deploys with sig+exp
      // threaded through.
      const sig = req.query.sig as string | undefined;
      const exp = req.query.exp as string | undefined;
      const requireSig = process.env.REQUIRE_STATUS_SIGNATURE === "true";

      if (sig || exp) {
        // Partial-signed URLs (sig without exp, or vice versa) are rejected
        // — both must be valid together.
        if (!verifyStatusSignature(runId, sig, exp)) {
          return res.status(401).json({ error: "invalid_signature" });
        }
      } else if (requireSig) {
        return res.status(401).json({ error: "signature_required" });
      }
      // else: unsigned URLs accepted during transition window.

      // Get the run status
      const { data: run, error } = await getSupabase()
        .from("x402_job_runs")
        .select(
          "id, status, error, total_cost, resources_completed, resources_total, completed_at",
        )
        .eq("id", runId)
        .eq("job_id", jobId)
        .single();

      if (error || !run) {
        return res.status(404).json({ error: "Run not found" });
      }

      // Map our status to the expected async resource states
      // Note: run-workflow.ts uses "success" not "completed"
      let state: "pending" | "processing" | "succeeded" | "failed";
      switch (run.status) {
        case "pending":
          state = "pending";
          break;
        case "running":
          state = "processing";
          break;
        case "completed":
        case "success":
          state = "succeeded";
          break;
        case "failed":
          state = "failed";
          break;
        default:
          state = "processing";
      }

      // Get all events for this run (for logs and final output)
      // Events are ordered by sequence (topological order based on dependencies)
      const { data: events } = await getSupabase()
        .from("x402_job_run_events")
        .select(
          "node_id, output, output_text, status, resource_url, resource_name, sequence, created_at, error",
        )
        .eq("run_id", runId)
        .order("sequence", { ascending: true });

      // Build step logs from completed events (obfuscated names to protect job recipes)
      const steps = (events || []).map((e, index) => ({
        name: `Step ${index + 1}`,
        status: e.status as "pending" | "running" | "completed" | "failed",
        sequence: e.sequence,
        ...(e.error && { error: e.error }),
      }));

      // Calculate actual progress from events
      const completedSteps = (events || []).filter(
        (e) => e.status === "completed" || e.status === "success",
      ).length;
      const totalSteps = (events || []).length;

      // Collect errors from failed steps for summary (obfuscated)
      // Note: sequence is 0-indexed, step names are 1-indexed
      const failedStepsData = (events || []).filter(
        (e) => e.status === "failed" && e.error,
      );
      const failedErrors = failedStepsData
        .map((e, i) => `Step ${(e.sequence ?? i) + 1}: ${e.error}`)
        .slice(0, 5); // First 5 errors

      // If completed, get the final output from the last step by topological order
      // The topological order ensures the last step is the one that depends on all others
      let response: any = null;
      let artifactUrl: string | undefined;

      if (
        run.status === "completed" ||
        run.status === "success" ||
        run.status === "failed"
      ) {
        console.log(`   Found ${events?.length || 0} events for run ${runId}`);

        // Debug: log all events with their sequences and output status
        console.log(`   All events by sequence:`);
        for (const e of events || []) {
          const hasOutput = e.output || e.output_text;
          const outputPreview = hasOutput
            ? typeof e.output === "string"
              ? e.output.substring(0, 50)
              : JSON.stringify(e.output)?.substring(0, 50)
            : "no output";
          console.log(
            `     seq=${e.sequence} | ${e.resource_name} | status=${e.status} | output=${outputPreview}`,
          );
        }

        // Events are already sorted by sequence (topological order)
        // The last event with output is the final result
        const eventsDesc = [...(events || [])].reverse();
        const lastEventWithOutput = eventsDesc.find(
          (e) => e.output || e.output_text,
        );

        if (lastEventWithOutput) {
          console.log(
            `   Last event by topo order: sequence=${lastEventWithOutput.sequence}, name=${lastEventWithOutput.resource_name}`,
          );
          response =
            lastEventWithOutput.output || lastEventWithOutput.output_text;
          console.log(`   Response type: ${typeof response}`);
          console.log(
            `   Response preview:`,
            typeof response === "string"
              ? response.substring(0, 200)
              : JSON.stringify(response)?.substring(0, 200),
          );

          // Extract artifactUrl/imageUrl if present
          if (typeof response === "object") {
            artifactUrl = response?.artifactUrl || response?.imageUrl;
          } else if (typeof response === "string") {
            try {
              const parsed = JSON.parse(response);
              artifactUrl = parsed.artifactUrl || parsed.imageUrl;
            } catch {
              // Not JSON, use as-is
            }
          }

          console.log(`   ArtifactUrl: ${artifactUrl || "not found"}`);
        } else {
          console.log(`   ⚠️ No event with output found`);
        }
      }

      res.json({
        state,
        runId: run.id,
        progress: {
          completed: completedSteps,
          total: totalSteps,
        },
        steps, // Include step-by-step logs (obfuscated names)
        ...(state === "succeeded" && {
          response,
          artifactUrl,
        }),
        ...(state === "failed" && {
          error:
            run.error ||
            (failedErrors.length > 0
              ? failedErrors.join("; ")
              : "Job execution failed"),
          failedSteps: failedErrors,
        }),
        ...(run.completed_at && { completedAt: run.completed_at }),
      });
    } catch (error) {
      console.error("Run status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// NICE URL ROUTES: /@username/job-slug
// ============================================================================

/**
 * Helper: Look up job by username and slug
 */
async function getJobByUsernameAndSlug(
  username: string,
  jobSlug: string,
): Promise<{
  job: any;
  error?: string;
}> {
  console.log(`   🔎 Looking up profile for username: "${username}"`);

  // First, find the user by username from profiles table
  // (skip soft-deleted users — HIGH-03 plan 28-07)
  const { data: profile, error: profileError } = await getSupabase()
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .is("deleted_at", null)
    .single();

  if (profileError || !profile) {
    console.log(
      `   ❌ Profile not found for username: "${username}"`,
      profileError?.message || profileError,
    );
    return { job: null, error: `User "${username}" not found` };
  }

  console.log(
    `   ✅ Found profile: ${profile.id} (username: ${profile.username})`,
  );
  console.log(
    `   🔎 Looking up job with slug: "${jobSlug}" for user: ${profile.id}`,
  );

  // Then find the job by user_id and slug
  const { data: job, error: jobError } = await getSupabase()
    .from("x402_jobs")
    .select(
      "id, display_id, name, slug, description, trigger_type, trigger_methods, trigger_config, workflow_definition, user_id, creator_markup, is_active, network, avatar_url",
    )
    .eq("user_id", profile.id)
    .eq("slug", jobSlug)
    .single();

  if (jobError || !job) {
    console.log(
      `   ❌ Job not found for user ${profile.id}, slug: "${jobSlug}"`,
      jobError?.message || jobError,
    );
    return {
      job: null,
      error: `Job "${jobSlug}" not found for user "${username}"`,
    };
  }

  console.log(
    `   ✅ Found job: ${job.id} (name: ${job.name}, slug: ${job.slug})`,
  );
  return { job };
}

/**
 * GET /@:username/:jobSlug
 *
 * Get public job info by username and slug.
 * Returns job data for viewing, with isOwner flag if authenticated.
 * Also includes X402 resource info if webhook is enabled.
 */
jobsWebhookRouter.get(
  "/@:username/:jobSlug",
  async (req: Request, res: Response) => {
    try {
      const username = req.params.username as string;
      const jobSlug = req.params.jobSlug as string;

      // Optional auth - check if viewer is the owner
      let viewerId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const {
            data: { user },
          } = await getSupabase().auth.getUser(token);
          viewerId = user?.id;
        } catch {
          // Ignore auth errors
        }
      }

      const { job, error } = await getJobByUsernameAndSlug(username, jobSlug);
      if (error || !job) {
        return res.status(404).json({ error: error || "Job not found" });
      }

      const isOwner = viewerId === job.user_id;

      // Check if job is active (unless owner)
      if (!job.is_active && !isOwner) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Check if webhook trigger is enabled
      const webhookEnabled =
        job.trigger_type === "webhook" || job.trigger_methods?.webhook === true;

      if (!webhookEnabled) {
        return res.status(400).json({
          error: "Job is not configured for webhook triggers",
        });
      }

      // Calculate total price for X402 (includes creator markup)
      const creatorMarkup = parseFloat(job.creator_markup) || 0;
      const { baseCost, totalPrice } = calculateJobPrice(
        job.workflow_definition,
        creatorMarkup,
      );
      const priceInBaseUnits = dollarsToAtomicString(totalPrice);

      // Extract job parameters from trigger node
      const workflowDef = job.workflow_definition as {
        nodes?: { type: string; data?: { workflowInputs?: unknown[] } }[];
      };
      const triggerNode = workflowDef?.nodes?.find((n) => n.type === "trigger");
      const jobParameters = (triggerNode?.data?.workflowInputs || []) as Array<{
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }>;

      // Build bodyFields from job parameters
      const bodyFields: Record<
        string,
        { type: string; required: boolean; description: string }
      > = {};
      for (const param of jobParameters) {
        bodyFields[param.name] = {
          type: param.type,
          required: param.required,
          description: param.description || `Job parameter: ${param.name}`,
        };
      }

      // Get job owner's wallet for payment (Solana + Base)
      const { data: ownerWallet } = await getSupabase()
        .from("x402_user_wallets")
        .select("address, base_address")
        .eq("user_id", job.user_id)
        .single();

      // Determine job network from workflow resources
      const jobNetwork = getJobNetwork(job.workflow_definition);
      const payTo =
        jobNetwork === "base"
          ? ownerWallet?.base_address || config.base.platformWallet
          : ownerWallet?.address || PLATFORM_WALLET;
      const asset = jobNetwork === "base" ? BASE_USDC_ADDRESS : USDC_MINT;
      const feePayer =
        jobNetwork === "base"
          ? BASE_FACILITATOR_FEE_PAYER
          : FACILITATOR_FEE_PAYER;

      // Use nice URL as the resource URL
      const resourceUrl = `${config.publicUrl}/@${username}/${jobSlug}`;
      // Legacy URL still works
      const legacyUrl = `${config.publicUrl}/webhooks/${job.id}`;

      // Return X402 resource info with 402 status (required for x402scan)
      res.status(402).json({
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: jobNetwork,
            maxAmountRequired: priceInBaseUnits,
            resource: resourceUrl,
            description: job.description || `Execute workflow: ${job.name}`,
            mimeType: "application/json",
            payTo: payTo,
            maxTimeoutSeconds: 300,
            asset: asset,
            outputSchema: {
              input: {
                type: "http",
                method: "POST",
                bodyType: "json",
                bodyFields:
                  Object.keys(bodyFields).length > 0 ? bodyFields : undefined,
              },
              output: {
                type: "lro",
                statusUrlField: "statusUrl",
                runIdField: "runId",
                responseFields: {
                  success: {
                    type: "boolean",
                    description: "Whether the job was accepted",
                  },
                  runId: {
                    type: "string",
                    description: "Unique identifier for this job run",
                  },
                  statusUrl: {
                    type: "string",
                    description: "URL to poll for job status",
                  },
                  retryAfterSeconds: {
                    type: "number",
                    description: "Suggested polling interval",
                  },
                },
                finalResponseFields: {
                  state: {
                    type: "string",
                    enum: ["pending", "processing", "succeeded", "failed"],
                  },
                  response: {
                    type: "object",
                    description: "The final output of the job",
                  },
                  artifactUrl: {
                    type: "string",
                    description:
                      "URL to any generated artifact (if applicable)",
                  },
                },
              },
            },
            extra: {
              serviceName: "x402.jobs",
              serviceUrl: "https://x402.jobs",
              feePayer: feePayer,
              jobId: job.id,
              jobName: job.name,
              jobSlug: job.slug,
              ownerUsername: username,
              jobParameters,
              pricing: {
                amount: totalPrice,
                baseCost,
                creatorMarkup,
                currency: "USDC",
                network: jobNetwork === "base" ? "Base" : "Solana",
              },
            },
          },
        ],
        // Convenience fields
        jobId: job.id,
        displayId: job.display_id,
        name: job.name,
        slug: job.slug,
        owner: username,
        webhookUrl: resourceUrl,
        legacyWebhookUrl: legacyUrl,
        method: "POST",
        contentType: "application/json",
        price: totalPrice,
        baseCost,
        creatorMarkup,
        parameters: jobParameters,
      });
    } catch (error) {
      console.error("Job webhook info error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * POST /@:username/:jobSlug
 *
 * Trigger a job via webhook using nice URL format.
 * Delegates to the same logic as POST /webhooks/:jobId
 */
jobsWebhookRouter.post(
  "/@:username/:jobSlug",
  async (req: Request, res: Response) => {
    try {
      const username = req.params.username as string;
      const jobSlug = req.params.jobSlug as string;

      console.log(`🔍 POST /@${username}/${jobSlug} - Looking up job...`);

      const { job, error } = await getJobByUsernameAndSlug(username, jobSlug);
      if (error || !job) {
        console.log(
          `❌ POST /@${username}/${jobSlug} - ${error || "Job not found"}`,
        );
        return res.status(404).json({ error: error || "Job not found" });
      }

      console.log(`✅ POST /@${username}/${jobSlug} - Found job: ${job.id}`);

      // Forward to the main webhook handler by setting jobId in params
      req.params.jobId = job.id;

      // Determine job network from workflow resources
      const jobNetwork = getJobNetwork(job.workflow_definition);

      // Check if webhook trigger is enabled
      const webhookEnabled =
        job.trigger_type === "webhook" || job.trigger_methods?.webhook === true;

      if (!webhookEnabled) {
        return res.status(400).json({
          error: "Job is not configured for webhook triggers",
        });
      }

      const rawBody = JSON.stringify(req.body);
      console.log(
        `🪝 Webhook received for @${username}/${jobSlug} (${job.id})`,
      );

      // Get job owner's wallet — decrypted. May be null; handled downstream.
      const wallet = await loadDecryptedUserWallet(job.user_id);

      // Check for X402 payment header
      const paymentHeader = req.headers["x-payment"] as string | undefined;
      const signatureHeader =
        (req.headers["x-webhook-signature"] as string) ||
        (req.headers["x-hub-signature-256"] as string);

      // Determine payment mode
      let paymentMode: "owner" | "x402" | "none" = "none";
      let x402Payer: string | undefined;

      // Check for signature authentication (owner pays)
      const webhookSecret = job.trigger_config?.webhook_secret;
      if (signatureHeader && webhookSecret) {
        const isValid = verifySignature(
          rawBody,
          signatureHeader,
          webhookSecret,
        );
        if (isValid) {
          paymentMode = "owner";
          console.log(`   ✅ Signature verified - owner will pay`);
        } else {
          console.log(`   ⚠️ Invalid signature`);
        }
      }

      // Check for X402 payment
      if (paymentMode === "none" && paymentHeader) {
        console.log(`   🔐 X402 payment header detected`);

        // Calculate expected amount
        const creatorMarkup = parseFloat(job.creator_markup) || 0;
        const { totalPrice } = calculateJobPrice(
          job.workflow_definition,
          creatorMarkup,
        );

        // Use network-appropriate wallet
        const recipientWallet =
          jobNetwork === "base"
            ? wallet?.baseAddress || config.base.platformWallet
            : wallet?.address || PLATFORM_WALLET;
        const resourceUrl = `${config.publicUrl}/@${username}/${jobSlug}`;

        // Verify payment via facilitator
        const verification = await verifyAndBroadcastPayment(
          paymentHeader,
          totalPrice,
          recipientWallet,
          resourceUrl,
          job.description || `Execute workflow: ${job.name}`,
          jobNetwork,
        );

        if (verification.valid) {
          paymentMode = "x402";
          x402Payer = verification.payer;
          console.log(
            `   ✅ X402 payment verified: $${verification.amountPaid} from ${x402Payer}`,
          );
        } else {
          console.log(`   ❌ X402 payment failed: ${verification.error}`);
          return res.status(402).json({
            error: "Payment verification failed",
            details: verification.error,
          });
        }
      }

      // If no valid authentication, return 402 with pricing
      if (paymentMode === "none") {
        console.log(`   💰 No payment - returning X402 pricing`);

        const creatorMarkup = parseFloat(job.creator_markup) || 0;
        const { baseCost, totalPrice } = calculateJobPrice(
          job.workflow_definition,
          creatorMarkup,
        );
        const priceInBaseUnits = dollarsToAtomicString(totalPrice);

        // Extract job parameters
        const workflowDef = job.workflow_definition as {
          nodes?: { type: string; data?: { workflowInputs?: unknown[] } }[];
        };
        const triggerNode = workflowDef?.nodes?.find(
          (n) => n.type === "trigger",
        );
        const jobParameters = (triggerNode?.data?.workflowInputs ||
          []) as Array<{
          name: string;
          type: string;
          required: boolean;
          description?: string;
        }>;

        // Use network-appropriate wallet
        const payTo =
          jobNetwork === "base"
            ? wallet?.baseAddress || config.base.platformWallet
            : wallet?.address || PLATFORM_WALLET;
        const asset = jobNetwork === "base" ? BASE_USDC_ADDRESS : USDC_MINT;
        const feePayer =
          jobNetwork === "base"
            ? BASE_FACILITATOR_FEE_PAYER
            : FACILITATOR_FEE_PAYER;
        const resourceUrl = `${config.publicUrl}/@${username}/${jobSlug}`;

        // Build bodyFields from job parameters for input schema
        const bodyFields: Record<
          string,
          { type: string; required: boolean; description: string }
        > = {};
        for (const param of jobParameters) {
          bodyFields[param.name] = {
            type: param.type,
            required: param.required,
            description: param.description || `Job parameter: ${param.name}`,
          };
        }

        return res.status(402).json({
          x402Version: 1,
          error: "Payment required",
          accepts: [
            {
              scheme: "exact",
              network: jobNetwork,
              maxAmountRequired: priceInBaseUnits,
              resource: resourceUrl,
              description: job.description || `Execute workflow: ${job.name}`,
              mimeType: "application/json",
              payTo: payTo,
              maxTimeoutSeconds: 300,
              asset: asset,
              outputSchema: {
                input: {
                  type: "http",
                  method: "POST",
                  bodyType: "json",
                  bodyFields:
                    Object.keys(bodyFields).length > 0 ? bodyFields : undefined,
                },
                output: {
                  type: "lro",
                  statusUrlField: "statusUrl",
                  runIdField: "runId",
                  responseFields: {
                    success: {
                      type: "boolean",
                      description: "Whether the job was accepted",
                    },
                    runId: {
                      type: "string",
                      description: "Unique identifier for this job run",
                    },
                    statusUrl: {
                      type: "string",
                      description: "URL to poll for job status",
                    },
                    retryAfterSeconds: {
                      type: "number",
                      description: "Suggested polling interval",
                    },
                  },
                  finalResponseFields: {
                    state: {
                      type: "string",
                      enum: ["pending", "processing", "succeeded", "failed"],
                    },
                    response: {
                      type: "object",
                      description: "The final output of the job",
                    },
                    artifactUrl: {
                      type: "string",
                      description:
                        "URL to any generated artifact (if applicable)",
                    },
                  },
                },
              },
              extra: {
                serviceName: "x402.jobs",
                serviceUrl: "https://x402.jobs",
                feePayer: feePayer,
                jobId: job.id,
                jobName: job.name,
                jobSlug: job.slug,
                ownerUsername: username,
                jobParameters,
                pricing: {
                  amount: totalPrice,
                  baseCost,
                  creatorMarkup,
                  currency: "USDC",
                  network: jobNetwork === "base" ? "Base" : "Solana",
                },
              },
            },
          ],
        });
      }

      // Extract workflow inputs from request body
      const workflowInputs = req.body || {};

      // Check wallet for execution
      if (!wallet) {
        return res.status(500).json({
          error: "Job owner has no wallet configured",
        });
      }

      // Extract steps from workflow definition
      const workflowDef = job.workflow_definition || { nodes: [], edges: [] };
      const nodes = workflowDef.nodes || [];
      const edges = workflowDef.edges || [];

      // Build dependency map from edges
      const dependencyMap = new Map<string, string[]>();
      for (const edge of edges) {
        const target = edge.target;
        const source = edge.source;
        if (!dependencyMap.has(target)) {
          dependencyMap.set(target, []);
        }
        const sourceNode = nodes.find((n: any) => n.id === source);
        if (
          sourceNode?.type === "resource" ||
          sourceNode?.type === "transform"
        ) {
          dependencyMap.get(target)!.push(source);
        }
      }

      // Build execution steps from nodes
      const steps = nodes
        .filter((n: any) => n.type === "resource" || n.type === "transform")
        .map((n: any) => ({
          type: n.type,
          nodeId: n.id,
          data: n.data,
          dependencies: dependencyMap.get(n.id) || [],
        }));

      // Get creator wallet addresses for escrow payout (if x402 payment)
      let creatorSolanaWallet: string | undefined;
      let creatorBaseWallet: string | undefined;
      if (paymentMode === "x402") {
        const { data: ownerWallet } = await getSupabase()
          .from("x402_user_wallets")
          .select("address, base_address")
          .eq("user_id", job.user_id)
          .single();
        creatorSolanaWallet = ownerWallet?.address;
        creatorBaseWallet = ownerWallet?.base_address;
      }

      // Calculate pricing for payment fields
      const creatorMarkup = parseFloat(job.creator_markup) || 0;
      const { totalPrice } = calculateJobPrice(
        job.workflow_definition,
        creatorMarkup,
      );

      // Create run record
      const { data: run, error: runError } = await getSupabase()
        .from("x402_job_runs")
        .insert({
          job_id: job.id,
          user_id: job.user_id,
          status: "pending",
          inputs: {
            _webhook: {
              payload: req.body,
              headers: {
                "content-type": req.headers["content-type"],
                "user-agent": req.headers["user-agent"],
              },
              received_at: new Date().toISOString(),
              paymentMode: paymentMode,
              ...(paymentMode === "x402" && {
                x402: {
                  payer: x402Payer,
                  network: jobNetwork,
                },
              }),
            },
          },
          resources_total: steps.length, // Count ALL steps (resources + transforms)
          resources_completed: 0,
          // Payment tracking fields for x402 runs
          ...(paymentMode === "x402" && {
            total_payment: totalPrice,
            creator_markup_earned: creatorMarkup,
            payer_address: x402Payer,
            payment_network: jobNetwork,
            creator_wallet_address: creatorSolanaWallet,
            creator_base_wallet_address: creatorBaseWallet,
          }),
          triggered_by: "webhook",
        })
        .select("id")
        .single();

      if (runError || !run) {
        console.error("Failed to create run:", runError);
        return res.status(500).json({ error: "Failed to create job run" });
      }

      // Build Inngest steps
      const inngestSteps = steps.map((s: any) => {
        if (s.type === "resource") {
          const resource = s.data.resource || s.data;
          const resourceMethod =
            resource.output_schema?.input?.method || "POST";
          return {
            type: s.type,
            nodeId: s.nodeId,
            dependencies: s.dependencies,
            data: {
              resourceId: resource.id,
              resourceUrl: resource.resourceUrl,
              resourceName: resource.name,
              resourcePrice: resource.price || 0,
              resourceNetwork: resource.network || "solana",
              resourceMethod: resourceMethod,
              nodeId: s.nodeId,
              inputs: {
                ...s.data.configuredInputs,
                _webhookPayload: req.body,
              },
            },
          };
        } else {
          return {
            type: s.type,
            nodeId: s.nodeId,
            dependencies: s.dependencies,
            data: {
              nodeId: s.nodeId,
              transformType: s.data.transformType,
              sourceNodeId: s.data.sourceNodeId,
              config: s.data.config || {},
            },
          };
        }
      });

      // Trigger Inngest workflow
      await inngest.send({
        name: "x402/workflow.run",
        data: {
          runId: run.id,
          jobId: job.id,
          userId: job.user_id,
          walletPublicKey: wallet.address,
          walletSecretKey: wallet.solanaSecretBase64,
          baseWalletAddress: wallet?.baseAddress || null,
          baseWalletKey: wallet?.baseSecretBase64 || null,
          jobNetwork: jobNetwork, // Pass job network for platform fee
          steps: inngestSteps,
          triggeredBy: "webhook",
          workflowInputs,
        },
      });

      console.log(`✅ Webhook triggered job run: ${run.id} (${paymentMode})`);

      // Build status URL.
      //
      // HIGH-09 (28-06): URL is HMAC-signed so a leaked URL (via Referer,
      // share button, or log dump) cannot be used to read the paid output.
      // Signature is verified on the corresponding GET handler below.
      const statusUrl = `${config.publicUrl}/@${username}/${jobSlug}/runs/${run.id}/status?${signedStatusQuery(run.id)}`;

      res.status(202).json({
        success: true,
        runId: run.id,
        statusUrl: statusUrl,
        retryAfterSeconds: 2,
        message: "Webhook received, job execution started",
        paymentMode: paymentMode,
        ...(paymentMode === "x402" && {
          paidBy: x402Payer,
          x402Receipt: {
            verified: true,
            network: jobNetwork,
          },
        }),
      });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// HELIUS WEBHOOK ROUTES: For Solana transaction indexing
// ============================================================================

/**
 * POST /webhooks/helius
 *
 * Receive enhanced transaction data from Helius webhooks.
 * Records USDC transfers to known x402 server addresses.
 */
heliusWebhookRouter.post("/", async (req: Request, res: Response) => {
  try {
    console.log(`🔔 Helius webhook received`);

    // Verify webhook secret. Helius sends this as a static
    // "Authorization: Bearer <secret>" header.
    //
    // CRIT-06 hardening (Phase 28 security review):
    //   1. Require the env var. Previously, an unset HELIUS_WEBHOOK_SECRET
    //      meant the endpoint accepted any caller — and the indexer writes
    //      to x402_transactions + increments creator earnings, which feed
    //      leaderboards and the $JOBS reward distribution. Anyone could
    //      forge transfers and inflate stats.
    //   2. Constant-time comparison. The previous `!==` check leaked
    //      per-character timing, enabling secret extraction over time.
    const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(
        "[Helius] HELIUS_WEBHOOK_SECRET is not set — refusing to process webhook",
      );
      return res.status(503).json({
        error: "Helius webhook not configured",
      });
    }

    const authHeader = req.headers["authorization"];
    if (typeof authHeader !== "string") {
      console.warn("[Helius] Missing authorization header");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const expectedAuth = `Bearer ${webhookSecret}`;
    const authBuf = Buffer.from(authHeader);
    const expectedBuf = Buffer.from(expectedAuth);
    if (
      authBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(authBuf, expectedBuf)
    ) {
      console.warn("[Helius] Invalid authorization header");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Process the webhook payload
    const results = await processHeliusWebhook(req.body);

    console.log(
      `✅ Helius webhook processed: ${results.processed} txns, ${results.matched} matched, ${results.errors} errors`,
    );

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Helius webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /webhooks/helius
 *
 * Health check for Helius webhook endpoint.
 */
heliusWebhookRouter.get("/", async (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "x402-indexer-helius",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /@:username/:jobSlug/runs/:runId/status
 *
 * Get run status for a job using nice URL format.
 */
jobsWebhookRouter.get(
  "/@:username/:jobSlug/runs/:runId/status",
  async (req: Request, res: Response) => {
    try {
      const username = req.params.username as string;
      const jobSlug = req.params.jobSlug as string;
      const runId = req.params.runId as string;

      // HIGH-09 (28-06): HMAC signature verification with dual-acceptance
      // rollout. See the sibling handler in webhooksRouter for full notes.
      const sig = req.query.sig as string | undefined;
      const exp = req.query.exp as string | undefined;
      const requireSig = process.env.REQUIRE_STATUS_SIGNATURE === "true";

      if (sig || exp) {
        if (!verifyStatusSignature(runId, sig, exp)) {
          return res.status(401).json({ error: "invalid_signature" });
        }
      } else if (requireSig) {
        return res.status(401).json({ error: "signature_required" });
      }

      // Verify job exists
      const { job, error } = await getJobByUsernameAndSlug(username, jobSlug);
      if (error || !job) {
        return res.status(404).json({ error: error || "Job not found" });
      }

      // Get the run status
      const { data: run, error: runError } = await getSupabase()
        .from("x402_job_runs")
        .select(
          "id, status, error, total_cost, resources_completed, resources_total, completed_at",
        )
        .eq("id", runId)
        .eq("job_id", job.id)
        .single();

      if (runError || !run) {
        return res.status(404).json({ error: "Run not found" });
      }

      // Map status
      let state: "pending" | "processing" | "succeeded" | "failed";
      switch (run.status) {
        case "pending":
          state = "pending";
          break;
        case "running":
          state = "processing";
          break;
        case "completed":
        case "success":
          state = "succeeded";
          break;
        case "failed":
          state = "failed";
          break;
        default:
          state = "processing";
      }

      // Get events
      const { data: events } = await getSupabase()
        .from("x402_job_run_events")
        .select(
          "node_id, output, output_text, status, resource_url, resource_name, sequence, created_at, error",
        )
        .eq("run_id", runId)
        .order("sequence", { ascending: true });

      // Build step logs (obfuscated names to protect job recipes)
      const steps = (events || []).map((e, index) => ({
        name: `Step ${index + 1}`,
        status: e.status as "pending" | "running" | "completed" | "failed",
        sequence: e.sequence,
        ...(e.error && { error: e.error }),
      }));

      // Calculate actual progress from events (use events count, not run.resources_total which may be stale)
      const completedSteps = (events || []).filter(
        (e) => e.status === "completed" || e.status === "success",
      ).length;
      const totalSteps = (events || []).length;

      // Collect failed errors (obfuscated)
      // Note: sequence is 0-indexed, step names are 1-indexed
      const failedStepsData = (events || []).filter(
        (e) => e.status === "failed" && e.error,
      );
      const failedErrors = failedStepsData
        .map((e, i) => `Step ${(e.sequence ?? i) + 1}: ${e.error}`)
        .slice(0, 5);

      // Get final output
      let response: any = null;
      let artifactUrl: string | undefined;

      if (
        run.status === "completed" ||
        run.status === "success" ||
        run.status === "failed"
      ) {
        const eventsDesc = [...(events || [])].reverse();
        const lastEventWithOutput = eventsDesc.find(
          (e) => e.output || e.output_text,
        );

        if (lastEventWithOutput) {
          response =
            lastEventWithOutput.output || lastEventWithOutput.output_text;

          if (typeof response === "object") {
            artifactUrl = response?.artifactUrl || response?.imageUrl;
          } else if (typeof response === "string") {
            try {
              const parsed = JSON.parse(response);
              artifactUrl = parsed.artifactUrl || parsed.imageUrl;
            } catch {
              // Not JSON
            }
          }
        }
      }

      res.json({
        state,
        runId: run.id,
        progress: {
          completed: completedSteps,
          total: totalSteps,
        },
        steps, // Obfuscated step names
        ...(state === "succeeded" && {
          response,
          artifactUrl,
        }),
        ...(state === "failed" && {
          error:
            run.error ||
            (failedErrors.length > 0
              ? failedErrors.join("; ")
              : "Job execution failed"),
          failedSteps: failedErrors,
        }),
        ...(run.completed_at && { completedAt: run.completed_at }),
      });
    } catch (error) {
      console.error("Run status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
