# x402-jobs Migration Audit

**Created:** 2026-01-28
**Purpose:** Document all database tables and migrations needed for standalone x402-jobs repo

## Summary

- **Total migrations identified:** 65+ files
- **Root migrations needed:** ~55 files
- **x402-jobs/migrations (additive):** 6 files
- **Shared dependencies:** profiles, api_keys (need fresh versions)

## Approach Options

### Option A: Consolidated Fresh Schema (Recommended)

Create a single `001_initial_schema.sql` that contains all tables from scratch, then apply the 6 x402-jobs/migrations as 002-007.

**Pros:**

- Clean slate, no migration history baggage
- Easier to understand and maintain
- Can remove any unused columns/tables

**Cons:**

- Manual work to compile schema
- Need to verify no missing pieces

### Option B: Sequential Migration Replay

Copy all 55+ migrations in order, then apply x402-jobs migrations.

**Pros:**

- Preserves full history
- Less manual work

**Cons:**

- Some migrations may have conflicts or dependencies on non-x402 tables
- May include unused alterations

---

## Tables Required

### Core x402 Tables (prefixed)

| Table                             | Source Migration                                     | Notes                     |
| --------------------------------- | ---------------------------------------------------- | ------------------------- |
| x402_servers                      | 20250525_create_x402_servers_table.sql               | Server registry           |
| x402_resources                    | 20250525_add_x402_resource_schema.sql                | Resources + pt\_\* fields |
| x402_jobs                         | 20250204_create_x402_jobs_tables.sql                 | Job definitions           |
| x402_job_runs                     | 20250526_create_x402_job_runs.sql                    | Execution records         |
| x402_job_run_events               | 20250526_add_x402_job_run_events_columns.sql         | Run events/logs           |
| x402_cached_images                | 20250525_create_x402_cached_images.sql               | Image cache               |
| x402_transactions                 | 20250204_create_x402_jobs_tables.sql                 | Payment records           |
| x402_facilitators                 | 20251225_add_facilitator_addresses.sql               | Payment facilitators      |
| x402_facilitator_addresses        | 20251225_add_facilitator_addresses.sql               | Multi-network addresses   |
| x402_scheduled_runs               | 20251219_add_scheduled_jobs.sql                      | Cron-like scheduling      |
| x402_refunds                      | 20260112_create_x402_refunds.sql                     | Refund tracking           |
| x402_notifications                | 20251217_create_notifications_and_review_updates.sql | User notifications        |
| x402_user_wallets                 | 20251207_add_x402_integrations.sql                   | User wallet configs       |
| x402_user_telegram_configs        | 20251207_add_x402_integrations.sql                   | Telegram integration      |
| x402_user_x_tokens                | 20251207_add_x402_integrations.sql                   | X/Twitter tokens          |
| x402_user_claude_configs          | 002_add_claude_integration.sql                       | Claude API keys           |
| x402_user_openrouter_integrations | 005_add_openrouter_integration.sql                   | OpenRouter API keys       |
| x402_openrouter_models            | 005_add_openrouter_integration.sql                   | AI model catalog          |
| x402_prompt_template_usage_logs   | 003_add_usage_logs.sql                               | Execution logs            |
| x402*indexer*\*                   | 20251225_create_x402_indexer_tables.sql              | Blockchain indexing       |

### Views

| View                  | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| public_x402_resources | Public resource discovery (hides pt\_\* fields) |

### Hiring System Tables

| Table                | Source Migration                                     |
| -------------------- | ---------------------------------------------------- |
| x402_hiring_requests | 20251216_create_hiring_board_tables.sql              |
| x402_hiring_offers   | 20251216_create_hiring_board_tables.sql              |
| x402_reviews         | 20251217_create_notifications_and_review_updates.sql |

### Hackathon Tables

| Table                      | Source Migration        |
| -------------------------- | ----------------------- |
| x402_hackathons            | 20251228_hackathons.sql |
| x402_hackathon_submissions | 20251228_hackathons.sql |
| x402_hackathon_prizes      | 20251228_hackathons.sql |
| x402_hackathon_sponsors    | 20260111_sponsors.sql   |

### Rewards Tables

| Table                   | Source Migration                          |
| ----------------------- | ----------------------------------------- |
| x402_rewards_config     | 20251231_add_rewards_config.sql           |
| x402_rewards_claims     | 20251231_create_jobs_rewards_tables.sql   |
| x402_treasury_transfers | 20251231_add_treasury_transfers_audit.sql |

### Shared/Foundation Tables

| Table    | Source Migration                   | Notes             |
| -------- | ---------------------------------- | ----------------- |
| profiles | 20251208_create_user_profiles.sql  | User display info |
| api_keys | 20250110_create_api_keys_table.sql | API key auth      |

**Note:** The `users` table referenced in hiring.service.ts and jobs.ts appears to be a Supabase auth.users reference, not a custom table.

### Platform Stats

| Table                     | Source Migration                         |
| ------------------------- | ---------------------------------------- |
| x402_platform_stats_cache | 20250527_create_platform_stats_cache.sql |

---

## Root Migrations (Chronological)

### Foundation (Feb-May 2025)

1. 20250110_create_api_keys_table.sql
2. 20250204_create_x402_jobs_tables.sql
3. 20250525_create_x402_servers_table.sql
4. 20250525_add_x402_resource_schema.sql
5. 20250525_create_x402_cached_images.sql
6. 20250526_create_x402_job_runs.sql
7. 20250526_add_x402_job_run_events_columns.sql
8. 20250526_add_x402_jobs_display_id.sql
9. 20250527_create_platform_stats_cache.sql
10. 20250529_add_x402_jobs_creator_markup.sql
11. 20250529_add_x402_jobs_stats.sql
12. 20250529_add_x402_jobs_trigger_methods.sql

### Network & Wallet (Dec 2025)

13. 20251201_add_base_wallet_to_x402.sql
14. 20251201_add_network_to_x402_jobs.sql
15. 20251202_add_network_to_job_run_events.sql
16. 20251202_normalize_resource_urls.sql
17. 20251205_decrement_server_resource_count.sql
18. 20251205_resource_discovery.sql
19. 20251206_add_slugs.sql
20. 20251206_add_job_embeddings.sql
21. 20251206_server_stats.sql
22. 20251206_add_input_schema_to_search.sql
23. 20251207_add_x402_integrations.sql
24. 20251207_backfill_slugs.sql
25. 20251208_add_unique_job_names.sql
26. 20251208_create_user_profiles.sql
27. 20251210_add_webhook_rule_id_to_x_settings.sql
28. 20251210_add_prompt_templates.sql

### Hiring & Notifications (Dec 2025)

29. 20251216_create_hiring_board_tables.sql
30. 20251217_add_inputs_to_hiring_requests.sql
31. 20251217_create_notifications_and_review_updates.sql
32. 20251219_add_scheduled_jobs.sql
33. 20251220_add_published_to_jobs.sql
34. 20251221_add_bio_to_profiles.sql
35. 20251221_add_resource_ownership_verification.sql
36. 20251222_add_server_ownership_verification.sql

### Facilitators & Indexer (Dec 2025)

37. 20251225_add_platform_stats_text_value.sql
38. 20251225_add_facilitator_addresses.sql
39. 20251225_expand_network_check_constraint.sql
40. 20251225_create_x402_indexer_tables.sql
41. 20251226_add_job_chaining.sql
42. 20251226_add_loop_stopped_notification_type.sql
43. 20251226_add_schedule_paused_notification_type.sql

### Hackathons (Dec 2025)

44. 20251228_hackathons.sql
45. 20251228_hackathon_single_prize.sql
46. 20251228_hackathon_update_rules.sql
47. 20251228_hackathon_update_rules_v2.sql
48. 20251228_hackathon_url_submissions.sql
49. 20251228_fix_hackathon_status.sql
50. 20251228_fix_hackathon_dates.sql
51. 20251228_add_hackathon_winner_notification.sql
52. 20251228_add_resource_display_path.sql
53. 20251228_drop_x402scan_url.sql

### Rewards & Payments (Dec 2025 - Jan 2026)

54. 20251231_add_rewards_config.sql
55. 20251231_create_jobs_rewards_tables.sql
56. 20251231_add_treasury_transfers_audit.sql
57. 20251231_make_claims_signature_optional.sql
58. 20251231_add_show_workflow_to_jobs.sql
59. 20260103_add_payment_fields_to_runs.sql
60. 20260103_add_webhook_response_to_jobs.sql
61. 20260104_add_pending_payouts.sql
62. 20260104_fix_job_earnings_calculation.sql
63. 20260104_fix_run_count_trigger.sql
64. 20260104_add_refund_breakdown_to_payouts.sql
65. 20260104_add_job_success_rate.sql
66. 20260104_add_resource_success_rate.sql
67. 20260104_add_full_revenue_tracking.sql

### Resources & Refunds (Jan 2026)

68. 20260105_add_resource_health_status.sql
69. 20260105_filter_offline_from_search.sql
70. 20260105_filter_low_success_rate_from_search.sql
71. 20260107_add_resource_last_called_at.sql
72. 20260108_add_realtime_resource_stat_functions.sql
73. 20260108_backfill_event_resource_ids.sql
74. 20260110_add_resource_is_a2a.sql
75. 20260111_allow_duplicate_job_names.sql
76. 20260111_hackathon_numbering.sql
77. 20260111_hackathon_1_complete_and_hackathon_2.sql
78. 20260111_sponsors.sql
79. 20260112_create_x402_refunds.sql
80. 20260112_allow_null_ends_at.sql
81. 20260113_add_refund_notification_type.sql
82. 20260114_instant_resources.sql
83. 20260114_resource_url_network_unique.sql
84. 20260115_add_price_usdc.sql
85. 20260115_release_archived_slugs.sql
86. 20260115_hackathon_2_release.sql
87. 20260115_sponsor_display_name.sql
88. 20260120_add_resource_executions.sql
89. 20260120_update_resource_stats_rpc.sql

### x402-jobs Additive Migrations (v1.1-v1.4)

90. 001_add_prompt_template_fields.sql (may overlap with 20251210)
91. 002_add_claude_integration.sql
92. 003_add_usage_logs.sql
93. 004_add_supports_refunds.sql
94. 005_add_openrouter_integration.sql
95. 006_add_ai_models_curation.sql

---

## Recommended Next Steps

1. **Create new Supabase project** (Micro tier is fine to start)
2. **Copy root migrations to new migrations folder** (exclude shopputer/tradeputer/commands)
3. **Test migration order** - some may need reordering due to FK dependencies
4. **Apply x402-jobs migrations** (002-006, skip 001 if 20251210 covers it)
5. **Verify schema** - compare against current production
6. **Update environment variables** in new repo

---

## Files to Exclude

These migrations are for other apps sharing the same Supabase:

- 20250123_add_pair_address_to_coins.sql (memeputer)
- 20250125*create_shopputer*\*.sql (shopputer)
- 20250126*add_shopputer*\*.sql (shopputer)
- 20250127*add_shopputer*\*.sql (shopputer)
- 20250128_add_asin_to_list_items.sql (shopputer)
- 20250128*add_shopputer*\*.sql (shopputer)
- 20250128*create_shopputer*\*.sql (shopputer)
- 20250130*shopputer*\*.sql (shopputer)
- 20250203\__tradeputer_.sql (tradeputer)
- 20250104_tradeputer\*.sql (tradeputer)
- 20251101*add_coins*\*.sql (memeputer)
- 20251101*add_featured_agents*\*.sql (memeputer)
- 20251101*add_participants*\*.sql (memeputer)
- 20251102\__agent_profile_.sql (memeputer)
- 20251103*add_banner*\*.sql (memeputer)
- 20250105*create_agent_chat*\*.sql (memeputer)
- 20250106*add_deleted_at_to_agent_chat*\*.sql (memeputer)
- 20251106*add_get_random_voice*\*.sql (memeputer)
- 20250108*stickerputer*.sql (stickerputer)
- 999_add_agent_api_integration.sql (memeputer)
- 1000_add_integration_overrides.sql (memeputer)
- 1001_add_payment_platform.sql (memeputer)
- 20250114*create_agent_knowledge*\*.sql (memeputer)
- 20250115*add*_\_to_knowledge_.sql (memeputer)
- 20250116\_\*.sql (memeputer knowledge)
- 20250117_add_deleted_at_to_participants.sql (memeputer)
- 20250118*create_admin_impersonation*\*.sql (memeputer)
- 20250120_add_base_wallet_to_participants.sql (memeputer)
- 20250120_create_ai_models_table.sql (memeputer - conflicts with x402_openrouter_models)
- 20250123_add_tool_calling_supported_to_ai_models.sql (memeputer)
- 20251028_add_base_wallet_support.sql (memeputer participants)
- 20251119_normalize_solana_payment_network.sql (memeputer commands)
- 20251124*ensure_telegram_conversation*\*.sql (memeputer)
- 20251213_wallet_settings_refactor.sql (memeputer commands)
- 20251214_command_wallet_per_network.sql (memeputer commands)
- 20251217_update_payment_constraint_for_dynamic.sql (memeputer commands)
- 20251217_add_dynamic_pricing_to_commands.sql (memeputer commands)
- 20251218_allow_empty_integrations.sql (memeputer)
- 20251218_add_storage_path_to_agent_knowledge.sql (memeputer)
- 20251218_add_discord_integration.sql (memeputer)
- 20251218_update_discord_to_bot_token_model.sql (memeputer)
- 20251219_create_agent_conversation_history.sql (memeputer)
- 20251222_create_sms_conversations_table.sql (memeputer)
- 20250204_add_sms_to_custom_commands.sql (memeputer)
- 20250204_create_sms_integration_tables.sql (memeputer)
