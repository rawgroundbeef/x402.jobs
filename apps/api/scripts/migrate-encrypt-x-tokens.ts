/**
 * Backfill the ciphertext columns on x402_user_x_tokens by encrypting
 * the legacy plaintext access_token / access_secret columns with
 * INTEGRATION_ENCRYPTION_SECRET (via lib/instant/encrypt.ts).
 *
 * Idempotent — only operates on rows where access_token_ciphertext IS
 * NULL. Safe to re-run.
 *
 * Round-trip sanity check: every row is re-encrypted then decrypted
 * back, and the decrypted value compared to the original plaintext.
 * Mismatch / decrypt error → row is logged + skipped, never written.
 * (Mirrors the Phase 27 wallet re-encryption pattern in
 *  scripts/backfill-wallet-encryption.ts.)
 *
 * After this script runs cleanly across dev → staging → prod AND the
 * dual-write code has been live for 24+ hours, file the follow-up v3.1
 * migration that drops the plaintext columns:
 *   ALTER TABLE x402_user_x_tokens
 *     DROP COLUMN access_token,
 *     DROP COLUMN access_secret;
 *
 * Usage:
 *   # Dry-run (default): reads + sanity-checks, no writes.
 *   pnpm migrate:encrypt-x-tokens
 *   pnpm migrate:encrypt-x-tokens --dry-run
 *
 *   # Commit: performs UPDATEs.
 *   pnpm migrate:encrypt-x-tokens --commit
 *
 * Requires .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * INTEGRATION_ENCRYPTION_SECRET set. Reuses the same encryption
 * primitives used by routes/integrations.ts (encryptSecret /
 * decryptSecret); a successful run here is a strong signal that the
 * production read path will be able to decrypt the rows.
 *
 * HIGH-02 / plan 28-08.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

import { encryptSecret, decryptSecret } from "../src/lib/instant/encrypt";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Check .env.",
  );
  process.exit(1);
}
if (!process.env.INTEGRATION_ENCRYPTION_SECRET) {
  console.error(
    "Missing INTEGRATION_ENCRYPTION_SECRET in environment. Generate one with `openssl rand -base64 32` and add to .env. NOTE: this MUST match the value used by the running API; a mismatch will cause the production read path to fail to decrypt rows this script writes.",
  );
  process.exit(1);
}

// --dry-run is the default; require --commit to write.
const DRY_RUN =
  process.argv.includes("--dry-run") || !process.argv.includes("--commit");

interface XTokenRow {
  user_id: string;
  access_token: string | null;
  access_secret: string | null;
  access_token_ciphertext: string | null;
  access_secret_ciphertext: string | null;
}

interface Stats {
  total: number;
  alreadyMigrated: number;
  migrated: number;
  roundTripMismatch: number;
  missingPlaintext: number;
  writeError: number;
}

async function main() {
  console.log(
    DRY_RUN
      ? "MODE: dry-run (no writes; pass --commit to apply)"
      : "MODE: --commit (will UPDATE rows)",
  );
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  const db = createClient(SUPABASE_URL!, SUPABASE_KEY!);

  // Paginate — PostgREST caps each request at 1000 rows by default.
  const PAGE_SIZE = 500;
  const rows: XTokenRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("x402_user_x_tokens")
      .select(
        "user_id, access_token, access_secret, access_token_ciphertext, access_secret_ciphertext",
      )
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Failed to fetch x_tokens at offset ${from}:`, error.message);
      process.exit(1);
    }
    const page = (data || []) as XTokenRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const stats: Stats = {
    total: rows.length,
    alreadyMigrated: 0,
    migrated: 0,
    roundTripMismatch: 0,
    missingPlaintext: 0,
    writeError: 0,
  };

  console.log(`Found ${rows.length} x_tokens rows.\n`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tag = `[${i + 1}/${rows.length}] user=${row.user_id}`;

    // Skip rows that already have ciphertext (idempotent).
    if (row.access_token_ciphertext && row.access_secret_ciphertext) {
      stats.alreadyMigrated++;
      continue;
    }

    // Both plaintext columns must be present to re-encrypt.
    if (!row.access_token || !row.access_secret) {
      console.error(
        `${tag}: row missing plaintext access_token or access_secret — SKIPPING`,
      );
      stats.missingPlaintext++;
      continue;
    }

    // Encrypt + round-trip verify. If decrypt(encrypt(x)) !== x, the
    // encryption is unsound for this row and we MUST NOT write it.
    let accessTokenCiphertext: string;
    let accessSecretCiphertext: string;
    try {
      accessTokenCiphertext = encryptSecret(row.access_token);
      accessSecretCiphertext = encryptSecret(row.access_secret);

      const accessTokenRoundTrip = decryptSecret(accessTokenCiphertext);
      const accessSecretRoundTrip = decryptSecret(accessSecretCiphertext);

      if (
        accessTokenRoundTrip !== row.access_token ||
        accessSecretRoundTrip !== row.access_secret
      ) {
        throw new Error("round-trip mismatch");
      }
    } catch (e) {
      console.error(
        `${tag}: encrypt/decrypt round-trip failed —`,
        (e as Error).message,
        "— SKIPPING",
      );
      stats.roundTripMismatch++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${tag}: would re-encrypt (token + secret)`);
      stats.migrated++;
      continue;
    }

    // Write ciphertext only — leave plaintext columns untouched. The
    // dual-write production code already populates both columns going
    // forward; this backfill only fills the legacy plaintext-only rows.
    const { error: updateErr } = await db
      .from("x402_user_x_tokens")
      .update({
        access_token_ciphertext: accessTokenCiphertext,
        access_secret_ciphertext: accessSecretCiphertext,
      })
      .eq("user_id", row.user_id);

    if (updateErr) {
      console.error(`${tag}: WRITE-FAIL —`, updateErr.message);
      stats.writeError++;
      continue;
    }

    console.log(`${tag}: re-encrypted`);
    stats.migrated++;
  }

  console.log("\n--- Summary ---");
  console.log(`Total rows:           ${stats.total}`);
  console.log(`Already migrated:     ${stats.alreadyMigrated}`);
  console.log(
    `${DRY_RUN ? "Would re-encrypt" : "Re-encrypted"}:      ${stats.migrated}`,
  );
  console.log(`Round-trip mismatch:  ${stats.roundTripMismatch}`);
  console.log(`Missing plaintext:    ${stats.missingPlaintext}`);
  console.log(`Write errors:         ${stats.writeError}`);

  if (
    stats.roundTripMismatch > 0 ||
    stats.missingPlaintext > 0 ||
    stats.writeError > 0
  ) {
    console.error(
      "\nOne or more rows failed. Investigate the rows logged above before re-running.",
    );
    process.exit(2);
  }
  if (DRY_RUN && stats.migrated > 0) {
    console.log("\nDry-run looks clean. Re-run with --commit to apply.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
