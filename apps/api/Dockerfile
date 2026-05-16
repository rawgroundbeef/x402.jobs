# Use Node 22 as the base image
FROM node:22-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libudev-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 10.6.5 — pinned pre-10.7.0 to avoid the Next.js + pnpm
# workspace bug that will land after Phase 31 merges the repos.
# Harmless for api-only builds today; future-proofs the merged image.
RUN npm install -g pnpm@10.6.5

WORKDIR /app

# Copy package files first for better caching
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build
RUN pnpm build

# Final stage for a smaller image
FROM node:22-slim AS runner
WORKDIR /app

# Copy only what's needed from the build stage
COPY --from=base /app /app

# Expose the port
EXPOSE 3011

# Start the server
CMD ["node", "dist/index.js"]
