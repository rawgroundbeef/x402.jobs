/**
 * Escrow Release Endpoint
 *
 * Called by Escrowputer's escrow_release webhook command to release bounty funds to builders.
 * This endpoint uses Escrowputer's wallet to transfer USDC to the recipient.
 */

import { Router, type Router as RouterType } from "express";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { config } from "../config";
import bs58 from "bs58";
import crypto from "crypto";

export const escrowRouter: RouterType = Router();

// USDC mint on Solana mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_DECIMALS = 6;

// Escrowputer wallet (loaded from env)
function getEscrowWallet(): Keypair | null {
  const secretKey = process.env.ESCROWPUTER_WALLET_SECRET_KEY;
  if (!secretKey) {
    console.error("ESCROWPUTER_WALLET_SECRET_KEY not configured");
    return null;
  }

  try {
    let decoded: Uint8Array;
    const trimmed = secretKey.trim();

    // Try JSON array format first (e.g., [1,2,3,...])
    if (trimmed.startsWith("[")) {
      const arr = JSON.parse(trimmed);
      decoded = new Uint8Array(arr);
    }
    // Try hex (128 chars = 64 bytes, all hex chars)
    else if (trimmed.length === 128 && /^[0-9a-fA-F]+$/.test(trimmed)) {
      decoded = Buffer.from(trimmed, "hex");
    }
    // Try base64 (contains +, /, or =)
    else if (
      trimmed.includes("+") ||
      trimmed.includes("/") ||
      trimmed.includes("=")
    ) {
      decoded = Buffer.from(trimmed, "base64");
    }
    // Try base58
    else {
      decoded = bs58.decode(trimmed);
    }

    // Validate key length (should be 64 bytes for Solana keypair)
    if (decoded.length !== 64) {
      throw new Error(`Invalid key length: ${decoded.length} bytes`);
    }

    return Keypair.fromSecretKey(decoded);
  } catch (e) {
    console.error("Invalid ESCROWPUTER_WALLET_SECRET_KEY:", e);
    return null;
  }
}

// Webhook secret for authentication.
//
// HIGH-06: use crypto.timingSafeEqual with a length pre-check so that an
// adversary cannot extract the secret via response-time side-channel. The
// helper also enforces that ESCROW_WEBHOOK_SECRET is configured — no
// optional/silent-pass path remains.
function validateWebhookSecret(providedSecret: string): boolean {
  const expectedSecret = process.env.ESCROW_WEBHOOK_SECRET;
  if (!expectedSecret || typeof expectedSecret !== "string") {
    console.error(
      "[escrow] ESCROW_WEBHOOK_SECRET not configured; refusing webhook",
    );
    return false;
  }
  const providedBuf = Buffer.from(providedSecret ?? "", "utf8");
  const expectedBuf = Buffer.from(expectedSecret, "utf8");
  // Length check first — timingSafeEqual requires equal-length buffers.
  // A length mismatch is unambiguously not a match, so an early return here
  // does not leak which character differed.
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * POST /api/escrow/release
 *
 * Releases escrow funds to a recipient.
 * Called by Escrowputer's escrow_release webhook command.
 *
 * Body:
 * - recipient_address: Solana wallet address to send funds to
 * - amount: Amount in USDC to send
 * - request_id: Hiring request ID (for logging/tracking)
 * - webhook_secret: Secret to authenticate the request
 */
escrowRouter.post("/release", async (req, res) => {
  const { recipient_address, amount, request_id, webhook_secret } = req.body;

  // Validate webhook secret
  if (!webhook_secret || !validateWebhookSecret(webhook_secret)) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }

  // Validate inputs
  if (!recipient_address || typeof recipient_address !== "string") {
    return res.status(400).json({ error: "recipient_address is required" });
  }

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  // Get escrow wallet
  const escrowWallet = getEscrowWallet();
  if (!escrowWallet) {
    return res.status(500).json({ error: "Escrow wallet not configured" });
  }

  try {
    // Validate recipient address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipient_address);
    } catch {
      return res.status(400).json({ error: "Invalid recipient_address" });
    }

    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const amountInSmallestUnit = Math.round(
      amount * Math.pow(10, USDC_DECIMALS),
    );

    console.log(`💸 Escrow Release: $${amount} USDC to ${recipient_address}`);
    console.log(`   Request ID: ${request_id || "N/A"}`);

    // Get escrow's USDC token account
    const escrowUsdcAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      escrowWallet.publicKey,
    );

    // Get or create recipient's USDC token account
    const recipientUsdcAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      recipientPubkey,
    );

    // Check if recipient token account exists
    const instructions = [];
    try {
      await getAccount(connection, recipientUsdcAccount);
    } catch {
      // Create the token account if it doesn't exist
      instructions.push(
        createAssociatedTokenAccountInstruction(
          escrowWallet.publicKey, // payer
          recipientUsdcAccount, // ata
          recipientPubkey, // owner
          USDC_MINT, // mint
        ),
      );
    }

    // Add transfer instruction
    instructions.push(
      createTransferInstruction(
        escrowUsdcAccount, // source
        recipientUsdcAccount, // destination
        escrowWallet.publicKey, // owner
        amountInSmallestUnit, // amount
        [], // multiSigners
        TOKEN_PROGRAM_ID,
      ),
    );

    // Build and send transaction
    const { Transaction } = await import("@solana/web3.js");
    const transaction = new Transaction().add(...instructions);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = escrowWallet.publicKey;

    transaction.sign(escrowWallet);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    );

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(`   ✅ Escrow released! Tx: ${signature}`);

    res.json({
      success: true,
      transaction_hash: signature,
      amount,
      recipient: recipient_address,
      message: `Successfully released $${amount} USDC to ${recipient_address.substring(0, 8)}...`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ❌ Escrow release failed: ${errorMsg}`);
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

/**
 * GET /api/escrow/balance
 *
 * Returns the current USDC balance of the escrow wallet.
 * Useful for monitoring.
 */
escrowRouter.get("/balance", async (req, res) => {
  const escrowWallet = getEscrowWallet();
  if (!escrowWallet) {
    return res.status(500).json({ error: "Escrow wallet not configured" });
  }

  try {
    const connection = new Connection(config.solana.rpcUrl, "confirmed");

    const escrowUsdcAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      escrowWallet.publicKey,
    );

    const account = await getAccount(connection, escrowUsdcAccount);
    const balance = Number(account.amount) / Math.pow(10, USDC_DECIMALS);

    res.json({
      address: escrowWallet.publicKey.toBase58(),
      usdc_balance: balance,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});
