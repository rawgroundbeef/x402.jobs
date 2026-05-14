---
phase: 30-supply-chain-hardening
plan: 01
subsystem: infra
tags: [pnpm, package-manager, supply-chain, lifecycle-scripts, nextjs, vercel]

# Dependency graph
requires: []
provides:
  - "Root packageManager pinned to pnpm@10.6.5 (avoids Next.js 15.5 + pnpm 10.7.0+ ENOWORKSPACES bug)"
  - "pnpm.onlyBuiltDependencies allow-list with 6 vetted entries (esbuild, sharp, protobufjs, fsevents, bufferutil, utf-8-validate)"
  - "Verified web build + dev pass under pnpm 10.6.5"
  - "Documented 5 transitive deps with ignored build scripts — requires planner decision before 30-02 (Vercel) and 30-03 (Railway) deploy lanes proceed"
affects: [30-02, 30-03, 30-04, 30-05]

# Tech tracking
tech-stack:
  added: ["pnpm@10.6.5 (replaces pnpm@9.15.0)"]
  patterns: ["pnpm 10 default-deny lifecycle scripts via packageManager + pnpm.onlyBuiltDependencies"]

key-files:
  created: []
  modified:
    - "package.json (packageManager pin + pnpm.onlyBuiltDependencies block)"

key-decisions:
  - "Pinned pnpm to exact version 10.6.5 (no +sha512: suffix) per RESEARCH Example 2 — Vercel/Railway don't go through corepack in this setup"
  - "Used `volta install pnpm@10.6.5` instead of `npm install -g pnpm@10.6.5` because local toolchain is volta-managed; volta honors packageManager field so once package.json is bumped, pnpm --version reports 10.6.5"
  - "Allow-list kept to the 6 plan-specified entries; 5 additional script-bearing transitive deps surfaced and documented as BLOCKER for planner decision"

patterns-established:
  - "Pattern 1: Bump packageManager field first, then verify pnpm --version picks up the pin via volta/corepack/whatever local manager is in use"

requirements-completed: [SC1, SC3]  # Resolved 2026-05-14 — see Blocker Resolution section below. SC re-interpreted as "ZERO unexpected ignored scripts" per security-intent ruling.

# Metrics
duration: ~5min
completed: 2026-05-14
---

# Phase 30 Plan 01: Pnpm 10.6.5 Local Bump Summary

**Bumped root packageManager to pnpm@10.6.5 with explicit onlyBuiltDependencies allow-list. Web build + dev smoke pass cleanly. Blocker BLOCKER-30-01-A resolved 2026-05-14 via Option 1 (accept warnings — the 5 ignored scripts are exactly what pnpm 10's default-deny policy was designed to gate). See Blocker Resolution section.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-14T18:31:21Z
- **Completed:** 2026-05-14T18:36:00Z (approx — partial completion, blocker raised)
- **Tasks attempted:** 3
- **Tasks fully complete:** 2 of 3 (Task 1 + Task 2 done; Task 3 partial — commit deferred pending blocker resolution)
- **Files modified:** 1 (package.json)

## Accomplishments

- Root `package.json#packageManager` bumped from `pnpm@9.15.0` to `pnpm@10.6.5`
- `pnpm.onlyBuiltDependencies` allow-list inserted with exactly the 6 plan-specified entries: esbuild, sharp, protobufjs, fsevents, bufferutil, utf-8-validate
- Confirmed volta-managed pnpm picks up the new pin: `pnpm --version` → `10.6.5` after the package.json edit
- `pnpm install` completed under pnpm 10.6.5; lockfile is byte-identical (no diff) because resolution step was skipped
- `pnpm --filter @x402jobs/web build` SUCCEEDED — all 48 static pages generated, no `ENOWORKSPACES` error → confirms the 10.6.5 pin avoids the Next.js 15.5 + pnpm 10.7.0+ bug (vercel/next.js#86841)
- `pnpm --filter @x402jobs/web dev` SUCCEEDED — `Ready in 977ms`, Local URL printed, no errors

## Task Commits

1. **Task 1: Pre-flight — capture baseline** - (no commit; capture-only step. Baseline snapshots written to `/tmp/30-01-*`.)
2. **Task 2: Edit package.json** - `86cc3ef` (chore: bump packageManager + add onlyBuiltDependencies)
3. **Task 3: Regenerate lockfile + smoke test** - PARTIAL — install + build + dev all succeeded, lockfile was byte-identical so no commit needed for that artifact. Verification gate FAILS because 5 transitive deps surfaced as `Ignored build scripts` warnings. No final commit was made for Task 3.

**Plan metadata (this SUMMARY commit):** to be recorded after commit.

## Files Created/Modified

- `package.json` — bumped `packageManager` from `pnpm@9.15.0` → `pnpm@10.6.5`; inserted `pnpm.onlyBuiltDependencies` array with 6 entries
- `pnpm-lock.yaml` — NO CHANGE. Lockfile is byte-identical after `pnpm install` under 10.6.5 (resolution step was skipped because lockfile already in v9.0 format and content matched). Header still `lockfileVersion: '9.0'`.

## Verification Evidence

| Check | Result | Source |
|---|---|---|
| `pnpm --version` reports 10.6.5 | PASS | `/tmp/30-01-pnpm-after.txt` |
| `grep -c '"pnpm@10.6.5"' package.json` returns 1 | PASS | inline grep after edit |
| `pnpm-lock.yaml` header still `lockfileVersion: '9.0'` | PASS | `head -2 pnpm-lock.yaml` |
| `pnpm install` produces zero `Ignored build scripts` warnings | **FAIL** | `/tmp/30-01-install.log` — 5 warnings listed (see Blocker) |
| `pnpm --filter @x402jobs/web build` succeeds | PASS | `/tmp/30-01-web-build.log` — exit 0, 48/48 pages built |
| `pnpm --filter @x402jobs/web build` has zero `ENOWORKSPACES` | PASS | `grep -c ENOWORKSPACES /tmp/30-01-web-build.log` → 0 |
| `pnpm --filter @x402jobs/web dev` boots (sentinel `Ready in` or `- Local:`) | PASS | `/tmp/30-01-web-dev.log` — `Ready in 977ms`, `- Local: http://localhost:3010` |

## Decisions Made

- **Order swap:** The plan's Task 1 step 5 said `npm install -g pnpm@10.6.5` then verify `pnpm --version == 10.6.5` BEFORE editing package.json. On this developer machine pnpm is volta-managed (`/Users/rawgroundbeef/.volta/bin/pnpm → volta-shim`). Volta honors the `packageManager` field, so `pnpm --version` reports whatever package.json pins regardless of which version volta has installed globally. Volta's default pnpm was set to 10.6.5 via `volta install pnpm@10.6.5`, but `pnpm --version` continued to return 9.15.0 until package.json was edited. The functional effect is identical: after Task 2 commit, `pnpm --version` is `10.6.5` everywhere. Documented under Decisions for posterity.

## Deviations from Plan

### Procedural (informational, not auto-fix)

**1. [Procedure] Switched to volta-native install path**
- **Found during:** Task 1 (Pre-flight)
- **Issue:** `npm install -g pnpm@10.6.5` would have been overridden by volta-shim; the local toolchain uses volta, not npm-global.
- **Fix:** Used `volta install pnpm@10.6.5` (the volta-native equivalent). Volta then honors the `packageManager` field in `package.json`.
- **Files modified:** none — volta state lives in `~/.volta/`, outside the repo
- **Verification:** `pnpm --version` returns `10.6.5` after Task 2 commit; `volta list pnpm` shows `pnpm@10.6.5 ... (default)`
- **Committed in:** N/A — environment change only

### Blocker (NOT auto-fixed, requires planner input)

**BLOCKER-30-01-A — 5 transitive deps need allow-list decision**

- **Found during:** Task 3 (regenerate lockfile + run `pnpm install`)
- **Issue:** Under pnpm 10's default-deny lifecycle-script policy, `pnpm install` produced this warning:

  ```
  Ignored build scripts: @stellar/stellar-sdk, blake-hash, tiny-secp256k1, unrs-resolver, usb.
  Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
  ```

- **Conflict with plan:** Plan's `<critical_constraints>` says "The onlyBuiltDependencies allow-list is EXACTLY these six entries... No additions, no omissions" AND "fresh install MUST produce ZERO 'Ignored build scripts:' warnings — if it does, the allow-list is wrong". These two clauses are mutually exclusive for this dep tree. The plan body (Task 3 action step 2) explicitly says "STOP — surface to the user before continuing (the allow-list needs to be extended, which is a deviation from research and needs explicit approval)".
- **Why it didn't break the smoke tests:** web build + dev both succeed without these scripts (verified — see Verification table above). The five packages are NON-load-bearing for typical use:

  | Package | Pulled in by | What the postinstall does | Functional impact if skipped |
  |---|---|---|---|
  | `@stellar/stellar-sdk@14.2.0` | `@solana/wallet-adapter-trezor` → `@trezor/connect` → `@trezor/blockchain-link` | Likely sodium-native bindings setup for Stellar crypto | Stellar-chain support inside Trezor adapter unavailable; not used in our app (we use Solana + Base, not Stellar) |
  | `blake-hash@2.0.0` | Same Trezor chain → `@trezor/utxo-lib` | Native bindings for Blake hash | Pure-JS fallback exists; affects Trezor UTXO chains we don't use |
  | `tiny-secp256k1@1.1.7` | Same Trezor chain → `@trezor/utxo-lib` | Native bindings for secp256k1 | Pure-JS fallback exists; affects Trezor UTXO chains we don't use |
  | `usb@2.17.0` | Same Trezor chain → `@trezor/transport` | Native USB HID bindings for hardware wallet | Trezor hardware wallet device connection unavailable; software wallets (Phantom, etc.) unaffected |
  | `unrs-resolver@1.11.1` | `eslint-config-next@15.5.7` → `eslint-import-resolver-typescript@3.10.1` | Downloads Rust-compiled native binary for fast ESLint import resolution | ESLint falls back to JS-only resolver; lint runs slower but works |

- **Reproduce:**
  ```bash
  cd /Users/rawgroundbeef/Projects/x402jobs
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  pnpm install
  # Watch for "Ignored build scripts: ..." warning at end
  ```
- **Decision the planner needs to make:** Three viable options, in increasing order of disruption:

  1. **Accept the warnings and ship as-is.** The 5 packages do not affect runtime for our app (no Trezor + ESLint resolver is dev-only). Update the plan's success criterion from "ZERO warnings" to "ZERO warnings affecting runtime; Trezor + ESLint scripts intentionally skipped". Document in the SECURITY.md placeholder (Phase 31).
  2. **Extend the allow-list to 11 entries.** Add the 5 surfaced packages to `pnpm.onlyBuiltDependencies`. This deviates from the plan's "EXACTLY 6 entries" constraint but aligns with the "ZERO warnings" constraint. Risk: those postinstall scripts will run with developer-level permissions. They are all from established projects (Trezor, Stellar, ESLint ecosystem) but increase attack surface vs option 1.
  3. **Remove the Trezor adapter and switch ESLint resolver.** Largest change — drops `@solana/wallet-adapter-trezor` from `@solana/wallet-adapter-wallets`, switches ESLint config away from `eslint-config-next` or to a version using a pure-JS resolver. Out of scope for Phase 30.

- **Recommendation (not authoritative):** Option 1 is the lowest-risk and most security-conservative path. The whole point of pnpm 10's default-deny is to surface these so a human reviews them before extending the allow-list. The 5 packages are all dependencies of features we don't actively use at runtime (Trezor hardware wallet, Rust-based fast ESLint resolution). Recommend updating the plan's success criterion and shipping the package.json change as-committed (commit `86cc3ef`).
- **Suggested next action:** Planner reviews this SUMMARY, picks an option, and either (a) closes the plan via SC update (option 1), (b) spawns a fresh executor with an updated allow-list spec (option 2), or (c) opens a separate plan to remove the offending deps (option 3).

### Blocker Resolution (2026-05-14)

**Decision:** Option 1 — accept the warnings. Allow-list stays at the 6 plan-specified entries.

**Rationale:** The whole point of pnpm 10's default-deny lifecycle-script policy is to surface unexpected install scripts so a human can review them before extending the allow-list. The 5 ignored scripts (`@stellar/stellar-sdk`, `blake-hash`, `tiny-secp256k1`, `usb`, `unrs-resolver`) are *exactly* what the policy is supposed to block — transitive deps of Trezor hardware-wallet support (a feature we don't use at runtime) plus the Rust import resolver inside `eslint-config-next` (dev-only, has a working JS fallback). Web build (48/48 pages) and dev (`Ready in 977ms`) both pass without these scripts running, confirming runtime is unaffected. Extending the allow-list to 11 entries would undermine the hardening rationale of the phase itself.

**Success criteria re-interpretation:**
- Original SC: "fresh install MUST produce ZERO 'Ignored build scripts:' warnings"
- Resolved SC: "fresh install MUST produce ZERO *unexpected* ignored scripts; the 5 currently-ignored scripts are intentionally blocked by the supply-chain hardening policy and documented here"

**Downstream impact:**
- Plan 30-02 (Vercel installCommand pin): No assumption change. Allow-list stays at 6 entries.
- Plan 30-03 (API repo): Already resolved independently with the API-side allow-list (6 entries, different membership) per its own SUMMARY.
- Plan 30-04 (.npmrc release-age policy): Independent concern; not affected.
- Plan 30-05 (convergence): Will note this resolution in CONVERGENCE.md as part of SC1/SC3 sign-off.

**Long-term follow-ups (optional, OUT of Phase 30 scope):**
- Consider dropping `@solana/wallet-adapter-trezor` if Trezor hardware wallet support is unused. Removes 4 of 5 ignored scripts in one shot.
- Watch for `eslint-import-resolver-typescript` to publish a config option that skips the Rust binary download, or for `eslint-config-next` to drop the unrs-resolver dep.

**Audit trail:** Resolution made by user (Ben Tatum) during /gsd-execute-phase 30 interactive checkpoint, 2026-05-14.

---

**Total deviations:** 1 procedural (informational); 1 blocker — resolved 2026-05-14 (planner accepted Option 1).
**Impact on plan:** package.json change is safe to keep regardless of which option the planner picks. The blocker only affects the plan's `<verify>` gate, not the artifacts already produced.

## Issues Encountered

- **`timeout` command not on macOS PATH.** macOS uses `gtimeout` (homebrew coreutils) or BSD-style timeouts. Worked around with bash `pnpm dev &` + `sleep 30` + `kill`. Captured dev output before kill. Not a plan deviation — a process-control implementation choice.
- **Lockfile byte-identical after regen.** Plan anticipated a measurable diff ("peer-dep hashes migrated MD5→SHA256 internally"). In practice pnpm 10.6.5 reported "Lockfile is up to date, resolution step is skipped" and the lockfile bytes did not change. This is acceptable — the lockfile remains v9.0-format compatible with both pnpm 9 and pnpm 10. The plan's expectation of a real diff was speculative; reality is that no diff was needed.

## Next Phase Readiness

- **BLOCKER-30-01-A resolved 2026-05-14** — allow-list stays at 6 entries (Option 1). Plans 30-02, 30-03, 30-04 unblocked. See Blocker Resolution section.
- The `pnpm@10.6.5` pin itself is validated against the web app — both `next build` and `next dev` pass. No additional Next.js workarounds needed.
- Commit `86cc3ef` (Task 2) is safe to roll forward into 30-02 / 30-03 regardless of the blocker decision; the blocker only affects whether to add more entries to `pnpm.onlyBuiltDependencies`, not whether the current 6 are correct.

## Self-Check: PASSED

- File `.planning/phases/30-supply-chain-hardening/30-01-SUMMARY.md` exists at this path.
- File `package.json` contains the literal string `"pnpm@10.6.5"` (verified by grep).
- Commit `86cc3ef` exists on `worktree-agent-aff51835` (`git log --oneline --all | grep 86cc3ef`).

SC1 and SC3 from PLAN frontmatter marked complete via Blocker Resolution (Option 1, 2026-05-14). `requirements-completed: [SC1, SC3]` reflects the resolved state.

---
*Phase: 30-supply-chain-hardening*
*Plan: 01*
*Completed: 2026-05-14 (blocker resolved via security-intent re-interpretation)*
