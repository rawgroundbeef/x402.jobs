"use client";

import { useState } from "react";
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";
import { DashboardHeroStats } from "./components/DashboardHeroStats";
import { EarningsChart } from "./components/EarningsChart";
import { TopPerformers } from "./components/TopPerformers";
import { ActionCards } from "./components/ActionCards";
import { RecentActivity } from "./components/RecentActivity";
import type {
  DashboardStats,
  EarningsResponse,
  TopPerformersResponse,
  ActivityResponse,
  ActionContext,
} from "@/types/dashboard";

export default function CreatorDashboardPage() {
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "all">("30d");

  const { data: stats, isLoading: statsLoading } = useSWR<DashboardStats>(
    "/user/dashboard/stats",
    authenticatedFetcher,
    { refreshInterval: 60000 },
  );

  const { data: earnings, isLoading: earningsLoading } =
    useSWR<EarningsResponse>(
      `/user/dashboard/earnings?period=${chartPeriod}`,
      authenticatedFetcher,
      { refreshInterval: 60000 },
    );

  const { data: topPerformers } = useSWR<TopPerformersResponse>(
    "/user/dashboard/top-performers",
    authenticatedFetcher,
    { refreshInterval: 60000 },
  );

  const { data: activity } = useSWR<ActivityResponse>(
    "/user/dashboard/activity?limit=10",
    authenticatedFetcher,
    { refreshInterval: 60000 },
  );

  const { data: actionContext } = useSWR<ActionContext>(
    "/user/dashboard/action-context",
    authenticatedFetcher,
    { refreshInterval: 60000 },
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Track your earnings and performance
        </p>
      </header>

      <DashboardHeroStats stats={stats} loading={statsLoading} />

      <EarningsChart
        data={earnings?.data}
        period={chartPeriod}
        onPeriodChange={setChartPeriod}
        loading={earningsLoading}
        totalForPeriod={earnings?.totalForPeriod}
      />

      <TopPerformers items={topPerformers?.items} />

      <ActionCards context={actionContext} />

      <RecentActivity events={activity?.events} />
    </div>
  );
}
