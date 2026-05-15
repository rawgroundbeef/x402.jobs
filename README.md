# x402.jobs

> Chain x402-paid HTTP endpoints into automated workflows. Agents
> bring their own wallet; resources earn USDC.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

## What is x402.jobs?

x402.jobs is a no-code workflow builder where each node is a paid
x402 HTTP endpoint. Anyone can monetize an API endpoint or AI prompt
through x402 payments with zero infrastructure: register a resource,
share its URL, and agents pay USDC per call.

## Quickstart

Self-host locally:

```bash
git clone https://github.com/rawgroundbeef/x402.jobs.git
cd x402.jobs
pnpm install
cp apps/web/env.example apps/web/.env.local
cp apps/api/env.example apps/api/.env
# Fill in: Supabase URL/keys, WALLET_ENCRYPTION_SECRET,
# INTEGRATION_ENCRYPTION_SECRET (see apps/api/env.example for
# the full list).
pnpm dev
# → web:    http://localhost:3010
# → api:    http://localhost:3011
# → Inngest http://localhost:8288
```

Per-app fallbacks if `pnpm dev` misbehaves:

```bash
pnpm dev:web      # web only
pnpm dev:api      # api only
pnpm dev:inngest  # Inngest dev server only
```

## Structure

```
x402.jobs/
├── apps/
│   ├── web/          # Next.js 15.5 frontend (Vercel)
│   └── api/          # Express + Inngest workers (Railway)
├── packages/
│   ├── sdk/          # @x402jobs/sdk — npm package
│   └── ui/           # @x402jobs/ui — shared UI components (internal)
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

## Packages

### @x402jobs/sdk

The official SDK for x402.jobs — trust, discovery, and resource
management for x402.

```bash
npm install @x402jobs/sdk
```

### apps/web

The x402.jobs Next.js web application (`@x402jobs/web`).

### apps/api

The Express + Inngest backend (`x402-jobs-api`). Deploys to Railway
via the included Dockerfile.

### @x402jobs/ui

Shared internal UI components.

## License

[BSL 1.1 with an Additional Use Grant](LICENSE) — change date 2030-05-15,
then converts to Apache 2.0.

In plain English: you may run x402.jobs internally (your company,
your own workflows) and self-host. You may NOT offer a hosted
x402-payments-workflow service that competes with x402.jobs. See
[LICENSE](LICENSE) for the legal text and [SECURITY.md](SECURITY.md)
for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md). Please use GitHub Private
Vulnerability Reporting for security findings.
