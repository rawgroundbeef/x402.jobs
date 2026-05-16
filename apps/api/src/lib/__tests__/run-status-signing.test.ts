import { beforeAll, describe, expect, it } from "vitest";
import {
  signStatusUrl,
  verifyStatusSignature,
  buildSignedStatusUrl,
  signedStatusQuery,
} from "../run-status-signing";

// ============================================================================
// HIGH-09 (Phase 28-06) — HMAC sign/verify helpers for run status URLs.
//
// The status endpoints today rely on UUID entropy alone. UUIDs leak via
// referrer headers and share buttons. HMAC adds a viewing token whose secret
// is not in any client-side surface.
//
// Comparison MUST be constant-time (crypto.timingSafeEqual). A vanilla
// === would leak the secret one byte at a time across many requests.
// ============================================================================

beforeAll(() => {
  process.env.WEBHOOK_SIGNING_SECRET = "test-secret-at-least-32-chars-long-aaaa";
});

describe("signStatusUrl / verifyStatusSignature — HIGH-09", () => {
  const runId = "550e8400-e29b-41d4-a716-446655440000";

  it("roundtrips: sign then verify same runId+exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signStatusUrl(runId, exp);
    expect(verifyStatusSignature(runId, sig, exp)).toBe(true);
  });

  it("rejects tampered signature", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signStatusUrl(runId, exp);
    // Flip the first hex character to guarantee a different signature of the
    // same length (constant-time compare requires equal length).
    const tampered = sig.startsWith("a")
      ? "b" + sig.slice(1)
      : "a" + sig.slice(1);
    expect(verifyStatusSignature(runId, tampered, exp)).toBe(false);
  });

  it("rejects expired exp", () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const sig = signStatusUrl(runId, exp);
    expect(verifyStatusSignature(runId, sig, exp)).toBe(false);
  });

  it("rejects missing sig", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(verifyStatusSignature(runId, undefined, exp)).toBe(false);
  });

  it("rejects mismatched runId", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = signStatusUrl(runId, exp);
    expect(verifyStatusSignature("different-run-id", sig, exp)).toBe(false);
  });

  it("buildSignedStatusUrl produces a URL with sig and exp", () => {
    const url = buildSignedStatusUrl("https://api.x402.jobs", runId);
    expect(url).toMatch(/\/status\/[\w-]+\?sig=[a-f0-9]{64}&exp=\d+/);
  });

  it("signedStatusQuery yields a query string with sig and exp", () => {
    const q = signedStatusQuery(runId);
    expect(q).toMatch(/^sig=[a-f0-9]{64}&exp=\d+$/);
    // It must verify roundtrip against the same runId.
    const params = new URLSearchParams(q);
    const sig = params.get("sig")!;
    const exp = params.get("exp")!;
    expect(verifyStatusSignature(runId, sig, exp)).toBe(true);
  });
});
