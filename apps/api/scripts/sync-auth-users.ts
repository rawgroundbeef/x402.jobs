/**
 * Sync missing auth.users from old Supabase to new Supabase
 * Then re-sync profiles and user_wallets that depend on them.
 *
 * Usage: npx ts-node scripts/sync-auth-users.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.sync" });

const OLD_URL = process.env.OLD_SUPABASE_URL!;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY!;
const NEW_URL = process.env.NEW_SUPABASE_URL!;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY!;

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

// The 2 missing user IDs from the sync run
const MISSING_USER_IDS = [
  "7fa774d7-b73c-4acb-9a48-e7c3b93456f5",
  "d0c7e352-9f7d-4fef-b704-4f99e5ff52ce",
];

async function main() {
  console.log("Syncing missing auth users...\n");

  for (const userId of MISSING_USER_IDS) {
    console.log(`Fetching user ${userId} from old DB...`);

    // Get user from old DB
    const { data: oldUser, error: fetchError } =
      await oldDb.auth.admin.getUserById(userId);

    if (fetchError || !oldUser?.user) {
      console.error(`  ❌ Failed to fetch: ${fetchError?.message}`);
      continue;
    }

    const user = oldUser.user;
    console.log(`  Found: ${user.email || user.phone || "no email"} (provider: ${user.app_metadata?.provider || "unknown"})`);

    // Create user in new DB
    // Use createUser with the same ID to preserve foreign key references
    const { data: created, error: createError } =
      await newDb.auth.admin.createUser({
        email: user.email,
        phone: user.phone,
        email_confirm: !!user.email_confirmed_at,
        phone_confirm: !!user.phone_confirmed_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        // Preserve the original user ID
        id: user.id,
      });

    if (createError) {
      // Might already exist
      if (createError.message.includes("already been registered")) {
        console.log(`  ⚠️  User already exists in new DB`);
      } else {
        console.error(`  ❌ Failed to create: ${createError.message}`);
        continue;
      }
    } else {
      console.log(`  ✅ Created user ${created.user.id} in new DB`);
    }
  }

  // Now sync profiles and wallets for these users
  console.log("\nSyncing dependent rows...");

  for (const table of ["profiles", "x402_user_wallets"]) {
    console.log(`\nSyncing ${table}...`);

    for (const userId of MISSING_USER_IDS) {
      // Determine the FK column name
      const fkCol = table === "profiles" ? "id" : "user_id";

      const { data: oldRows, error: fetchErr } = await oldDb
        .from(table)
        .select("*")
        .eq(fkCol, userId);

      if (fetchErr) {
        console.error(`  ❌ Fetch error for ${userId}: ${fetchErr.message}`);
        continue;
      }

      if (!oldRows || oldRows.length === 0) {
        console.log(`  No rows for user ${userId}`);
        continue;
      }

      for (const row of oldRows) {
        const { error: insertErr } = await newDb
          .from(table)
          .upsert(row, { onConflict: "id", ignoreDuplicates: true });

        if (insertErr) {
          console.error(`  ❌ Insert error: ${insertErr.message}`);
        } else {
          console.log(`  ✅ Synced ${table} row for ${userId}`);
        }
      }
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
