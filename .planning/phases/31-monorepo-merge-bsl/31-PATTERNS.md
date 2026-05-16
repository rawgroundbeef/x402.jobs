# Phase 31: Monorepo Merge + BSL 1.1 — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 16 distinct edit targets (4 NEW root docs, 1 NEW workflow, 1 BULK squash-import subtree, 10 root/web tooling edits)
**Analogs found:** 11 / 16 (5 are greenfield — LICENSE, SECURITY.md, CONTRIBUTING.md, `.github/workflows/ci.yml`, root `CLAUDE.md`)

## Repo topology (load-bearing for the planner)

| Repo | Path on disk | Status | Phase 31 work? |
|------|--------------|--------|----------------|
| `x402jobs` (this repo) | `/Users/rawgroundbeef/Projects/x402jobs` | private now → **public at end of phase** | Yes — root docs, root tooling, new `.github/workflows/`, host `apps/api/` after import |
| `x402jobs-api` (sibling) | `/Users/rawgroundbeef/Projects/x402jobs-api` | closed-source; HEAD `4877799` on `chore/phase-30-03-pnpm-10-api`; PR #32 (`c751857`) shipped all 12 HIGHs on api/main | **Source of squash-import.** No edits in Phase 31 except (a) the final "merged into x402.jobs" README banner pre-archive, (b) merging open api PRs to `main` BEFORE import so HEAD is the canonical sha to reference. |
| `apps/api-audit-tmp/` | `/Users/rawgroundbeef/Projects/x402jobs/apps/api-audit-tmp` | gitignored Phase 28 audit snapshot | **DELETE post-merge.** Already gitignored per `.gitignore:30`; remove from disk to avoid confusion with the new `apps/api/`. |

The Phase 30 PATTERNS.md predicted the merge would happen in "Phase 31"; that prediction is now load-bearing. The sibling repo MUST be on `main` at the desired sha at squash-import time; the planner should verify HEAD with `cd ~/Projects/x402jobs-api && git rev-parse HEAD` and reference that exact sha in the squash commit message.

## File Classification

| Edit target | Role | Data flow / lifecycle | Closest analog | Match quality |
|---|---|---|---|---|
| `LICENSE` (root, NEW) | license | read by GitHub UI, package registries, contributors; load-bearing legally | None in either repo (sibling has no LICENSE either) — **canonical source is MariaDB BSL 1.1 text + Sentry historical grant adaptation, captured in 31-RESEARCH.md** | greenfield (template-based) |
| `SECURITY.md` (root, NEW) | docs / security policy | read by GitHub security tab, contributors, vulnerability reporters | None — OSSF Scorecard template referenced in 31-RESEARCH.md Sources is the closest pattern | greenfield (template-based) |
| `CONTRIBUTING.md` (root, NEW) | docs | read by contributors, GitHub UI | None — convention-driven; no analog | greenfield |
| `CLAUDE.md` (root, NEW — Discretion area) | docs / AI-assistant rules | read by AI assistants (Claude Code, Cursor) at session start | None in this repo today (`31-RESEARCH.md:17`: "No `./CLAUDE.md` exists at the repo root") | greenfield (1-screen file per RESEARCH Open Question 8) |
| `README.md` (root, REWRITE) | docs | read by GitHub UI, npm registry, contributors | itself (`/Users/rawgroundbeef/Projects/x402jobs/README.md` — current 51-line internal-state version with `License: MIT` line that MUST be updated) | self — full rewrite, MIT→BSL 1.1 |
| `.github/workflows/ci.yml` (root, NEW) | CI config | read by GitHub Actions on PR + push to main | **No analog in either repo** — `/Users/rawgroundbeef/Projects/x402jobs/.github/workflows/` exists but is empty per 30-PATTERNS.md:54; api repo has no `.github/workflows/` at all. Canonical pattern is `dorny/paths-filter@v3` template in 31-RESEARCH.md Pattern 2 (lines 298-377). | greenfield (template-based) |
| `apps/api/` (BULK NEW — squash-import) | app source subtree | runtime (Railway-deployed) + dev (local pnpm) + build (tsup) + test (vitest) | `/Users/rawgroundbeef/Projects/x402jobs-api/` working tree at sha `4877799` (or latest `main` at execution time) | exact — IS the source |
| `apps/api/pnpm-workspace.yaml` (squash-import casualty) | workspace config | install time | **UNTRACKED in api repo** — verified via `git ls-files pnpm-workspace.yaml` returning empty (31-RESEARCH.md:486-493). Lives only on api maintainer's disk. | **manual copy required** — Pitfall 1 |
| `apps/api/vercel.json` (squash-import casualty) | infra | build (vestigial — Railway is the real lane) | Decision 4 says **DELETE post-import** (Railway is the api lane); the file is described as "vestigial" in `30-CONVERGENCE.md:30` | delete |
| `apps/api/migrations/` + `apps/api/supabase/migrations/` (squash-import casualty) | migration files | DB schema deploy | both are operationally distinct tracks per Pitfall 6 — leave BOTH intact; defer reconciliation to v3.1 | carry-forward unchanged |
| `pnpm-workspace.yaml` (root, MODIFY) | workspace config | install time (pnpm resolution) | itself (`/Users/rawgroundbeef/Projects/x402jobs/pnpm-workspace.yaml` — 3 lines today, `packages: [apps/*, packages/*]`) | self — additive merge of `ignoredBuiltDependencies: [isolated-vm]` from api repo's untracked file |
| `package.json` (root, MODIFY) | workspace config + scripts | install + dev/build/lint/typecheck/test | itself + `~/Projects/x402jobs-api/package.json` (its `dev:api` / `dev:inngest` / `concurrently` scripts inform the fallback scripts) | self — additive (new fallback scripts; expand `pnpm.onlyBuiltDependencies` to union per `31-RESEARCH.md` Example 6) |
| `turbo.json` (root, MODIFY) | task orchestration | dev/build/lint/typecheck/test | itself (`/Users/rawgroundbeef/Projects/x402jobs/turbo.json` — 22 lines, has `dev: { cache: false, persistent: true }`) | self — additive (add `test` task; keep existing `dev` persistent task as-is) |
| `apps/web/vercel.json` | infra (Vercel deploy) | build/deploy | itself — already correct per 31-RESEARCH.md Open Question 7 (`buildCommand: "turbo run build --filter=@x402jobs/web..."` already filters correctly post-merge) | **likely no change** — verify only |
| `.gitignore` (root, MODIFY) | git config | git operations | itself (`/Users/rawgroundbeef/Projects/x402jobs/.gitignore` — 31 lines including the `apps/api-audit-tmp/` line at :30 that should be REMOVED post-cleanup) | self — additive (api-specific patterns) + delete `apps/api-audit-tmp/` line |
| `.npmrc` (root) | install config | install time | itself — Phase 30 already shipped the release-age policy. Phase 31 must be a **no-op** here per 31-RESEARCH.md "Project Constraints" line 22 | self — no-op (verify only) |
| `STATE.md` (`.planning/STATE.md`, MODIFY) | planning state | planner-only | itself | self — closure update |

**Files NOT changed by Phase 31** (called out so the planner can avoid scope creep):

| File | Why untouched |
|------|---------------|
| `apps/web/package.json` | RESEARCH Open Question 7 confirms apps/web doesn't need script changes; root `pnpm dev` already invokes `turbo run dev` which picks up apps/web's existing `dev` script |
| `apps/web/tsconfig.json` | "TypeScript versions can stay divergent — both apps build independently" (`31-RESEARCH.md:85`). Cross-app tsconfig reconciliation is OUT OF SCOPE for Phase 31 |
| `apps/web/eslint.config.mjs` | Same rationale — keep app-local; reconciliation deferred |
| Root `tsconfig.json` | None exists today; do not introduce one |
| Root `.eslintrc.*` / `eslint.config.*` | None exists today; do not introduce one |
| Root `.prettierrc` | None exists today; do not introduce one |
| `pnpm-lock.yaml` (root) | Regenerated automatically by `pnpm install` post-import; not a hand-edited file |

## Pattern Assignments

### 1. `LICENSE` (root, NEW) — license, build-time + legal

**Analog:** None in repo. Canonical source is the MariaDB BSL 1.1 template; the Additional Use Grant adapts the Sentry historical (pre-FSL) BSL pattern. Both have verbatim text captured in 31-RESEARCH.md.

**Pattern: BSL 1.1 Parameters block + verbatim body** (`31-RESEARCH.md:428-470`, locked field values from `31-CONTEXT.md` Decision 2):

```
Business Source License 1.1

Parameters

Licensor:             Memeputer LLC

Licensed Work:        x402.jobs
                      The Licensed Work is (c) 2026 Memeputer LLC.
                      Copyright © 2026 Memeputer LLC. All rights reserved.

Additional Use Grant: You may make use of the Licensed Work, provided that
                      you do not use the Licensed Work for a Commercial
                      Service. A "Commercial Service" is a service that
                      competes with the commercial product or service
                      offered by Licensor (Memeputer LLC, or its
                      successor) that is materially similar to x402.jobs,
                      including but not limited to a hosted service that
                      allows third parties to create or execute paid HTTP
                      workflow endpoints with x402 payments.

Change Date:          2030-MM-DD   (4 years from initial public commit
                                    landing this LICENSE file — compute at
                                    execution time per RESEARCH Open Q4)

Change License:       Apache License, Version 2.0

For information about alternative licensing arrangements for the
Licensed Work, please contact security@x402.jobs.

----- BSL 1.1 LICENSE BODY VERBATIM BEGINS -----
[fetch body verbatim from https://mariadb.com/bsl11/ — DO NOT modify]
```

**Deviations expected vs the Sentry-historical adaptation in RESEARCH:**
- Use the CONTEXT-locked grant wording **verbatim** (the "Commercial Service" definition from `31-CONTEXT.md:32`), NOT the Sentry "Application Monitoring Service" adaptation suggested as one option in `31-RESEARCH.md:440-449`. CONTEXT is locked; the Sentry-style adaptation is a deferred recommendation per RESEARCH Open Question 3.
- Licensor field is **`Memeputer LLC`** exactly (NOT "Ben Tatum", NOT "x402.jobs", NOT "Licensor (or its successor)") — verbatim per `31-CONTEXT.md:26` "Licensor entity (locked 2026-05-15)".
- Copyright header above the Parameters block: `Copyright © 2026 Memeputer LLC. All rights reserved.` verbatim per `31-CONTEXT.md:29`.

**Failure modes if pattern not followed:**
- **Modifying the body text** → license is no longer technically BSL 1.1; covenant 4 violation; legally an unknown derivative (`31-RESEARCH.md` Pitfall 7).
- **Wrong Licensor name** (e.g., "Ben Tatum" or "x402.jobs") → legal ambiguity; CONTEXT Decision 2 has the entity locked.
- **Change Date computed against the wrong reference** → must be 4 years from the LICENSE-file-landing commit, NOT the public-flip date (RESEARCH Open Question 4 recommendation).
- **Switching Change License from Apache-2.0** → conflicts with CONTEXT Decision 2 ("Falls back to Apache-2.0").

---

### 2. `SECURITY.md` (root, NEW) — docs, public-disclosure-time

**Analog:** None in repo. Closest external pattern is OSSF Scorecard's SECURITY.md (`31-RESEARCH.md` Sources section, secondary). Phase 30's `30-CONVERGENCE.md` "Deferred Items" line 89 explicitly lists "SECURITY.md publishing the release-age policy externally" as Phase 31 work.

**Pattern: minimal disclosure policy with two load-bearing sections** (`31-RESEARCH.md:710-787`):

```markdown
# Security Policy

## Reporting a Vulnerability

**Please do not file public issues for security findings.**

1. **GitHub Private Vulnerability Reporting** (preferred):
   https://github.com/rawgroundbeef/x402.jobs/security/advisories/new

2. **Email:** security@x402.jobs   ← ASK USER for fallback per RESEARCH Open Q6

## Supply-Chain Hardening

This repo applies a 72-hour npm release-age gate via the root `.npmrc`
(`minimum-release-age=4320`) to neutralize the bulk of npm zero-day
patterns. Internal `@x402jobs/*` packages are exempted. A future
maintainer who removes this gate is removing a documented security
control; please don't.

## Encryption Keys

x402.jobs encrypts user wallet private keys (AES-256-GCM via
`WALLET_ENCRYPTION_SECRET`) and OAuth tokens (AES-256-CBC via
`INTEGRATION_ENCRYPTION_SECRET`) at rest in Supabase.

## Known Unfixed Findings

[EMPTY — per 31-CONTEXT.md Decision 1: all 12 Phase 28 HIGHs shipped
to api/main as commit c751857 on 2026-05-14, plus all 7 CRITs already
shipped previously. No deferred items at launch.]

For transparency, the historical security review artifacts are
preserved in `.planning/phases/28-security-review/` of this repo.
```

**Deviations expected vs the RESEARCH skeleton (`31-RESEARCH.md:710-787`):**
- The "Known Unfixed Findings" table in the RESEARCH skeleton (line 751-757) lists Medium/Low/Info as OPEN with "See GitHub Issues #N..M". Per `31-CONTEXT.md:19` LOCKED ("`SECURITY.md` 'Known unfixed findings' section is **empty** at launch"), this table is **deleted entirely** — only the three items in `31-CONTEXT.md:19` are mentioned: (a) Phase 30 release-age policy externally, (b) private security-disclosure contact, (c) link to `.planning/phases/28-security-review/` for transparency.
- The "Honest Limitations" section in RESEARCH (lines 760-766) is optional — Phase 31 SECURITY.md should keep it brief; do not invent audit history that doesn't exist.

**Failure modes if pattern not followed:**
- **Documenting Highs as OPEN when they're FIXED** → misrepresents the security posture; contradicts CONTEXT Decision 1 ("section is empty at launch"). RESEARCH Assumption A5 flags this risk.
- **Omitting the release-age policy section** → `31-CONTEXT.md` Decision NOT_LOCKED bullet ("Phase 31's unified CI must use") AND `30-CONVERGENCE.md` deferred-item list both require this section so a future maintainer cannot silently remove the gate.
- **Listing `security@x402.jobs` without confirming the mailbox exists** → broken disclosure channel. RESEARCH Open Question 6 flags this.

---

### 3. `CONTRIBUTING.md` (root, NEW) — docs, contributor-onboarding-time

**Analog:** None. RESEARCH Assumption A7 flags this as a "one-page convention-on-PR file; minimal effort."

**Pattern (planner discretion; minimal):**

```markdown
# Contributing to x402.jobs

x402.jobs is licensed under [BSL 1.1](LICENSE) — please review the
license terms before contributing.

## Development

```bash
pnpm install
pnpm dev   # web (3010) + api (3011) + Inngest (8288)
```

## Pull Requests

- Use conventional commits with phase scope: `feat(31): …`,
  `fix(api): …`, `docs(web): …`
- Run `pnpm lint && pnpm typecheck && pnpm --filter x402-jobs-api test`
  before opening a PR
- The CI workflow (`.github/workflows/ci.yml`) gates merges via
  path-filtered jobs for web vs api

## Security

See [SECURITY.md](SECURITY.md). Do not file security issues publicly.
```

**Deviations expected:** None substantive; this is a convention-driven file. The planner can flesh out a CLA blurb or contributor agreement if desired (out of scope for the locked CONTEXT).

**Failure modes if pattern not followed:**
- **Forgetting the BSL link** → contributors may assume MIT and contribute under wrong terms.
- **Wrong commit-style guidance** → diverges from `docs(31): …` convention noted in `31-RESEARCH.md:19`.

---

### 4. `CLAUDE.md` (root, NEW — Discretion area) — docs / AI-assistant rules

**Analog:** None — `31-RESEARCH.md:17` confirms no `./CLAUDE.md` exists today.

**Pattern (RESEARCH Open Question 8 recommendation — 1-screen file):**

```markdown
# x402.jobs — Repo-wide AI Assistant Rules

## Hard locks (do NOT recommend changes to these)

- **pnpm pin: `pnpm@10.6.5` exact.** See `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md`. Bumping past 10.7.0 hits the Next.js 15.5 ENOWORKSPACES bug (vercel/next.js#86841). Bumping past 11 breaks `ignoredBuiltDependencies` in `pnpm-workspace.yaml`.
- **`.npmrc#minimum-release-age=4320`** is a supply-chain control documented in `SECURITY.md`. Do not remove or shorten.
- **License: BSL 1.1.** Do not propose MIT/Apache/AGPL changes without an explicit user request.

## Conventions

- Conventional Commits with phase scope: `feat(31): …`, `docs(api): …`.
- `pnpm dev` orchestrates web + api + Inngest via Turbo. Per-app fallbacks: `pnpm dev:web`, `pnpm dev:api`, `pnpm dev:inngest`.
- Migrations: BOTH `apps/api/migrations/` (flat) and `apps/api/supabase/migrations/` (timestamped) coexist by design. Do not propose consolidation without consulting Phase 31 Pitfall 6.
```

**Failure modes if pattern not followed:**
- **Omitting the pnpm 10.6.5 lock note** → future Claude sessions propose pnpm 10.7.0+ bump, regressing `30-CONVERGENCE.md`.
- **Omitting the BSL note** → AI proposes "switch to MIT for broader adoption" on a public README PR.

---

### 5. `README.md` (root, REWRITE) — docs, public-facing

**Analog:** itself — `/Users/rawgroundbeef/Projects/x402jobs/README.md` (51 lines today). Concrete excerpt of the load-bearing problem:

```markdown
# Line 49-51 of current README.md
## License

MIT
```

**Pattern after rewrite** (`31-RESEARCH.md:793-845` skeleton):

```markdown
# x402.jobs

> Chain x402-paid HTTP endpoints into automated workflows. Agents
> bring their own wallet; resources earn USDC.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

## Quickstart

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

- `apps/web/`     — Next.js 15.5 frontend (Vercel)
- `apps/api/`     — Express API + Inngest workers (Railway)
- `packages/sdk/` — `@x402jobs/sdk` (public npm)
- `packages/ui/`  — internal shared components

## License

[BSL 1.1 with Additional Use Grant](LICENSE). Change Date: 4 years from
initial public commit, then converts to Apache 2.0.

In plain English: internal/self-hosted use is allowed. A hosted
x402-payments-workflow service that competes with x402.jobs is not.
```

**Deviations expected:**
- The current README's `Structure` block (lines 7-16) does NOT include `apps/api/` — must add post-merge.
- The MIT line at line 51 MUST be replaced.
- Add `Security` and `Contributing` cross-links per RESEARCH skeleton lines 840-844.

**Failure modes if pattern not followed:**
- **Leaving `License: MIT` line in place** → contradicts LICENSE file; legal ambiguity.
- **Showing `pnpm install` quickstart without mentioning the env.example copy step** → new contributors hit `WALLET_ENCRYPTION_SECRET environment variable is not set` boot guard (per Pitfall 4 boot-log warning).

---

### 6. `.github/workflows/ci.yml` (root, NEW) — CI config, PR + push to main

**Analog:** None in either repo (per 30-PATTERNS.md line 54: `/Users/rawgroundbeef/Projects/x402jobs/.github/workflows/` "exists but empty"; api repo has no `.github/workflows/` at all).

**Pattern: `dorny/paths-filter@v3` job-level gating** — verbatim canonical from `31-RESEARCH.md:298-377` Pattern 2:

```yaml
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

**Deviations expected:**
- The pnpm version (`10.6.5`) MUST match `package.json#packageManager` per `30-CONVERGENCE.md:27` — do not float, do not bump.
- The api filter name (`x402-jobs-api`) must match the api repo's `package.json#name` field as imported (RESEARCH section "Code Examples" line 119 confirms this is the package name).
- This CI must validate the Phase 30 SC6 deferred item retroactively per ROADMAP Phase 31 success criteria #8 ("Vercel + Railway main-branch deploys post-merge satisfy the Phase 30 `30-CONVERGENCE.md` 'Expected build-log assertions'").

**Failure modes if pattern not followed:**
- **Omitting the `shared:` filter** → PRs touching only `pnpm-lock.yaml` skip both jobs; broken lockfile lands silently (`31-RESEARCH.md` Pitfall 2).
- **Using `paths:` workflow trigger instead of `dorny/paths-filter`** → cannot gate individual jobs within a workflow; fragments the failure surface (`31-RESEARCH.md` Anti-Patterns line 522).
- **Adding `apps/api/.github/workflows/`** → GitHub Actions only reads workflows from the repo root's `.github/workflows/`; app-local workflow files are inert (RESEARCH Anti-Pattern line 523).
- **Pinning pnpm to a different version than `package.json#packageManager`** → drift; `30-CONVERGENCE.md` "no pnpm@9 stragglers" guarantee broken.
- **Skipping `permissions: pull-requests: read`** → `dorny/paths-filter@v3` fails with permission error.

---

### 7. `apps/api/` (BULK NEW — squash-import subtree) — app source, runtime + dev + build + test

**Analog:** `/Users/rawgroundbeef/Projects/x402jobs-api/` working tree at sha `4877799` (or latest sha on api repo's `main` at execution time). This IS the source — the planner's job is to import it correctly, not pattern-match it.

**Pattern: `git read-tree --prefix=`** — verbatim canonical from `31-RESEARCH.md:233-279` Pattern 1:

```bash
cd /Users/rawgroundbeef/Projects/x402jobs
git checkout -b phase/31-monorepo-merge

# Step 1: Add api repo as a local remote
git remote add api-import /Users/rawgroundbeef/Projects/x402jobs-api
git fetch api-import main

# Step 2: Read its working tree under apps/api/ into the index
git read-tree --prefix=apps/api/ -u api-import/main

# Step 3: Verify the tree landed correctly
ls apps/api/
# Should show: src/ migrations/ supabase/ scripts/ Dockerfile package.json tsconfig.json ...
# Should NOT show: node_modules/ dist/ .env

# Step 4: Manual copy of the UNTRACKED pnpm-workspace.yaml (see pattern 8 below)
cp /Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml apps/api/pnpm-workspace.yaml

# Step 5: Remove the remote
git remote remove api-import

# Step 6: Single squash commit
git commit -m "feat(monorepo): import x402jobs-api at <sha> into apps/api/

Squashed working-tree import of rawgroundbeef/x402-jobs-api per Phase 31
Decision 3. Closed-repo commit history preserved in the archived
private remote at rawgroundbeef/x402-jobs-api.

Source sha: <sha>
Source remote: github.com/rawgroundbeef/x402-jobs-api
Imported tree: 144 .ts files, 1.8 MB src/ + migrations/ + scripts/

Phase 28 HIGH remediations included in this import (already shipped to
api/main as PR #32, commit c751857):
  - HIGH-02 Batch H (Twitter OAuth: state nonce, x402_oauth_pending
    table, AES-256-CBC token encryption at rest, backfill script)
  - All other 11 HIGHs (Batches A-I from HIGHS-TRIAGE.md)

Refs: Phase 31 CONTEXT Decision 3"
```

**Post-import cleanup (within the same merge PR):**

```bash
# Delete vestigial api vercel.json (Decision 4: Railway is the api lane)
rm apps/api/vercel.json

# Delete the Phase 28 audit-tmp snapshot (already gitignored)
rm -rf apps/api-audit-tmp/

# Regenerate root lockfile
pnpm install

# Smoke
pnpm --filter @x402jobs/web build
pnpm --filter x402-jobs-api build
pnpm --filter x402-jobs-api test
```

**Deviations expected:** The api repo HEAD at research time was on branch `chore/phase-30-03-pnpm-10-api` (not `main`); the user must merge any open api PRs to `main` BEFORE the squash-import OR change the squash command to read from the desired branch (`api-import/chore/phase-30-03-pnpm-10-api`). Reference the exact imported sha in the squash commit message verbatim.

**Failure modes if pattern not followed:**
- **`cp -r` instead of `git read-tree --prefix`** → ignores gitignore; copies `node_modules/`, `.env`, `wallet-backup-*.json`, `dist/`; first commit exposes secrets (Pitfall 8).
- **`git filter-repo --to-subdirectory-filter`** → preserves history; contradicts Decision 3 "Squashed import" (RESEARCH Anti-Patterns line 519).
- **`git subtree add --squash --prefix=apps/api/`** → creates a merge commit, not a plain commit; structurally different from the locked Decision 3 (RESEARCH Pattern 1 caveats line 282).
- **Squash-importing without `cp pnpm-workspace.yaml`** → post-install `isolated-vm` build script fires, may fail loudly on machines without native build deps (Pitfall 1).
- **Forgetting to remove `apps/api-audit-tmp/` from disk** → confusion; gitignore still hides it but two parallel api trees exist locally.

---

### 8. `apps/api/pnpm-workspace.yaml` (manual copy of untracked source) — workspace config

**Analog:** `/Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml` — **UNTRACKED** per `git ls-files pnpm-workspace.yaml` returning empty (`31-RESEARCH.md:486-493`). Contents verified at research time:

```yaml
# Excerpt from /Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml
# (untracked in api repo git; lives only on maintainer's disk)
ignoredBuiltDependencies:
  - isolated-vm
```

**Pattern: merge into root, then delete the app-local copy** (`31-RESEARCH.md` Pattern 5, lines 496-498 — "Option B (correct)"):

After `cp /Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml apps/api/pnpm-workspace.yaml`:

1. Merge `ignoredBuiltDependencies: [isolated-vm]` into the ROOT `pnpm-workspace.yaml` (see pattern 11 below).
2. `rm apps/api/pnpm-workspace.yaml` — pnpm only reads the nearest `pnpm-workspace.yaml` to cwd, and the root one with `packages: [apps/*, packages/*]` already covers `apps/api`. The app-local file is dead weight (RESEARCH Anti-Pattern line 520; pnpm GitHub Discussion #10267).

**Failure modes if pattern not followed:**
- **Leaving two `pnpm-workspace.yaml` files** → app-local one is inert; the `ignoredBuiltDependencies` rule never applies; `isolated-vm` build script runs.
- **Forgetting to merge into root** → same outcome; ignored-build-dependencies rule never reaches pnpm.
- **Not committing the untracked api file BEFORE squash-import** → `git read-tree --prefix` skips it (only reads tracked files); `pnpm install` post-merge fails or surfaces unexpected `Ignored build scripts:` warnings (Pitfall 1).

---

### 9. `pnpm-workspace.yaml` (root, MODIFY) — workspace config, install time

**Analog:** itself, current state:

```yaml
# /Users/rawgroundbeef/Projects/x402jobs/pnpm-workspace.yaml (current, 3 lines)
packages:
  - "apps/*"
  - "packages/*"
```

**Pattern after Phase 31** (`31-RESEARCH.md:852-871` Example 5 — verbatim):

```yaml
# Merged from x402jobs root + x402jobs-api working tree (untracked file)
# After: post-Phase 31

packages:
  - "apps/*"
  - "packages/*"

# Preserved from x402jobs-api/pnpm-workspace.yaml (was untracked there;
# merged into root here per Phase 31 squash-import).
#
# `ignoredBuiltDependencies` was deprecated in pnpm 11; we are on pnpm 10.6.5.
# If pnpm is ever upgraded past 10.x, migrate this to:
#   allowBuilds:
#     isolated-vm: false
# See: https://pnpm.io/settings (allowBuilds, v10.26.0+)
ignoredBuiltDependencies:
  - isolated-vm
```

**Deviations expected:** The `packages:` block (lines 1-3) is unchanged because `apps/*` already covers the new `apps/api`. The additive section is the `ignoredBuiltDependencies` block carried over from the api repo's untracked file.

**Failure modes if pattern not followed:**
- **Replacing `packages: [apps/*, packages/*]` with `packages: [apps/web, apps/api, packages/*]`** → unnecessary specificity; first new app would silently fall off the workspace.
- **Omitting the comment about pnpm 11 migration path** → future pnpm bump silently breaks the invariant (the setting is removed in pnpm 11 per `31-RESEARCH.md` State of the Art line 901).
- **Inverting to `allowBuilds: isolated-vm: false`** at pnpm 10.6.5 → setting doesn't exist yet; no-op until pnpm v10.26.0+.

---

### 10. `package.json` (root, MODIFY) — workspace config + dev scripts

**Analog:** itself, current state (`/Users/rawgroundbeef/Projects/x402jobs/package.json`, 33 lines). Concrete excerpt of the load-bearing sections:

```json
// Current /Users/rawgroundbeef/Projects/x402jobs/package.json
{
  "name": "x402jobs",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": { "turbo": "^2.3.0" },
  "packageManager": "pnpm@10.6.5",
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild", "sharp", "protobufjs", "fsevents",
      "bufferutil", "utf-8-validate"
    ]
  },
  "engines": { "node": ">=18" }
}
```

**Pattern after Phase 31** (additive changes):

```json
{
  "name": "x402jobs",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    // NEW fallback scripts per ROADMAP Phase 31 risk mitigation
    // ("standalone pnpm dev:web, pnpm dev:api, pnpm dev:inngest scripts
    //  as fallbacks so devs can run them individually if the unified
    //  command misbehaves")
    "dev:web": "pnpm --filter @x402jobs/web dev",
    "dev:api": "pnpm --filter x402-jobs-api dev:api",
    "dev:inngest": "pnpm --filter x402-jobs-api dev:inngest",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",                              // NEW
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": { "turbo": "^2.3.0" },
  "packageManager": "pnpm@10.6.5",   // UNCHANGED — Phase 30 invariant
  "pnpm": {
    // UNION of this repo + api repo allow-lists per 31-RESEARCH.md
    // Example 6 (line 873-892) — alphabetical
    "onlyBuiltDependencies": [
      "bigint-buffer",     // api repo — Solana
      "bufferutil",
      "esbuild",
      "fsevents",          // web only — macOS file watcher
      "isolated-vm",       // api repo — sandboxed JS execution
      "protobufjs",
      "sharp",             // web only — Next.js Image
      "utf-8-validate"
    ]
  },
  "engines": { "node": ">=18" }
}
```

**Deviations expected vs analog (this same file pre-merge):**
- `scripts` block gains `dev:web`, `dev:api`, `dev:inngest`, `test` (4 new entries).
- `pnpm.onlyBuiltDependencies` expands from 6 to 8 entries (adds `bigint-buffer`, `isolated-vm`). Allow-list source-of-truth is `30-CONVERGENCE.md:53-61` "Allow-list delta between repos (intentional)".
- `packageManager: pnpm@10.6.5` — UNCHANGED. Phase 30 invariant; do NOT bump (`31-RESEARCH.md:20` Project Constraint).
- `engines.node` may optionally bump from `>=18` to `>=22` to match the api Dockerfile target (`31-RESEARCH.md:131` — "Node 22 to match api Dockerfile"). Discretion area; not load-bearing.

**Failure modes if pattern not followed:**
- **Changing `packageManager` from `pnpm@10.6.5`** → regresses Phase 30; 30-CONVERGENCE.md SC1 fails on next CI run.
- **Omitting `bigint-buffer` or `isolated-vm` from `onlyBuiltDependencies`** → api repo's `pnpm install` surfaces `Ignored build scripts:` warnings for these packages; runtime may degrade (isolated-vm is required for prompt-path resources).
- **Adding a `dev` shim that wraps Turbo with something else** → breaks the persistent-task model already in place; web + api + Inngest no longer co-supervised.

---

### 11. `turbo.json` (root, MODIFY) — task orchestration

**Analog:** itself, current state (`/Users/rawgroundbeef/Projects/x402jobs/turbo.json`, 22 lines):

```jsonc
// Current /Users/rawgroundbeef/Projects/x402jobs/turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true   // ← already correct for Pattern 3 (api+inngest+web)
    },
    "lint":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "clean":     { "cache": false }
  }
}
```

**Pattern after Phase 31** (additive — add `test` task):

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": {                                  // NEW — invoked by CI's api job
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean":     { "cache": false }
  }
}
```

**Deviations expected:**
- The existing `dev: persistent: true` is the load-bearing config for `pnpm dev` orchestrating web + api + Inngest concurrently (`31-RESEARCH.md:396` — "This repo's `turbo.json` already marks `dev` as `persistent: true, cache: false`"). DO NOT change.
- The new `test` task is consumed by the unified CI workflow's api job (pattern 6 above). The web app has no test framework yet (`31-RESEARCH.md:993` — "Framework (web): None currently") so the task is effectively api-only at launch; that's fine.

**Failure modes if pattern not followed:**
- **Removing `persistent: true` from `dev`** → web and api no longer run as long-running processes; `pnpm dev` exits after first iteration. Breaks ROADMAP success criterion #3 ("A new clone-and-run developer can `pnpm install && pnpm dev` and have a working local environment").
- **Adding `cache: true` to `dev`** → Turbo caches the never-ending dev process; never starts on subsequent runs.
- **Replacing `outputs: ["dist/**", ".next/**", "!.next/cache/**"]`** → either web (`.next/`) or api (`dist/`) artifacts uncached, slowing CI.

---

### 12. `apps/web/vercel.json` — Vercel deploy config

**Analog:** itself, current state:

```jsonc
// /Users/rawgroundbeef/Projects/x402jobs/apps/web/vercel.json (current, post-Phase 30)
{
  "version": 2,
  "installCommand": "npm install -g pnpm@10.6.5 && pnpm install --frozen-lockfile",
  "buildCommand": "turbo run build --filter=@x402jobs/web..."
}
```

**Pattern: no changes** (`31-RESEARCH.md` Open Question 7):

The `buildCommand` already filters to `@x402jobs/web...` which works post-merge unchanged. The `installCommand` already pins `pnpm@10.6.5` per Phase 30.

**Deviations expected:** None. Verify only — by watching the merge PR's Vercel preview build logs against `30-CONVERGENCE.md` "Expected build-log assertions" (success criterion #8 from ROADMAP).

**Failure modes if pattern not followed:**
- **Replacing `pnpm@10.6.5` with `pnpm@10.7.0` or floating `pnpm@10`** → hits Next.js 15.5 ENOWORKSPACES bug (`30-CONVERGENCE.md:4`).
- **Dropping the `--filter=@x402jobs/web...` suffix** → Vercel rebuilds the entire monorepo on every web change; slower previews but not broken.

---

### 13. `.gitignore` (root, MODIFY) — git config

**Analog:** itself, current state:

```
# /Users/rawgroundbeef/Projects/x402jobs/.gitignore (current, 31 lines)
# Dependencies
node_modules/

# Build outputs
dist/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# ... [IDE, OS, Testing, Misc] ...

# Temp api copy for Phase 28 security review — remove after audit completes.
# Real merge to apps/api/ happens in Phase 30.
apps/api-audit-tmp/
```

**Pattern after Phase 31** (additive + housekeeping):

```
# Existing entries unchanged (dist/, .next/, .turbo/, .env*, etc.)
# already cover apps/api/dist, apps/api/node_modules, apps/api/.env

# DELETE this line — Phase 31 removes apps/api-audit-tmp/ from disk:
# apps/api-audit-tmp/

# ADD api-specific patterns (verify against api repo's .gitignore):
apps/api/coverage/
apps/api/wallet-backup-*.json   # per STATE.md "wallet-backup-*.json files
                                 # at ~/Projects/x402jobs-api/" warning
```

**Deviations expected:**
- The existing wildcards (`node_modules/`, `dist/`, `.env*`) already cover apps/api transitively per gitignore's recursive matching. The plan should verify by `git status` after import that nothing unexpected is staged.
- The `apps/api-audit-tmp/` line at `.gitignore:30` (commented "Real merge to apps/api/ happens in Phase 30") is now stale — Phase 31 is the actual merge phase, and the audit-tmp directory is being removed entirely.

**Failure modes if pattern not followed:**
- **Leaving `apps/api-audit-tmp/` rule in place after directory removal** → harmless but confusing (will silently match future `apps/api-audit-tmp/...` regrowth, hiding it).
- **Missing `wallet-backup-*.json`** → maintainer's local wallet-backup files (per `31-RESEARCH.md:558` Runtime State Inventory) could be accidentally staged.
- **Missing `coverage/`** → api vitest coverage reports get committed.

---

### 14. `.npmrc` (root) — install config

**Analog:** itself; Phase 30 ALREADY shipped this (`30-CONVERGENCE.md:46`).

**Pattern: NO-OP** per `31-RESEARCH.md:22` Project Constraint:

> "`frozen-lockfile=true` is intentionally NOT in the root `.npmrc`; pnpm auto-enables it via `CI=true`. Phase 31 must NOT add `frozen-lockfile` either."

Current state (verified via Read of `/Users/rawgroundbeef/Projects/x402jobs/.npmrc`):

```ini
minimum-release-age=4320
minimum-release-age-exclude=@x402jobs/*
# NOTE: frozen-lockfile is intentionally OMITTED here.
```

**Deviations expected:** None.

**Failure modes if pattern not followed:**
- **Adding `frozen-lockfile=true`** → blocks local `pnpm add` / `pnpm update`; blocks any future lockfile regen (RESEARCH Pitfall 3).
- **Shortening `minimum-release-age` below 4320** → weakens the documented supply-chain control referenced by SECURITY.md.
- **Removing the explanatory comment block** → future Claude/maintainer doesn't know why `frozen-lockfile` is omitted; risks re-adding it.

---

### 15. `apps/api/Dockerfile` (squash-import casualty) — infra (Railway build)

**Analog:** sibling `~/Projects/x402jobs-api/Dockerfile` — already at `pnpm@10.6.5` per `30-CONVERGENCE.md:29`:

```dockerfile
# Excerpt — sibling /Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile:17 (post-Phase 30)
RUN npm install -g pnpm@10.6.5
```

**Pattern: carry-forward unchanged via squash-import** — no code edits expected.

The Railway deploy lane needs a SERVICE-LEVEL re-point (Settings → Source Repository → new repo + `apps/api/` as root) per `31-RESEARCH.md:549` Runtime State Inventory. This is a UI/manual operation, not a file change.

**Deviations expected:** None to the file. Manual Railway action separate from the codebase change.

**Failure modes if pattern not followed:**
- **Re-creating Railway service instead of re-pointing** → loses env vars including `WALLET_ENCRYPTION_SECRET` + `INTEGRATION_ENCRYPTION_SECRET`; every wallet unrecoverable (Pitfall 4). RESEARCH Assumption A3 flags this.
- **Skipping env-var verification on re-point** → silent failure mode where api boots but cannot decrypt user data.
- **Editing the Dockerfile inside `apps/api/` post-import to "improve" the pnpm pin** → drift from `30-CONVERGENCE.md:29`.

---

### 16. Migration folders — `apps/api/migrations/` + `apps/api/supabase/migrations/`

**Analog:** sibling api repo's two parallel tracks (per `31-RESEARCH.md:225` and Pitfall 6):
- `migrations/` — flat numeric files (001-010), legacy api-runner format
- `supabase/migrations/` — Supabase-CLI timestamped format

**Pattern: carry-forward BOTH unchanged; defer reconciliation** (`31-RESEARCH.md` Pitfall 6 + Don't Hand-Roll line 538):

> "Phase 31 should DEFER migration consolidation. Carry both folders forward unchanged. File a follow-up issue for v3.1."

**Deviations expected:** None. Add a follow-up issue: "Audit and consolidate `apps/api/migrations/` vs `apps/api/supabase/migrations/`" — out of scope for Phase 31.

**Failure modes if pattern not followed:**
- **Renaming or merging migration folders during Phase 31** → Supabase migration-tracking table loses track of applied migrations; next `supabase migration up` either re-applies migrations (data loss) or fails (Pitfall 6).

---

## Shared Patterns (cross-cutting)

### Shared 1: Public-flip ceremony order (applies to ALL plans)

**Source:** `31-RESEARCH.md` Pitfall 5 (lines 614-626).

**Apply to:** Plan ordering across all Phase 31 plans.

**Strict order (do not violate):**

1. Draft `LICENSE`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md` (committed; repo still private)
2. Squash-import api repo into `apps/api/` (committed; repo still private)
3. Add `.github/workflows/ci.yml` (committed; repo still private)
4. Verify `pnpm install && pnpm dev` end-to-end locally
5. Re-point Railway service to new repo + `apps/api/` root; verify both encryption secrets survive
6. Verify Vercel preview on the merge PR
7. Merge PR to `main`; production deploys verified
8. Archive `rawgroundbeef/x402-jobs-api` (read-only; visibility unchanged — stays private)
9. **Only now:** flip `rawgroundbeef/x402.jobs` to public

**Failure modes:** Public-flip before merge PR is merged → exposes broken state (LICENSE may be missing, apps/api/ may be empty, SECURITY.md disclosure channel may not exist).

### Shared 2: pnpm 10.6.5 invariant (applies to plans 7, 11, 12, 14, 15)

**Source:** `30-CONVERGENCE.md:24-31` + `31-RESEARCH.md:20` Project Constraint.

**Apply to:** Any file that pins a pnpm version (root `package.json`, root `.npmrc`, root `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `apps/web/vercel.json`, `apps/api/Dockerfile`, `apps/api/vercel.json` — last is deleted).

**Invariant:** `pnpm@10.6.5` exact; do NOT bump to 10.7.0+ (Next.js 15.5 ENOWORKSPACES bug, vercel/next.js#86841) or 11+ (`ignoredBuiltDependencies` removed).

**Verification (cross-repo):** `git ls-files | xargs grep -l "pnpm@\(9\|10\.7\|10\.8\|11\)"` should be EMPTY post-merge.

### Shared 3: Encryption-secret invariant (applies to plan 15 + Railway re-point)

**Source:** `31-RESEARCH.md` Pitfall 4 + Runtime State Inventory + Assumption A3.

**Apply to:** Railway service re-point step.

**Invariant:** `WALLET_ENCRYPTION_SECRET` + `INTEGRATION_ENCRYPTION_SECRET` MUST survive any infrastructure operation. Both are LOAD-BEARING — loss makes every wallet/token unrecoverable.

**Verification:** After Railway re-point, the api boot log must NOT contain `WALLET_ENCRYPTION_SECRET environment variable is not set` (the Phase 27 boot guard).

### Shared 4: Conventional Commits with phase scope (applies to all plan commits)

**Source:** `31-RESEARCH.md:19` Project Constraint.

**Apply to:** Every commit landed in Phase 31.

**Pattern:** `<type>(31): <subject>` — e.g., `feat(31): bsl 1.1 LICENSE + Memeputer LLC licensor`, `feat(monorepo): import x402jobs-api at <sha> into apps/api/` (for the squash-import commit specifically, which uses `monorepo` scope per RESEARCH Pattern 1 line 262).

### Shared 5: Action pinning (applies to plan 6 — CI workflow)

**Source:** `31-RESEARCH.md:1049` Security Domain — threat pattern row.

**Apply to:** `.github/workflows/ci.yml`.

**Pattern:** Pin actions to major-version tags (`@v4` for `actions/*` and `pnpm/action-setup`, `@v3` for `dorny/paths-filter`). Optional supply-chain hardening: pin to commit SHA. RESEARCH recommendation is "leave at `@v3` for now (well-known maintainer; same trust model as `actions/checkout@v4`)."

## No Analog Found (greenfield files — planner uses RESEARCH templates)

| File | Role | Rationale for greenfield |
|------|------|--------------------------|
| `LICENSE` | license | No license file exists in either repo today; canonical source is external (MariaDB BSL 1.1 + CONTEXT-locked Parameters) |
| `SECURITY.md` | docs | No security policy exists in either repo; OSSF Scorecard template is the closest external reference |
| `CONTRIBUTING.md` | docs | No contribution doc exists in either repo |
| `CLAUDE.md` (Discretion area) | AI-assistant rules | None exists; RESEARCH Open Question 8 recommends adding one |
| `.github/workflows/ci.yml` | CI | Empty `.github/workflows/` directory in this repo; api repo has no workflows folder at all |

For these files, the planner uses the verbatim templates captured in `31-RESEARCH.md` Patterns 2, 4 and Code Examples 1-3.

## Metadata

**Analog search scope:**
- This repo: `/Users/rawgroundbeef/Projects/x402jobs/` (root + `apps/web/` + `.planning/` for prior PATTERNS.md style)
- Sibling repo: `/Users/rawgroundbeef/Projects/x402jobs-api/` (file excerpts retrieved via RESEARCH.md, which the researcher captured at sha `4877799` on 2026-05-14; direct Read access denied to this agent for sibling tree, but RESEARCH.md verbatim excerpts are sufficient)

**Files scanned (this repo):** root `package.json`, root `turbo.json`, root `pnpm-workspace.yaml`, root `.npmrc`, root `.gitignore`, root `README.md`, `apps/web/package.json`, `apps/web/vercel.json`, `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, `.planning/STATE.md`, `.planning/config.json`, `.planning/ROADMAP.md`, `.planning/v3.0-MILESTONE-SCOPE.md` (grep only), `.planning/phases/31-monorepo-merge-bsl/31-CONTEXT.md`, `.planning/phases/31-monorepo-merge-bsl/31-RESEARCH.md`, `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md`, `.planning/phases/30-supply-chain-hardening/30-PATTERNS.md` (for style reference).

**Files scanned (sibling repo, via RESEARCH excerpts):** `package.json`, `pnpm-workspace.yaml` (untracked), `Dockerfile`, `vercel.json`, `src/routes/integrations.ts`, `src/lib/instant/encrypt.ts`, `scripts/migrate-encrypt-x-tokens.ts`, `migrations/009_add_oauth_pending_and_encrypted_tokens.sql`.

**Pattern extraction date:** 2026-05-14.
**Phase 31 sha references:** sibling api repo HEAD `4877799` at research time; the planner re-confirms `git rev-parse HEAD` at squash-import execution time.
