"use client";

import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import {
  Check,
  ArrowRight,
  DollarSign,
  Calendar,
  Zap,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

// Mock earnings data for the chart preview
const mockEarningsData = [
  { date: "Jan 1", earnings: 120 },
  { date: "Jan 5", earnings: 280 },
  { date: "Jan 9", earnings: 450 },
  { date: "Jan 13", earnings: 890 },
  { date: "Jan 17", earnings: 1240 },
  { date: "Jan 21", earnings: 980 },
  { date: "Jan 25", earnings: 1520 },
];

// Simple SVG area chart for the preview
function MiniEarningsChart() {
  const data = mockEarningsData;
  const maxEarnings = Math.max(...data.map((d) => d.earnings));
  const width = 100;
  const height = 100;
  const padding = 5;

  // Calculate points for the area path
  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * (width - 2 * padding),
    y: height - padding - (d.earnings / maxEarnings) * (height - 2 * padding),
  }));

  // Create the area path
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill="url(#chartGradient)" />
      {/* Line stroke */}
      <path
        d={linePath}
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Mini stat card for the preview
function MiniStatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: string; positive: boolean };
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-3"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          <span className="text-xs text-emerald-500 font-medium">
            {trend.value}
          </span>
          <span className="text-[10px] text-muted-foreground">
            vs last period
          </span>
        </div>
      )}
    </motion.div>
  );
}

export function DashboardPreviewSection() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
      {/* Left Side - Copy */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center lg:text-left"
      >
        <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Dashboard
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
          Track Your Earnings{" "}
          <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent whitespace-nowrap">
            in Real-Time
          </span>
        </h2>

        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto lg:mx-0">
          See how your resources and jobs perform. Monitor trends, identify top
          earners, and optimize your x402 strategy.
        </p>

        <ul className="space-y-3 mb-8 inline-block text-left">
          {[
            "View earnings trends over time",
            "Track calls and runs per resource",
            "See your top performing assets",
            "Monitor period-over-period growth",
          ].map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3 text-foreground"
            >
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              {item}
            </motion.li>
          ))}
        </ul>

        <div>
          <Button
            size="lg"
            asChild
            className="w-full sm:w-auto text-white border-0 transition-transform duration-200 ease-out hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4, #3b82f6)",
            }}
          >
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              View Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Right Side - Dashboard Mockup */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative"
      >
        <div className="rounded-2xl p-5 md:p-6 shadow-2xl border border-black/10 dark:border-white/10 relative overflow-hidden bg-neutral-50 dark:bg-neutral-900/90">
          {/* Subtle glow effect */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 blur-3xl rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-violet-500/10 blur-3xl rounded-full" />

          <div className="relative">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
              <MiniStatCard
                label="Total Earned"
                value="$12.4k"
                icon={DollarSign}
                color="text-emerald-500"
                delay={0.3}
              />
              <MiniStatCard
                label="This Month"
                value="$1,832"
                icon={Calendar}
                color="text-blue-500"
                trend={{ value: "+142%", positive: true }}
                delay={0.4}
              />
              <MiniStatCard
                label="Calls This Week"
                value="2,451"
                icon={Zap}
                color="text-violet-500"
                trend={{ value: "+38%", positive: true }}
                delay={0.5}
              />
            </div>

            {/* Earnings Chart Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4"
            >
              {/* Chart Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Earnings</h3>
                  <p className="text-xs text-muted-foreground">
                    $4.1k this period
                  </p>
                </div>
                <div className="flex gap-1 bg-muted/50 p-0.5 rounded-md">
                  <span className="px-2 py-0.5 text-[10px] text-muted-foreground rounded">
                    7 days
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-background shadow-sm rounded font-medium">
                    30 days
                  </span>
                  <span className="px-2 py-0.5 text-[10px] text-muted-foreground rounded">
                    All time
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-28 md:h-32">
                <MiniEarningsChart />
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between mt-1 px-1">
                <span className="text-[10px] text-muted-foreground">Jan 1</span>
                <span className="text-[10px] text-muted-foreground">
                  Jan 13
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Jan 25
                </span>
              </div>
            </motion.div>
          </div>

          {/* Subtle edge fade for preview effect */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-neutral-50 dark:from-neutral-900/90 to-transparent pointer-events-none rounded-b-2xl" />
        </div>
      </motion.div>
    </div>
  );
}
