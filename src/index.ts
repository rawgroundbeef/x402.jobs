// Main export
export { X402Jobs } from './client'

// Error class
export { X402Error } from './errors'

// Stacks support
export {
  STACKS_NETWORKS,
  STACKS_TOKENS,
  STACKS_DECIMALS,
  getStacksNetworkId,
  toBaseUnits,
  fromBaseUnits,
  createPaymentOption,
  createStacksTokenOptions,
  createPaymentRequirements,
  isValidStacksAddress,
  isAddressForNetwork,
  getExplorerUrl,
} from './stacks'

// Type exports
export type {
  Score,
  TopOptions,
  Resource,
  ResourceListOptions,
  ResourceSearchOptions,
  ResourceCreateInput,
  ResourceUpdateInput,
  ClientOptions,
  WalletConfig,
  StacksWalletConfig,
  ErrorCode,
  // Payment types (x402 v2)
  PaymentOption,
  PaymentResource,
  PaymentRequiredV2,
  PaymentPayloadV2,
} from './types'

export type {
  StacksNetwork,
  StacksTokenType,
  StacksPaymentOptionConfig,
  StacksPaymentConfig,
  StacksPaymentRequirements,
} from './stacks'
