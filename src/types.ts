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
  network?: string
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
  /** Simple price string for display (e.g., "$0.01", "0.001 STX") */
  price: string
  /** Structured payment options for x402 v2 (optional, for advanced use) */
  accepts?: PaymentOption[]
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
  /**
   * Private key for signing transactions (hex string, optional).
   * If provided, enables automatic payment signing.
   * WARNING: Handle with care - never log or expose.
   */
  privateKey?: string
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

// ============ Payment Types (x402 v2) ============

/**
 * A single payment option in the `accepts` array.
 * Represents one way to pay for a resource (network + token + amount).
 */
export interface PaymentOption {
  /** Payment scheme (currently always "exact") */
  scheme: 'exact'
  /** Network identifier in CAIP-2 format (e.g., "stacks:1", "eip155:8453") */
  network: string
  /** Token/asset address or identifier (e.g., "STX", contract address) */
  asset: string
  /** Amount required in base units (string to handle large numbers) */
  amount: string
  /** Recipient address */
  payTo: string
  /** Maximum timeout in seconds before payment expires */
  maxTimeoutSeconds: number
  /** Extra data (facilitator URL, token type, etc.) */
  extra: {
    /** Facilitator URL for settlement */
    facilitator: string
    /** Token type for display (e.g., "STX", "sBTC", "USDCx") */
    tokenType?: string
    /** Additional fields */
    [key: string]: unknown
  }
}

/**
 * Resource description in a 402 response.
 */
export interface PaymentResource {
  /** Resource URL */
  url: string
  /** Human-readable description */
  description?: string
  /** MIME type of the resource */
  mimeType?: string
}

/**
 * x402 v2 payment required response body.
 * Returned with HTTP 402 status when payment is required.
 */
export interface PaymentRequiredV2 {
  /** x402 protocol version */
  x402Version: 2
  /** Resource being paid for */
  resource: PaymentResource
  /** Available payment options (one per network/token combination) */
  accepts: PaymentOption[]
}

/**
 * Payment payload for x402 v2.
 * Sent in the Payment-Signature header (base64-encoded JSON).
 */
export interface PaymentPayloadV2 {
  /** x402 protocol version */
  x402Version: 2
  /** Resource being paid for */
  resource?: PaymentResource
  /** The payment option that was selected/accepted */
  accepted: PaymentOption
  /** Payment details (signature, transaction, etc.) */
  payload: {
    /** For Stacks: hex-encoded signed transaction */
    transaction?: string
    /** For EVM: signature and authorization */
    signature?: string
    authorization?: Record<string, unknown>
    /** Additional fields */
    [key: string]: unknown
  }
}

// ============ Error Codes ============

export type ErrorCode =
  | 'NOT_FOUND'
  | 'PAYMENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
