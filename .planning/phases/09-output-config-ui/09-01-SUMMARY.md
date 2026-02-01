---
phase: 09
plan: 01
title: x402.storage UI Checkbox
subsystem: job-canvas
tags: [output-config, pricing, ui, x402-storage]
completed: 2026-01-25
duration: ~4 minutes

dependency_graph:
  requires: []
  provides:
    - x402storage output destination type
    - OutputConfigPanel storage checkbox
    - Price calculation with storage fee
    - OutputNode storage badge
  affects:
    - Phase 10 (Storage Execution Backend)

tech_stack:
  added: []
  patterns:
    - Wallet balance gating for premium features
    - Dynamic price calculation based on output config

key_files:
  created: []
  modified:
    - src/types/output-config.ts
    - src/components/panels/OutputConfigPanel.tsx
    - src/components/panels/JobPanel.tsx
    - src/components/pages/JobCanvas/lib/useJobPrice.ts
    - src/components/workflow/nodes/OutputNode.tsx

decisions:
  - id: STOR-PRICE
    choice: "$0.01 flat fee per job"
    rationale: "Simple pricing model, matches research"
  - id: STOR-BADGE-COLOR
    choice: "Emerald green"
    rationale: "Distinct from Telegram (blue) and X (neutral)"

metrics:
  tasks: 2/2
  commits: 2
  deviations: 1
---

# Phase 09 Plan 01: x402.storage UI Checkbox Summary

**One-liner:** x402.storage checkbox in OutputConfigPanel with +$0.01 pricing and emerald badge on OutputNode

## What Was Built

### Type System

Extended `OutputDestination` type to include `"x402storage"` as a valid destination across three files:

- `src/types/output-config.ts` - canonical type definition
- `src/components/panels/OutputConfigPanel.tsx` - local interface
- `src/components/panels/JobPanel.tsx` - local interface

### UI: OutputConfigPanel Checkbox

Added x402.storage as fourth output destination option:

- Emerald Globe icon (matches storage/permanence concept)
- "+$0.01 . Permanent link" sublabel
- Wallet balance gating: disabled with "Low balance" badge when balance < $0.01
- Toggle behavior matches existing destinations (In-app, Telegram, X)

### Price Calculation

Updated `useJobPrice.ts` hook:

- Added `STORAGE_FEE = 0.01` constant
- Detects if any output node has x402storage enabled
- Includes `storageFee` in total price calculation
- Returns `storageFee` in result object for display

### Visual Feedback: OutputNode Badge

Added storage badge to OutputNode component:

- Emerald Globe icon in 5x5 rounded badge
- Consistent with Telegram (blue) and X (neutral) badge styling
- Shows when x402storage is enabled and no result yet

## Commits

| Hash    | Type | Description                                                |
| ------- | ---- | ---------------------------------------------------------- |
| 9bd41d3 | feat | Add x402storage output destination type and checkbox       |
| e7862d6 | feat | Add storage fee to price calculation and output node badge |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated JobPanel.tsx type definition**

- **Found during:** Task 1 verification
- **Issue:** TypeScript error - JobPanel.tsx had its own local OutputDestination interface that didn't include x402storage
- **Fix:** Added "x402storage" to the type union in JobPanel.tsx line 106
- **Files modified:** src/components/panels/JobPanel.tsx
- **Commit:** 9bd41d3

## Verification Results

- TypeScript: PASS (no errors)
- Lint: PASS (only pre-existing warnings)
- Files: All artifacts created/modified as specified

## Success Criteria Status

- [x] DATA-01: OutputDestination type extended with "x402storage" option
- [x] CFGUI-01: OutputConfigPanel displays x402.storage as fourth destination
- [x] CFGUI-02: x402.storage option shows "+$0.01 . Permanent link" sublabel
- [x] CFGUI-03: x402.storage checkbox behavior matches existing destinations
- [x] CFGUI-04: x402.storage option disabled when wallet insufficient
- [x] PRCE-01: Job config shows "+$0.01 storage" when enabled (via updated total)
- [x] PRCE-02: Total price calculation includes storage fee estimate
- [x] Config persists when workflow is saved (uses existing save mechanism)

## Next Phase Readiness

**Phase 10 Prerequisites:**

- x402storage destination type available for execution logic
- Price calculation ready - backend can use same detection pattern
- No blockers identified

**Integration Points:**

- Execution backend will check for x402storage in output config
- Storage upload will happen after successful job completion
- Result URL will be updated with permanent IPFS link
