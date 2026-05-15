import crypto from "crypto";

/**
 * HIGH-12 — public-shape redaction helpers.
 *
 * These helpers are applied in public response mappers (routes/runs.ts,
 * routes/wallet.ts) so that the open-source API surface does not deanonymize
 * platform users vs. on-chain pseudonymity. Internal/admin shapes keep the
 * full values and must NOT route through these helpers.
 */

/**
 * Truncate an address-like string for public display: first 6 + '...' + last 4.
 *
 * Null/undefined are returned unchanged so callers can spread the helper over
 * possibly-absent rows without conditionals. Strings of length <= 12 are too
 * short to truncate meaningfully and are also returned as-is (the goal is to
 * hide chain-address middles, not to munge arbitrary identifiers).
 */
export function redactPayer(
  addr: string | null | undefined,
): string | null | undefined {
  if (addr == null) return addr;
  if (typeof addr !== "string") return addr;
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Stable opaque digest of a payment signature: SHA-256, first 16 hex chars.
 *
 * Provides a consistent lookup token for support / debugging without
 * exposing the signed payload, which (especially for Solana base58 sigs and
 * EIP-3009 authorization objects) is replayable for the EVM 1-hour validity
 * window.
 */
export function hashSignature(
  sig: string | null | undefined,
): string | null | undefined {
  if (sig == null) return sig;
  if (typeof sig !== "string" || sig.length === 0) return sig;
  return crypto.createHash("sha256").update(sig).digest("hex").slice(0, 16);
}
