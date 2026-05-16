# Phase 31: Monorepo Merge + BSL 1.1 — Research

**Researched:** 2026-05-14
**Domain:** Monorepo consolidation, BSL 1.1 licensing, GitHub Actions path-filtered CI, public open-source launch ceremony
**Confidence:** HIGH (most domains) / MEDIUM (CI path-filter pitfalls, dev-orchestration choice)

## Summary

Phase 31 unifies the closed `rawgroundbeef/x402-jobs-api` backend (commit `4877799` at time of research) into `apps/api/` of this repo via a single squashed commit, applies BSL 1.1 with a Sentry-derived Additional Use Grant, ships unified GitHub Actions CI with path-filtered triggers, and finalizes `SECURITY.md` documenting deferred Phase 28 findings + the Phase 30 release-age policy.

**The biggest finding of this research:** **Phase 28 Batch H (Twitter OAuth hardening) is already shipped to the api repo's `main`.** Commit `c751857 fix(security): Phase 28 — remediate all 12 HIGH findings (#32)` merged on 2026-05-14, with all four sub-fixes from CONTEXT.md Decision 1 already implemented: migration 009 adds `x402_oauth_pending` table + ciphertext columns, `src/routes/integrations.ts:225-342` already verifies CSRF state and dual-writes encrypted tokens, and `scripts/migrate-encrypt-x-tokens.ts` is a working idempotent backfill script. This means the "Batch H as prerequisite sub-plan" framing in `31-CONTEXT.md` should be re-interpreted as **carrying forward already-shipped code, not building it**. The merge brings the Batch H work into this repo; no additional implementation is needed. The planner should call this out explicitly so the user can confirm the re-interpretation before plans run.

**Primary recommendation:** Plan Phase 31 as 5-6 plans: (1) BSL 1.1 LICENSE + README/CONTRIBUTING/SECURITY skeleton — drafted and committed BEFORE the merge so the public history starts clean; (2) squash-import of api repo via `git read-tree --prefix=apps/api/` against `4877799` (or the latest sha at execution time), including the untracked `pnpm-workspace.yaml` from the api maintainer's working tree; (3) workspace tooling reconciliation (root pnpm-workspace.yaml absorbs `ignoredBuiltDependencies: [isolated-vm]`, root `package.json#pnpm.onlyBuiltDependencies` becomes the union of both repos' lists, tsconfig + eslint stay app-local); (4) unified GitHub Actions CI workflow using `dorny/paths-filter@v3` to gate per-app jobs; (5) local-dev orchestration via root `pnpm dev` wired through Turbo (`turbo run dev`) with fallback scripts; (6) public-flip ceremony — finalize SECURITY.md, archive the api remote, flip repo visibility. Both deploy lanes (Vercel + Railway) stay split per Decision 4; the merge does not touch either deploy config except for a one-time path adjustment in `apps/api/vercel.json` (which Decision 4 says can be deleted since Railway is the api lane).

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists at the repo root. Project-level conventions are inferred from existing planning artifacts:

- **Conventional Commits with phase scope.** Recent commits use `docs(31): …`, `chore(phase-30): …`, `feat(28): …`. Phase 31 plans should follow this.
- **pnpm 10.6.5 invariant.** Both repos pinned at exact `pnpm@10.6.5` deliberately — see `30-CONVERGENCE.md` line 4 ("avoids Next.js 15.5 + pnpm 10.7.0+ ENOWORKSPACES bug, vercel/next.js#86841"). Phase 31 must NOT bump pnpm.
- **Don't squash PR commits.** Per the squashed-import research finding ("if you squashed the PR before committing, all history would be gone"), but THIS rule is about preserving granular history across PRs in this repo; the squash-import IS a one-time intentional squash for the api repo's working tree. Distinct concept.
- **`.npmrc` release-age policy.** Per Phase 30 plan 30-04, `frozen-lockfile=true` is intentionally NOT in the root `.npmrc`; pnpm auto-enables it via `CI=true`. Phase 31 must NOT add `frozen-lockfile` either.
- **Deploy-preview-only validation.** Per `30-CONVERGENCE.md` deferred items + STATE.md, there is no CI in either repo yet. Vercel preview + Railway main-branch are the de-facto CI surface today. Phase 31 introduces the first real CI workflow.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Decision 1: Phase 28 Highs handling.** Fold Batch H (Twitter OAuth hardening) into Phase 31 as a prerequisite sub-plan. Everything else (Batches A, B, C, D, E, F, G, I) deferred to a `SECURITY.md` "Known unfixed findings" section + filed GitHub issues. Batch H's four sub-fixes (all required):
1. Add `state` nonce on init; verify on callback
2. Move `oauthRequests` from in-memory `Map` → Redis OR new `x402_oauth_pending` table with TTL
3. Encrypt `access_token` + `access_secret` at rest using existing `encryptSecret` from `lib/instant/encrypt`
4. Migration path for already-connected accounts (either one-shot re-encrypt script or force re-auth)

> **CRITICAL RE-INTERPRETATION (verified during research, see Architectural Responsibility Map + Open Questions):** All four Batch H sub-fixes are ALREADY SHIPPED in `x402jobs-api` `main` (commit `c751857`, merged 2026-05-14). The merge carries this work forward unchanged. The "Batch H as prerequisite" framing in CONTEXT.md predates the api-repo merge of PR #32. The planner should treat Decision 1 as "the four sub-fixes are already implemented; Phase 31's task is to (a) verify they're carried into `apps/api/` correctly during the squash-import, (b) document them in SECURITY.md as FIXED rather than deferred, (c) NOT plan a separate Batch H plan." This re-interpretation is consequential for plan count and should be confirmed with the user before plans run.

**Decision 2: License.** BSL 1.1 with Sentry-style Additional Use Grant. Draft text in CONTEXT.md is the starting point. Change date: 4 years from initial public commit. Falls back to Apache-2.0. Internal commercial use is allowed.

**Decision 3: Git history strategy.** Squashed import of `x402jobs-api` working tree → `apps/api/`. Single squash commit: `feat(monorepo): import x402jobs-api at <archived-commit-sha> into apps/api/`. Closed-repo commit history preserved in the archived private `rawgroundbeef/x402-jobs-api` remote.

**Decision 4: Deploy lanes.** Stay split. Vercel for `apps/web`, Railway for `apps/api`. Path-filtered triggers so only the affected app redeploys on a PR.

**Decision 5 (note, not locked):** No literal 24h timing pressure.

### Claude's Discretion

- Whether Batch H lives as `31-01-PLAN` (single plan) or sub-tasks inside the larger merge plan — given the re-interpretation above, this is moot if user confirms.
- Exact CI scope (which test/lint commands fire, which Node version matrix)
- README structure (planner can propose)
- Migration folder consolidation specifics
- Whether to add `apps/api/CLAUDE.md` or just merge into root `CLAUDE.md`
- Inngest dev server orchestration — `pnpm dev` should spin up web (3010) + api (3011) + Inngest in a single command; planner picks the mechanism

### Deferred Ideas (OUT OF SCOPE)

- Consolidating deploy infrastructure (Vercel for both, or Railway for both) — Decision 4 keeps split
- Migrating to a different pnpm version — Phase 30 locked 10.6.5
- Bug bounty program structure beyond a `SECURITY.md` disclosure address

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frontend (web app) | Vercel (apps/web) | — | Already deployed; Phase 30 set pnpm@10.6.5 pin |
| Backend (REST API + Inngest workers) | Railway (apps/api) | — | Already deployed via Dockerfile; Phase 30 set pnpm@10.6.5 pin |
| OAuth state storage (Twitter) | Database (Supabase) | — | Already implemented as `x402_oauth_pending` table per migration 009; replaces in-memory Map [VERIFIED: api commit c751857] |
| Token encryption at rest | Application code (api) | Database (ciphertext columns) | `encryptSecret` uses AES-256-CBC via `INTEGRATION_ENCRYPTION_SECRET` env; ciphertext stored in `access_token_ciphertext` / `access_secret_ciphertext` columns [VERIFIED: src/lib/instant/encrypt.ts] |
| CI (lint/typecheck/test) | GitHub Actions (path-filtered) | — | Greenfield in this repo; per 30-CONVERGENCE.md "neither repo has CI workflows yet" |
| License governance | Root `LICENSE` file | `SECURITY.md` cross-references | One LICENSE applies to the whole monorepo per the squash-import strategy |
| Squash-import mechanics | Git working-tree operation (read-tree --prefix) | Archived remote (history preservation) | One-time at-merge import; history lives in the archived private remote |

**Cross-tier sanity checks:**
- OAuth state nonce verification happens server-side in the api tier (NOT the web tier). The web tier only initiates `/integrations/x/oauth/initiate` and receives the eventual success redirect.
- The `state` PK is generated server-side in the api on init; never exposed for client manipulation.
- Encryption key (`INTEGRATION_ENCRYPTION_SECRET`) lives in api env only; never on the web tier.

## Standard Stack

### Core (already in use; merge preserves)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 10.6.5 (exact) | Package manager | Phase 30 locked pin — do NOT bump [VERIFIED: 30-CONVERGENCE.md] |
| Turbo | ^2.3.0 | Monorepo task orchestration | Already wired in root `package.json` |
| TypeScript | 5.8.2 (api) / ^5.3.3 (web) | TS compiler | Already in use; reconciling versions is OPTIONAL but recommended (Phase 31 can leave them divergent — both apps build independently) |

### New (introduced by Phase 31)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dorny/paths-filter` | `@v3` | Path-filtered job gating in GitHub Actions | The de-facto standard for monorepo path-filtered CI; supports multi-filter declarations + `if` conditions on downstream jobs [VERIFIED: github.com/dorny/paths-filter] |
| `actions/checkout` | `@v4` | Git checkout in workflow | Standard for any GitHub Actions workflow |
| `actions/setup-node` | `@v4` | Node 22 install | Mirrors api Dockerfile's Node 22 base |
| `pnpm/action-setup` | `@v4` | pnpm install in Actions | Official pnpm action; reads `packageManager` from root package.json to match local |

### Already in use for orchestration (no new install needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `concurrently` | ^8.2.2 (api repo) | Multi-process dev runner | Already a devDep in api repo; spawn `pnpm dev:api` + `pnpm dev:inngest` together [VERIFIED: x402jobs-api/package.json] |
| `nodemon` | ^3.0.2 | TS-aware api watch mode | Already a devDep in api repo |
| `inngest-cli` | latest (via `npx`) | Local Inngest dev server | Already invoked in api repo's `dev:inngest` script |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dorny/paths-filter` | Native `paths:` workflow trigger | Native works for "fire workflow on changes to X" but cannot gate INDIVIDUAL JOBS within a workflow on path changes. `dorny/paths-filter` gives that fine-grained control; needed because both web and api jobs share one workflow file. [VERIFIED: WebSearch monorepo path-filter discussions, GitHub Discussions #164673] |
| `git read-tree --prefix=` | `git filter-repo --to-subdirectory-filter` | `filter-repo` preserves full history; we explicitly want to discard history (Decision 3). `read-tree` is the cleaner squash-import primitive: it stages the api repo's tree under `apps/api/` and a single `git commit` creates one squash commit with no history leakage. `cp -r` + commit also works but loses the structured-import feel. |
| Turbo `dev` task | Root-level `concurrently` script | Turbo's persistent-task model handles this cleanly when both apps have `dev` scripts. Concurrently is fine too but loses Turbo's parallelization/log-prefix niceties. **Recommend Turbo** since the root already uses `turbo run dev`. |
| `BUSL-1.1` SPDX identifier | Custom legal text | The BSL 1.1 template MUST be used verbatim (MariaDB's covenant 4: "Not to modify this License in any other way"). The Parameters block at the top is where we customize. |

**Installation (during Phase 31 execution):**

```bash
# No npm installs needed for the squash-import itself.
# The api repo's package.json comes WITH the imported tree, so all its deps
# (concurrently, nodemon, isolated-vm, twitter-api-v2, etc.) appear in the
# merged pnpm-lock.yaml when we run `pnpm install` post-merge.
```

**Version verification:**

```bash
# Verify api repo HEAD before squash-import:
cd /Users/rawgroundbeef/Projects/x402jobs-api && git rev-parse HEAD
# Result during research: 4877799 (on chore/phase-30-03-pnpm-10-api)
# At execution time, the user should merge any open api-repo branches first
# and squash-import from main. If main is at 4877799 still, that's the sha
# the squash commit message references.

# Verify pnpm versions are still aligned:
pnpm --version       # 10.6.5
node --version       # v22.x to match api Dockerfile
```

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────────────────────────────────────┐
                  │  Public GitHub repo: rawgroundbeef/x402.jobs │
                  │  (BSL 1.1, single repo, post-Phase 31)       │
                  └────────────────────────┬─────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
    │   apps/web/      │         │   apps/api/      │         │  packages/sdk/   │
    │   Next.js 15.5   │         │  Express + tsup  │         │  packages/ui/    │
    │   (existing)     │         │  (imported via   │         │  (existing)      │
    │                  │         │   squash from    │         │                  │
    │                  │         │   x402-jobs-api) │         │                  │
    └────────┬─────────┘         └────────┬─────────┘         └──────────────────┘
             │                            │
             │ git push                   │ git push
             │ (path: apps/web/**)        │ (path: apps/api/**)
             ▼                            ▼
    ┌──────────────────┐         ┌──────────────────┐
    │ Vercel deploy    │         │ Railway deploy   │
    │ (existing lane)  │         │ (existing lane)  │
    └──────────────────┘         └──────────────────┘

             ▲                            ▲
             │                            │
             │       Both gated by        │
             │      GitHub Actions CI     │
             │     (path-filtered jobs)   │
             │                            │
             └────────────┬───────────────┘
                          │
                ┌─────────▼────────┐
                │  .github/        │
                │  workflows/      │
                │  ci.yml          │
                │  (NEW)           │
                └──────────────────┘

Local dev (single command):
    pnpm dev  →  turbo run dev  →  [ apps/web (port 3010)
                                    │ apps/api (port 3011)
                                    │ inngest-cli dev (port 8288)
                                    └ all concurrent ]
```

### Recommended Project Structure (post-merge)

```
x402jobs/
├── apps/
│   ├── web/               # existing — Next.js 15.5
│   └── api/               # NEW — squash-import of x402-jobs-api
│       ├── src/           # 144 .ts files (1.8 MB)
│       ├── migrations/    # flat migrations 001-010 (legacy format)
│       ├── supabase/
│       │   └── migrations/  # canonical timestamped migrations
│       ├── scripts/       # backfill scripts incl. migrate-encrypt-x-tokens.ts
│       ├── Dockerfile     # Railway build (pnpm@10.6.5 baked in)
│       ├── railway.json   # Railway deploy config
│       ├── tsup.config.ts
│       ├── tsconfig.json
│       ├── eslint.config.mjs
│       ├── package.json   # has its own dev/build/test scripts
│       └── vercel.json    # DELETE per Decision 4 (Railway is the api lane)
├── packages/
│   ├── sdk/               # existing
│   └── ui/                # existing
├── .github/
│   └── workflows/
│       └── ci.yml         # NEW — path-filtered lint/typecheck/test
├── LICENSE                # NEW — BSL 1.1 with Sentry-style grant
├── README.md              # REWRITTEN — public-facing
├── SECURITY.md            # NEW — vulnerability disclosure + Phase 28 deferreds + Phase 30 release-age policy
├── CONTRIBUTING.md        # NEW — contributor guidelines
├── CLAUDE.md              # OPTIONAL — repo-wide AI assistant rules
├── .npmrc                 # existing — Phase 30's 4320-minute release-age gate
├── package.json           # root — Turbo orchestration; pnpm.onlyBuiltDependencies merged
├── pnpm-workspace.yaml    # absorbs api repo's ignoredBuiltDependencies: [isolated-vm]
├── pnpm-lock.yaml         # regenerated by post-import `pnpm install`
└── turbo.json             # add `test` task; existing dev task already persistent
```

**Note on `apps/api/` internal structure:** The api repo's `migrations/` folder (flat, 001-010 SQL files) is the operational source-of-truth — it's what's been applied to production. The `supabase/migrations/` folder is the Supabase-CLI format with timestamped prefixes. These are **two parallel migration tracks** in the api repo today (see Migration Folder Consolidation pitfall below). Decision: keep both for Phase 31 (planner can defer reconciliation), or audit and consolidate into one. Recommend the planner asks the user.

### Pattern 1: Squashed import via `git read-tree --prefix`

**What:** One-command import of the api repo's working tree into a subdirectory, producing exactly one commit with no history baggage.

**When to use:** Decision 3 — squash-import preserving zero closed-repo history.

**Example:**

```bash
# At the start of Phase 31, on a fresh branch off main:
cd /Users/rawgroundbeef/Projects/x402jobs
git checkout -b phase/31-monorepo-merge

# Step 1: Add api repo as a remote (local path — fast, no clone needed)
git remote add api-import /Users/rawgroundbeef/Projects/x402jobs-api
git fetch api-import main

# Step 2: Read its working tree under apps/api/ into THIS repo's index
git read-tree --prefix=apps/api/ -u api-import/main

# Step 3: Verify the tree landed correctly
ls apps/api/
# Should show: src/ migrations/ supabase/ scripts/ Dockerfile package.json tsconfig.json ...
# Should NOT show: node_modules/ dist/ .env (these are gitignored in the api repo)

# Step 4: ALSO copy in the untracked-but-required pnpm-workspace.yaml from the
# api maintainer's working tree (git ls-files showed it is NOT tracked in the
# api repo — it lives only on the maintainer's disk).
cp /Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml apps/api/pnpm-workspace.yaml
# (See "Pitfall: untracked pnpm-workspace.yaml" below.)

# Step 5: Remove the remote — we don't need it after the import
git remote remove api-import

# Step 6: Single squash commit. Reference the archived commit sha for provenance.
git commit -m "feat(monorepo): import x402jobs-api at 4877799 into apps/api/

Squashed working-tree import of rawgroundbeef/x402-jobs-api per Phase 31
Decision 3. Closed-repo commit history preserved in the archived private
remote at rawgroundbeef/x402-jobs-api (kept private, not deleted).

Source sha: 4877799 (chore(phase-30): bump pnpm to 10.6.5 in api repo)
Source remote: github.com/rawgroundbeef/x402-jobs-api
Imported tree: 144 .ts files, 1.8 MB src/ + migrations/ + scripts/

Phase 28 HIGH remediations included in this import (already shipped to
api/main as PR #32, commit c751857):
  - HIGH-02 Batch H (Twitter OAuth: state nonce, x402_oauth_pending table,
    AES-256-CBC token encryption at rest, backfill script)
  - All other 11 HIGHs (Batches A-I from HIGHS-TRIAGE.md)

Refs: Phase 31 CONTEXT Decision 3"
```

**Why `read-tree --prefix` over alternatives:**
- `git subtree add --squash --prefix=apps/api/ <remote> main` — works but creates a merge commit. We want a plain commit.
- `git filter-repo --to-subdirectory-filter apps/api/` — preserves full history; opposite of what we want.
- `cp -r ../x402jobs-api/ apps/api/` + commit — works but doesn't follow gitignore semantics; would copy node_modules/, dist/, .env files. Unsafe.

**Caveats:**
- `git read-tree -u` reads from the index, so respects gitignore correctly (it only stages what was in the source repo's HEAD tree).
- The api repo's `.gitignore` lists `wallet-backup-*.json`, `.env*`, `node_modules/`, `dist/` — these will NOT come across, which is correct.
- The api repo's `pnpm-workspace.yaml` is UNTRACKED (see Pitfall section). Must be copied manually OR added to the api repo first then re-imported.
- The api repo HEAD at research time was on branch `chore/phase-30-03-pnpm-10-api` not main. At execution time, the user must first ensure the latest desired sha is on api repo's `main` (either by merging the open PRs or rebasing).

### Pattern 2: Unified GitHub Actions CI with `dorny/paths-filter@v3`

**What:** Single workflow file that runs lint+typecheck+test for whichever app(s) changed in the PR.

**When to use:** Decision 4 deploys are split; CI should mirror that split.

**Example (`.github/workflows/ci.yml`):**

```yaml
# Source: github.com/dorny/paths-filter (verified pattern)
# Verified: GitHub Discussions #164673 on path-filtering best practices
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  changes:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
      contents: read
    outputs:
      web: ${{ steps.filter.outputs.web }}
      api: ${{ steps.filter.outputs.api }}
      shared: ${{ steps.filter.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'apps/web/**'
              - 'packages/ui/**'
              - 'packages/sdk/**'
            api:
              - 'apps/api/**'
            shared:
              - 'package.json'
              - 'pnpm-lock.yaml'
              - 'pnpm-workspace.yaml'
              - 'turbo.json'
              - '.npmrc'
              - 'tsconfig*.json'

  web:
    needs: changes
    if: needs.changes.outputs.web == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.6.5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @x402jobs/web lint
      - run: pnpm --filter @x402jobs/web typecheck
      - run: pnpm --filter @x402jobs/web build

  api:
    needs: changes
    if: needs.changes.outputs.api == 'true' || needs.changes.outputs.shared == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.6.5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter x402-jobs-api lint
      - run: pnpm --filter x402-jobs-api typecheck
      - run: pnpm --filter x402-jobs-api test
      - run: pnpm --filter x402-jobs-api build
```

**Caveats:**
- The `shared` filter is critical — without it, a change to root `package.json` or `pnpm-lock.yaml` would skip both apps (since neither `web` nor `api` glob would match). The `if: needs.changes.outputs.web == 'true' || shared == 'true'` pattern catches this.
- `pnpm/action-setup@v4` reads `packageManager` from root `package.json` automatically — pin matches the existing Phase 30 baseline.
- `dorny/paths-filter@v3` requires `pull-requests: read` permission; explicit declaration shown above.
- Push events behave differently — they compare against the previous commit, not a PR base. Both are handled correctly by the action.
- `actions/cache@v4` for pnpm is enabled via `cache: 'pnpm'` on `setup-node@v4`.

### Pattern 3: `pnpm dev` orchestration via Turbo persistent tasks

**What:** Root `pnpm dev` runs web + api + Inngest dev server concurrently with one command; per-app fallbacks remain available.

**When to use:** CONTEXT discretion area (which mechanism); risk register flags Inngest orchestration as a "new surface" so add fallback scripts.

**Existing state:**
- This repo's root `package.json` already has `"dev": "turbo run dev"` [VERIFIED]
- This repo's `apps/web/package.json` has `"dev": "next dev -p 3010"` [VERIFIED]
- The api repo's `package.json` has `"dev": "concurrently --kill-others \"pnpm dev:api\" \"pnpm dev:inngest\""` with PORT=3011 [VERIFIED]
- This repo's `turbo.json` already marks `dev` as `"persistent": true, "cache": false` [VERIFIED]

**Plan:** Post-merge, `apps/api/package.json`'s existing `dev` script (which already runs concurrently → api+inngest) becomes a Turbo-managed persistent task. The root `pnpm dev` invokes `turbo run dev` which kicks off both `apps/web` and `apps/api` in parallel. The api's inngest dev server runs as part of the api's concurrently chain, so Inngest comes up automatically.

```bash
# Verify post-merge
pnpm dev
# Should produce three parallel processes (Turbo prefixes log lines per package):
#   @x402jobs/web:dev: Ready in 1.4s, Local: http://localhost:3010
#   x402-jobs-api:dev: nodemon → API listening on :3011
#   x402-jobs-api:dev: inngest-cli dev server on :8288

# Fallback scripts at root (add to root package.json):
pnpm dev:web     # = pnpm --filter @x402jobs/web dev
pnpm dev:api     # = pnpm --filter x402-jobs-api dev:api
pnpm dev:inngest # = pnpm --filter x402-jobs-api dev:inngest
```

**Caveats:**
- The api repo's `dev` script uses `concurrently --kill-others` which means Ctrl-C kills both api and Inngest. Good behavior; preserve.
- Turbo's persistent-task model handles long-running processes well as of Turbo 2.0.4 (turbo watch). [VERIFIED: WebSearch Turborepo docs]
- Port conflicts: web=3010, api=3011, Inngest dev=8288 (default). All non-conflicting.
- `inngest-cli` is invoked via `npx inngest-cli@latest` — no install pin needed; uses npm's release-age gate via Phase 30's `.npmrc`.

### Pattern 4: BSL 1.1 LICENSE file with Parameters block

**What:** The canonical BSL 1.1 template with a Parameters block at the top. The MariaDB covenant forbids modifying the body of the License; only the Parameters block is customized.

**When to use:** Decision 2 — BSL 1.1 with Sentry-style Additional Use Grant. Verbatim license text matters legally.

**Structure (verified from MariaDB canonical text + Couchbase real-world example + SPDX BUSL-1.1):**

```
Business Source License 1.1

Parameters

Licensor:             [LEGAL ENTITY NAME — e.g., x402.jobs Inc., or
                       the user's personal name if no entity. Planner
                       must ASK the user — this is a legal question.]

Licensed Work:        x402.jobs
                      The Licensed Work is (c) 2026 [Licensor name].

Additional Use Grant: You may make use of the Licensed Work, provided
                      that you do not use the Licensed Work for an
                      x402 Workflow Service. An "x402 Workflow Service"
                      is a commercial offering that allows third
                      parties (other than your employees and
                      contractors) to create, publish, or execute paid
                      HTTP workflow endpoints with x402 payments using
                      the workflow-builder, payment-execution, or
                      resource-registration features of the Licensed
                      Work.

Change Date:          2030-XX-XX  (four years from the date of the
                      initial public commit landing this LICENSE file)

Change License:       Apache License, Version 2.0

For information about alternative licensing arrangements for the
Licensed Work, please contact [SECURITY/LEGAL CONTACT EMAIL].

[FULL BSL 1.1 LICENSE BODY — verbatim from MariaDB canonical, see
RESEARCH source links. Body MUST NOT BE MODIFIED per covenant 4.]
```

**Key derivations from research:**
- The `Additional Use Grant` follows the **Sentry pattern verbatim in structure** (the "Application Monitoring Service" example from Sentry's historical BSL 1.1 license, before they moved to FSL). I adapted "Application Monitoring Service" → "x402 Workflow Service" and changed the functionality clause from "error-reporting or application monitoring features" → "workflow-builder, payment-execution, or resource-registration features". The "your employees and contractors" exemption is verbatim from Sentry. [VERIFIED: Sentry's historical BSL grant via WebSearch, exact text captured in this research]
- The 4-year Change Date is BSL's NORM (MariaDB also caps at 4 years per the License body text: "four years from the date of the initial publicly available distribution"). Couchbase uses 4-year, Akka uses 3-year. 4 matches CONTEXT Decision 2 ("Change date: 4 years from initial public commit"). [VERIFIED: MariaDB canonical text "fourth anniversary"]
- Change License = Apache 2.0 satisfies covenant 1 (GPL-compatible). [VERIFIED: MariaDB BSL FAQ]
- The full license body text (the part after the Parameters block) MUST be verbatim. The planner should fetch it directly from one of these sources during the plan execution:
  - https://mariadb.com/bsl11/ (canonical)
  - https://spdx.org/licenses/BUSL-1.1.html (SPDX, machine-readable)
  - Recent BSL 1.1 file in another well-known repo (HashiCorp, Couchbase)

**Caveat for the planner:** Two questions for the user before drafting:
1. What's the Licensor entity name? Personal name or LLC/Inc.?
2. Is the "x402 Workflow Service" wording correct? The CONTEXT draft is broader: "a service that competes with the commercial product or service offered by Licensor (or its successor) that is materially similar to x402.jobs, including but not limited to a hosted service that allows third parties to create or execute paid HTTP workflow endpoints with x402 payments." The CONTEXT version is more defensible because it doesn't rely on a precise feature-list (which competitors could route around by changing one feature name). The Sentry-style version is more readable. **Recommendation: use CONTEXT's wording, since CONTEXT is locked.** Planner should NOT silently swap to the Sentry-style adaptation; if the simpler form is desired, ask the user explicitly.

### Pattern 5: Squash-import — handle the untracked `pnpm-workspace.yaml`

**What:** The api repo's `pnpm-workspace.yaml` (containing `ignoredBuiltDependencies: [isolated-vm]`) is **untracked in the api repo's git** but lives on the maintainer's disk and is operationally required.

**When to use:** During squash-import; if you forget this step, post-import `pnpm install` will fail with isolated-vm build-script gating.

**Verified state at research time:**

```bash
$ cd /Users/rawgroundbeef/Projects/x402jobs-api
$ git ls-files pnpm-workspace.yaml
# (empty output — file is UNTRACKED)
$ git log --all -- pnpm-workspace.yaml
# (empty output — never tracked)
$ cat pnpm-workspace.yaml
ignoredBuiltDependencies:
  - isolated-vm
```

**Mitigation:** During the squash-import, copy this file from the api maintainer's working tree explicitly (Step 4 of the import recipe above). Then make a choice:

- **Option A:** Keep `apps/api/pnpm-workspace.yaml` as a separate workspace config. This DOES NOT WORK with pnpm — pnpm only reads the nearest `pnpm-workspace.yaml` to the cwd, and the root one (with `packages: [apps/*, packages/*]`) takes precedence. [VERIFIED: pnpm GitHub Discussion #10267]
- **Option B (correct):** Merge `ignoredBuiltDependencies: [isolated-vm]` INTO the root `/Users/rawgroundbeef/Projects/x402jobs/pnpm-workspace.yaml`. Then DELETE `apps/api/pnpm-workspace.yaml` from the imported tree. Verify post-merge that the api repo's `package.json#pnpm.onlyBuiltDependencies` allow-list (which includes `isolated-vm`, `bigint-buffer`, etc.) is also merged into the root `package.json#pnpm.onlyBuiltDependencies` allow-list.

**Pnpm version sensitivity:** `ignoredBuiltDependencies` was REMOVED in pnpm 11 [VERIFIED: pnpm/settings docs]. We're pinned at 10.6.5, so this setting still works. The planner should leave a comment in the merged `pnpm-workspace.yaml` noting "if pnpm is ever upgraded past 10.x, migrate `ignoredBuiltDependencies` → `allowBuilds: { 'isolated-vm': false }`".

### Pattern 6: GitHub repo archive ceremony

**What:** GitHub's "Archive this repository" makes it read-only while preserving full history, visibility, and access patterns.

**When to use:** End of Phase 31, after the merge PR ships to main on the public repo.

**Mechanics (verified from GitHub Docs):**
1. Push final commit to `x402jobs-api` main: `chore: merged into rawgroundbeef/x402.jobs apps/api/ — see https://github.com/rawgroundbeef/x402.jobs (Phase 31)`. Touches only README.md to add a top-of-file banner.
2. GitHub UI: Settings → Danger Zone → "Archive this repository" → confirm.
3. Verify: Issues, PRs, code, branches, commits are now read-only (cannot create new issues, cannot push). [VERIFIED: GitHub Docs]
4. **Visibility unchanged:** Archiving does not flip private → public. The repo stays private. [VERIFIED]
5. Forks/stars from contributors continue to work.

**No additional GitHub Actions are needed.** Archive is a UI / API action only.

### Anti-Patterns to Avoid

- **Anti-pattern: Squash-import via `git filter-repo --to-subdirectory-filter`.** Why bad: This preserves full history, which contradicts Decision 3 ("squashed import" — clean public starting point). Use `git read-tree --prefix=` instead.
- **Anti-pattern: Multiple `pnpm-workspace.yaml` files.** Why bad: pnpm only reads the nearest one to cwd, so an `apps/api/pnpm-workspace.yaml` is dead weight when the root one exists. [VERIFIED: pnpm GitHub Discussion #10267] Merge everything to root.
- **Anti-pattern: `frozen-lockfile=true` in root `.npmrc`.** Why bad: Phase 30 explicitly DOES NOT include this. pnpm auto-enables it when `CI=true`, and adding it blocks local dev re-resolution. [VERIFIED: 30-04-PLAN.md interfaces section]
- **Anti-pattern: Using GitHub Actions `paths:` filter alone (no `dorny/paths-filter`).** Why bad: `paths:` only gates WHETHER a workflow runs at all, not which jobs within a workflow run. Both web and api would need separate workflows, which fragments the failure surface (one workflow's red status doesn't block the merge of an api-only change). Use `dorny/paths-filter@v3` for job-level gating. [VERIFIED: GitHub Discussions #123626]
- **Anti-pattern: Adding `apps/api/.github/workflows/`.** Why bad: GitHub Actions only reads workflows from the repo root's `.github/workflows/`. App-local workflow files are inert.
- **Anti-pattern: Modifying the BSL 1.1 license body text.** Why bad: MariaDB's covenant 4 forbids this. Only the Parameters block at the top is customizable. [VERIFIED: MariaDB canonical license text]
- **Anti-pattern: Public-flip BEFORE the merge PR is merged.** Why bad: A premature public flip with the api still in a separate private repo would expose the broken state ("the web app references an api host but the api code isn't here"). Public flip is the LAST step of Phase 31.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path-filtered CI jobs | A custom GitHub Actions script that reads `github.event.pull_request.changed_files` | `dorny/paths-filter@v3` | Handles pull_request vs push edge cases, base-branch comparison, multi-filter outputs cleanly. 100k+ users; battle-tested. |
| BSL 1.1 license text | A custom license that "captures the BSL spirit" | The verbatim BSL 1.1 template + a customized Parameters block | Custom license text is unenforceable and confuses contributors. The BSL 1.1 template has legal precedent (HashiCorp, Couchbase, MariaDB, Sentry's historical adoption). |
| Squash-import mechanics | A custom shell script doing `find` + `cp` + `rm node_modules` | `git read-tree --prefix=` (single command, gitignore-aware) | Native git primitive does the right thing without bespoke gitignore parsing. |
| Local-dev process supervision | A custom Node script spawning child processes | Existing `concurrently` (already a devDep) wrapped by `turbo run dev` | Both are proven in the api repo today. |
| OAuth state nonce | A bespoke nonce scheme | `crypto.randomBytes(32).toString("base64url")` keyed in a DB table with `expires_at` TTL | Already implemented in the api repo (migration 009 + `routes/integrations.ts` post-c751857). Don't re-do. |
| Token encryption at rest | A bespoke encrypt/decrypt routine | `encryptSecret` / `decryptSecret` from `src/lib/instant/encrypt.ts` (AES-256-CBC, `INTEGRATION_ENCRYPTION_SECRET`) | Already used across the codebase for Claude API keys, OpenRouter keys, and Twitter tokens. Mirrors Phase 27 wallet pattern. |
| Repo archive ceremony | A custom "freeze branch" script | GitHub's native Archive feature | Read-only flag is per-repo; UI/API toggle. No code needed. |
| Migration consolidation | Hand-merging timestamp prefixes | Leave both folders intact for Phase 31; defer to a v3.1 migration audit | The flat `migrations/` and `supabase/migrations/` are operationally distinct (Supabase CLI uses one, the api's own runner uses the other) — premature consolidation risks breaking deployments. |

**Key insight:** Almost every component of Phase 31 has a "use the existing thing" answer. The phase is a logistics exercise (squash-import, license drop, CI scaffold, ceremony) not a code-writing exercise. The biggest risk is reaching for clever solutions where the prosaic standard one suffices.

## Runtime State Inventory

This is a merge-and-rebrand phase that touches naming, file locations, deploy targets, and external services. Per RESEARCH protocol Step 2.5, here is the explicit inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — the merge does NOT rename databases, Supabase project, or any data columns. All migrations 001-010 (flat) + the timestamped supabase/migrations stay as-is and continue to apply to `mgvojndnifjbxvdxkdyd.supabase.co`. The `x402_oauth_pending` table exists; `x402_user_x_tokens` ciphertext columns exist. [VERIFIED: 30-CONVERGENCE.md mentions the Supabase project; migrations directory listing confirms schema state.] | None |
| **Live service config** | **Railway service config.** The Railway project for `x402jobs-api` deploys from `rawgroundbeef/x402-jobs-api`. Post-merge it must point at the new repo (`rawgroundbeef/x402.jobs`) and the new build root (`apps/api/`). Railway's Dockerfile path needs adjustment (`apps/api/Dockerfile` instead of root `Dockerfile`). | Manual Railway UI step: re-point service to new repo; set Root Directory = `apps/api` (or set Dockerfile path = `apps/api/Dockerfile`). Verify deploy succeeds. |
| **Live service config** | **Vercel project config.** The Vercel project for `x402jobs` web already deploys from this repo; no repo change needed. But check `apps/web/vercel.json` — `buildCommand: "turbo run build --filter=@x402jobs/web..."` should still work post-merge. | Likely no change. Verify Vercel preview on the merge PR. |
| **Live service config** | **Inngest production app.** The api Dockerfile launches the Inngest worker. Inngest's production dashboard shows registered functions tied to the API URL. The API URL doesn't change (still the Railway domain) — Inngest config carries forward. | None — pending Railway URL stays stable. |
| **Live service config** | **Helius webhooks.** Per the api codebase, `HELIUS_WEBHOOK_SECRET` env var. The webhook callback URL points at the API's Railway domain. | None — domain unchanged. |
| **Live service config** | **Twitter OAuth callback URL.** Configured at `config.twitter.callbackUrl` and registered in the Twitter Developer dashboard. The URL is API-domain-relative. | None — domain unchanged. |
| **OS-registered state** | None — there's no OS-level scheduler / launchd / systemd tied to the project name. Inngest's "cron" jobs are app-internal, not OS-registered. | None |
| **Secrets/env vars** | All env var NAMES stay the same (`SUPABASE_URL`, `WALLET_ENCRYPTION_SECRET`, `INTEGRATION_ENCRYPTION_SECRET`, `HELIUS_WEBHOOK_SECRET`, `TWITTER_API_KEY`, etc.). What CHANGES is that Railway must have all api env vars set on the new service if you re-create rather than re-point (re-pointing keeps env vars). | Verify Railway service re-point (don't re-create) so env vars survive. If re-create is needed, copy env vars from old to new before pointing prod traffic. |
| **Secrets/env vars** | `WALLET_ENCRYPTION_SECRET` and `INTEGRATION_ENCRYPTION_SECRET` are LOAD-BEARING — losing them makes every wallet/token unrecoverable. STATE.md explicitly calls this out: "WALLET_ENCRYPTION_SECRET must survive any infrastructure migration." | Treat as a P0 verification step in the Railway re-point. Re-confirm both env vars are set BEFORE deploying the new lane. |
| **Build artifacts / installed packages** | `apps/api-audit-tmp/` directory still exists in this repo (gitignored, per `.gitignore` line: `apps/api-audit-tmp/`). It's a leftover from Phase 28's security audit. | Clean up: `rm -rf apps/api-audit-tmp/` post-merge. Already in `.gitignore` so won't commit, but should be removed from disk to avoid confusion with the new `apps/api/`. |
| **Build artifacts / installed packages** | Local `wallet-backup-*.json` files at `~/Projects/x402jobs-api/wallet-backup-*.json` per STATE.md. These contain plaintext private keys. | Delete from disk after confidence window (already flagged in STATE.md as a TODO). Not directly Phase 31 work, but the audit-tmp cleanup is similar housekeeping. |
| **Build artifacts / installed packages** | `apps/api/node_modules/` doesn't exist yet. Post-merge `pnpm install` from root populates everything. | Run `pnpm install` immediately after import; expect a lockfile diff (api deps now in root lockfile). |
| **Build artifacts / installed packages** | The api repo's local `dist/` (from `pnpm build` at research time) is gitignored — won't transfer. Fresh build needed post-merge: `pnpm --filter x402-jobs-api build`. | Verify build works post-merge. |
| **Domain / DNS** | `x402.jobs` apex (Vercel) and the api Railway subdomain — neither changes. | None |
| **GitHub repo state** | Closed api repo `rawgroundbeef/x402-jobs-api`. | Archive at end of Phase 31; do NOT delete. Add final README banner pointing to the merged repo. |
| **GitHub repo state** | This repo `rawgroundbeef/x402.jobs` is currently PRIVATE (commits suggest internal-only flow). Need to flip to PUBLIC as part of the public-OS launch. | **CRITICAL:** Flip visibility ONLY at the end of Phase 31, AFTER the merge PR is merged, AFTER SECURITY.md is in place, AFTER LICENSE is in place. Premature flip exposes broken state. |
| **Open PRs in this repo** | Phase 30 PR #20 (merged per commit log — `e4fec8d chore(phase-30): supply chain hardening`). | None — already merged. |
| **Open PRs in api repo** | At research time, branch `chore/phase-30-03-pnpm-10-api` was the current branch (not merged to main). The commit `4877799` is the HEAD of that branch. | Before squash-import, verify the desired sha is on api repo's `main`. May require user to merge open api PRs first. |

**The canonical question, answered:** After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?

- Railway service config (must be re-pointed to new repo + new root dir).
- The closed api repo on GitHub (must be archived, not deleted).
- This repo's visibility (must be flipped to public).
- Helius / Twitter / Inngest service dashboards: no action needed — they're URL-coupled and the API URL doesn't change.

## Common Pitfalls

### Pitfall 1: Untracked `pnpm-workspace.yaml` gets dropped during squash-import

**What goes wrong:** `git read-tree --prefix=apps/api/ -u api-import/main` reads only TRACKED files from the api repo. The `pnpm-workspace.yaml` (containing the critical `ignoredBuiltDependencies: [isolated-vm]` invariant) is UNTRACKED in api/main per `git ls-files`. Post-merge `pnpm install` then runs isolated-vm's postinstall script in the merged tree, which can fail loudly on machines without the right native build deps.
**Why it happens:** The api repo's maintainer added `pnpm-workspace.yaml` to the working tree but never `git add`'d it. The 30-CONVERGENCE.md notes the invariant as "PRESERVED" because it works on the maintainer's box, but git doesn't know about the file.
**How to avoid:**
  1. Confirm with `cd ~/Projects/x402jobs-api && git ls-files pnpm-workspace.yaml` returns empty (was empty at research time).
  2. Either (a) commit the file to api/main BEFORE squash-import, or (b) copy it manually in the import recipe (Step 4 of Pattern 1 above), and merge `ignoredBuiltDependencies: [isolated-vm]` into the root `pnpm-workspace.yaml`.
**Warning signs:** Post-merge `pnpm install` emits new `Ignored build scripts:` lines mentioning `isolated-vm`, OR `pnpm install` fails to build isolated-vm with `gyp ERR!` lines.

### Pitfall 2: Path-filter false negatives on shared-file changes

**What goes wrong:** A PR changes `package.json` (root) and `apps/web/something.tsx`. The `web:` filter matches because of the web change. But a PR that ONLY changes `pnpm-lock.yaml` (e.g., dependabot for a root devDep) matches neither `web:` nor `api:` — both jobs skip, and a broken lockfile lands silently.
**Why it happens:** Path filters are inclusion-only. Without a `shared:` filter that triggers BOTH jobs, root-file changes can sneak through.
**How to avoid:** Use the `shared:` filter pattern in Pattern 2 above. Downstream jobs use `if: needs.changes.outputs.web == 'true' || needs.changes.outputs.shared == 'true'`. [VERIFIED: GitHub Discussion #177835 on monorepo skip pitfalls]
**Warning signs:** PRs touching only root files get auto-merge eligibility despite having no green check.

### Pitfall 3: `frozen-lockfile=true` accidentally added during `.npmrc` edits

**What goes wrong:** A future maintainer (or a misreading planner) adds `frozen-lockfile=true` to root `.npmrc`. This blocks local `pnpm add` / `pnpm update` and blocked Phase 30's lockfile regen.
**Why it happens:** Common BSL/security tutorials recommend `frozen-lockfile=true`. The Phase 30 research explicitly overrode this; the override isn't externally visible.
**How to avoid:**
  1. Add a comment in root `.npmrc` (already present per Phase 30) explaining why `frozen-lockfile` is omitted.
  2. SECURITY.md should document the policy externally so the rationale survives team turnover.
  3. If Phase 31 modifies `.npmrc` (it shouldn't), preserve the existing comments verbatim.
**Warning signs:** `pnpm install` works in CI but fails locally with `ERR_PNPM_NO_MATCHING_VERSION` or "lockfile is out of sync"; or `pnpm add <new-pkg>` fails outside CI.

### Pitfall 4: Railway service re-point loses env vars

**What goes wrong:** Phase 31 requires Railway to deploy `apps/api/` instead of root. Doing this by deleting the old service and creating a new one wipes all env vars — including `WALLET_ENCRYPTION_SECRET` and `INTEGRATION_ENCRYPTION_SECRET`. Without those, every user's wallet and every Twitter token becomes unrecoverable.
**Why it happens:** Railway's UI lets you delete and re-create services; env vars are service-scoped, not project-scoped.
**How to avoid:**
  1. RE-POINT the existing service (Settings → Service → Source Repository → change to new repo + root dir) instead of creating a new service.
  2. If re-create is unavoidable, EXPORT env vars first via Railway CLI: `railway variables --service old-service > /tmp/api-env.txt` (then import to new). NEVER commit this export to git.
  3. Verify both encryption secrets are set on the new service BEFORE flipping production traffic.
**Warning signs:** Post-re-point, the api boot logs say `WALLET_ENCRYPTION_SECRET environment variable is not set` (the boot guard from Phase 27 catches this).

### Pitfall 5: Public flip before merge PR is merged

**What goes wrong:** Repo is flipped public while the merge PR is still open. The public history shows an empty `apps/api/` (or no LICENSE), creating a confused public state. Worse, if `SECURITY.md` isn't yet in place, there's no disclosure channel for the Phase 28 deferred findings.
**Why it happens:** The order-of-operations matters and is easy to get wrong under time pressure (CONTEXT Decision 5 acknowledges the tweet about "tomorrow").
**How to avoid:** Strict order:
  1. Draft LICENSE, README, SECURITY.md, CONTRIBUTING.md (committed but the repo is still private).
  2. Squash-import api repo into `apps/api/` (committed; repo still private).
  3. Add unified CI workflow (committed; repo still private — workflow doesn't run on private repos with no Actions enabled unless you opt in).
  4. Local dev orchestration verified (`pnpm dev` works end-to-end).
  5. Railway service re-pointed; api still deploys cleanly.
  6. Vercel preview on the merge PR green.
  7. Merge PR to main. Production deploys (Vercel + Railway) verified.
  8. Archive `rawgroundbeef/x402-jobs-api`.
  9. **Only now**: flip `rawgroundbeef/x402.jobs` to public.
**Warning signs:** N/A (this is procedural). The plan should bake the strict order into the success criteria checklist.

### Pitfall 6: Migration folder consolidation breaks Supabase deployments

**What goes wrong:** Phase 31 attempts to merge `apps/api/migrations/` (flat, 001-010) with `apps/api/supabase/migrations/` (timestamped). Renaming one set causes Supabase's migration-tracking table to lose track of which migrations have applied, and the next `supabase migration up` either re-applies migrations (data loss / constraint violations) or fails because of missing prefix-prefixed names.
**Why it happens:** The two folders represent two parallel tracks: the flat numeric files appear to be the legacy api-runner format; the timestamped files are the Supabase CLI format. Both have apparently been used at different points.
**How to avoid:** Phase 31 should DEFER migration consolidation. Carry both folders forward unchanged. File a follow-up issue for v3.1: "Audit and consolidate apps/api/migrations/ vs apps/api/supabase/migrations/." Mark this as Discretion-area in the plan.
**Warning signs:** A new migration applied via one path doesn't reflect in the other.

### Pitfall 7: BSL 1.1 license body is modified or paraphrased

**What goes wrong:** The Parameters block is customized correctly but a well-meaning edit "improves" the license body wording. This violates MariaDB's covenant 4 ("Not to modify this License in any other way"); the license is no longer technically BSL 1.1 — it's some unknown derived license.
**Why it happens:** The body text is dense and lawyerly; the temptation to clarify is high.
**How to avoid:** Treat the body as a binary blob. Fetch the canonical text from MariaDB or SPDX during execution and paste verbatim. Only the Parameters block at the top is editable.
**Warning signs:** A diff showing edits inside the "Terms" section of the license body.

### Pitfall 8: Closed-repo history accidentally polluted into the squash commit

**What goes wrong:** A novice approach (`cp -r ../x402jobs-api/* apps/api/`) copies node_modules/, .env, dist/, wallet-backup-*.json. The first commit then accidentally exposes secrets, build artifacts, or local-only files.
**Why it happens:** `cp -r` doesn't respect git's view of what's tracked.
**How to avoid:** Use `git read-tree --prefix=apps/api/ -u api-import/main` — it only stages files tracked in api/main. Then VERIFY before committing: `git status apps/api/` should show only source files; no node_modules/, .env, or wallet-backup-*.json. Run `git log -p apps/api/ | grep -i 'private_key\|secret\|password\|wallet-backup'` post-commit; should return nothing.
**Warning signs:** First-commit diff shows binary files, .env, or node_modules.

## Code Examples

### Example 1: BSL 1.1 LICENSE file (skeleton — verbatim license body fetched at execution time)

```
# LICENSE
# Source for body text: https://mariadb.com/bsl11/ (verbatim, do not modify)
# Source for Parameters pattern: github.com/getsentry/sentry @ tag 22.10.0 (Sentry's historical BSL)

Business Source License 1.1

Parameters

Licensor:             {LEGAL_ENTITY_NAME — ask user}

Licensed Work:        x402.jobs
                      The Licensed Work is (c) 2026 {Licensor}.

Additional Use Grant: You may make use of the Licensed Work, provided
                      that you do not use the Licensed Work for a
                      Commercial Service. A "Commercial Service" is a
                      service that competes with the commercial
                      product or service offered by Licensor (or its
                      successor) that is materially similar to
                      x402.jobs, including but not limited to a
                      hosted service that allows third parties to
                      create or execute paid HTTP workflow endpoints
                      with x402 payments.

Change Date:          {ISO date — four years from initial public commit;
                      compute at execution time}

Change License:       Apache License, Version 2.0

For information about alternative licensing arrangements for the
Licensed Work, please contact security@x402.jobs (or {LEGAL_CONTACT}).

----- BSL 1.1 LICENSE BODY VERBATIM BEGINS -----

Terms

The Licensor hereby grants you the right to copy, modify, create
derivative works, redistribute, and make non-production use of the
Licensed Work. The Licensor may make an Additional Use Grant, above,
permitting limited production use.

Effective on the Change Date, or the fourth anniversary of the first
publicly available distribution of a specific version of the Licensed
Work under this License, whichever comes first, the Licensor hereby
grants you rights under the terms of the Change License, and the
rights granted in the paragraph above terminate.

[... rest of BSL 1.1 body text verbatim from https://mariadb.com/bsl11/ ...]

License text copyright (c) 2017 MariaDB Corporation Ab, All Rights
Reserved. "Business Source License" is a trademark of MariaDB
Corporation Ab.
```

### Example 2: SECURITY.md (skeleton — content for the planner to flesh out)

```markdown
# Security Policy

## Supported Versions

x402.jobs ships from `main`. Security fixes land on `main` and deploy
automatically to https://x402.jobs (web) and the production API.

## Reporting a Vulnerability

**Please do not file public issues for security findings.**

Use one of:

1. **GitHub Private Vulnerability Reporting** (preferred):
   https://github.com/rawgroundbeef/x402.jobs/security/advisories/new

2. **Email:** security@x402.jobs (or {fallback email — ask user})

We aim to acknowledge reports within 3 business days and provide a
remediation plan within 7 business days.

## Scope

In scope: code under `apps/web/`, `apps/api/`, `packages/sdk/`,
`packages/ui/`. Out of scope: third-party services x402.jobs integrates
with (Supabase, Helius, Inngest, Twitter); attacks requiring
compromised Supabase service-role credentials.

## Severity Classification

We use the standard CVSS v3.1 framework (Critical / High / Medium /
Low / Informational).

## Known Unfixed Findings (Phase 28 Internal Review, 2026-05-12)

The following findings from our internal Phase 28 security review are
acknowledged. Most have already been remediated in production
(commits c751857, 4877799, and predecessors); a small number remain
open and are tracked publicly via GitHub Issues.

| ID | Severity | Status | Description | Tracking |
|----|----------|--------|-------------|----------|
| CRIT-01..07 | Critical | FIXED | All 7 Criticals remediated in commits 282b070..991d370 | — |
| HIGH-01..04, 06..13 | High | FIXED | All 12 Highs remediated in commit c751857 | — |
| MED-01..14 | Medium | OPEN | See GitHub Issues #N..M | Issue links |
| LOW-01..07 | Low | OPEN | See GitHub Issues #N..M | Issue links |
| INFO-01..05 | Informational | OPEN | See GitHub Issues #N..M | Issue links |

## Honest Limitations

x402.jobs has not been audited by an external security firm. Our
internal Phase 28 review (Tier 3: agent-assisted) catches OWASP-class
issues and common auth/key handling bugs but does NOT match a
domain-expert human reviewer on protocol-level attacks (subtle
EIP-3009 nonce reuse, Solana PDA hijacking, MEV-style griefing). We
welcome bug bounty submissions in those areas.

## Supply-Chain Hardening

This repo applies a 72-hour npm release-age gate via the root `.npmrc`
(`minimum-release-age=4320`), which neutralizes the bulk of npm
zero-day patterns (publish-malicious then publish-fix). Internal
`@x402jobs/*` packages are exempted via `minimum-release-age-exclude`.
A future maintainer who removes this gate is removing a documented
security control; please don't.

## Encryption Keys

x402.jobs encrypts user wallet private keys (AES-256-GCM via
`WALLET_ENCRYPTION_SECRET`) and OAuth tokens (AES-256-CBC via
`INTEGRATION_ENCRYPTION_SECRET`) at rest in Supabase. Loss of either
key permanently locks out the corresponding user data.

## Coordination

We follow the OpenSSF Vulnerability Disclosures Working Group's
recommended coordination practices.
```

### Example 3: README.md skeleton

```markdown
# x402.jobs

> Chain x402-paid HTTP endpoints into automated workflows. Agents
> bring their own wallet; resources earn USDC.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

## What is x402.jobs?

[1-paragraph "what" — the planner drafts]

## Quickstart

Self-host locally:

```bash
git clone https://github.com/rawgroundbeef/x402.jobs.git
cd x402.jobs
pnpm install
cp apps/web/env.example apps/web/.env.local
cp apps/api/env.example apps/api/.env
# Fill in Supabase URL/keys + WALLET_ENCRYPTION_SECRET + INTEGRATION_ENCRYPTION_SECRET
pnpm dev
# → web:    http://localhost:3010
# → api:    http://localhost:3011
# → Inngest http://localhost:8288
```

## Architecture

- `apps/web/` — Next.js 15.5 frontend
- `apps/api/` — Express API + Inngest workflow workers
- `packages/sdk/` — `@x402jobs/sdk` (public npm)
- `packages/ui/` — internal shared components

## License

[BSL 1.1 with an Additional Use Grant](LICENSE) — change date 4 years
from initial public commit, converting to Apache 2.0.

In plain English: you can run x402.jobs internally (your company,
your own workflows). You CANNOT offer a hosted x402-payments-workflow
service that competes with x402.jobs. See LICENSE for the legal text.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md). Please use GitHub Private
Vulnerability Reporting for security findings.
```

### Example 4: Unified GitHub Actions workflow (the full file)

See Pattern 2 above for the complete YAML.

### Example 5: Root `pnpm-workspace.yaml` after merge

```yaml
# Source: merged from x402jobs root + x402jobs-api working tree (untracked file)
# After: post-Phase 31

packages:
  - "apps/*"
  - "packages/*"

# Preserved from x402jobs-api/pnpm-workspace.yaml (was untracked there; merged
# into root here per Phase 31 squash-import).
#
# `ignoredBuiltDependencies` was deprecated in pnpm 11; we are on pnpm 10.6.5.
# If pnpm is ever upgraded past 10.x, migrate this to:
#   allowBuilds:
#     isolated-vm: false
# See: https://pnpm.io/settings (allowBuilds, v10.26.0+)
ignoredBuiltDependencies:
  - isolated-vm
```

### Example 6: Root `package.json#pnpm.onlyBuiltDependencies` after merge

```json
// Source: union of x402jobs and x402jobs-api allow-lists per 30-CONVERGENCE.md
{
  "packageManager": "pnpm@10.6.5",
  "pnpm": {
    "onlyBuiltDependencies": [
      "bigint-buffer",
      "bufferutil",
      "esbuild",
      "fsevents",
      "isolated-vm",
      "protobufjs",
      "sharp",
      "utf-8-validate"
    ]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BSL 1.1 with `Additional Use Grant` text (Sentry, Couchbase, MariaDB, HashiCorp pre-2024) | BSL 1.1 still standard; Sentry moved to FSL-1.1 in 2024 | 2024 | Sentry no longer uses BSL — they use Functional Source License (FSL-1.1-Apache-2.0). CONTEXT Decision 2 says "Sentry-style Additional Use Grant" which historically referred to BSL 1.1. We should treat "Sentry-style" as the ARCHETYPE of the BSL grant pattern (Sentry's historical grant), not as "use whatever Sentry uses today." [VERIFIED: sentry/sentry LICENSE.md current text] |
| `git filter-branch` for monorepo merges | `git filter-repo` for history-preserving merges; `git read-tree --prefix` for history-discarding merges | 2018+ for filter-repo; read-tree always available | We're using read-tree (history-discarding) — the simpler primitive. |
| `paths:` workflow trigger only | `dorny/paths-filter` for job-level gating | 2020+ | `paths:` works at workflow level only; for in-workflow job gating, dorny/paths-filter is the de-facto standard. |
| `ignoredBuiltDependencies` in pnpm-workspace.yaml | `allowBuilds` map (pnpm v10.26.0+; mandatory in v11) | v10.26.0 (2025) | We're on pnpm 10.6.5 so the old setting still works. Migrate when bumping pnpm past 10.x. [VERIFIED: pnpm/settings] |
| GitHub repo "lock" (informal) | GitHub Archive feature (formal read-only flag) | 2017 | Native UI/API toggle; preserves history; private-stays-private. [VERIFIED: GitHub Docs] |

**Deprecated/outdated:**
- **Sentry-historical BSL 1.1 grant text.** Sentry has moved to FSL-1.1; their current LICENSE.md is FSL, not BSL. The "Sentry-style Additional Use Grant" CONTEXT references is the historical BSL grant pattern from before 2024. Adapt the PATTERN; don't copy the current Sentry license.
- **`onlyBuiltDependencies` + `neverBuiltDependencies` + `ignoredBuiltDependencies` (three separate settings).** Replaced by single `allowBuilds: { pkg: true/false }` map in pnpm 11+. We don't migrate until we bump pnpm.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All four Batch H sub-fixes are already shipped to api/main in commit c751857 | Summary, Architecture Responsibility Map, Code Examples | If wrong: planner plans a redundant Batch H implementation, double-coding existing work. **Mitigation:** RESEARCH verified via `git log --all --oneline` on api repo + direct file reads of integrations.ts (post-PR code present), migration 009 (table present), migrate-encrypt-x-tokens.ts (backfill script present). Risk: LOW. Confirmed via [VERIFIED] tags. |
| A2 | The api repo's `pnpm-workspace.yaml` is untracked-but-required | Pitfall 1, Pattern 5, Code Examples | If wrong: We add a manual copy step that's unnecessary OR we miss adding `ignoredBuiltDependencies` to root. **Mitigation:** Verified via `git ls-files pnpm-workspace.yaml` returning empty + `git log --all -- pnpm-workspace.yaml` returning empty. Risk: LOW. |
| A3 | Railway service can be re-pointed to a new repo + root dir without re-creating | Pitfall 4, Runtime State Inventory | If wrong: We have to re-create the Railway service, which requires manual env-var migration. Both encryption secrets are LOAD-BEARING. **Mitigation:** Railway's Settings UI does support source-repo changes per their docs; user has Railway access to confirm. Risk: LOW-MEDIUM. Planner should add an explicit "verify Railway env vars survive the re-point" step. |
| A4 | The "Sentry-style Additional Use Grant" in CONTEXT refers to Sentry's HISTORICAL BSL 1.1 grant, not their current FSL-1.1 grant | Pattern 4, License section | If wrong: We draft a license that doesn't match user intent (FSL is structurally different from BSL — different perpetual-Apache-grant timing, "Competing Use" instead of "Commercial Service" wording). **Mitigation:** CONTEXT explicitly says "BSL 1.1" so we're locked to BSL. The "Sentry-style" framing is most naturally read as "the structural pattern Sentry used during their BSL era." Risk: LOW. Planner should confirm with user before drafting. | [ASSUMED] |
| A5 | The Phase 28 Highs being "ALREADY FIXED" rather than "DEFERRED" should be reflected in SECURITY.md (FIXED status, not OPEN) | Code Examples (SECURITY.md), Summary | If wrong: SECURITY.md misrepresents the codebase's current security posture, either over-promising (saying fixed when not) or under-promising (saying deferred when fixed). **Mitigation:** This RESEARCH verified the commit landed (`c751857 (#32)`) and the code is in place. Risk: LOW. Planner should re-verify at execution time by reading the current state of integrations.ts in `apps/api/` post-import. |
| A6 | `LEGAL_ENTITY_NAME` for the Licensor field — unknown | Pattern 4, Code Examples (LICENSE) | If wrong: License has wrong licensor; legally ambiguous. **Mitigation:** Planner MUST ask user for the entity name. Risk: HIGH if not asked; LOW if asked. | [ASSUMED] |
| A7 | A `CONTRIBUTING.md` is desired but not specified in CONTEXT | Recommended Project Structure, plan-count recommendation | If wrong: We draft an unneeded file. **Mitigation:** It's a one-page convention-on-PR file; minimal effort either way. Risk: NEGLIGIBLE. | [ASSUMED] |
| A8 | The Inngest dev server (port 8288) is fine to expose locally; no Phase 31 work needed on it | Pattern 3, Local-dev orchestration | If wrong: Inngest local dev fails to start, blocking the "single command dev" SC. **Mitigation:** Already working in the api repo (verified in package.json's `dev:inngest` script using `npx inngest-cli@latest dev`). Risk: LOW. | [ASSUMED] |
| A9 | Migration folder consolidation can be deferred to v3.1 | Pitfall 6, Recommended Project Structure | If wrong: Some Supabase tooling breaks because of the duplicate-tracks issue. **Mitigation:** Planner can ask user OR test post-merge that `supabase migration up` still works. Risk: LOW-MEDIUM. | [ASSUMED] |

## Open Questions

1. **Re-interpret "Batch H as prerequisite sub-plan" given it's already shipped?**
   - What we know: Commit `c751857` on api/main contains all four Batch H sub-fixes (migration 009 creating `x402_oauth_pending` table + ciphertext columns; routes/integrations.ts with state nonce + dual-write encryption; `migrate-encrypt-x-tokens.ts` backfill script). CONTEXT Decision 1 says Batch H is a prerequisite to be FOLDED INTO Phase 31. The text was written before c751857 merged.
   - What's unclear: Does the user want to (a) treat Batch H as "already done, just carry it forward via the import," or (b) plan a Phase 31 sub-plan that re-verifies / hardens / extends what's already there?
   - Recommendation: Surface this re-interpretation to the user before plans run (via a `gsd-discuss-phase` cycle or a single Open Question at top of the first plan's brief). My recommendation is (a) — the work is shipped, plan around verification not implementation. This drops Phase 31's plan count from 5-6 to 4-5.

2. **Licensor entity name?**
   - What we know: The repo is `rawgroundbeef/x402.jobs`; the user's GitHub handle is `rawgroundbeef`. No company entity is mentioned in any planning doc.
   - What's unclear: Personal name (Ben Tatum) or LLC/Inc.?
   - Recommendation: Planner asks user before drafting LICENSE. This is a legal field that cannot be filled by Claude.

3. **Additional Use Grant wording — CONTEXT draft or Sentry-style adaptation?**
   - What we know: CONTEXT provides a draft ("a service that competes with the commercial product or service offered by Licensor … materially similar to x402.jobs, including but not limited to a hosted service that allows third parties to create or execute paid HTTP workflow endpoints with x402 payments"). The "Sentry-style" reference suggests a structurally-similar pattern.
   - What's unclear: Is the CONTEXT draft FINAL wording, or a starting point for a more Sentry-mirroring adaptation?
   - Recommendation: Use the CONTEXT draft verbatim (CONTEXT is locked). If the user wants the more Sentry-mirror "your employees and contractors" exemption added, ask explicitly.

4. **Change Date computed how — at commit time or at public-flip time?**
   - What we know: CONTEXT Decision 2 says "4 years from initial public commit."
   - What's unclear: Is the "initial public commit" (a) the day the merge PR is merged (still while repo is private), (b) the day the LICENSE file lands as a tracked commit (could be earlier than public flip), or (c) the day the repo is flipped public?
   - Recommendation: Use the date of the LICENSE-file landing commit. This is the most BSL-canonical interpretation ("the date of the initial publicly available distribution of a specific version of the Licensed Work under this License" per the BSL body text). Add 4 years; format as ISO `YYYY-MM-DD`.

5. **Plan count — 4 plans or 6 plans?**
   - What we know: The merge, the license drop, the CI setup, and the public-flip ceremony are conceptually 4 distinct work items. The Batch H re-interpretation removes one plan. The README + SECURITY.md + CONTRIBUTING.md can be one combined "public docs" plan or split.
   - What's unclear: User preference for plan granularity.
   - Recommendation: 4-5 plans:
     1. `31-01-PLAN.md`: BSL 1.1 LICENSE + README + SECURITY.md + CONTRIBUTING.md (all drafted while repo still private; verifies LICENSE before any code import).
     2. `31-02-PLAN.md`: Squash-import `x402-jobs-api → apps/api/` (includes pnpm-workspace.yaml merge, root onlyBuiltDependencies merge, post-merge `pnpm install` + `pnpm dev` + `pnpm build` smoke).
     3. `31-03-PLAN.md`: Unified CI workflow (`.github/workflows/ci.yml`); fix any test/lint/typecheck errors that surface.
     4. `31-04-PLAN.md`: Local-dev orchestration polish + fallback scripts + verify Inngest comes up.
     5. `31-05-PLAN.md`: Public-flip ceremony — Railway re-point, archive api repo, flip visibility, public announcement.
   - Plans 31-02 and 31-04 could merge if simpler. Plan 31-03 could be folded into 31-02 if the CI is small enough. Use planner discretion.

6. **Where does SECURITY.md `contact` email go?**
   - What we know: GitHub Private Vulnerability Reporting is the modern standard.
   - What's unclear: Is `security@x402.jobs` a real mailbox the user owns/forwards? Backup channel?
   - Recommendation: GitHub PVR as primary; ask user for fallback email.

7. **Vercel project: anything needed?**
   - What we know: This repo already deploys to Vercel; `apps/web/vercel.json` exists. Decision 4 says deploys stay split.
   - What's unclear: Does the merge PR's Vercel preview need a Build Output Directory adjustment, since `apps/web` is no longer the only app in the tree?
   - Recommendation: Per `30-CONVERGENCE.md`, the existing Vercel config has `buildCommand: "turbo run build --filter=@x402jobs/web..."` and this works. No change expected. Verify by watching the merge PR's Vercel preview.

8. **CLAUDE.md at root?**
   - What we know: No `./CLAUDE.md` exists in this repo today.
   - What's unclear: Should Phase 31 add one to capture (a) the BSL 1.1 license override on copy-paste, (b) the pnpm 10.6.5 pin, (c) the `.npmrc` release-age policy explanation, (d) any other repo-wide rules?
   - Recommendation: Yes, add a minimal `CLAUDE.md` so AI assistants don't recommend bumping pnpm or removing the release-age gate. This is a 1-screen file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | All apps | ✓ | 22 (per api Dockerfile target); 22.x or 18+ locally | — |
| pnpm | All workspace ops | ✓ | 10.6.5 (locked) | — |
| Docker | Railway-style local api build | Optional | — | Local `pnpm --filter x402-jobs-api build` (tsup) works without Docker; only needed for Railway parity smoke |
| Supabase CLI | Migration management | Optional | — | Operational migrations apply via api code; CLI is a dev convenience |
| inngest-cli | Local Inngest dev server | ✓ (via `npx`) | latest | None — must be reachable from npm. Phase 30's 4320-min release-age gate applies. |
| git | Squash-import | ✓ | Any modern (read-tree primitive is in git 1.5+) | — |
| GitHub CLI (`gh`) | Archive ceremony, PR creation | Optional | — | Web UI works for archive; PR via web UI works |
| Railway CLI | Service re-point | Optional | — | Web UI works |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Docker, Supabase CLI, Railway CLI, GitHub CLI — all optional. Phase 31 can execute with just `git` + `pnpm` + a browser.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (web) | None currently. apps/web has `lint` + `typecheck` scripts; no unit test runner yet. |
| Framework (api) | Vitest ^2.1.8 |
| Config file (api) | `apps/api/vitest.config.ts` (imported with the squash; verify post-merge) |
| Quick run command (api) | `pnpm --filter x402-jobs-api test` (runs vitest run) |
| Full suite (api) | Same as quick run for now — no separate full-suite command exists. |

### Phase Requirements → Test Map

This phase has no explicit REQ-IDs (8 SCs from ROADMAP only). Tests verify the SCs are met via direct smoke verification rather than unit tests.

| SC# | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| SC1 | Single repo, single license, single CI | manual + grep | `test -f LICENSE && test -f .github/workflows/ci.yml && grep -q "Business Source License" LICENSE` |
| SC2 | Both apps deploy cleanly to Vercel + Railway post-merge | manual (deploy gating) | Watch deploy logs on merge PR |
| SC3 | `pnpm install && pnpm dev` produces a working local env | smoke | `cd $TMPDIR && git clone <repo> && pnpm install && timeout 60 pnpm dev` — expect ports 3010, 3011, 8288 to bind |
| SC4 | LICENSE, README, SECURITY.md, CONTRIBUTING.md present | grep | `for f in LICENSE README.md SECURITY.md CONTRIBUTING.md; do test -f $f; done` |
| SC5 | Phase 28 HIGH Batch H shipped: state nonce verified, OAuth DB-backed, tokens encrypted, migration | code-state | `grep -q "x402_oauth_pending" apps/api/migrations/009* && grep -q "encryptSecret" apps/api/src/routes/integrations.ts && grep -q "access_token_ciphertext" apps/api/scripts/migrate-encrypt-x-tokens.ts` |
| SC6 | Phase 28 other Highs acknowledged in SECURITY.md | grep | `grep -E "HIGH-(01\|02\|03\|04\|06\|07\|08\|09\|10\|11\|12\|13)" SECURITY.md` |
| SC7 | SECURITY.md documents Phase 30 release-age policy | grep | `grep -q "minimum-release-age" SECURITY.md && grep -q "4320" SECURITY.md` |
| SC8 | Vercel + Railway main-branch deploys satisfy 30-CONVERGENCE assertions | manual + log inspection | Compare build logs against `30-CONVERGENCE.md` "Expected build-log assertions" — pnpm@10.6.5; zero ENOWORKSPACES; api zero Ignored build scripts; web 5 accepted ignored scripts |

### Sampling Rate

- **Per task commit:** No test runner gate yet; trust lint + typecheck + a `pnpm dev` 60-second smoke.
- **Per wave merge:** Run `pnpm --filter x402-jobs-api test` (api test suite) once apps/api is in place.
- **Phase gate:** All 8 SCs verified manually per the test map above. Vercel + Railway prod deploys green on the merge PR.

### Wave 0 Gaps

- [ ] Confirm api repo's vitest setup carries over cleanly post-import. Run `pnpm --filter x402-jobs-api test` and verify ~baseline test count (~274+ per HIGHS-TRIAGE.md mentioning baseline).
- [ ] `.github/workflows/ci.yml` doesn't exist yet — Plan 31-03 creates it. Until then, no CI gating.
- [ ] No `apps/web/` unit test framework. Phase 31 does NOT add one (out of scope; the SC list focuses on lint + typecheck for web). Defer to v3.1.

## Security Domain

Per `.planning/config.json`, no `security_enforcement` key is present. Default treatment per RESEARCH protocol: include the security domain.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | This is an architectural-change phase; the merge is itself a security-sensitive operation. |
| V2 Authentication | yes (via Batch H state nonce) | Already implemented in api: crypto.randomBytes(32) base64url state nonce, DB-backed with `expires_at` TTL |
| V3 Session Management | no (no session changes in Phase 31) | — |
| V4 Access Control | no (no auth-route changes) | — |
| V5 Input Validation | yes (CI workflow file is user-supplied YAML; cap permissions) | Pin actions to `@v3` / `@v4` major tags + commit SHA where security-critical; `permissions:` block at top with minimal grants |
| V6 Cryptography | yes (token encryption invariant must survive merge) | `encryptSecret` AES-256-CBC via `INTEGRATION_ENCRYPTION_SECRET`; do not refactor without re-validating round-trip |

### Known Threat Patterns for {monorepo merge + public-OS launch}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets leaked into squash commit (e.g., `.env`, `wallet-backup-*.json`, `node_modules/` with cached creds) | Information Disclosure | Use `git read-tree --prefix` (respects gitignore from source tree) — NOT `cp -r`. Post-import audit: `git log -p apps/api/ \| grep -iE 'private_key\|secret\|password\|wallet-backup\|PRIVATE_KEY'` should be empty. |
| Phase 30 release-age policy silently removed in a future PR | Tampering | SECURITY.md documents the policy externally with an explicit "please don't remove this" note; `.npmrc` has explanatory comment in place. |
| Encryption keys lost during Railway re-point | Denial of Service (catastrophic; every wallet unrecoverable) | Re-POINT Railway service (don't re-create); verify both `WALLET_ENCRYPTION_SECRET` + `INTEGRATION_ENCRYPTION_SECRET` survive; have Railway CLI export as a backup before any destructive operation. |
| Public flip exposes incomplete state (LICENSE missing, broken apps/api/) | Information Disclosure | Strict ceremony order per Pitfall 5: docs → import → CI → smoke → merge → archive → flip. |
| Pinned action (`dorny/paths-filter@v3`) silently fetches a malicious update | Tampering (supply chain) | For supply-chain paranoia, pin to a specific commit SHA: `dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v3.0.0`. Trade-off: must manually update for security patches. Recommendation: leave at `@v3` for now (well-known maintainer; same trust model as `actions/checkout@v4`). Document the trade-off. |
| GitHub repo flipped public while still hosting Phase 28 audit artifacts (`apps/api-audit-tmp/`) | Information Disclosure | The path is already gitignored, but verify NO commits ever added files under it. `git log --all -- 'apps/api-audit-tmp/*' \| head` should be empty. |
| Archived api repo accidentally made public | Information Disclosure | Archiving does NOT change visibility per GitHub Docs; the repo stays private. Verify the visibility setting AFTER archive. |
| BSL 1.1 license text accidentally modified | Repudiation (license is no longer technically BSL 1.1) | Use the canonical text verbatim from MariaDB or SPDX; do not paraphrase. Only the Parameters block at top is customizable. |

## Sources

### Primary (HIGH confidence)

- **MariaDB BSL 1.1 canonical text:** https://mariadb.com/bsl11/ — [VERIFIED via WebFetch] — License body text and Parameters block requirements
- **SPDX BUSL-1.1:** https://spdx.org/licenses/BUSL-1.1.html — [VERIFIED via WebFetch] — Machine-readable BSL 1.1 with parameter examples
- **Sentry historical BSL 1.1:** https://raw.githubusercontent.com/getsentry/sentry/22.10.0/LICENSE — [VERIFIED via WebFetch] — Exact "Application Monitoring Service" Additional Use Grant wording
- **Sentry current FSL:** https://raw.githubusercontent.com/getsentry/sentry/master/LICENSE.md — [VERIFIED via WebFetch] — Confirms Sentry moved off BSL to FSL-1.1
- **dorny/paths-filter GitHub:** https://github.com/dorny/paths-filter — [VERIFIED via WebFetch] — Path-filter pattern + permissions
- **pnpm settings docs:** https://pnpm.io/settings + https://pnpm.io/pnpm-workspace_yaml — [VERIFIED via WebFetch] — `ignoredBuiltDependencies` deprecation in v11; `allowBuilds` replacement
- **GitHub Docs — Archiving repositories:** https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories — [VERIFIED via WebSearch] — Read-only effect; visibility unchanged
- **GitHub Docs — Splitting a subfolder out into a new repository:** https://docs.github.com/en/get-started/using-git/splitting-a-subfolder-out-into-a-new-repository — [VERIFIED via WebSearch] — git filter-repo patterns
- **git-read-tree man page:** https://git-scm.com/docs/git-read-tree — [VERIFIED via WebSearch] — `--prefix` flag semantics
- **In-repo Phase 30 artifacts:** `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md`, `30-04-PLAN.md` — [VERIFIED via Read] — pnpm 10.6.5 pin, `.npmrc` policy, allow-list deltas, BLOCKER-30-01-A resolution
- **In-repo Phase 28 artifacts:** `.planning/phases/28-security-review/HIGHS-TRIAGE.md` — [VERIFIED via Read] — Batch definitions and current status
- **In-repo CONTEXT.md:** `.planning/phases/31-monorepo-merge-bsl/31-CONTEXT.md` — [VERIFIED via Read] — Locked decisions
- **API repo source files:** `~/Projects/x402jobs-api/src/routes/integrations.ts`, `~/Projects/x402jobs-api/src/lib/instant/encrypt.ts`, `~/Projects/x402jobs-api/scripts/migrate-encrypt-x-tokens.ts`, `~/Projects/x402jobs-api/migrations/009_add_oauth_pending_and_encrypted_tokens.sql` — [VERIFIED via Read] — Batch H is already implemented
- **API repo git log:** `git log --all --oneline` on `~/Projects/x402jobs-api` — [VERIFIED via Bash] — Commit `c751857 fix(security): Phase 28 — remediate all 12 HIGH findings (#32)` confirms shipped status; HEAD = `4877799`
- **API repo workspace state:** `git ls-files pnpm-workspace.yaml` returning empty — [VERIFIED via Bash] — Confirms untracked status

### Secondary (MEDIUM confidence)

- **OpenSSF Vulnerability Disclosures Working Group:** https://github.com/ossf/wg-vulnerability-disclosures — [CITED via WebSearch] — General SECURITY.md guidance
- **OSSF Scorecard SECURITY.md template:** https://github.com/ossf/scorecard/blob/main/SECURITY.md — [VERIFIED via WebFetch] — Structure pattern (GitHub PVR + email fallback + response timelines)
- **FOSSA BSL 1.1 explainer:** https://fossa.com/blog/business-source-license-requirements-provisions-history/ — [CITED via WebSearch] — Background on BSL parameters and adoption
- **Akka BSL adoption:** https://akka.io/bsl/license — [CITED via WebSearch] — 3-year change date example (we use 4)
- **GitHub Community Discussion #164673 (path-filter patterns):** https://github.com/orgs/community/discussions/164673 — [CITED via WebSearch] — Best practices for monorepo workflows
- **GitHub Community Discussion #177835 (skip pitfalls):** [CITED via WebSearch] — Root-file-change skip risk
- **pnpm GitHub Discussion #10267 (multiple pnpm-workspace.yaml):** [CITED via WebSearch] — pnpm uses nearest workspace file
- **Turborepo persistent task discussion:** https://turborepo.com (and vercel/turborepo Discussions #7493) — [CITED via WebSearch] — Persistent task model for dev pipelines

### Tertiary (LOW confidence)

- **Couchstore BSL 1.1 LICENSE structure** — fetched but only retrieved a summary; planner should fetch the verbatim text at execution time
- **Cal.com LICENSE** — fetch confirmed it's MIT, not BSL; not a useful template here
- **Specific 4-year vs 3-year vs 2-year change date norms across BSL adopters** — partial coverage; assume 4-year per CONTEXT

## Metadata

**Confidence breakdown:**
- Standard stack (Turbo + pnpm + dorny/paths-filter): HIGH — all verified against official docs and existing repo state
- License (BSL 1.1 + Sentry-style grant): HIGH for body text (canonical), MEDIUM for grant wording (CONTEXT draft is locked, but execution requires user clarification on entity name)
- Squash-import mechanics (`git read-tree --prefix`): HIGH — native git primitive, verified via official docs
- Architecture (split deploys, unified CI, single workspace): HIGH — all verified against existing repo state
- Batch H already-shipped: HIGH — verified via direct file reads + git log on api repo
- Runtime state (Railway re-point, GitHub archive, public flip): MEDIUM — relies on Railway/GitHub UI behavior that's well-documented but the user must execute manually
- Local-dev orchestration (Turbo persistent dev): MEDIUM — works in principle; might surface log-prefix oddities or port collisions in practice

**Research date:** 2026-05-14
**Valid until:** 2026-06-15 (~30 days — license text + git/GitHub Actions semantics are stable; the only fast-moving piece is the api repo's HEAD sha, which the planner re-confirms at execution time)
