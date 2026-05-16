# Roadmap: Resource Registration Redesign

**Created:** 2026-01-30
**Milestone:** v2.0
**Phases:** 7 (Phases 19-25)
**Coverage:** 51/51 requirements mapped

## Overview

Replace the cramped CreateResourceModal with a full-page wizard at `/resources/new`. The wizard consolidates 4 resource creation flows (Link Existing, Proxy, Claude Prompt, OpenRouter) into one unified experience with shared steps for resource details and review. URL-based routing, session storage persistence, and x402check validation integration provide a dramatically better creation experience, especially on mobile.

## Phases

### Phase 19: Wizard Shell & Type Selection

**Goal:** Users can navigate to `/resources/new` and see a full-page wizard with type selection cards.

**Dependencies:** None (foundation phase)

**Plans:** 2 plans

Plans:
- [ ] 19-01-PLAN.md -- Wizard infrastructure (session storage helpers + WizardShell component)
- [ ] 19-02-PLAN.md -- Type selection page + route stubs with deep link protection

**Requirements:**

- WIZD-01: Full-page wizard renders at `/resources/new` with consistent layout
- WIZD-02: Step indicator shows current position (e.g., "Step 1 of 3")
- WIZD-03: Back button navigates to previous step
- WIZD-04: Cancel button returns to resources page
- WIZD-05: Continue button advances to next step (disabled when form invalid)
- WIZD-06: URL routing maps each step to a distinct path
- WIZD-07: Wizard state persists in session storage across page refreshes
- WIZD-08: Wizard layout is mobile-responsive (stacks naturally on small screens)
- TYPE-01: Step 1 shows 4 resource type cards: Link Existing, Proxy, Claude Prompt, OpenRouter
- TYPE-02: Link Existing card is visually primary (most common path)
- TYPE-03: Create options grouped under "Create Something New" divider
- TYPE-04: Clicking a type card navigates to that type's Step 2 route

**Success Criteria:**

1. User navigates to `/resources/new` and sees a full-page wizard with step indicator showing "Step 1 of 3"
2. Four type cards are displayed: Link Existing (visually primary), Proxy, Claude Prompt, and OpenRouter (grouped under divider)
3. Clicking any type card navigates to a distinct URL (e.g., `/resources/new/link`) and the step indicator updates
4. Back, Cancel, and Continue buttons work correctly (Cancel returns to resources page, Back goes to previous step, Continue disabled when no selection made)
5. Refreshing the page restores wizard state from session storage

---

### Phase 20: Shared Details & Review

**Goal:** Users can fill in resource details and review their configuration before publishing, regardless of resource type.

**Dependencies:** Phase 19 (needs wizard shell and routing)

**Plans:** 2 plans

Plans:
- [x] 20-01-PLAN.md -- Shared details form (name, slug, description, image, category, price, network) with validation and slug auto-generation
- [x] 20-02-PLAN.md -- Review summary page with edit links and publish-to-backend functionality

**Requirements:**

- DETL-01: Name field (required)
- DETL-02: URL slug field with auto-generation from name, shown as `/@username/slug`
- DETL-03: Description textarea
- DETL-04: Image field (URL input or upload)
- DETL-05: Category dropdown
- DETL-06: Price field in USDC (minimum $0.01)
- DETL-07: Network selector (Base, Solana) -- pre-filled for Link Existing
- DETL-08: Continue button enabled when required fields filled
- REVW-01: Summary card shows all resource configuration
- REVW-02: Each section has Edit link that navigates back to relevant step
- REVW-03: Validation summary shown for Link Existing type
- REVW-04: Publish Resource button submits to backend
- REVW-05: Success state redirects to new resource's detail page

**Success Criteria:**

1. User can fill in name, slug (auto-generated from name, displayed as `/@username/slug`), description, image, category, price, and network on the details step
2. Continue button is disabled until required fields (name, price, network) are filled
3. Review step displays a summary card showing all configured resource information with Edit links that navigate back to the correct step
4. Publish Resource button submits the resource to the backend and redirects to the new resource's detail page on success
5. Network and price fields accept pre-filled values (wired when Link Existing path is built)

---

### Phase 21: Link Existing Path

**Goal:** Users can validate an existing x402 endpoint and create a resource from it, with full x402check results displayed in the wizard.

**Dependencies:** Phase 19 (wizard shell), Phase 20 (details and review steps)

**Plans:** 2 plans

Plans:
- [x] 21-01-PLAN.md -- Link validation page with URL input, HTTP method dropdown, x402check validation, and VerifyResultDetails display
- [x] 21-02-PLAN.md -- Pre-fill details step (locked network/price) and link config display on review page

**Requirements:**

- LINK-01: URL input field with HTTP method dropdown (GET, POST, PUT, DELETE)
- LINK-02: Validate Endpoint button triggers x402check validation
- LINK-03: Validation results display with verdict, error count, warning count
- LINK-04: Expandable sections for warnings, parsed config, endpoint checks, response body
- LINK-05: Parsed config shows detected chain, address, amount, format
- LINK-06: Invalid endpoint blocks Continue button (must fix and re-validate)
- LINK-07: Valid endpoint pre-fills network and price in details step
- LINK-08: x402check components imported from x402check package

**Success Criteria:**

1. User enters a URL, selects HTTP method, and clicks Validate Endpoint to trigger x402check validation with results displaying verdict, error/warning counts, and expandable detail sections
2. Invalid endpoint result disables the Continue button until the user re-validates with a valid endpoint
3. Valid endpoint automatically pre-fills network and price in the details step
4. x402check validation components are imported from the x402check package (not rebuilt)
5. User can complete the full flow: enter URL, validate, fill details, review, and publish a Link Existing resource

---

### Phase 22: Proxy Path

**Goal:** Users can wrap a non-x402 URL with x402 payment protection by configuring origin URL, method, and optional headers.

**Dependencies:** Phase 19 (wizard shell), Phase 20 (details and review steps)

**Plans:** 1 plan

Plans:
- [x] 22-01-PLAN.md -- Proxy config page with origin URL, HTTP method button group, collapsible auth header, plus details preservation and review display

**Requirements:**

- PRXY-01: Origin URL input field for non-x402 endpoint
- PRXY-02: HTTP method selector (GET, POST, PUT, DELETE)
- PRXY-03: Optional headers section with add/remove capability
- PRXY-04: Continue button enabled when URL is provided

**Success Criteria:**

1. User can enter an origin URL and select an HTTP method for the endpoint to proxy
2. User can add and remove optional custom headers (key-value pairs)
3. Continue button is enabled once a URL is provided and disabled when empty
4. User can complete the full flow: configure proxy, fill details, review, and publish a Proxy resource

---

### Phase 23: Claude Prompt Path

**Goal:** Users can create a Claude prompt template resource with system prompt, parameters, and model configuration.

**Dependencies:** Phase 19 (wizard shell), Phase 20 (details and review steps)

**Plans:** 1 plan

Plans:
- [x] 23-01-PLAN.md -- Claude prompt config page with API key check, system prompt textarea, parameter definitions, max tokens, plus details preservation and review display

**Requirements:**

- CLPT-01: Warning banner shown if user has no Claude API key configured, with link to Settings
- CLPT-02: System prompt textarea for template content
- CLPT-03: Parameter definitions with `{param}{/param}` syntax support
- CLPT-04: Max tokens configuration
- CLPT-05: Continue button blocked until API key is configured

**Success Criteria:**

1. User without a Claude API key sees a warning banner with a link to Settings, and the Continue button is blocked
2. User with a Claude API key can write a system prompt and define parameters using `{param}{/param}` syntax
3. User can configure max tokens for the model
4. User can complete the full flow: configure prompt, fill details, review, and publish a Claude Prompt resource

---

### Phase 24: OpenRouter Path

**Goal:** Users can browse models, configure a prompt template with parameters, and create an OpenRouter-powered resource.

**Dependencies:** Phase 19 (wizard shell), Phase 20 (details and review steps)

**Plans:** 1 plan

Plans:
- [x] 24-01-PLAN.md -- OpenRouter config page with API key check, model browser, system prompt textarea, parameter definitions, temperature, max tokens, plus details preservation and review display

**Requirements:**

- ORTR-01: Warning banner shown if user has no OpenRouter API key configured, with link to Settings
- ORTR-02: Model browser with search and filters (modality, provider, price)
- ORTR-03: Curated popular models shown by default
- ORTR-04: Prompt template editor with `{param}{/param}` syntax support
- ORTR-05: Parameter definitions (name, description, required)
- ORTR-06: Model config (temperature, max_tokens)
- ORTR-07: Continue button blocked until API key configured and model selected

**Success Criteria:**

1. User without an OpenRouter API key sees a warning banner with a link to Settings, and the Continue button is blocked
2. User can browse curated popular models by default and search/filter the full catalog by modality, provider, and price
3. User can write a prompt template with `{param}{/param}` syntax and define parameters with name, description, and required flag
4. User can configure model parameters (temperature, max_tokens)
5. User can complete the full flow: select model, configure prompt, fill details, review, and publish an OpenRouter resource

---

### Phase 25: Cleanup & Migration

**Goal:** Old CreateResourceModal is removed and all entry points redirect to the new wizard.

**Dependencies:** Phases 21-24 (all paths must be functional before removing old modal)

**Plans:** 1 plan

Plans:
- [x] 25-01-PLAN.md -- Remove CreateResourceModal and RegisterResourceModal, clean ModalContext, switch dashboard edit to ResourceEditModal

**Requirements:**

- CLNP-01: Old CreateResourceModal component removed
- CLNP-02: All entry points that opened the modal now navigate to `/resources/new`

**Success Criteria:**

1. CreateResourceModal component and its imports are fully removed from the codebase
2. Every button/link that previously opened the CreateResourceModal now navigates to `/resources/new`
3. No references to the old modal remain in the codebase

---

### Phase 26: Fix Link Existing Publish

**Goal:** Link Existing resources publish successfully by routing to the correct API endpoint for external resource registration.

**Dependencies:** Phase 21 (Link Existing path exists but publish fails)

**Plans:** 1 plan

Plans:
- [x] 26-01-PLAN.md -- Route Link Existing publish to POST /api/resources/ instead of /api/resources/instant

**Requirements:**

- REVW-04: Publish Resource button submits to backend (currently PARTIAL — fails for Link Existing)
- LINK-07: Valid endpoint pre-fills network and price in details step (currently PARTIAL — pre-fill works but publish fails)

**Gap Closure:** Closes gaps from v2.0 milestone audit:
- Requirement: LINK-07/REVW-04 Link Existing publish fails
- Integration: review/page.tsx TYPE_TO_API maps link→"external" but /resources/instant rejects "external"
- Flow: Link Existing E2E broken at publish step (400 error)

**Success Criteria:**

1. User can complete the full Link Existing flow: enter URL, validate, fill details, review, and publish
2. Published Link Existing resource appears on the creator's dashboard and has a working detail page
3. Proxy, Claude Prompt, and OpenRouter publish flows continue to work unchanged

---

## Progress

| Phase                              | Status   | Plans | Requirements             |
| ---------------------------------- | -------- | ----- | ------------------------ |
| 19 - Wizard Shell & Type Selection | Complete | 2/2   | WIZD-01..08, TYPE-01..04 |
| 20 - Shared Details & Review       | Complete | 2/2   | DETL-01..08, REVW-01..05 |
| 21 - Link Existing Path            | Complete | 2/2   | LINK-01..08              |
| 22 - Proxy Path                    | Complete | 1/1   | PRXY-01..04              |
| 23 - Claude Prompt Path            | Complete | 1/1   | CLPT-01..05              |
| 24 - OpenRouter Path               | Complete | 1/1   | ORTR-01..07              |
| 25 - Cleanup & Migration           | Complete | 1/1   | CLNP-01..02              |
| 26 - Fix Link Existing Publish     | Complete | 1/1   | REVW-04, LINK-07         |

**Total:** 11/11 plans complete (Phases 19-26, all complete)

---

## Dependency Graph

```
Phase 19 (Wizard Shell & Type Selection)
    |
    v
Phase 20 (Shared Details & Review)
    |
    +---> Phase 21 (Link Existing Path) ----+
    |                                        |
    +---> Phase 22 (Proxy Path) ------------+
    |                                        |
    +---> Phase 23 (Claude Prompt Path) ----+
    |                                        |
    +---> Phase 24 (OpenRouter Path) -------+
                                             |
                                             v
                                     Phase 25 (Cleanup & Migration)
                                             |
                                             v
                                     Phase 26 (Fix Link Existing Publish)
```

Phases 21-24 are independent of each other and can be built in any order. Each becomes end-to-end functional immediately because the shared Details and Review steps (Phase 20) are already in place. Phase 26 is a gap closure phase that fixes the Link Existing publish flow identified in the milestone audit.

---

## Coverage

| Requirement | Phase |
| ----------- | ----- |
| WIZD-01     | 19    |
| WIZD-02     | 19    |
| WIZD-03     | 19    |
| WIZD-04     | 19    |
| WIZD-05     | 19    |
| WIZD-06     | 19    |
| WIZD-07     | 19    |
| WIZD-08     | 19    |
| TYPE-01     | 19    |
| TYPE-02     | 19    |
| TYPE-03     | 19    |
| TYPE-04     | 19    |
| DETL-01     | 20    |
| DETL-02     | 20    |
| DETL-03     | 20    |
| DETL-04     | 20    |
| DETL-05     | 20    |
| DETL-06     | 20    |
| DETL-07     | 20    |
| DETL-08     | 20    |
| REVW-01     | 20    |
| REVW-02     | 20    |
| REVW-03     | 20    |
| REVW-04     | 20, 26 |
| REVW-05     | 20    |
| LINK-01     | 21    |
| LINK-02     | 21    |
| LINK-03     | 21    |
| LINK-04     | 21    |
| LINK-05     | 21    |
| LINK-06     | 21    |
| LINK-07     | 21, 26 |
| LINK-08     | 21    |
| PRXY-01     | 22    |
| PRXY-02     | 22    |
| PRXY-03     | 22    |
| PRXY-04     | 22    |
| CLPT-01     | 23    |
| CLPT-02     | 23    |
| CLPT-03     | 23    |
| CLPT-04     | 23    |
| CLPT-05     | 23    |
| ORTR-01     | 24    |
| ORTR-02     | 24    |
| ORTR-03     | 24    |
| ORTR-04     | 24    |
| ORTR-05     | 24    |
| ORTR-06     | 24    |
| ORTR-07     | 24    |
| CLNP-01     | 25    |
| CLNP-02     | 25    |

**Mapped: 51/51** -- all v2.0 requirements covered, no orphans.

---

## Design Notes

**Phase ordering rationale:** Shared Details & Review (Phase 20) is built immediately after the wizard shell so that every subsequent path phase (21-24) produces an end-to-end testable flow. This avoids the anti-pattern of building 4 incomplete paths that all become complete at once.

**Adaptation from existing modal:** Phases 23 and 24 adapt existing CreateResourceModal components (prompt editor, model browser, parameter definitions) into wizard step format. This is a UI restructuring, not a rebuild.

**x402check integration (Phase 21):** Components are imported from the x402check package, not rebuilt. The wizard provides a full-width container for validation results that the modal could not.

---

## v3.0 Milestone Phases (Open Source + Agent-Native)

> v3.0 phases are scoped in `.planning/v3.0-MILESTONE-SCOPE.md`. Only phases that have advanced to active planning are detailed here. Phase 27 (Wallet Encryption) and Phase 29 (Bulk Resource Registration) shipped without separate ROADMAP entries — see their phase directories and `.planning/v3.0-MILESTONE-SCOPE.md` for context.

### Phase 28: Structured Security Review — HIGH Remediation

**Goal:** Ship all open HIGH-severity findings from `28-security-review/REVIEW.md` (HIGH-01..04, 06..13) as PR-sized batches before v3.0 public release. Phase 28 Criticals are already shipped; HIGH-05 was covered under CRIT-02. The remaining 12 HIGHs are grouped into 9 batches per `HIGHS-TRIAGE.md`.

**Dependencies:** Phase 27 (wallet encryption) merged; CRIT-07 (SSRF library) merged.

**Plans:** 9 plans (one per triage batch A-I)

Plans:
- [ ] 28-01-PLAN.md -- Batch A: trivial wins (HIGH-04 upload userId, HIGH-06 timing-safe escrow webhook, HIGH-12 payer/signature redaction)
- [ ] 28-02-PLAN.md -- Batch B: log/secret hygiene (HIGH-01 strip payment payloads from console.log)
- [ ] 28-03-PLAN.md -- Batch C: Solana payment verification (HIGH-07 recipient validation, HIGH-10 transferChecked + USDC mint match)
- [ ] 28-04-PLAN.md -- Batch D: money math precision (HIGH-08 Math.round or bigint USDC type)
- [ ] 28-05-PLAN.md -- Batch F: wallet export hardening (HIGH-11 audit table + rate limit + email confirm + re-auth)
- [ ] 28-06-PLAN.md -- Batch E: run-status URL signing (HIGH-09 HMAC-sign statusUrl, requires FE coordination)
- [ ] 28-07-PLAN.md -- Batch G: account-deletion balance check (HIGH-03 block if balance > $0.01, soft-delete + 30-day recovery)
- [ ] 28-08-PLAN.md -- Batch H: Twitter OAuth hardening (HIGH-02 state nonce + Redis/table + token encryption + state verify)
- [ ] 28-09-PLAN.md -- Batch I: SSRF library migration (HIGH-13 axios + request-filtering-agent, delete safe-fetch.ts)

**Requirements:**

- HIGH-01: Strip full Solana txn + EIP-3009 auth payloads from `console.log` in `inngest/utils/execute-x402.ts` and `routes/execute.ts`; retain only metadata (signature hash, network, amount)
- HIGH-02: Twitter OAuth — add `state` nonce on init, move `oauthRequests` from in-memory Map to Redis or `x402_oauth_pending` table with TTL, encrypt `access_token`/`access_secret` at rest, verify state on callback
- HIGH-03: Block account deletion if wallet balance > $0.01; require external withdrawal address or auto-sweep; wrap in DB transaction; introduce soft-delete with 30-day recovery window
- HIGH-04: `routes/upload.ts` must stop reading `userId` from request body; always use `req.user!.id` (prevent cross-user file planting)
- HIGH-06: Replace `===` on `webhook_secret` in `routes/escrow.ts` with `crypto.timingSafeEqual` + length pre-check
- HIGH-07: `verifySolanaPayment` in `routes/webhooks.ts` must validate `info.destination === recipient ATA`; resolve the `// TODO: Add recipient validation` marker
- HIGH-08: Replace `String(expectedAmount * 1_000_000)` with `String(Math.round(expectedAmount * 1_000_000))` (or migrate to `Usdc` bigint) in `routes/webhooks.ts` (lines 404, 627, 1120, 1569, 1849) and `routes/instant.ts` (lines 250, 369). Verify whether CRIT-04 already addressed before doing redundant work.
- HIGH-09: HMAC-sign the `statusUrl` returned in 202 responses in `routes/webhooks.ts` (lines 1279-1444, 2227-2365); coordinate frontend polling to thread signature
- HIGH-10: `verifySolanaPayment` must reject legacy `parsed.type === "transfer"` without explicit mint check; only accept `transferChecked` with USDC mint match
- HIGH-11: `/wallet/export-key` must write to `x402_wallet_export_audit` table, send out-of-band email confirmation, enforce `strictRateLimiter` per user, require recent re-auth (password re-prompt or fresh token within 5 min)
- HIGH-12: Truncate/hash `payer_address` and `payment_signature` in public response shapes in `routes/runs.ts` (lines 312-405) and `routes/wallet.ts` (lines 289-371)
- HIGH-13: Migrate `routes/upload.ts`, `routes/images.ts`, `routes/instant.ts` from custom `safeFetch` to `axios` + `request-filtering-agent`; delete `lib/safe-fetch.ts`; update post-fetch handlers for axios response shape

**Success Criteria:**

1. All 12 open HIGH findings are remediated (code fixed, tests added) or explicitly accepted with rationale recorded in REVIEW.md
2. `pnpm vitest run --exclude '**/resource-registration*'` passes at ≥ baseline test count after each batch
3. Each batch ships as its own PR in `rawgroundbeef/x402-jobs-api` (or unified repo if Phase 31 lands first)
4. `REVIEW.md` is updated with status per HIGH (FIXED / ACCEPTED + rationale)
5. Medium and Low findings filed as GitHub issues with target milestones (deferred to v3.1 unless trivial)
6. No regressions in payment, auth, or webhook flows on staging before public release

**Source documents (read first):**

- `.planning/phases/28-security-review/REVIEW.md` — full security review with line numbers and remediation guidance per finding
- `.planning/phases/28-security-review/HIGHS-TRIAGE.md` — batching, recommended order, and effort/risk per batch (treat as PRD)
- `.planning/phases/28-security-review/dep-audit.md` — `pnpm audit` results (context only; not in scope here)
- `.planning/v3.0-MILESTONE-SCOPE.md` — milestone context, honest limitations to document in SECURITY.md

**Implementation order (per HIGHS-TRIAGE.md):** A → B → C → D → F → E → G → H → I. Batches A, B, C, D, F have no inter-dependencies and may be parallelized.

---

### Phase 30: Supply Chain Hardening

**Goal:** Reduce supply-chain attack surface ahead of the public open-source release by upgrading to pnpm 10 and applying an `.npmrc` release-age policy that neutralizes most npm zero-days before they reach our installs.

**Dependencies:** Phase 28 HIGH remediation in flight (no hard blocker — can run in parallel). Must land before Phase 31 (Monorepo Merge + BSL) since the merged repo's CI must already be on pnpm 10.

**Plans:** 5 plans

Plans:
- [ ] 30-01-PLAN.md -- Bump root packageManager to pnpm@10.6.5 + declare pnpm.onlyBuiltDependencies; regenerate root pnpm-lock.yaml; verify local web build/dev (no .npmrc yet)
- [ ] 30-02-PLAN.md -- Flip apps/web/vercel.json pnpm pin to 10.6.5; verify Vercel deploy preview
- [ ] 30-03-PLAN.md -- Sibling api repo: Dockerfile + vercel.json + package.json pnpm@10.6.5 + add esbuild to onlyBuiltDependencies; verify Railway deploy
- [ ] 30-04-PLAN.md -- Add root .npmrc with minimum-release-age=4320 + minimum-release-age-exclude=@x402jobs/* (no frozen-lockfile per RESEARCH override); re-verify Vercel preview
- [ ] 30-05-PLAN.md -- Convergence verification: cross-repo pin audit + end-to-end smoke + 30-CONVERGENCE.md + 30-ROLLBACK.md + STATE.md update

**Scope:**

- Bump `packageManager` field in root `package.json` and the api Dockerfile to `pnpm@10.x`
- First install will surface lifecycle-script approvals; vet each and add the safe set to `pnpm.onlyBuiltDependencies` (likely `sharp`, `esbuild`, `better-sqlite3` if present)
- Add root `.npmrc` with:
  - `minimum-release-age=4320` (72-hour delay window — neutralizes most npm zero-days before they hit our installs)
  - `minimum-release-age-exclude=@x402jobs/*` (internal packages bypass the delay)
  - `frozen-lockfile=true` (CI safety)
- Verify Railway Dockerfile builds cleanly with the new pnpm version
- Document the policy in `SECURITY.md` (deferred to Phase 31 if SECURITY.md doesn't yet exist)

**Success Criteria:**

1. Both apps (`apps/web` once merged, and `x402jobs-api`) build cleanly under pnpm 10 locally and in CI
2. Root `.npmrc` is in place with the documented release-age policy and `frozen-lockfile=true`
3. `pnpm.onlyBuiltDependencies` allow-list contains only vetted entries; install completes without unapproved lifecycle scripts
4. Railway deploy of `x402jobs-api` succeeds on pnpm 10
5. Vercel deploy of `x402jobs` web app succeeds on pnpm 10
6. CI green on both repos (or unified repo if Phase 31 has landed first)

**Source documents (read first):**

- `.planning/v3.0-MILESTONE-SCOPE.md` — Phase 30 section, plus context on why this lands before Phase 31

**Risks:**

- pnpm 10 may break the Railway Dockerfile build (Low likelihood, Medium blast). Test locally first; have a revert commit ready.
- A required lifecycle script gets blocked by the new allow-list, breaking a build. Mitigation: vet each on first install and add to `onlyBuiltDependencies` deliberately.

---

### Phase 31: Monorepo Merge + BSL 1.1

**Goal:** Unite the open frontend (`x402jobs`) and the closed backend (`x402jobs-api`) under one license, one repo, and one CI — so the project can ship as a public open-source codebase without leaving the api repo dark.

**Dependencies:** Phase 30 (Supply Chain Hardening) shipped — both repos on `pnpm@10.6.5`, root `.npmrc` release-age policy in place. All 12 Phase 28 HIGHs ALREADY shipped via x402jobs-api PR #32 (commit `c751857`) on 2026-05-14 — confirmed by Phase 31 research; no pre-merge security work is required.

**Plans:** 5/5 plans complete

Plans:
- [x] 31-01-PLAN.md -- BSL 1.1 LICENSE + README + SECURITY.md + CONTRIBUTING.md + CLAUDE.md (drafted while still private)
- [x] 31-02-PLAN.md -- Squash-import x402-jobs-api → apps/api/ + workspace reconciliation + cleanup deletions
- [x] 31-03-PLAN.md -- Unified GitHub Actions CI workflow with dorny/paths-filter@v3
- [x] 31-04-PLAN.md -- Local-dev orchestration polish (dev:web / dev:api / dev:inngest + test alias)
- [x] 31-05-PLAN.md -- Public-flip ceremony + convergence (Railway re-point + archive + visibility flip + 31-CONVERGENCE.md + 31-ROLLBACK.md)

**Scope:**

- **Monorepo merge:**
  - Squashed import of `x402jobs-api` working tree → `apps/api/` (single squash commit; closed-repo history preserved in archived private remote)
  - Reconcile workspace tooling: ESLint, Prettier, TypeScript base config aligned across `apps/web` and `apps/api`
  - Migration folder consolidation (canonical: `supabase/migrations/`; deprecate the flat `migrations/` folder)
  - Preserve the `pnpm-workspace.yaml#ignoredBuiltDependencies: [isolated-vm]` invariant from the api repo
- **License + public-facing docs:**
  - Root `LICENSE`: BSL 1.1 with **Memeputer LLC** as licensor; 4-year change date → Apache-2.0
  - Additional Use Grant: Sentry-style — forbids offering x402.jobs (or a substantially similar hosted paid-workflow + x402-payments service) as a commercial service to third parties; internal commercial use and self-hosting are allowed
  - `README.md` rewrite explaining: what x402.jobs is, what the license allows/forbids, how to self-host, where commercial use is prohibited
  - `SECURITY.md` finalized — documents Phase 30 release-age policy + private security-disclosure contact; "Known unfixed findings" section is **empty** (all 12 Phase 28 HIGHs already shipped per PR #32)
- **Unified CI:**
  - GitHub Actions workflow: lint + typecheck + test both apps on PR
  - Path-filtered triggers so the right job set fires on a given PR
  - Retroactively satisfies Phase 30 SC6 (the deferred "CI green on both repos")
- **Local dev experience:**
  - `pnpm dev` spins up web (3010) + api (3011) + Inngest dev server end-to-end (single command)
  - A new clone-and-run developer can `pnpm install && pnpm dev` and have a working local environment
- **Deploy posture:**
  - Deploys stay split: Vercel for `apps/web`, Railway for `apps/api`. Path filters trigger the appropriate deploy
  - Both apps already on `pnpm@10.6.5` per Phase 30 — no deploy-config changes expected from the merge itself
- **Closure:**
  - Archive the closed `x402jobs-api` remote (don't delete — keep as historical reference, private)
  - Public announcement coordinated with milestone completion

**Success criteria:**

1. Single repo, single license, single CI
2. Both apps deploy cleanly to their respective platforms (Vercel + Railway) post-merge
3. A new clone-and-run developer can `pnpm install && pnpm dev` and have a working local environment without manual env-file plumbing beyond `.env.local.example` copy
4. Community can read the code: `LICENSE`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md` all present and accurate
5. `LICENSE` correctly names **Memeputer LLC** as licensor (verbatim) with the Sentry-style Additional Use Grant text from `31-CONTEXT.md` Decision 2
6. `SECURITY.md` documents the Phase 30 release-age policy externally + a private security-disclosure contact; "Known unfixed findings" section is empty (Phase 28 HIGHs all shipped via api repo PR #32 on 2026-05-14)
7. `SECURITY.md` documents the Phase 30 release-age policy externally so it can't be silently removed
8. Vercel + Railway main-branch deploys post-merge satisfy the Phase 30 `30-CONVERGENCE.md` "Expected build-log assertions" (validates SC4/SC5 retroactively)

**Source documents (read first):**

- `.planning/v3.0-MILESTONE-SCOPE.md` — Phase 31 section (authoritative scope source)
- `.planning/phases/31-monorepo-merge-bsl/31-CONTEXT.md` — LOCKED decisions (license, history strategy, Batch H scope, OAuth migration path, deploy split)
- `.planning/phases/28-security-review/HIGHS-TRIAGE.md` — Batch H source-of-truth, plus the deferred-Highs list for `SECURITY.md`
- `.planning/phases/28-security-review/REVIEW.md` — per-finding line numbers + remediation guidance
- `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md` — pnpm@10.6.5 baseline + post-merge assertions to verify
- `/Users/rawgroundbeef/Projects/x402jobs-api/` — source tree being merged in

**Risks:**

- Twitter OAuth migration path could lock out existing connected accounts (Medium likelihood, High blast). Mitigation: one-shot re-encrypt script run pre-merge; fallback is forced re-auth with prominent in-app banner.
- Unified CI workflow could break in non-obvious ways on the first cross-app PR (Medium, Medium). Mitigation: smoke the workflow locally via `act` before merging.
- `pnpm dev` orchestration (web + api + Inngest in one command) introduces a new dev-experience surface that wasn't tested under Phase 30 (Medium, Low). Mitigation: standalone `pnpm dev:web`, `pnpm dev:api`, `pnpm dev:inngest` scripts as fallbacks so devs can run them individually if the unified command misbehaves.
- BSL Additional Use Grant text could need legal review before public flip (Low, High if misdrafted). Mitigation: use Sentry's published BSL grant as a base (well-known + battle-tested); flag for legal review in `LICENSE` PR description.
- Public open-source flip surfaces a security finding within 24h of launch (Low, High). Mitigation: `SECURITY.md` "Known unfixed findings" pre-discloses Phase 28 Highs; private security disclosure address published.

---

_Roadmap created: 2026-01-30; Phase 28 added 2026-05-13; Phase 30 added 2026-05-14; Phase 31 added 2026-05-15_
