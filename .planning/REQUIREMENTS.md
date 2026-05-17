# Requirements: v3.1 Decouple from Memeputer / Jobputer infrastructure

**Defined:** 2026-05-17
**Core Value:** Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure.

**Milestone summary:** Remove every operational + UI dependency on Memeputer-owned services so a fork of `x402.jobs` is fully self-runnable. The BSL 1.1 Licensor (Memeputer LLC) is **not** changing — this is operational/UI decoupling, not legal. (The combined "fee reduction + going independent" announcement was originally bundled into Phase 32 but removed from milestone scope on 2026-05-17 during the Phase 32 discuss-phase — v3.1 ships without a public announcement; see "Removed during milestone" below.)

---

## v3.1 Requirements

Requirements for milestone v3.1. Each maps to exactly one phase in `.planning/ROADMAP.md`.

### Fee Endpoint (FEE)

- [ ] **FEE-01**: x402.jobs operates its own fee-collection x402 endpoint under `api.x402.jobs/x402/fees/{solana,base}/...` (no longer calls `agents.memeputer.com/x402/.../jobputer/job_fee`).
- [ ] **FEE-02**: The fee endpoint is implemented with the OpenFacilitator SDK (verify + settle).
- [ ] **FEE-03**: The fee endpoint's 402 response payload validates against `x402lint` (CAIP-2 network IDs correct, EVM/Solana addresses well-formed, accepts[] schema valid).
- [ ] **FEE-04**: Fee charging continues to happen on the **same network** as the job's resources (Solana jobs → Solana fee; Base jobs → Base fee). No cross-chain settlement.
- [ ] **FEE-05**: Platform fee rate is reduced from current `max(1.5%, $0.01 min)` to a new rate (target: 1%, exact number locked in Phase 32 discuss-phase). `$0.01` minimum preserved.
- [ ] **FEE-06**: Fee-collection wallet is a new, defensible address (cold storage or multisig — NOT the same wallet as any operational hot wallet) and is documented on-chain-verifiably in `CHANGELOG.md` (per OPS-01) with Solscan/Basescan explorer links.
- [ ] **FEE-07**: `apps/api/src/config.ts` `PLATFORM_FEE_URL` defaults updated; `PLATFORM_FEE_PERCENTAGE` default lowered; new fee-wallet env vars (`FEE_COLLECTION_PRIVATE_KEY` or equivalent) documented in `apps/api/env.example`.
- [ ] **FEE-08**: `apps/api/src/inngest/utils/charge-platform-fee.ts` and any other call sites point at the new endpoint; all `agents.memeputer.com` URLs removed from production paths.
- [ ] **FEE-09**: Refund flow (`apps/api/src/routes/refunds.ts`) still works end-to-end with the new fee endpoint — partial-failure fee semantics audited and unchanged.
- [ ] **FEE-10**: In-flight jobs at cut-over are grandfathered (fee config snapshotted at job-creation) — no backfill, no double-charging. Behavior verified by test.

### UI / Persona Removal (UI)

- [ ] **UI-01**: `JobputerChatButton.tsx`, `AskJobputerModal.tsx`, and their wiring through `ModalContext.tsx` / `GlobalModals.tsx` are removed from `apps/web/`.
- [ ] **UI-02**: All `JOBPUTER_AVATAR_URL`, `JOBPUTER_HELP_URL`, `JOBPUTER_POST_JOB_REQUEST_URL` references removed from `apps/web/src/lib/config.ts` and any other config files.
- [ ] **UI-03**: Jobputer references in `BaseLayout.tsx`, `JobCanvas.tsx`, `CreateWorkflowDialog.tsx`, `TransformConfigModal.tsx`, `TransformConfigPanel.tsx` are removed or replaced with neutral copy.
- [ ] **UI-04**: API routes `apps/api/src/routes/ask-jobputer.ts`, plus Jobputer references in `hiring.ts`, `workflow-chat.ts`, `resources.ts`, are removed or renamed away from the Jobputer brand.
- [ ] **UI-05**: `auth.memeputer.com` avatar URL no longer appears in production code (frontend or backend).
- [ ] **UI-06**: No replacement mascot/persona is introduced. Help surfaces use docs links or neutral copy only.
- [ ] **UI-07**: Visual regression check (manual screenshot diff) confirms no broken layout where Jobputer surfaces lived.

### Docs Investment (DOCS)

- [ ] **DOCS-01**: Existing `/docs` pages audited: `getting-started`, `developer`, `resources`, `examples`, `errors`, `long-running-resources` — content gaps identified and listed.
- [ ] **DOCS-02**: New `/docs/sdk-quickstart` page covering `packages/sdk` install + first-call example.
- [ ] **DOCS-03**: New `/docs/x402-primer` page covering the x402 protocol basics (402 response, accepts[], facilitator verify/settle).
- [ ] **DOCS-04**: New `/docs/recipes` page with 3+ common workflow recipes (link-existing, proxy, prompt-template).
- [ ] **DOCS-05**: New `/docs/troubleshooting` page covering the most common errors from `errors.ts` mappings.
- [ ] **DOCS-06**: New `/docs/agents` section scoped for the agent-developer audience (sets up future agent-readable skill files; minimum viable entry — does not need to be complete agent SDK docs).
- [ ] **DOCS-07**: Docs nav/sidebar updated so the new pages are discoverable from `/docs` root.
- [ ] **DOCS-08**: "Where the help bubble used to be" — every removed Jobputer help affordance points to a corresponding docs page.

### Schema Cleanup (SCHEMA)

- [ ] **SCHEMA-01**: `x402_servers.memeputer_name` usage audited end-to-end. At minimum: `apps/api/src/inngest/functions/sync-openrouter-models.ts` writer, any reader in `apps/api/src/`, RLS policies, indexes, foreign keys. Audit findings written to phase artifacts.
- [ ] **SCHEMA-02**: Decision made (inside Phase 34, not before): **rename** to a neutral name (e.g., `external_id`) **or** refactor writer + **drop** the column. Decision recorded in `.planning/PROJECT.md` Key Decisions table.
- [ ] **SCHEMA-03**: Migration written (UP + `_DOWN`) per `apps/api/migrations/README.md` numbered convention; whatever the decision, no data loss for currently populated rows.
- [ ] **SCHEMA-04**: All code that reads or writes the column is updated in the same phase (no stragglers across deploys).
- [ ] **SCHEMA-05**: RLS policies that referenced the column (if any) re-verified post-migration.

### Operator / Self-Hoster Migration (OPS)

- [ ] **OPS-01**: `CHANGELOG.md` added at repo root (if not present) and v3.1 entry documents every env var that changed default + every removed Memeputer URL + both new fee wallet addresses (`FEE_COLLECTION_SOLANA_ADDRESS`, `FEE_COLLECTION_BASE_ADDRESS`) with Solscan and Basescan explorer links (on-chain-verifiable, replaces the wallet-publication-in-announcement responsibility from former ANNOUNCE-04).
- [ ] **OPS-02**: `apps/api/env.example` reflects the new fee endpoint defaults; old `PLATFORM_FEE_URL` value commented as deprecated for one release.
- [ ] **OPS-03**: Self-hoster migration guide added at `/docs/self-hosting/v3.1-upgrade` (or equivalent location) covering env-var deltas, new fee-wallet address verification, in-flight job grandfathering.
- [ ] **OPS-04**: Backward-compatibility shim path is **not** added — clean cut-over per project convention. Documented as such in `CHANGELOG.md` (and in the self-hoster migration guide produced by Phase 33).

---

## Removed during milestone

Requirements that were part of the original v3.1 scope but explicitly removed (not deferred) during planning. Kept here for historical traceability — these are NOT counted in milestone coverage.

### Announcement (ANNOUNCE) — REMOVED 2026-05-17

**Removed 2026-05-17 during Phase 32 discuss-phase per user decision.** v3.1 ships without a public announcement (no X thread, no LinkedIn post, no blog post, no announce-trigger gate). Wallet-publication responsibility moved to CHANGELOG.md via OPS-01. Original text preserved below for reference:

- ~~**ANNOUNCE-01**: X / Twitter thread drafted (independence + price-cut combined narrative).~~
- ~~**ANNOUNCE-02**: LinkedIn long-form post drafted (story-driven, links to docs + CHANGELOG).~~
- ~~**ANNOUNCE-03**: Blog post drafted if a `/blog` surface exists or is added in this milestone; otherwise deferred.~~
- ~~**ANNOUNCE-04**: Fee wallet address published in the announcement, on-chain-verifiably (so users can confirm the address is real and the fee % is exactly what's claimed).~~
- ~~**ANNOUNCE-05**: Announcement posts published only after Phase 32 ships to prod (fee endpoint live before the headline).~~

---

## v3.2+ Requirements (deferred)

Tracked but not in current roadmap.

### Agent SDK + skill.md (originally in v3.0 scope, deferred)

- **AGENT-01**: `packages/sdk` exposes a programmatic agent interface so an LLM can build and run x402 workflows with its own wallet.
- **AGENT-02**: `skill.md` (or equivalent agent-readable skill file) is generated alongside the SDK so agents can self-onboard.
- **AGENT-03**: Live LLM demo (Claude or otherwise) consuming the skill file to run a workflow.

These were on the v3.0 roadmap (Phases 32-33 in the original scope doc) but deferred when the decouple work jumped ahead. Likely the next milestone (v3.2) after v3.1 ships.

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Changing the BSL 1.1 Licensor entity | Memeputer LLC remains Licensor per CLAUDE.md hard-lock — operational decouple ≠ legal decouple |
| Replacement mascot / x402.jobs-native persona | User explicitly chose "docs only" — no new character to design, build, host |
| Cross-chain fee settlement | Same-network charging matches current behavior; cross-chain is a separate, much bigger problem |
| Backfilling in-flight jobs to the new fee mechanism | Fee config is snapshotted at job-creation; only new jobs route to the new endpoint |
| Backward-compatibility shim for the old `agents.memeputer.com` endpoint | Clean cut-over per project convention; shims rot |
| Full agent SDK (AGENT-01/02/03) | Deferred to v3.2 — not blocking the decouple-and-price-cut narrative |
| `/blog` infrastructure | Announcement removed from milestone 2026-05-17 — no public announcement means no blog need |
| Renaming the `x402_servers` table itself | Out of scope — only the `memeputer_name` column is in play |

---

## Traceability

Which phases cover which requirements. Updated by `gsd-roadmapper`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FEE-01 | 32 | Pending |
| FEE-02 | 32 | Pending |
| FEE-03 | 32 | Pending |
| FEE-04 | 32 | Pending |
| FEE-05 | 32 | Pending |
| FEE-06 | 32 | Pending |
| FEE-07 | 32 | Pending |
| FEE-08 | 32 | Pending |
| FEE-09 | 32 | Pending |
| FEE-10 | 32 | Pending |
| UI-01 | 33 | Pending |
| UI-02 | 33 | Pending |
| UI-03 | 33 | Pending |
| UI-04 | 33 | Pending |
| UI-05 | 33 | Pending |
| UI-06 | 33 | Pending |
| UI-07 | 33 | Pending |
| DOCS-01 | 33 | Pending |
| DOCS-02 | 33 | Pending |
| DOCS-03 | 33 | Pending |
| DOCS-04 | 33 | Pending |
| DOCS-05 | 33 | Pending |
| DOCS-06 | 33 | Pending |
| DOCS-07 | 33 | Pending |
| DOCS-08 | 33 | Pending |
| SCHEMA-01 | 34 | Pending |
| SCHEMA-02 | 34 | Pending |
| SCHEMA-03 | 34 | Pending |
| SCHEMA-04 | 34 | Pending |
| SCHEMA-05 | 34 | Pending |
| OPS-01 | 32 | Pending |
| OPS-02 | 32 | Pending |
| OPS-03 | 33 | Pending |
| OPS-04 | 32 | Pending |

**Coverage:**
- v3.1 requirements: 34 total (after ANNOUNCE-01..05 removal 2026-05-17)
- Mapped to phases: 34 ✓
- Unmapped: 0
- Removed from milestone: 5 (ANNOUNCE-01..05 — see "Removed during milestone" above)

**Phase distribution:**
- Phase 32 (Platform Fee Replacement): 13 requirements (FEE-01..10, OPS-01, OPS-02, OPS-04)
- Phase 33 (Jobputer Removal + Docs Investment): 16 requirements (UI-01..07, DOCS-01..08, OPS-03)
- Phase 34 (Schema Cleanup): 5 requirements (SCHEMA-01..05)

---

*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 — ANNOUNCE-01..05 removed from milestone during Phase 32 discuss-phase (34/34 mapped after removal)*
