"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { authenticatedFetcher } from "@/lib/api";
import { Button } from "@x402jobs/ui/button";
import {
  Copy,
  Check,
  ExternalLink,
  Wallet,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { SolanaIcon, BaseIcon } from "@/components/icons/ChainIcons";
import { formatDistanceToNow } from "date-fns";
import PrivateKeyCard from "@/components/pages/AccountSettingsPage/components/PrivateKeyCard";
import { EntityAvatar } from "@/components/EntityAvatar";

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

interface JobRun {
  id: string;
  status: string;
  amount: number;
  network: string;
  timestamp: string;
  completedAt: string | null;
  job: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    ownerUsername: string | null;
  } | null;
}

interface RunsResponse {
  runs: JobRun[];
  total: number;
}

// Chain configuration
const CHAINS = [
  {
    id: "solana",
    name: "Solana",
    icon: <SolanaIcon className="w-4 h-4 text-purple-500" />,
    explorerUrl: (addr: string) => `https://solscan.io/account/${addr}`,
    getAddress: (w: { address?: string }) => w.address,
    getBalance: (w: { balanceUsdc?: number }) => w.balanceUsdc ?? 0,
  },
  {
    id: "base",
    name: "Base",
    icon: <BaseIcon className="w-4 h-4 text-blue-500" />,
    explorerUrl: (addr: string) => `https://basescan.org/address/${addr}`,
    getAddress: (w: { baseAddress?: string | null }) => w.baseAddress,
    getBalance: (w: { baseBalanceUsdc?: number }) => w.baseBalanceUsdc ?? 0,
  },
];

export default function AccountWalletPage() {
  const { wallet, isLoading: walletLoading } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Fetch recent transactions
  const { data: transactionsData, isLoading: txLoading } =
    useSWR<TransactionsResponse>(
      "/wallet/transactions?limit=10",
      authenticatedFetcher,
    );

  // Fetch jobs user has run/paid for
  const { data: runsData, isLoading: runsLoading } = useSWR<RunsResponse>(
    "/wallet/runs?limit=10",
    authenticatedFetcher,
  );

  const transactions = transactionsData?.transactions ?? [];
  const runs = runsData?.runs ?? [];

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const totalBalance = wallet?.totalBalanceUsdc ?? wallet?.balanceUsdc ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold font-display">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Manage your platform wallets and view balances
        </p>
      </header>

      {/* Total Balance Card */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Wallet className="w-4 h-4" />
          <span className="text-sm">Total Platform Balance</span>
        </div>
        {walletLoading ? (
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        ) : (
          <p className="text-4xl font-bold font-mono text-primary">
            ${totalBalance.toFixed(2)}
            <span className="text-lg text-muted-foreground ml-2">USDC</span>
          </p>
        )}
      </div>

      {/* Platform Wallets */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Platform Wallets</h2>
        <p className="text-sm text-muted-foreground">
          These are your embedded wallets managed by x402.jobs. Deposits here
          are used to pay for jobs.
        </p>

        <div className="space-y-2">
          {walletLoading ? (
            <>
              <div className="h-20 bg-muted rounded-lg animate-pulse" />
              <div className="h-20 bg-muted rounded-lg animate-pulse" />
            </>
          ) : wallet ? (
            CHAINS.map((chain) => {
              const address = chain.getAddress(wallet);
              const balance = chain.getBalance(wallet);
              const isCopied = copiedAddress === address;

              if (!address) return null;

              return (
                <div
                  key={chain.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">{chain.icon}</div>
                    <div>
                      <p className="font-medium text-sm">{chain.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {shortAddress(address)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="font-mono font-semibold">
                      ${balance.toFixed(2)}
                    </p>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => copyAddress(address)}
                      >
                        {isCopied ? (
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
                          href={chain.explorerUrl(address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-border text-center text-muted-foreground">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">Unable to load wallet information</p>
            </div>
          )}
        </div>

        {/* Export Private Keys - subtle footer */}
        {wallet && <PrivateKeyCard inline />}
      </div>

      {/* Jobs I've Run */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Play className="w-5 h-5 text-muted-foreground" />
              Jobs I&apos;ve Run
            </h2>
            <p className="text-sm text-muted-foreground">
              Jobs you&apos;ve paid to execute
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {runsLoading ? (
            <>
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
            </>
          ) : runs.length > 0 ? (
            runs.map((run) => {
              const isSuccess =
                run.status === "success" || run.status === "completed";
              const isFailed = run.status === "failed";

              const jobPath = run.job?.ownerUsername
                ? `/@${run.job.ownerUsername}/${run.job.slug}`
                : null;

              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {run.job ? (
                      <EntityAvatar
                        src={run.job.avatarUrl}
                        type="job"
                        size="sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Play className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {jobPath ? (
                          <Link
                            href={jobPath}
                            className="hover:text-primary transition-colors"
                          >
                            @{run.job?.ownerUsername}/{run.job?.slug}
                          </Link>
                        ) : (
                          run.job?.name || "Unknown Job"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        {formatDistanceToNow(new Date(run.timestamp), {
                          addSuffix: true,
                        })}
                        <span
                          className={`inline-flex items-center gap-1 ${
                            isSuccess
                              ? "text-green-500"
                              : isFailed
                                ? "text-red-500"
                                : "text-yellow-500"
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : isFailed ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          {run.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="font-mono font-semibold text-orange-500">
                      -${run.amount.toFixed(2)}
                    </p>
                    {run.network === "base" ? (
                      <BaseIcon className="w-4 h-4 text-blue-500" />
                    ) : (
                      <SolanaIcon className="w-4 h-4 text-purple-500" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 rounded-lg border border-dashed border-border text-center">
              <Play className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No jobs run yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                When you run jobs via webhooks, they&apos;ll appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Activity
            </h2>
            <p className="text-sm text-muted-foreground">
              Your recent transactions and reward claims
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {txLoading ? (
            <>
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
            </>
          ) : transactions.length > 0 ? (
            transactions.map((tx) => {
              const isRewardClaim = tx.type === "reward_claim";
              const isSent = tx.type === "sent";
              const isReceived = tx.type === "received" || isRewardClaim;

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
                    <div
                      className={`p-2 rounded-lg ${
                        isRewardClaim
                          ? "bg-emerald-500/10"
                          : isReceived
                            ? "bg-green-500/10"
                            : "bg-orange-500/10"
                      }`}
                    >
                      {isRewardClaim ? (
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                      ) : isReceived ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-orange-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isRewardClaim
                          ? `$JOBS Rewards (${tx.period})`
                          : isSent
                            ? "Sent"
                            : "Received"}
                        {tx.server && (
                          <span className="text-muted-foreground ml-1">
                            · {tx.server.name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(tx.timestamp), {
                          addSuffix: true,
                        })}
                        {tx.counterparty && (
                          <span className="ml-2 font-mono">
                            {isSent ? "to " : "from "}
                            {shortAddress(tx.counterparty)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p
                      className={`font-mono font-semibold ${
                        isReceived || isRewardClaim
                          ? "text-green-500"
                          : "text-orange-500"
                      }`}
                    >
                      {isReceived || isRewardClaim ? "+" : "-"}$
                      {tx.amount.toFixed(2)}
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
              <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No transactions yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Transactions will appear here when you run jobs or claim rewards
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="font-medium text-sm mb-2">How platform wallets work</h3>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>
              Platform wallets are embedded wallets for paying job fees
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Deposit USDC to your Solana or Base wallet to run jobs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>
              Export your private keys if you want to use these wallets
              elsewhere
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
