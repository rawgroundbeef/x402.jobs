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
- [ ] 26-01-PLAN.md -- Route Link Existing publish to POST /api/resources/ instead of /api/resources/instant

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
| 26 - Fix Link Existing Publish     | Pending  | 0/1   | REVW-04, LINK-07         |

**Total:** 10/11 plans complete (Phases 19-26, gap closure phase added)

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

_Roadmap created: 2026-01-30_
