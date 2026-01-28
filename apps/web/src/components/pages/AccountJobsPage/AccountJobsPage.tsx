"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Spinner } from "@x402jobs/ui/spinner";
import { Select } from "@x402jobs/ui/select";
import { Input } from "@x402jobs/ui/input";
import { authenticatedFetcher } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { useModals } from "@/contexts/ModalContext";
import { Zap, Search, Plus } from "lucide-react";
import { BaseIcon, SolanaIcon } from "@/components/icons/ChainIcons";
import { cn } from "@x402jobs/ui/utils";
import JobCard from "./components/JobCard";

interface Job {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  avatar_url?: string;
  network?: string;
  trigger_methods?: {
    webhook?: boolean;
    manual?: boolean;
    schedule?: boolean;
  };
  trigger_type?: string;
  schedule_cron?: string;
  schedule_enabled?: boolean;
  run_count?: number;
  total_earnings_usdc?: number;
  published?: boolean;
  created_at: string;
  updated_at: string;
}

interface JobsResponse {
  jobs: Job[];
  stats: {
    totalEarnings: number;
    totalRuns: number;
    publicJobsCount: number;
    totalJobs: number;
  };
}

type FilterOption = "all" | "public" | "private";
type SortOption = "runs" | "earnings" | "recent" | "alphabetical";
type ChainFilter = "all" | "base" | "solana";

const CHAIN_FILTERS: {
  value: ChainFilter;
  label: string;
  icon?: React.ReactNode;
}[] = [
  { value: "all", label: "All" },
  { value: "base", label: "Base", icon: <BaseIcon className="w-3.5 h-3.5" /> },
  {
    value: "solana",
    label: "Solana",
    icon: <SolanaIcon className="w-3.5 h-3.5" />,
  },
];

const SORT_OPTIONS = [
  { value: "runs", label: "Most Runs" },
  { value: "earnings", label: "Most Earned" },
  { value: "recent", label: "Recently Updated" },
  { value: "alphabetical", label: "Alphabetical" },
];

export default function AccountJobsPage() {
  const { openCreateJob } = useModals();
  const { data, isLoading, mutate } = useSWR<JobsResponse>(
    "/jobs",
    authenticatedFetcher,
  );
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("runs");
  const [chain, setChain] = useState<ChainFilter>("all");
  const [search, setSearch] = useState("");

  const jobs = data?.jobs || [];
  const stats = data?.stats || {
    totalEarnings: 0,
    totalRuns: 0,
    publicJobsCount: 0,
    totalJobs: 0,
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (job) =>
          job.name.toLowerCase().includes(searchLower) ||
          job.description?.toLowerCase().includes(searchLower),
      );
    }

    // Apply chain filter
    if (chain !== "all") {
      result = result.filter((job) => job.network === chain);
    }

    // Apply visibility filter
    if (filter === "public") {
      result = result.filter(
        (job) => job.published && job.trigger_methods?.webhook,
      );
    } else if (filter === "private") {
      result = result.filter(
        (job) => !job.published || !job.trigger_methods?.webhook,
      );
    }

    // Apply sort
    switch (sort) {
      case "runs":
        result.sort((a, b) => (b.run_count || 0) - (a.run_count || 0));
        break;
      case "earnings":
        result.sort(
          (a, b) => (b.total_earnings_usdc || 0) - (a.total_earnings_usdc || 0),
        );
        break;
      case "recent":
        result.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        break;
      case "alphabetical":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [jobs, filter, sort, chain, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create and manage your jobs
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-sm text-muted-foreground">Total Jobs</p>
          <p className="text-2xl font-bold">{stats.totalJobs}</p>
          <span className="text-xs text-muted-foreground">
            {stats.publicJobsCount} public
          </span>
        </Card>
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <p className="text-sm text-muted-foreground">Total Runs</p>
          <p className="text-2xl font-bold">
            {stats.totalRuns.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <p className="text-sm text-muted-foreground">Total Earnings</p>
          <p className="text-2xl font-bold text-green-500">
            {formatUsd(stats.totalEarnings)}
          </p>
        </Card>
      </div>

      {/* Search Row */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 w-full"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Visibility Filter */}
          <div className="flex items-center gap-0.5 p-1 bg-muted/50 rounded-lg">
            {(["all", "public", "private"] as FilterOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                  filter === option
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "all"
                  ? "All"
                  : option === "public"
                    ? "Public"
                    : "Private"}
              </button>
            ))}
          </div>

          {/* Chain Filter */}
          <div className="flex items-center gap-0.5 p-1 bg-muted/50 rounded-lg">
            {CHAIN_FILTERS.map((option) => (
              <button
                key={option.value}
                onClick={() => setChain(option.value)}
                className={cn(
                  "px-2.5 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                  chain === option.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <Select
            value={sort}
            onChange={(value) => setSort(value as SortOption)}
            options={SORT_OPTIONS}
            className="w-[160px]"
          />
        </div>

        {/* Create Job Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={openCreateJob}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Create Job
        </Button>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          {jobs.length === 0 ? (
            <>
              <p className="text-muted-foreground mb-4">
                You don&apos;t have any jobs yet.
              </p>
              <Button
                variant="primary"
                onClick={openCreateJob}
                className="transition-transform duration-200 ease-out hover:scale-[1.02]"
              >
                Create your first job
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              No jobs match the current filter.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} onUpdate={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  );
}
