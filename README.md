<div align="center">

# x402.jobs

**Chain x402-paid HTTP endpoints into automated workflows.**

Resource providers earn USDC. AI agents bring their own wallet and pay per call.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)
[![CI](https://github.com/rawgroundbeef/x402.jobs/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rawgroundbeef/x402.jobs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@x402jobs/sdk?label=%40x402jobs%2Fsdk)](https://www.npmjs.com/package/@x402jobs/sdk)

[**Try it →**](https://x402.jobs) &nbsp;·&nbsp; [Docs](https://x402.jobs/docs/getting-started) &nbsp;·&nbsp; [Discord](https://discord.gg/BUcC28x6BX) &nbsp;·&nbsp; [X / Twitter](https://x.com/x402jobs)

</div>

---

## What is x402.jobs?

x402.jobs is a no-code workflow builder where **every node is a paid x402 HTTP endpoint**.

Two sides of the marketplace:

- **Resource providers** wrap an LLM prompt, an HTTP API, or any existing endpoint behind an [x402 paywall](https://x402.org). They earn USDC every time it gets called — no infrastructure, no per-tenant billing, no API-key handout.
- **Agents and consumers** discover those resources, chain them into workflows, and pay USDC per call from their own wallet. No SaaS subscriptions, no rate-limit gymnastics, no integration code beyond an x402 client.

USDC settles on **Solana** and **Base**.

## What you can register

| Type | What it does |
|------|-------------|
| **Claude prompt** | A reusable Claude system prompt with typed parameters. Agents pay per generation. |
| **OpenRouter model** | Same idea, any OpenRouter-backed model. |
| **HTTP proxy** | Wrap any existing REST endpoint behind an x402 paywall. |
| **Link existing x402** | Register an endpoint you already host elsewhere. |

Every resource gets a stable URL, a public listing, and SDK-grade metadata (`extra.outputSchema`, refund support, multi-network accepts).

## Quickstart — self-host locally

```bash
git clone https://github.com/rawgroundbeef/x402.jobs.git
cd x402.jobs
pnpm install

cp apps/web/env.example apps/web/.env.local
cp apps/api/env.example apps/api/.env
# Fill in: Supabase URL/keys, WALLET_ENCRYPTION_SECRET,
# INTEGRATION_ENCRYPTION_SECRET (see apps/api/env.example
# for the full list).

pnpm dev
# → web:     http://localhost:3010
# → api:     http://localhost:3011
# → Inngest: http://localhost:8288
```

Per-app fallbacks if `pnpm dev` misbehaves:

```bash
pnpm dev:web      # web only
pnpm dev:api      # api only
pnpm dev:inngest  # Inngest dev server only
```

**Requirements:** Node ≥ 22, `pnpm@10.6.5` (pinned via `packageManager`), a Supabase project, a Solana RPC endpoint.

See [`apps/api/env.example`](apps/api/env.example) for every supported environment variable.

## Project structure

```
x402.jobs/
├── apps/
│   ├── web/              # Next.js 15.5 frontend — deploys to Vercel
│   └── api/              # Express + Inngest workers — deploys to Railway
├── packages/
│   ├── sdk/              # @x402jobs/sdk — public npm package
│   └── ui/               # @x402jobs/ui — internal shared components
├── .github/workflows/    # CI — path-filtered per-app jobs
├── turbo.json
├── pnpm-workspace.yaml
└── vercel.json
```

## SDK

The `@x402jobs/sdk` package gives you discovery, trust scoring, and resource-management helpers for any x402 client:

```bash
npm install @x402jobs/sdk
```

Full SDK docs at [x402.jobs/docs/developer](https://x402.jobs/docs/developer).

## Deploys

- **Web** → [Vercel](https://vercel.com) (auto-deploys `main`)
- **API** → [Railway](https://railway.app) (auto-deploys `main`, builds via [`apps/api/Dockerfile`](apps/api/Dockerfile))

Both apps are deploy-independent. Path-filtered CI in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) only runs the jobs whose code changed.

## Documentation

- [Getting started](https://x402.jobs/docs/getting-started) — register your first resource
- [Developer guide](https://x402.jobs/docs/developer) — SDK reference
- [Resource lifecycle](https://x402.jobs/docs/resources) — pricing, refunds, output schemas
- [Examples](https://x402.jobs/docs/examples) — end-to-end workflows
- [x402 protocol](https://x402.org) — the underlying payment-required HTTP standard

## Community

- **Discord:** [discord.gg/BUcC28x6BX](https://discord.gg/BUcC28x6BX)
- **X / Twitter:** [@x402jobs](https://x.com/x402jobs)
- **Issues:** [github.com/rawgroundbeef/x402.jobs/issues](https://github.com/rawgroundbeef/x402.jobs/issues)

## License

[BSL 1.1 with an Additional Use Grant](LICENSE) (`Memeputer LLC` as Licensor). Converts to **Apache 2.0** on `2030-05-15`.

In plain English:

- ✅ Use it for internal company workflows
- ✅ Self-host for your own projects
- ✅ Fork, modify, contribute back
- ❌ Don't run a hosted x402-payments-workflow service that competes with x402.jobs

See [LICENSE](LICENSE) for the legal text.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Conventional Commits with phase scope (`feat(31): …`).

## Security

Vulnerability reports go through [GitHub Private Vulnerability Reporting](https://github.com/rawgroundbeef/x402.jobs/security/advisories/new). See [SECURITY.md](SECURITY.md) for the full disclosure policy.
