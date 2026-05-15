import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import bs58 from "bs58";
import { getSolanaConnection, USDC_MINT } from "./solana";

// USDC has 6 decimals.
const USDC_DECIMALS = 6;
const MICRO_PER_USDC = 10n ** BigInt(USDC_DECIMALS); // 1_000_000n

/**
 * Per-call cap on outbound fee-wallet transfers (Phase 28 CRIT-04).
 *
 * Defaults to $1000. The previous implementation had NO cap, which meant
 * a single compromised admin email (MED-14) could drain the entire fee
 * collection wallet in one transaction. With the cap, any single transfer
 * tops out at this amount and an attacker has to make many noisy calls
 * instead of one quiet one.
 *
 * Operators can raise/lower this via FEE_WALLET_MAX_PER_TRANSFER_USDC.
 * For routine refunds this is generous; if a legitimate refund needs to
 * exceed it, split into multiple transfers or bump the env var.
 */
const MAX_PER_TRANSFER_USDC = parseFloat(
  process.env.FEE_WALLET_MAX_PER_TRANSFER_USDC || "1000",
);

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Convert a USDC amount (decimal) to atomic micro-USDC (bigint) without
 * floating-point drift. The previous implementation used
 * `BigInt(Math.round(amountUsdc * 1_000_000))` which silently lost
 * precision for many decimal inputs (Phase 28 CRIT-04).
 *
 * Goes through `toFixed(USDC_DECIMALS)` to land on a guaranteed-6-decimal
 * string, then parses the integer and fractional parts as BigInt.
 *
 * Examples:
 *   12.5     → "12.500000" → 12_500_000n
 *   0.000001 → "0.000001"  →         1n
 *   1234.89  → "1234.890000" → 1_234_890_000n
 *
 * Exported for unit testing.
 */
export function usdcToMicroUnits(amountUsdc: number): bigint {
  if (!Number.isFinite(amountUsdc) || amountUsdc < 0) {
    throw new Error(`Invalid USDC amount: ${amountUsdc}`);
  }
  const fixed = amountUsdc.toFixed(USDC_DECIMALS);
  const [whole, frac = ""] = fixed.split(".");
  return (
    BigInt(whole!) * MICRO_PER_USDC +
    BigInt(frac.padEnd(USDC_DECIMALS, "0"))
  );
}

/**
 * Format atomic micro-USDC (bigint) as a human-readable USDC string.
 * For logging and error messages only — never use this to drive
 * downstream amount calculations.
 *
 * Exported for unit testing.
 */
export function microUnitsToUsdcDisplay(microUnits: bigint): string {
  const whole = microUnits / MICRO_PER_USDC;
  const frac = microUnits % MICRO_PER_USDC;
  return `${whole.toString()}.${frac.toString().padStart(USDC_DECIMALS, "0")}`;
}

/**
 * Get the fee collection wallet keypair from environment.
 * Supports both base58 and hex formats.
 */
function getFeeCollectionKeypair(): Keypair | null {
  const privateKey = process.env.FEE_COLLECTION_PRIVATE_KEY;
  if (!privateKey) {
    console.error("[USDC Transfer] FEE_COLLECTION_PRIVATE_KEY not set");
    return null;
  }

  try {
    const trimmedKey = privateKey.trim();
    let secretKey: Uint8Array;

    // Check if it's hex format (128 chars = 64 bytes in hex)
    if (trimmedKey.length === 128 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      // Hex format
      secretKey = Buffer.from(trimmedKey, "hex");
      console.log(`[USDC Transfer] Decoded hex key: ${secretKey.length} bytes`);
    } else {
      // Try base58 format
      secretKey = bs58.decode(trimmedKey);
      console.log(
        `[USDC Transfer] Decoded base58 key: ${secretKey.length} bytes`,
      );
    }

    if (secretKey.length !== 64) {
      console.error(
        `[USDC Transfer] Invalid key length: ${secretKey.length} bytes (expected 64)`,
      );
      return null;
    }

    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(
      `[USDC Transfer] Keypair public key: ${keypair.publicKey.toBase58()}`,
    );

    return keypair;
  } catch (error) {
    console.error(
      "[USDC Transfer] Invalid FEE_COLLECTION_PRIVATE_KEY format:",
      error,
    );
    return null;
  }
}

/**
 * Get or create associated token account for USDC.
 */
async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
): Promise<{
  address: PublicKey;
  instruction?: ReturnType<typeof createAssociatedTokenAccountInstruction>;
}> {
  const associatedToken = await getAssociatedTokenAddress(mint, owner);

  try {
    await getAccount(connection, associatedToken);
    return { address: associatedToken };
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Account doesn't exist, need to create it
      const instruction = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedToken,
        owner,
        mint,
      );
      return { address: associatedToken, instruction };
    }
    throw error;
  }
}

/**
 * Transfer USDC from the platform fee-collection wallet to a recipient.
 *
 * Hardened in Phase 28 CRIT-04:
 *   - All amount arithmetic is BigInt (atomic micro-USDC units). No more
 *     float * 1_000_000.
 *   - Per-call cap (default $1000) blocks single-call drains of the fee
 *     wallet. Override via FEE_WALLET_MAX_PER_TRANSFER_USDC env.
 *
 * @param recipientAddress - The Solana wallet address to send USDC to
 * @param amountUsdc - Amount in USDC (e.g., 12.50 for $12.50)
 * @returns Transfer result with signature on success
 */
export async function transferUsdcFromFeeWallet(
  recipientAddress: string,
  amountUsdc: number,
): Promise<TransferResult> {
  console.log(
    `[USDC Transfer] Starting transfer of $${amountUsdc} USDC to ${recipientAddress}`,
  );

  // Validate amount
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }

  // Per-call cap. CRIT-04: blocks single-call fee-wallet drains.
  if (amountUsdc > MAX_PER_TRANSFER_USDC) {
    const err = `Amount $${amountUsdc.toFixed(2)} exceeds per-transfer cap of $${MAX_PER_TRANSFER_USDC.toFixed(2)} USDC`;
    console.error(`[USDC Transfer] ${err}`);
    return { success: false, error: err };
  }

  // Convert to atomic units via string round-trip (no float drift).
  let amountMicro: bigint;
  try {
    amountMicro = usdcToMicroUnits(amountUsdc);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid amount",
    };
  }

  // Get fee collection keypair
  const feeKeypair = getFeeCollectionKeypair();
  if (!feeKeypair) {
    return {
      success: false,
      error: "Fee collection wallet not configured",
    };
  }

  const connection = getSolanaConnection();

  try {
    const recipientPubkey = new PublicKey(recipientAddress);
    const feeWalletPubkey = feeKeypair.publicKey;

    console.log(`[USDC Transfer] From: ${feeWalletPubkey.toBase58()}`);
    console.log(`[USDC Transfer] To: ${recipientPubkey.toBase58()}`);

    // Get source token account (fee collection wallet's USDC account)
    const sourceAta = await getAssociatedTokenAddress(
      USDC_MINT,
      feeWalletPubkey,
    );

    // Check source balance — bigint compared to bigint, no float involved.
    try {
      const sourceAccount = await getAccount(connection, sourceAta);
      const sourceBalanceMicro = sourceAccount.amount; // bigint
      console.log(
        `[USDC Transfer] Source balance: $${microUnitsToUsdcDisplay(sourceBalanceMicro)} USDC`,
      );

      if (sourceBalanceMicro < amountMicro) {
        return {
          success: false,
          error: `Insufficient balance. Have: $${microUnitsToUsdcDisplay(sourceBalanceMicro)}, Need: $${microUnitsToUsdcDisplay(amountMicro)}`,
        };
      }
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return {
          success: false,
          error: "Fee collection wallet has no USDC account",
        };
      }
      throw error;
    }

    // Get or create destination token account
    const { address: destAta, instruction: createAtaIx } =
      await getOrCreateAssociatedTokenAccount(
        connection,
        feeKeypair,
        USDC_MINT,
        recipientPubkey,
      );

    // Build transaction
    const transaction = new Transaction();

    // Add ATA creation instruction if needed
    if (createAtaIx) {
      console.log(`[USDC Transfer] Creating ATA for recipient`);
      transaction.add(createAtaIx);
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        feeWalletPubkey,
        amountMicro,
      ),
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = feeWalletPubkey;

    // Send and confirm
    console.log(`[USDC Transfer] Sending transaction...`);
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      feeKeypair,
    ]);

    console.log(`[USDC Transfer] Success! Signature: ${signature}`);
    return { success: true, signature };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[USDC Transfer] Failed:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if USDC transfers are enabled (fee wallet configured)
 */
export function isUsdcTransferEnabled(): boolean {
  return !!process.env.FEE_COLLECTION_PRIVATE_KEY;
}

/**
 * Get the fee collection wallet address (for display/verification)
 */
export function getFeeCollectionAddress(): string | null {
  const keypair = getFeeCollectionKeypair();
  return keypair ? keypair.publicKey.toBase58() : null;
}
