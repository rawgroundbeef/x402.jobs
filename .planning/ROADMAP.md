# Roadmap: v3.1 Decouple from Memeputer / Jobputer infrastructure

**Created:** 2026-05-17
**Milestone:** v3.1
**Phases:** 3 (Phases 32-34, continuing numbering from v3.0 Phase 31)
**Coverage:** 39/39 requirements mapped
**Granularity:** fine

## Overview

Remove every operational + UI dependency on Memeputer-owned services so a fork of `x402.jobs` is fully self-runnable. Ship a combined "fee reduction + going independent" announcement. The BSL 1.1 Licensor (Memeputer LLC) is **not** changing — this is operational/UI decoupling, not legal.

Three phases, sequenced by leverage and risk:

1. **Phase 32 — Platform Fee Replacement + Announcement.** Highest leverage, gets the announcement narrative out the door. Replaces `agents.memeputer.com` with a self-hosted x402 fee endpoint, lowers the rate, ships the combined "independence + price cut" announcement.
2. **Phase 33 — Jobputer Removal + Docs Investment.** Largest surface area. Strips the persona from ~14 production files and fills the help-vacuum with new docs. Includes the self-hoster migration guide (which references Phase 32's new fee endpoint).
3. **Phase 34 — Schema Cleanup.** Smallest scope, ships last. Audits the `memeputer_name` column, decides rename-vs-drop, applies the migration.

> **Architecture posture:** Same-network fee charging is preserved (Solana jobs settle Solana fees, Base jobs settle Base fees). In-flight jobs are grandfathered — fee config is snapshotted at job-creation, no backfill. Self-hosters get a clean cut-over (no compatibility shim).

## Phases

- [ ] **Phase 32: Platform Fee Replacement + Announcement** — Self-hosted x402 fee endpoint live, rate lowered, announcement shipped.
- [ ] **Phase 33: Jobputer Removal + Docs Investment** — Persona stripped from production code; `/docs` expanded to fill the help-vacuum.
- [ ] **Phase 34: Schema Cleanup** — `x402_servers.memeputer_name` audited and resolved (rename or drop) via migration.

## Phase Details

### Phase 32: Platform Fee Replacement + Announcement

**Directory:** `32-platform-fee-replacement`
**Goal:** x402.jobs operates its own self-hosted x402 fee endpoint at a lower rate, with the "independence + price cut" announcement live and the new fee wallet address on-chain-verifiable.

**Dependencies:** None (first phase of v3.1; Phase 31 monorepo merge already shipped)

**Requirements (18):**

- FEE-01: Self-hosted fee endpoint under `api.x402.jobs/x402/fees/{solana,base}/...`
- FEE-02: Implemented with the OpenFacilitator SDK (verify + settle)
- FEE-03: 402 response payload validates against `x402lint`
- FEE-04: Same-network charging preserved (Solana → Solana, Base → Base)
- FEE-05: Platform fee rate reduced from `max(1.5%, $0.01)` to new rate (target 1%; locked in discuss-phase before implementation)
- FEE-06: New fee-collection wallet — cold-storage or multisig, not an operational hot wallet
- FEE-07: `PLATFORM_FEE_URL` / `PLATFORM_FEE_PERCENTAGE` defaults updated; new fee-wallet env vars documented in `apps/api/env.example`
- FEE-08: All `agents.memeputer.com` URLs removed from production paths; `charge-platform-fee.ts` and call sites updated
- FEE-09: Refund flow (`apps/api/src/routes/refunds.ts`) audited end-to-end with the new endpoint
- FEE-10: In-flight jobs at cut-over grandfathered (fee config snapshotted at job-creation; verified by test)
- OPS-01: `CHANGELOG.md` v3.1 entry documents env var changes + removed Memeputer URLs
- OPS-02: `apps/api/env.example` reflects new defaults; old `PLATFORM_FEE_URL` commented as deprecated for one release
- OPS-04: No backward-compatibility shim added (clean cut-over per project convention; documented in announcement)
- ANNOUNCE-01: X / Twitter thread drafted (independence + price-cut combined narrative)
- ANNOUNCE-02: LinkedIn long-form post drafted (story-driven, links to docs + CHANGELOG)
- ANNOUNCE-03: Blog post drafted if `/blog` surface exists; otherwise deferred
- ANNOUNCE-04: Fee wallet address published in the announcement, on-chain-verifiably
- ANNOUNCE-05: Announcement posts published only after the fee endpoint is live in prod

**Success Criteria** (what must be TRUE):

1. A new job submitted on Solana settles its platform fee through `api.x402.jobs/x402/fees/solana/...` (not `agents.memeputer.com`); same flow holds for Base on the Base fee endpoint.
2. The platform fee rate charged on a new job is the new locked rate (target 1%, $0.01 minimum preserved), verifiable by inspecting the 402 response with `x402lint`.
3. A job that partially fails returns the correct fee-aware refund through `routes/refunds.ts` with the new endpoint (no double-charge, no missed refund).
4. A job in flight at cut-over completes against its snapshotted fee config — verified by automated test, not just manual observation.
5. The fee-collection wallet address is published in the X thread + LinkedIn post + CHANGELOG, and the on-chain balance is verifiable by anyone reading the announcement.

**Plans:** TBD

**Notes:**
- Per PROJECT.md Key Decisions: D-1 is settled as **option (b)** — self-hosted x402 fee endpoint (not direct USDC transfer, not fee-in-pricing). OpenFacilitator SDK + x402lint validation. Final fee % locked in the Phase 32 discuss step before implementation begins.
- Announcement copy lives in Phase 32 artifacts (drafts) and only goes live once SC1-4 are green in prod (gated by ANNOUNCE-05).
- This phase does **not** include the self-hoster migration guide (`/docs/self-hosting/v3.1-upgrade`) — that's OPS-03 and lives in Phase 33 alongside the docs investment. The CHANGELOG.md entry (OPS-01) and env.example update (OPS-02) are here because they ride with the code changes.

---

### Phase 33: Jobputer Removal + Docs Investment

**Directory:** `33-jobputer-removal-docs`
**Goal:** Every Jobputer reference is gone from production code, and the help-vacuum is filled by an expanded `/docs` (including the self-hoster migration guide) so a forker has a working onboarding path without the persona.

**Dependencies:** Phase 32 (the self-hoster migration guide references the new fee endpoint env vars; the "where the help bubble used to be" docs links reference content that needs Phase 32's fee narrative to be accurate)

**Requirements (16):**

- UI-01: `JobputerChatButton.tsx`, `AskJobputerModal.tsx`, plus wiring through `ModalContext.tsx` / `GlobalModals.tsx` removed from `apps/web/`
- UI-02: `JOBPUTER_AVATAR_URL`, `JOBPUTER_HELP_URL`, `JOBPUTER_POST_JOB_REQUEST_URL` removed from `apps/web/src/lib/config.ts` and any other config files
- UI-03: Jobputer references in `BaseLayout.tsx`, `JobCanvas.tsx`, `CreateWorkflowDialog.tsx`, `TransformConfigModal.tsx`, `TransformConfigPanel.tsx` removed or replaced with neutral copy
- UI-04: API routes `routes/ask-jobputer.ts` + Jobputer references in `hiring.ts`, `workflow-chat.ts`, `resources.ts` removed or renamed away from the brand
- UI-05: `auth.memeputer.com` avatar URL absent from production code (frontend + backend)
- UI-06: No replacement mascot/persona introduced — help surfaces use docs links or neutral copy only
- UI-07: Visual regression check (manual screenshot diff) confirms no broken layout where Jobputer surfaces lived
- DOCS-01: Existing `/docs` pages audited (`getting-started`, `developer`, `resources`, `examples`, `errors`, `long-running-resources`); gaps listed
- DOCS-02: New `/docs/sdk-quickstart` page (packages/sdk install + first-call example)
- DOCS-03: New `/docs/x402-primer` page (402 response, accepts[], facilitator verify/settle)
- DOCS-04: New `/docs/recipes` page with 3+ workflow recipes (link-existing, proxy, prompt-template)
- DOCS-05: New `/docs/troubleshooting` page covering most common `errors.ts` mappings
- DOCS-06: New `/docs/agents` section scoped for the agent-developer audience (minimum viable entry)
- DOCS-07: Docs nav/sidebar updated so new pages are discoverable from `/docs` root
- DOCS-08: Every removed Jobputer help affordance points to a corresponding docs page
- OPS-03: Self-hoster migration guide at `/docs/self-hosting/v3.1-upgrade` covering env-var deltas, new fee-wallet address verification, in-flight job grandfathering

**Success Criteria** (what must be TRUE):

1. `grep -r "Jobputer\|jobputer\|JOBPUTER" apps/` returns no matches in production source files (test/migration/doc-archive references explicitly allowed).
2. `grep -r "memeputer\.com" apps/` returns no matches in production source files (avatar URL, help URL, post-job-request URL all gone).
3. A new visitor lands on `/docs` and can discover all five new pages (sdk-quickstart, x402-primer, recipes, troubleshooting, agents) from the docs nav without manual URL guessing.
4. Every UI surface where the Jobputer help bubble used to live either renders neutral copy or links to the appropriate docs page (manual screenshot diff confirms no layout breakage).
5. A self-hoster following `/docs/self-hosting/v3.1-upgrade` can update their env vars, verify the new fee-wallet address on-chain, and start a job that routes its fee through the new endpoint — without reading any other source file.

**Plans:** TBD

**UI hint**: yes

**Notes:**
- This is the largest surface-area phase. Discuss-step should produce a Jobputer-touchpoint inventory before plan generation begins (the 14-file count in the todo is approximate; audit confirms exact scope).
- OPS-03 (self-hoster migration guide) is intentionally here — not in Phase 32 — because the docs surface is being built out in this phase and the migration guide is one of the new pages.
- Per PROJECT.md Key Decisions: D-2 is settled as **"docs only"** — no replacement mascot. Help surfaces use docs links or neutral copy.

---

### Phase 34: Schema Cleanup

**Directory:** `34-schema-cleanup-memeputer-name`
**Goal:** The `x402_servers.memeputer_name` column is resolved (rename to neutral or drop) via a numbered UP/DOWN migration, with all readers and the writer in `sync-openrouter-models.ts` updated in the same phase.

**Dependencies:** None hard (can run after Phase 32 in parallel with Phase 33 if desired); shipped last for smallest scope / lowest narrative coupling.

**Requirements (5):**

- SCHEMA-01: End-to-end audit of `memeputer_name` — writer in `apps/api/src/inngest/functions/sync-openrouter-models.ts`, any reader in `apps/api/src/`, RLS policies, indexes, foreign keys. Audit findings written to phase artifacts.
- SCHEMA-02: Decision made inside Phase 34 (not before): rename to neutral (e.g., `external_id`) OR refactor writer + drop. Decision recorded in `.planning/PROJECT.md` Key Decisions table.
- SCHEMA-03: Migration written (UP + `_DOWN`) per `apps/api/migrations/README.md` numbered convention; no data loss for currently populated rows.
- SCHEMA-04: All code reading or writing the column updated in the same phase (no stragglers across deploys).
- SCHEMA-05: RLS policies referencing the column (if any) re-verified post-migration.

**Success Criteria** (what must be TRUE):

1. The audit document in `.planning/phases/34-schema-cleanup-memeputer-name/` lists every reader, every writer, and every RLS/index/FK reference to `memeputer_name` — found before any code change is made.
2. The PROJECT.md Key Decisions table has a new row recording the rename-vs-drop choice with rationale (decided inside this phase, not before).
3. The numbered migration (UP + `_DOWN`) applies cleanly against a production-shaped database with no data loss for currently populated rows; the `_DOWN` rolls back the change.
4. After the migration is applied, the OpenRouter model sync (`sync-openrouter-models.ts`) runs successfully — proving the writer was updated in lockstep with the schema change.
5. `grep -r "memeputer_name" apps/` returns no matches in production source files (post-migration); the column name appears only in archived migration files and audit artifacts.

**Plans:** TBD

**Notes:**
- Per PROJECT.md Key Decisions: D-3 is **explicitly deferred to this phase**. The discuss step must produce the SCHEMA-01 audit before SCHEMA-02 (the rename-vs-drop decision) is made.
- Migration follows the project convention: flat numbered with UP + `_DOWN` variants in `apps/api/migrations/`. Apply via Supabase Dashboard SQL Editor or `psql` per `apps/api/migrations/README.md`.
- No announcement narrative here — this is internal cleanup. Phase 32's announcement is already out by the time this ships.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32 - Platform Fee Replacement + Announcement | 0/TBD | Not started | — |
| 33 - Jobputer Removal + Docs Investment | 0/TBD | Not started | — |
| 34 - Schema Cleanup | 0/TBD | Not started | — |

---

## Dependency Graph

```
Phase 32 (Platform Fee Replacement + Announcement)
    |
    | (new fee endpoint live → self-hoster migration guide references it;
    |  announcement narrative sets up docs-as-help-replacement)
    v
Phase 33 (Jobputer Removal + Docs Investment)

Phase 34 (Schema Cleanup) — independent; can ship in parallel with Phase 33
                            if desired, but planned to ship last for clean
                            small-scope finish.
```

Phase 32 ships first because it carries the announcement narrative — the headline is the price cut, which can't go out until the new endpoint is live (ANNOUNCE-05 gates this). Phase 33 follows because the self-hoster migration guide (OPS-03) references Phase 32's new fee env vars, and the "where the help bubble used to be → docs link" wiring requires the new docs pages to exist. Phase 34 is independent; ordering it last keeps the schema migration risk decoupled from the announcement.

---

## Coverage

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
| ANNOUNCE-01 | 32 | Pending |
| ANNOUNCE-02 | 32 | Pending |
| ANNOUNCE-03 | 32 | Pending |
| ANNOUNCE-04 | 32 | Pending |
| ANNOUNCE-05 | 32 | Pending |

**Mapped: 39/39** — all v3.1 requirements covered, no orphans, no duplicates.

By phase:
- **Phase 32:** 18 requirements (FEE-01..10, OPS-01, OPS-02, OPS-04, ANNOUNCE-01..05)
- **Phase 33:** 16 requirements (UI-01..07, DOCS-01..08, OPS-03)
- **Phase 34:** 5 requirements (SCHEMA-01..05)

---

## Design Notes

**Why three phases (not splitting fee from announcement):** The user's stated marketing angle requires the price cut and the going-independent story to ship as one combined announcement. Splitting the announcement into a separate phase would either (a) ship code without the narrative landing, leaving the headline orphaned, or (b) gate code merge behind narrative polish, slowing the engineering work. Keeping them together with ANNOUNCE-05 as the gate ("publish only after fee endpoint is live") preserves both the engineering velocity and the narrative integrity.

**Why OPS-03 (self-hoster migration guide) is in Phase 33, not 32:** The migration guide is a docs page. The docs surface is being built out in Phase 33. Splitting OPS-03 across phases would mean a half-built docs nav after Phase 32. Keeping it with the docs investment means the docs surface ships as a coherent whole.

**Why Phase 34 ships last:** Schema migrations carry deploy risk (RLS, FK, index gotchas). Sequencing it last decouples that risk from the announcement narrative. Phase 32 + Phase 33 can ship without Phase 34; if Phase 34 hits a snag, the announcement is already out and the persona is already gone.

**In-flight job semantics:** Per the v3.1 PROJECT.md Out of Scope list, we do **not** backfill in-flight jobs to the new fee mechanism. Fee config is snapshotted at job-creation. FEE-10 makes this explicit and requires a test to verify the behavior — this is the load-bearing constraint that lets us cut over cleanly without a compatibility shim (OPS-04).

**Locked decisions** (from PROJECT.md Key Decisions — do not re-litigate in discuss steps):
- D-1: Self-hosted fee endpoint via OpenFacilitator SDK, 402 responses validated with x402lint, same-network charging preserved. Final fee % locked in Phase 32 discuss step before implementation (target 1%, $0.01 minimum preserved).
- D-2: No replacement mascot. Docs only.
- D-3: `memeputer_name` rename-vs-drop decision deferred to Phase 34 (audit-driven).
- Memeputer LLC remains BSL 1.1 Licensor — CLAUDE.md hard-lock. This milestone is operational/UI decoupling, not legal.

---

_Roadmap created: 2026-05-17_
