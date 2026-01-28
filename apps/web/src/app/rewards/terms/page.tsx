"use client";

import Link from "next/link";
import BaseLayout from "@/components/BaseLayout";
import { ArrowLeft } from "lucide-react";

export default function RewardsTermsPage() {
  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="py-8 px-4 space-y-8">
        {/* Back link */}
        <Link
          href="/rewards"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Rewards
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-display">
            $JOBS Revenue Sharing Terms
          </h1>
          <p className="text-muted-foreground">
            Last updated: December 31, 2024
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Overview</h2>
            <p className="text-muted-foreground">
              The $JOBS Revenue Sharing Program distributes 50% of x402.jobs
              platform fees to eligible $JOBS token holders on a monthly basis.
              This document outlines the terms and conditions of participation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Eligibility</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Minimum holding: 1,000,000 $JOBS</strong> (1 million
                tokens)
              </li>
              <li>
                You must hold $JOBS tokens in a Solana wallet at the time of the
                monthly snapshot
              </li>
              <li>
                Snapshots are taken on the last day of each month at 23:59:59
                UTC
              </li>
              <li>
                Your wallet must not be on the exclusion list (e.g., liquidity
                pools, team wallets)
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Reward Calculation</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                50% of platform fees collected during the month are allocated to
                the reward pool
              </li>
              <li>
                Rewards are distributed proportionally based on your $JOBS
                holdings relative to the total eligible supply
              </li>
              <li>
                Formula:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">
                  Your Reward = (Your $JOBS / Total Eligible $JOBS) × Reward
                  Pool
                </code>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Claiming Rewards</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You must have an x402.jobs account to claim rewards</li>
              <li>
                Connect the wallet that held $JOBS at the snapshot time and sign
                a message to verify ownership
              </li>
              <li>
                Claimed rewards are credited to your x402.jobs platform wallet
                in USDC
              </li>
              <li>
                You can withdraw USDC from your platform wallet at any time
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-amber-600 dark:text-amber-500">
              ⚠️ Reward Expiration
            </h2>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-amber-800 dark:text-amber-200 font-medium">
                Unclaimed rewards expire approximately 30 days after the
                snapshot date.
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-sm mt-2">
                When a new monthly snapshot is taken, any unclaimed rewards from
                the previous period are returned to the treasury. This ensures
                the program remains sustainable and active participants are not
                diluted by dormant allocations.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Treasury Allocation</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                50% of platform fees go to the reward pool (distributed to
                holders)
              </li>
              <li>
                50% of platform fees go to the x402.jobs treasury (for
                development, operations, marketing)
              </li>
              <li>Expired unclaimed rewards are returned to the treasury</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Excluded Wallets</h2>
            <p className="text-muted-foreground">
              The following wallet types are excluded from reward distribution:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Liquidity pool wallets (Raydium, Orca, etc.)</li>
              <li>Exchange hot/cold wallets</li>
              <li>Team and treasury wallets</li>
              <li>Wallets flagged for suspicious activity</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Program Changes</h2>
            <p className="text-muted-foreground">
              x402.jobs reserves the right to modify, suspend, or terminate the
              revenue sharing program at any time. Changes will be communicated
              via our official channels. Continued participation after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">No Guarantees</h2>
            <p className="text-muted-foreground">
              Reward amounts depend on platform fee revenue and are not
              guaranteed. Past distributions do not guarantee future
              distributions. The value of $JOBS tokens can fluctuate and holding
              tokens carries inherent risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              Questions about the revenue sharing program? Reach out on{" "}
              <a
                href="https://twitter.com/x402jobs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Twitter/X
              </a>
              ,{" "}
              <a
                href="https://discord.gg/BUcC28x6BX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Discord
              </a>
              , or{" "}
              <a
                href="https://t.me/x402jobs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Telegram
              </a>
              .
            </p>
          </section>
        </div>

        {/* Back link */}
        <div className="pt-4">
          <Link
            href="/rewards"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Rewards
          </Link>
        </div>
      </div>
    </BaseLayout>
  );
}
