import crypto from "crypto";

const ENV_VAR = "WALLET_ENCRYPTION_SECRET";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // standard for GCM
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env[ENV_VAR];
  if (!secret) {
    throw new Error(
      `${ENV_VAR} is not set. Generate one with \`openssl rand -base64 32\` and add it to .env and Railway env vars.`,
    );
  }
  // SHA-256 normalizes the secret to exactly 32 bytes regardless of input length.
  // Secret is expected to be high-entropy (openssl rand output), so SHA-256
  // derivation is appropriate — no PBKDF2/scrypt needed.
  cachedKey = crypto.createHash("sha256").update(secret).digest();
  if (cachedKey.length !== KEY_BYTES) {
    throw new Error("Derived key has wrong length");
  }
  return cachedKey;
}

/**
 * Encrypt wallet key material for at-rest storage.
 *
 * Output format: `iv_hex:tag_hex:ciphertext_hex` — three colon-separated
 * hex strings. Each component is required for decryption; missing or
 * tampered components cause decryption to throw.
 *
 * Accepts either a Buffer (for raw key bytes like Solana's 64-byte secret)
 * or a string (for serialized keys like Base's "0x..." hex). The plaintext
 * shape is preserved across encrypt/decrypt — what you put in is what you
 * get out, byte-for-byte.
 */
export function encryptWalletKey(plaintext: Buffer | string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const input =
    typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypt to raw bytes. Throws on any tampering, malformed input, or
 * wrong encryption secret. Never returns silently-corrupted plaintext —
 * that's the whole point of GCM over CBC.
 */
export function decryptWalletKey(encrypted: string): Buffer {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Malformed wallet ciphertext: expected `iv:tag:ct` format with 3 hex components",
    );
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");

  if (iv.length !== IV_BYTES) {
    throw new Error(`Malformed IV: expected ${IV_BYTES} bytes, got ${iv.length}`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(
      `Malformed auth tag: expected ${TAG_BYTES} bytes, got ${tag.length}`,
    );
  }

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Decrypt and interpret as UTF-8. For Base/EVM keys stored as "0x..." strings.
 */
export function decryptWalletKeyAsUtf8(encrypted: string): string {
  return decryptWalletKey(encrypted).toString("utf8");
}

/**
 * True iff WALLET_ENCRYPTION_SECRET is configured. Use in startup checks
 * to fail fast in environments missing the secret.
 */
export function isWalletEncryptionConfigured(): boolean {
  return !!process.env[ENV_VAR];
}
