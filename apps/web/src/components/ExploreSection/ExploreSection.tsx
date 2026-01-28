"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Box,
  Server,
  TrendingUp,
  DollarSign,
  Activity,
  Globe,
} from "lucide-react";
import { cn } from "@x402jobs/ui/utils";
import { formatUsd } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

// Types
interface PublicJob {
  id: string;
  name: string;
  slug: string;
  owner_username: string;
  run_count: number;
  total_earnings_usdc: number;
  avatar_url: string | null;
}

interface PublicResource {
  id: string;
  slug: string;
  name: string;
  server_slug: string;
  total_earned_usdc: string | null;
  call_count: number;
  avatar_url: string | null;
  success_count_30d?: number;
  failure_count_30d?: number;
}

interface PublicServer {
  id: string;
  slug: string;
  name: string;
  origin_url: string;
  favicon_url: string | null;
  resource_count: number;
  total_earned_usdc: string | null;
}

type TabType = "jobs" | "resources" | "servers";

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "jobs", label: "Jobs", icon: <Play className="w-4 h-4" /> },
  { id: "resources", label: "Resources", icon: <Box className="w-4 h-4" /> },
  { id: "servers", label: "Servers", icon: <Server className="w-4 h-4" /> },
];

// Avatar component with fallback
function ItemAvatar({
  src,
  name,
  size = "sm",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size === "sm" ? 24 : 32}
        height={size === "sm" ? 24 : 32}
        className={cn(sizeClasses, "rounded-md object-cover")}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses,
        "rounded-md bg-muted flex items-center justify-center",
      )}
    >
      <Box className={cn(iconSize, "text-muted-foreground")} />
    </div>
  );
}

// Success rate color helper
function getSuccessRateColor(rate: number): string {
  if (rate >= 90) return "text-emerald-500";
  if (rate >= 70) return "text-yellow-500";
  return "text-red-500";
}

// Calculate success rate
function getSuccessRate(success?: number, failure?: number): number {
  const total = (success || 0) + (failure || 0);
  if (total === 0) return 100;
  return Math.round(((success || 0) / total) * 100);
}

// Format numbers compactly
function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

// Loading skeleton
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-muted/30 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

// Jobs Table
function JobsTable({ jobs, loading }: { jobs: PublicJob[]; loading: boolean }) {
  if (loading) return <TableSkeleton />;
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No jobs found
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-center text-sm font-medium text-muted-foreground px-3 py-3 w-12">
                #
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                Job
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Runs
                </span>
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Earned
                </span>
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                Creator
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job, index) => (
              <tr
                key={job.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() =>
                  (window.location.href = `/@${job.owner_username}/${job.slug}`)
                }
              >
                <td className="text-center text-sm text-muted-foreground px-3 py-3">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ItemAvatar src={job.avatar_url} name={job.name} />
                    <span className="font-medium truncate max-w-[200px]">
                      {job.name}
                    </span>
                  </div>
                </td>
                <td className="text-right text-sm px-4 py-3">
                  {formatCompact(job.run_count)}
                </td>
                <td className="text-right text-sm font-medium text-emerald-500 px-4 py-3">
                  {formatUsd(job.total_earnings_usdc)}
                </td>
                <td className="text-right text-sm text-muted-foreground px-4 py-3 hidden lg:table-cell">
                  @{job.owner_username}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {jobs.map((job, index) => (
          <Link
            key={job.id}
            href={`/@${job.owner_username}/${job.slug}`}
            className="block p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-5">
                  {index + 1}
                </span>
                <ItemAvatar src={job.avatar_url} name={job.name} />
                <span className="font-medium truncate max-w-[160px]">
                  {job.name}
                </span>
              </div>
              <span className="text-sm font-medium text-emerald-500">
                {formatUsd(job.total_earnings_usdc)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// Resources Table
function ResourcesTable({
  resources,
  loading,
}: {
  resources: PublicResource[];
  loading: boolean;
}) {
  if (loading) return <TableSkeleton />;
  if (resources.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No resources found
      </div>
    );
  }

  return (
    <>
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
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Calls
                </span>
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Earned
                </span>
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Success
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resources.map((resource, index) => {
              const successRate = getSuccessRate(
                resource.success_count_30d,
                resource.failure_count_30d,
              );
              return (
                <tr
                  key={resource.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() =>
                    (window.location.href = `/resources/${resource.server_slug}/${resource.slug}`)
                  }
                >
                  <td className="text-center text-sm text-muted-foreground px-3 py-3">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ItemAvatar
                        src={resource.avatar_url}
                        name={resource.name}
                      />
                      <span className="font-medium truncate max-w-[200px]">
                        {resource.server_slug}/{resource.slug}
                      </span>
                    </div>
                  </td>
                  <td className="text-right text-sm px-4 py-3">
                    {formatCompact(resource.call_count)}
                  </td>
                  <td className="text-right text-sm font-medium text-emerald-500 px-4 py-3">
                    {formatUsd(parseFloat(resource.total_earned_usdc || "0"))}
                  </td>
                  <td
                    className={cn(
                      "text-right text-sm font-medium px-4 py-3 hidden lg:table-cell",
                      getSuccessRateColor(successRate),
                    )}
                  >
                    {successRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {resources.map((resource, index) => (
          <Link
            key={resource.id}
            href={`/resources/${resource.server_slug}/${resource.slug}`}
            className="block p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-5">
                  {index + 1}
                </span>
                <ItemAvatar src={resource.avatar_url} name={resource.name} />
                <span className="font-medium truncate max-w-[140px]">
                  {resource.server_slug}/{resource.slug}
                </span>
              </div>
              <span className="text-sm font-medium text-emerald-500">
                {formatUsd(parseFloat(resource.total_earned_usdc || "0"))}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// Servers Table
function ServersTable({
  servers,
  loading,
}: {
  servers: PublicServer[];
  loading: boolean;
}) {
  if (loading) return <TableSkeleton />;
  if (servers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No servers found
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-center text-sm font-medium text-muted-foreground px-3 py-3 w-12">
                #
              </th>
              <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                Server
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  Resources
                </span>
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Earned
                </span>
              </th>
              <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  Domain
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {servers.map((server, index) => {
              let hostname = "";
              try {
                hostname = new URL(server.origin_url).hostname;
              } catch {
                hostname = server.origin_url;
              }

              return (
                <tr
                  key={server.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() =>
                    (window.location.href = `/servers/${server.slug}`)
                  }
                >
                  <td className="text-center text-sm text-muted-foreground px-3 py-3">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ItemAvatar src={server.favicon_url} name={server.slug} />
                      <span className="font-medium truncate max-w-[200px]">
                        {server.slug}
                      </span>
                    </div>
                  </td>
                  <td className="text-right text-sm px-4 py-3">
                    {server.resource_count}
                  </td>
                  <td className="text-right text-sm font-medium text-emerald-500 px-4 py-3">
                    {formatUsd(parseFloat(server.total_earned_usdc || "0"))}
                  </td>
                  <td className="text-right text-sm text-muted-foreground px-4 py-3 hidden lg:table-cell truncate max-w-[180px]">
                    {hostname}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {servers.map((server, index) => (
          <Link
            key={server.id}
            href={`/servers/${server.slug}`}
            className="block p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-5">
                  {index + 1}
                </span>
                <ItemAvatar src={server.favicon_url} name={server.slug} />
                <span className="font-medium truncate max-w-[160px]">
                  {server.slug}
                </span>
              </div>
              <span className="text-sm font-medium text-emerald-500">
                {formatUsd(parseFloat(server.total_earned_usdc || "0"))}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function ExploreSection() {
  const [activeTab, setActiveTab] = useState<TabType>("jobs");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [resources, setResources] = useState<PublicResource[]>([]);
  const [servers, setServers] = useState<PublicServer[]>([]);
  const [loading, setLoading] = useState({
    jobs: true,
    resources: true,
    servers: true,
  });

  // Fetch all data on mount
  useEffect(() => {
    // Fetch jobs
    async function fetchJobs() {
      try {
        const res = await fetch(
          `${API_BASE}/jobs/public?sort=earnings&limit=8`,
        );
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (e) {
        console.error("Failed to fetch jobs:", e);
      } finally {
        setLoading((prev) => ({ ...prev, jobs: false }));
      }
    }

    // Fetch resources
    async function fetchResources() {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/resources?sort=popular&limit=8`,
        );
        if (res.ok) {
          const data = await res.json();
          setResources(data.resources || []);
        }
      } catch (e) {
        console.error("Failed to fetch resources:", e);
      } finally {
        setLoading((prev) => ({ ...prev, resources: false }));
      }
    }

    // Fetch servers
    async function fetchServers() {
      try {
        const res = await fetch(`${API_BASE}/servers?sort=popular&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setServers(data.servers || []);
        }
      } catch (e) {
        console.error("Failed to fetch servers:", e);
      } finally {
        setLoading((prev) => ({ ...prev, servers: false }));
      }
    }

    fetchJobs();
    fetchResources();
    fetchServers();
  }, []);

  const browseLinks: Record<TabType, { href: string; label: string }> = {
    jobs: { href: "/jobs", label: "Browse all jobs" },
    resources: { href: "/resources", label: "Browse all resources" },
    servers: { href: "/servers", label: "Browse all servers" },
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Explore
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Discover What&apos;s Working
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Browse top-performing jobs, resources, and servers on the network.
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex justify-center gap-1 mb-6"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Table Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-6"
      >
        {activeTab === "jobs" && (
          <JobsTable jobs={jobs} loading={loading.jobs} />
        )}
        {activeTab === "resources" && (
          <ResourcesTable resources={resources} loading={loading.resources} />
        )}
        {activeTab === "servers" && (
          <ServersTable servers={servers} loading={loading.servers} />
        )}
      </motion.div>

      {/* Browse All Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center"
      >
        <Link
          href={browseLinks[activeTab].href}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {browseLinks[activeTab].label}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}
