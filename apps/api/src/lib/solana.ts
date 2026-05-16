import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config";

// Solana USDC mint address (mainnet)
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

// $JOBS token mint address (mainnet)
export const JOBS_MINT = new PublicKey(
  process.env.JOBS_TOKEN_MINT || "6cNcXWqYvK9nhD1TsjJ1ZH1KATXcaPaRJtZPHyVkJoBs",
);

// Lazy-initialized Solana connection singleton
let _solanaConnection: Connection | null = null;

/**
 * Get the shared Solana RPC connection instance.
 */
export function getSolanaConnection(): Connection {
  if (!_solanaConnection) {
    _solanaConnection = new Connection(config.solana.rpcUrl, "confirmed");
  }
  return _solanaConnection;
}

/**
 * Get live USDC balance for a Solana wallet.
 * @param walletAddress - The Solana wallet public key string
 * @returns Balance in USDC (with decimals applied)
 */
export async function getSolanaUsdcBalance(
  walletAddress: string,
): Promise<number> {
  try {
    const connection = getSolanaConnection();
    const walletPubkey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getTokenAccountsByOwner(
      walletPubkey,
      { mint: USDC_MINT },
    );

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const accountInfo = tokenAccounts.value[0]!;
    const balance = await connection.getTokenAccountBalance(accountInfo.pubkey);

    // USDC has 6 decimals
    return parseFloat(balance.value.uiAmountString || "0");
  } catch (error) {
    console.error("Error fetching Solana USDC balance:", error);
    return 0;
  }
}

/**
 * Get live $JOBS balance for a Solana wallet.
 * @param walletAddress - The Solana wallet public key string
 * @returns Balance in $JOBS (with decimals applied)
 */
export async function getSolanaJobsBalance(
  walletAddress: string,
): Promise<number> {
  try {
    const connection = getSolanaConnection();
    const walletPubkey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getTokenAccountsByOwner(
      walletPubkey,
      { mint: JOBS_MINT },
    );

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const accountInfo = tokenAccounts.value[0]!;
    const balance = await connection.getTokenAccountBalance(accountInfo.pubkey);

    // $JOBS has 9 decimals
    return parseFloat(balance.value.uiAmountString || "0");
  } catch (error) {
    console.error("Error fetching Solana $JOBS balance:", error);
    return 0;
  }
}
