/**
 * Snapshot every row of x402_user_wallets to a local JSON file before
 * we drop the legacy plaintext columns in migration 006.
 *
 * If something goes wrong with the new encryption path after the drop,
 * we recover by:
 *   1. ALTER TABLE ... ADD COLUMN encrypted_private_key text,
 *                      ADD COLUMN base_encrypted_private_key text
 *   2. UPDATE rows from this backup
 *   3. Revert the app code to the legacy read path
 *
 * The backup includes BOTH the legacy plaintext columns AND the new
 * ciphertext columns, so it's also a snapshot of the encryption state
 * at the moment of cutover.
 *
 * Usage:
 *   npx ts-node scripts/backup-legacy-wallet-keys.ts
 *
 * Output: wallet-backup-<timestamp>.json in the repo root (gitignored).
 * Move this file to secure offline storage (1Password attachment,
 * encrypted external drive, etc.) and delete the local copy once you're
 * confident the new encryption path is stable (recommend ~2 weeks).
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

interface WalletRow {
  id: string;
  user_id: string;
  address: string;
  base_address: string | null;
  encrypted_private_key: string;
  base_encrypted_private_key: string | null;
  solana_private_key_ciphertext: string | null;
  base_private_key_ciphertext: string | null;
  balance_usdc: string | null;
  total_spent_usdc: string | null;
  total_jobs_run: number | null;
  created_at: string;
  updated_at: string;
}

async function main() {
  const db = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  console.log(`Backing up x402_user_wallets from ${SUPABASE_URL}...\n`);

  // Paginate — PostgREST default cap is 1000 rows per request.
  const PAGE_SIZE = 500;
  const rows: WalletRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("x402_user_wallets")
      .select(
        "id, user_id, address, base_address, encrypted_private_key, base_encrypted_private_key, solana_private_key_ciphertext, base_private_key_ciphertext, balance_usdc, total_spent_usdc, total_jobs_run, created_at, updated_at",
      )
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Fetch error at offset ${from}:`, error.message);
      process.exit(1);
    }
    const page = (data || []) as WalletRow[];
    rows.push(...page);
    console.log(`  fetched ${rows.length} rows...`);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Integrity sanity: count rows with each column populated.
  const stats = {
    total: rows.length,
    with_legacy_solana: rows.filter((r) => r.encrypted_private_key).length,
    with_legacy_base: rows.filter((r) => r.base_encrypted_private_key).length,
    with_ciphertext_solana: rows.filter((r) => r.solana_private_key_ciphertext).length,
    with_ciphertext_base: rows.filter((r) => r.base_private_key_ciphertext).length,
    with_base_address: rows.filter((r) => r.base_address).length,
  };

  const payload = {
    created_at: new Date().toISOString(),
    source: SUPABASE_URL,
    stats,
    rows,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `wallet-backup-${timestamp}.json`;
  const filepath = path.join(__dirname, "..", filename);
  const json = JSON.stringify(payload, null, 2);

  fs.writeFileSync(filepath, json, { mode: 0o600 }); // owner read/write only
  const hash = crypto.createHash("sha256").update(json).digest("hex");
  const sizeKb = (fs.statSync(filepath).size / 1024).toFixed(1);

  console.log("\n--- Backup written ---");
  console.log(`File:    ${filename}`);
  console.log(`Path:    ${filepath}`);
  console.log(`Size:    ${sizeKb} KB`);
  console.log(`SHA-256: ${hash}`);
  console.log(`Perms:   0600 (owner read/write only)`);
  console.log("\n--- Row counts ---");
  console.log(JSON.stringify(stats, null, 2));
  console.log(
    "\nNEXT: move this file to secure offline storage (1Password attachment, encrypted external drive). Delete the local copy in ~2 weeks once you're confident the new path is stable.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
