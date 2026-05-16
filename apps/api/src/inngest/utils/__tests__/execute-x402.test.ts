import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// HIGH-01: full payment payloads (signed Solana txns + EIP-3009 authorizations)
// must NOT be emitted to console.log. The black-box behavior of a `console.log`
// that logs a redacted shape is indistinguishable from one that logs the full
// payload unless we inspect log args directly. Wiring up the full
// `executeX402Request` flow (Solana RPC, ethers wallets, x402 facilitator) for
// a log-assertion test would require dozens of mocks for a one-line concern.
//
// We use a static-source assertion instead — same pattern as plan 28-01's
// HIGH-06 timing-safe-equality fix. We read the source of execute-x402.ts and
// assert: (a) no forbidden patterns that dump the full payment payload remain,
// and (b) the structured-metadata replacement shape is present at the expected
// log sites.

const SOURCE_PATH = join(__dirname, "..", "execute-x402.ts");
const source = readFileSync(SOURCE_PATH, "utf8");

describe("execute-x402.ts — HIGH-01 payment-payload log hygiene", () => {
  it("does not console.log the full Base/Inngest payment payload object", () => {
    // The vulnerable log shape was:
    //   console.log(`[Base/Inngest] Payment payload (v${x402Version}):`,
    //     JSON.stringify(paymentPayload, null, 2));
    // which serializes the entire authorization + signature.
    const forbiddenPattern = /console\.log\([^)]*Payment payload[^)]*JSON\.stringify\(\s*paymentPayload/;
    expect(source).not.toMatch(forbiddenPattern);
  });

  it("does not console.log any variable containing 'paymentPayload' as a stringified arg", () => {
    // Tighter check: any console.log that JSON.stringify's paymentPayload.
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
    // The replacement shape introduces `payer_redacted` and `signature_hash`
    // keys in console.log calls. Require at least 3 distinct occurrences
    // (one for Solana, one for Base, one for the post-send/decoded log).
    const payerRedactedMatches = source.match(/payer_redacted/g) || [];
    expect(payerRedactedMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("emits a structured metadata log with signature_hash at the payment sites", () => {
    const sigHashMatches = source.match(/signature_hash/g) || [];
    expect(sigHashMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("imports node:crypto for the signature_hash derivation", () => {
    // Either `import crypto from 'crypto'` or `import crypto from 'node:crypto'`
    // or a `require('crypto')` inline use. Don't be brittle about the form.
    const cryptoImport =
      /import\s+(?:\*\s+as\s+)?crypto\s+from\s+["'](?:node:)?crypto["']/m;
    const cryptoRequire = /require\(["'](?:node:)?crypto["']\)/m;
    expect(cryptoImport.test(source) || cryptoRequire.test(source)).toBe(true);
  });
});
