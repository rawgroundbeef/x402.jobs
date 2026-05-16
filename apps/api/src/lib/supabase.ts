import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

// Lazy-initialized Supabase client singleton
let _supabase: SupabaseClient | null = null;

/**
 * Get the shared Supabase client instance.
 * Uses service role key for server-side operations.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error("Supabase configuration is incomplete");
    }
    _supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
    );
  }
  return _supabase;
}
