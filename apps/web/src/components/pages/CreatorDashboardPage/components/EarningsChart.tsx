"use client";

import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { formatUsd } from "@/lib/format";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { EarningsDataPoint } from "@/types/dashboard";

interface Props {
  data: EarningsDataPoint[] | undefined;
  period: "7d" | "30d" | "all";
  onPeriodChange: (period: "7d" | "30d" | "all") => void;
  loading: boolean;
  totalForPeriod: number | undefined;
}

export function EarningsChart({
  data,
  period,
  onPeriodChange,
  loading,
  totalForPeriod,
}: Props) {
  const periods = [
    { value: "7d" as const, label: "7 days" },
    { value: "30d" as const, label: "30 days" },
    { value: "all" as const, label: "All time" },
  ];

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-1">
            {formatDate(label)}
          </p>
          <p className="text-lg font-bold text-emerald-500">
            {formatUsd(payload[0].value)}
          </p>
          <p className="text-xs text-muted-foreground">
            {payload[0].payload.runCount} runs
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        </div>
        <div className="h-64 bg-muted rounded animate-pulse" />
      </Card>
    );
  }

  const hasData = data && data.length > 0 && data.some((d) => d.earnings > 0);

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Earnings</h2>
          {totalForPeriod !== undefined && (
            <p className="text-sm text-muted-foreground">
              {formatUsd(totalForPeriod)} this period
            </p>
          )}
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onPeriodChange(p.value)}
              className={period === p.value ? "bg-background shadow-sm" : ""}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(value) => `$${value}`}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEarnings)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No earnings data yet</p>
            <p className="text-sm text-muted-foreground">
              Start earning by publishing jobs or registering resources
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
