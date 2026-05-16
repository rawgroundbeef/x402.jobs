---
title: Properly resolve @hookform/resolvers + zod typing (remove 5 `as never` casts)
created: 2026-05-15
source_phase: 31-monorepo-merge-bsl
priority: low
estimated_effort: 30-60 minutes
---

# Background

Phase 31 surfaced a type-system corner case: `@hookform/resolvers@3.3.4` doesn't declare `zod` as a peer dep, so pnpm's hoisting picks up a transitive `zod@4.4.3` (from `inngest` and `openai`) when resolving the resolver's type imports. This leaks zod@4's `ZodType<any, any, $ZodTypeInternals<any, any>>` into web's `zodResolver(schema)` call sites, where web's actual schemas are zod@3 `ZodObject<...>`.

# Temporary workaround (in place now)

Root `package.json`:
```jsonc
"pnpm": {
  "overrides": {
    "zod": "3.25.76"
  }
}
```

Five `zodResolver(...)` call sites in `apps/web/src/app/dashboard/resources/new/` cast `as never`:
- `proxy/page.tsx:37`
- `openrouter/page.tsx:62`
- `claude/page.tsx:52`
- `details/page.tsx:101`
- `link/page.tsx:56`

# Proper fix options

Option A — Bump `@hookform/resolvers` to a version that handles zod@3 and zod@4 separately (5.x has separate exports per validator). May require API migration since v5 changed the schema-passing convention.

Option B — Bump `apps/web` to zod@4 directly. Then update web's 10 zod-using files for any v4 breaking changes (mostly minor — `.email()` shape changes, removed deprecations).

Option C — Add `nodeLinker: hoisted` or `public-hoist-pattern[]=*zod*` in `.npmrc` to force consistent zod resolution.

# Why this was deferred

Phase 31 was about monorepo merge + BSL license. Five `as never` casts is contained and clearly labeled; the proper fix is a clean follow-up.
