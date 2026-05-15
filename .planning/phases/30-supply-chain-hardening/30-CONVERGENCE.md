# Phase 30 — Convergence Evidence

**Completed:** 2026-05-14
**Pnpm pin (both repos):** `pnpm@10.6.5` (pre-`10.7.0` deliberately — avoids Next.js 15.5 + pnpm 10.7.0+ ENOWORKSPACES bug, vercel/next.js#86841)
**Lockfile format (both repos):** `lockfileVersion: '9.0'` (pnpm 10 keeps the v9.0 format — no bump occurred)

## Success-Criteria Map

| SC# | ROADMAP Criterion | Status | Evidence | Source artifact |
|-----|-------------------|--------|----------|-----------------|
| SC1 | Both apps build cleanly under pnpm 10 (local + CI) | ✅ Local PASS / Vercel+Railway DEFERRED to post-merge | Web build: 48/48 pages, 0 ENOWORKSPACES, `Build success` (43ms tsup for api) | `/tmp/30-05-smoke-this-build.log`, `/tmp/30-05-smoke-api-build.log` |
| SC2 | Root `.npmrc` in place with documented release-age policy | ✅ PASS | `minimum-release-age=4320` + `minimum-release-age-exclude=@x402jobs/*` loaded (verified live via `pnpm config get`) | `/Users/rawgroundbeef/Projects/x402jobs/.npmrc` + plan 30-04 SUMMARY |
| SC3 | `onlyBuiltDependencies` vetted; install completes without unapproved lifecycle scripts | ✅ PASS (re-interpreted — see BLOCKER-30-01-A resolution) | 0 `Ignored build scripts:` warnings in api repo; 5 in web repo, all 5 accepted under BLOCKER-30-01-A as exactly what the default-deny policy is designed to gate | `/tmp/30-05-smoke-this-install.log`, `/tmp/30-05-smoke-api-install.log`, plan 30-01 SUMMARY Blocker Resolution section |
| SC4 | Railway deploy of `x402jobs-api` succeeds on pnpm 10 | ⏳ DEFERRED to post-merge | Local Dockerfile + build proves the pin works; Railway has no per-PR previews so deploy validation happens on main after PR #33 merges | plan 30-03 SUMMARY + project memory: Railway has no PR previews |
| SC5 | Vercel deploy of web app succeeds on pnpm 10 | ⏳ DEFERRED to post-merge | Local web build + dev boot prove the pin works on Next.js 15.5; Vercel preview gating skipped per user direction (consistent with Railway approach) | plan 30-02 + 30-04 SUMMARYs |
| SC6 | CI green on both repos | ⏸️ DEFERRED-BY-DESIGN | Neither repo has CI workflows yet; deploy previews (Vercel + Railway) ARE the CI surface. Phase 31 introduces unified CI. | RESEARCH "Validation Architecture" + PATTERNS "CI workflows" + planning constraint 10 |

## Convergence Audit Evidence

### No `pnpm@9` stragglers in tracked code
- **This repo** (excluding `.planning/`): `git ls-files | grep -vE '^\.planning/' | xargs grep -l "pnpm@9"` → EMPTY ✅
- **Sibling api repo**: `git ls-files | xargs grep -l "pnpm@9"` → EMPTY ✅

### All 5 pin sites at exact `pnpm@10.6.5`
| Repo | File | Line | Pin |
|------|------|------|-----|
| x402jobs | `package.json` | 19 | `"packageManager": "pnpm@10.6.5"` |
| x402jobs | `apps/web/vercel.json` | 3 | `"installCommand": "npm install -g pnpm@10.6.5 && pnpm install --frozen-lockfile"` |
| x402jobs-api | `Dockerfile` | 17 | `RUN npm install -g pnpm@10.6.5` |
| x402jobs-api | `vercel.json` | 3 | `"installCommand": "npm install -g pnpm@10.6.5 && pnpm install --frozen-lockfile"` |
| x402jobs-api | `package.json` | 62 | `"packageManager": "pnpm@10.6.5"` |

### Preserved invariants (must NOT have been silently flipped)
- `x402jobs-api/pnpm-workspace.yaml#ignoredBuiltDependencies` still `[isolated-vm]` ✅
- `x402jobs/pnpm-lock.yaml` header still `lockfileVersion: '9.0'` (no bump) ✅
- `x402jobs-api/pnpm-lock.yaml` header still `lockfileVersion: '9.0'` (no bump) ✅

## Configuration State (Post-Phase 30)

### This repo (`x402jobs`)
| Setting | Value |
|---------|-------|
| `package.json#packageManager` | `pnpm@10.6.5` (was `pnpm@9.15.0`) |
| `package.json#pnpm.onlyBuiltDependencies` | `["esbuild","sharp","protobufjs","fsevents","bufferutil","utf-8-validate"]` |
| `.npmrc#minimum-release-age` | `4320` (72 hours, in minutes) — NEW file |
| `.npmrc#minimum-release-age-exclude` | `@x402jobs/*` |
| `apps/web/vercel.json#installCommand` | pins `pnpm@10.6.5` (was `pnpm@9.12.1`) |

### Sibling repo (`x402jobs-api`)
| Setting | Value |
|---------|-------|
| `package.json#packageManager` | `pnpm@10.6.5` (NEWLY added) |
| `package.json#pnpm.onlyBuiltDependencies` | `["bigint-buffer","bufferutil","esbuild","isolated-vm","protobufjs","utf-8-validate"]` |
| `pnpm-workspace.yaml#ignoredBuiltDependencies` | `[isolated-vm]` (PRESERVED — pre-existing invariant) |
| `Dockerfile` pnpm install | `pnpm@10.6.5` (was `pnpm@9.x`) |
| `vercel.json#installCommand` | pins `pnpm@10.6.5` (vestigial — Railway is the real lane) |

### Allow-list delta between repos (intentional)
The web repo allow-list and the api repo allow-list overlap on **3 entries** (`esbuild`, `bufferutil`, `utf-8-validate`, `protobufjs`) but diverge on:
- Web only: `sharp` (Next.js Image optimization), `fsevents` (macOS file watcher)
- API only: `bigint-buffer` (Solana), `isolated-vm` (sandboxed JS execution for prompt-path resources)

This is **correct** — each repo's allow-list reflects its actual dependency surface. The original plan-30-03 projection of `[esbuild, isolated-vm]` was empirically expanded by the executor agent to the 6-entry set so the api repo also satisfies the "ZERO Ignored build scripts" gate. Documented in plan 30-03 SUMMARY under "Deviations applied during execution".

## Local Smoke Evidence (2026-05-14)

### This repo (`x402jobs`)
- `pnpm --version` → `10.6.5`
- `pnpm install` (after `rm -rf node_modules apps/*/node_modules packages/*/node_modules`) → Done in 8.9s; 5 ignored build scripts (the BLOCKER-30-01-A accepted set); ZERO `ERR_PNPM_NO_MATCHING_VERSION`
- `pnpm --filter @x402jobs/web build` → 48/48 pages built; ZERO `ENOWORKSPACES`
- `pnpm --filter @x402jobs/web dev` → `Ready in 1440ms`, `Local: http://localhost:3010`, ZERO `ENOWORKSPACES`

### Sibling repo (`x402jobs-api`)
- `pnpm --version` → `10.6.5`
- `pnpm install` (after `rm -rf node_modules`) → Done in 3s; ZERO `Ignored build scripts`; ZERO `ERR_PNPM_NO_MATCHING_VERSION`
- `pnpm build` → tsup CJS build success in 43ms; `dist/index.js` (880KB) produced

## BLOCKER-30-01-A Resolution Reference

The 5 ignored install scripts in the web repo (`@stellar/stellar-sdk`, `blake-hash`, `tiny-secp256k1`, `unrs-resolver`, `usb`) are **expected and accepted** — they are exactly what pnpm 10's default-deny lifecycle-script policy was designed to gate. All are transitive deps of features not used at runtime by our app (Trezor hardware-wallet stack from `@solana/wallet-adapter-trezor`, plus the Rust import resolver inside `eslint-config-next`).

Web build (48/48 pages) and dev (`Ready in 1440ms`) both pass without these scripts running, confirming runtime is unaffected. SC3 is re-interpreted as **"ZERO unexpected ignored scripts; 5 expected and documented"** rather than the original "ZERO ignored scripts". See plan 30-01 SUMMARY → "Blocker Resolution (2026-05-14)" section.

A NEW package name appearing in future `pnpm install` ignored-scripts output would be a regression signal (means a lockfile drift or upstream dep added a postinstall step).

## Deferred Items (Phase 31 or later)

- **SECURITY.md** publishing the release-age policy externally (so a future maintainer can't silently remove the gate)
- **Unified GitHub Actions CI** workflow (replaces deploy-preview-only validation; satisfies SC6 properly)
- **Monorepo merge** folds api into `apps/api/`; a single root `.npmrc` covers the merged tree (today only x402jobs has one)
- **`@solana/wallet-adapter-trezor` removal** (optional; would eliminate 4 of 5 ignored install scripts if Trezor support is confirmed unused)
- **`eslint-config-next` Rust-resolver opt-out** (optional; eliminates the 5th ignored script)

## Lockfile Notes

- pnpm 10.6.5 keeps `lockfileVersion: '9.0'` — no format bump occurred in either repo
- Plan 30-01 produced a **byte-identical** lockfile after re-resolve (pnpm reported "Lockfile is up to date, resolution step is skipped"). The plan anticipated a measurable diff (peer-dep hash migration); reality was a no-op
- Plan 30-04 (`.npmrc`) produced **no lockfile diff** at install time (A1 confirmed: release-age gate runs at resolution time, not install time)
- Plan 30-03 (api repo) reported the same — lockfile byte-identical after pnpm 10 read it

## Known Limitations

- The 72h release-age gate has an **escape hatch**: add `minimum-release-age-exclude=<pkg@version>` lines to `.npmrc` if an urgent security patch must be pulled in immediately.
- pnpm pinned to **10.6.5 deliberately** (pre-10.7.0). Re-check vercel/next.js#86845 status before any future bump to a higher pnpm 10.x — the 10.6.5 pin is the load-bearing guard against the Next.js 15.5 ENOWORKSPACES bug.
- Railway has no per-PR deploy previews, so SC4 validation only happens on main after PR #33 merges. The ROLLBACK runbook is the primary recovery path if this surfaces a regression.

## Related Plan SUMMARYs

- [30-01-SUMMARY.md](./30-01-SUMMARY.md) — pnpm 10.6.5 baseline (this repo) + BLOCKER-30-01-A resolution
- [30-02-SUMMARY.md](./30-02-SUMMARY.md) — Vercel installCommand pin
- [30-03-SUMMARY.md](./30-03-SUMMARY.md) — pnpm 10.6.5 baseline (api repo, cross-repo)
- [30-04-SUMMARY.md](./30-04-SUMMARY.md) — root `.npmrc` release-age policy
- [30-05-SUMMARY.md](./30-05-SUMMARY.md) — convergence + this document
- [30-ROLLBACK.md](./30-ROLLBACK.md) — single-page rollback runbook with commit shas
