---
phase: 29-bulk-resource-registration
plan: 02
status: complete
completed: 2026-05-13
repo: x402jobs
github_remote: github.com/rawgroundbeef/x402.jobs
commit: a52782c
branch: feat/bulk-resource-registration-docs
pr_url: https://github.com/rawgroundbeef/x402.jobs/pull/16
requirements:
  - PHASE-29-DOCS-BULK-SECTION
  - PHASE-29-DEVELOPERS-COPY
  - PHASE-29-HOMEPAGE-AFFORDANCE
files_modified:
  - apps/web/src/app/docs/resources/page.tsx
  - apps/web/src/app/developers/page.tsx
  - apps/web/src/components/DiscoverSection/DiscoverSection.tsx
key_files:
  created: []
  modified:
    - apps/web/src/app/docs/resources/page.tsx
    - apps/web/src/app/developers/page.tsx
    - apps/web/src/components/DiscoverSection/DiscoverSection.tsx
---

# Plan 29-02 — Bulk Resource Registration Docs + Marketing

## What Shipped

Three frontend surfaces in `~/Projects/x402jobs` updated to document and
discover the `POST /api/v1/resources/bulk` endpoint (which ships in
companion PR `x402-jobs-api#30`, merged 2026-05-13).

### `apps/web/src/app/docs/resources/page.tsx`

- Wrapped the existing `POST /resources` card and the new bulk card in
  `<section id="programmatic-registration" className="space-y-8 scroll-mt-20">`.
  The `/developers` page had been linking to that hash for a while with no
  matching `id` on the target — latent bug fixed as a side-effect.
- Added a "Bulk registration" card matching the existing card visual
  language (`bg-card border border-border rounded-lg p-6 space-y-4`, etc.)
  with:
  - Green POST badge + `<code>/resources/bulk</code>` header
  - Intro paragraph mentioning "up to 25" and per-item statuses
  - "Best for marketplaces…" when-to-use callout
  - Limits table: 25 items / 5 concurrency / 6 req/min
  - 3-item request body example (Weather + Stocks + 127.0.0.1 error)
  - Partial-success response example (one created + one updated + one error)
  - curl example
  - HTTP status code list (200/400/401/429/500)
- No new imports.

### `apps/web/src/app/developers/page.tsx`

- Rewrote the "Running a marketplace?" body paragraph from the previously
  inaccurate "One call and your resources are discoverable" to "Send up to
  25 resources in a single API call — partial failures are surfaced per-item
  so retries are precise."
- Added an inline bulk curl snippet above the "Register Resources →" button
  so visitors see the array shape without leaving the page (`max-w-2xl mx-auto`
  + `bg-muted` + `text-sm font-mono` to match the docs page's snippet style).
- Preserved the existing "Register Resources →" button and the
  "register programmatically via API →" link.

### `apps/web/src/components/DiscoverSection/DiscoverSection.tsx`

- Added a third tagline line "Up to 25 endpoints in one call." between the
  existing "Register yours. Find others. One API." and "$50/month or pay
  per lookup." lines. Matches the existing terse cadence.
- No other changes to the file (CTAs, leaderboard, pricing line untouched).

## Verification

- `pnpm --filter web typecheck` — pass
- `pnpm --filter web lint` — pass
- Local browser verification at http://localhost:3010 — user confirmed all
  four URLs render the new content correctly:
  - `/docs/resources` shows the new Bulk registration card
  - `/docs/resources#programmatic-registration` resolves
  - `/developers` shows accurate marketplace copy + inline snippet
  - `/` shows the new tagline line
- Only the three intended files were staged; `.gitignore`,
  `.planning/STATE.md`, `.planning/config.json` (pre-existing dirty)
  left alone.

## Commit + PR

- Branch: `feat/bulk-resource-registration-docs`
- Commit: `a52782c docs+marketing: bulk resource registration`
- PR: https://github.com/rawgroundbeef/x402.jobs/pull/16 (open, awaiting merge)

The PR description notes the `#programmatic-registration` latent-bug fix
as a side-effect.

## Deviations

- None. The PRD's optional bonus (hero tabbed single/bulk snippet on
  `/developers`) was correctly deferred per the plan's gotcha #8.
- The plan's referenced port was `http://localhost:3010` and the web app's
  `dev` script confirms `next dev -p 3010` — no port discrepancy.

## Notes for Future Work

- The `/developers` hero code snippet still shows single-resource registration
  via `@x402jobs/sdk`. If we later expose a bulk method in that SDK, a small
  tabbed snippet (single vs bulk) would be a natural follow-up.
- The leaderboard / DiscoverSection has only one CTA tier. If marketplaces
  become a major segment we could add a "Marketplace developers →" CTA
  variant on the homepage.
