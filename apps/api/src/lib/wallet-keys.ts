import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";
import { getSupabase } from "./supabase";
import {
  encryptWalletKey,
  decryptWalletKey,
  decryptWalletKeyAsUtf8,
} from "./wallet-encryption";

/**
 * Decrypted user wallet, ready to sign.
 *
 *   - `solanaSecretBase64`: base64 of the raw 64-byte Solana secret key.
 *     Callers `Buffer.from(value, "base64")` to get the Uint8Array.
 *   - `baseSecretBase64`: base64 of the "0x..." Base private key string.
 *     Callers `Buffer.from(value, "base64").toString("utf-8")` to get the
 *     hex string back.
 *
 * The double-encoded shape exists because downstream payment-signing code
 * expects a base64 string (legacy column shape preserved deliberately).
 */
export interface DecryptedUserWallet {
  address: string;
  baseAddress: string | null;
  solanaSecretBase64: string;
  baseSecretBase64: string | null;
}

interface WalletRow {
  address: string;
  base_address: string | null;
  solana_private_key_ciphertext: string;
  base_private_key_ciphertext: string | null;
}

/**
 * Load a user's wallet, decrypted and ready to sign.
 *
 * Returns null if no wallet row exists for the user. Throws if the
 * decrypted secret doesn't derive to the stored address (DECRYPT MISMATCH)
 * — fails closed, never signs with the wrong key.
 */
export async function loadDecryptedUserWallet(
  userId: string,
): Promise<DecryptedUserWallet | null> {
  const { data, error } = await getSupabase()
    .from("x402_user_wallets")
    .select(
      "address, base_address, solana_private_key_ciphertext, base_private_key_ciphertext",
    )
    .eq("user_id", userId)
    .maybeSingle<WalletRow>();

  if (error) {
    throw new Error(`Failed to load wallet for user ${userId}: ${error.message}`);
  }
  if (!data) return null;

  return {
    address: data.address,
    baseAddress: data.base_address,
    solanaSecretBase64: decryptSolanaKey(data, userId),
    baseSecretBase64: decryptBaseKey(data, userId),
  };
}

function decryptSolanaKey(row: WalletRow, userId: string): string {
  const bytes = decryptWalletKey(row.solana_private_key_ciphertext);
  // Defense in depth: re-derive the pubkey from the decrypted secret and
  // compare to the stored address. Catches a wrong encryption secret, row
  // corruption, or any encryption-module bug — anything that would lead to
  // signing with a key that doesn't belong to this user. Cost: ~1ms ed25519.
  const derivedPubkey = Keypair.fromSecretKey(bytes).publicKey.toBase58();
  if (derivedPubkey !== row.address) {
    throw new Error(
      `[wallet-keys] DECRYPT MISMATCH for user ${userId}: Solana key derives to ${derivedPubkey.slice(0, 8)}... but stored address is ${row.address.slice(0, 8)}...`,
    );
  }
  console.log(
    `[wallet-keys] decrypted Solana key for user ${userId.slice(0, 8)}`,
  );
  return bytes.toString("base64");
}

function decryptBaseKey(row: WalletRow, userId: string): string | null {
  // No Base wallet — fine, base wallets are optional.
  if (!row.base_address) return null;

  if (!row.base_private_key_ciphertext) {
    // Base address set but no key — corrupt row.
    throw new Error(
      `Wallet row for user ${userId} has base_address but no base_private_key_ciphertext`,
    );
  }

  const hexString = decryptWalletKeyAsUtf8(row.base_private_key_ciphertext);
  // Defense in depth: derive Base address from the decrypted key and compare
  // (case-insensitive per EIP-55) to the stored base_address.
  const derivedAddress = new Wallet(hexString).address;
  if (derivedAddress.toLowerCase() !== row.base_address.toLowerCase()) {
    throw new Error(
      `[wallet-keys] DECRYPT MISMATCH for user ${userId}: Base key derives to ${derivedAddress} but stored base_address is ${row.base_address}`,
    );
  }
  console.log(
    `[wallet-keys] decrypted Base key for user ${userId.slice(0, 8)}`,
  );
  return Buffer.from(hexString, "utf8").toString("base64");
}

/**
 * Encrypt freshly generated wallet material for storage in the new
 * ciphertext columns.
 */
export function encryptWalletForStorage(
  solanaSecret: Uint8Array,
  baseHexKey: string | null,
): {
  solanaCiphertext: string;
  baseCiphertext: string | null;
} {
  return {
    solanaCiphertext: encryptWalletKey(Buffer.from(solanaSecret)),
    baseCiphertext: baseHexKey ? encryptWalletKey(baseHexKey) : null,
  };
}
