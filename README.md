# x402.jobs

Open-source monorepo for [x402.jobs](https://x402.jobs) - Chain X402 resources into automated workflows.

## Structure

```
x402jobs/
├── apps/
│   └── web/          # Next.js frontend
├── packages/
│   ├── sdk/          # @x402jobs/sdk - npm package
│   └── ui/           # @x402jobs/ui - shared UI components
├── turbo.json
└── package.json
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm dev

# Build all packages
pnpm build
```

## Packages

### @x402jobs/sdk

The official SDK for x402.jobs - trust, discovery, and resource management for x402.

```bash
npm install @x402jobs/sdk
```

### @x402jobs/web

The x402.jobs web application.

### @x402jobs/ui

Shared UI components (internal package).

## License

MIT
