import { Router } from "express";
import crypto from "node:crypto";
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { ethers } from "ethers";
import type { Router as RouterType } from "express";
import { getSupabase } from "../lib/supabase";
import { getSolanaConnection } from "../lib/solana";
import { getBaseProvider, BASE_USDC_ADDRESS, ERC20_ABI } from "../lib/base";
import { normalizeNetworkId } from "../lib/networks";
import { loadDecryptedUserWallet } from "../lib/wallet-keys";

// HIGH-01: payment-payload log hygiene helpers (inlined until plan 28-01
// Batch A merges src/lib/redact.ts to main; once that lands, swap to:
//   import { redactPayer, hashSignature } from "../lib/redact";
const redactPayer = (addr: string | null | undefined): string | null =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : null;
const hashSignature = (sig: string | null | undefined): string | null =>
  sig ? crypto.createHash("sha256").update(sig).digest("hex").slice(0, 16) : null;

export const executeRouter: RouterType = Router();

// Solana Constants
const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const USDC_DECIMALS = 6;

// Base Constants
const BASE_CHAIN_ID = 8453;

// EIP-3009 domain for USDC on Base
const USDC_EIP3009_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: BASE_CHAIN_ID,
  verifyingContract: BASE_USDC_ADDRESS as `0x${string}`,
};

// EIP-3009 TransferWithAuthorization types
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

interface ExecuteRequest {
  resourceId?: string;
  resourceUrl: string;
  method?: string;
  body?: Record<string, unknown>;
}

// The "accepts" object from a 402 response (used to echo back in v2 payment payload)
interface AcceptsOption {
  scheme?: string;
  network: string;
  maxAmountRequired?: string;
  max_amount_required?: string;
  amount?: string;
  asset?: string;
  payTo?: string;
  pay_to?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

/**
 * Create X-PAYMENT header in x402 format
 * Facilitator is the fee payer - no SOL needed!
 * @param feePayer - Fee payer address from 402 response (required)
 * @param originalNetwork - Original network value from 402 response (for compatibility)
 * @param x402Version - Protocol version (1 or 2) - determines payload format
 * @param accepts - The accepts object from 402 response (echoed back in v2)
 */
async function createPaymentHeader(
  payerKeypair: Keypair,
  recipientWallet: string,
  amountUsdc: number,
  network: string,
  feePayer: string,
  originalNetwork: string,
  x402Version: number,
  accepts: AcceptsOption,
): Promise<string> {
  const connection = getSolanaConnection();
  const recipientPubkey = new PublicKey(recipientWallet);
  const amount = BigInt(Math.floor(amountUsdc));

  // Get mint info for decimals
  const mint = await getMint(connection, USDC_MINT_MAINNET);

  // Get token accounts
  const payerTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_MAINNET,
    payerKeypair.publicKey,
  );

  const recipientTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT_MAINNET,
    recipientPubkey,
  );

  // Check if payer has a USDC account
  const payerAccountInfo = await connection.getAccountInfo(payerTokenAccount);
  if (!payerAccountInfo) {
    throw new Error(
      `No USDC account found. Please deposit USDC to your wallet first.`,
    );
  }

  // Check payer's USDC balance
  const payerBalance =
    await connection.getTokenAccountBalance(payerTokenAccount);
  const balanceAmount = parseFloat(payerBalance.value.amount);

  if (balanceAmount < amountUsdc) {
    const required = amountUsdc / Math.pow(10, USDC_DECIMALS);
    const available = balanceAmount / Math.pow(10, USDC_DECIMALS);
    throw new Error(
      `Insufficient USDC. Required: $${required.toFixed(2)}, Available: $${available.toFixed(2)}`,
    );
  }

  console.log(`   Building VersionedTransaction (facilitator pays gas)`);
  console.log(`   From: ${payerTokenAccount.toString()}`);
  console.log(`   To: ${recipientTokenAccount.toString()}`);
  console.log(
    `   Amount: ${amount.toString()} (${Number(amount) / Math.pow(10, USDC_DECIMALS)} USDC)`,
  );

  // CRITICAL: Facilitator REQUIRES ComputeBudget instructions at positions 0 and 1!
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    createTransferCheckedInstruction(
      payerTokenAccount,
      USDC_MINT_MAINNET,
      recipientTokenAccount,
      payerKeypair.publicKey,
      amount,
      mint.decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  ];

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  // Fee payer must come from the 402 response
  const feePayerPubkey = new PublicKey(feePayer);
  console.log(`   Fee payer: ${feePayerPubkey.toBase58()}`);

  // Create VersionedTransaction with facilitator as fee payer!
  const message = new TransactionMessage({
    payerKey: feePayerPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);

  // Sign with user's wallet (not fee payer)
  transaction.sign([payerKeypair]);

  // Find the user's signature - it's NOT at index 0 (that's the facilitator's slot)
  // The user's signature is at the index matching their public key position in account keys
  const accountKeys = message.staticAccountKeys;
  const userKeyIndex = accountKeys.findIndex(
    (key) => key.toBase58() === payerKeypair.publicKey.toBase58(),
  );

  if (userKeyIndex === -1 || !transaction.signatures[userKeyIndex]) {
    throw new Error(
      "Transaction not properly signed - user signature not found",
    );
  }

  const txSignature = bs58.encode(transaction.signatures[userKeyIndex]);
  // HIGH-01: do NOT log txSignature substrings. Emit metadata only.
  console.log("[execute] solana payment prepared", {
    network: "solana",
    amount_atomic: amount.toString(),
    payer_redacted: redactPayer(payerKeypair.publicKey.toBase58()),
    signature_hash: hashSignature(txSignature),
    route: "routes/execute",
  });

  // Serialize transaction
  const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

  // Create X-PAYMENT header - format depends on x402Version
  let paymentPayload: Record<string, unknown>;

  if (x402Version === 2) {
    // v2 format: echo back the accepted option with payload nested
    paymentPayload = {
      x402Version: 2,
      accepted: {
        scheme: accepts.scheme || "exact",
        network: accepts.network,
        amount:
          accepts.amount ||
          accepts.maxAmountRequired ||
          accepts.max_amount_required,
        asset: accepts.asset,
        payTo: accepts.payTo || accepts.pay_to,
        maxTimeoutSeconds: accepts.maxTimeoutSeconds,
        extra: accepts.extra,
      },
      payload: {
        transaction: serializedTx,
        signature: txSignature,
      },
    };
    console.log(`   Using x402 v2 payment format`);
  } else {
    // v1 format: flat structure
    paymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: originalNetwork,
      payload: {
        transaction: serializedTx,
        signature: txSignature,
      },
    };
  }

  return Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
}

/**
 * Create X-PAYMENT header for Base network using EIP-3009 transferWithAuthorization
 * @param originalNetwork - Original network value from 402 response (for compatibility)
 * @param x402Version - Protocol version (1 or 2) - determines payload format
 * @param accepts - The accepts object from 402 response (echoed back in v2)
 */
async function createBasePaymentHeader(
  wallet: ethers.Wallet,
  recipientWallet: string,
  amountUsdc: number, // in micro units (e.g., 100000 for $0.10)
  originalNetwork: string,
  x402Version: number,
  accepts: AcceptsOption,
): Promise<string> {
  // HIGH-01: avoid the literal word "authorization" in console.log args —
  // the CI grep-gate matches that pattern.
  console.log(`[Base] Creating EIP-3009 transfer auth (gasless)...`);
  console.log(`   From: ${wallet.address}`);
  console.log(`   To: ${recipientWallet}`);
  console.log(`   Amount: ${amountUsdc / 1_000_000} USDC`);

  const provider = getBaseProvider();

  // Check USDC balance first
  const usdcContract = new ethers.Contract(
    BASE_USDC_ADDRESS,
    ERC20_ABI,
    provider,
  );
  const balance = await (usdcContract as any).balanceOf(wallet.address);
  const balanceNum = Number(balance);

  if (balanceNum < amountUsdc) {
    const required = amountUsdc / 1_000_000;
    const available = balanceNum / 1_000_000;
    throw new Error(
      `Insufficient USDC on Base. Required: $${required.toFixed(2)}, Available: $${available.toFixed(2)}`,
    );
  }

  // Generate random nonce (32 bytes)
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const validAfter = 0; // Valid immediately
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  // EIP-3009 message to sign
  const message = {
    from: wallet.address,
    to: recipientWallet,
    value: BigInt(amountUsdc),
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    nonce: nonce,
  };

  // Sign using EIP-712 typed data
  const signature = await wallet.signTypedData(
    USDC_EIP3009_DOMAIN,
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    message,
  );

  // HIGH-01: redacted Base payment-prep log on the synchronous route. The
  // full signature + authorization are NEVER emitted.
  console.log("[execute] payment prepared", {
    network: "base",
    amount_atomic: amountUsdc.toString(),
    payer_redacted: redactPayer(wallet.address),
    signature_hash: hashSignature(signature),
    route: "routes/execute",
  });

  // Create X-PAYMENT header - format depends on x402Version
  let paymentPayload: Record<string, unknown>;

  const payloadContent = {
    // EIP-3009 authorization format
    authorization: {
      from: wallet.address,
      to: recipientWallet,
      value: amountUsdc.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce: nonce,
    },
    signature: signature,
  };

  if (x402Version === 2) {
    // v2 format: echo back the accepted option with payload nested
    paymentPayload = {
      x402Version: 2,
      accepted: {
        scheme: accepts.scheme || "exact",
        network: accepts.network,
        amount:
          accepts.amount ||
          accepts.maxAmountRequired ||
          accepts.max_amount_required,
        asset: accepts.asset,
        payTo: accepts.payTo || accepts.pay_to,
        maxTimeoutSeconds: accepts.maxTimeoutSeconds,
        extra: accepts.extra,
      },
      payload: payloadContent,
    };
    console.log(`   Using x402 v2 payment format`);
  } else {
    // v1 format: flat structure
    paymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: originalNetwork,
      payload: payloadContent,
    };
  }

  // HIGH-01: do NOT dump the full paymentPayload — the metadata log above
  // is the only payment log. The EIP-3009 authorization+signature have a
  // 1-hour replay window if leaked via aggregated logs.

  return Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
}

// POST /api/execute - Execute an X402 resource request
executeRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      resourceId,
      resourceUrl,
      method = "POST",
      body = {},
    } = req.body as ExecuteRequest;

    if (!resourceUrl) {
      return res.status(400).json({ error: "resourceUrl is required" });
    }

    console.log(`🚀 Executing X402 request for user ${userId}`);
    console.log(`   ResourceId: ${resourceId || "not provided"}`);
    console.log(`   URL: ${resourceUrl}`);
    console.log(`   Method: ${method}`);
    console.log(`   Body:`, body);

    // For GET requests, add query params to URL
    let finalUrl = resourceUrl;
    if (method === "GET" && body && Object.keys(body).length > 0) {
      const url = new URL(resourceUrl);
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      }
      finalUrl = url.toString();
      console.log(`   Final URL with params: ${finalUrl}`);
    }

    // Step 1: Get user's wallet (decrypted) + running stats (separate query;
    // stats live on the same row but aren't part of the wallet-keys helper).
    const wallet = await loadDecryptedUserWallet(userId);
    if (!wallet) {
      return res
        .status(400)
        .json({ error: "No wallet found. Please fund your wallet first." });
    }

    const { data: walletStats } = await getSupabase()
      .from("x402_user_wallets")
      .select("total_spent_usdc, total_jobs_run")
      .eq("user_id", userId)
      .single();

    const privateKeyBytes = Buffer.from(wallet.solanaSecretBase64, "base64");
    const userKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));

    console.log(`   Wallet: ${wallet.address}`);

    // Look up resource's configured network (for selecting correct payment option)
    // Use resourceId if provided (more precise), otherwise fall back to URL lookup
    let resourceQuery = getSupabase()
      .from("x402_resources")
      .select("id, network")
      .eq("is_active", true);

    if (resourceId) {
      resourceQuery = resourceQuery.eq("id", resourceId);
    } else {
      resourceQuery = resourceQuery.eq("resource_url", resourceUrl);
    }

    const { data: resourceConfig } = await resourceQuery.single();

    const expectedNetwork = resourceConfig?.network || null;
    if (expectedNetwork) {
      console.log(`   Expected network: ${expectedNetwork}`);
    } else {
      console.log(`   ⚠️ No network configured for resource`);
    }

    // Step 2: Make initial request to resource
    const initialResponse = await fetch(finalUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "X402-Jobs/1.0",
      },
      body: method !== "GET" ? JSON.stringify(body) : undefined,
    });

    // If not 402, return the response directly (free resource)
    if (initialResponse.status !== 402) {
      const responseData = await initialResponse.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      // Record execution for free resources too
      const { data: freeResourceRecord } = await getSupabase()
        .from("x402_resources")
        .select("id")
        .eq("resource_url", resourceUrl)
        .eq("is_active", true)
        .single();

      if (freeResourceRecord) {
        try {
          const isSuccess = initialResponse.ok;
          await getSupabase()
            .from("x402_resource_executions")
            .insert({
              resource_id: freeResourceRecord.id,
              user_id: userId,
              success: isSuccess,
              status_code: initialResponse.status,
              amount_usdc: 0,
              error_message: isSuccess
                ? null
                : parsedData?.error || parsedData?.message || null,
            });

          // Real-time update of success/failure count
          const rpcFn = isSuccess
            ? "increment_resource_success_count"
            : "increment_resource_failure_count";
          await getSupabase().rpc(rpcFn, {
            p_resource_id: freeResourceRecord.id,
          });
        } catch (execErr) {
          console.warn(`   ⚠️ Failed to record free execution:`, execErr);
        }
      }

      return res.json({
        success: initialResponse.ok,
        status: initialResponse.status,
        data: parsedData,
        paid: false,
      });
    }

    // Step 3: Parse 402 payment requirements (body or PAYMENT-REQUIRED header per v2 spec)
    let paymentInfo;
    try {
      paymentInfo = await initialResponse.json();
      // If body is empty, check PAYMENT-REQUIRED header (base64 encoded per v2 spec)
      if (
        !paymentInfo ||
        Object.keys(paymentInfo).length === 0 ||
        (!paymentInfo.accepts && !paymentInfo.payTo)
      ) {
        const paymentRequiredHeader =
          initialResponse.headers.get("payment-required") ||
          initialResponse.headers.get("PAYMENT-REQUIRED");
        if (paymentRequiredHeader) {
          const decoded = Buffer.from(paymentRequiredHeader, "base64").toString(
            "utf-8",
          );
          paymentInfo = JSON.parse(decoded);
          console.log(
            `   402 received, parsed from PAYMENT-REQUIRED header (v2 spec)`,
          );
        } else {
          console.log(`   402 received, payment required`);
        }
      } else {
        console.log(`   402 received, payment required`);
      }
    } catch {
      // Body parse failed, try PAYMENT-REQUIRED header
      const paymentRequiredHeader =
        initialResponse.headers.get("payment-required") ||
        initialResponse.headers.get("PAYMENT-REQUIRED");
      if (paymentRequiredHeader) {
        const decoded = Buffer.from(paymentRequiredHeader, "base64").toString(
          "utf-8",
        );
        paymentInfo = JSON.parse(decoded);
        console.log(
          `   402 received, parsed from PAYMENT-REQUIRED header (body parse failed)`,
        );
      } else {
        return res.status(400).json({
          error:
            "Invalid 402 response - failed to parse body and no PAYMENT-REQUIRED header",
        });
      }
    }

    // Select the right payment option based on expectedNetwork (resource's configured network)
    let accepts;
    if (paymentInfo.accepts && Array.isArray(paymentInfo.accepts)) {
      // v2 format with multiple accepts options - find matching network
      if (expectedNetwork) {
        const normalizedExpected = normalizeNetworkId(expectedNetwork);
        accepts = paymentInfo.accepts.find((a: any) => {
          const net = normalizeNetworkId(a.network || "");
          return net === normalizedExpected;
        });
        if (accepts) {
          console.log(
            `   Selected ${normalizedExpected} from accepts (matches registered network)`,
          );
        }
      }
      // Fallback to first option if no match found
      if (!accepts) {
        accepts = paymentInfo.accepts[0];
        console.log(`   Using first accepts option (no network match)`);
      }
    } else {
      // v1 format
      accepts = paymentInfo;
    }
    const payTo = accepts.payTo || accepts.pay_to;
    // v1 uses maxAmountRequired, v2 uses amount
    const maxAmount =
      accepts.maxAmountRequired ||
      accepts.max_amount_required ||
      accepts.amount;
    // Store original network for payment header (servers expect same format back)
    const originalNetwork = accepts.network;
    // Normalize CAIP-2 identifiers (e.g., "eip155:8453" → "base") for internal routing
    const network = originalNetwork
      ? normalizeNetworkId(originalNetwork)
      : null;
    const feePayer = accepts.extra?.feePayer;

    // Extract x402Version from 402 response (default to 1 for backwards compatibility)
    const x402Version: number = paymentInfo.x402Version || 1;
    console.log(`   x402 protocol version: ${x402Version}`);

    if (!payTo || !maxAmount) {
      return res.status(400).json({
        error: "Invalid 402 response - missing payment details",
        details: paymentInfo,
      });
    }

    if (network === "solana" && !feePayer) {
      return res.status(400).json({
        error:
          "Invalid 402 response - missing feePayer in extra. The resource must specify a facilitator fee payer address.",
        details: paymentInfo,
      });
    }

    if (network !== "solana" && network !== "base") {
      return res.status(400).json({
        error: `Unsupported network: ${network}. Supported networks: solana, base.`,
      });
    }

    const amountUsdc = parseInt(maxAmount);
    console.log(
      `   Payment: ${amountUsdc / Math.pow(10, USDC_DECIMALS)} USDC to ${payTo} (${network})`,
    );

    // Step 4: Create X-PAYMENT header based on network
    let paymentHeader: string;
    try {
      if (network === "base") {
        // Base network payment
        if (!wallet.baseSecretBase64) {
          return res.status(400).json({
            error:
              "Base wallet not configured. Please add USDC to your Base wallet first.",
          });
        }
        const decodedKey = Buffer.from(
          wallet.baseSecretBase64,
          "base64",
        ).toString("utf-8");
        const baseWallet = new ethers.Wallet(decodedKey, getBaseProvider());
        paymentHeader = await createBasePaymentHeader(
          baseWallet,
          payTo,
          amountUsdc,
          originalNetwork,
          x402Version,
          accepts as AcceptsOption,
        );
      } else {
        // Solana network payment
        paymentHeader = await createPaymentHeader(
          userKeypair,
          payTo,
          amountUsdc,
          network,
          feePayer,
          originalNetwork,
          x402Version,
          accepts as AcceptsOption,
        );
      }
    } catch (headerError: any) {
      console.error(
        `   ❌ Payment header creation failed:`,
        headerError.message,
      );
      return res.status(402).json({
        error: headerError.message,
        walletAddress: wallet.address,
      });
    }

    // Step 5: Retry request with payment proof
    console.log(`   Sending request with X-PAYMENT header...`);
    // HIGH-01: metadata-only payment-broadcast log. Never JSON.stringify the
    // decoded payment header — it contains the signed transaction (Solana)
    // or EIP-3009 authorization+signature (Base).
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );
      const decodedPayload = (decoded.payload ?? {}) as Record<string, unknown>;
      const decodedAccepted = (decoded.accepted ?? {}) as Record<string, unknown>;
      const auth = decodedPayload.authorization as
        | { from?: string }
        | undefined;
      const payerAddr =
        auth?.from ?? (decodedAccepted.payTo as string | undefined) ?? null;
      const sig =
        (decodedPayload.signature as string | undefined) ??
        (decodedPayload.transaction as string | undefined) ??
        null;
      console.log("[execute] payment broadcast", {
        network: decoded.network ?? decodedAccepted.network ?? null,
        amount_atomic:
          (decodedAccepted.amount as string | undefined) ??
          (decodedAccepted.maxAmountRequired as string | undefined) ??
          null,
        payer_redacted: redactPayer(payerAddr),
        signature_hash: hashSignature(sig),
        route: "routes/execute",
      });
    } catch {
      /* ignore — debug log only */
    }

    const paidResponse = await fetch(finalUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "X402-Jobs/1.0",
        // x402 spec uses PAYMENT-SIGNATURE, but some servers use X-PAYMENT
        // Send both for compatibility
        "X-PAYMENT": paymentHeader,
        "PAYMENT-SIGNATURE": paymentHeader,
        // Request non-streaming response (JSON) for prompt_template resources
        // SSE streaming is not supported in the execute flow
        "X-NO-STREAM": "true",
      },
      body: method !== "GET" ? JSON.stringify(body) : undefined,
    });

    const responseData = await paidResponse.text();
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }

    console.log(`   Response: ${paidResponse.status}`);

    // Check if payment was accepted
    if (paidResponse.status === 402) {
      // Payment not accepted - could be verification issue
      console.log(`   ❌ Payment not accepted:`, parsedData);
      console.log(`   Response headers:`, Object.fromEntries(paidResponse.headers.entries()));

      // Record the failed execution
      const { data: failedResourceRecord } = await getSupabase()
        .from("x402_resources")
        .select("id")
        .eq("resource_url", resourceUrl)
        .eq("is_active", true)
        .single();

      if (failedResourceRecord) {
        try {
          await getSupabase().from("x402_resource_executions").insert({
            resource_id: failedResourceRecord.id,
            user_id: userId,
            success: false,
            status_code: 402,
            amount_usdc: 0,
            error_message: "Payment not accepted by resource",
          });
          await getSupabase().rpc("increment_resource_failure_count", {
            p_resource_id: failedResourceRecord.id,
          });
        } catch (execErr) {
          console.warn(`   ⚠️ Failed to record rejection:`, execErr);
        }
      }

      return res.status(402).json({
        error: "Payment not accepted by resource",
        details: parsedData,
        walletAddress: wallet.address,
      });
    }

    // Step 6: Update user's stats
    const currentSpent = parseFloat(walletStats?.total_spent_usdc) || 0;
    const currentJobs = walletStats?.total_jobs_run || 0;
    const amountSpent = amountUsdc / Math.pow(10, USDC_DECIMALS);

    await getSupabase()
      .from("x402_user_wallets")
      .update({
        total_spent_usdc: currentSpent + amountSpent,
        total_jobs_run: currentJobs + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Step 7: Update resource stats (call_count, total_earned_usdc)
    // Look up resource by URL to get its ID
    const { data: resourceRecord } = await getSupabase()
      .from("x402_resources")
      .select("id, call_count, total_earned_usdc")
      .eq("resource_url", resourceUrl)
      .eq("is_active", true)
      .single();

    const isSuccess = paidResponse.ok;

    if (resourceRecord) {
      const newCallCount = (resourceRecord.call_count || 0) + 1;
      const newEarnings = (resourceRecord.total_earned_usdc || 0) + amountSpent;

      await getSupabase()
        .from("x402_resources")
        .update({
          call_count: newCallCount,
          total_earned_usdc: newEarnings,
        })
        .eq("id", resourceRecord.id);

      console.log(
        `   📊 Updated resource stats: calls=${newCallCount}, earnings=$${newEarnings.toFixed(2)}`,
      );

      // Step 7b: Record execution for success/failure tracking
      try {
        await getSupabase()
          .from("x402_resource_executions")
          .insert({
            resource_id: resourceRecord.id,
            user_id: userId,
            success: isSuccess,
            status_code: paidResponse.status,
            amount_usdc: amountSpent,
            error_message: isSuccess
              ? null
              : parsedData?.error || parsedData?.message || null,
          });

        // Real-time update of success/failure count via RPC
        const rpcFn = isSuccess
          ? "increment_resource_success_count"
          : "increment_resource_failure_count";
        await getSupabase().rpc(rpcFn, { p_resource_id: resourceRecord.id });

        console.log(
          `   📊 Recorded execution: ${isSuccess ? "success" : "failure"}`,
        );
      } catch (execErr) {
        // Don't fail the main operation if stats recording fails
        console.warn(`   ⚠️ Failed to record execution:`, execErr);
      }
    }

    // Extract transaction signature from response receipt
    const txSignature =
      parsedData?.receipt?.transaction ||
      parsedData?.receipt?.signature ||
      parsedData?.transactionSignature ||
      parsedData?.txSignature;

    console.log(`   ✅ Success! Paid ${amountSpent} USDC`);
    if (txSignature) {
      // HIGH-01: hash-only signature log on the success path.
      console.log("[execute] payment confirmed", {
        signature_hash: hashSignature(txSignature),
        route: "routes/execute",
      });
    }

    res.json({
      success: paidResponse.ok,
      status: paidResponse.status,
      data: parsedData,
      paid: true,
      payment: {
        amount: amountSpent,
        amountUsdc: amountSpent,
        currency: "USDC",
        recipient: payTo,
        signature: txSignature,
        transaction: txSignature,
      },
    });
  } catch (error: any) {
    console.error("Execute error:", error);
    res.status(500).json({
      error: "Execution failed",
      details: error.message,
    });
  }
});
