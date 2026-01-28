"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Box, Globe } from "lucide-react";
import { Card } from "@x402jobs/ui/card";
import { formatUsd } from "@/lib/format";

interface Stats {
  platform: {
    totalVolumeUsdc: number;
    totalJobsRun: number;
    totalResources: number;
    activeJobs: number;
    publicJobs: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

export function PlatformStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE}/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to fetch stats:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const formatNumber = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  return (
    <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Volume"
        value={formatUsd(stats.platform.totalVolumeUsdc)}
        color="text-emerald-500"
      />
      <StatCard
        icon={<Layers className="h-4 w-4" />}
        label="Jobs Run"
        value={formatNumber(stats.platform.totalJobsRun)}
        color="text-teal-500"
        href="/jobs"
      />
      <StatCard
        icon={<Box className="h-4 w-4" />}
        label="Resources"
        value={formatNumber(stats.platform.totalResources)}
        color="text-blue-500"
        href="/resources"
      />
      <StatCard
        icon={<Globe className="h-4 w-4" />}
        label="Public Jobs"
        value={formatNumber(stats.platform.publicJobs || 0)}
        color="text-violet-500"
        href="/jobs"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  href,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  color: string;
  href?: string;
}) {
  const content = (
    <Card
      className={`p-4 text-center transition-all duration-200 ease-out ${
        href
          ? "cursor-pointer hover:bg-accent/50 hover:scale-[1.02] hover:shadow-lg"
          : ""
      }`}
    >
      <div
        className={`flex items-center justify-center gap-1.5 mb-1.5 ${color}`}
      >
        {icon}
        <span className="text-xl md:text-2xl font-bold font-mono">{value}</span>
      </div>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
