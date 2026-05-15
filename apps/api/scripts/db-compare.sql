-- Run this in BOTH Supabase SQL editors (old and new) to compare row counts and latest records
-- Old: nbwdqdjyqtwkktdqouoe (auth.memeputer.com)
-- New: mgvojndnifjbxvdxkdyd

-- Quick row count comparison for all x402 tables + profiles + api_keys
SELECT
  t.table_name,
  (xpath('/row/count/text()', query_to_xml(format('SELECT count(*) FROM %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND (t.table_name LIKE 'x402_%' OR t.table_name IN ('profiles', 'api_keys'))
ORDER BY t.table_name;
