/**
 * Types for workflow runs and run events
 */

import type { X402StorageResult } from "@/lib/x402-storage";

export interface RunEvent {
  id: string;
  type?: string;
  resource_name?: string;
  resource_url?: string;
  node_id?: string;
  status?: string;
  output?: unknown; // Full output object (may contain artifactUrl)
  output_text?: string;
  error?: string;
  cost_usdc?: number;
  amount_paid?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  payment_signature?: string;
  network?: string;
  // HTTP debug info
  inputs?: Record<string, unknown>; // Raw configured inputs (may contain references)
  resolved_inputs?: Record<string, unknown>; // Actual resolved values sent in request
  http_status?: number; // Response status code
  response_size?: number; // Response size in bytes
}

export interface Run {
  id: string;
  status: string;
  total_cost?: number;
  resources_total?: number;
  resources_completed?: number;
  resources_failed?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  events?: RunEvent[];
  error?: string;
  // Payment tracking (for webhook/x402 runs)
  total_payment?: number;
  payment_signature?: string;
  creator_markup_earned?: number;
  payer_address?: string;
  payment_network?: string;
  triggered_by?: "manual" | "webhook" | "schedule" | "chain";
  // x402.storage integration
  x402storageUrls?: X402StorageResult[];
  storage_cost?: number; // Cost of x402.storage uploads (when backend implements)
}
