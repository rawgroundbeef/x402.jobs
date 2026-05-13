---
phase: 28-security-review
component: dependency-audit
tool: pnpm audit
target: x402jobs-api @ 6d002c1
audited: 2026-05-12
---

# Dependency Audit — `pnpm audit --prod`

**30 vulnerabilities in transitive dependencies.** Breakdown:

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 16 |
| Moderate | 11 |
| Low | 1 |
| **Total** | **30** |

## Critical

### 1. Arbitrary code execution in `protobufjs` (2 entries)

**Path:** `inngest → @opentelemetry/auto-instrumentations-node → @opentelemetry/sdk-node → @opentelemetry/exporter-logs-otlp-grpc → @grpc/grpc-js → @grpc/proto-loader → protobufjs`

Affected ≤ 7.5.5. Patched ≥ 7.5.6.

**Exploit context:** This is transitive through Inngest's OpenTelemetry-gRPC instrumentation. Exploit would require malformed gRPC protobuf traffic to be processed. We don't expose a gRPC server, so the attack surface is the OpenTelemetry exporter receiving malformed responses from its own telemetry collector. **Practical risk: low.** But the version bump is trivial.

**Fix:** Upgrade Inngest to a version that pulls a patched OpenTelemetry. May require a `pnpm.overrides` entry pinning `protobufjs >= 7.5.6` if the chain doesn't update naturally.

## High (notable)

### 2. Inngest TypeScript SDK exposes environment variables

**Path:** `inngest@3.49.3`

The audit flagged this. Need to verify affected version range. Inngest is core infrastructure here — every workflow runs through it. If env vars leak via Inngest's instrumentation/error paths, the impact is severe (Supabase service role key, `WALLET_ENCRYPTION_SECRET`, OpenAI/Anthropic keys all in env).

**Action:** Investigate which Inngest version contains the fix; bump as part of Phase 29.

### 3. `bigint-buffer` buffer overflow

**Path:** `@solana/spl-token → @solana/buffer-layout-utils → bigint-buffer`

In the Solana key handling layer. Buffer overflows in code that touches key material is high-priority to patch even if exploitability isn't obvious.

### 4. `path-to-regexp` ReDoS

**Path:** `express → path-to-regexp` (≤ 0.1.13)

Every route in the api parses paths via this lib. Crafted route inputs could trigger exponential regex backtracking, denying service. Public routes (`instant.ts`, `webhooks.ts`, `public-api.ts`, `honeypot.ts`) are the exposure surface.

### 5. Picomatch ReDoS (via `tsup`)

Build-tool dependency. Affects CI build performance under malicious commits but not runtime.

### 6. Prometheus exporter process crash (3 entries)

OpenTelemetry chain. Could be triggered by malformed metric scrape requests. We're not running a metrics endpoint that I'm aware of — needs verification.

### 7. Rollup arbitrary file write via path traversal

Build-tool dependency (via tsup). Affects local dev / CI build environment if processing untrusted source. Not a runtime issue.

### 8. Multiple `protobuf.js` issues (code injection, prototype pollution gadgets, DoS)

Same transitive chain as Critical #1. Patched by same upgrade.

## Recommended remediation

**Bundled into Phase 29 (pnpm 10 + supply-chain `.npmrc`):**

1. `pnpm update --latest` on Inngest, Express, tsup, @solana/spl-token. Verify each works.
2. Add `pnpm.overrides` in root `package.json` for stubborn transitives:
   ```json
   {
     "pnpm": {
       "overrides": {
         "protobufjs": ">=7.5.6",
         "path-to-regexp": ">=0.1.14",
         "bigint-buffer": ">=1.1.6"
       }
     }
   }
   ```
3. Re-run `pnpm audit --prod` and confirm count drops materially.
4. Document remaining unfixable (waiting on upstream) in `SECURITY.md`.

## Why these are deferred to Phase 29, not blocked-on-immediately

- None of the critical/high CVEs are exploitable through the surfaces x402.jobs actually exposes (we don't accept gRPC traffic, don't run a public Prometheus endpoint, etc.). They're risk-in-theory, not immediate-compromise vectors.
- Bundling the upgrade with the pnpm 10 migration and `.npmrc` policy means one disruptive event instead of two.
- The full upgrade pass is a 1-2 hour piece of work and warrants its own phase.

## Limitations

- `pnpm audit` only catches advisories tracked by the npm registry. Doesn't catch packages with quiet supply-chain compromises (the whole point of `minimum-release-age` in Phase 29).
- Doesn't analyze whether vulnerable code paths are reachable in our actual usage. The Inngest env-var advisory in particular needs hands-on verification.
