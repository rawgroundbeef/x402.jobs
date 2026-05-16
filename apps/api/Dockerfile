# Use Node 22 as the base image
FROM node:22-slim AS base

# Install system dependencies for native modules (isolated-vm, bigint-buffer)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libudev-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 10.6.5 — pinned (Phase 30 invariant; matches root packageManager)
RUN npm install -g pnpm@10.6.5

WORKDIR /app

# Build context MUST be the monorepo root (Railway: set Root Directory to '.'
# and use RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile, OR configure Build Context
# to the repo root). Lockfile + workspace yaml live at the root.

# Step 1: copy workspace manifests (best Docker-layer cache hit ratio)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./

# Step 2: copy every workspace package.json so pnpm can resolve the graph
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/ui/package.json ./packages/ui/

# Step 3: install entire workspace (frozen-lockfile enforces lockfile parity)
RUN pnpm install --frozen-lockfile

# Step 4: copy api source. apps/api has no cross-workspace runtime deps
# (no @x402jobs/* imports), so only apps/api/ is needed here.
COPY apps/api/ ./apps/api/

# Step 5: build api only
RUN pnpm --filter x402-jobs-api build

# --- Runtime image ---
FROM node:22-slim AS runner
WORKDIR /app

# Copy the entire built workspace from base stage. This brings node_modules
# (with compiled native binaries) and apps/api/dist/.
COPY --from=base /app /app

EXPOSE 3011

# tsup outputs to apps/api/dist/index.js. WORKDIR into apps/api so relative
# paths in the app (env loading, etc.) behave as they did in the standalone repo.
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
