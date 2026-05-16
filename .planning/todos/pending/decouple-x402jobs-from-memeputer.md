---
title: Decouple x402.jobs from Memeputer / Jobputer infrastructure
created: 2026-05-16
source_phase: 31-monorepo-merge-bsl (post-public realization)
priority: medium
estimated_effort: 1-2 phases (architecture + migration)
---

# Background

x402.jobs currently depends on Memeputer-operated services for:

1. **Platform fee collection** — every job run pays a 1.5% fee to a Jobputer x402 endpoint at `https://agents.memeputer.com/x402/solana/jobputer/job_fee`. Configurable via `PLATFORM_FEE_URL` env var, defaults to the Memeputer-hosted Jobputer agent.

2. **Jobputer avatar / help / job request endpoints** — UI hardcodes `auth.memeputer.com` (Supabase storage avatar) and `agents.memeputer.com` (help + job request URLs) in `apps/web/src/lib/config.ts`. These render the Jobputer character in the x402.jobs interface.

3. **`memeputer_name` column** in `x402_servers` table (apps/api/migrations/001_initial_schema.sql:1548) — a memeputer-flavored slug field that's been schema-coupled since project genesis.

Decoupling matters because:
- After Phase 31 the repo is BSL-1.1 PUBLIC; baking Memeputer-owned URLs into a public open-source product means the project can't be cleanly self-hosted or forked without that operator dependency.
- The user wants x402.jobs to be its own product, eventually independent of any Memeputer infra.

# What needs to happen

## Phase X (architecture decision)
- Decide where the platform fee should go. Options:
  - x402.jobs-native fee wallet on Base + Solana (already partially in place: `BASE_PLATFORM_WALLET`, `FEE_COLLECTION_ADDRESS` env vars)
  - Direct on-chain transfer (no intermediating x402 agent)
  - A new fee-collection x402 service operated under the x402.jobs domain
- Decide whether to remove the Jobputer character from the UI, or rename/rebrand it to an x402.jobs-native equivalent
- Decide the migration story for the `memeputer_name` column — rename or repurpose

## Phase Y (implementation)
- Update apps/api fee-payment path to use the new fee collection mechanism
- Update apps/web/src/lib/config.ts to remove memeputer URLs (replace UI avatar, help, job request endpoints)
- Database migration to rename `memeputer_name` column (if going that route)
- Update env.example defaults to remove memeputer.com URLs
- Update SECURITY.md / docs to reflect the operator change

# Why this was deferred

User identified the dependency during the Phase 31 pre-public security pass on
2026-05-16 — but the scope is too large for Phase 31 (which is structural merge
+ license switch). The Memeputer-hosted dependencies are intentional, documented,
and override-able via env vars, so shipping public now is safe; decoupling is a
v3.x cleanup.
