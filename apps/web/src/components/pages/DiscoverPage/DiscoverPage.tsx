"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ArrowDown, Check } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { publicFetcher } from "@/lib/api";
import { getSuccessRate, getSuccessRateColor } from "@/lib/format";
import BaseLayout from "@/components/BaseLayout";
import { useModals } from "@/contexts/ModalContext";
import { cn } from "@x402jobs/ui/utils";

function formatCompactUsd(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(2)}`;
}

interface ResourceData {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  total_earned_usdc?: string;
  avatar_url?: string;
  server_slug?: string;
  call_count?: number;
  success_count_30d?: number;
  failure_count_30d?: number;
  last_called_at?: string;
}

interface JobData {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  network: string;
  total_earnings_usdc?: number;
  run_count?: number;
  success_count_30d?: number;
  failure_count_30d?: number;
  last_run_at?: string;
  owner_username?: string;
  avatar_url?: string;
}

interface ResourcesResponse {
  resources: ResourceData[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface JobsResponse {
  jobs: JobData[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Unified type for display
interface UnifiedItem {
  id: string;
  type: "resource" | "job";
  name: string;
  displayName: string;
  avatar_url?: string;
  href: string;
  callCount: number;
  successRate: number;
  earned: number;
  lastActivity: string | null;
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function DiscoverPage() {
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const { openRegisterResource } = useModals();
  const [showComingSoon, setShowComingSoon] = useState(false);

  const { data: resourcesData, isLoading: resourcesLoading } =
    useSWR<ResourcesResponse>(
      "/api/v1/resources?sort=popular&limit=10",
      publicFetcher,
      { keepPreviousData: true },
    );

  const { data: jobsData, isLoading: jobsLoading } = useSWR<JobsResponse>(
    "/jobs/public?sort=earnings&limit=10",
    publicFetcher,
    { keepPreviousData: true },
  );

  // Only show full loading state on initial load, not revalidation
  const isInitialLoading =
    (resourcesLoading && !resourcesData) || (jobsLoading && !jobsData);
  const isRevalidating = resourcesLoading || jobsLoading;

  // Merge and sort resources + jobs
  const unifiedItems: UnifiedItem[] = [
    // Map resources
    ...(resourcesData?.resources || []).map(
      (r): UnifiedItem => ({
        id: r.id,
        type: "resource",
        name: r.name,
        displayName:
          r.server_slug && r.slug ? `${r.server_slug}/${r.slug}` : r.name,
        avatar_url: r.avatar_url,
        href: `/resources/${r.server_slug}/${r.slug}`,
        callCount: r.call_count || 0,
        successRate: getSuccessRate(r.success_count_30d, r.failure_count_30d),
        earned: r.total_earned_usdc ? parseFloat(r.total_earned_usdc) : 0,
        lastActivity: r.last_called_at || null,
      }),
    ),
    // Map jobs
    ...(jobsData?.jobs || []).map(
      (j): UnifiedItem => ({
        id: j.id,
        type: "job",
        name: j.name,
        displayName:
          j.owner_username && j.slug
            ? `@${j.owner_username}/${j.slug}`
            : j.name,
        avatar_url: j.avatar_url,
        href: `/jobs/${j.id}`,
        callCount: j.run_count || 0,
        successRate: getSuccessRate(j.success_count_30d, j.failure_count_30d),
        earned: j.total_earnings_usdc || 0,
        lastActivity: j.last_run_at || null,
      }),
    ),
  ]
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10);

  const scrollToLeaderboard = () => {
    leaderboardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <BaseLayout maxWidth="max-w-screen-2xl">
      <main className="w-full py-16 md:py-24">
        {/* Hero Section */}
        <motion.section
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 md:mb-20"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-3xl mx-auto">
            Discover x402 resources you can trust.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Real reliability scores before your agent pays.
          </p>

          {/* Code Snippet */}
          <div className="max-w-2xl mx-auto mb-10 text-left">
            <div className="rounded-lg border border-border bg-muted/50 p-4 md:p-6 overflow-x-auto">
              <pre className="text-sm font-mono">
                <code>
                  <span className="text-blue-500 dark:text-blue-400">
                    import
                  </span>
                  {" { check } "}
                  <span className="text-blue-500 dark:text-blue-400">
                    from
                  </span>{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">{`'@x402jobs/sdk'`}</span>
                  {"\n\n"}
                  <span className="text-blue-500 dark:text-blue-400">
                    const
                  </span>
                  {" score = "}
                  <span className="text-blue-500 dark:text-blue-400">
                    await
                  </span>{" "}
                  <span className="text-yellow-600 dark:text-yellow-400">
                    check
                  </span>
                  {"("}
                  <span className="text-emerald-600 dark:text-emerald-400">{`'resource-url.com/api'`}</span>
                  {")"}
                  {"\n\n"}
                  <span className="text-muted-foreground">{`// {`}</span>
                  {"\n"}
                  <span className="text-muted-foreground">{`//   success_rate: 0.94,`}</span>
                  {"\n"}
                  <span className="text-muted-foreground">{`//   calls: 1240,`}</span>
                  {"\n"}
                  <span className="text-muted-foreground">{`//   value_processed: "$12.4k",`}</span>
                  {"\n"}
                  <span className="text-muted-foreground">{`//   last_called: "2m ago"`}</span>
                  {"\n"}
                  <span className="text-muted-foreground">{`// }`}</span>
                </code>
              </pre>
            </div>
            <p className="text-sm text-muted-foreground mt-3 text-center">
              <a
                href="https://github.com/rawgroundbeef/x402jobs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                View on GitHub →
              </a>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={scrollToPricing} className="px-8">
              Get API Access →
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToLeaderboard}
              className="px-8"
            >
              Browse Resources
              <ArrowDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.section>

        {/* Leaderboard Section */}
        <motion.section
          ref={leaderboardRef}
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="pt-16 md:pt-20 mb-24 md:mb-32"
        >
          {isInitialLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            </div>
          ) : unifiedItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No resources with usage data yet.
            </div>
          ) : (
            <div
              className={cn(
                "w-full transition-opacity duration-200",
                isRevalidating && "opacity-60",
              )}
            >
              {/* Desktop Table */}
              <div className="hidden md:block overflow-hidden rounded-lg border border-border">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-center text-sm font-medium text-muted-foreground px-3 py-3 w-12">
                        #
                      </th>
                      <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                        Resource
                      </th>
                      <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                        Success Rate
                      </th>
                      <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                        Calls
                      </th>
                      <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                        Value Processed
                      </th>
                      <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unifiedItems.map((item, index) => {
                      const lastActivity = item.lastActivity
                        ? formatDistanceToNow(new Date(item.lastActivity), {
                            addSuffix: true,
                          })
                        : null;

                      return (
                        <tr
                          key={`${item.type}-${item.id}`}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-3 text-sm text-muted-foreground text-center w-12">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={item.href}
                              className="flex items-center gap-3 hover:underline"
                            >
                              {item.avatar_url ? (
                                <img
                                  src={item.avatar_url}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs text-muted-foreground">
                                    {item.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="font-medium text-foreground">
                                {item.displayName}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                "font-medium",
                                getSuccessRateColor(item.successRate),
                              )}
                            >
                              {item.successRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {item.callCount > 0
                              ? item.callCount.toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {item.earned > 0
                              ? formatCompactUsd(item.earned)
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {lastActivity || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {unifiedItems.map((item, index) => {
                  const lastActivity = item.lastActivity
                    ? formatDistanceToNow(new Date(item.lastActivity), {
                        addSuffix: true,
                      })
                    : null;

                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            #{index + 1}
                          </span>
                          {item.avatar_url ? (
                            <img
                              src={item.avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">
                                {item.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="font-medium">
                            {item.displayName}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            getSuccessRateColor(item.successRate),
                          )}
                        >
                          {item.successRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground pl-14">
                        {item.callCount > 0 && (
                          <span>{item.callCount.toLocaleString()} calls</span>
                        )}
                        {item.earned > 0 && (
                          <span>{formatCompactUsd(item.earned)}</span>
                        )}
                        {lastActivity && <span>{lastActivity}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </motion.section>

        {/* Pricing Section */}
        <motion.section
          ref={pricingRef}
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-24 md:mb-32"
        >
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold mb-3">
              Get programmatic access.
            </h2>
            <p className="text-muted-foreground">
              Same data. Your infrastructure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* API Key Card */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <h3 className="text-lg font-semibold mb-1">API Key</h3>
              <div className="text-3xl font-bold mb-6">
                $50
                <span className="text-lg font-normal text-muted-foreground">
                  /month
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Unlimited calls
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Full resource index
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Real-time scores
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Priority support
                </li>
              </ul>
              <Button
                className="w-full text-white border-0"
                style={{
                  background:
                    "linear-gradient(135deg, #10b981, #14b8a6, #8b5cf6)",
                }}
                onClick={() => setShowComingSoon(true)}
              >
                Subscribe
              </Button>
            </div>

            {/* Pay-per-call Card */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <h3 className="text-lg font-semibold mb-1">Pay-per-call</h3>
              <div className="text-3xl font-bold mb-6">
                $0.01
                <span className="text-lg font-normal text-muted-foreground">
                  /request
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  No commitment
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  x402 native
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Pay via header
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Same full dataset
                </li>
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/docs">View Docs</Link>
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Want to add your resource to the index? That&apos;s free.{" "}
            <button
              onClick={() => openRegisterResource()}
              className="text-primary hover:underline"
            >
              Register a resource →
            </button>
          </p>
        </motion.section>
      </main>

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowComingSoon(false)}
          />
          <div className="relative bg-card border border-border rounded-xl p-8 max-w-sm mx-4 text-center">
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground mb-6">
              API subscriptions are launching soon. Check back tomorrow!
            </p>
            <Button onClick={() => setShowComingSoon(false)}>Got it</Button>
          </div>
        </div>
      )}
    </BaseLayout>
  );
}
