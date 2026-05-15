/**
 * HIGH-09 (Phase 28-06) — HMAC sign/verify helpers for run-status URLs.
 *
 * The status endpoints today rely on UUID entropy alone. UUIDs leak via:
 *   - Referer headers when the user navigates from the status page to a
 *     third-party site
 *   - Share buttons / address-bar copy-paste
 *   - The 202 response itself (logged by any observer in the path)
 *
 * Anyone with the URL can read the paid output without paying. HMAC adds a
 * viewing token whose secret is NOT in any client-side surface.
 *
 * Signing scheme (LOCKED in 28-CONTEXT.md):
 *   sig = hmacSha256(WEBHOOK_SIGNING_SECRET, `${runId}.${expiresAt}`)
 *   statusUrl = `${baseUrl}/status/${runId}?sig=${sig}&exp=${expiresAt}`
 *
 * `expiresAt` is Unix seconds. Default TTL is 24 hours — runs are short-lived
 * but the user may refresh the status page later. The TTL only protects
 * leaked URLs; we still gate on the secret too.
 *
 * Verification uses crypto.timingSafeEqual (no early-exit string compare).
 * A naive === would leak the signature one byte at a time across many
 * requests.
 */

import crypto from "crypto";

/**
 * Read the signing secret. Throws if unset or implausibly short — callers
 * MUST trap this if they want to allow degraded behavior (e.g. accept
 * unsigned URLs during the transition window). The helper itself refuses
 * to produce or verify a signature with a weak secret.
 */
function getSecret(): string {
  const s = process.env.WEBHOOK_SIGNING_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "WEBHOOK_SIGNING_SECRET must be set to a 32+ char string",
    );
  }
  return s;
}

/**
 * Sign a runId for a status URL. `expiresAt` is Unix seconds.
 * Returns a 64-char lowercase hex string.
 */
export function signStatusUrl(runId: string, expiresAt: number): string {
  const payload = `${runId}.${expiresAt}`;
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
}

/**
 * Verify that `sig` matches `runId + exp` and that `exp` is in the future.
 *
 * Returns true ONLY when:
 *   - Both `sig` and `exp` are present.
 *   - `exp` is a finite integer strictly greater than the current Unix
 *     second.
 *   - `sig` is byte-for-byte equal to the freshly-computed expected
 *     signature, compared with crypto.timingSafeEqual.
 *
 * Returns false (never throws) for any failure mode — missing input,
 * malformed exp, expired exp, length mismatch, tampered sig, or a
 * secret-configuration error. The handler can map false → 401 without
 * worrying about distinguishing causes (and we deliberately do not leak
 * which check failed to the caller).
 */
export function verifyStatusSignature(
  runId: string,
  sig: string | undefined,
  exp: string | number | undefined,
): boolean {
  if (!sig || exp == null) return false;
  const expNum = typeof exp === "string" ? parseInt(exp, 10) : exp;
  if (!Number.isFinite(expNum) || expNum <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  let expected: string;
  try {
    expected = signStatusUrl(runId, expNum);
  } catch {
    // Secret not configured — treat as "cannot verify" → reject.
    return false;
  }
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual REQUIRES equal length; length check must come first
  // and is not itself a timing leak (length is public on the wire).
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Build a fully-signed status URL.
 *
 *   buildSignedStatusUrl("https://api.x402.jobs", "abc-123")
 *     → "https://api.x402.jobs/status/abc-123?sig=...&exp=..."
 *
 * Use this when the status path is rooted at `${baseUrl}/status/${runId}`.
 * If your route uses a different shape (e.g. `/api/webhooks/:jobId/runs/:runId/status`)
 * use `signedStatusQuery(runId)` instead and concatenate yourself —
 * see `routes/webhooks.ts` for both patterns.
 */
export function buildSignedStatusUrl(
  baseUrl: string,
  runId: string,
  ttlSeconds = 86400,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signStatusUrl(runId, exp);
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/status/${runId}?sig=${sig}&exp=${exp}`;
}

/**
 * Generate the `sig=...&exp=...` query string for a runId. Use this when
 * the status path is already templated (e.g. nested under
 * `/api/webhooks/:jobId/runs/:runId/status`) and you only need to append
 * the signed params.
 *
 *   `${baseUrl}/api/webhooks/${jobId}/runs/${runId}/status?${signedStatusQuery(runId)}`
 */
export function signedStatusQuery(runId: string, ttlSeconds = 86400): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signStatusUrl(runId, exp);
  return `sig=${sig}&exp=${exp}`;
}
