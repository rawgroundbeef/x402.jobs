// CAIP-2 identifier to internal network ID mapping
// See: https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
// NOTE: Keys must be lowercase since we lowercase input before lookup
const CAIP2_TO_NETWORK: Record<string, string> = {
  // Base (EIP-155 chain ID 8453)
  "eip155:8453": "base",
  "base-mainnet": "base",
  // Solana (genesis hash is case-insensitive for lookup)
  "solana:mainnet": "solana",
  "solana:5eykt4usfv8p8njdtrepy1vzqkqzkvdp": "solana", // Solana mainnet genesis hash (lowercased)
};

/**
 * Normalize a network identifier to v1 format (e.g., "eip155:8453" → "base")
 */
export function normalizeNetworkId(network: string): string {
  const lowerNetwork = network.toLowerCase().trim();
  // Already a v1 network ID
  if (lowerNetwork === "base" || lowerNetwork === "solana") {
    return lowerNetwork;
  }
  // Check CAIP-2 mappings
  return CAIP2_TO_NETWORK[lowerNetwork] || lowerNetwork;
}

/**
 * Check if a network identifier is valid (either v1 or CAIP-2 format for a supported network)
 */
export function isValidNetwork(network: string): boolean {
  const normalized = normalizeNetworkId(network);
  return normalized === "base" || normalized === "solana";
}
