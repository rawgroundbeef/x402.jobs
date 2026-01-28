"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  User,
  Zap,
  Box,
  LayoutDashboard,
  LogOut,
  Gift,
} from "lucide-react";
import { Dropdown } from "@x402jobs/ui/dropdown";
import { useWallet, type WalletData } from "@/hooks/useWallet";
import { authenticatedFetcher } from "@/lib/api";
import { SolanaIcon, BaseIcon } from "@/components/icons/ChainIcons";

// Response type for pending rewards
interface PendingRewardsResponse {
  total_pending: string;
  wallet_count: number;
  has_pending: boolean;
}

// Chain configuration - easy to add more chains
interface ChainConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  explorerUrl: (address: string) => string;
  getAddress: (wallet: WalletData) => string | null;
  getBalance: (wallet: WalletData) => number;
}

// Supported chains configuration
const CHAINS: ChainConfig[] = [
  {
    id: "solana",
    name: "Solana",
    icon: <SolanaIcon className="w-3.5 h-3.5 text-purple-500" />,
    explorerUrl: (addr) => `https://solscan.io/account/${addr}`,
    getAddress: (w) => w.address,
    getBalance: (w) => w.balanceUsdc,
  },
  {
    id: "base",
    name: "Base",
    icon: <BaseIcon className="w-3.5 h-3.5 text-blue-500" />,
    explorerUrl: (addr) => `https://basescan.org/address/${addr}`,
    getAddress: (w) => w.baseAddress,
    getBalance: (w) => w.baseBalanceUsdc,
  },
];

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [copiedChain, setCopiedChain] = useState<string | null>(null);

  // Use shared wallet hook
  const { wallet } = useWallet();

  // Fetch profile for username
  const { data: profileData } = useSWR<{
    profile: { username: string } | null;
  }>(user ? "/user/profile" : null, authenticatedFetcher);
  const username = profileData?.profile?.username;

  // Fetch pending rewards (cached for 5 minutes)
  const { data: pendingRewards } = useSWR<PendingRewardsResponse>(
    user ? "/rewards/my-pending" : null,
    authenticatedFetcher,
    { refreshInterval: 5 * 60 * 1000 }, // 5 minutes
  );

  const copyAddress = async (address: string, chainId: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedChain(chainId);
    setTimeout(() => setCopiedChain(null), 2000);
  };

  if (loading) {
    return <div className="w-5 h-5 bg-muted rounded-full animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-muted/50 hover:bg-accent transition-colors"
      >
        Login
      </Link>
    );
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const displayBalance = wallet?.totalBalanceUsdc ?? wallet?.balanceUsdc ?? 0;

  const hasPendingRewards = pendingRewards?.has_pending ?? false;

  return (
    <Dropdown
      placement="bottom-end"
      className="w-72"
      trigger={
        <button className="relative flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent transition-colors bg-muted/50">
          <span className="text-[#10b981] text-sm font-medium">$</span>
          <span className="text-sm font-mono">
            {wallet ? displayBalance.toFixed(2) : "-.--"}
          </span>
          {/* Notification dot when rewards are pending */}
          {hasPendingRewards && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#10b981] rounded-full" />
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      }
    >
      {/* User info */}
      <div className="px-3 py-2.5">
        <p className="font-medium text-sm truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>

      <div className="border-t border-border mx-3" />

      {/* Navigation */}
      <div className="p-1.5 space-y-0.5">
        {username && (
          <Link
            href={`/@${username}`}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Profile</span>
          </Link>
        )}

        <Link
          href="/dashboard/jobs"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span>My Jobs</span>
        </Link>

        <Link
          href="/dashboard/resources"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <Box className="h-4 w-4 text-muted-foreground" />
          <span>My Resources</span>
        </Link>

        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          <span>Dashboard</span>
        </Link>
      </div>

      <div className="border-t border-border mx-3" />

      {/* Rewards Row */}
      <div className="p-1.5">
        <Link
          href="/rewards"
          className="flex items-center justify-between px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Gift className="h-4 w-4 text-[#10b981]" />
            <span>Rewards</span>
          </div>
          {hasPendingRewards && (
            <span className="text-[#10b981] font-semibold text-sm">
              ${pendingRewards?.total_pending}
            </span>
          )}
        </Link>
      </div>

      <div className="border-t border-border mx-3" />

      {/* Wallet Section */}
      <div className="px-3 py-2.5">
        {wallet ? (
          <div className="space-y-3">
            {/* Total Balance - Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Platform Balance
              </span>
              <span className="text-sm font-mono font-semibold text-[#10b981]">
                ${displayBalance.toFixed(2)} USDC
              </span>
            </div>

            {/* Chain breakdown */}
            <div className="space-y-1.5">
              {CHAINS.map((chain) => {
                const address = chain.getAddress(wallet);
                const balance = chain.getBalance(wallet);
                const isCopied = copiedChain === chain.id;

                if (!address) return null;

                return (
                  <div
                    key={chain.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {/* Chain icon and name */}
                    <div className="flex items-center gap-1.5 text-muted-foreground w-16 flex-shrink-0">
                      {chain.icon}
                      <span className="text-xs">{chain.name}</span>
                    </div>

                    {/* Address */}
                    <code className="text-xs flex-1 truncate text-foreground">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </code>

                    {/* Balance */}
                    <span className="text-xs font-mono text-muted-foreground w-14 text-right flex-shrink-0">
                      ${balance.toFixed(2)}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyAddress(address, chain.id);
                        }}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="Copy address"
                      >
                        {isCopied ? (
                          <Check className="h-3 w-3 text-[#10b981]" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      <a
                        href={chain.explorerUrl(address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title={`View on ${chain.name} explorer`}
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Send USDC to any wallet to fund jobs
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            No wallets yet - created on signup
          </p>
        )}
      </div>

      <div className="border-t border-border mx-3" />

      {/* Sign out */}
      <div className="p-1.5">
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm w-full hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <span>Sign out</span>
        </button>
      </div>
    </Dropdown>
  );
}
