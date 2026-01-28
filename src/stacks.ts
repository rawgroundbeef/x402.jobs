/**
 * Stacks blockchain support for x402.jobs
 *
 * Provides constants, types, and helpers for Stacks-based x402 payments.
 * Works with @openfacilitator/sdk for settlement.
 */

// ============ Network Constants ============

/** CAIP-2 network identifiers for Stacks */
export const STACKS_NETWORKS = {
  MAINNET: 'stacks:1',
  TESTNET: 'stacks:2147483648',
} as const

export type StacksNetwork = 'mainnet' | 'testnet'

/** Map network name to CAIP-2 identifier */
export function getStacksNetworkId(network: StacksNetwork): string {
  return network === 'mainnet' ? STACKS_NETWORKS.MAINNET : STACKS_NETWORKS.TESTNET
}

// ============ Token Constants ============

/** Supported token types */
export type StacksTokenType = 'STX' | 'sBTC' | 'USDCx'

/** Token contract addresses by network */
export const STACKS_TOKENS = {
  mainnet: {
    STX: 'STX', // Native token, no contract
    sBTC: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    USDCx: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
  },
  testnet: {
    STX: 'STX',
    sBTC: 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token',
    USDCx: 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.token-susdc',
  },
} as const

/** Token decimals */
export const STACKS_DECIMALS = {
  STX: 6, // 1 STX = 1,000,000 microSTX
  sBTC: 8, // 1 sBTC = 100,000,000 satoshis
  USDCx: 6, // 1 USDCx = 1,000,000 base units
} as const

// ============ Amount Helpers ============

/**
 * Convert human-readable amount to base units
 * @param amount - Human-readable amount (e.g., "1.5")
 * @param token - Token type
 * @returns Amount in base units as string
 */
export function toBaseUnits(amount: string | number, token: StacksTokenType): string {
  const decimals = STACKS_DECIMALS[token]
  const multiplier = BigInt(10 ** decimals)
  const parts = String(amount).split('.')
  const whole = parts[0] ?? '0'
  const fraction = parts[1] ?? ''
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const baseUnits = BigInt(whole) * multiplier + BigInt(paddedFraction || '0')
  return baseUnits.toString()
}

/**
 * Convert base units to human-readable amount
 * @param baseUnits - Amount in base units
 * @param token - Token type
 * @returns Human-readable amount as string
 */
export function fromBaseUnits(baseUnits: string | bigint, token: StacksTokenType): string {
  const decimals = STACKS_DECIMALS[token]
  const value = BigInt(baseUnits)
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const fraction = value % divisor
  const paddedFraction = fraction.toString().padStart(decimals, '0')
  // Trim trailing zeros but keep at least one decimal place for clarity
  const trimmedFraction = paddedFraction.replace(/0+$/, '') || '0'
  return `${whole}.${trimmedFraction}`
}

// ============ Payment Requirements ============

export interface StacksPaymentConfig {
  /** Recipient address */
  payTo: string
  /** Amount in human-readable units (e.g., "0.001") */
  amount: string
  /** Token type */
  token: StacksTokenType
  /** Network */
  network: StacksNetwork
  /** Timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number
  /** Facilitator URL (default: OpenFacilitator public endpoint) */
  facilitatorUrl?: string
}

/**
 * Payment requirements for x402 v2 format
 * Compatible with OpenFacilitator SDK
 */
export interface StacksPaymentRequirements {
  scheme: 'exact'
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  extra: {
    facilitator: string
    tokenType: StacksTokenType
  }
}

const DEFAULT_FACILITATOR = 'https://pay.openfacilitator.io'
const DEFAULT_TIMEOUT = 300

/**
 * Create payment requirements for a Stacks payment
 */
export function createPaymentRequirements(
  config: StacksPaymentConfig
): StacksPaymentRequirements {
  const { payTo, amount, token, network, maxTimeoutSeconds, facilitatorUrl } = config

  return {
    scheme: 'exact',
    network: getStacksNetworkId(network),
    asset: STACKS_TOKENS[network][token],
    amount: toBaseUnits(amount, token),
    payTo,
    maxTimeoutSeconds: maxTimeoutSeconds ?? DEFAULT_TIMEOUT,
    extra: {
      facilitator: facilitatorUrl ?? DEFAULT_FACILITATOR,
      tokenType: token,
    },
  }
}

// ============ Address Validation ============

/**
 * Validate a Stacks address format
 * Standard: SP (mainnet) or ST (testnet)
 * Multi-sig: SM (mainnet) or SN (testnet)
 * Contract: includes a dot separator
 */
export function isValidStacksAddress(address: string): boolean {
  // Standard addresses: SP/ST/SM/SN followed by 38+ alphanumeric chars
  // Contract addresses: address.contract-name
  return /^S[PTMN][A-Z0-9]{38,}(\.[a-z][a-z0-9-]*)?$/i.test(address)
}

/**
 * Check if address matches expected network
 */
export function isAddressForNetwork(address: string, network: StacksNetwork): boolean {
  const prefix = address.slice(0, 2).toUpperCase()
  if (network === 'mainnet') {
    return prefix === 'SP' || prefix === 'SM'
  }
  return prefix === 'ST' || prefix === 'SN'
}

// ============ Explorer URLs ============

/**
 * Get Stacks explorer URL for a transaction
 */
export function getExplorerUrl(txid: string, network: StacksNetwork): string {
  const base = network === 'mainnet'
    ? 'https://explorer.hiro.so'
    : 'https://explorer.hiro.so/?chain=testnet'
  const cleanTxid = txid.startsWith('0x') ? txid : `0x${txid}`
  return `${base}/txid/${cleanTxid}`
}
