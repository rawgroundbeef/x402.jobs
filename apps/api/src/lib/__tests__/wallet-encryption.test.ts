import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptWalletKey,
  decryptWalletKey,
  decryptWalletKeyAsUtf8,
} from "../wallet-encryption";

beforeAll(() => {
  // Stable test secret. Production uses a 32-byte openssl-generated value
  // from WALLET_ENCRYPTION_SECRET — SHA-256 derivation handles any length.
  process.env.WALLET_ENCRYPTION_SECRET =
    "test-secret-for-wallet-encryption-unit-tests";
});

describe("wallet-encryption", () => {
  it("round-trips raw bytes (Solana 64-byte secret shape)", () => {
    const raw = Buffer.alloc(64);
    for (let i = 0; i < 64; i++) raw[i] = i;

    const ct = encryptWalletKey(raw);
    const out = decryptWalletKey(ct);

    expect(out.equals(raw)).toBe(true);
  });

  it("round-trips a utf-8 string (Base 0x-prefixed key shape)", () => {
    const hex = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    const ct = encryptWalletKey(hex);
    const out = decryptWalletKeyAsUtf8(ct);

    expect(out).toBe(hex);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const a = encryptWalletKey("same-input");
    const b = encryptWalletKey("same-input");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext (GCM auth tag check)", () => {
    const ct = encryptWalletKey("payload");
    const [iv, tag, data] = ct.split(":");
    // Flip the last byte of the ciphertext hex.
    const flipped = data.slice(0, -1) + (data.slice(-1) === "0" ? "1" : "0");
    const tampered = `${iv}:${tag}:${flipped}`;

    expect(() => decryptWalletKey(tampered)).toThrow();
  });

  it("rejects malformed ciphertext", () => {
    expect(() => decryptWalletKey("not-a-real-ciphertext")).toThrow(
      /Malformed wallet ciphertext/,
    );
    expect(() => decryptWalletKey("only:two")).toThrow(
      /Malformed wallet ciphertext/,
    );
  });

  it("rejects wrong-length IV", () => {
    expect(() => decryptWalletKey("ab:" + "00".repeat(16) + ":dead")).toThrow(
      /Malformed IV/,
    );
  });
});
