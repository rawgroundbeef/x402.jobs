/**
 * X (Twitter) OAuth token storage helper.
 *
 * Centralizes the dual-read pattern for `x402_user_x_tokens` during the
 * Phase 27/28 ciphertext rollout window: prefer the ciphertext column,
 * fall back to the legacy plaintext column for rows the backfill script
 * hasn't reached yet. After the follow-up v3.1 migration drops plaintext
 * columns, the fallback branch becomes unreachable and can be removed.
 *
 * HIGH-02 / plan 28-08.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "./instant/encrypt";

export interface DecryptedXTokens {
  accessToken: string;
  accessSecret: string;
}

interface XTokensRow {
  access_token: string | null;
  access_secret: string | null;
  access_token_ciphertext: string | null;
  access_secret_ciphertext: string | null;
}

/**
 * Fetch and decrypt a user's X (Twitter) OAuth tokens.
 *
 * Returns `null` if the user has no row. Throws if the row is present but
 * unreadable (corrupt ciphertext, missing both plaintext + ciphertext for
 * a column — should be impossible under correct dual-write but signals
 * data corruption worth surfacing).
 */
export async function getDecryptedXTokens(
  supabase: SupabaseClient,
  userId: string,
): Promise<DecryptedXTokens | null> {
  const { data, error } = await supabase
    .from("x402_user_x_tokens")
    .select(
      "access_token, access_secret, access_token_ciphertext, access_secret_ciphertext",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`getDecryptedXTokens query failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as XTokensRow;

  // Prefer ciphertext (post-Phase-27 write path). Fall back to plaintext
  // for rows the backfill script hasn't migrated yet. Throw if neither
  // is present — indicates a corrupt write.
  const accessToken = row.access_token_ciphertext
    ? decryptSecret(row.access_token_ciphertext)
    : row.access_token;
  const accessSecret = row.access_secret_ciphertext
    ? decryptSecret(row.access_secret_ciphertext)
    : row.access_secret;

  if (!accessToken || !accessSecret) {
    throw new Error(
      `getDecryptedXTokens: user ${userId} row missing both plaintext and ciphertext tokens`,
    );
  }

  return { accessToken, accessSecret };
}
