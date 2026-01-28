"use client";

import Link from "next/link";
import useSWR from "swr";
import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { authenticatedFetcher } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import {
  LayoutDashboard,
  DollarSign,
  Briefcase,
  Server,
  ChevronRight,
} from "lucide-react";
import type { DashboardStats, ActionContext } from "@/types/dashboard";

export function CreatorDashboardSection() {
  const { data: stats } = useSWR<DashboardStats>(
    "/user/dashboard/stats",
    authenticatedFetcher,
  );

  const { data: context } = useSWR<ActionContext>(
    "/user/dashboard/action-context",
    authenticatedFetcher,
  );

  const miniStats = [
    {
      label: "Total Earned",
      value: formatUsd(stats?.totalEarnings ?? 0),
      icon: DollarSign,
    },
    {
      label: "Jobs",
      value: (context?.jobCount ?? 0).toString(),
      icon: Briefcase,
    },
    {
      label: "Servers",
      value: (context?.serverCount ?? 0).toString(),
      icon: Server,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          Track Your Earnings in Real Time
        </h2>
        <p className="text-lg text-muted-foreground">
          See what's working, discover opportunities, and grow your income on
          x402.
        </p>
      </div>

      <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
          {/* Mini stats */}
          <div className="flex-1 w-full">
            <div className="grid grid-cols-3 gap-4">
              {miniStats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div className="text-xl md:text-2xl font-bold font-mono text-emerald-500">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-16 bg-border" />
          <div className="block md:hidden w-full h-px bg-border" />

          {/* CTA */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2 text-primary">
              <LayoutDashboard className="h-5 w-5" />
              <span className="font-semibold">Creator Dashboard</span>
            </div>
            <Button asChild>
              <Link href="/dashboard" className="flex items-center gap-1">
                View Dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
