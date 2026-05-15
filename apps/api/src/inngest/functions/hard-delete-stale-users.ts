import { inngest } from "../../lib/inngest";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
);

const RECOVERY_WINDOW_DAYS = 30;

/**
 * Hard-delete users soft-deleted more than 30 days ago.
 *
 * HIGH-03 / Phase 28 plan 28-07: DELETE /api/user/account tombstones
 * `profiles.deleted_at = NOW()` rather than hard-deleting (preserves a
 * recovery window). This cron runs nightly at 03:00 UTC and purges any
 * profile + auth row whose tombstone is older than the cutoff.
 *
 * Behavior:
 *   1. Find profiles with `deleted_at < now() - 30 days`.
 *   2. For each, attempt `auth.admin.deleteUser(id)`. (Profile row is
 *      handled by the cascade FK in `profiles.id → auth.users.id` —
 *      removing the auth row removes the profile row too.)
 *   3. Log per-user outcome; on auth-deletion failure, leave the profile
 *      tombstoned so a future run can retry.
 *   4. Return a summary `{ hardDeleted, errors }`.
 *
 * Idempotent: if the auth row is already gone, the call returns an error
 * we swallow and the profile gets cleaned up by the next run.
 */
export const hardDeleteStaleUsers = inngest.createFunction(
  {
    id: "hard-delete-stale-users",
    name: "Hard-delete users soft-deleted >30 days ago",
    retries: 1,
  },
  // Daily at 03:00 UTC — same window as regenerate-embeddings to keep
  // batch admin work in a single quiet hour.
  { cron: "0 3 * * *" },
  async ({ step, logger }) => {
    const cutoffIso = await step.run("compute-cutoff", () => {
      return new Date(
        Date.now() - RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
    });

    const { data: stale, error: selErr } = await supabase
      .from("profiles")
      .select("id, deleted_at")
      .lt("deleted_at", cutoffIso)
      .not("deleted_at", "is", null);

    if (selErr) {
      logger.error("[hard-delete-stale-users] select failed:", selErr);
      throw selErr;
    }

    if (!stale || stale.length === 0) {
      logger.info(
        `[hard-delete-stale-users] no profiles older than ${cutoffIso}`,
      );
      return { hardDeleted: 0, errors: 0 };
    }

    logger.info(
      `[hard-delete-stale-users] purging ${stale.length} profiles soft-deleted before ${cutoffIso}`,
    );

    let hardDeleted = 0;
    let errors = 0;

    for (const row of stale) {
      const userId = row.id as string;

      // Delete the auth user. The profile row cascades via FK.
      const { error: authErr } =
        await supabase.auth.admin.deleteUser(userId);

      if (authErr) {
        // If the auth row is already gone (e.g., manual deletion), drop the
        // dangling profile row directly. Otherwise log and continue — the
        // next run will retry.
        if (
          typeof authErr.message === "string" &&
          /not found|does not exist/i.test(authErr.message)
        ) {
          const { error: profileErr } = await supabase
            .from("profiles")
            .delete()
            .eq("id", userId);
          if (profileErr) {
            errors++;
            logger.error(
              `[hard-delete-stale-users] profile cleanup failed for ${userId.slice(0, 8)}:`,
              profileErr,
            );
          } else {
            hardDeleted++;
          }
        } else {
          errors++;
          logger.error(
            `[hard-delete-stale-users] auth deletion failed for ${userId.slice(0, 8)}:`,
            authErr,
          );
        }
        continue;
      }

      hardDeleted++;
      logger.info(
        `[hard-delete-stale-users] hard-deleted user ${userId.slice(0, 8)}…`,
      );
    }

    return { hardDeleted, errors, total: stale.length };
  },
);
