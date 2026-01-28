"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { publicFetcher } from "@/lib/api";
import {
  Layers,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import BaseLayout from "@/components/BaseLayout";
import { PageHeader } from "@/components/PageHeader";
import { ListCard } from "@/components/ListCard";
import { formatUsd, getSuccessRate, getSuccessRateColor } from "@/lib/format";
import { useModals } from "@/contexts/ModalContext";
import { BaseIcon, SolanaIcon } from "@/components/icons/ChainIcons";
import { cn } from "@x402jobs/ui/utils";

type SortOption =
  | "earnings"
  | "popular"
  | "latest"
  | "price_low"
  | "price_high";
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
  { value: "earnings", label: "Highest Earning" },
  { value: "popular", label: "Most Popular" },
  { value: "latest", label: "Latest" },
  { value: "price_low", label: "Price: Low → High" },
  { value: "price_high", label: "Price: High → Low" },
];

const ITEMS_PER_PAGE = 25;

interface PublicJob {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  network: string;
  owner_username?: string;
  price?: number;
  run_count?: number;
  total_earnings_usdc?: number;
  webhook_url?: string;
  avatar_url?: string;
  success_count_30d?: number;
  failure_count_30d?: number;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface JobsResponse {
  jobs: PublicJob[];
  pagination: PaginationInfo;
}

export default function JobsListPage() {
  const { openCreateJob } = useModals();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL params
  const initialChain = (searchParams.get("chain") as ChainFilter) || "all";
  const initialSearch = searchParams.get("q") || "";

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortOption>("earnings");
  const [chain, setChain] = useState<ChainFilter>(initialChain);
  const [page, setPage] = useState(0);

  // Update URL when filters change
  const updateUrl = useCallback(
    (newChain: ChainFilter, newSearch: string) => {
      const params = new URLSearchParams();
      if (newChain !== "all") {
        params.set("chain", newChain);
      }
      if (newSearch) {
        params.set("q", newSearch);
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  // Debounce search input
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(0);
      const timeout = setTimeout(() => {
        setDebouncedSearch(value);
        updateUrl(chain, value);
      }, 300);
      return () => clearTimeout(timeout);
    },
    [chain, updateUrl],
  );

  // Handle chain filter change
  const handleChainChange = useCallback(
    (newChain: ChainFilter) => {
      setChain(newChain);
      setPage(0);
      updateUrl(newChain, debouncedSearch);
    },
    [debouncedSearch, updateUrl],
  );

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(page * ITEMS_PER_PAGE));
    params.set("sort", sort);
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    if (chain !== "all") {
      params.set("network", chain);
    }
    return params.toString();
  }, [debouncedSearch, sort, page, chain]);

  const { data, isLoading } = useSWR<JobsResponse>(
    `/jobs/public?${queryString}`,
    publicFetcher,
  );

  const jobs = data?.jobs || [];
  const pagination = data?.pagination;
  const totalPages = pagination
    ? Math.ceil(pagination.total / ITEMS_PER_PAGE)
    : 0;

  const handleSortChange = (newSort: string) => {
    setSort(newSort as SortOption);
    setPage(0);
  };

  const titleWithCount =
    pagination && !isLoading
      ? `Jobs (${pagination.total.toLocaleString()})`
      : "Jobs";

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title={titleWithCount}
        description="Automated workflows that call resources on a schedule or via webhook"
        stackOnMobile
        rightSlot={
          <div className="flex flex-col w-full gap-2 sm:flex-row sm:w-auto">
            <Button
              variant="outline"
              as={Link}
              href="/dashboard/jobs"
              className="w-full sm:w-auto"
            >
              <FolderOpen className="w-4 h-4" />
              My Jobs
            </Button>
            <Button
              variant="primary"
              onClick={() => openCreateJob()}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Create Job
            </Button>
          </div>
        }
      />

      <main className="w-full pb-8">
        {/* Search, Chain Filter, and Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 py-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Chain Filter Toggle Pills */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
            {CHAIN_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => handleChainChange(filter.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  chain === filter.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.icon}
                {filter.label}
              </button>
            ))}
          </div>

          <Select
            value={sort}
            onChange={handleSortChange}
            options={SORT_OPTIONS}
            className="w-full sm:w-[180px]"
          />
        </div>

        {/* Filter results info */}
        {(debouncedSearch || chain !== "all") && pagination && !isLoading && (
          <p className="text-sm text-muted-foreground mb-4">
            {pagination.total === 0
              ? "No jobs found"
              : pagination.total === 1
                ? "1 job"
                : `${pagination.total} jobs`}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
            {chain !== "all" &&
              ` on ${chain.charAt(0).toUpperCase() + chain.slice(1)}`}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch || chain !== "all"
                ? "No jobs match your filters"
                : "No public jobs yet"}
            </p>
            {!debouncedSearch && chain === "all" && (
              <p className="text-sm text-muted-foreground mt-2">
                Jobs with webhook triggers will appear here
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {jobs.map((job) => {
                const jobSlug =
                  job.slug || job.name.toLowerCase().replace(/\s+/g, "-");
                const displayPath = job.owner_username
                  ? `@${job.owner_username}/${jobSlug}`
                  : jobSlug;
                const jobHref =
                  job.owner_username && job.slug
                    ? `/@${job.owner_username}/${job.slug}`
                    : `/jobs/${job.id}`;
                const successRate = getSuccessRate(
                  job.success_count_30d,
                  job.failure_count_30d,
                );
                const totalRuns =
                  (job.success_count_30d ?? 0) + (job.failure_count_30d ?? 0);

                return (
                  <ListCard
                    key={job.id}
                    href={jobHref}
                    avatarUrl={job.avatar_url}
                    name={displayPath}
                    description={job.description}
                    price={
                      job.total_earnings_usdc && job.total_earnings_usdc > 0
                        ? formatUsd(job.total_earnings_usdc)
                        : undefined
                    }
                    priceSuffix="earned"
                    successRate={
                      successRate !== null
                        ? {
                            text: `${successRate}%`,
                            colorClass: getSuccessRateColor(successRate),
                          }
                        : totalRuns > 0
                          ? { text: "New", isNew: true }
                          : undefined
                    }
                    countLabel={
                      job.run_count !== undefined && job.run_count > 0
                        ? `${job.run_count.toLocaleString()} runs`
                        : undefined
                    }
                    type="job"
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>

                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i;
                    } else if (page < 3) {
                      pageNum = i;
                    } else if (page > totalPages - 4) {
                      pageNum = totalPages - 5 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum + 1}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={!pagination?.hasMore}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </BaseLayout>
  );
}
