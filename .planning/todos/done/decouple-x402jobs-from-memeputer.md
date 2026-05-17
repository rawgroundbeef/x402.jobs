---
title: Decouple x402.jobs from Memeputer / Jobputer infrastructure
created: 2026-05-16
expanded: 2026-05-17 (post-Phase-31 milestone scoping session)
status: scoped 2026-05-17 — turned into milestone v3.1 (Phases 32-34); see .planning/ROADMAP.md
source_phase: 31-monorepo-merge-bsl (post-public realization)
priority: HIGH — strategic move, precursor to v3.x vision (agent skill files + cross-chain)
estimated_effort: 1 architecture phase + 1-2 implementation phases
resolves_milestone: v3.1
resolves_phases: [32, 33, 34]
---

# Decouple x402.jobs from Memeputer / Jobputer infrastructure

## Why this matters strategically

x402.jobs is now a public OSS project (Phase 31 shipped). The codebase still has hard operational dependencies on Memeputer-owned infrastructure:

- **Platform fee endpoint** is a Jobputer-branded x402 endpoint hosted under `agents.memeputer.com`
- **UI character** ("Jobputer") with avatar served from `auth.memeputer.com` and help/job-request endpoints under `agents.memeputer.com`
- **Database column** `memeputer_name` on `x402_servers`

For a public OSS project that wants to be **"the runtime for agent commerce"** (the framing from the launch announcement), operator-coupling to a separate brand is a credibility problem:

1. Anyone forking the repo can't run a fully-functional self-hosted instance without the Memeputer endpoints
2. Anyone reading the source can see the brand entanglement
3. The roadmap vision (agent-readable skill files, cross-chain composition) gets harder to credibly pitch when the foundation depends on a non-canonical operator
4. Long-term: Memeputer and x402.jobs are diverging as separate products. Decoupling now is cheaper than later.

## What x402.jobs operator decisions need to be made

These are NOT implementation questions — they're business/architecture decisions that have to settle before code can land.

### D-1: Where do platform fees go?

Current: Jobputer x402 endpoint receives 1.5% of every job. Fee is settled by routing a separate x402 call through Jobputer's wallet at execution time.

**Decision needed: what replaces this?**

Options to evaluate:
- **(a) Direct on-chain USDC transfer** — at job execution, transfer the fee % to a hardcoded fee wallet address. No intermediating x402 endpoint. Simplest. Loses the "fee is itself an x402 transaction" symmetry but that symmetry was never load-bearing.
- **(b) New x402-jobs-native fee endpoint** — operate a fee-collection x402 endpoint under `api.x402.jobs/x402/fees/...`. Maintains the x402-call-chain pattern. More infrastructure to run.
- **(c) Fee included in resource pricing** — push fees into the resource's accepts[] array (the resource provider sees the fee on their side, x402.jobs takes a cut at settlement). Architecturally cleaner but harder to retrofit; resource providers might object.

User's stated angle for the announcement: **frame the decouple as a price reduction.**
Today's fee is 1.5%. The new fee should be lower (likely 0.5%–1%). Marketing beat: "We're decoupling from our parent brand AND lowering platform fees from 1.5% to X%. Here's why."

→ Need to pick a new fee number AND an option (a/b/c) before implementation.

### D-2: What replaces Jobputer in the UI?

Current: Jobputer is a character with an avatar, a "help" persona, and a "post job request" entry point. Renders in:
- Hero/marketing surfaces
- Help/chat affordances
- "Post a job request" flow

**Decision needed: what fills these roles?**

User's stated direction: **replace with better developer docs.** The bet is that Jobputer's help-bubble UX was a soft substitute for proper docs. Now that the repo is public and the dev-facing surface matters more, invest in docs instead of a mascot.

Implications:
- Audit every Jobputer touchpoint in `apps/web/`
- Decide if "post a job request" remains as a feature (and if so, route it where?) OR if it's removed entirely
- Probably need a docs site improvement pass — better /docs pages, code examples, SDK quickstarts

### D-3: `memeputer_name` schema column

Current: `x402_servers.memeputer_name TEXT` — a memeputer-flavored slug field that's been schema-coupled since project genesis.

**Decision needed: rename, repurpose, or drop?**

- Drop: clean but requires data migration; any consumer reading the column breaks
- Rename to something neutral (e.g., `legacy_slug`, `external_id`): minimally invasive
- Repurpose: figure out what the field is actually used for and re-name to match its actual semantic

Need to check: is anything actually reading this column in code? If no, drop is easiest.

## What's concretely in scope

Once D-1, D-2, D-3 are settled, the implementation work breaks into:

### Implementation lane A: Platform fee replacement

- New fee-collection address / endpoint per D-1 outcome
- `apps/api/src/config.ts` — replace hardcoded `agents.memeputer.com/x402/solana/jobputer/job_fee` default
- `apps/api/src/inngest/utils/execute-x402.ts` and related — update fee-payment flow
- `apps/api/env.example` — update `PLATFORM_FEE_URL` defaults / replace with new env var names
- Tests — verify fee is correctly collected via new mechanism
- Probably a migration path for in-flight jobs at deploy time

### Implementation lane B: Jobputer character/bot removal

- `apps/web/src/lib/config.ts` — remove `JOBPUTER_AVATAR_URL`, `JOBPUTER_HELP_URL`, `JOBPUTER_POST_JOB_REQUEST_URL`
- Find every UI component that references Jobputer (`grep -r "Jobputer\|jobputer\|JOBPUTER"`) and rebuild that surface area
- Decide what (if anything) lives where Jobputer's help bubble was
- Update docs pages to fill the help-vacuum

### Implementation lane C: Docs investment (replaces Jobputer help)

- Audit existing `/docs/{getting-started,developer,resources,examples,errors,long-running-resources}` pages
- Add: SDK quickstart, x402 protocol primer, common-recipes, troubleshooting
- Consider: a `/docs/agents` section specifically for the agent-developer audience (sets up the "agent-readable skill file" feature later)

### Implementation lane D: Database schema

- Migration to handle `memeputer_name` per D-3 outcome
- Update any code reading the column
- Confirm RLS policies still work

### Implementation lane E: Announcement

User's marketing angle: a "we're lowering fees + going fully independent" combined announcement. Likely:
- New X/Twitter post (thread, similar to Phase 31 announcement)
- LinkedIn post (longer-form, story-driven)
- Maybe a `/blog/` post in apps/web if a blog surface exists or gets added

## Things the user might not be thinking about (flagging now)

- **Fee migration mid-flight:** any job in execution at the moment of the cutover has its fee config snapshot taken at job-creation. New fees don't apply to in-flight runs. But test this — don't assume.
- **Backward compatibility:** existing resources have `accepts[]` arrays that might encode the old fee structure. May need to either migrate or grandfather.
- **Trust/transparency:** the platform fee wallet address becomes a public commitment once announced. People can verify on-chain. Pick an address that's defensible long-term (cold storage? multisig? at minimum: not the same wallet as any operational hot wallet).
- **Refunds path:** if a job partially fails, current fee behavior routes through Jobputer. New flow needs to match. Check `apps/api/src/routes/refunds.ts` for fee-aware refund logic.
- **Discoverability of the change:** post-decouple, users running self-hosted instances need to know to update env vars. Document the migration path in CHANGELOG.md (which we might need to start) and in the announcement.
- **Naming:** if Jobputer is gone, is there a "x402.jobs concierge" / "x402.jobs guide" persona that replaces it? Or is the answer "no persona, just docs"? User said docs, but a tiny opinionated voice on the help pages can still feel friendly.

## Suggested sequencing for the milestone

Roughly 3 phases (the user can collapse/expand as they see fit):

1. **Phase: Platform fee replacement.** Lowest-risk, highest-leverage. Get the operator dependency off the critical path. Includes D-1 decision + lane A + announcement of the fee change. Ship as its own beat — "we lowered fees" is the headline.
2. **Phase: Jobputer character removal + docs investment.** D-2 decision + lanes B + C. Bigger surface area, more design work. Best done after fee work is settled so the announcement story is clean.
3. **Phase: Schema cleanup + final polish.** D-3 decision + lane D + any leftover environment cleanup. Smallest scope, ships last.

This sequencing keeps each phase shippable on its own. The announcement after phase 1 (fee reduction) sets up the larger narrative for phase 2 (visual decouple).

## Files to read first when picking this up fresh

- `apps/api/src/config.ts` (platform fee endpoint config)
- `apps/web/src/lib/config.ts` (Jobputer UI URLs)
- `apps/api/src/inngest/utils/execute-x402.ts` (fee payment flow at execution)
- `apps/api/src/routes/refunds.ts` (refund-aware fee handling)
- `apps/api/migrations/001_initial_schema.sql` (memeputer_name column)
- `.planning/phases/31-monorepo-merge-bsl/31-CONVERGENCE.md` ("What's intentionally public" + "Open follow-ups" sections both touch this work)
- This file (you're reading it)

## Suggested command for next session

After `/clear`, either:

- `/gsd-new-milestone` — if treating this as the v3.1 milestone (likely the right call given there are 3+ phases)
- `/gsd-discuss-phase` — if treating just the fee replacement as a standalone phase to get rolling

Either way: feed in this file's contents + the user's marketing-angle preferences (fee reduction framing, docs-over-mascot) so the discuss/plan phase is informed.
