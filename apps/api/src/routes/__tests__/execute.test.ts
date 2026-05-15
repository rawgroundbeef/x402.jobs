import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// HIGH-01: full payment payloads (Base EIP-3009 authorizations + signed
// Solana transactions) must NOT be JSON.stringify'd into console.log on the
// synchronous /api/execute route. Source-level RED tests — mirroring the
// approach used in src/inngest/utils/__tests__/execute-x402.test.ts and in
// plan 28-01's HIGH-06 timing-safe test. Behavioral mocking of a full
// /api/execute request flow for a one-line log fix is out of proportion.

const SOURCE_PATH = join(__dirname, "..", "execute.ts");
const source = readFileSync(SOURCE_PATH, "utf8");

describe("routes/execute.ts — HIGH-01 payment-payload log hygiene", () => {
  it("does not console.log the full Base/route payment payload object", () => {
    const forbiddenPattern =
      /console\.log\([^)]*Payment payload[^)]*JSON\.stringify\(\s*paymentPayload/;
    expect(source).not.toMatch(forbiddenPattern);
  });

  it("does not JSON.stringify(paymentPayload) into any console.log", () => {
    const forbiddenPattern = /console\.log\([^;]*JSON\.stringify\(\s*paymentPayload/m;
    expect(source).not.toMatch(forbiddenPattern);
  });

  it("does not console.log raw x_payment, authorization, signedTx, or serializedTx variables", () => {
    const forbiddenPatterns = [
      /console\.log\([^)]*x_payment/i,
      /console\.log\([^)]*\bauthorization\b[^)]*\)/,
      /console\.log\([^)]*\bsignedTx\b/,
      /console\.log\([^)]*\bserializedTx\b/,
    ];
    for (const p of forbiddenPatterns) {
      expect(source).not.toMatch(p);
    }
  });

  it("emits a structured metadata log with payer_redacted at the payment sites", () => {
    const matches = source.match(/payer_redacted/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("emits a structured metadata log with signature_hash at the payment sites", () => {
    const matches = source.match(/signature_hash/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("imports node:crypto for the signature_hash derivation", () => {
    const cryptoImport =
      /import\s+(?:\*\s+as\s+)?crypto\s+from\s+["'](?:node:)?crypto["']/m;
    const cryptoRequire = /require\(["'](?:node:)?crypto["']\)/m;
    expect(cryptoImport.test(source) || cryptoRequire.test(source)).toBe(true);
  });
});
