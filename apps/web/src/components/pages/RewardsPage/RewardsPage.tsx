"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useWalletModal,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { Button } from "@x402jobs/ui/button";
import { Card, CardContent } from "@x402jobs/ui/card";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import BaseLayout from "@/components/BaseLayout";
import { ClaimSuccessDialog } from "@/components/modals/ClaimSuccessDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  publicFetcher,
  authenticatedFetcher,
  authenticatedFetch,
  API_URL,
} from "@/lib/api";
import {
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
} from "lucide-react";

// $JOBS token mint address
const JOBS_MINT = "6cNcXWqYvK9nhD1TsjJ1ZH1KATXcaPaRJtZPHyVkJoBs";
import { useRewardsCountdown } from "@/hooks/useRewardsCountdown";

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Types
interface RewardEntry {
  period: string;
  amount_usdc: string;
  status: "pending" | "claimed" | "expired";
  claimed_at: string | null;
  jobs_balance: string;
  jobs_percentage: string;
}

interface RewardsResponse {
  wallet: string;
  rewards: RewardEntry[];
  total_pending: string;
  total_claimed: string;
}

interface RewardsStatsResponse {
  current_period: string;
  fees_this_month: string;
  current_pool: string;
  next_snapshot: string;
  total_distributed: string;
  total_claimed: string;
  total_unclaimed: string;
  holders_in_snapshot: number;
  claims_enabled: boolean;
}

interface ClaimResponse {
  success: boolean;
  claimed?: string;
  amount_claimed?: string;
  periods_claimed?: string[];
  platform_wallet_address?: string | null;
  platform_wallet?: string;
  tx_signature?: string;
  transaction_signature?: string;
  dry_run?: boolean;
  message: string;
  error?: string;
  note?: string;
}

interface ClaimHistoryEntry {
  period: string;
  amount_usdc: string;
  claimed_at: string;
  tx_hash: string | null;
}

interface ClaimHistoryResponse {
  claims: ClaimHistoryEntry[];
  total_claimed: string;
}

interface AccountingResponse {
  total_jobs_ran: number;
  total_platform_revenue: string;
  total_paid_to_holders: string;
  total_to_treasury: string;
  total_pending_claims: string;
  total_expired_forfeited: string;
  current_fee_wallet_balance: string;
  fee_wallet_address: string;
  monthly_breakdown: Array<{
    period: string;
    platform_fees: string;
    reward_pool: string;
    treasury_share: string;
    eligible_holders: number;
    status: string;
    snapshot_date: string;
  }>;
  updated_at: string;
}

interface CurrentPeriodResponse {
  period: string;
  period_name: string;
  days_remaining: number;
  ends_at: string;
  jobs_ran: number;
  total_volume: string;
  estimated_revenue: string;
  reward_pool: string;
  eligible_holders: number;
  total_eligible_jobs: number;
  note: string;
}

// Format currency
function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Format period to readable (2024-12 -> Dec 2024)
function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Set to true to test UI without real transfers
const DRY_RUN_MODE = false;
if (typeof window !== "undefined" && DRY_RUN_MODE) {
  console.log("🧪 REWARDS DRY RUN MODE ENABLED - No real USDC transfers");
}

export default function RewardsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3 mx-auto" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </BaseLayout>
    );
  }

  return <RewardsPageContent />;
}

function RewardsPageContent() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible: _setWalletModalVisible } = useWalletModal();
  const { user, loading: authLoading } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<ClaimResponse | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [caCopied, setCaCopied] = useState(false);
  const [showPlatformStats, setShowPlatformStats] = useState(false);

  const { timeLeft } = useRewardsCountdown();

  const walletAddress = publicKey?.toBase58() || null;
  const isLoggedIn = !!user;

  // Fetch $JOBS token balance
  const { data: jobsBalanceData, isLoading: jobsBalanceLoading } = useSWR<{
    balance: number;
  }>(
    walletAddress ? `/rewards/jobs-balance?wallet=${walletAddress}` : null,
    publicFetcher,
    { refreshInterval: 60000 },
  );
  const jobsBalance = jobsBalanceData?.balance ?? null;

  // Fetch rewards stats (public)
  const { data: stats } = useSWR<RewardsStatsResponse>(
    "/rewards/stats",
    publicFetcher,
    { refreshInterval: 60000 },
  );

  // Fetch accounting data (public)
  const { data: accounting } = useSWR<AccountingResponse>(
    "/rewards/accounting",
    publicFetcher,
    { refreshInterval: 120000 },
  );

  // Fetch current period live stats (public)
  const { data: currentPeriod } = useSWR<CurrentPeriodResponse>(
    "/rewards/current-period",
    publicFetcher,
    { refreshInterval: 30000 },
  );

  // Fetch rewards for connected wallet
  const {
    data: rewards,
    isLoading: rewardsLoading,
    mutate: refreshRewards,
  } = useSWR<RewardsResponse>(
    walletAddress ? `/rewards?wallet=${walletAddress}` : null,
    publicFetcher,
    { refreshInterval: 30000 },
  );

  // Fetch user's claim history
  const { data: claimHistory } = useSWR<ClaimHistoryResponse>(
    walletAddress ? `/rewards/claims?wallet=${walletAddress}` : null,
    publicFetcher,
    { refreshInterval: 60000 },
  );

  // Check if wallet is linked to user's account
  const { data: linkedWallets, mutate: refreshLinkedWallets } = useSWR<{
    wallets: { external_wallet_address: string }[];
  }>(isLoggedIn ? "/rewards/my-wallets" : null, authenticatedFetcher);

  const isWalletLinked =
    linkedWallets?.wallets?.some(
      (w) => w.external_wallet_address === walletAddress,
    ) ?? false;

  // Auto-link wallet when connected but not linked
  const attemptedLinkWallet = useRef<string | null>(null);

  const linkWallet = useCallback(async () => {
    if (!walletAddress || !signMessage || !isLoggedIn) return;

    setError(null);
    setIsLinking(true);

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Link wallet to x402jobs\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = (await import("bs58")).default.encode(signature);

      const response = await authenticatedFetch(
        `${API_URL}/rewards/link-wallet`,
        {
          method: "POST",
          body: JSON.stringify({
            wallet: walletAddress,
            signature: signatureBase58,
            message,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        refreshLinkedWallets();
      } else {
        setError(result.message || "Failed to link wallet");
      }
    } catch (err) {
      console.error("Link error:", err);
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Signature request was rejected");
      } else {
        setError("Failed to link wallet. Please try again.");
      }
    } finally {
      setIsLinking(false);
    }
  }, [walletAddress, signMessage, isLoggedIn, refreshLinkedWallets]);

  // Auto-link when wallet is connected but not yet linked
  useEffect(() => {
    if (attemptedLinkWallet.current === walletAddress) {
      return;
    }

    if (
      isLoggedIn &&
      connected &&
      walletAddress &&
      signMessage &&
      linkedWallets !== undefined &&
      !isWalletLinked &&
      !isLinking
    ) {
      attemptedLinkWallet.current = walletAddress;
      linkWallet();
    }
  }, [
    isLoggedIn,
    connected,
    walletAddress,
    signMessage,
    linkedWallets,
    isWalletLinked,
    isLinking,
    linkWallet,
  ]);

  // Claim rewards
  const claimRewards = useCallback(async () => {
    if (!walletAddress || !isLoggedIn) return;

    setError(null);
    setIsClaiming(true);

    try {
      const response = await authenticatedFetch(`${API_URL}/rewards/claim`, {
        method: "POST",
        body: JSON.stringify({
          wallet: walletAddress,
          dryRun: DRY_RUN_MODE,
        }),
      });

      const result: ClaimResponse = await response.json();

      if (result.success) {
        setClaimSuccess(result);
        setShowSuccessDialog(true);
        refreshRewards();
      } else {
        setError(result.message || "Claim failed");
      }
    } catch (err) {
      console.error("Claim error:", err);
      setError("Failed to claim rewards. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  }, [walletAddress, isLoggedIn, refreshRewards]);

  const pendingAmount = parseFloat(rewards?.total_pending || "0");
  const hasPendingRewards = pendingAmount > 0;
  const totalClaimed = parseFloat(rewards?.total_claimed || "0");

  // Calculate estimated share for current period
  const estimatedShare =
    jobsBalance &&
    currentPeriod?.total_eligible_jobs &&
    jobsBalance >= 1_000_000
      ? (jobsBalance / currentPeriod.total_eligible_jobs) *
        parseFloat(currentPeriod.reward_pool || "0")
      : 0;

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="space-y-8">
        {/* Hero Section */}
        <motion.div
          className="pt-16 pb-8 text-center"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <h1 className="text-4xl sm:text-5xl font-bold font-display text-foreground tracking-tight">
            Collect Your Paycheck
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            50% of platform fees paid to $JOBS holders in USDC.
            <br />
            <span className="text-sm">Minimum 1M $JOBS to qualify.</span>
          </p>
        </motion.div>

        {/* Dry Run Mode Banner */}
        {DRY_RUN_MODE && (
          <Alert className="bg-amber-50 border-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>🧪 DRY RUN MODE</strong> - Claims simulate success without
              real USDC transfers.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Claim Success Dialog */}
        <ClaimSuccessDialog
          isOpen={showSuccessDialog}
          onClose={() => setShowSuccessDialog(false)}
          amountClaimed={
            claimSuccess?.claimed || claimSuccess?.amount_claimed || "0"
          }
          platformWallet={
            claimSuccess?.platform_wallet_address ||
            claimSuccess?.platform_wallet
          }
          txSignature={
            claimSuccess?.tx_signature || claimSuccess?.transaction_signature
          }
          isDryRun={claimSuccess?.dry_run}
        />

        {/* ========== CURRENT PERIOD TRACKER ========== */}
        {currentPeriod && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <Card className="bg-muted/30 border-border">
              <CardContent className="py-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Current Period
                    </p>
                    <p className="text-lg font-semibold">
                      {currentPeriod.period_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      ends in{" "}
                      <span className="font-medium text-foreground">
                        {currentPeriod.days_remaining} days
                      </span>
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {currentPeriod.jobs_ran.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Jobs Ran</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-2xl font-bold text-emerald-500">
                      {formatUsd(currentPeriod.estimated_revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">Revenue*</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-2xl font-bold text-blue-500">
                      {formatUsd(currentPeriod.reward_pool)}
                    </p>
                    <p className="text-xs text-muted-foreground">Reward Pool</p>
                  </div>
                </div>

                {/* Footnote */}
                <p className="text-xs text-muted-foreground text-center mt-3">
                  *Estimated. Final amounts calculated at month end.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ========== SECTION 1: THE CLAIM CARD ========== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-0 bg-gradient-to-br from-card via-card to-[#10b981]/5">
            <CardContent className="pt-10 pb-8">
              {/* Not Logged In */}
              {!authLoading && !isLoggedIn && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    Connect to Claim
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Log in to see if you have rewards waiting
                  </p>
                  <Link href="/login" className="inline-block mt-6">
                    <Button
                      size="lg"
                      className="text-white bg-gradient-to-r from-[#10b981] via-[#14b8a6] to-[#06b6d4] hover:from-[#059669] hover:via-[#0d9488] hover:to-[#0891b2]"
                    >
                      Log In / Sign Up
                    </Button>
                  </Link>
                </div>
              )}

              {/* Logged In but Wallet Not Connected */}
              {isLoggedIn && !connected && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    Connect Your $JOBS Wallet
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Connect the wallet holding your $JOBS to claim
                  </p>
                  <div className="mt-6">
                    <WalletMultiButton className="!bg-[#10b981] hover:!bg-[#059669] !rounded-lg !h-12 !px-8 !font-medium" />
                  </div>
                </div>
              )}

              {/* Wallet Linking in Progress */}
              {isLoggedIn && connected && !isWalletLinked && (
                <div className="text-center space-y-6">
                  <Loader2 className="w-12 h-12 mx-auto text-[#10b981] animate-spin" />
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-foreground">
                      {isLinking
                        ? "Linking wallet..."
                        : "Sign to verify ownership"}
                    </p>
                    <p className="text-muted-foreground">
                      One-time signature to prove you own this wallet
                    </p>
                  </div>
                  {error && !isLinking && (
                    <Button
                      onClick={() => {
                        attemptedLinkWallet.current = null;
                        setError(null);
                      }}
                      variant="outline"
                    >
                      Try Again
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                    <button
                      onClick={disconnect}
                      className="ml-2 text-red-500 hover:text-red-600 underline"
                    >
                      Disconnect
                    </button>
                  </p>
                </div>
              )}

              {/* Loading State */}
              {isLoggedIn && connected && isWalletLinked && rewardsLoading && (
                <div className="text-center py-8">
                  <Loader2 className="w-10 h-10 mx-auto animate-spin text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">
                    Loading your rewards...
                  </p>
                </div>
              )}

              {/* ✅ HAS CLAIMABLE REWARDS */}
              {isLoggedIn &&
                connected &&
                isWalletLinked &&
                !rewardsLoading &&
                hasPendingRewards && (
                  <div className="text-center space-y-6">
                    <div className="text-6xl">💰</div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm uppercase tracking-wider">
                        You have
                      </p>
                      <p className="text-5xl font-bold text-[#10b981] font-display">
                        {formatUsd(pendingAmount)}
                      </p>
                      <p className="text-muted-foreground">to claim</p>
                    </div>

                    {/* Claim Button */}
                    {stats?.claims_enabled ? (
                      <Button
                        onClick={claimRewards}
                        disabled={isClaiming}
                        size="lg"
                        className="px-12 py-6 text-lg text-white bg-gradient-to-r from-[#10b981] via-[#14b8a6] to-[#06b6d4] hover:from-[#059669] hover:via-[#0d9488] hover:to-[#0891b2]"
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            Claim Now
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          disabled
                          size="lg"
                          variant="secondary"
                          className="px-8"
                        >
                          <Clock className="w-5 h-5 mr-2" />
                          Claims Opening Soon
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Your reward is locked in. Claims open shortly!
                        </p>
                      </div>
                    )}

                    {/* Secondary Stats */}
                    <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground pt-4">
                      {estimatedShare > 0 && (
                        <span>
                          This month (est):{" "}
                          <span className="text-foreground font-medium">
                            ~{formatUsd(estimatedShare)}
                          </span>
                        </span>
                      )}
                      {totalClaimed > 0 && (
                        <span>
                          Total earned:{" "}
                          <span className="text-foreground font-medium">
                            {formatUsd(totalClaimed + pendingAmount)}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Wallet Footer */}
                    <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {walletAddress?.slice(0, 4)}...
                        {walletAddress?.slice(-4)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="hover:text-foreground transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}

              {/* NO CLAIMABLE REWARDS - All Caught Up */}
              {isLoggedIn &&
                connected &&
                isWalletLinked &&
                !rewardsLoading &&
                !hasPendingRewards &&
                totalClaimed > 0 && (
                  <div className="text-center space-y-6">
                    <div className="text-5xl">✓</div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-foreground">
                        All Caught Up
                      </p>
                      <p className="text-muted-foreground">
                        No rewards to claim right now
                      </p>
                    </div>

                    {/* Secondary Stats */}
                    <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                      {estimatedShare > 0 && (
                        <span>
                          This month (est):{" "}
                          <span className="text-foreground font-medium">
                            ~{formatUsd(estimatedShare)}
                          </span>
                        </span>
                      )}
                      <span>
                        Total earned:{" "}
                        <span className="text-foreground font-medium">
                          {formatUsd(totalClaimed)}
                        </span>
                      </span>
                    </div>

                    {/* Countdown */}
                    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                      <Clock className="w-4 h-4" />
                      {timeLeft} until next snapshot
                    </div>

                    {/* Wallet Footer */}
                    <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {walletAddress?.slice(0, 4)}...
                        {walletAddress?.slice(-4)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="hover:text-foreground transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}

              {/* QUALIFIED BUT NO REWARDS YET (first time, waiting for snapshot) */}
              {isLoggedIn &&
                connected &&
                isWalletLinked &&
                !rewardsLoading &&
                !hasPendingRewards &&
                totalClaimed === 0 &&
                (jobsBalance || 0) >= 1_000_000 && (
                  <div className="text-center space-y-6">
                    <div className="text-5xl">✓</div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-[#10b981]">
                        You're In!
                      </p>
                      <p className="text-muted-foreground">
                        Your{" "}
                        <span className="text-foreground font-medium">
                          {Math.round(jobsBalance || 0).toLocaleString()}
                        </span>{" "}
                        $JOBS qualifies you for rewards
                      </p>
                    </div>

                    {/* Estimated Share */}
                    {estimatedShare > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Estimated this month:{" "}
                        </span>
                        <span className="text-foreground font-medium">
                          ~{formatUsd(estimatedShare)}
                        </span>
                      </div>
                    )}

                    {/* Countdown */}
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{timeLeft} until snapshot</span>
                    </div>

                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Your share is based on what you hold at snapshot time.
                      <br />
                      <span className="text-foreground font-medium">
                        Stack more to earn more!
                      </span>
                    </p>

                    {/* Wallet Footer */}
                    <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {walletAddress?.slice(0, 4)}...
                        {walletAddress?.slice(-4)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="hover:text-foreground transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}

              {/* NOT QUALIFIED (under 1M $JOBS) */}
              {isLoggedIn &&
                connected &&
                isWalletLinked &&
                !rewardsLoading &&
                !hasPendingRewards &&
                totalClaimed === 0 &&
                (jobsBalance || 0) < 1_000_000 &&
                (() => {
                  const REQUIRED_BALANCE = 1_000_000;
                  const currentBalance = jobsBalance || 0;
                  const progress = Math.min(
                    (currentBalance / REQUIRED_BALANCE) * 100,
                    100,
                  );
                  const gap = Math.max(REQUIRED_BALANCE - currentBalance, 0);
                  const isClose = progress >= 90;

                  return (
                    <div className="text-center space-y-6">
                      <p className="text-xl font-bold text-foreground">
                        {isClose ? "Almost There!" : "Keep Stacking"}
                      </p>

                      {/* Progress */}
                      <div className="space-y-3 max-w-xs mx-auto">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {jobsBalanceLoading
                              ? "..."
                              : Math.round(
                                  currentBalance,
                                ).toLocaleString()}{" "}
                            $JOBS
                          </span>
                          <span className="text-muted-foreground">
                            1M $JOBS
                          </span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(progress, 2)}%`,
                              background:
                                "linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)",
                            }}
                          />
                        </div>
                        {!jobsBalanceLoading && gap > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Need{" "}
                            <span className="text-foreground font-medium">
                              {Math.round(gap).toLocaleString()}
                            </span>{" "}
                            more to qualify
                          </p>
                        )}
                      </div>

                      {/* Countdown */}
                      <div className="flex items-center justify-center gap-2 text-amber-500 text-sm">
                        <Clock className="w-4 h-4" />
                        {timeLeft} until next snapshot
                      </div>

                      {/* Copy CA */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JOBS_MINT);
                          setCaCopied(true);
                          setTimeout(() => setCaCopied(false), 2000);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors"
                      >
                        {caCopied ? (
                          <>
                            <Check className="w-3 h-3 text-[#10b981]" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <span className="font-medium">CA:</span>
                            <span className="font-mono">
                              {JOBS_MINT.slice(0, 4)}...{JOBS_MINT.slice(-4)}
                            </span>
                            <Copy className="w-3 h-3" />
                          </>
                        )}
                      </button>

                      {/* CTAs */}
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Button variant="outline" onClick={() => disconnect()}>
                          Switch Wallet
                        </Button>
                        <Button
                          asChild
                          className="text-white bg-gradient-to-r from-[#10b981] via-[#14b8a6] to-[#06b6d4] hover:from-[#059669] hover:via-[#0d9488] hover:to-[#0891b2]"
                        >
                          <a
                            href="https://coinmarketcap.com/currencies/x402jobs/"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Buy $JOBS
                          </a>
                        </Button>
                      </div>

                      {/* Wallet Footer */}
                      <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {walletAddress?.slice(0, 4)}...
                          {walletAddress?.slice(-4)}
                        </span>
                        <button
                          onClick={() => disconnect()}
                          className="hover:text-foreground transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </CardContent>
          </Card>
        </motion.div>

        {/* ========== SECTION 2: CLAIM HISTORY ========== */}
        {isLoggedIn &&
          connected &&
          isWalletLinked &&
          (claimHistory?.claims?.length || 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Your Claim History
              </h2>
              <Card>
                <div className="divide-y divide-border">
                  {claimHistory?.claims.map((claim, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          {formatPeriod(claim.period)}
                        </span>
                        <span className="text-[#10b981] font-semibold">
                          {formatUsd(claim.amount_usdc)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Check className="w-3 h-3 text-[#10b981]" />
                          Claimed
                        </span>
                        {claim.tx_hash && (
                          <a
                            href={`https://solscan.io/tx/${claim.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View tx
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

        {/* ========== SECTION 3: PLATFORM STATS (COLLAPSED) ========== */}
        <motion.div
          className="border-t border-border pt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* One-liner always visible */}
          <button
            onClick={() => setShowPlatformStats(!showPlatformStats)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Platform Stats
              </h2>
              <span className="text-sm text-muted-foreground">
                {formatUsd(accounting?.total_paid_to_holders || "0")}{" "}
                distributed • {stats?.holders_in_snapshot || 0} holders •{" "}
                {accounting?.total_jobs_ran?.toLocaleString() || "0"} jobs
              </span>
            </div>
            {showPlatformStats ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Expanded details */}
          <AnimatePresence>
            {showPlatformStats && accounting && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-6 space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {accounting.total_jobs_ran.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Jobs Ran</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-500">
                        {formatUsd(accounting.total_platform_revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Platform Revenue
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-500">
                        {formatUsd(accounting.total_paid_to_holders)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paid to Holders
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-purple-500">
                        {formatUsd(accounting.total_to_treasury)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To Treasury
                      </p>
                    </div>
                  </div>

                  {/* Secondary Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <p className="text-lg font-semibold text-amber-500">
                        {formatUsd(accounting.total_pending_claims)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pending Claims
                      </p>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <p className="text-lg font-semibold text-foreground">
                        {formatUsd(accounting.current_fee_wallet_balance)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fee Wallet Balance
                      </p>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <p className="text-lg font-semibold text-muted-foreground">
                        {formatUsd(accounting.total_expired_forfeited)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expired/Forfeited
                      </p>
                    </div>
                  </div>

                  {/* Monthly History */}
                  {accounting.monthly_breakdown.length > 0 && (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-muted/30 border-b border-border">
                        <h3 className="text-sm font-medium">Monthly History</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground">
                              <th className="px-4 py-2 text-left font-medium">
                                Period
                              </th>
                              <th className="px-4 py-2 text-right font-medium">
                                Fees
                              </th>
                              <th className="px-4 py-2 text-right font-medium">
                                Rewards
                              </th>
                              <th className="px-4 py-2 text-right font-medium">
                                Treasury
                              </th>
                              <th className="px-4 py-2 text-right font-medium">
                                Holders
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounting.monthly_breakdown.map((month) => (
                              <tr
                                key={month.period}
                                className="border-b border-border/50 hover:bg-muted/20"
                              >
                                <td className="px-4 py-2 font-medium">
                                  {month.period}
                                </td>
                                <td className="px-4 py-2 text-right text-emerald-500">
                                  {formatUsd(month.platform_fees)}
                                </td>
                                <td className="px-4 py-2 text-right text-blue-500">
                                  {formatUsd(month.reward_pool)}
                                </td>
                                <td className="px-4 py-2 text-right text-purple-500">
                                  {formatUsd(month.treasury_share)}
                                </td>
                                <td className="px-4 py-2 text-right text-muted-foreground">
                                  {month.eligible_holders}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Fee Wallet Address */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Fee Collection Wallet:{" "}
                      <a
                        href={`https://solscan.io/account/${accounting.fee_wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary hover:underline"
                      >
                        {accounting.fee_wallet_address.slice(0, 8)}...
                        {accounting.fee_wallet_address.slice(-8)}
                      </a>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer Links */}
        <div className="flex justify-center items-center gap-4 py-8 text-xs text-muted-foreground">
          <a
            href="https://coinmarketcap.com/currencies/x402jobs/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Buy $JOBS
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-muted-foreground/40">•</span>
          <Link
            href="/jobs"
            className="hover:text-foreground transition-colors"
          >
            Explore Jobs
          </Link>
          <span className="text-muted-foreground/40">•</span>
          <Link
            href="/rewards/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>
    </BaseLayout>
  );
}
