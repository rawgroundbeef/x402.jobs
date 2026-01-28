"use client";

import Link from "next/link";
import useSWR from "swr";
import { ExternalLink, ArrowRight, Gift } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { publicFetcher } from "@/lib/api";

const BUY_JOBS_URL = "https://coinmarketcap.com/currencies/x402jobs/";

interface RewardsStats {
  current_period: string;
  fees_this_month: string;
  current_pool: string;
  next_snapshot: string;
  total_distributed: string;
  total_claimed: string;
  total_unclaimed: string;
  holders_in_snapshot: number;
}

function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

export function JobsRewards() {
  const { data: stats } = useSWR<RewardsStats>(
    "/rewards/stats",
    publicFetcher,
    {
      refreshInterval: 60000,
      dedupingInterval: 30000,
    },
  );

  // Calculate next payout display
  const nextSnapshot = stats?.next_snapshot
    ? new Date(stats.next_snapshot).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "End of month";

  return (
    <div className="py-5 px-6 rounded-xl bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/80 border border-emerald-100">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Main Message */}
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-emerald-100 hidden sm:flex">
            <Gift className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-foreground text-center sm:text-left font-medium">
              <span className="font-semibold">50% of platform fees</span>{" "}
              <span className="text-muted-foreground">
                go to $JOBS holders.
              </span>{" "}
              <span className="text-emerald-600 font-semibold">
                Monthly. In USDC.
              </span>
            </p>
          </div>
        </div>

        {/* Stats (Desktop) */}
        {stats && (
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="text-center px-4 border-r border-emerald-200">
              <p className="text-muted-foreground text-xs">This Month</p>
              <p className="font-bold text-emerald-600">
                {formatUsd(stats.fees_this_month)}
              </p>
            </div>
            <div className="text-center px-4 border-r border-emerald-200">
              <p className="text-muted-foreground text-xs">Reward Pool</p>
              <p className="font-bold text-emerald-600">
                {formatUsd(stats.current_pool)}
              </p>
            </div>
            <div className="text-center px-4">
              <p className="text-muted-foreground text-xs">Next Payout</p>
              <p className="font-bold text-foreground">{nextSnapshot} 🎉</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            asChild
            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <a
              href={BUY_JOBS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              Buy $JOBS
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Link href="/rewards" className="inline-flex items-center gap-1.5">
              Check Rewards
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
