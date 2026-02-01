# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**

- TypeScript 5.3+ - All application code (frontend and API)

**Secondary:**

- JavaScript - Build configs (`next.config.js`, `postcss.config.js`)

## Runtime

**Environment:**

- Node.js 20+ (required in `engines`)
- Volta configured for Node 22.17.1

**Package Manager:**

- pnpm 9.12.1
- Lockfile: Present (monorepo-level)
- Workspaces: Turborepo monorepo with `apps/` and `packages/`

## Frameworks

**Frontend (x402-jobs):**

- Next.js 15.5.9 - React framework with App Router
- React 19.1.2 - UI library
- Tailwind CSS 3.4.0 - Styling
- Framer Motion 12.23.26 - Animations

**Backend (x402-jobs-api):**

- Express 4.18.2 - HTTP server
- Inngest 3.46.0 - Background job processing and scheduled tasks
- WebSocket (ws 8.16.0) - Real-time communication

**Build/Dev:**

- Turborepo 2.5.5 - Monorepo build orchestration
- tsup 8.5.1 - API bundler
- nodemon 3.0.2 - API dev server hot reload
- ESLint 9.31.0 - Linting

## Key Dependencies

**Frontend Critical:**

- `@supabase/supabase-js` 2.47.22 - Auth and database client
- `swr` 2.3.6 - Data fetching and caching
- `@xyflow/react` 12.4.4 - Workflow canvas (node-based editor)
- `@monaco-editor/react` 4.7.0 - Code editor for transform nodes
- `react-hook-form` 7.62.0 + `zod` 3.24.4 - Form handling and validation

**Solana/Web3:**

- `@solana/web3.js` 1.98.4 - Solana blockchain interactions
- `@solana/wallet-adapter-react` 0.15.39 - Wallet connection UI
- `@solana/spl-token` 0.4.12 - Token transfers (API only)
- `bs58` 5.0.0 - Base58 encoding for keys

**Base/EVM (API only):**

- `ethers` 6.15.0 - Ethereum/Base blockchain interactions

**API Critical:**

- `@openfacilitator/sdk` 0.3.0 - x402 payment protocol
- `twitter-api-v2` 1.24.0 - X/Twitter posting integration
- `helmet` 7.1.0 - Security headers
- `express-rate-limit` 7.1.5 - Rate limiting

**Shared UI Package:**

- `@repo/ui` - Internal component library (Radix UI primitives, CVA, clsx)

## Configuration

**TypeScript:**

- Config: `tsconfig.json`
- Target: ES2017
- Module: ESNext with bundler resolution
- Path alias: `@/*` -> `./src/*`
- Strict mode enabled

**Tailwind:**

- Config: `tailwind.config.ts`
- Dark mode: class-based
- Custom CSS variables for theming (HSL colors)
- Typography plugin enabled
- Includes `packages/ui` in content paths

**ESLint:**

- Config: `eslint.config.mjs` (flat config)
- TypeScript-ESLint for type checking
- React Hooks rules enabled
- `no-explicit-any` disabled (pragmatic approach)

**Next.js:**

- Config: `next.config.js`
- Strict mode enabled
- API rewrites to backend services
- Remote image patterns (all HTTPS)

## Environment Variables

**Frontend Required:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3011)

**Frontend Optional:**

- `NEXT_PUBLIC_WS_URL` - WebSocket URL (falls back to HTTP polling)
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Custom Solana RPC (Helius recommended)

**API Required:**

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side)
- `OPENAI_API_KEY` - For AI workflow builder and embeddings

**API Optional:**

- `TWITTER_API_KEY` / `TWITTER_API_SECRET` - X posting integration
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` - Production Inngest
- `FEE_COLLECTION_PRIVATE_KEY` - Solana wallet for payouts
- `BASE_PLATFORM_WALLET_PRIVATE_KEY` - Base wallet for payouts
- `HELIUS_API_KEY` - Solana transaction indexing

## Platform Requirements

**Development:**

- Node.js 20+
- pnpm 9.12.1
- Inngest CLI (for local background jobs): `npx inngest-cli@latest dev`

**Production:**

- Vercel for frontend (`vercel.json` present)
- Railway for API (`railway.json` present, Dockerfile)
- Inngest Cloud for background jobs

## Scripts

**Frontend (`apps/x402-jobs/package.json`):**

```bash
pnpm dev        # Start Next.js dev server on port 3010
pnpm build      # Production build
pnpm lint       # ESLint check
pnpm lint:fix   # ESLint with auto-fix
pnpm typecheck  # TypeScript type check
```

**API (`apps/x402-jobs-api/package.json`):**

```bash
pnpm dev        # Start Express + Inngest dev servers
pnpm dev:api    # Express only (port 3011)
pnpm build      # tsup bundle
pnpm test       # Vitest
pnpm lint       # ESLint check
```

---

_Stack analysis: 2026-01-19_
