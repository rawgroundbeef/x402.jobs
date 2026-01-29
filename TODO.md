# x402jobs - Post-Migration Cleanup

## Env Var Consolidation
- [ ] Consolidate `NEXT_PUBLIC_X402_JOBS_API_URL` into `NEXT_PUBLIC_API_URL` (both point to same backend)
- [ ] Rename `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase renamed this)

## Auth
- [ ] Fix X/Twitter OAuth (was broken before migration, Google works fine)
- [ ] Remove X OAuth debug console.logs in AuthContext.tsx

## Build
- [ ] Fix vercel.json build filter (`x402-jobs` → `@x402jobs/web`)

## Code Cleanup
- [ ] Remove maintenance gate once migration is verified stable
- [ ] Remove `NEXT_PUBLIC_AGENTS_API_URL` if not needed (only used in next.config.js rewrites)
