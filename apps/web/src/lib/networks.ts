import { SolanaIcon, BaseIcon } from "@/components/icons/ChainIcons";

export type NetworkId = "solana" | "base";
// Future networks can be added here:
// export type NetworkId = "solana" | "base" | "ethereum" | "polygon" | "arbitrum";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // Tailwind color name (e.g., "purple", "blue")
  explorerUrl: (txOrAddress: string, type: "tx" | "address") => string;
  // Wallet field mappings for the wallet API response
  walletFields: {
    address: string;
    balance: string;
  };
  tagline: string;
}

// CAIP-2 identifier to internal network ID mapping
// See: https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
// NOTE: Keys must be lowercase since we lowercase input before lookup
const CAIP2_TO_NETWORK: Record<string, NetworkId> = {
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
export function normalizeNetworkId(network: string): NetworkId | null {
  // Already a v1 network ID
  if (network === "base" || network === "solana") {
    return network;
  }
  // Check CAIP-2 mappings
  const normalized = CAIP2_TO_NETWORK[network.toLowerCase()];
  return normalized || null;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  solana: {
    id: "solana",
    name: "Solana",
    shortName: "SOL",
    icon: SolanaIcon,
    color: "purple",
    explorerUrl: (id, type) =>
      type === "tx"
        ? `https://solscan.io/tx/${id}`
        : `https://solscan.io/account/${id}`,
    walletFields: {
      address: "address",
      balance: "balanceUsdc",
    },
    tagline: "Fast & low fees",
  },
  base: {
    id: "base",
    name: "Base",
    shortName: "BASE",
    icon: BaseIcon,
    color: "blue",
    explorerUrl: (id, type) =>
      type === "tx"
        ? `https://basescan.org/tx/${id}`
        : `https://basescan.org/address/${id}`,
    walletFields: {
      address: "baseAddress",
      balance: "baseBalanceUsdc",
    },
    tagline: "EVM compatible",
  },
  // Easy to add more networks:
  // ethereum: {
  //   id: "ethereum",
  //   name: "Ethereum",
  //   shortName: "ETH",
  //   icon: EthereumIcon,
  //   color: "indigo",
  //   explorerUrl: (id, type) =>
  //     type === "tx"
  //       ? `https://etherscan.io/tx/${id}`
  //       : `https://etherscan.io/address/${id}`,
  //   walletFields: {
  //     address: "ethAddress",
  //     balance: "ethBalanceUsdc",
  //   },
  //   tagline: "The OG",
  // },
};

// Get network config, defaulting to Solana
// Supports both v1 ("base") and v2/CAIP-2 ("eip155:8453") formats
export function getNetwork(networkId?: string | null): NetworkConfig {
  if (networkId) {
    // First check if it's directly in our networks
    if (networkId in NETWORKS) {
      return NETWORKS[networkId as NetworkId];
    }
    // Try to normalize CAIP-2 format to v1
    const normalized = normalizeNetworkId(networkId);
    if (normalized && normalized in NETWORKS) {
      return NETWORKS[normalized];
    }
  }
  return NETWORKS.solana;
}

// Get all networks as an array (useful for rendering lists)
export function getAllNetworks(): NetworkConfig[] {
  return Object.values(NETWORKS);
}

// Get balance from wallet data based on network
export function getNetworkBalance(
  walletData: Record<string, unknown> | null | undefined,
  networkId?: string | null,
): number {
  if (!walletData) return 0;
  const network = getNetwork(networkId);
  const balanceField = network.walletFields.balance;
  return (walletData[balanceField] as number) || 0;
}

// Get address from wallet data based on network
export function getNetworkAddress(
  walletData: Record<string, unknown> | null | undefined,
  networkId?: string | null,
): string | null {
  if (!walletData) return null;
  const network = getNetwork(networkId);
  const addressField = network.walletFields.address;
  return (walletData[addressField] as string) || null;
}

// Tailwind color classes for a network
export function getNetworkColors(networkId?: string | null): {
  bg: string;
  bgHover: string;
  text: string;
  border: string;
} {
  const network = getNetwork(networkId);
  const color = network.color;
  return {
    bg: `bg-${color}-500/10`,
    bgHover: `bg-${color}-500/20`,
    text: `text-${color}-500`,
    border: `border-${color}-500`,
  };
}
