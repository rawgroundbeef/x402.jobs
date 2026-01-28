"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";
import { Button } from "@x402jobs/ui/button";
import {
  Copy,
  Check,
  ExternalLink,
  Gift,
  ArrowRight,
  Sparkles,
  Plus,
  Clock,
} from "lucide-react";
import { SolanaIcon } from "@/components/icons/ChainIcons";
import { formatDistanceToNow } from "date-fns";

interface LinkedWallet {
  id: string;
  external_wallet_address: string;
  linked_at: string;
  verified: boolean;
}

interface LinkedWalletsResponse {
  wallets: LinkedWallet[];
}

interface Transaction {
  id: string;
  signature: string | null;
  type: "sent" | "received" | "internal" | "reward_claim";
  amount: number;
  network: string;
  timestamp: string;
  counterparty: string | null;
  server: { id: string; slug: string; name: string } | null;
  period?: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

interface PendingRewardsResponse {
  totalPending: number;
  periods: Array<{
    period: string;
    amount: number;
  }>;
}

export default function DashboardRewardsPage() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Fetch linked external wallets for rewards
  const { data: linkedWalletsData, isLoading: linkedLoading } =
    useSWR<LinkedWalletsResponse>("/rewards/my-wallets", authenticatedFetcher);

  const linkedWallets = linkedWalletsData?.wallets ?? [];

  // Fetch recent reward transactions
  const { data: transactionsData, isLoading: txLoading } =
    useSWR<TransactionsResponse>(
      "/wallet/transactions?limit=20",
      authenticatedFetcher,
    );

  // Filter to only reward claims
  const rewardTransactions = (transactionsData?.transactions ?? []).filter(
    (tx) => tx.type === "reward_claim",
  );

  // Fetch pending rewards
  const { data: pendingData } = useSWR<PendingRewardsResponse>(
    "/rewards/my-pending",
    authenticatedFetcher,
  );

  const hasPendingRewards = (pendingData?.totalPending ?? 0) > 0;

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">$JOBS Rewards</h1>
        <p className="text-muted-foreground">
          Earn monthly rewards by holding $JOBS tokens
        </p>
      </div>

      {/* Pending Rewards Banner */}
      {hasPendingRewards && (
        <div className="rounded-lg border border-[#10b981]/30 bg-gradient-to-r from-[#10b981]/10 via-[#14b8a6]/8 to-[#06b6d4]/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#10b981]/10">
                <Sparkles className="w-5 h-5 text-[#10b981]" />
              </div>
              <div>
                <p className="font-medium">
                  ${pendingData?.totalPending.toFixed(2)} USDC Available
                </p>
                <p className="text-sm text-muted-foreground">
                  You have unclaimed rewards waiting
                </p>
              </div>
            </div>
            <Button
              className="bg-gradient-to-r from-[#10b981] via-[#14b8a6] to-[#06b6d4] hover:from-[#059669] hover:via-[#0d9488] hover:to-[#0891b2] text-white"
              asChild
            >
              <Link href="/rewards">
                Claim Rewards
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Linked Wallets */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Linked Wallets</h2>
          <p className="text-sm text-muted-foreground">
            Hold $JOBS in these wallets to earn monthly USDC rewards. Rewards
            are deposited to your platform wallet when you claim.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {linkedLoading ? (
            <div className="p-4 space-y-2">
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
            </div>
          ) : linkedWallets.length > 0 ? (
            <>
              <div className="divide-y divide-border">
                {linkedWallets.map((linked) => (
                  <div
                    key={linked.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <SolanaIcon className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-mono text-sm">
                          {shortAddress(linked.external_wallet_address)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Linked{" "}
                          {new Date(linked.linked_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {linked.verified && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                          Verified
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          copyAddress(linked.external_wallet_address)
                        }
                      >
                        {copiedAddress === linked.external_wallet_address ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        asChild
                      >
                        <a
                          href={`https://solscan.io/account/${linked.external_wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3 bg-muted/30">
                <Button variant="ghost" size="sm" asChild className="w-full">
                  <Link
                    href="/rewards"
                    className="flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Link Another Wallet
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <Gift className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-1">No wallets linked yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Link your $JOBS holding wallet to claim revenue sharing rewards
              </p>
              <Button asChild>
                <Link href="/rewards">
                  Link Wallet & Claim
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="font-medium text-sm mb-2">How it works</h3>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">•</span>
            <span>
              Link external wallets that hold $JOBS tokens (minimum 1M $JOBS)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">•</span>
            <span>50% of platform fees distributed monthly to holders</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">•</span>
            <span>
              Rewards are deposited to your platform wallet when you claim
            </span>
          </li>
        </ul>
      </div>

      {/* Reward History */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Reward History
          </h2>
          <p className="text-sm text-muted-foreground">
            Your claimed $JOBS revenue sharing rewards
          </p>
        </div>

        <div className="space-y-2">
          {txLoading ? (
            <>
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
            </>
          ) : rewardTransactions.length > 0 ? (
            rewardTransactions.map((tx) => {
              const explorerUrl =
                tx.network === "base"
                  ? `https://basescan.org/tx/${tx.signature}`
                  : `https://solscan.io/tx/${tx.signature}`;

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        $JOBS Rewards ({tx.period})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(tx.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="font-mono font-semibold text-green-500">
                      +${tx.amount.toFixed(2)}
                    </p>

                    {tx.signature && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        asChild
                      >
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 rounded-lg border border-dashed border-border text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No rewards claimed yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Link a wallet holding $JOBS and claim your share of platform
                fees
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
