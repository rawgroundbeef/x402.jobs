# Contributing to x402.jobs

x402.jobs is licensed under [BSL 1.1](LICENSE) — please review the
license terms before contributing. By submitting a pull request, you
agree to license your contribution under the same BSL 1.1 + Additional
Use Grant terms.

## Development

```bash
pnpm install
pnpm dev   # web (3010) + api (3011) + Inngest (8288)
```

Per-app fallbacks if the unified command misbehaves:

```bash
pnpm dev:web      # apps/web only
pnpm dev:api      # apps/api only
pnpm dev:inngest  # apps/api Inngest dev server only
```

## Pull Requests

- Use conventional commits with phase scope:
  `feat(31): add monorepo merge support`,
  `fix(api): handle edge case in x402 verify`,
  `docs(web): update README quickstart`
- Run `pnpm lint && pnpm typecheck && pnpm --filter x402-jobs-api test`
  before opening a PR
- The CI workflow (`.github/workflows/ci.yml`) gates merges via
  path-filtered jobs for web vs api

## Security

See [SECURITY.md](SECURITY.md). Do NOT file security issues publicly
— use GitHub Private Vulnerability Reporting or email
`security@x402.jobs` instead.
