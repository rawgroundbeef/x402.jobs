# Phase 31 — Rollback Runbook

**Phase status:** Shipped 2026-05-16 (PR #21 + post-merge fix train `b642594`..`08a9652`)
**Author:** Single-page runbook for emergency rollback.

## When to roll back

You'd reach for this if Phase 31 produces a real production regression that can't be forward-fixed within ~30 minutes. Common triggers:

- Railway api crashes on boot or returns 5xx for >5 min and you can't identify cause
- Vercel web build fails on a critical commit and `https://x402.jobs` is down
- A security-relevant problem appears in the merged codebase that can't be patched in place

You probably do NOT need to roll back for:
- Inngest "Unable to reach SDK URL" alerts after the Railway re-point — that's normal during deploy windows; wait 5 min, check Inngest dashboard for fresh sync
- Vercel preview deploys failing on docs-only PRs — preview != prod
- CI failures on PRs — fix forward, don't roll back

## The bad news

**Most of Phase 31 is one-way.** Specifically:
- **`rawgroundbeef/x402.jobs` cannot be un-publicized** — it's been PUBLIC since 2026-01-08 (Phase 31 didn't flip it; the dashboard already had it as public). Even if you could flip it private, the squash-imported backend code from PR #21 is already crawled and indexed.
- **`rawgroundbeef/x402-jobs-api` is archived** — read-only. You can un-archive it via `gh repo edit rawgroundbeef/x402-jobs-api --unarchive` if you need to push to it again (see "Full repo split" below).
- **The BSL 1.1 LICENSE commit is in public history** — the license declaration itself can't be retroactively un-applied; the only path is to issue a new LICENSE update going forward.

## Rollback options (from least to most invasive)

### 1. Vercel rollback (fastest — restore a prior web deploy)

If a recent push broke the web app on prod:

```bash
# Find the last known-good deploy hash via Vercel dashboard
# OR via the GitHub status events:
gh api repos/rawgroundbeef/x402.jobs/commits/<sha>/statuses --jq '.[] | select(.context=="Vercel" and .state=="success") | .target_url'
```

Then in Vercel dashboard: **Deployments** → click the prior good deployment → **Promote to Production**. Takes ~30s.

This is fully reversible. Use this for non-critical web regressions.

### 2. Railway rollback (restore a prior api deploy)

If Railway's redeploy from a recent push broke the api:

In Railway dashboard: **Deployments** → find the prior successful deployment → **Redeploy** that specific image.

Takes ~1–3 min depending on rebuild needs. Encryption secrets are env-var-based so survive across redeploys.

⚠ Don't redeploy a Railway image from BEFORE the Phase 31 re-point — those images were built from the old `rawgroundbeef/x402-jobs-api` source which Railway no longer watches. Stick to images from the monorepo's `apps/api/Dockerfile` (`08a9652` or later on main).

### 3. Revert a specific commit on main

If a post-Phase-31 commit on main caused regression:

```bash
git checkout main
git pull
git revert <bad-sha> --no-edit
git push
```

Vercel + Railway will auto-redeploy the reverted state.

Acceptable for any commit AFTER PR #21 merged. Reverting commits FROM inside PR #21 (the squash-import `4fe9e27`, the merge commit `6b9dc7a`, or the post-merge fix train `b642594`..`08a9652`) is much harder — see option 4.

### 4. Revert PR #21 entirely (nuclear — un-monorepo the repo)

This rolls back the entire monorepo merge.

```bash
git checkout main
git pull
git revert -m 1 6b9dc7a --no-edit
# Resolve merge conflicts (there will be many — every file in apps/api/
# will be marked as deleted)
git commit
git push
```

After this:
- `apps/api/` is gone from the monorepo
- Railway will fail to deploy (Dockerfile path no longer exists in main)
- You'd need to either re-point Railway back to `rawgroundbeef/x402-jobs-api`, OR re-import api code via a fresh path

**To restore the api repo as the live api source:**
```bash
gh repo edit rawgroundbeef/x402-jobs-api --unarchive
# In Railway dashboard: Source → change connected repo back to
# rawgroundbeef/x402-jobs-api, Root Directory back to '.', save, redeploy.
# In Vercel dashboard: no change (still apps/web only).
```

The api repo's `main` branch was at sha `693e1e3` at squash-import time. It hasn't moved since (no new commits because nobody pushed to it). So un-archiving + re-pointing Railway should restore it to operating-as-before-Phase-31 state.

### 5. License rollback (rare — re-apply MIT or similar)

If for any reason the BSL 1.1 license needs to be retracted, the path is:
1. Issue a new commit replacing `LICENSE` with whatever new license you want
2. Update README, SECURITY.md, CONTRIBUTING.md to match
3. Make a public statement about the license change

You CANNOT un-license code already distributed under BSL — every commit before the license change is BSL-licensed forever. The new license only governs the code going forward.

Don't do this lightly. Plan 31-05 closure includes a public-facing announcement; reversing the license publicly would be a brand event.

## What's NOT recoverable

| Item | Why not recoverable |
|------|--------------------|
| Public visibility of pre-scrub admin email / Supabase project IDs / personal scripts | Repo was crawled during the ~15-hour window between squash-import push and scrub commits. Indexed by grep.app, sourcegraph, etc. History rewrite would help going forward but not what's already crawled. |
| The squash-import provenance | `rawgroundbeef/x402-jobs-api` history pre-merge is preserved in the archived private repo. Forensic reconstruction is possible via that repo (un-archive temporarily, query, re-archive). |
| Inngest scheduled function executions during a deploy window | If Railway re-deploys take the api down briefly, Inngest cron tasks during that window fail with "Unable to reach SDK URL." Lost executions don't auto-replay. Check Inngest dashboard → Runs → Failed and manually re-trigger if business-critical. |

## Encryption secret reminder (DO NOT lose these)

Even during emergency rollback, these env vars MUST remain set on whatever Railway service is serving:
- `WALLET_ENCRYPTION_SECRET` — losing it permanently locks all user wallet data
- `INTEGRATION_ENCRYPTION_SECRET` — losing it permanently locks all OAuth integration tokens

Both should be backed up in 1Password / your password manager. Never rotate without first migrating affected ciphertext to the new key.

## Verifying rollback success

After any rollback action:
```bash
curl -s -o /dev/null -w "web HTTP %{http_code}\n" -m 8 https://x402.jobs
curl -s -o /dev/null -w "api HTTP %{http_code}\n" -m 8 https://api.x402.jobs/health
curl -s -m 8 https://api.x402.jobs/health
```

Expect:
- `web` → 200 or 307
- `api /health` → 200 with `{"status":"ok","service":"x402-jobs-api",...}`

Then check the Inngest dashboard for the most recent sync timestamp and Functions tab for normal cron firing.

## Refs

- Phase 31 PR: https://github.com/rawgroundbeef/x402.jobs/pull/21 (merged as `6b9dc7a`)
- Post-merge fix train: `b642594`, `cac7dc5`, `22b7d37`, `ea4672b`, `08a9652`
- Archived api repo: `rawgroundbeef/x402-jobs-api` (private, read-only) — `gh repo unarchive` to revive
- Phase 31 convergence evidence: `31-CONVERGENCE.md`
