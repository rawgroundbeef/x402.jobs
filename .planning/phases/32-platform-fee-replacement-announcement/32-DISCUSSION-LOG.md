# Phase 32: Platform Fee Replacement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `32-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 32 — Platform Fee Replacement (renamed from "Platform Fee Replacement + Announcement" during this discussion)
**Areas discussed:** Fee endpoint surface area, In-flight job grandfathering mechanism, Memeputer-URL cut-over scope, Refund flow fee semantics, Announcement scope (emergent)

---

## Pre-discussion: Fold related todo

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fold it | Copy relevant decisions and "things the user might not be thinking about" notes from `decouple-x402jobs-from-memeputer.md` into CONTEXT.md. | ✓ |
| No, leave todo alone | Treat the todo as already-superseded by ROADMAP.md + PROJECT.md. | |

**User's choice:** Fold the todo.
**Notes:** The todo file has `resolves_phases: [32, 33, 34]` so it covers the whole v3.1 milestone; it'll be moved to `.planning/todos/done/` after Phase 32 ships.

---

## Fee endpoint surface area

### Q1: URL path suffix?

| Option | Description | Selected |
|--------|-------------|----------|
| `/x402/fees/{net}/charge` | Generic verb. e.g., `api.x402.jobs/x402/fees/solana/charge`. Clearer English than `job_fee`; no Jobputer legacy connotation. | ✓ |
| `/x402/fees/{net}/job_fee` | Mirrors the old `agents.memeputer.com/x402/{net}/jobputer/job_fee` path. Easier diff for self-hosters reading the CHANGELOG. | |
| `/x402/fees/{net}` | Network is the leaf. Shortest. Treats the fee endpoint as a singleton per network. | |

### Q2: Route file location?

| Option | Description | Selected |
|--------|-------------|----------|
| `routes/x402-fees.ts` (single file, both networks) | One handler with a `:network` path param branching internally. Matches `routes/instant.ts`. | ✓ |
| `routes/x402-fees-solana.ts` + `routes/x402-fees-base.ts` (split) | Two files, one per network. Cleaner separation if Solana and Base diverge later. | |
| Mount inside existing `routes/instant.ts` | Reuse facilitator + handler scaffolding directly. Risk: couples fee charging to instant-resource lifecycle. | |

### Q3: Reuse OpenFacilitator pattern from `instant.ts:36-44`?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, verbatim (Recommended) | `new OpenFacilitator({ url: FACILITATOR_URL, timeout: 60000 })` at module-load with absent-URL warning, then `facilitator.verify()` + `facilitator.settle()` in the handler. | ✓ |
| Yes, but extract a shared module | Pull the facilitator init into `apps/api/src/lib/facilitator.ts`. Defensible cleanup. | |
| No — different pattern | Direct USDC transfer or hand-rolled verify/settle. NOT recommended. | |

### Q4: How guarantee x402lint validity (FEE-03)?

| Option | Description | Selected |
|--------|-------------|----------|
| OpenFacilitator SDK helper + manual x402lint smoke test in CI | SDK builds accepts[] / CAIP-2 / addresses correctly; CI test invokes `x402lint` against a curl'd response. Belt + suspenders. | ✓ |
| Hand-build the response, validate with x402lint in tests only | Full control over field order; vitest spec runs x402lint against a captured payload. | |
| SDK only, no CI validation step | Trust the SDK. Fastest but loses the FEE-03 guarantee. | |

---

## In-flight job grandfathering mechanism

### Q1: Snapshot mechanism?

| Option | Description | Selected |
|--------|-------------|----------|
| Add `platform_fee` JSONB column to `x402_job_runs`, populated at job-creation | New migration: `ALTER TABLE x402_job_runs ADD COLUMN platform_fee jsonb`. Most defensible interpretation of FEE-10. | ✓ |
| Natural cutover — no schema change | Accept that "in-flight" means the seconds-long Inngest window. Lowest cost; risks transient mismatch. | |
| Env-flag dual-mode | Hold old `PLATFORM_FEE_URL` valid for one release. Violates OPS-04 "No backward-compatibility shim" — out per locked decision. | |

### Q2: Test approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest integration test against in-memory Inngest harness | Insert run with old fee snapshot, assert workflow charges OLD url with OLD percentage. Co-located with `escrow.test.ts` pattern. | ✓ |
| Vitest unit test on the read path only | Test `chargePlatformFee` reads from snapshot when present, falls back to config when absent. Doesn't prove the Inngest flow. | |
| Manual SQL fixture + scripted curl against dev server | Defers test infrastructure; doesn't satisfy SC4's "automated test" requirement. | |

### Q3: Snapshot scope?

| Option | Description | Selected |
|--------|-------------|----------|
| `x402_job_runs` only (per-run snapshot) | Snapshot lives on the run record. Simplest. Matches "fee config snapshotted at job-creation" literally. | ✓ |
| `x402_jobs` AND `x402_job_runs` (job-level baseline + per-run override) | Allows future per-job fee overrides. Over-engineered for FEE-10. | |

### Q4: Old URL retirement?

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately removed in Phase 32 (clean cut-over per OPS-04) | `config.ts` default flips to new URL; `agents.memeputer.com` entirely deleted from production paths. | |
| Removed in Phase 32 + commented in env.example as deprecated | Same as above but `env.example` keeps a commented `# PLATFORM_FEE_URL=... (DEPRECATED v3.1)` for the diff hint. | ✓ (selected per OPS-02 literal text — combined with #1 above) |
| Phase 32 ships both URLs, removal deferred | Hedge. Violates locked OPS-04. NOT recommended. | |

**Note:** User's selected answer was "Immediately removed in Phase 32" — interpreted alongside OPS-02 to mean: code flips immediately, env.example keeps a commented hint.

---

## Memeputer-URL cut-over scope

### Q1: Which `agents.memeputer.com` URLs in Phase 32 scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: only the fee endpoints (`charge-platform-fee.ts` + `config.ts platformFee.resourceUrl`) | Phase 32 removes ONLY the 2 fee URLs + the hardcoded BASE_PLATFORM_WALLET default. | ✓ |
| Strict + flag escrowputer as a follow-up | Same as Strict, plus CHANGELOG + CONTEXT.md note. | |
| Broad: fee + escrowputer in Phase 32 | Adds escrowputer decoupling. Scope expansion not in ROADMAP. | |

### Q2: BASE_PLATFORM_WALLET hardcoded default?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove default entirely — require env var | Strip the 0xAEB58049... hardcoded fallback. Renamed to `FEE_COLLECTION_BASE_ADDRESS`. | ✓ |
| Rename + keep default empty string | Behavior matches FEE_COLLECTION_ADDRESS pattern. | |
| Leave hardcoded default — just update the env var name | NOT recommended. Hardcoding a real address into OSS source = exactly the operator-coupling we're decoupling from. | |

### Q3: Any other prod path reading `config.platformFee.resourceUrl`?

| Option | Description | Selected |
|--------|-------------|----------|
| Verified — only `charge-platform-fee.ts` and `run-workflow.ts:132-135` | Trust the grep, proceed. | |
| Researcher should re-verify with a wider grep | Ask `gsd-phase-researcher` to do a broader scan before planning. Adds ~5min of researcher time. | ✓ |

### Q4: `config.ts#escrow.depositUrl` touched in Phase 32?

| Option | Description | Selected |
|--------|-------------|----------|
| Don't touch it — leave for a future phase | `config.escrow.depositUrl` keeps the `agents.memeputer.com` default unchanged. | |
| Add a deprecation comment in `config.ts` only | Add `// TODO(v3.2): self-host escrow endpoint, see D-1 decision tree`. Zero-risk breadcrumb. | (initially selected, then OVERTAKEN by Q5 below) |

### Q5 (emergent): Where should the dead escrow + hiring code removal live?

| Option | Description | Selected |
|--------|-------------|----------|
| Expand Phase 32 (FEE-11 / OPS-05) | Phase 32 grows to delete charge-escrow, release-escrow, hiring routes, 5 tables, 2 columns. | |
| New dedicated Phase 32.5 / 35 ("Remove dead escrow + hiring board") | Insert a pure deletion phase between 32 and 33. | |
| Fold into Phase 33 | Phase 33 already touches `routes/hiring.ts`. Phase 33 already largest. | |
| Defer to a v3.2 cleanup milestone | Note the deletion in CONTEXT.md `<deferred>` + new pending todo. Do NOT do it in v3.1. | ✓ |

**User's choice:** Defer to v3.2. Phase 32 escrow scope: no source change. Deferred to v3.2 cleanup milestone. New pending todo `remove-dead-escrow-hiring-code.md` to be created.
**Notes:** Triggered by user message "Escrow should be moved completely. We don't have that feature anymore." — confirmed dead feature.

---

## Refund flow fee semantics

### Q1: Refund policy when a job fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep platform fee on refund ("cost of trying") | Refund = total_cost - platform_fee_paid. Matches `escrow.ts:49`. Lower trust signal. | |
| Refund full total_cost INCLUDING platform fee (current code behavior) | Caller made whole. x402.jobs eats settlement cost. Highest trust. | ✓ |
| Refund based on actual partial-failure point (smartRefunds style) | Per-resource accounting. Currently OFF; not a Phase 32 turn-on. | |
| Defer the decision — just document current behavior in CHANGELOG | Punts to a future phase. | |

### Q2: Snapshot data shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — snapshot has `config` + `settled` fields | `{config: {url, percentage, minimum_usdc}, settled: {tx_hash, amount_paid, settled_at}}`. Canonical record. | ✓ |
| No — snapshot is config-only; settlement lives in `x402_job_run_events` | Refund logic joins events `WHERE node_id='platform-fee'`. Matches existing event-log architecture. | |

### Q3: refunds.ts code change in Phase 32?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + minimal change to honor fee-policy choice | Code change only if policy requires it. | |
| Audit only — no code change in Phase 32 | Read-only review. | |
| Audit + write a refund-semantics ADR | Doc artifact. | |

**Initial answer:** "Idk" — user uncertain. **Re-asked with recommendation:**

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + add a refund-with-new-endpoint integration test (Recommended) | No production code change; integration test proves refund flow works with new endpoint. Satisfies FEE-09. | ✓ |
| Audit only — no test added | Documents in CONTEXT/SUMMARY only. Weakest verification. | |
| Refactor refunds.ts to read snapshot explicitly (defensive coding) | Slight scope expansion; nice-to-have not must-have. | |

### Q4: Refund UX?

| Option | Description | Selected |
|--------|-------------|----------|
| Show breakdown: "Refunded $X.XX of $Y.YY (platform fee of $Z.ZZ not refundable)" | Most transparent. Requires frontend change. | |
| Just show the refunded number | Simpler; matches current response shape. | |
| N/A — we chose to refund the fee too | No breakdown needed because nothing is withheld. | ✓ |

---

## Wrap-up: Announcement + publication decisions

### Q1: ANNOUNCE-05 publication trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual user go-ahead after a smoke test | 24h soak, manual log inspection, user posts. | ✓ (initially — superseded by Q3 below) |
| Automated post-deploy verification + manual final push | Script writes a gate marker, user reads and posts. | |
| Couple to the next N successful prod fee charges | Quantitative trust gate. | |

### Q2: ANNOUNCE-04 wallet publication format?

| Option | Description | Selected |
|--------|-------------|----------|
| Address + explorer link + verification snippet | Curl/jq snippet to verify the 402-response payTo matches the published address. | |
| Address + explorer link only | Bare addresses + Solscan/Basescan links. | |
| Address only (no explorer link) | Lowest copy length. | |
| None | (user's freeform answer) | ✓ — superseded by Q3 below |

### Q3: Announcement copy home? → **Emergent: announcement removed entirely**

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/phases/32-.../announcement/{x-thread.md, linkedin.md, changelog-entry.md}` | Co-located with phase. | |
| `docs/announcements/v3.1.md` | Public-facing docs surface. | |
| Shouldn't. Remove announcement from plan. | (user's freeform answer) | ✓ |

**User's choice:** "Remove announcement from plan." Triggered the scope-reduction confirmation below.

### Q4 (confirmation): ANNOUNCE-01..05 handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove all 5 from Phase 32; defer to a future phase / v3.2 | Phase rename; coverage drops 39→34. | |
| Remove the SOCIAL parts (ANNOUNCE-01/02/03/04) but keep ANNOUNCE-05 as a soft gate | Functionally same as Option 1; less ROADMAP surgery. | |
| Keep ANNOUNCE-01/02 (drafts only, never publish) | Half-measure. | |
| Remove it. Don't defer. | (user's freeform answer) | ✓ |

**User's choice:** Remove entirely, do not defer. 5 ANNOUNCE-* reqs are eliminated, not moved.

### Q5 (confirmation): FEE-06 wallet documentation redirected?

| Option | Description | Selected |
|--------|-------------|----------|
| CHANGELOG.md v3.1 entry (OPS-01) — addresses + explorer links there | Self-hosters find it via the repo. | ✓ |
| env.example comments only | Smallest surface; lower discoverability. | |
| Both: CHANGELOG + env.example comments | Belt + suspenders. | |
| FEE-06 requirement removed (wallet stays unpublished) | Weakens transparency stance. | |

---

## Claude's Discretion

- Exact CHANGELOG.md v3.1 entry text (within D-19 constraints)
- Exact env.example comment wording for deprecated `PLATFORM_FEE_URL` and new `FEE_COLLECTION_*_ADDRESS` env vars
- Migration file name / number (next free per `apps/api/migrations/README.md`)
- Test file structure / naming within established `__tests__` dirs

## Deferred Ideas

- Remove dead escrow + hiring board code (v3.2 cleanup) — full surface mapped in CONTEXT.md `<deferred>`
- Public announcement (all formats) — REMOVED, not deferred
