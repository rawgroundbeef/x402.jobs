"use client";

import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetcher } from "@/lib/api";

export interface WalletData {
  address: string;
  balanceUsdc: number;
  baseAddress: string | null;
  baseBalanceUsdc: number;
  totalBalanceUsdc: number;
  [key: string]: unknown; // Index signature for dynamic access
}

/**
 * Shared hook for wallet data - ensures single source of truth and proper caching
 */
export function useWallet() {
  const { user } = useAuth();

  const { data, error, isLoading, mutate } = useSWR<{
    wallet: WalletData | null;
  }>(user ? "/wallet" : null, authenticatedFetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    dedupingInterval: 5000, // Dedupe requests within 5 seconds
  });

  return {
    wallet: data?.wallet ?? null,
    error,
    isLoading,
    mutate,
  };
}
