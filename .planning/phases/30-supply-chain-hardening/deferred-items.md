# Phase 30 Deferred Items

Out-of-scope discoveries logged during plan execution (Rules 1-3 scope boundary).

## From plan 30-03 (api repo, sibling)

### Pre-existing typecheck errors in api repo test files (not caused by Phase 30)

**Discovered:** 2026-05-14 during plan 30-03 execution
**Files:**
- `~/Projects/x402jobs-api/src/routes/__tests__/resource-registration.test.ts`
- `~/Projects/x402jobs-api/src/routes/__tests__/resource-registration-full.test.ts`

**Errors:** TS2339 `Property 'accepts' / 'mockReturnValue' / 'maxAmountRequired' / 'asset' does not exist on type 'object'`. Caused by x402check's `extractPaymentRequirements` return-type narrowing (`ExtractionResult` discriminated union) where the tests cast to `object` and access discriminated-union properties without the type guard.

**Pre-existing:** verified via `git stash && pnpm typecheck` on main pre-30-03 — same errors plus additional ones on the same files. Not introduced by pnpm 10 upgrade.

**Test runtime impact:** `pnpm vitest run` still passes the same way it did on main (30 files pass, 1 file fails for an unrelated reason). The TS errors are check-only — the tests still execute via vitest's transformer.

**Recommended fix:** Refactor the two test files to assert against `ExtractionResult` discriminator before accessing branch-specific fields, or update them to use the new x402check type guards. Out of scope for Phase 30 (build-tooling phase, not test-suite refactor). File as follow-up alongside Phase 31's monorepo merge.
