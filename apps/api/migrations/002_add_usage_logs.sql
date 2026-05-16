-- Migration: 003_add_usage_logs.sql
-- Purpose: Add usage logging for prompt template executions

-- Create usage logs table
CREATE TABLE IF NOT EXISTS x402_prompt_template_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  caller_id UUID NOT NULL,

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,

  -- Token usage (from Claude response)
  input_tokens INTEGER,
  output_tokens INTEGER,

  -- Payment details
  amount_paid NUMERIC(10, 6),
  payment_signature TEXT,
  network TEXT,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  execution_time_ms INTEGER,

  -- Foreign keys
  CONSTRAINT fk_template FOREIGN KEY (template_id)
    REFERENCES x402_resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_caller FOREIGN KEY (caller_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_ptul_template_id ON x402_prompt_template_usage_logs(template_id);
CREATE INDEX idx_ptul_caller_id ON x402_prompt_template_usage_logs(caller_id);
CREATE INDEX idx_ptul_created_at ON x402_prompt_template_usage_logs(created_at DESC);
CREATE INDEX idx_ptul_template_caller ON x402_prompt_template_usage_logs(template_id, caller_id);

-- RLS: Users can only read their own usage logs
ALTER TABLE x402_prompt_template_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own logs
CREATE POLICY "Users can read own usage logs"
  ON x402_prompt_template_usage_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id);

-- Policy: Service role can insert (backend writes logs)
CREATE POLICY "Service role can insert usage logs"
  ON x402_prompt_template_usage_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Template owners can read all logs for their templates
CREATE POLICY "Owners can read template usage logs"
  ON x402_prompt_template_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM x402_resources r
      JOIN x402_servers s ON r.server_id = s.id
      WHERE r.id = template_id
      AND (s.registered_by = auth.uid() OR s.verified_owner_id = auth.uid())
    )
  );
