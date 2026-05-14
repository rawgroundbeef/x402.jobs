# Phase 30 — Rollback Runbook

**Use this if:** any of the Phase 30 changes regresses production after merge.
**Time to fully revert:** ~10 minutes (commit + Vercel + Railway redeploy).
**Independence:** the two repos can be reverted independently. If only one platform regresses, revert only the matching repo's commit(s).

## Commit Reference

### This repo (`x402jobs`) — branch `plan/30-supply-chain-hardening` → PR #20
| Plan | Commit sha | What it changed |
|------|-----------|-----------------|
| 30 setup | `a0a019b` | `.gitignore`, `.planning/STATE.md`, `.planning/config.json` (Phase 30 planning-state setup) |
| 30-01 | `86cc3ef` | `package.json` — `packageManager` → `pnpm@10.6.5`, added `pnpm.onlyBuiltDependencies` (6 entries) |
| 30-01 merge | `2ba8a8c` | merge of worktree-executor's branch into `plan/30-supply-chain-hardening` |
| 30-01 blocker resolution | `29d0bfb` | SUMMARY update — BLOCKER-30-01-A resolved (Option 1: accept warnings) |
| 30-02 | `2b5345e` | `apps/web/vercel.json` — installCommand `pnpm@9.12.1` → `pnpm@10.6.5` |
| 30-04 | `e7835f1` | `.npmrc` (new file) — `minimum-release-age=4320` + `minimum-release-age-exclude=@x402jobs/*` |

(SUMMARY/docs commits are also in the branch but are doc-only — safe to leave even after code revert. They are listed in `git log main..plan/30-supply-chain-hardening`.)

### Sibling repo (`x402jobs-api`) — branch `chore/phase-30-03-pnpm-10-api` → PR #33
| Plan | Commit sha | What it changed |
|------|-----------|-----------------|
| 30-03 | `4877799` | `Dockerfile`, `vercel.json`, `package.json` — pnpm@10.6.5 across all three; `pnpm.onlyBuiltDependencies` expanded to the 6-entry empirical set |

## Revert Sequences

### Symptom A: Vercel build/runtime fails on pnpm 10 (web app down)

Revert THIS repo only, in **reverse merge order**:

```bash
cd /Users/rawgroundbeef/Projects/x402jobs
git checkout main
git pull
git revert <merge-commit-of-PR-20>
git push origin main
```

If PR #20 was merged with squash-merge, revert the single squash commit. If merged with merge-commit, revert with `git revert -m 1 <merge-sha>`.

Vercel redeploys on push to main (~3 min). Restores `pnpm@9.15.0` (`packageManager`) and `pnpm@9.12.1` (`apps/web/vercel.json`), removes the `pnpm.onlyBuiltDependencies` block, deletes `.npmrc`.

The sibling api repo is independent — Railway is unaffected by this revert.

### Symptom B: Railway build/runtime fails on pnpm 10 (api down)

Revert sibling repo only:

```bash
cd ~/Projects/x402jobs-api
git checkout main
git pull
git revert <merge-commit-of-PR-33>
git push origin main
```

Railway redeploys on push to main (~3 min). Restores the pre-`4877799` Dockerfile/vercel.json/package.json (pnpm@9 baseline, no `pnpm.onlyBuiltDependencies`).

The x402jobs web repo is independent — Vercel is unaffected by this revert.

### Symptom C: Local pnpm install broken across both repos

Most likely cause: the developer's local pnpm CLI version is now wrong because they upgraded mid-phase.

```bash
# Downgrade local pnpm CLI (per matching volta/corepack setup):
volta install pnpm@9.15.0    # if using volta
# OR
npm install -g pnpm@9.15.0   # if using npm-global

# Then revert per Symptom A and/or B above.
# pnpm 9 accepts the pnpm-10-regenerated lockfile (lockfileVersion '9.0' is back-compatible).
```

### Symptom D: ONLY the release-age policy is causing issues; deploys otherwise fine

If Vercel + Railway are green but `pnpm add` / `pnpm update` operations are blocked by `ERR_PNPM_NO_MATCHING_VERSION`:

```bash
cd /Users/rawgroundbeef/Projects/x402jobs
git checkout main
git pull
git revert e7835f1     # 30-04: .npmrc
git push origin main
```

Keeps the pnpm 10.6.5 bump everywhere; removes only the release-age gate. Vercel + Railway redeploy with no functional change (the gate doesn't bite on `--frozen-lockfile` installs anyway). The 5 ignored-build-scripts gate (pnpm.onlyBuiltDependencies) stays active.

### Symptom E: `Ignored build scripts: <new package>` appears post-merge

This means a lockfile drift or upstream dep added a postinstall step that wasn't in the BLOCKER-30-01-A accepted set.

**Do NOT revert.** Forward-fix:

```bash
cd /Users/rawgroundbeef/Projects/x402jobs   # or x402jobs-api
# Inspect the new package:
pnpm why <package>
# Decide: legitimate install need, or supply-chain red flag?
# If legitimate: add it to package.json#pnpm.onlyBuiltDependencies (in the right repo)
# If suspicious: pin the dep at the prior version in package.json, regenerate lockfile, investigate upstream
```

## Forward-Fix Alternatives (preferred to revert)

| Failure mode | Forward fix | Effort |
|---|---|---|
| `Ignored build scripts: <pkg>` (legitimate) | Add `<pkg>` to `pnpm.onlyBuiltDependencies` in matching repo's package.json, commit | 5 min |
| `ERR_PNPM_NO_MATCHING_VERSION` on a specific transitive (release-age too aggressive) | Add `minimum-release-age-exclude=<pkg-name>` to `.npmrc`, commit | 5 min |
| Next.js `ENOWORKSPACES` after some future pnpm bump | Re-check vercel/next.js#86845 status; either land the patch or pin back to pnpm@10.6.x | 15 min + research |
| Vercel build slows >30s | Acceptable (release-age gate fetches additional metadata); investigate only if >2min | n/a |

## Cross-Phase Dependencies After Revert

- **Phase 31 (Monorepo Merge)** ASSUMES Phase 30 landed. If you revert any of 30-01..30-04, leave a note in `.planning/STATE.md` so the Phase 31 plan generator knows to redo the pnpm 10 work first.
- **Phase 28 HIGH remediation** is independent — no impact either way.
- The sibling api repo PR #33 can be reverted independently of this repo's PR #20.

## Recovery Verification After Revert

If you've reverted any plan, confirm the recovery is clean:

```bash
# This repo
cd /Users/rawgroundbeef/Projects/x402jobs
pnpm --version                                    # should match the reverted packageManager
rm -rf node_modules
pnpm install                                      # should complete without errors
pnpm --filter @x402jobs/web build                 # should still succeed (lockfile is cross-version compatible)

# Api repo
cd ~/Projects/x402jobs-api
rm -rf node_modules
pnpm install
pnpm build
```

If recovery verification fails, escalate — the lockfile may have an additional drift that the revert didn't catch.
