/**
 * Email service — out-of-band notification surface.
 *
 * HIGH-11 (Phase 28 plan 28-05) requires sending the user a confirmation
 * email when their wallet private key is exported, so a token-theft → drain
 * attack is at least detectable in real-time by the legitimate user.
 *
 * Current state: no SMTP / SendGrid / Resend / Postmark integration exists
 * in the codebase. Rather than block HIGH-11 on choosing a provider, this
 * module is a structured stub that:
 *
 *   1. Provides the public API the handlers will continue using when a real
 *      provider is wired (no caller refactor needed).
 *   2. Records every send via console.log so deliveries are visible in API
 *      logs (Render / dev terminal) until a real provider lands.
 *   3. Returns `{ sent: true }` so callers can branch on success/failure
 *      and never throws (best-effort delivery — email send MUST NOT block
 *      the user-facing response).
 *
 * Follow-up: wire to Resend (or whichever provider lands as part of
 * notifications work) by implementing the actual transport here. Callers
 * remain unchanged.
 *
 * Deferred: tracked in 28-05-SUMMARY.md under "Known Stubs".
 */

export interface WalletExportNotificationPayload {
  to: string;
  userId: string;
  walletNetwork: "base" | "solana" | "both";
  ip: string | null;
  userAgent: string | null;
  exportedAt: string; // ISO-8601
}

export interface EmailSendResult {
  sent: boolean;
  provider?: string;
  error?: string;
}

/**
 * Notify a user that their wallet private key was just exported.
 *
 * Never throws — best-effort delivery. Returns `{ sent: false, error }` on
 * provider failures so the caller can log without breaking the response.
 */
export async function sendWalletExportNotification(
  payload: WalletExportNotificationPayload,
): Promise<EmailSendResult> {
  try {
    // Log-only transport until a real provider is wired in. Keep this
    // structured so audit-log searches can find these events without
    // grepping prose.
    console.warn(
      "[email-service] WALLET_KEY_EXPORTED notification (log-only stub)",
      {
        to: payload.to,
        user_id: payload.userId,
        wallet_network: payload.walletNetwork,
        ip: payload.ip,
        user_agent: payload.userAgent,
        exported_at: payload.exportedAt,
        subject: "Your x402.jobs wallet key was exported",
        body:
          `Your ${payload.walletNetwork} wallet private key was exported at ` +
          `${payload.exportedAt} from IP ${payload.ip ?? "(unknown)"}. ` +
          "If this wasn't you, contact support immediately and rotate your account password.",
      },
    );
    return { sent: true, provider: "log-only-stub" };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
