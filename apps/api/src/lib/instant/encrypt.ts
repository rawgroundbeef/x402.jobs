import crypto from "crypto";

const ENCRYPTION_KEY_ENV = "INTEGRATION_ENCRYPTION_SECRET";

function getEncryptionKey(): Buffer {
  const secret = process.env[ENCRYPTION_KEY_ENV];
  if (!secret) {
    throw new Error(`${ENCRYPTION_KEY_ENV} environment variable is not set`);
  }
  // Derive a 256-bit key from the secret using SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a string (API key, auth header, etc.) for database storage
 * Uses AES-256-CBC with random IV
 * Format: iv_hex:encrypted_hex
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt a string from database storage
 */
export function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();

  const [ivHex, encryptedData] = encrypted.split(":");
  if (!ivHex || !encryptedData) {
    throw new Error("Invalid encrypted format - expected iv:data");
  }

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env[ENCRYPTION_KEY_ENV];
}
