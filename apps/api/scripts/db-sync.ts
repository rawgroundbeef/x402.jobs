/**
 * Database Sync Script
 * Compares old Supabase (nbwdqdjyqtwkktdqouoe) with new Supabase (mgvojndnifjbxvdxkdyd)
 * and syncs any missing rows from old → new.
 *
 * Usage:
 *   npx ts-node scripts/db-sync.ts              # Compare only (dry run)
 *   npx ts-node scripts/db-sync.ts --sync       # Actually sync missing rows
 *
 * Required env vars:
 *   OLD_SUPABASE_URL=https://nbwdqdjyqtwkktdqouoe.supabase.co
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=<key>
 *   NEW_SUPABASE_URL=https://mgvojndnifjbxvdxkdyd.supabase.co
 *   NEW_SUPABASE_SERVICE_ROLE_KEY=<key>
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.sync" });

const DRY_RUN = !process.argv.includes("--sync");

// ── Config ──────────────────────────────────────────────────────────
const OLD_URL = process.env.OLD_SUPABASE_URL!;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY!;
const NEW_URL = process.env.NEW_SUPABASE_URL!;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY!;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error("Missing env vars. Create .env.sync with:");
  console.error("  OLD_SUPABASE_URL=...");
  console.error("  OLD_SUPABASE_SERVICE_ROLE_KEY=...");
  console.error("  NEW_SUPABASE_URL=...");
  console.error("  NEW_SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

// ── Tables to sync (in dependency order — parents before children) ──
// Each entry: [tableName, primaryKey, hasCreatedAt]
const TABLES: [string, string, boolean][] = [
  // Independent / parent tables first
  ["profiles", "id", true],
  ["api_keys", "id", true],
  ["x402_servers", "id", true],
  ["x402_facilitators", "id", true],
  ["x402_facilitator_addresses", "id", true],
  ["x402_sponsors", "id", true],
  ["x402_openrouter_models", "id", true],
  ["x402_platform_stats", "id", true],
  ["x402_jobs_rewards_config", "id", true],
  ["x402_jobs_rewards_excluded_wallets", "id", true],

  // User-owned tables (depend on profiles)
  ["x402_user_wallets", "id", true],
  ["x402_user_claude_configs", "id", true],
  ["x402_user_telegram_configs", "id", true],
  ["x402_user_x_tokens", "id", true],
  ["x402_user_openrouter_integrations", "id", true],
  ["x402_external_wallet_links", "id", true],
  ["x402_notifications", "id", true],

  // Resources
  ["x402_resources", "id", true],
  ["x402_cached_images", "id", true],

  // Jobs and runs
  ["x402_jobs", "id", true],
  ["x402_job_runs", "id", true],
  ["x402_job_run_events", "id", true],
  ["x402_resource_executions", "id", true],
  ["x402_scheduled_runs", "id", true],

  // Transactions & payments
  ["x402_transactions", "id", true],
  ["x402_refunds", "id", true],
  ["x402_pending_payouts", "id", true],

  // Hackathons
  ["x402_hackathons", "id", true],
  ["x402_hackathon_sponsors", "id", true],
  ["x402_hackathon_submissions", "id", true],
  ["x402_hackathon_winners", "id", true],

  // Hiring
  ["x402_hiring_requests", "id", true],
  ["x402_hiring_submissions", "id", true],
  ["x402_hiring_reviews", "id", true],
  ["x402_hiring_payouts", "id", true],
  ["x402_hiring_escrow_ledger", "id", true],

  // Stats & rewards
  ["x402_stats_hourly", "id", true],
  ["x402_jobs_rewards_ledger", "id", true],
  ["x402_jobs_rewards_snapshots", "id", true],
  ["x402_jobs_rewards_claims", "id", true],
  ["x402_jobs_rewards_treasury_transfers", "id", true],

  // Usage logs
  ["x402_prompt_template_usage_logs", "id", true],
];

// ── Helpers ─────────────────────────────────────────────────────────

async function getCount(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    // Table might not exist in new DB yet
    if (error.code === "PGRST204" || error.message.includes("does not exist")) {
      return -1;
    }
    throw new Error(`Count error on ${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function getAllIds(
  db: SupabaseClient,
  table: string,
  pk: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await db
      .from(table)
      .select(pk)
      .range(offset, offset + pageSize - 1)
      .order(pk, { ascending: true });

    if (error) throw new Error(`ID fetch error on ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      ids.add(String((row as any)[pk]));
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return ids;
}

async function getRowsByIds(
  db: SupabaseClient,
  table: string,
  pk: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  // Supabase has a URL length limit, batch IDs
  const batchSize = 50;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { data, error } = await db
      .from(table)
      .select("*")
      .in(pk, batch);

    if (error) throw new Error(`Fetch error on ${table}: ${error.message}`);
    if (data) rows.push(...data);
  }

  return rows;
}

async function insertRows(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  let inserted = 0;
  // Insert in batches to avoid payload limits
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await db.from(table).upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`  ❌ Insert error on ${table} (batch ${i}): ${error.message}`);
      // Try one-by-one for this batch to identify problem rows
      for (const row of batch) {
        const { error: singleError } = await db.from(table).upsert(row, {
          onConflict: "id",
          ignoreDuplicates: true,
        });
        if (singleError) {
          console.error(`    ❌ Row ${(row as any).id}: ${singleError.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  return inserted;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║          x402.jobs Database Sync Tool               ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Mode: ${DRY_RUN ? "COMPARE ONLY (dry run)" : "SYNC (will write to new DB)"}${DRY_RUN ? "       " : "  "}║`);
  console.log(`║  Old DB: ${OLD_URL.replace("https://", "").slice(0, 20)}...       ║`);
  console.log(`║  New DB: ${NEW_URL.replace("https://", "").slice(0, 20)}...       ║`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  if (!DRY_RUN) {
    console.log("⚠️  SYNC MODE: Will insert missing rows into new DB");
    console.log("   Press Ctrl+C within 5 seconds to abort...\n");
    await new Promise((r) => setTimeout(r, 5000));
  }

  const summary: {
    table: string;
    oldCount: number;
    newCount: number;
    missing: number;
    synced: number;
  }[] = [];

  for (const [table, pk] of TABLES) {
    process.stdout.write(`Checking ${table}...`);

    try {
      const [oldCount, newCount] = await Promise.all([
        getCount(oldDb, table),
        getCount(newDb, table),
      ]);

      if (newCount === -1) {
        console.log(` ⚠️  Table doesn't exist in new DB (old: ${oldCount} rows)`);
        summary.push({ table, oldCount, newCount: 0, missing: oldCount, synced: 0 });
        continue;
      }

      if (oldCount === newCount) {
        console.log(` ✅ ${oldCount} rows (match)`);
        summary.push({ table, oldCount, newCount, missing: 0, synced: 0 });
        continue;
      }

      const diff = oldCount - newCount;
      console.log(` ⚠️  old=${oldCount} new=${newCount} (diff: ${diff > 0 ? "+" : ""}${diff})`);

      if (diff <= 0) {
        // New has more rows — that's fine, skip
        summary.push({ table, oldCount, newCount, missing: 0, synced: 0 });
        continue;
      }

      // Find which IDs are missing in new
      const [oldIds, newIds] = await Promise.all([
        getAllIds(oldDb, table, pk),
        getAllIds(newDb, table, pk),
      ]);

      const missingIds = [...oldIds].filter((id) => !newIds.has(id));
      console.log(`   → ${missingIds.length} rows missing in new DB`);

      if (missingIds.length === 0) {
        summary.push({ table, oldCount, newCount, missing: 0, synced: 0 });
        continue;
      }

      if (DRY_RUN) {
        // Show a few sample missing IDs
        const sample = missingIds.slice(0, 5);
        console.log(`   → Sample missing IDs: ${sample.join(", ")}${missingIds.length > 5 ? "..." : ""}`);
        summary.push({ table, oldCount, newCount, missing: missingIds.length, synced: 0 });
      } else {
        // Fetch and insert missing rows
        console.log(`   → Fetching ${missingIds.length} rows from old DB...`);
        const rows = await getRowsByIds(oldDb, table, pk, missingIds);
        console.log(`   → Inserting ${rows.length} rows into new DB...`);
        const synced = await insertRows(newDb, table, rows);
        console.log(`   → ✅ Synced ${synced}/${rows.length} rows`);
        summary.push({ table, oldCount, newCount, missing: missingIds.length, synced });
      }
    } catch (err: any) {
      console.log(` ❌ Error: ${err.message}`);
      summary.push({ table, oldCount: -1, newCount: -1, missing: -1, synced: 0 });
    }
  }

  // Print summary
  console.log("\n" + "═".repeat(80));
  console.log("SUMMARY");
  console.log("═".repeat(80));
  console.log(
    "Table".padEnd(45) +
    "Old".padStart(8) +
    "New".padStart(8) +
    "Missing".padStart(8) +
    (DRY_RUN ? "" : "Synced".padStart(8))
  );
  console.log("─".repeat(80));

  let totalMissing = 0;
  let totalSynced = 0;

  for (const row of summary) {
    const status = row.missing > 0 ? "⚠️ " : "  ";
    console.log(
      status +
      row.table.padEnd(43) +
      String(row.oldCount).padStart(8) +
      String(row.newCount).padStart(8) +
      String(row.missing).padStart(8) +
      (DRY_RUN ? "" : String(row.synced).padStart(8))
    );
    if (row.missing > 0) totalMissing += row.missing;
    if (row.synced > 0) totalSynced += row.synced;
  }

  console.log("─".repeat(80));
  console.log(`Total missing: ${totalMissing}`);
  if (!DRY_RUN) console.log(`Total synced: ${totalSynced}`);
  if (DRY_RUN && totalMissing > 0) {
    console.log(`\nRun with --sync to copy missing rows to new DB:`);
    console.log(`  npx ts-node scripts/db-sync.ts --sync`);
  }

  // Also check auth.users count
  console.log("\n── Auth Users ──");
  console.log("Note: auth.users cannot be synced via the API.");
  console.log("If there are new users, they'll need to re-sign-up on the new instance,");
  console.log("or you can export/import via Supabase dashboard or pg_dump.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
