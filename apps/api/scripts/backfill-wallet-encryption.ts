/**
 * Backfill the new ciphertext columns on x402_user_wallets by encrypting
 * the legacy base64-plaintext columns with WALLET_ENCRYPTION_SECRET.
 *
 * Idempotent — only operates on rows where solana_private_key_ciphertext
 * is NULL. Safe to run multiple times.
 *
 * Per-row sanity check: re-derives the pubkey/address from each decoded
 * legacy key and compares to the stored `address` / `base_address`. If they
 * don't match, the row is logged as an error and skipped — never overwritten.
 *
 * Usage:
 *   # Dry-run (default): reads + sanity-checks, no writes.
 *   npx ts-node scripts/backfill-wallet-encryption.ts
 *
 *   # Commit: performs UPDATEs.
 *   npx ts-node scripts/backfill-wallet-encryption.ts --commit
 *
 * Requires .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * WALLET_ENCRYPTION_SECRET set.
 */

import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";
import dotenv from "dotenv";

dotenv.config();

import { encryptWalletKey } from "../src/lib/wallet-encryption";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Check .env.",
  );
  process.exit(1);
}
if (!process.env.WALLET_ENCRYPTION_SECRET) {
  console.error(
    "Missing WALLET_ENCRYPTION_SECRET in environment. Generate one with `openssl rand -base64 32` and add to .env.",
  );
  process.exit(1);
}

const COMMIT = process.argv.includes("--commit");

interface WalletRow {
  id: string;
  user_id: string;
  address: string;
  base_address: string | null;
  encrypted_private_key: string;
  base_encrypted_private_key: string | null;
  solana_private_key_ciphertext: string | null;
  base_private_key_ciphertext: string | null;
}

interface Stats {
  total: number;
  alreadyMigrated: number;
  migrated: number;
  pubkeyMismatch: number;
  decodeError: number;
  writeError: number;
}

async function main() {
  console.log(
    COMMIT
      ? "MODE: --commit (will UPDATE rows)"
      : "MODE: dry-run (no writes; pass --commit to apply)",
  );
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  const db = createClient(SUPABASE_URL!, SUPABASE_KEY!);

  // Paginate — Supabase PostgREST caps each request at 1000 rows by default.
  const PAGE_SIZE = 500;
  const wallets: WalletRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("x402_user_wallets")
      .select(
        "id, user_id, address, base_address, encrypted_private_key, base_encrypted_private_key, solana_private_key_ciphertext, base_private_key_ciphertext",
      )
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Failed to fetch wallets at offset ${from}:`, error.message);
      process.exit(1);
    }
    const page = (data || []) as WalletRow[];
    wallets.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  const stats: Stats = {
    total: wallets.length,
    alreadyMigrated: 0,
    migrated: 0,
    pubkeyMismatch: 0,
    decodeError: 0,
    writeError: 0,
  };

  console.log(`Found ${wallets.length} wallet rows.\n`);

  for (const row of wallets) {
    const tag = `user=${row.user_id} addr=${row.address.slice(0, 8)}...`;

    // Skip rows that already have new ciphertext populated.
    if (row.solana_private_key_ciphertext) {
      stats.alreadyMigrated++;
      continue;
    }

    // --- Solana key: decode + sanity check ---
    let solanaBytes: Buffer;
    try {
      solanaBytes = Buffer.from(row.encrypted_private_key, "base64");
      if (solanaBytes.length !== 64) {
        throw new Error(`expected 64 bytes, got ${solanaBytes.length}`);
      }
    } catch (e) {
      console.error(`[DECODE-FAIL] ${tag}: bad Solana secret —`, (e as Error).message);
      stats.decodeError++;
      continue;
    }

    let derivedSolPubkey: string;
    try {
      derivedSolPubkey = Keypair.fromSecretKey(solanaBytes).publicKey.toBase58();
    } catch (e) {
      console.error(`[DECODE-FAIL] ${tag}: Keypair.fromSecretKey threw —`, (e as Error).message);
      stats.decodeError++;
      continue;
    }

    if (derivedSolPubkey !== row.address) {
      console.error(
        `[MISMATCH] ${tag}: derived pubkey ${derivedSolPubkey.slice(0, 8)}... does not match stored address ${row.address.slice(0, 8)}... — SKIPPING`,
      );
      stats.pubkeyMismatch++;
      continue;
    }

    // --- Base key: decode + sanity check (if present) ---
    let baseHexKey: string | null = null;
    if (row.base_address && row.base_encrypted_private_key) {
      try {
        baseHexKey = Buffer.from(row.base_encrypted_private_key, "base64").toString("utf8");
        const derivedBaseAddr = new Wallet(baseHexKey).address;
        if (derivedBaseAddr.toLowerCase() !== row.base_address.toLowerCase()) {
          console.error(
            `[MISMATCH] ${tag}: derived Base ${derivedBaseAddr} does not match stored ${row.base_address} — SKIPPING`,
          );
          stats.pubkeyMismatch++;
          continue;
        }
      } catch (e) {
        console.error(`[DECODE-FAIL] ${tag}: bad Base key —`, (e as Error).message);
        stats.decodeError++;
        continue;
      }
    } else if (row.base_address && !row.base_encrypted_private_key) {
      console.error(
        `[CORRUPT] ${tag}: has base_address but no base_encrypted_private_key — SKIPPING`,
      );
      stats.decodeError++;
      continue;
    }

    // --- Encrypt ---
    const solanaCiphertext = encryptWalletKey(solanaBytes);
    const baseCiphertext = baseHexKey ? encryptWalletKey(baseHexKey) : null;

    if (!COMMIT) {
      console.log(`[DRY-RUN] ${tag}: would encrypt (sol${baseHexKey ? "+base" : ""})`);
      stats.migrated++;
      continue;
    }

    // --- Write ---
    const { error: updateErr } = await db
      .from("x402_user_wallets")
      .update({
        solana_private_key_ciphertext: solanaCiphertext,
        base_private_key_ciphertext: baseCiphertext,
      })
      .eq("id", row.id);

    if (updateErr) {
      console.error(`[WRITE-FAIL] ${tag}:`, updateErr.message);
      stats.writeError++;
      continue;
    }

    console.log(`[OK] ${tag}: encrypted (sol${baseHexKey ? "+base" : ""})`);
    stats.migrated++;
  }

  console.log("\n--- Summary ---");
  console.log(`Total rows:        ${stats.total}`);
  console.log(`Already migrated: ${stats.alreadyMigrated}`);
  console.log(
    `${COMMIT ? "Migrated" : "Would migrate"}: ${stats.migrated}`,
  );
  console.log(`Pubkey mismatches: ${stats.pubkeyMismatch}`);
  console.log(`Decode errors:     ${stats.decodeError}`);
  console.log(`Write errors:      ${stats.writeError}`);

  if (stats.pubkeyMismatch > 0 || stats.decodeError > 0 || stats.writeError > 0) {
    console.error(
      "\nOne or more rows failed. Investigate the rows logged above before re-running.",
    );
    process.exit(2);
  }
  if (!COMMIT && stats.migrated > 0) {
    console.log("\nDry-run looks clean. Re-run with --commit to apply.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
