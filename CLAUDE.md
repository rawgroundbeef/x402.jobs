# x402.jobs — Repo-wide AI Assistant Rules

These rules apply to every AI assistant working in this repo (Claude
Code, Cursor, Copilot, etc.). They encode load-bearing decisions
from prior phases that are NOT obvious from the code alone.

## Hard locks (do NOT recommend changes to these)

- **pnpm pin: `pnpm@10.6.5` exact.** See
  `.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md`.
  - Bumping past 10.7.0 hits the open Next.js 15.5 ENOWORKSPACES bug
    (vercel/next.js#86841, PR #86845 still OPEN as of 2026-05-14).
  - Bumping past 11 removes `ignoredBuiltDependencies` from
    `pnpm-workspace.yaml` (replaced by `allowBuilds` map per
    pnpm v10.26.0+ docs) — would require simultaneous migration.
  - All 5 pin sites (root `package.json`, `apps/web/vercel.json`,
    `apps/api/Dockerfile`, `apps/api/vercel.json`, and CI workflow)
    MUST stay at exactly `pnpm@10.6.5`.

- **`.npmrc#minimum-release-age=4320`** is a documented supply-chain
  control (see `SECURITY.md` "Supply-Chain Hardening" section). Do
  not remove or shorten this value. Escape hatch for urgent patches:
  add `minimum-release-age-exclude=<pkg-name>` lines instead.

- **License: BSL 1.1 with Memeputer LLC as Licensor.** Do not propose
  MIT / Apache / AGPL / FSL switches without an explicit user request.
  The Additional Use Grant text in `LICENSE` is locked verbatim per
  `.planning/phases/31-monorepo-merge-bsl/31-CONTEXT.md` Decision 2.

- **`pnpm-workspace.yaml#ignoredBuiltDependencies: [isolated-vm]`**
  is required — isolated-vm runs sandboxed JS for prompt-path
  resources and its native build fails on many machines.

## Conventions

- **Commit format:** Conventional Commits with phase scope —
  `feat(31): …`, `docs(api): …`, `chore(monorepo): …`.
- **`pnpm dev`** orchestrates web + api + Inngest via Turbo
  persistent tasks. Per-app fallbacks: `pnpm dev:web`,
  `pnpm dev:api`, `pnpm dev:inngest`.
- **Migrations:** BOTH `apps/api/migrations/` (flat, 001-010,
  legacy api-runner format) and `apps/api/supabase/migrations/`
  (Supabase-CLI timestamped format) coexist by design. Do NOT
  propose consolidation without consulting Phase 31 Pitfall 6 in
  `.planning/phases/31-monorepo-merge-bsl/31-RESEARCH.md`.
- **Encryption:** wallet keys use `WALLET_ENCRYPTION_SECRET`
  (AES-256-GCM), OAuth tokens use `INTEGRATION_ENCRYPTION_SECRET`
  (AES-256-CBC). Both env vars are load-bearing — losing either
  permanently locks out user data.
