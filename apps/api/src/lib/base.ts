import { ethers } from "ethers";
import { config } from "../config";

// USDC on Base mainnet
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// Minimal ERC20 ABI for balance and transfer operations
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Lazy-initialized Base provider singleton
let _baseProvider: ethers.JsonRpcProvider | null = null;

/**
 * Get the shared Base network JSON-RPC provider instance.
 */
export function getBaseProvider(): ethers.JsonRpcProvider {
  if (!_baseProvider) {
    _baseProvider = new ethers.JsonRpcProvider(config.base.rpcUrl);
  }
  return _baseProvider;
}

/**
 * Get live USDC balance for a Base wallet.
 * @param walletAddress - The Base wallet address
 * @returns Balance in USDC (with decimals applied)
 */
export async function getBaseUsdcBalance(
  walletAddress: string,
): Promise<number> {
  try {
    const provider = getBaseProvider();
    const usdcContract = new ethers.Contract(
      BASE_USDC_ADDRESS,
      ERC20_ABI,
      provider,
    );

    const balance = await usdcContract.getFunction("balanceOf")(walletAddress);
    // USDC has 6 decimals on Base
    return parseFloat(ethers.formatUnits(balance, 6));
  } catch (error) {
    console.error("Error fetching Base USDC balance:", error);
    return 0;
  }
}

export interface ChargeBaseResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface TransferBaseResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Get the Base platform wallet (for escrow payouts)
 * Reads private key from environment
 */
function getBasePlatformWallet(): ethers.Wallet | null {
  const privateKey = process.env.BASE_PLATFORM_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    console.error("[Base Transfer] BASE_PLATFORM_WALLET_PRIVATE_KEY not set");
    return null;
  }

  try {
    const provider = getBaseProvider();
    // Support both hex and base64-encoded hex formats
    let key = privateKey.trim();

    // If it looks like base64 (contains = or starts/ends with certain chars)
    if (key.includes("=") || !/^(0x)?[0-9a-fA-F]+$/.test(key)) {
      key = Buffer.from(key, "base64").toString("utf-8");
    }

    // Ensure 0x prefix
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }

    return new ethers.Wallet(key, provider);
  } catch (error) {
    console.error(
      "[Base Transfer] Invalid BASE_PLATFORM_WALLET_PRIVATE_KEY format:",
      error,
    );
    return null;
  }
}

/**
 * Transfer USDC from platform wallet to a recipient on Base.
 * Used for escrow payouts.
 * @param recipientAddress - The Base wallet address to send USDC to
 * @param amountUsdc - Amount in USDC (e.g., 12.50 for $12.50)
 */
export async function transferBaseUsdcFromPlatform(
  recipientAddress: string,
  amountUsdc: number,
): Promise<TransferBaseResult> {
  console.log(
    `[Base Transfer] Starting transfer of $${amountUsdc} USDC to ${recipientAddress}`,
  );

  if (amountUsdc <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }

  const wallet = getBasePlatformWallet();
  if (!wallet) {
    return {
      success: false,
      error: "Base platform wallet not configured",
    };
  }

  try {
    console.log(`[Base Transfer] From: ${wallet.address}`);
    console.log(`[Base Transfer] To: ${recipientAddress}`);

    // Check balance first
    const balance = await getBaseUsdcBalance(wallet.address);
    console.log(
      `[Base Transfer] Platform balance: $${balance.toFixed(6)} USDC`,
    );

    if (balance < amountUsdc) {
      return {
        success: false,
        error: `Insufficient balance. Have: $${balance.toFixed(2)}, Need: $${amountUsdc.toFixed(2)}`,
      };
    }

    // Create USDC contract instance with signer
    const usdcContract = new ethers.Contract(
      BASE_USDC_ADDRESS,
      ERC20_ABI,
      wallet,
    );

    // Convert amount to smallest unit (6 decimals)
    const amountInSmallestUnit = BigInt(
      Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS)),
    );

    // Send the transfer
    console.log(`[Base Transfer] Sending transaction...`);
    const tx = await usdcContract.getFunction("transfer")(
      recipientAddress,
      amountInSmallestUnit,
    );

    console.log(`[Base Transfer] Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log(`[Base Transfer] Success! Hash: ${tx.hash}`);
      return { success: true, transactionHash: tx.hash };
    } else {
      return { success: false, error: "Transaction failed on-chain" };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Base Transfer] Failed:", error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if Base USDC transfers from platform are enabled
 */
export function isBaseTransferEnabled(): boolean {
  return !!process.env.BASE_PLATFORM_WALLET_PRIVATE_KEY;
}

/**
 * Charge USDC on Base - direct transfer to platform wallet.
 * @param baseSecretKey - Base64-encoded hex private key
 * @param amountUsdc - Amount in USDC (e.g., 0.05 for 5 cents)
 */
export async function chargeBaseUSDC(
  baseSecretKey: string,
  amountUsdc: number,
): Promise<ChargeBaseResult> {
  try {
    const provider = getBaseProvider();
    const platformWallet = config.base.platformWallet;

    if (!platformWallet) {
      return {
        success: false,
        error: "Base platform wallet not configured",
      };
    }

    // Decode the base64-encoded hex private key
    const decodedKey = Buffer.from(baseSecretKey, "base64").toString("utf-8");
    const wallet = new ethers.Wallet(decodedKey, provider);

    console.log(`   Charging $${amountUsdc} USDC on Base`);
    console.log(`   From: ${wallet.address}`);
    console.log(`   To: ${platformWallet}`);

    // Check USDC balance first
    const balance = await getBaseUsdcBalance(wallet.address);
    if (balance < amountUsdc) {
      return {
        success: false,
        error: `Insufficient USDC on Base. Required: $${amountUsdc.toFixed(2)}, Available: $${balance.toFixed(2)}`,
      };
    }

    // Create USDC contract instance with signer
    const usdcContract = new ethers.Contract(
      BASE_USDC_ADDRESS,
      ERC20_ABI,
      wallet,
    );

    // Convert amount to smallest unit (6 decimals)
    const amountInSmallestUnit = BigInt(
      Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS)),
    );

    // Send the transfer
    const tx = await usdcContract.getFunction("transfer")(
      platformWallet,
      amountInSmallestUnit,
    );

    console.log(`   Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      return {
        success: true,
        transactionHash: tx.hash,
      };
    } else {
      return {
        success: false,
        error: "Transaction failed on-chain",
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error charging Base USDC:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
