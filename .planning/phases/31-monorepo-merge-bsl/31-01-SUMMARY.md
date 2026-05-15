---
phase: 31-monorepo-merge-bsl
plan: "01"
subsystem: docs
tags: [license, bsl, security, contributing, readme]
dependency_graph:
  requires: []
  provides: [LICENSE, SECURITY.md, CONTRIBUTING.md, CLAUDE.md, README.md]
  affects: [plan-31-02, plan-31-05]
tech_stack:
  added: []
  patterns: [BSL 1.1, Sentry-style Additional Use Grant]
key_files:
  created:
    - LICENSE
    - SECURITY.md
    - CONTRIBUTING.md
    - CLAUDE.md
  modified:
    - README.md
decisions:
  - "BSL 1.1 body fetched verbatim from mariadb.com/bsl11/ (covenant 4 compliant)"
  - "Change Date computed as 2026-05-15 + 4 years = 2030-05-15 (LICENSE-landing date)"
  - "Per-task commits used (4 commits) instead of single consolidation commit per executor protocol"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-15"
  tasks_completed: 5
  files_changed: 5
---

# Phase 31 Plan 01: Public-Facing Docs (LICENSE + BSL + SECURITY + CONTRIBUTING + CLAUDE.md) Summary

BSL 1.1 license with Memeputer LLC as Licensor + Sentry-style Additional Use Grant landed alongside SECURITY.md (empty Known Unfixed Findings), CONTRIBUTING.md, CLAUDE.md (AI assistant hard locks), and README.md rewrite.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create LICENSE | d36dfd6 | LICENSE |
| 2 | Create SECURITY.md | fd190fe | SECURITY.md |
| 3 | Create CONTRIBUTING.md + CLAUDE.md | 4ee0767 | CONTRIBUTING.md, CLAUDE.md |
| 4 | Rewrite README.md | e9abbd8 | README.md |
| 5 | Verification (no additional commit needed) | — | — |

## Key Metrics

- **LICENSE-landing date:** 2026-05-15
- **Computed Change Date:** 2030-05-15 (4 years from LICENSE-landing date)
- **BSL body source:** https://mariadb.com/bsl11/ (License text copyright © 2024 MariaDB plc)
- **BSL body begins with:** `Terms` (canonical marker — confirmed)
- **Memeputer LLC occurrences in LICENSE:** 4 (Licensor field, "(c) 2026" line, copyright header, Additional Use Grant parenthetical)
- **MIT removed from README:** Confirmed — zero occurrences of `^MIT$` or `License: MIT`
- **SECURITY.md Known Unfixed Findings:** "None at public launch." (per CONTEXT D-01)

## Files Created / Modified

| Path | Status | Key Contents |
|------|--------|--------------|
| `LICENSE` | Created | BSL 1.1 Parameters (Memeputer LLC licensor, 2030-05-15 Change Date, Apache-2.0 Change License, Sentry-style Additional Use Grant) + verbatim body |
| `SECURITY.md` | Created | GitHub PVR + minimum-release-age=4320 externalized + WALLET/INTEGRATION encryption keys documented + empty Known Unfixed Findings |
| `CONTRIBUTING.md` | Created | BSL 1.1 link, pnpm dev quickstart, conventional commits convention, SECURITY.md cross-link |
| `CLAUDE.md` | Created | Hard locks: pnpm@10.6.5, .npmrc minimum-release-age=4320, BSL 1.1 Memeputer LLC, ignoredBuiltDependencies:[isolated-vm] |
| `README.md` | Modified | MIT → BSL 1.1 with Additional Use Grant link; apps/api/ in Structure; ports 3010/3011/8288; cross-links to CONTRIBUTING.md and SECURITY.md |

## LICENSE Key Invariants (all verified)

- First line: `Business Source License 1.1` ✓
- Licensor field: `Memeputer LLC` (verbatim, per 31-CONTEXT.md D-02) ✓
- Copyright: `Copyright © 2026 Memeputer LLC. All rights reserved.` ✓
- Additional Use Grant: includes `Memeputer LLC, or its successor` on single line ✓
- Change Date: `2030-05-15` (YYYY-MM-DD format, 4 years from 2026-05-15) ✓
- Change License: `Apache License, Version 2.0` ✓
- Body: begins with `Terms`, contains 4 covenants ending in "Not to modify this License in any other way." ✓

## Deviations from Plan

### Deviation: Per-task commits instead of single consolidation commit

**Found during:** Task 5 planning

**Issue:** The plan's Task 5 specifies a single consolidation commit for all 5 files. The executor protocol (task-commit-protocol) requires committing after each task.

**Resolution:** Applied 4 per-task commits (Tasks 1-4 each got their own commit). Task 5 became verification-only with no additional commit. All 5 files are committed on the branch as verified by `git diff --name-only f332c90 HEAD`.

**Impact:** No functional impact. The branch contains all required files. Plan 31-02 can proceed normally.

**Rule applied:** Executor protocol takes precedence over plan Task 5 consolidation instruction.

### No other deviations

Plan executed exactly as written on all other fronts. All CONTEXT D-01 and D-02 invariants honored.

## Confirmation Checklist

- [x] `MIT` does NOT appear in README.md (zero occurrences)
- [x] SECURITY.md `Known Unfixed Findings` reads "None at public launch."
- [x] SECURITY.md does NOT list any HIGH-NN findings as OPEN
- [x] All CONTEXT D-01 decisions honored (empty findings section)
- [x] All CONTEXT D-02 decisions honored (Memeputer LLC verbatim in Licensor + grant text)
- [x] BSL body fetched verbatim from canonical source (covenant 4 not violated)
- [x] Change Date exactly 4 years from LICENSE-landing date

## Rollback Runbook (for plan 31-05)

```bash
# Revert all 4 commits
git revert e9abbd8 4ee0767 fd190fe d36dfd6
# OR (targeted file revert)
git revert d36dfd6   # LICENSE
git revert fd190fe   # SECURITY.md
git revert 4ee0767   # CONTRIBUTING.md + CLAUDE.md
git revert e9abbd8   # README.md
```

Reverts all 5 files in one operation. Plan 31-02 (squash-import) depends on LICENSE existing — cannot proceed until a corrected License plan re-lands.

## Self-Check: PASSED

All created files verified to exist:
- LICENSE: FOUND ✓
- SECURITY.md: FOUND ✓
- CONTRIBUTING.md: FOUND ✓
- CLAUDE.md: FOUND ✓
- README.md: FOUND ✓

All commits verified in git log:
- d36dfd6: FOUND ✓
- fd190fe: FOUND ✓
- 4ee0767: FOUND ✓
- e9abbd8: FOUND ✓
