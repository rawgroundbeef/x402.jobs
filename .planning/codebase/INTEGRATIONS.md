# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Supabase:**

- Purpose: Authentication, database, file storage
- Frontend SDK: `@supabase/supabase-js` (anon key)
- Backend SDK: `@supabase/supabase-js` (service role key)
- Auth methods: Google OAuth, Twitter OAuth, Email/Password
- Client: `src/lib/supabase.ts` (frontend), `src/lib/supabase.ts` (API)
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**OpenAI:**

- Purpose: AI workflow builder, embeddings for resource search
- Used in: `apps/x402-jobs-api/src/routes/workflow-builder.ts`, `workflow-chat.ts`
- Models: GPT for chat completions, text-embedding for vector search
- Env var: `OPENAI_API_KEY`
- Direct API calls (no SDK)

**Inngest:**

- Purpose: Background job processing, scheduled tasks, workflow execution
- Used in: `apps/x402-jobs-api/src/inngest/`
- Functions:
  - `run-workflow` - Execute x402 workflow steps
  - `run-scheduled-jobs` - Cron-triggered job runs
  - `recover-stuck-schedules` - Watchdog for stuck jobs
  - `aggregate-server-stats` - Analytics aggregation
  - `aggregate-resource-success-rates` - Success rate calculations
  - `check-resource-health` - Resource availability monitoring
  - `monthly-jobs-rewards-snapshot` - $JOBS token rewards
  - `poll-bazaar-discovery` - x402 ecosystem indexing
  - `poll-helius-transactions` - Solana transaction monitoring
- Client: `apps/x402-jobs-api/src/lib/inngest.ts`
- Env vars: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

**X/Twitter:**

- Purpose: OAuth login, posting to X (output destination)
- SDK: `twitter-api-v2`
- OAuth flow: `apps/x402-jobs-api/src/routes/integrations.ts`
- Posting: `apps/x402-jobs-api/src/inngest/functions/run-workflow/post-to-destinations.ts`
- Env vars: `TWITTER_API_KEY`, `TWITTER_API_SECRET`
- Callback: `{PUBLIC_URL}/integrations/x/oauth/callback`

## Blockchain Networks

**Solana:**

- Purpose: x402 payments, wallet operations, token transfers
- SDK: `@solana/web3.js`, `@solana/spl-token`
- x402 SDK: `@openfacilitator/sdk`
- RPC: Helius recommended (mainnet-beta fallback)
- Operations: USDC transfers, $JOBS token distribution
- Files:
  - `apps/x402-jobs-api/src/lib/solana.ts` - Solana utilities
  - `apps/x402-jobs-api/src/lib/usdc-transfer.ts` - Token transfers
- Env vars: `SOLANA_RPC_URL`, `FEE_COLLECTION_PRIVATE_KEY`

**Base (EVM):**

- Purpose: x402 payments on Base network
- SDK: `ethers`
- RPC: `https://mainnet.base.org` (default)
- Operations: USDC transfers on Base
- Files: `apps/x402-jobs-api/src/lib/base.ts`
- Env vars: `BASE_RPC_URL`, `BASE_PLATFORM_WALLET`, `BASE_PLATFORM_WALLET_PRIVATE_KEY`

## Data Storage

**Database:**

- Provider: Supabase (PostgreSQL)
- Access: Direct Supabase client (no ORM)
- Tables managed externally (Supabase migrations)

**File Storage:**

- Provider: Supabase Storage
- Use cases: User avatars, resource images, job images
- Upload flow: Signed URLs via API (`apps/x402-jobs-api/src/routes/upload.ts`)
- Frontend hook: `src/hooks/useAvatarUpload.ts`, `src/hooks/useResourceImageUpload.ts`

**Caching:**

- Frontend: SWR with deduping and revalidation
- No Redis/Memcached - relies on Supabase query performance

## Authentication & Identity

**Auth Provider:**

- Primary: Supabase Auth
- OAuth providers: Google, Twitter/X
- Email/Password: Supported with email verification
- Implementation: `src/contexts/AuthContext.tsx` (frontend)

**Session Management:**

- JWT tokens from Supabase
- Auto-refresh enabled
- Token passed via `Authorization: Bearer` header

**API Auth Middleware:**

- Location: `apps/x402-jobs-api/src/middleware/auth.ts`
- Validates Supabase JWT tokens
- Extracts user ID for protected routes

## Real-Time Communication

**WebSocket Server:**

- Provider: Native `ws` library
- Location: `apps/x402-jobs-api/src/index.ts`
- Path: `/ws`
- Auth: Token in query string
- Events:
  - `run:started`, `run:step`, `run:completed` - Workflow execution
  - `schedule:disabled`, `schedule:updated` - Job scheduling
  - `notification` - User notifications
  - `wallet:balance` - Balance updates
  - `job:updated` - Job changes

**Frontend WebSocket Client:**

- Location: `src/hooks/useWebSocket.ts`
- Singleton pattern with automatic reconnection
- Exponential backoff (max 30s)
- Fallback: HTTP polling when `NEXT_PUBLIC_WS_URL` not set

## x402 Payment Protocol

**x402 SDK:**

- Package: `@openfacilitator/sdk`
- Purpose: Execute paid API calls to x402 resources
- Networks: Solana, Base
- Payment flow: Client signs transaction, server executes

**Platform Fee:**

- Collection: Jobputer agent (`https://agents.memeputer.com/x402/solana/jobputer/job_fee`)
- Percentage: 1.5% (configurable via `PLATFORM_FEE_PERCENTAGE`)
- Minimum: $0.01 USDC

**Escrow System:**

- Provider: Escrowputer agent
- Purpose: Bounty/hiring board deposits
- Endpoint: `https://agents.memeputer.com/x402/solana/escrowputer/escrow_deposit`

## Monitoring & Observability

**Error Tracking:**

- None detected (consider adding Sentry)

**Logs:**

- Console logging throughout
- No structured logging library

**Health Checks:**

- Endpoint: `GET /health`
- Location: `apps/x402-jobs-api/src/routes/health.ts`

## CI/CD & Deployment

**Frontend Hosting:**

- Platform: Vercel
- Config: `vercel.json`
- Build: `turbo run build --filter=x402-jobs...`

**API Hosting:**

- Platform: Railway
- Config: `railway.json`, `Dockerfile`
- Port: 3011

**Monorepo Build:**

- Tool: Turborepo
- Install: `pnpm install --frozen-lockfile`

## Webhooks & Callbacks

**Incoming Webhooks:**

- Helius (Solana indexer): `POST /webhooks/helius`
- Job triggers: `POST /@:username/:slug` (nice URLs)
- Generic webhooks: `POST /webhooks/:id`
- Honeypot game: `POST /api/webhooks/honeypot/*`
- Escrow operations: `POST /escrow/*`

**Outgoing Webhooks:**

- Job output destinations (configured per-job)
- X/Twitter posts via API

**OAuth Callbacks:**

- Supabase auth: `/auth/callback`
- X/Twitter: `/integrations/x/oauth/callback`

## External x402 Resources

**Jobputer Agent:**

- Help endpoint: `https://agents.memeputer.com/x402/solana/jobputer/help`
- Job request posting: `https://agents.memeputer.com/x402/solana/jobputer/post_job_request`
- Platform fee collection: `https://agents.memeputer.com/x402/solana/jobputer/job_fee`

**Resource Discovery:**

- Bazaar API polling for x402 ecosystem resources
- Helius webhooks for Solana transaction monitoring

## Environment Configuration Summary

**Required for Development:**

```bash
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3011

# API (.env)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

**Required for Production (additional):**

```bash
# API
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=signkey-xxx
FEE_COLLECTION_PRIVATE_KEY=base58-encoded-key
CORS_ORIGIN=https://x402.jobs

# Frontend
NEXT_PUBLIC_WS_URL=wss://api.x402.jobs/ws
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
```

---

_Integration audit: 2026-01-19_
