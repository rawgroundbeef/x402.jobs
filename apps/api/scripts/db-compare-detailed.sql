-- DETAILED COMPARISON: Run in BOTH Supabase SQL editors
-- Shows row count + most recent created_at for each table
-- Compare outputs to identify tables with newer data in the old DB

-- Tables with created_at column - shows count and latest record timestamp
WITH table_stats AS (
  SELECT 'profiles' AS table_name,
    count(*) AS row_count,
    max(created_at) AS latest_created,
    max(updated_at) AS latest_updated
  FROM profiles
  UNION ALL
  SELECT 'api_keys', count(*), max(created_at), max(updated_at) FROM api_keys
  UNION ALL
  SELECT 'x402_jobs', count(*), max(created_at), max(updated_at) FROM x402_jobs
  UNION ALL
  SELECT 'x402_job_runs', count(*), max(created_at), max(updated_at) FROM x402_job_runs
  UNION ALL
  SELECT 'x402_job_run_events', count(*), max(created_at), NULL FROM x402_job_run_events
  UNION ALL
  SELECT 'x402_resources', count(*), max(created_at), max(updated_at) FROM x402_resources
  UNION ALL
  SELECT 'x402_resource_executions', count(*), max(created_at), NULL FROM x402_resource_executions
  UNION ALL
  SELECT 'x402_transactions', count(*), max(created_at), NULL FROM x402_transactions
  UNION ALL
  SELECT 'x402_user_wallets', count(*), max(created_at), max(updated_at) FROM x402_user_wallets
  UNION ALL
  SELECT 'x402_notifications', count(*), max(created_at), NULL FROM x402_notifications
  UNION ALL
  SELECT 'x402_servers', count(*), max(created_at), max(updated_at) FROM x402_servers
  UNION ALL
  SELECT 'x402_facilitators', count(*), max(created_at), max(updated_at) FROM x402_facilitators
  UNION ALL
  SELECT 'x402_facilitator_addresses', count(*), max(created_at), NULL FROM x402_facilitator_addresses
  UNION ALL
  SELECT 'x402_refunds', count(*), max(created_at), NULL FROM x402_refunds
  UNION ALL
  SELECT 'x402_scheduled_runs', count(*), max(created_at), NULL FROM x402_scheduled_runs
  UNION ALL
  SELECT 'x402_platform_stats', count(*), max(created_at), max(updated_at) FROM x402_platform_stats
  UNION ALL
  SELECT 'x402_stats_hourly', count(*), max(created_at), NULL FROM x402_stats_hourly
  UNION ALL
  SELECT 'x402_cached_images', count(*), max(created_at), NULL FROM x402_cached_images
  UNION ALL
  SELECT 'x402_sponsors', count(*), max(created_at), max(updated_at) FROM x402_sponsors
  UNION ALL
  SELECT 'x402_hackathons', count(*), max(created_at), max(updated_at) FROM x402_hackathons
  UNION ALL
  SELECT 'x402_hackathon_sponsors', count(*), max(created_at), NULL FROM x402_hackathon_sponsors
  UNION ALL
  SELECT 'x402_hackathon_submissions', count(*), max(created_at), max(updated_at) FROM x402_hackathon_submissions
  UNION ALL
  SELECT 'x402_hackathon_winners', count(*), max(created_at), NULL FROM x402_hackathon_winners
  UNION ALL
  SELECT 'x402_hiring_requests', count(*), max(created_at), max(updated_at) FROM x402_hiring_requests
  UNION ALL
  SELECT 'x402_hiring_submissions', count(*), max(created_at), max(updated_at) FROM x402_hiring_submissions
  UNION ALL
  SELECT 'x402_hiring_reviews', count(*), max(created_at), NULL FROM x402_hiring_reviews
  UNION ALL
  SELECT 'x402_hiring_payouts', count(*), max(created_at), NULL FROM x402_hiring_payouts
  UNION ALL
  SELECT 'x402_hiring_escrow_ledger', count(*), max(created_at), NULL FROM x402_hiring_escrow_ledger
  UNION ALL
  SELECT 'x402_pending_payouts', count(*), max(created_at), max(updated_at) FROM x402_pending_payouts
  UNION ALL
  SELECT 'x402_external_wallet_links', count(*), max(created_at), NULL FROM x402_external_wallet_links
  UNION ALL
  SELECT 'x402_openrouter_models', count(*), max(created_at), max(updated_at) FROM x402_openrouter_models
  UNION ALL
  SELECT 'x402_user_claude_configs', count(*), max(created_at), max(updated_at) FROM x402_user_claude_configs
  UNION ALL
  SELECT 'x402_user_telegram_configs', count(*), max(created_at), max(updated_at) FROM x402_user_telegram_configs
  UNION ALL
  SELECT 'x402_user_x_tokens', count(*), max(created_at), max(updated_at) FROM x402_user_x_tokens
  UNION ALL
  SELECT 'x402_user_openrouter_integrations', count(*), max(created_at), max(updated_at) FROM x402_user_openrouter_integrations
  UNION ALL
  SELECT 'x402_jobs_rewards_config', count(*), max(created_at), max(updated_at) FROM x402_jobs_rewards_config
  UNION ALL
  SELECT 'x402_jobs_rewards_ledger', count(*), max(created_at), NULL FROM x402_jobs_rewards_ledger
  UNION ALL
  SELECT 'x402_jobs_rewards_snapshots', count(*), max(created_at), NULL FROM x402_jobs_rewards_snapshots
  UNION ALL
  SELECT 'x402_jobs_rewards_claims', count(*), max(created_at), NULL FROM x402_jobs_rewards_claims
  UNION ALL
  SELECT 'x402_jobs_rewards_excluded_wallets', count(*), max(created_at), NULL FROM x402_jobs_rewards_excluded_wallets
  UNION ALL
  SELECT 'x402_jobs_rewards_treasury_transfers', count(*), max(created_at), NULL FROM x402_jobs_rewards_treasury_transfers
  UNION ALL
  SELECT 'x402_prompt_template_usage_logs', count(*), max(created_at), NULL FROM x402_prompt_template_usage_logs
)
SELECT
  table_name,
  row_count,
  latest_created,
  latest_updated
FROM table_stats
ORDER BY table_name;
