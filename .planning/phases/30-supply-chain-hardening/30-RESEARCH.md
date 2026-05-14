# Phase 30: Supply Chain Hardening - Research

**Researched:** 2026-05-14
**Domain:** Node.js package management (pnpm 9 → 10), supply-chain security (npm registry release-age policy), CI/CD platform compatibility (Vercel, Railway)
**Confidence:** HIGH for stack and pitfalls; MEDIUM for the Next.js + pnpm 10 workspace blocker (situation is in flight upstream)

## Summary

Phase 30 upgrades the x402.jobs monorepo from pnpm 9.15.0 to pnpm 10.33.4 and adds a root `.npmrc` with a 72-hour release-age policy that neutralizes most npm zero-days before they reach our installs. The core mechanics are well-understood and documented in pnpm's official release notes — the upgrade itself is mechanical.

The single material risk is **a known, unmerged Next.js bug** ([vercel/next.js#86841](https://github.com/vercel/next.js/issues/86841)) that breaks `next dev`/`next build` in pnpm workspaces under pnpm 10.7.0+. The fix ([PR #86845](https://github.com/vercel/next.js/pull/86845)) is OPEN, unmerged, and not in any 15.5.x release as of 2026-05-14. The web app currently runs Next.js 15.5.9 — well within the affected range. The planner must address this with one of three options: (a) pin pnpm to 10.6.x where the bug doesn't trigger, (b) use the upstream PR as a patch via `pnpm patch`, or (c) wait until the fix lands and retry. Option (a) is the safest immediate path.

Two repos are in scope: this repo (`x402jobs`, contains `apps/web` Next.js) and the sibling `x402jobs-api` repo at `/Users/rawgroundbeef/Projects/x402jobs-api/` (contains the Railway Dockerfile). The `apps/api-audit-tmp/` directory in this repo is a byte-identical snapshot of the live api repo and is NOT the live target — confirmed via `diff` of the Dockerfile.

**Primary recommendation:** Pin `packageManager` to `pnpm@10.6.5+sha512:zfko/KIIMs1Z7FOCZJK33CXcUk1DcLa0rb9lgD0y76psHIgUfArk6NV5psnuxxV1e1DU+jXuoXnYaOraTtBDrw==` (last pre-10.7.0 release, avoids the Next.js workspace bug). Add `.npmrc` with `minimum-release-age=4320`, `minimum-release-age-exclude=@x402jobs/*`, and explicit `onlyBuiltDependencies` allow-list of `esbuild`, `sharp`, `protobufjs`, `fsevents`, `bufferutil`, `utf-8-validate` (web) plus `isolated-vm` (api). Do NOT set `frozen-lockfile=true` in `.npmrc` — pnpm already enables it automatically in CI environments, and putting it in `.npmrc` will block the lockfile-regeneration step required during the upgrade itself.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Package resolution + install gating | Local dev + CI build environments | — | `minimum-release-age` is enforced at resolution time in the pnpm CLI; affects both `pnpm install` locally and CI/Vercel/Railway builds |
| Lifecycle script execution policy | Local dev + Docker build (Railway) + Vercel build | — | `onlyBuiltDependencies` is read by the pnpm CLI wherever `pnpm install` runs |
| Pnpm version pin distribution | `package.json#packageManager` field | Vercel `vercel.json` override (currently pins 9.12.1) | Vercel and Railway both honor `packageManager`, but the existing `apps/web/vercel.json` has a HARDCODED `pnpm@9.12.1` install command that overrides the field — this must be edited |
| Internal package exclusion from delay | `minimum-release-age-exclude` config | — | Pure resolution-time concern; no runtime impact |
| Supply-chain attack surface (delayed availability) | npm registry → pnpm resolver (4320min / 72h window) | — | The control plane is the pnpm CLI; the npm registry continues to serve all versions, pnpm just refuses to *resolve* to anything younger than 72h |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 10.6.5 (recommended pin) | Package manager | Pinning to 10.6.5 avoids the unmerged Next.js 15.5.x + pnpm 10.7.0+ ENOWORKSPACES bug while still gaining default-deny lifecycle script behavior (the headline pnpm 10 security feature). `[VERIFIED: npm view pnpm versions]` |
| pnpm | 10.33.4 (latest pnpm 10.x) | Alternative pin if Next.js patches first | Latest stable in the v10 channel as of 2026-05-14. Includes `minimum-release-age` (added in 10.16.0). `[CITED: https://pnpm.io/blog/releases/10.16]` |
| Node.js | 22 (current Dockerfile) / 22.19 (local) | Runtime | Already pinned to `node:22-slim` in api Dockerfile; pnpm 10 supports Node 18+. No change needed. `[VERIFIED: cat /Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile]` |
| corepack | 0.31.0+ | pnpm version distribution | Required for signature verification of pnpm@10.x downloads. Older corepack ships with `node:22-slim` versions and fails with "Cannot find matching keyid". `[CITED: https://vercel.com/kb/guide/corepack-errors-github-actions]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pnpm approve-builds` CLI | bundled w/ pnpm 10 | Interactive vetting of lifecycle scripts | Run once locally after upgrade; writes approved entries to `pnpm.onlyBuiltDependencies` in `package.json`. `[CITED: https://pnpm.io/cli/approve-builds]` |
| `pnpm patch` | bundled w/ pnpm 10 | Apply local patches to dependencies | Fallback option if the Next.js workspace bug forces a pnpm 10.7.0+ pin and the upstream fix is still unmerged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm 10.6.5 pin | pnpm 11.x (latest: 11.1.2) | pnpm 11 requires Node 22+ (we have it) and changes config storage from `package.json#pnpm` → `pnpm-workspace.yaml`. Also renames `onlyBuiltDependencies` → `allowBuilds`. **Mismatches the ROADMAP scope** which explicitly says "pnpm 10.x"; defer pnpm 11 to a future phase. `[CITED: https://pnpm.io/blog/releases/11.0]` |
| pnpm 10.6.5 pin | pnpm 10.33.4 (latest 10.x) | Latest is the obvious default, but it triggers the Next.js bug. Choose only if you also patch Next.js. |
| `corepack enable` in Dockerfile | `npm install -g pnpm@10` | npm install bypasses corepack's signature verification entirely — *less secure*, but simpler and immune to the keyid rotation problem. Current api Dockerfile uses `npm install -g pnpm@9`. Recommend STAYING with `npm install -g pnpm@10.6.5` for the Dockerfile to avoid corepack churn (the signature verification doesn't add security value in a controlled build environment where the image hash is the trust anchor). |
| `.npmrc` for pnpm config | `pnpm-workspace.yaml` settings block (pnpm 11 style) | `pnpm-workspace.yaml` would work today but the ROADMAP and pnpm 10 docs both use `.npmrc`. Stay with `.npmrc`; migrate when we move to pnpm 11. |

**Verification (run before locking versions):**

```bash
# Verify the recommended pnpm version pin
npm view pnpm@10.6.5 dist.integrity
# Expected: sha512-zfko/KIIMs1Z7FOCZJK33CXcUk1DcLa0rb9lgD0y76psHIgUfArk6NV5psnuxxV1e1DU+jXuoXnYaOraTtBDrw==
# [VERIFIED 2026-05-14 via npm view pnpm versions --json]

# Verify lockfile-compatible upgrade path
pnpm --version  # 9.15.0 today
```

## Architecture Patterns

### System Architecture Diagram

```
                            ┌───────────────────────────────────────┐
                            │ Developer machine                     │
                            │  - pnpm install (no frozen lockfile)  │
                            │  - pnpm approve-builds (one time)     │
                            │  - commits .npmrc + package.json      │
                            └────────────────┬──────────────────────┘
                                             │  git push
                            ┌────────────────┴──────────────────────┐
                            │ GitHub remote                         │
                            └─┬──────────────────────────┬──────────┘
                              │                          │
                              │ webhook                  │ webhook
                              ▼                          ▼
              ┌──────────────────────┐    ┌────────────────────────┐
              │ Vercel (web app)     │    │ Railway (api)          │
              │ reads:               │    │ reads:                 │
              │  - apps/web/         │    │  - Dockerfile          │
              │    vercel.json       │    │  - .npmrc (root)       │
              │    installCommand    │    │ runs:                  │
              │    [MUST EDIT]       │    │  pnpm install          │
              │  - .npmrc (root)     │    │   --frozen-lockfile    │
              │  - package.json      │    │  (env: CI=true → auto) │
              │    packageManager    │    │                        │
              │ resolves via         │    │ resolves via           │
              │ minimum-release-age  │    │ minimum-release-age    │
              └──────────────────────┘    └────────────────────────┘
                              │                          │
                              ▼                          ▼
                       npm registry                npm registry
                       (filters by >72h            (filters by >72h
                        publish age)                publish age)
```

Data flow: developer commits source + `package.json` + `.npmrc` + `pnpm-lock.yaml`. Each deploy platform reads the lockfile and resolves transitive dependencies against the npm registry, filtered by the release-age policy. Internal `@x402jobs/*` packages bypass the filter.

### Pattern 1: pnpm 10 default-deny lifecycle scripts

**What:** pnpm 10 blocks all `preinstall` / `install` / `postinstall` lifecycle scripts in dependencies unless the package name is listed in `pnpm.onlyBuiltDependencies` in `package.json`. `[CITED: https://github.com/pnpm/pnpm/releases/tag/v10.0.0]`

**When to use:** This is the default in pnpm 10 — there's no opt-in. The decision is *what to allow*, not *whether to enable*.

**UX on first install:**

Per [Socket's pnpm 10 writeup](https://socket.dev/blog/pnpm-10-0-0-blocks-lifecycle-scripts-by-default) and the [official approve-builds docs](https://pnpm.io/cli/approve-builds): install **completes successfully** with a warning. The exact message is:

```
Ignored build scripts: <pkg-a>, <pkg-b>, <pkg-c>.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Effect at runtime depends on the package:
- `sharp`: image processing breaks (Next.js Image optimization specifically). Build may succeed, runtime fails.
- `esbuild`: binary download fails → tsup/vite/Next.js native bundling broken. Hard fail on first use.
- `fsevents`: macOS file-watching fallback fails silently → slower dev mode on macOS, no functional break.
- `bufferutil` / `utf-8-validate`: optional WebSocket native extensions; pure-JS fallback works. No break.
- `isolated-vm` (api): hard fail — the package's whole purpose is the native binding.
- `protobufjs`: postinstall is a no-op shim in modern versions, but pnpm still warns about it.

**Example `package.json` block (root):**

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "esbuild",
    "sharp",
    "protobufjs",
    "fsevents",
    "bufferutil",
    "utf-8-validate"
  ]
}
```

The api repo's `package.json` already has `"onlyBuiltDependencies": ["isolated-vm"]` and needs only `esbuild` added (the api uses tsup which depends on esbuild).

**Vetting workflow:**

```bash
# 1. Upgrade pnpm and reinstall
corepack prepare pnpm@10.6.5 --activate   # or: npm install -g pnpm@10.6.5
rm -rf node_modules
pnpm install                              # surfaces "Ignored build scripts:" warning

# 2. Interactive approval
pnpm approve-builds
# Use SPACE to toggle, ENTER to confirm
# pnpm writes the approvals to package.json#pnpm.onlyBuiltDependencies

# 3. Verify the list matches research expectation
grep -A 10 '"pnpm"' package.json
```

### Pattern 2: `minimum-release-age` policy via `.npmrc`

**What:** pnpm refuses to *resolve* package versions newer than the configured number of minutes. The npm registry continues to serve all versions; pnpm filters at resolution time. `[CITED: https://pnpm.io/blog/releases/10.16]`

**When to use:** All package resolutions. Setting `minimum-release-age=4320` means "only versions published ≥72 hours ago are eligible for resolution." This neutralizes the majority of npm supply-chain attack patterns (publish-malicious → publish-fix → request-takedown) which are typically detected and removed within 24-48 hours.

**Unit and semantics:**
- Value is in **minutes**. `[CITED: https://pnpm.io/blog/releases/10.16]`
- `4320 minutes = 72 hours = 3 days` ✓ (matches ROADMAP intent)
- Applied at **resolution time**, not install time
- Per pnpm docs: "the setting applies to all dependencies, including transitive ones" and "blocks installation of versions that don't meet the age requirement, regardless of whether they're already in the lockfile" — **HOWEVER** [training data conflict]: in practice, the lockfile is the source of truth for `pnpm install --frozen-lockfile`. Frozen installs do NOT re-resolve, so already-locked packages younger than 72h are still installed. The release-age gate only kicks in when re-resolution happens (e.g., `pnpm update`, `pnpm add`, or `pnpm install` without frozen-lockfile after a `package.json` change). `[ASSUMED — needs empirical verification in a controlled test]`

**Exclude syntax:** `minimum-release-age-exclude` accepts package-name patterns:
- Exact: `webpack`
- Scope wildcard: `@myorg/*` ← this is what the ROADMAP wants for `@x402jobs/*`
- Specific version: `nx@21.6.5` or `webpack@4.47.0 || 5.102.1`

**Source:** [`https://pnpm.io/blog/releases/10.16`](https://pnpm.io/blog/releases/10.16) and [Thilo Maier's writeup](https://maier.tech/notes/pnpm-minimum-release-age).

### Pattern 3: Recommended `.npmrc` content

```ini
# Supply-chain hardening (Phase 30, 2026-05-14)
# 4320 minutes = 72 hours. Neutralizes most npm zero-days before they reach installs.
# Internal @x402jobs/* packages bypass the delay.
minimum-release-age=4320
minimum-release-age-exclude=@x402jobs/*

# DO NOT add frozen-lockfile=true here.
# pnpm auto-enables frozen-lockfile in CI environments (CI=true).
# Setting it in .npmrc would also enforce it locally, blocking developer workflows
# that need to update the lockfile (pnpm add, pnpm update).
# See: https://pnpm.io/cli/install (default: "For non-CI: false, For CI: true").
```

**Rationale for omitting `frozen-lockfile=true`:**

The ROADMAP includes `frozen-lockfile=true` in the proposed `.npmrc`. Research strongly recommends **dropping it**. Three reasons:

1. **It's already the default in CI** — pnpm uses `ci-info` to detect `CI=true`, `CONTINUOUS_INTEGRATION`, `BUILD_NUMBER`, `RUN_ID`. Both Vercel and Railway set `CI=true`. The behavior is automatic; the `.npmrc` line is redundant for CI safety. `[CITED: https://pnpm.io/cli/install]`
2. **It actively breaks developer workflows** — A developer running `pnpm add foo` locally would hit `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE`. They'd have to either `pnpm add foo --no-frozen-lockfile` every time or temporarily edit `.npmrc`. Friction without benefit.
3. **It blocks the Phase 30 upgrade itself** — The very first install under pnpm 10 will regenerate parts of the lockfile (peer-dep resolution hashes now use SHA256, see breaking changes). If `frozen-lockfile=true` is committed *before* the lockfile is regenerated, the upgrade install fails on every developer machine.

If the planner still wants the explicit signal in `.npmrc`, the **only** safe order is: regenerate lockfile under pnpm 10 → commit → THEN add `frozen-lockfile=true`. But it's better to drop it and let CI auto-detection handle it.

### Pattern 4: Railway Dockerfile diff (api repo)

**Current** (lives in `/Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile`):

```dockerfile
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y \
    python3 make g++ pkg-config libudev-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 9
RUN npm install -g pnpm@9

WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
```

**Proposed:**

```dockerfile
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y \
    python3 make g++ pkg-config libudev-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 10.6.5 (pre-10.7.0 to avoid the Next.js workspace bug in the
# merged repo path post-Phase 31; harmless for api-only builds today).
# Using direct npm install rather than corepack to sidestep signature
# verification churn — image hash is the trust anchor in CI.
RUN npm install -g pnpm@10.6.5

WORKDIR /app
COPY pnpm-lock.yaml package.json .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
```

Key diffs:
- `pnpm@9` → `pnpm@10.6.5`
- `COPY pnpm-lock.yaml package.json ./` → `COPY pnpm-lock.yaml package.json .npmrc ./` (need `.npmrc` in the build context for `onlyBuiltDependencies` and release-age gating; the api repo currently has no `.npmrc`, this phase adds one)

**Alternative corepack-based pattern** (NOT recommended for this phase due to keyid rotation risk in `node:22-slim`):

```dockerfile
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest \
 && corepack enable \
 && corepack prepare pnpm@10.6.5 --activate
```

`[CITED: https://pnpm.io/docker and https://github.com/payloadcms/payload/issues/11037 and https://vercel.com/kb/guide/corepack-errors-github-actions]`

### Pattern 5: Vercel handling

Vercel auto-selects pnpm version from `packageManager` field when present. `[CITED: https://vercel.com/changelog/automatic-pnpm-v10-support, 2025-02-28]`

**But:** `apps/web/vercel.json` currently hardcodes the install command:

```json
{
  "installCommand": "npm install -g pnpm@9.12.1 && pnpm install --frozen-lockfile",
  "buildCommand": "turbo run build --filter=@x402jobs/web..."
}
```

This **overrides** Vercel's auto-detection and must be edited as part of Phase 30. Proposed:

```json
{
  "installCommand": "npm install -g pnpm@10.6.5 && pnpm install --frozen-lockfile",
  "buildCommand": "turbo run build --filter=@x402jobs/web..."
}
```

Alternative: delete the `installCommand` entirely and let Vercel auto-detect from `packageManager`. Cleaner but loses explicit version control. **Recommend keeping explicit pin** because it forces the version to match the `packageManager` field, surfacing drift as a build error.

### Anti-Patterns to Avoid

- **`frozen-lockfile=true` in committed `.npmrc`:** Breaks local dev (see Pattern 3 rationale). pnpm already enforces it automatically when `CI=true`.
- **Bumping to pnpm 10.7.0+ without addressing the Next.js workspace bug** ([vercel/next.js#86841](https://github.com/vercel/next.js/issues/86841)): `next dev` and `next build` will fail in the web app. Bug is unmerged as of 2026-05-14.
- **Using `corepack prepare pnpm@10 --activate` in `node:22-slim` without first updating corepack:** Hits "Cannot find matching keyid" signature verification error. If using corepack, also `RUN npm install -g corepack@latest` first.
- **Forgetting to add `.npmrc` to the api Dockerfile COPY layer:** Without it in the build context, the release-age policy and `onlyBuiltDependencies` won't apply during the Railway build.
- **Setting `minimum-release-age` higher than ~10080 (1 week):** Increases the window where critical patches (especially security patches) are unavailable. 4320 (72h) is the sweet spot — long enough for malicious publishes to be detected and removed, short enough that real fixes propagate.
- **Adding `frozen-lockfile=true` to `.npmrc` BEFORE regenerating the lockfile under pnpm 10:** The upgrade install itself will fail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Block packages younger than X days from being installed" | Custom registry proxy, install-time hash check, GitHub Actions step that scans dates | `minimum-release-age=4320` in `.npmrc` | pnpm enforces this at resolution time across all platforms (local, Vercel, Railway) for free |
| "Block dependency install scripts from running" | preinstall hook scanning, postinstall blockers, custom container sandboxing | pnpm 10's default-deny + `onlyBuiltDependencies` allow-list | This is the headline pnpm 10 feature; built-in, audited, well-tested |
| "Detect which deps need install scripts on first run" | Grep through node_modules, parse package.json for postinstall scripts | `pnpm approve-builds` interactive command | Generates the allow-list from actual install attempts, writes to `package.json` |
| "Lockfile drift detection in CI" | Custom CI step comparing lockfile hashes, `git diff` checks | pnpm's automatic CI detection — runs `--frozen-lockfile` whenever `CI=true` | No config needed; CI fails build if lockfile is stale |
| "Bypass release-age for our own packages" | Custom registry config, separate scoped registry | `minimum-release-age-exclude=@x402jobs/*` | Built-in scope pattern matching |

**Key insight:** Phase 30 is *almost entirely a configuration change*. The supply-chain hardening primitives (release-age gate, lifecycle-script allow-list, lockfile-frozen-in-CI) are all built into pnpm 10. The only "code" being written is `.npmrc`, a few-line `package.json` edit, and a 1-line Dockerfile diff.

## Runtime State Inventory

> Phase 30 is a build-time / config change, not a runtime refactor. There is no stored data, live service config, OS-registered state, or build artifact that embeds the pnpm version in a runtime-meaningful way. The closest analog is the local `node_modules/` and pnpm content-addressable store, which is rebuilt on the first install.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — pnpm version is not embedded in any database, KV store, or persisted state. | None |
| Live service config | **Vercel project settings** — Vercel auto-detects from `packageManager`, BUT `apps/web/vercel.json` has a hardcoded `npm install -g pnpm@9.12.1` install command that takes precedence. Vercel build will continue to use 9.12.1 until this file is edited. | Edit `apps/web/vercel.json` install command |
| Live service config | **Railway project settings** — No Railway-side pnpm config; the Dockerfile is the entire spec. `railway.json` only sets healthcheck path and restart policy. | None at the Railway-platform level (Dockerfile edit handles it) |
| OS-registered state | None — pnpm itself is installed per-image / per-developer-machine; no system-level registrations. | None |
| Secrets / env vars | None — no env var encodes a pnpm version that code reads. `CI=true` is set automatically by Vercel and Railway and triggers pnpm's CI-mode behavior (auto frozen-lockfile). | None |
| Build artifacts | `node_modules/` and pnpm content store will be regenerated on first install under pnpm 10. The `pnpm-lock.yaml` v9.0 format is forward-compatible with pnpm 10 (pnpm 10 doesn't bump `lockfileVersion`), but will likely have *some* internal changes due to SHA256 peer-dep hash migration. | First `pnpm install` under pnpm 10 will produce a modified lockfile — commit the change |

**Verified by:** `grep -r "pnpm@9" .` and inspection of `vercel.json`, `railway.json`, and both `package.json` files.

## Common Pitfalls

### Pitfall 1: Next.js 15.5.x + pnpm 10.7.0+ ENOWORKSPACES on `next dev` / `next build`

**What goes wrong:** `pnpm dev` and `pnpm build` for `@x402jobs/web` fail with:

```
npm error code ENOWORKSPACES
npm error This command does not support workspaces.
```

The error originates in Next.js's `getRegistry()` helper which calls `pnpm config get registry` to download the SWC binary. Since pnpm 10.7.0, pnpm internally falls back to npm for `config` commands, and npm rejects `config` in workspace context without `--no-workspaces`. Next.js doesn't pass `--no-workspaces` for pnpm.

**Why it happens:** Confirmed by reading `packages/next/src/lib/helpers/get-registry.ts` at tag `v15.5.18`:

```ts
const resolvedFlags = pkgManager === 'npm' ? '--no-workspaces' : ''
```

The `pnpm` branch is empty. `[VERIFIED via gh api repos/vercel/next.js/contents/...?ref=v15.5.18]`

**How to avoid:** Three options, in order of recommendation:

1. **Pin pnpm to 10.6.5** (last pre-10.7.0). This is the simplest workaround. Still gets all the supply-chain hardening features (release-age and lifecycle-script allow-list landed in 10.0.0 and 10.16.0 respectively; both well below 10.7.0). Downside: missing a few months of pnpm 10 patch releases.
2. **Use `pnpm patch` to apply [PR #86845](https://github.com/vercel/next.js/pull/86845)'s diff locally.** Adds maintenance burden — patch must be revisited when Next.js ships the fix or when upgrading Next.js. Not recommended unless option 1 is rejected.
3. **Pin Next.js to a version <15.5.7** where the issue is presumed not to manifest. Currently on 15.5.9, so this means downgrade. Not recommended — loses ongoing security fixes.

**Warning signs:** Run `cd apps/web && pnpm dev` after the upgrade. Failure with the ENOWORKSPACES string is the canonical signal.

**Live status as of 2026-05-14:** PR #86845 has `state: OPEN`, `mergedAt: null` per `gh pr view`. Re-check before plan execution; if merged and shipped in a 15.5.x release, prefer pinning to that version + latest pnpm 10.x.

### Pitfall 2: Corepack signature verification fails in `node:22-slim`

**What goes wrong:** `corepack prepare pnpm@10.x --activate` fails with `Cannot find matching keyid`.

**Why it happens:** The `corepack` version shipped with `node:22-slim` images predates the npm registry signing key rotation. pnpm 9.15.4+ and all 10.x are signed with the new key. `[CITED: https://github.com/payloadcms/payload/issues/11037]`

**How to avoid:**
- **Easiest:** Don't use corepack in the Dockerfile. Stick with `RUN npm install -g pnpm@10.6.5`. The current Dockerfile already does `npm install -g pnpm@9`; staying with that pattern is the minimum-change path.
- **If corepack is required:** Update corepack first: `RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@10.6.5 --activate`.
- **Last resort:** `ENV COREPACK_INTEGRITY_KEYS=0` to bypass signature verification — **NOT recommended**, defeats the point.

**Warning signs:** Railway build fails immediately after the pnpm install step. Local Docker builds reproduce.

### Pitfall 3: `vercel.json` override silently shadows `packageManager` field

**What goes wrong:** The team bumps `packageManager` in root `package.json` to `pnpm@10.6.5`, deploys to Vercel, and Vercel still uses pnpm 9.12.1.

**Why it happens:** `apps/web/vercel.json` contains an explicit `installCommand` that takes priority over Vercel's auto-detection:

```json
"installCommand": "npm install -g pnpm@9.12.1 && pnpm install --frozen-lockfile"
```

**How to avoid:** Edit `apps/web/vercel.json` in the same commit that edits root `package.json`. Don't trust auto-detection while this file exists.

**Warning signs:** Vercel build logs show `pnpm@9.12.1` in the "Detected `pnpm` version" header. Catch in the deploy preview before merge.

### Pitfall 4: Adding `frozen-lockfile=true` to `.npmrc` before regenerating the lockfile

**What goes wrong:** Developer pulls the Phase 30 branch, runs `pnpm install`, gets `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE`. Cannot proceed without `--no-frozen-lockfile`.

**Why it happens:** pnpm 10 may produce minor lockfile diffs (peer-dep hashes migrated MD5→SHA256, store version v10, side-effects cache restructured). If `.npmrc` is committed with `frozen-lockfile=true` before the lockfile is regenerated under pnpm 10, every install fails.

**How to avoid:** Drop `frozen-lockfile=true` from `.npmrc` entirely. pnpm enables it automatically when `CI=true`. The CI safety the ROADMAP wants is already automatic.

If the team insists on the explicit signal, the only safe order is:
1. Bump `packageManager` to `pnpm@10.6.5` in `package.json`
2. Run `pnpm install` (regenerates lockfile)
3. Commit `package.json` + `pnpm-lock.yaml`
4. **Then** add `.npmrc` with `frozen-lockfile=true`

### Pitfall 5: Forgetting that `pnpm@9.12.1` is hardcoded in `apps/web/vercel.json` AND `pnpm@9` is hardcoded in api `Dockerfile`

**What goes wrong:** The team only bumps `packageManager` and ships, expecting Vercel and Railway to pick it up automatically. They don't.

**Why it happens:** Both deploy platforms have explicit version overrides that pre-date Phase 30:
- `apps/web/vercel.json` → `npm install -g pnpm@9.12.1` (installCommand override)
- `/Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile` → `npm install -g pnpm@9` (RUN line)

**How to avoid:** Phase 30 plan must include explicit edits to BOTH override sites, not just root `package.json`. Add a verification task: `grep -rn "pnpm@9" /path` after edits to find any stragglers.

**Warning signs:** `grep -rn "pnpm@9" /Users/rawgroundbeef/Projects/x402jobs/` returns matches after the upgrade commit.

### Pitfall 6: `apps/api-audit-tmp/` mistaken for the live api source

**What goes wrong:** Planner generates tasks pointing at `apps/api-audit-tmp/` instead of `/Users/rawgroundbeef/Projects/x402jobs-api/`. The audit-tmp directory is a snapshot from a prior phase, not the live repo Railway deploys from.

**Why it happens:** The directory exists in this repo's tree under `apps/`. Its `Dockerfile` is byte-identical to the live one. Surface-level reading suggests it's the canonical api source.

**How to avoid:** Phase 30 plan must explicitly note: "API repo source of truth = `/Users/rawgroundbeef/Projects/x402jobs-api/` (sibling repo). `apps/api-audit-tmp/` is read-only audit reference; do NOT edit it as part of this phase." Phase 31 will merge.

**Verified:** `diff /Users/rawgroundbeef/Projects/x402jobs/apps/api-audit-tmp/Dockerfile /Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile` returns no output (files identical).

## Code Examples

### Example 1: Final root `.npmrc` (NEW file)

```ini
# Supply-chain hardening — Phase 30 (2026-05-14)
# Documentation: SECURITY.md (or .planning/v3.0-MILESTONE-SCOPE.md until SECURITY.md lands in Phase 31)

# Reject npm package versions less than 72 hours old at resolution time.
# Most malicious npm publishes are detected and removed within 24-48 hours,
# so a 72-hour delay neutralizes the bulk of supply-chain zero-days.
# Source: https://pnpm.io/blog/releases/10.16
minimum-release-age=4320

# Exclude our internal workspace scope from the delay so internal package
# bumps don't have to wait 72 hours.
minimum-release-age-exclude=@x402jobs/*

# frozen-lockfile is intentionally OMITTED here.
# pnpm enables it automatically when CI=true (Vercel and Railway both set CI=true).
# Adding it to .npmrc would block local developer workflows like `pnpm add`.
# See: https://pnpm.io/cli/install
```

### Example 2: Root `package.json` diff

```diff
 {
   "name": "x402jobs",
   "version": "0.0.0",
   "private": true,
   "workspaces": ["apps/*", "packages/*"],
   "scripts": {
     "build": "turbo run build",
     "dev": "turbo run dev",
     "lint": "turbo run lint",
     "typecheck": "turbo run typecheck",
     "clean": "turbo run clean && rm -rf node_modules"
   },
   "devDependencies": {
     "turbo": "^2.3.0"
   },
-  "packageManager": "pnpm@9.15.0",
+  "packageManager": "pnpm@10.6.5",
+  "pnpm": {
+    "onlyBuiltDependencies": [
+      "esbuild",
+      "sharp",
+      "protobufjs",
+      "fsevents",
+      "bufferutil",
+      "utf-8-validate"
+    ]
+  },
   "engines": {
     "node": ">=18"
   }
 }
```

> **Note:** The `packageManager` field accepts an optional `+sha512:...` hash suffix for integrity verification under corepack. The verified hash for 10.6.5 is `sha512-zfko/KIIMs1Z7FOCZJK33CXcUk1DcLa0rb9lgD0y76psHIgUfArk6NV5psnuxxV1e1DU+jXuoXnYaOraTtBDrw==`. Recommend OMITTING the suffix because (a) Vercel and Railway don't go through corepack in our setup, (b) the api Dockerfile uses `npm install -g pnpm@10.6.5` directly, (c) the hash would need updating on every pnpm patch bump. The `packageManager` field is a soft signal in our setup, not the hard pin.

### Example 3: `apps/web/vercel.json` diff

```diff
 {
   "version": 2,
-  "installCommand": "npm install -g pnpm@9.12.1 && pnpm install --frozen-lockfile",
+  "installCommand": "npm install -g pnpm@10.6.5 && pnpm install --frozen-lockfile",
   "buildCommand": "turbo run build --filter=@x402jobs/web..."
 }
```

### Example 4: api Dockerfile diff (cross-repo, lives in `/Users/rawgroundbeef/Projects/x402jobs-api/Dockerfile`)

```diff
 # Use Node 22 as the base image
 FROM node:22-slim AS base

 # Install system dependencies
 RUN apt-get update && apt-get install -y \
     python3 \
     make \
     g++ \
     pkg-config \
     libudev-dev \
     curl \
     && rm -rf /var/lib/apt/lists/*

-# Install pnpm 9
-RUN npm install -g pnpm@9
+# Install pnpm 10.6.5 — pinned pre-10.7.0 to avoid Next.js workspace bug
+# in the merged repo (Phase 31). Harmless here today but ensures the api
+# repo's Dockerfile is compatible with the future merged layout.
+RUN npm install -g pnpm@10.6.5

 WORKDIR /app

-# Copy package files first for better caching
-COPY pnpm-lock.yaml package.json ./
+# Copy package files + .npmrc first for better caching
+COPY pnpm-lock.yaml package.json .npmrc ./

 # Install dependencies
 RUN pnpm install --frozen-lockfile

 COPY . .
 RUN pnpm build
```

### Example 5: api `package.json` diff (cross-repo)

```diff
   "pnpm": {
     "onlyBuiltDependencies": [
+      "esbuild",
       "isolated-vm"
     ]
   }
```

(api already has `isolated-vm`; needs `esbuild` added because `tsup` depends on esbuild and the postinstall installs the platform binary.)

### Example 6: Verification commands after upgrade

```bash
# Local: confirm version
pnpm --version  # expect 10.6.5

# Confirm install works clean
rm -rf node_modules
pnpm install
# expect: NO "Ignored build scripts:" warning IF onlyBuiltDependencies covers everything
# expect: "Lockfile is up to date, resolution step is skipped"

# Test web app build
pnpm --filter @x402jobs/web build
# If this fails with ENOWORKSPACES → Next.js bug bit us, fall back to pnpm 10.6.5

# Test api repo build (cross-repo)
cd /Users/rawgroundbeef/Projects/x402jobs-api
pnpm --version  # expect 10.6.5 after upgrade there too
pnpm install
pnpm build

# Verify release-age policy is loaded
pnpm config get minimum-release-age  # expect: 4320

# Confirm no pnpm@9 references remain
cd /Users/rawgroundbeef/Projects/x402jobs
grep -rn "pnpm@9" --include="*.json" --include="Dockerfile" --include=".npmrc" .
# expect: no matches (after both repos updated)
```

### Example 7: Rollback procedure (if pnpm 10 breaks CI)

Time-to-revert: ~5 minutes. Single revert commit on each repo.

```bash
# In x402jobs repo
git revert <phase-30-commit-hash>
# Reverts package.json (back to pnpm@9.15.0), apps/web/vercel.json,
# and deletes .npmrc.
# Lockfile reverts automatically.
git push

# In x402jobs-api repo
git revert <phase-30-commit-hash>
# Reverts Dockerfile to pnpm@9.
# Vercel and Railway redeploy on push; both back on pnpm 9 within ~3 minutes.
```

If the lockfile was regenerated under pnpm 10 and the revert leaves it in a slightly altered form, pnpm 9.15.0 should still accept the v9.0 lockfile (forward-compatible). If it doesn't, `pnpm install` on pnpm 9 will regenerate; `pnpm install --frozen-lockfile` may fail and need a manual `pnpm install` first.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pnpm 9.x — lifecycle scripts run by default | pnpm 10.x — default-deny via `onlyBuiltDependencies` | pnpm 10.0.0 (2025-01) | Every project upgrading hits a one-time "vet your scripts" step; once configured, ongoing security improvement is automatic |
| Hand-rolled release-age policies (custom registries, CI dep-age checks) | `minimum-release-age` in `.npmrc` | pnpm 10.16.0 (2025-08) | Universal, resolution-time, free |
| Corepack `--activate` as the recommended pnpm install path | Mixed — npm install for Docker, corepack for dev | Ongoing (2024-2026) corepack keyid rotation issues | Direct `npm install -g pnpm@X` is more reliable in CI |
| pnpm config in `package.json#pnpm` and `.npmrc` (split) | All pnpm config in `pnpm-workspace.yaml` (camelCase) | pnpm 11.0.0 (2026-Q1) | pnpm 10 still supports the old split layout — defer migration to a future phase |
| `onlyBuiltDependencies` + `neverBuiltDependencies` (separate keys) | Unified `allowBuilds` map | pnpm 11.0.0 | pnpm 10 keeps the old keys; no migration burden for Phase 30 |

**Deprecated / outdated relative to pnpm 10:**

- **Setting `npm_config_*` env vars to override pnpm config:** pnpm 11 dropped reading these. Already removed in pnpm 10 for some config keys. Don't introduce new uses.
- **`build-from-source` for prebuilt-binary packages:** `sharp` 0.34.x uses `@img/sharp-*` prebuilt binaries — no compile step needed on supported platforms. Still has an `install` script as a fallback. Listing `sharp` in `onlyBuiltDependencies` covers both paths.
- **`canvas` for image rendering:** Not in our deps tree — confirmed via grep. No action needed.
- **`bcrypt` / `argon2` native bindings:** Not in our deps tree — confirmed. No action needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `minimum-release-age` does NOT gate already-locked entries when running `pnpm install --frozen-lockfile` (it only gates resolution). I derived this from pnpm's general resolution-vs-install separation, not from explicit docs. | Pattern 2 | If wrong, the very first install under pnpm 10 against the existing lockfile could fail because some currently-locked packages were published <72h before today. **Mitigation:** check the install actually completes during the upgrade; if not, the workaround is to bump `pnpm-lock.yaml` timestamps via a full re-resolve (`pnpm install --no-frozen-lockfile`) ONCE, then apply the policy. Low likelihood given lockfile is months old. |
| A2 | `protobufjs@7.4.0`'s `postinstall` is a no-op in modern versions and will warn but not break if not in `onlyBuiltDependencies`. | Pattern 1 | If wrong (script does something load-bearing), pnpm install completes with a warning but some Solana / Solana wallet adapter functionality breaks at runtime. **Mitigation:** add `protobufjs` to `onlyBuiltDependencies` proactively (already in the recommended list). Cost is zero, value is closing the unknown. |
| A3 | The Next.js workspace bug ([vercel/next.js#86841](https://github.com/vercel/next.js/issues/86841)) does NOT trigger on pnpm 10.6.x (pre-10.7.0). The bug report's root-cause description blames pnpm 10.7.0's switch to npm-fallback for `config get`. | Pitfall 1 | If wrong (bug exists in 10.6.x too), pinning to 10.6.5 won't help and we'll need patch-based or downgrade-based mitigation. **Mitigation:** verify by running `pnpm@10.6.5 install` and `next dev` in `apps/web` before merging Phase 30. |
| A4 | Vercel still respects `apps/web/vercel.json` `installCommand` over the root `packageManager` field. Behavior is documented at [vercel.com/docs](https://vercel.com/docs/package-managers) but the exact precedence ordering is not explicit. | Pitfall 3 | If wrong (auto-detect wins), the vercel.json edit is harmless but unnecessary. Low risk. |
| A5 | The 4320-minute (72-hour) value is the right tradeoff between security and freshness. ROADMAP says "neutralizes most npm zero-days". The pnpm 11 default is 1440 (24h); 4320 is 3x that. | Pattern 3 | If wrong (too long), security patches are delayed by up to 3 days. If too short, undetected malicious packages slip through. **Mitigation:** start at 4320; revisit after first quarter of operating experience. The `minimum-release-age-exclude` mechanism is the escape hatch for urgent fixes — add `pkg@version` to the exclude list if a specific patch needs to be pulled in immediately. |
| A6 | Switching from `npm install -g pnpm@9` to `npm install -g pnpm@10.6.5` in the Dockerfile is sufficient; no `corepack` setup, no `PNPM_HOME` env var. | Pattern 4 | Low risk — the existing Dockerfile already uses this exact pattern at pnpm 9. The change is purely the version pin. |

## Open Questions (RESOLVED)

1. **Does pnpm 10 actually regenerate any of the existing `pnpm-lock.yaml`?**
   - What we know: lockfile format `9.0` is forward-compatible with pnpm 10. pnpm 10 does NOT bump to `lockfileVersion: '10.0'`. Peer-dep hashes internally migrated MD5→SHA256.
   - What's unclear: whether the first `pnpm install` will produce a meaningfully altered lockfile that we should commit, or if it'll be byte-identical.
   - **RESOLVED:** Addressed operationally by plan 30-01 T3 — the regen runs in a clean environment before any `.npmrc` exists, and the SUMMARY records the lockfile diff size. If the diff is non-trivial it ships in the same commit. No further pre-execution dry run needed.

2. **Is the existing lockfile new enough that no transitive deps will trip the 72-hour release-age gate on the very first install?**
   - What we know: lockfile was last touched on or before 2026-05-13 (the most recent commit pre-dating Phase 30 research). 72h ago = 2026-05-11.
   - What's unclear: whether any transitive bump in the last 72h before Phase 30 lands would trigger a re-resolve.
   - **RESOLVED:** Plan 30-04 T2 follows the safer option (b) — `.npmrc` lands AFTER lockfile is already regenerated in 30-01, then a second `pnpm install` empirically tests gate behavior with three documented acceptable outcomes (A/B/C) and two failure modes (F1/F2). No date-based delay required.

3. **Does the pnpm-lock.yaml in api repo need the same regeneration?**
   - What we know: api repo has its own pnpm-lock.yaml with same v9.0 format. Already has `isolated-vm` in `onlyBuiltDependencies` (so the team has already encountered pnpm 10 behavior on something).
   - What's unclear: whether the api repo has been run under pnpm 10 yet, or if the `onlyBuiltDependencies` block was set defensively.
   - **RESOLVED:** Plan 30-03 T3 regenerates the api lockfile under pnpm 10.6.5 with a fresh `node_modules` install. Assume worst case (never run under pnpm 10) — the plan handles it.

4. **Should we drop the Dockerfile's `python3 make g++ pkg-config libudev-dev` system packages now that we're hardening installs?**
   - What we know: Those packages are present because `isolated-vm` (and historically maybe others) need native compilation. Under pnpm 10 with explicit `onlyBuiltDependencies`, only listed packages compile; the system packages remain a build-time-only attack surface.
   - What's unclear: whether `isolated-vm` ships prebuilt binaries for `linux-x64` (Debian slim) for its current 6.1.2 version, which would let us drop the toolchain.
   - **RESOLVED:** Explicitly deferred — out of scope for Phase 30 (documented in 30-03 plan body). File as future cleanup; only relevant if image size or build time becomes an issue.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All builds | ✓ | v22.19.0 (local) / v22-slim (Docker) | — |
| npm | pnpm bootstrap | ✓ | bundled with Node 22 | — |
| pnpm 9.x | Current state | ✓ | 9.15.0 (local) | — |
| pnpm 10.6.5 | Target state | ✗ | needs install | `npm install -g pnpm@10.6.5` |
| corepack | Optional alternative install path | ✗ | not in local PATH (`command -v corepack` returns nothing); ships with Node 22 but disabled by default | Use `npm install -g pnpm@10.6.5` directly (recommended anyway) |
| Docker | Local api Dockerfile testing | ✓ assumed | not verified for this research | — |
| Sibling `x402jobs-api` repo | Cross-repo Dockerfile edit | ✓ | at `/Users/rawgroundbeef/Projects/x402jobs-api/` | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `corepack` is missing from PATH but unnecessary — direct `npm install -g pnpm@10.6.5` is the recommended approach for our setup.

## Validation Architecture

> nyquist_validation is NOT explicitly set in `.planning/config.json` — config keys present are `mode`, `parallelization`, `created`, `granularity`. Per researcher contract: "If the key is absent, treat as enabled." Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None at the monorepo level; web app has no test setup; api has vitest 2.1.8 |
| Config file | api: `/Users/rawgroundbeef/Projects/x402jobs-api/vitest.config.ts` (cross-repo) |
| Quick run command | `pnpm --filter @x402jobs/web typecheck` (web) / `cd ../x402jobs-api && pnpm typecheck` (api) |
| Full suite command | `pnpm typecheck && pnpm lint && pnpm --filter @x402jobs/web build` (web side) |
| Phase 30 validation | This phase is config-only. Validation is "does install + build + dev still work?" not "do unit tests pass?" |

### Phase Requirements → Test Map

Phase 30 has no formal REQ-XX IDs in ROADMAP.md beyond the bulleted Success Criteria. Mapping the SCs:

| SC# | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC1 | "Both apps build cleanly under pnpm 10" — web | smoke | `pnpm --filter @x402jobs/web build` | yes (Next.js build command) |
| SC1 | "Both apps build cleanly under pnpm 10" — api | smoke | `cd /Users/rawgroundbeef/Projects/x402jobs-api && pnpm build` | yes (tsup config) |
| SC2 | "Root `.npmrc` is in place with the documented release-age policy" | unit-ish | `test "$(pnpm config get minimum-release-age)" = "4320"` | will exist after Phase 30 |
| SC3 | "`pnpm.onlyBuiltDependencies` allow-list contains only vetted entries; install completes without unapproved lifecycle scripts" | smoke | `rm -rf node_modules && pnpm install 2>&1 \| grep -i "ignored build" && exit 1 \|\| exit 0` | runtime check |
| SC4 | "Railway deploy of `x402jobs-api` succeeds on pnpm 10" | manual (Railway-side) | Push to api repo main; check Railway deploy logs for `pnpm 10.6.5` and successful build | manual |
| SC5 | "Vercel deploy of `x402jobs` web app succeeds on pnpm 10" | manual (Vercel-side) | Push to x402jobs repo on a preview branch; check Vercel deploy logs | manual |
| SC6 | "CI green on both repos" | smoke | N/A — neither repo has CI workflows. The deploy platforms (Vercel + Railway) ARE the CI. | n/a |

### Sampling Rate
- **Per task commit:** `pnpm --filter @x402jobs/web typecheck` (~5s, validates web compiles)
- **Per wave merge:** `pnpm install && pnpm --filter @x402jobs/web build && (cd ../x402jobs-api && pnpm install && pnpm build)` (~60-90s, validates both apps build)
- **Phase gate:** Successful deploy preview on Vercel (web) AND successful deploy on Railway (api)

### Wave 0 Gaps

- [ ] No automated CI workflow exists. Recommend deferring CI creation to Phase 31 (monorepo merge) per the v3.0 milestone scope. Phase 30 validates via deploy-preview only.
- [ ] No script to verify `.npmrc` is loaded. Add `pnpm config get minimum-release-age` to the verification commands in Phase 30 plans.

## Security Domain

> `security_enforcement` is not in `.planning/config.json`. Per researcher contract: "absent = enabled." Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Documented in `.planning/v3.0-MILESTONE-SCOPE.md` Phase 30 section; this phase is a defense-in-depth layer |
| V2 Authentication | no | Build-tooling phase, no auth surface change |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no | n/a (no user-facing surface change) |
| V6 Cryptography | yes (indirect) | pnpm uses SHA256 for integrity verification of package tarballs; corepack uses signed-version verification of pnpm itself. We rely on pnpm's built-in primitives. |
| V14 Configuration | yes | `.npmrc` and `package.json#pnpm` ARE the security configuration delivered by this phase |

### Known Threat Patterns for {npm package ecosystem}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| npm zero-day (compromise-then-publish) | Tampering | `minimum-release-age=4320` — packages published <72h ago cannot be resolved |
| Lifecycle-script-based attack (postinstall RAT) | Tampering, Elevation of Privilege | pnpm 10 default-deny + `onlyBuiltDependencies` allow-list |
| Lockfile poisoning (resolved URL or integrity hash swap) | Tampering | `frozen-lockfile` (auto-enabled in CI via `CI=true`); lockfile in git history; PR review catches integrity hash changes |
| Dependency confusion (typosquat / scope hijack) | Spoofing | Lockfile pins exact resolved name; `@x402jobs/*` namespace squat protection is purchased by publishing scope on npm (separate concern, out of Phase 30 scope) |
| Tarball integrity bypass | Tampering | pnpm verifies SHA512 integrity from lockfile on every install |
| Compromised pnpm release itself | Tampering, Spoofing | `packageManager` field with `+sha512:...` hash (optional, decided NOT to use per Pattern 2 note); corepack signature verification (also decided NOT to use per Pattern 4); reliance on npm registry's signing infrastructure |
| Internal package supply-chain risk | Tampering | `@x402jobs/*` packages bypass the release-age gate via `minimum-release-age-exclude`; we control these packages directly |

**Out of scope for Phase 30 (file for Phase 31 or later):**
- `dependabot.yml` config — automated dependency-update PRs
- `pnpm audit` integration into a pre-merge gate
- `socket.dev` or similar SCA tooling
- Sigstore signing of internal `@x402jobs/*` package publishes

## Sources

### Primary (HIGH confidence)

- [pnpm 10.0.0 GitHub release notes](https://github.com/pnpm/pnpm/releases/tag/v10.0.0) — breaking changes, default-deny lifecycle scripts
- [pnpm 10.16 release blog post](https://pnpm.io/blog/releases/10.16) — `minimumReleaseAge` introduction, exact units (minutes)
- [pnpm 11.0 release blog post](https://pnpm.io/blog/releases/11.0) — confirmation that pnpm 10 still uses `onlyBuiltDependencies` and `.npmrc` (not renamed until pnpm 11)
- [pnpm settings docs](https://pnpm.io/settings) — `minimumReleaseAge`, `minimumReleaseAgeExclude` pattern syntax
- [pnpm cli install docs](https://pnpm.io/cli/install) — `--frozen-lockfile` default behavior (false locally, true in CI)
- [pnpm cli approve-builds docs](https://pnpm.io/cli/approve-builds) — vetting workflow
- [pnpm docker docs](https://pnpm.io/docker) — canonical Dockerfile pattern with cache mount
- [pnpm supply-chain-security docs](https://pnpm.io/supply-chain-security) — `minimumReleaseAge`, `allowBuilds`, `blockExoticSubdeps`
- [Vercel automatic pnpm v10 support changelog](https://vercel.com/changelog/automatic-pnpm-v10-support) — 2025-02-28 launch
- [Vercel package managers docs](https://vercel.com/docs/package-managers) — auto-detection rules
- [Vercel corepack errors KB](https://vercel.com/kb/guide/corepack-errors-github-actions) — corepack ≥0.31.0 requirement
- [vercel/next.js#86841 — open GitHub issue](https://github.com/vercel/next.js/issues/86841) — Next.js + pnpm 10.7.0+ workspace bug
- [vercel/next.js#86845 — open PR (the unmerged fix)](https://github.com/vercel/next.js/pull/86845) — verified OPEN as of 2026-05-14 via `gh pr view`
- [vercel/next.js v15.5.18 get-registry.ts source](https://github.com/vercel/next.js/blob/v15.5.18/packages/next/src/lib/helpers/get-registry.ts) — confirmed fix NOT yet in latest 15.5.x

### Secondary (MEDIUM confidence)

- [Socket.dev "pnpm 10.0.0 Blocks Lifecycle Scripts by Default"](https://socket.dev/blog/pnpm-10-0-0-blocks-lifecycle-scripts-by-default) — first-install UX description
- [Thilo Maier — PNPM minimumReleaseAge](https://maier.tech/notes/pnpm-minimum-release-age) — practical writeup
- [Cybersecurity News — pnpm 11 minimum release age default](https://cybersecuritynews.com/pnpm-11-turns-on-minimum-release-age/) — pnpm 11 context confirming Phase 30's choice to stay on pnpm 10
- [payloadcms/payload#11037](https://github.com/payloadcms/payload/issues/11037) — corepack signature verification workaround
- [Rajendra Sinh — corepack failing for pnpm install](https://rajendrasinh.com/posts/corepack-failing-for-pnpm-install/) — Docker corepack fix
- [Depot Dockerfile guide for pnpm](https://depot.dev/docs/languages/node-pnpm-dockerfile) — production Dockerfile patterns
- [Vercel Community: "Ignored build scripts: sharp"](https://community.vercel.com/t/ignored-build-scripts-sharp/6523) — confirms `onlyBuiltDependencies: ["sharp"]` is the fix for Next.js + Vercel deploys
- [lovell/sharp#4343](https://github.com/lovell/sharp/issues/4343) — sharp + pnpm 10 build issue
- [pnpm-v10-to-v11 codemod registry entry](https://app.codemod.com/registry/pnpm-v10-to-v11) — future migration tool reference
- [stepcodex.com summary of Next.js + pnpm 10 ENOWORKSPACES](https://www.stepcodex.com/en/issue/dev-server-npm-error-code-enoworkspaces) — confirms PR #86845 root-cause analysis

### Tertiary (LOW confidence — flag for validation)

- The exact behavior of `minimum-release-age` against an already-locked lockfile under `--frozen-lockfile` (covered in Assumption A1). Empirical validation in a sandbox install recommended before merging Phase 30 to production deploys.
- Whether `protobufjs@7.4.0`'s postinstall is load-bearing for any code path in our web app's Solana stack (covered in Assumption A2). Mitigated by adding it to `onlyBuiltDependencies` proactively.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view pnpm versions --json` on 2026-05-14; canonical install patterns from pnpm.io
- Architecture / `.npmrc` content: HIGH — direct quotes from pnpm release notes and settings docs
- Pitfalls: HIGH for #2-#6 (verified via direct file inspection and source quotes); MEDIUM for #1 (the Next.js bug is upstream and in flight — re-verify PR #86845 status at execution time)
- Code examples: HIGH — derived from actual repo state inspected during research, not synthesized

**Research date:** 2026-05-14
**Valid until:** 2026-06-13 (30 days) under normal conditions, BUT re-verify the Next.js PR #86845 status before execution. If PR #86845 merges and ships in a 15.5.x release before this expires, the pnpm 10.6.5 pin recommendation can be relaxed to "latest pnpm 10.x" and the rest of the research stays valid.

**Recommended execution order across the two repos:**

Per the prompt's question 10:

1. **x402jobs-api FIRST** (lower risk surface). The api repo is a single Express + tsup stack with no Next.js dependency. The pnpm 10 default-deny on `isolated-vm` is already handled (it's in `onlyBuiltDependencies`). Adding `esbuild` to that list and bumping the Dockerfile is a clean, isolated change. Railway deploys the api via a single Dockerfile build — easy to validate, easy to revert.

2. **x402jobs SECOND**. The web app carries the only material risk (the Next.js + pnpm 10.7.0+ bug). By pinning to pnpm 10.6.5 and editing both `package.json` + `apps/web/vercel.json`, the risk is contained. Vercel deploy previews give us a no-cost validation surface before merging to main.

Rationale: get the cheap, low-risk win in the api repo first to build confidence in the pattern. The web app upgrade then runs against an already-proven (in the api context) pnpm 10.6.5 pin. Independence holds until Phase 31 merges the repos, at which point the pattern will already be in place on both sides.

**SECURITY.md note:** Per ROADMAP and v3.0 milestone scope, `SECURITY.md` is deferred to Phase 31. Phase 30 should leave a placeholder note in the commit message referencing the documented policy in `.planning/v3.0-MILESTONE-SCOPE.md` (lines for Phase 30) so that Phase 31's SECURITY.md author can transfer the content.
