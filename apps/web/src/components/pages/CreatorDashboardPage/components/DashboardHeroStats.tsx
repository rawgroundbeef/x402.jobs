"use client";

import { Card } from "@x402jobs/ui/card";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Zap,
} from "lucide-react";
import { formatUsd } from "@/lib/format";
import type { DashboardStats } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | undefined;
  loading: boolean;
}

export function DashboardHeroStats({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-3" />
            <div className="h-8 bg-muted rounded w-32 mb-2" />
            <div className="h-4 bg-muted rounded w-20" />
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Earned",
      value: formatUsd(stats?.totalEarnings ?? 0),
      icon: DollarSign,
      trend: null, // No trend for all-time total
      color: "text-emerald-500",
    },
    {
      label: "This Month",
      value: formatUsd(stats?.thisMonth ?? 0),
      icon: Calendar,
      trend: stats?.trends.earningsPercent ?? 0,
      color: "text-blue-500",
    },
    {
      label: "Calls This Week",
      value: (stats?.callsThisWeek ?? 0).toString(),
      icon: Zap,
      trend: stats?.trends.callsPercent ?? 0,
      color: "text-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statCards.map((stat) => (
        <Card
          key={stat.label}
          className="p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-sm font-medium">{stat.label}</span>
          </div>
          <div className={`text-3xl font-bold font-mono ${stat.color}`}>
            {stat.value}
          </div>
          {stat.trend !== null && (
            <div className="flex items-center gap-1 mt-2">
              {stat.trend > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-emerald-500 font-medium">
                    +{stat.trend}%
                  </span>
                </>
              ) : stat.trend < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500 font-medium">
                    {stat.trend}%
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No change</span>
              )}
              <span className="text-xs text-muted-foreground ml-1">
                vs last period
              </span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
