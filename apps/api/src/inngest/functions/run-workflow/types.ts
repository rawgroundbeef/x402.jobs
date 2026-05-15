import type { SupabaseClient } from "@supabase/supabase-js";
import type { IEscrowRepository } from "../../../repositories/EscrowRepository";

/**
 * Configuration for a destination (Telegram, X, etc.)
 */
export interface DestinationConfig {
  type: "app" | "telegram" | "x" | "x402storage";
  enabled: boolean;
  config?: {
    chatId?: string;
    imageField?: string;
    captionField?: string;
    contentType?: string;
  };
}

/**
 * Output node from workflow definition
 */
export interface OutputNode {
  id: string;
  type: string;
  data?: {
    outputConfig?: {
      destinations?: DestinationConfig[];
    };
  };
}

/**
 * Edge in workflow definition
 */
export interface WorkflowEdge {
  source: string;
  target: string;
}

/**
 * Workflow definition structure
 */
export interface WorkflowDefinition {
  nodes?: OutputNode[];
  edges?: WorkflowEdge[];
}

/**
 * Telegram integration config from database
 */
export interface TelegramConfig {
  bot_token: string;
  default_chat_id: string;
  is_enabled: boolean;
}

/**
 * X/Twitter tokens from database
 */
export interface XTokens {
  access_token: string;
  access_secret: string;
}

/**
 * Twitter API configuration
 */
export interface TwitterConfig {
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Extracted fields from output
 */
export interface ExtractedFields {
  imageUrl?: string;
  caption?: string;
}

/**
 * Broadcast function type for WebSocket events
 */
export type BroadcastRunEvent = (
  userId: string,
  runId: string,
  jobId: string,
  eventType: "run:started" | "run:step" | "run:completed",
  payload?: Record<string, unknown>,
) => void;

/**
 * Context for postToDestinations function
 */
export interface PostToDestinationsContext {
  supabase: SupabaseClient;
  runId: string;
  jobId: string;
  outputs: Record<string, unknown>;
  twitterConfig?: TwitterConfig;
  // Wallet keys for x402.storage payment
  walletSecretKey?: string;
  baseWalletKey?: string;
  // Job network for x402.storage payment
  jobNetwork?: "solana" | "base";
  // For real-time WebSocket updates
  userId?: string;
  broadcastRunEvent?: BroadcastRunEvent;
}

/**
 * Result of posting to a destination
 */
export interface PostResult {
  destination: "telegram" | "x" | "x402storage";
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================
// Escrow Types
// ============================================

/**
 * Run data needed for escrow processing
 */
export interface EscrowRunData {
  status: string;
  total_payment: string | number | null;
  creator_markup_earned: string | number | null;
  payer_address: string | null;
  payment_network: string | null;
  creator_wallet_address: string | null;
  creator_base_wallet_address: string | null;
}

/**
 * Breakdown of refund calculation
 */
export interface RefundBreakdown {
  creator_markup: number;
  unused_resources: number;
}

/**
 * Context for createEscrowRecord function
 */
export interface CreateEscrowRecordContext {
  repository: IEscrowRepository;
  runId: string;
  jobId: string;
  userId: string;
  smartRefundsEnabled: boolean;
}

/**
 * Result of escrow record creation
 */
export interface EscrowResult {
  type: "payout" | "refund" | "skipped";
  success: boolean;
  amount?: number;
  recipient?: string;
  error?: string;
  refundBreakdown?: RefundBreakdown;
}
