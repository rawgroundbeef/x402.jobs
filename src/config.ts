import type { ConfigOptions, WalletConfig } from './types'

const DEFAULT_BASE_URL = 'https://x402.jobs/api/v1'

interface InternalConfig {
  apiKey: string | null
  baseUrl: string
  wallet: WalletConfig | null
}

const config: InternalConfig = {
  apiKey: null,
  baseUrl: DEFAULT_BASE_URL,
  wallet: null,
}

export function configure(options: ConfigOptions): void {
  if (options.apiKey !== undefined) {
    config.apiKey = options.apiKey
  }
  if (options.baseUrl !== undefined) {
    config.baseUrl = options.baseUrl.replace(/\/$/, '') // Remove trailing slash
  }
  if (options.wallet !== undefined) {
    config.wallet = options.wallet
  }
}

export function getConfig(): Readonly<InternalConfig> {
  return config
}

export function resetConfig(): void {
  config.apiKey = null
  config.baseUrl = DEFAULT_BASE_URL
  config.wallet = null
}
