# Requirements: Resource Registration Redesign

**Defined:** 2026-01-30
**Core Value:** Anyone can monetize an API endpoint or AI prompt through x402 payments with zero infrastructure.

## v2.0 Requirements

Requirements for full-page wizard replacing modal-based resource creation.

### Wizard Shell

- [ ] **WIZD-01**: Full-page wizard renders at `/resources/new` with consistent layout
- [ ] **WIZD-02**: Step indicator shows current position (e.g., "Step 1 of 3")
- [ ] **WIZD-03**: Back button navigates to previous step
- [ ] **WIZD-04**: Cancel button returns to resources page
- [ ] **WIZD-05**: Continue button advances to next step (disabled when form invalid)
- [ ] **WIZD-06**: URL routing maps each step to a distinct path (`/resources/new/link`, `/resources/new/details`, etc.)
- [ ] **WIZD-07**: Wizard state persists in session storage across page refreshes
- [ ] **WIZD-08**: Wizard layout is mobile-responsive (stacks naturally on small screens)

### Type Selection

- [ ] **TYPE-01**: Step 1 shows 4 resource type cards: Link Existing, Proxy, Claude Prompt, OpenRouter
- [ ] **TYPE-02**: Link Existing card is visually primary (most common path)
- [ ] **TYPE-03**: Create options (Proxy, Claude, OpenRouter) grouped under "Create Something New" divider
- [ ] **TYPE-04**: Clicking a type card navigates to that type's Step 2 route

### Link Existing

- [ ] **LINK-01**: URL input field with HTTP method dropdown (GET, POST, PUT, DELETE)
- [ ] **LINK-02**: Validate Endpoint button triggers x402check validation
- [ ] **LINK-03**: Validation results display with verdict, error count, warning count
- [ ] **LINK-04**: Expandable sections for warnings, parsed config, endpoint checks, response body
- [ ] **LINK-05**: Parsed config shows detected chain, address, amount, format
- [ ] **LINK-06**: Invalid endpoint blocks Continue button (must fix and re-validate)
- [ ] **LINK-07**: Valid endpoint pre-fills network and price in details step
- [ ] **LINK-08**: x402check components imported from x402check package

### Proxy

- [ ] **PRXY-01**: Origin URL input field for non-x402 endpoint
- [ ] **PRXY-02**: HTTP method selector (GET, POST, PUT, DELETE)
- [ ] **PRXY-03**: Optional headers section with add/remove capability
- [ ] **PRXY-04**: Continue button enabled when URL is provided

### Claude Prompt

- [ ] **CLPT-01**: Warning banner shown if user has no Claude API key configured, with link to Settings
- [ ] **CLPT-02**: System prompt textarea for template content
- [ ] **CLPT-03**: Parameter definitions with `{param}{/param}` syntax support
- [ ] **CLPT-04**: Max tokens configuration
- [ ] **CLPT-05**: Continue button blocked until API key is configured

### OpenRouter

- [ ] **ORTR-01**: Warning banner shown if user has no OpenRouter API key configured, with link to Settings
- [ ] **ORTR-02**: Model browser with search and filters (modality, provider, price)
- [ ] **ORTR-03**: Curated popular models shown by default
- [ ] **ORTR-04**: Prompt template editor with `{{param}}` syntax support
- [ ] **ORTR-05**: Parameter definitions (name, type, description, required)
- [ ] **ORTR-06**: Model config (temperature, max_tokens)
- [ ] **ORTR-07**: Continue button blocked until API key configured and model selected

### Resource Details (Shared)

- [ ] **DETL-01**: Name field (required)
- [ ] **DETL-02**: URL slug field with auto-generation from name, shown as `/@username/slug`
- [ ] **DETL-03**: Description textarea
- [ ] **DETL-04**: Image field (URL input or upload)
- [ ] **DETL-05**: Category dropdown
- [ ] **DETL-06**: Price field in USDC (minimum $0.01)
- [ ] **DETL-07**: Network selector (Base, Solana) — pre-filled for Link Existing
- [ ] **DETL-08**: Continue button enabled when required fields filled

### Review & Publish

- [ ] **REVW-01**: Summary card shows all resource configuration
- [ ] **REVW-02**: Each section has Edit link that navigates back to relevant step
- [ ] **REVW-03**: Validation summary shown for Link Existing type
- [ ] **REVW-04**: Publish Resource button submits to backend
- [ ] **REVW-05**: Success state redirects to new resource's detail page

### Cleanup

- [ ] **CLNP-01**: Old CreateResourceModal component removed
- [ ] **CLNP-02**: All entry points that opened the modal now navigate to `/resources/new`

## Future Requirements

Deferred to later milestones.

### Draft & Resume

- **DRFT-01**: Save draft functionality for incomplete wizards
- **DRFT-02**: Resume draft from resources page

### Edit Existing

- **EDIT-01**: Edit existing resource using wizard flow
- **EDIT-02**: Pre-populate wizard from existing resource data

### Bulk Import

- **BULK-01**: API documentation for bulk resource registration
- **BULK-02**: Link to API docs from type selection page

## Out of Scope

| Feature                              | Reason                                           |
| ------------------------------------ | ------------------------------------------------ |
| Save draft functionality             | Defer to later — session storage handles refresh |
| Edit existing resource via wizard    | Separate concern, different data flow            |
| Bulk import via API                  | Future feature, not wizard scope                 |
| Template versioning                  | New resource = new version                       |
| OpenRouter "Coming soon" placeholder | OpenRouter path is fully functional              |
| "Fix with AI" for invalid endpoints  | Nice-to-have, not core wizard flow               |

## Traceability

| Requirement | Phase    | Status  |
| ----------- | -------- | ------- |
| WIZD-01     | Phase 19 | Pending |
| WIZD-02     | Phase 19 | Pending |
| WIZD-03     | Phase 19 | Pending |
| WIZD-04     | Phase 19 | Pending |
| WIZD-05     | Phase 19 | Pending |
| WIZD-06     | Phase 19 | Pending |
| WIZD-07     | Phase 19 | Pending |
| WIZD-08     | Phase 19 | Pending |
| TYPE-01     | Phase 19 | Pending |
| TYPE-02     | Phase 19 | Pending |
| TYPE-03     | Phase 19 | Pending |
| TYPE-04     | Phase 19 | Pending |
| DETL-01     | Phase 20 | Complete |
| DETL-02     | Phase 20 | Complete |
| DETL-03     | Phase 20 | Complete |
| DETL-04     | Phase 20 | Complete |
| DETL-05     | Phase 20 | Complete |
| DETL-06     | Phase 20 | Complete |
| DETL-07     | Phase 20 | Complete |
| DETL-08     | Phase 20 | Complete |
| REVW-01     | Phase 20 | Complete |
| REVW-02     | Phase 20 | Complete |
| REVW-03     | Phase 20 | Complete |
| REVW-04     | Phase 20 | Complete |
| REVW-05     | Phase 20 | Complete |
| LINK-01     | Phase 21 | Pending |
| LINK-02     | Phase 21 | Pending |
| LINK-03     | Phase 21 | Pending |
| LINK-04     | Phase 21 | Pending |
| LINK-05     | Phase 21 | Pending |
| LINK-06     | Phase 21 | Pending |
| LINK-07     | Phase 21 | Pending |
| LINK-08     | Phase 21 | Pending |
| PRXY-01     | Phase 22 | Pending |
| PRXY-02     | Phase 22 | Pending |
| PRXY-03     | Phase 22 | Pending |
| PRXY-04     | Phase 22 | Pending |
| CLPT-01     | Phase 23 | Pending |
| CLPT-02     | Phase 23 | Pending |
| CLPT-03     | Phase 23 | Pending |
| CLPT-04     | Phase 23 | Pending |
| CLPT-05     | Phase 23 | Pending |
| ORTR-01     | Phase 24 | Pending |
| ORTR-02     | Phase 24 | Pending |
| ORTR-03     | Phase 24 | Pending |
| ORTR-04     | Phase 24 | Pending |
| ORTR-05     | Phase 24 | Pending |
| ORTR-06     | Phase 24 | Pending |
| ORTR-07     | Phase 24 | Pending |
| CLNP-01     | Phase 25 | Pending |
| CLNP-02     | Phase 25 | Pending |

**Coverage:**

- v2.0 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0

---

_Requirements defined: 2026-01-30_
_Last updated: 2026-01-30 after roadmap creation_
