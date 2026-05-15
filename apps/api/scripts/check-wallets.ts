/**
 * Check for users missing wallets in the new Supabase instance.
 *
 * Usage: npx ts-node scripts/check-wallets.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.sync" });

const NEW_URL = process.env.NEW_SUPABASE_URL!;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(NEW_URL, NEW_KEY);

async function main() {
  // Get all profiles
  const { data: profiles, error: profileErr } = await db
    .from("profiles")
    .select("id, username, display_name, created_at");

  if (profileErr) {
    console.error("Failed to fetch profiles:", profileErr.message);
    process.exit(1);
  }

  // Get all wallets
  const { data: wallets, error: walletErr } = await db
    .from("x402_user_wallets")
    .select("user_id, address, base_address");

  if (walletErr) {
    console.error("Failed to fetch wallets:", walletErr.message);
    process.exit(1);
  }

  const walletMap = new Map<string, any>();
  for (const w of wallets || []) {
    walletMap.set(w.user_id, w);
  }

  console.log(`Total profiles: ${profiles?.length || 0}`);
  console.log(`Total wallets: ${wallets?.length || 0}\n`);

  const missing: any[] = [];
  const missingSolana: any[] = [];
  const missingBase: any[] = [];

  for (const profile of profiles || []) {
    const wallet = walletMap.get(profile.id);
    if (!wallet) {
      missing.push(profile);
    } else if (!wallet.address) {
      missingSolana.push(profile);
    } else if (!wallet.base_address) {
      missingBase.push(profile);
    }
  }

  if (missing.length === 0 && missingSolana.length === 0 && missingBase.length === 0) {
    console.log("All users have complete wallets (Solana + Base).");
    return;
  }

  if (missing.length > 0) {
    console.log(`Users missing wallet entirely (${missing.length}):`);
    for (const p of missing) {
      console.log(`  - ${p.username || "(no username)"} (${p.id}) created ${p.created_at}`);
    }
    console.log();
  }

  if (missingSolana.length > 0) {
    console.log(`Users missing Solana address (${missingSolana.length}):`);
    for (const p of missingSolana) {
      console.log(`  - ${p.username || "(no username)"} (${p.id})`);
    }
    console.log();
  }

  if (missingBase.length > 0) {
    console.log(`Users missing Base address (${missingBase.length}):`);
    for (const p of missingBase) {
      console.log(`  - ${p.username || "(no username)"} (${p.id})`);
    }
    console.log();
  }

  console.log(`Summary: ${missing.length} no wallet, ${missingSolana.length} no Solana, ${missingBase.length} no Base`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
