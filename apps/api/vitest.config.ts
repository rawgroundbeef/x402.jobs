import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // FACILITATOR_URL must be set before webhooks.ts loads (ESM hoisting means
    // process.env assignment in test files runs after static imports resolve).
    // In the api repo standalone, this was satisfied by a local .env file (gitignored).
    // In the monorepo, we provide a safe placeholder here.
    env: {
      FACILITATOR_URL: process.env.FACILITATOR_URL ?? "http://localhost:9999",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/inngest/workflow/**/*.ts", "src/routes/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.test.ts"],
    },
  },
});
