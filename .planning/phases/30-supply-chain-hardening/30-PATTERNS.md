# Phase 30: Supply Chain Hardening — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 7 distinct edit targets (5 in `x402jobs` repo, 2 in sibling `x402jobs-api`)
**Analogs found:** 4 / 7 (2 are greenfield; 1 has only an out-of-scope hint analog)

## Repo topology (load-bearing for the planner)

| Repo | Path on disk | Status | Phase 30 work? |
|------|--------------|--------|----------------|
| `x402jobs` (this repo) | `/Users/rawgroundbeef/Projects/x402jobs` | open, on disk | Yes — root `package.json`, root `.npmrc`, root `pnpm-lock.yaml` regen |
| `x402jobs-api` (sibling) | `/Users/rawgroundbeef/Projects/x402jobs-api` | closed-source, on disk in dev env | Yes — `Dockerfile`, `vercel.json`, `package.json` (no `packageManager` field today), regen `pnpm-lock.yaml` |
| `apps/api-audit-tmp/` | `/Users/rawgroundbeef/Projects/x402jobs/apps/api-audit-tmp` | gitignored snapshot of `x402jobs-api` for Phase 28 audit | **DO NOT edit.** Read-only reference. Real edits land in `~/Projects/x402jobs-api/`. The audit copy has no `package.json` of its own (selective copy). |

The two repos merge in **Phase 31** (`apps/api-audit-tmp/` → `apps/api/`). Phase 30 must complete on the split topology and leave both repos in a state where Phase 31's merge is mechanical.

## File Classification

| Edit target | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `package.json` (root, this repo) — bump `packageManager`, add `pnpm.onlyBuiltDependencies` | config | n/a (build-time) | `apps/api-audit-tmp/pnpm-workspace.yaml` (has `ignoredBuiltDependencies`) | partial — same pnpm hook family, different field/file |
| `.npmrc` (root, this repo) — NEW | config | n/a | **No analog in either repo.** Greenfield. | none |
| `pnpm-lock.yaml` (root, this repo) — regenerate | generated artifact | n/a | itself (`lockfileVersion: '9.0'`); api repo lockfile also `'9.0'` | self |
| `~/Projects/x402jobs-api/Dockerfile` — bump `pnpm@9` → `pnpm@10.x` | infra | build | `apps/api-audit-tmp/Dockerfile` (identical historical copy, line 15) | exact — same file, audit snapshot |
| `~/Projects/x402jobs-api/vercel.json` — bump `pnpm@9.12.1` | infra | build | `apps/web/vercel.json` line 3 (same pattern in this repo) | exact role-match |
| `apps/web/vercel.json` — bump `pnpm@9.12.1` | infra | build | itself; mirrored by api repo `vercel.json` | self |
| `SECURITY.md` (root, this repo) — optional, possibly deferred to Phase 31 | docs | n/a | **No analog.** No policy doc exists in either repo. | none |

## Cross-cutting findings before per-file detail

### Every place that pins a pnpm version (this repo + sibling)

Grep result for `pnpm@?\d` and `packageManager` across the active source tree (excluding `node_modules` and lockfiles):

| File | Line | Current pin |
|---|---|---|
| `/Users/rawgroundbeef/Projects/x402jobs/package.json` | 19 | `"packageManager": "pnpm@9.15.0"` |
| `/Users/rawgroundbeef/Projects/x402jobs/apps/web/vercel.json` | 3 | `npm install -g pnpm@9.12.1 && pnpm install --frozen-lockfile` |
| `/Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile` | 15 | `RUN npm install -g pnpm@9` (floating major) |
| `/Users/rawgroundbeef/Projects/x402jobs-api/vercel.json` | 3 | `npm install -g pnpm@9.12.1 && pnpm install --frozen-lockfile` |
| `/Users/rawgroundbeef/Projects/x402jobs/apps/api-audit-tmp/Dockerfile` | 15 | `RUN npm install -g pnpm@9` (gitignored mirror of sibling; do NOT edit) |

Notes for the planner:
- `~/Projects/x402jobs-api/package.json` has **no** `packageManager` field today (Phase 30 may want to add one for consistency, or may leave it as-is since the Dockerfile is the only build path). Confirm with the user during planning.
- Both `vercel.json` files pin a different patch version (`9.12.1`) than this repo's `package.json` (`9.15.0`). After Phase 30 they should converge on the same `pnpm@10.x` pin.
- No `corepack prepare` invocations exist anywhere — the project uses the older `npm install -g pnpm@X` style. Phase 30 may want to adopt `corepack` (decision point for planner; not load-bearing).

### CI workflows

There are **no GitHub Actions workflows** in either repo:

| Path | Status |
|---|---|
| `/Users/rawgroundbeef/Projects/x402jobs/.github/workflows/` | exists but empty |
| `/Users/rawgroundbeef/Projects/x402jobs-api/.github/workflows/` | does not exist |

Implication for Phase 30: there is **no CI lane to break with `frozen-lockfile=true`** today. CI lanes are introduced for the first time in Phase 31 (`v3.0-MILESTONE-SCOPE.md:156` — "Unified GitHub Actions workflow"). Phase 30 only needs to verify that **the two deploy lanes** (Vercel for web, Railway via Dockerfile for api) succeed under pnpm 10. No CI matrix verification is required.

### `pnpm-workspace.yaml` and built-dep hooks

This repo's workspace (`/Users/rawgroundbeef/Projects/x402jobs/pnpm-workspace.yaml`):
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
No `ignoredBuiltDependencies` or `onlyBuiltDependencies` today.

Sibling api repo's workspace (`/Users/rawgroundbeef/Projects/x402jobs-api/pnpm-workspace.yaml`):
```yaml
ignoredBuiltDependencies:
  - isolated-vm
```
This is the **closest existing analog** to the `pnpm.onlyBuiltDependencies` allow-list Phase 30 will introduce. The api repo already knows it depends on `isolated-vm` (a sandbox lib that compiles native bindings) and explicitly opted out of running its build script. When migrating to pnpm 10's stricter approval-prompt model, this file is the canonical record of "we considered this build script and ignored it on purpose." The planner should:
1. Read `~/Projects/x402jobs-api/pnpm-workspace.yaml` first to know `isolated-vm` is intentionally skipped.
2. Decide whether the pnpm 10 allow-list lives in `pnpm-workspace.yaml` (workspace-level, current convention) or in root `package.json`'s `"pnpm.onlyBuiltDependencies"` (ROADMAP suggestion).
3. ROADMAP names `sharp`, `esbuild`, `better-sqlite3` as likely candidates; verify against actual deps in both repos before adding.

### `@x402jobs/*` scope usage (for `minimum-release-age-exclude`)

The ROADMAP proposes `minimum-release-age-exclude=@x402jobs/*` so internal packages bypass the 72-hour delay. Confirmed scope usage in this repo:

| Package | Name |
|---|---|
| `apps/web/package.json` | `@x402jobs/web` |
| `packages/sdk/package.json` | `@x402jobs/sdk` (published to npm: `0.2.2`) |
| `packages/ui/package.json` | `@x402jobs/ui` (private workspace dep) |

`apps/web/package.json:24` consumes `@x402jobs/ui` via `"workspace:*"` — so internal consumption already exists and **`minimum-release-age-exclude=@x402jobs/*` is non-trivial** (not just future-proofing). Without it, the 72-hour delay would block fresh `@x402jobs/sdk` installs in CI/dev.

The sibling api repo (`x402jobs-api`) does NOT use any `@x402jobs/*` packages (verified: name is `x402-jobs-api`, no scope). After Phase 31 merge, the api will be in-tree and `workspace:*` resolution makes the exclude moot for it — but during Phase 30 (still split), only the web side benefits from the exclude.

### Existing SECURITY policy docs

| Search | Result |
|---|---|
| `**/SECURITY.md` at repo root | does not exist |
| `docs/security.md` | does not exist |
| Any policy doc in `.planning/` | none (closest mention is `v3.0-MILESTONE-SCOPE.md:138` saying "Document the policy in SECURITY.md" as Phase 30 scope, and ROADMAP.md:453 saying "deferred to Phase 31 if SECURITY.md doesn't yet exist") |

**Greenfield.** Phase 30 must either (a) create a minimal `SECURITY.md` documenting the new release-age policy, or (b) defer to Phase 31 per ROADMAP.md:453. The `dep-audit.md` produced in Phase 28 is the closest content analog for "what a security doc looks like in this project," but its frontmatter and audience are different (one-shot audit log, not a published policy).

## Pattern Assignments

### 1. Root `package.json` — bump `packageManager`, add `pnpm.onlyBuiltDependencies`

**File:** `/Users/rawgroundbeef/Projects/x402jobs/package.json` (existing, 23 lines)
**Closest analog for the bump itself:** itself. The field already exists at line 19.

**Current shape (lines 16-23):**
```json
"devDependencies": {
  "turbo": "^2.3.0"
},
"packageManager": "pnpm@9.15.0",
"engines": {
  "node": ">=18"
}
```

**Closest analog for the `pnpm.onlyBuiltDependencies` block:** `~/Projects/x402jobs-api/pnpm-workspace.yaml` (only 2 lines, shown above). Same family of opt-in/opt-out hook for native-build deps; different location. The pattern to copy is the **discipline of listing each package explicitly with a one-line justification in a comment**, not the syntax.

**Action excerpt the planner should emit:**
```json
{
  "packageManager": "pnpm@10.x.y",
  "pnpm": {
    "onlyBuiltDependencies": [
      // populate after first install surfaces approval prompts; vet each
      // candidates per ROADMAP.md:447: sharp, esbuild, better-sqlite3
    ]
  }
}
```

### 2. Root `.npmrc` — NEW file

**File:** `/Users/rawgroundbeef/Projects/x402jobs/.npmrc`
**Analog:** **None.** No `.npmrc` exists at any level in either repo (verified by `Glob "**/.npmrc"` excluding node_modules → zero hits in both repos). This is greenfield.

**Convention check:** pnpm and npm both read `.npmrc` from the repo root. With workspaces, root is the canonical location; per-package `.npmrc` is rare and not used in this project. The planner should place it at the root of this repo (`/Users/rawgroundbeef/Projects/x402jobs/.npmrc`) and, after Phase 31 merge, the same file applies to the merged tree (no second copy needed in `apps/api/`).

**Contents per ROADMAP.md:448-451:**
```
minimum-release-age=4320
minimum-release-age-exclude=@x402jobs/*
frozen-lockfile=true
```

**Risk note for planner (no analog covers this):**
- `frozen-lockfile=true` in `.npmrc` applies to **every** `pnpm install` invocation including local dev. After regenerating `pnpm-lock.yaml`, every contributor's first install will fail loudly until they pull. This is desired for CI, abrasive for solo-dev. The planner should document the local-override (`pnpm install --no-frozen-lockfile` or `CI=false`) in the commit message or `SECURITY.md`.
- Vercel and Railway both already pass `--frozen-lockfile` explicitly (see `apps/web/vercel.json:3` and `Dockerfile:23`), so the `.npmrc` setting is belt-and-suspenders for the deploy lanes.

### 3. Regenerate root `pnpm-lock.yaml`

**File:** `/Users/rawgroundbeef/Projects/x402jobs/pnpm-lock.yaml` (currently 559 KB, `lockfileVersion: '9.0'`)
**Analog:** itself. pnpm 10 still emits `lockfileVersion: '9.0'` so the format should not change; only resolutions update. The planner should expect a **large diff** but should NOT diff line-by-line during review — confirm correctness via `pnpm install --frozen-lockfile` on a fresh clone instead.

The sibling api repo also has a `pnpm-lock.yaml` (190 KB, also `'9.0'`); Phase 30 must regenerate **both** independently while the repos are still split.

### 4. `~/Projects/x402jobs-api/Dockerfile` — bump `pnpm@9` to `pnpm@10.x`

**File:** `/Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile` (43 lines)
**Closest analog:** `apps/api-audit-tmp/Dockerfile` — **identical copy** in this repo (gitignored, audit snapshot). Same 43 lines, same pnpm@9 pin at line 15.

**Imports / install pattern** (`Dockerfile:14-23`):
```dockerfile
# Install pnpm 9
RUN npm install -g pnpm@9

WORKDIR /app

# Copy package files first for better caching
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile
```

**Pattern to copy:** keep the `npm install -g pnpm@<version>` two-step; do NOT switch to `corepack enable` in Phase 30 unless explicitly scoped. The COPY ordering (lockfile+package.json before `COPY . .`) is correct — preserves Docker layer cache. The `--frozen-lockfile` flag will be redundant once the root `.npmrc` ships post-Phase 31, but is load-bearing during Phase 30 since this repo's `.npmrc` does not yet apply to the sibling Dockerfile build context.

**Action for the planner:** change line 14-15 to `# Install pnpm 10` / `RUN npm install -g pnpm@10` (or pin a specific `10.x.y` for reproducibility — match whatever the planner pins in root `package.json`'s `packageManager` field).

### 5. `~/Projects/x402jobs-api/vercel.json` — bump `pnpm@9.12.1`

**File:** `/Users/rawgroundbeef/Projects/x402jobs-api/vercel.json`
**Analog:** `/Users/rawgroundbeef/Projects/x402jobs/apps/web/vercel.json` (this repo). Identical install command shape:

```json
{
  "version": 2,
  "installCommand": "npm install -g pnpm@9.12.1 && pnpm install --frozen-lockfile",
  "buildCommand": "turbo run build --filter=..."
}
```

**Pattern to copy:** update **both** `vercel.json` files in lockstep — bump the pnpm pin to match whatever the planner picks for `packageManager` (pin a specific `10.x.y`, not `pnpm@10`, because Vercel re-installs on every deploy and a floating major is a supply-chain risk).

**Note:** the sibling api repo deploys to **Railway via Dockerfile**, not Vercel — so why does it have a `vercel.json`? Likely vestigial or used for a docs preview. The planner should verify by reading `/Users/rawgroundbeef/Projects/x402jobs-api/vercel.json` and `railway.json` together (confirmed via Bash: `railway.json` exists, points at `Dockerfile`). If `vercel.json` is unused, Phase 30 may want to delete it instead of editing — flag this as a decision point for the user during planning.

### 6. `SECURITY.md` (root, this repo) — possibly defer

**File:** `/Users/rawgroundbeef/Projects/x402jobs/SECURITY.md` (does not exist)
**Analog:** **None in code.** Closest content analog is `.planning/phases/28-security-review/dep-audit.md` (frontmatter + severity-table format) but it's a phase artifact, not a published policy.

**Decision the planner must surface:**
- Option A: create a minimal `SECURITY.md` in Phase 30 documenting the release-age policy and the contact email for reports. Bare minimum: ~30 lines.
- Option B: defer to Phase 31 per ROADMAP.md:453. Phase 31's scope already names "SECURITY.md finalized and committed" (`v3.0-MILESTONE-SCOPE.md:159`).

Recommend Option B unless the user wants to publish the npmrc rationale immediately. There is no in-repo template to copy from either way; if creating in Phase 30, write from scratch and keep it short — Phase 31 will expand it.

## Shared Patterns

### Cross-repo split-tree edit cadence

**Source pattern:** `.planning/phases/28-security-review/28-09-PLAN.md:7-17` (the SSRF library migration plan).

This is the closest existing **process** analog for what Phase 30 needs: a single phase that edits code in `~/Projects/x402jobs-api/` and also in the planning-tree of `x402jobs`, with frontmatter listing both:

```yaml
files_modified:
  - ~/Projects/x402jobs-api/src/routes/upload.ts
  - ~/Projects/x402jobs-api/src/routes/images.ts
  - ~/Projects/x402jobs-api/src/routes/instant.ts
  - ~/Projects/x402jobs-api/src/lib/safe-fetch.ts
  - ~/Projects/x402jobs-api/src/lib/__tests__/safe-fetch.test.ts
  - ~/Projects/x402jobs-api/src/lib/http-client.ts
  - ~/Projects/x402jobs-api/src/lib/__tests__/http-client.test.ts
  - ~/Projects/x402jobs-api/package.json
  - .planning/phases/28-security-review/REVIEW.md
```

**Pattern to copy:**
1. List both-repo files in `files_modified` with the `~/Projects/x402jobs-api/` prefix for sibling files and `apps/...` / root paths for this-repo files. Do **not** prefix this-repo files with anything; they're CWD-relative.
2. Plan body must call out the repo switch explicitly. See `28-09-PLAN.md:75-86` — the `<interfaces>` block says "Current state (from CRIT-07-RESUMPTION.md…)" and lists files in the sibling repo with absolute paths. Phase 30 plans should do the same.
3. Each repo gets its own branch + PR. Plan 28-09 only touches one repo (`x402jobs-api`), but the same pattern scales: Phase 30 will likely produce one branch in this repo (root `package.json`, `.npmrc`, lockfile, `apps/web/vercel.json`) and one in the sibling repo (`Dockerfile`, `vercel.json`, lockfile). The planner should explicitly enumerate the **two branches and two PRs** in the plan's `<objective>` block.
4. Verification step: `cd ~/Projects/x402jobs-api && git status` clean before starting, and `git rev-parse --abbrev-ref HEAD` check after branch creation (see 28-09 Task 1, lines 100-128).

### Commit-and-verify cadence for dep version bumps

**Source:** `28-09-PLAN.md:100-128` (Task 1 "Pre-flight check + dependency audit").

Reusable shape:
```
1. cd ~/Projects/<repo> && git status # clean
2. git checkout main && git pull origin main
3. Baseline test/build snapshot: pnpm <build|test> 2>&1 | tee /tmp/<phase>-baseline.txt
4. Dependency audit: grep -E '"<dep>"' package.json | tee /tmp/<phase>-deps.txt
5. Create branch: git checkout -b <fix-or-chore>/<phase-slug>
```

Phase 30 should add a step 0 before all of this: `corepack prepare pnpm@10.x.y --activate` (or `npm install -g pnpm@10.x.y`) to ensure the **local pnpm matches** the new `packageManager` pin BEFORE running `pnpm install`. Otherwise pnpm 9 will refuse to install with a pnpm@10 `packageManager` field.

### "Update both pnpm pins in lockstep"

**Source pattern (anti-analog):** the existing drift between `package.json:19` (`pnpm@9.15.0`), `apps/web/vercel.json:3` (`pnpm@9.12.1`), `Dockerfile:15` (`pnpm@9` floating), and `~/Projects/x402jobs-api/vercel.json:3` (`pnpm@9.12.1`) is **the bug the project already has.** Four different pnpm 9 pins exist across the deploy lanes. Phase 30 should not just bump to 10.x; it should also **converge** all four pins on the same string.

The planner should add a verification step that greps for `pnpm@` across both repos after the bump and asserts only one version string appears (modulo the `pnpm@10` floating-major if that's the convention chosen for the Dockerfile).

## No Analog Found

| File | Role | Why no analog |
|---|---|---|
| Root `.npmrc` | config | No `.npmrc` exists anywhere in either repo (verified by glob). Greenfield. Use ROADMAP.md:448-451 as spec. |
| `SECURITY.md` | docs | No security/policy docs in either repo. If created in Phase 30, write from scratch. Recommend deferring to Phase 31 per ROADMAP.md:453. |
| `pnpm.onlyBuiltDependencies` block | config | The api repo's `pnpm-workspace.yaml` has `ignoredBuiltDependencies: [isolated-vm]` — adjacent concept (opt-out list, not opt-in allow-list) but not the same field. No exact analog. |

## Metadata

**Analog search scope:**
- This repo: `/Users/rawgroundbeef/Projects/x402jobs/` (root, `apps/`, `packages/`, `.planning/`, `.github/`)
- Sibling api repo: `/Users/rawgroundbeef/Projects/x402jobs-api/` (root, `src/`, `.github/`)
- Excluded: `node_modules/`, `**/.next/`, `pnpm-lock.yaml`

**Files scanned for pnpm/packageManager references:** all non-`node_modules` files (`Grep "pnpm@?\\d"` and `Grep "packageManager"`); only 4 hits in this repo + 2 in sibling, all enumerated above.

**Confirmed greenfield areas (no analog in either repo):**
- `.npmrc` (all paths)
- `SECURITY.md` / any security policy doc
- GitHub Actions workflows (only empty `.github/workflows/` dir in this repo; none in sibling)
- `corepack` usage anywhere

**Pattern extraction date:** 2026-05-14
