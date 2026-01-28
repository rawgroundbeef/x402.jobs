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
} from './types'

export type {
  StacksNetwork,
  StacksTokenType,
  StacksPaymentConfig,
  StacksPaymentRequirements,
} from './stacks'
