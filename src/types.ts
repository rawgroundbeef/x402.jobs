// ============ Trust Types ============

export interface Score {
  url: string
  success_rate: number | null // 0-1, null if insufficient data
  calls: number
  value_processed: string
  last_called: string | null
}

export interface TopOptions {
  limit?: number // default: 20, max: 100
  category?: string
}

// ============ Resource Types ============

export interface Resource {
  id: string
  name: string
  description?: string
  resource_url: string
  network?: string
  category?: string
  price?: string
  icon_url?: string | null
  owner_id?: string
  created_at?: string
  updated_at?: string
  // Trust data (when included)
  success_rate?: number | null
  calls?: number
  value_processed?: string
  last_called?: string | null
}

export interface ResourceListOptions {
  limit?: number
  sort?: 'popular' | 'recent' | 'name'
}

export interface ResourceSearchOptions {
  query?: string
  category?: string
  minSuccessRate?: number
  minCalls?: number
  limit?: number
  offset?: number
}

export interface ResourceCreateInput {
  url: string
  name: string
  description?: string
  category?: string
  price: string
  icon_url?: string
}

export interface ResourceUpdateInput {
  name?: string
  description?: string
  category?: string
  price?: string
  icon_url?: string
}

// ============ Client Types ============

/**
 * Stacks wallet configuration for x402 payments.
 * Used with @openfacilitator/sdk for settlement.
 */
export interface StacksWalletConfig {
  /** Wallet type discriminator */
  type: 'stacks'
  /** Network: mainnet or testnet */
  network: 'mainnet' | 'testnet'
  /** Wallet address (SP... for mainnet, ST... for testnet) */
  address: string
}

/**
 * Wallet configuration for x402 payments.
 * Currently supports Stacks; extensible for future chains.
 */
export type WalletConfig = StacksWalletConfig

export interface ClientOptions {
  apiKey?: string
  baseUrl?: string
  wallet?: WalletConfig
}

// ============ API Response Types ============

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiErrorResponse {
  data?: never
  error: {
    code: string
    message: string
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse

// ============ Error Codes ============

export type ErrorCode =
  | 'NOT_FOUND'
  | 'PAYMENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
