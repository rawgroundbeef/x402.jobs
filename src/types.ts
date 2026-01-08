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
  url: string
  name: string
  description: string
  icon_url: string | null
  category: string
  price: string
  owner_id: string
  created_at: string
  updated_at: string
  // Trust data (included)
  success_rate: number | null
  calls: number
  value_processed: string
  last_called: string | null
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

export interface WalletConfig {
  // TBD based on x402 payment implementation
  [key: string]: unknown
}

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
