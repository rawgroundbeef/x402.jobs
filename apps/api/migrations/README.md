# x402-jobs-api Database Migrations

This directory contains SQL migrations for setting up a new Supabase project.

## Migration Order

Apply migrations in this order:

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Full schema dump (40 tables, 11 functions, 15 triggers, 127 indexes) |
| `002_add_usage_logs.sql` | Creates `x402_prompt_template_usage_logs` table |
| `003_add_openrouter_integration.sql` | Creates `x402_user_openrouter_integrations` + FK on resources |
| `004_add_ai_models_curation.sql` | Adds `modality` and `is_curated` to `x402_openrouter_models` |

## Applying Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project → SQL Editor
2. Paste each migration file contents in order
3. Click **Run** to execute

### Option 2: psql CLI

```bash
# Install libpq if needed
brew install libpq

# Apply migrations
/opt/homebrew/opt/libpq/bin/psql "YOUR_CONNECTION_STRING" -f migrations/001_initial_schema.sql
/opt/homebrew/opt/libpq/bin/psql "YOUR_CONNECTION_STRING" -f migrations/002_add_usage_logs.sql
/opt/homebrew/opt/libpq/bin/psql "YOUR_CONNECTION_STRING" -f migrations/003_add_openrouter_integration.sql
/opt/homebrew/opt/libpq/bin/psql "YOUR_CONNECTION_STRING" -f migrations/004_add_ai_models_curation.sql
```

## Notes

- `001_initial_schema.sql` was generated from production Supabase on 2026-01-28
- All tables are prefixed with `x402_` to avoid conflicts
- The schema includes:
  - Core tables: servers, resources, jobs, job_runs, transactions, etc.
  - Integration tables: claude_configs, telegram_configs, x_tokens, wallets
  - Feature tables: hiring, hackathons, rewards, notifications, refunds
  - Support tables: profiles, api_keys, platform_stats

## Post-Migration Steps

After applying migrations:

1. **Enable OpenRouter** (optional): Uncomment OpenRouter button in `CreateResourceModal.tsx`
2. **Sync models**: Trigger `/admin/sync-models` endpoint to populate `x402_openrouter_models`
3. **Configure RLS**: Verify Row Level Security policies are correct for your setup
