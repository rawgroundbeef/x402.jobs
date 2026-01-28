"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { publicFetcher } from "@/lib/api";
import {
  Box,
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
import { AddResourceModalButton } from "@/components/AddResourceModalButton";
import { BaseIcon, SolanaIcon } from "@/components/icons/ChainIcons";
import { cn } from "@x402jobs/ui/utils";

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
  is_a2a?: boolean;
  supports_refunds?: boolean;
}

type SortOption =
  | "latest"
  | "popular"
  | "top_earning"
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
  { value: "popular", label: "Most Used" },
  { value: "top_earning", label: "Top Earning" },
  { value: "latest", label: "Latest" },
  { value: "price_low", label: "Price: Low → High" },
  { value: "price_high", label: "Price: High → Low" },
];

const ITEMS_PER_PAGE = 25;

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ResourcesResponse {
  resources: ResourceData[];
  pagination: PaginationInfo;
}

export default function ResourcesListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL params
  const initialChain = (searchParams.get("chain") as ChainFilter) || "all";
  const initialSearch = searchParams.get("q") || "";
  const initialA2A = searchParams.get("a2a") === "true";

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortOption>("popular");
  const [chain, setChain] = useState<ChainFilter>(initialChain);
  const [a2aOnly, setA2aOnly] = useState(initialA2A);
  const [page, setPage] = useState(0);

  // Update URL when filters change
  const updateUrl = useCallback(
    (newChain: ChainFilter, newSearch: string, newA2A: boolean) => {
      const params = new URLSearchParams();
      if (newChain !== "all") {
        params.set("chain", newChain);
      }
      if (newSearch) {
        params.set("q", newSearch);
      }
      if (newA2A) {
        params.set("a2a", "true");
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
      setPage(0); // Reset to first page on search
      // Simple debounce
      const timeout = setTimeout(() => {
        setDebouncedSearch(value);
        updateUrl(chain, value, a2aOnly);
      }, 300);
      return () => clearTimeout(timeout);
    },
    [chain, a2aOnly, updateUrl],
  );

  // Handle chain filter change
  const handleChainChange = useCallback(
    (newChain: ChainFilter) => {
      setChain(newChain);
      setPage(0); // Reset to first page on filter change
      updateUrl(newChain, debouncedSearch, a2aOnly);
    },
    [debouncedSearch, a2aOnly, updateUrl],
  );

  // Handle A2A filter toggle
  const handleA2AToggle = useCallback(() => {
    const newA2A = !a2aOnly;
    setA2aOnly(newA2A);
    setPage(0);
    updateUrl(chain, debouncedSearch, newA2A);
  }, [a2aOnly, chain, debouncedSearch, updateUrl]);

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
    if (a2aOnly) {
      params.set("a2a", "true");
    }
    return params.toString();
  }, [debouncedSearch, sort, page, chain, a2aOnly]);

  const { data, isLoading } = useSWR<ResourcesResponse>(
    `/api/v1/resources?${queryString}`,
    publicFetcher,
  );

  const resources = data?.resources || [];
  const pagination = data?.pagination;
  const totalPages = pagination
    ? Math.ceil(pagination.total / ITEMS_PER_PAGE)
    : 0;

  const handleSortChange = (newSort: string) => {
    setSort(newSort as SortOption);
    setPage(0); // Reset to first page on sort change
  };

  const titleWithCount =
    pagination && !isLoading
      ? `Resources (${pagination.total.toLocaleString()})`
      : "Resources";

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title={titleWithCount}
        description="Monetized API endpoints that accept x402 payments"
        stackOnMobile
        rightSlot={
          <div className="flex flex-col w-full gap-2 sm:flex-row sm:w-auto">
            <Button
              variant="outline"
              as={Link}
              href="/dashboard/resources"
              className="w-full sm:w-auto"
            >
              <FolderOpen className="w-4 h-4" />
              My Resources
            </Button>
            <AddResourceModalButton
              variant="primary"
              label="Add Resource"
              className="w-full sm:w-auto"
            />
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
              placeholder="Search resources..."
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

          {/* A2A Filter Toggle */}
          <button
            onClick={handleA2AToggle}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors border",
              a2aOnly
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            A2A
          </button>

          <Select
            value={sort}
            onChange={handleSortChange}
            options={SORT_OPTIONS}
            className="w-full sm:w-[180px]"
          />
        </div>

        {/* Filter results info */}
        {(debouncedSearch || chain !== "all" || a2aOnly) &&
          pagination &&
          !isLoading && (
            <p className="text-sm text-muted-foreground mb-4">
              {pagination.total === 0
                ? "No resources found"
                : pagination.total === 1
                  ? "1 resource"
                  : `${pagination.total} resources`}
              {debouncedSearch && ` matching "${debouncedSearch}"`}
              {chain !== "all" &&
                ` on ${chain.charAt(0).toUpperCase() + chain.slice(1)}`}
              {a2aOnly && " (A2A only)"}
            </p>
          )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20">
            <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch || chain !== "all"
                ? "No resources match your filters"
                : "No resources registered yet"}
            </p>
            {!debouncedSearch && chain === "all" && (
              <p className="text-sm text-muted-foreground mt-2">
                Be the first to register an x402 resource
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Resource List */}
            <div className="space-y-3">
              {resources.map((resource) => {
                const earnings = resource.total_earned_usdc
                  ? parseFloat(resource.total_earned_usdc)
                  : 0;
                const successRate = getSuccessRate(
                  resource.success_count_30d,
                  resource.failure_count_30d,
                );
                const totalRuns =
                  (resource.success_count_30d ?? 0) +
                  (resource.failure_count_30d ?? 0);
                return (
                  <ListCard
                    key={resource.id}
                    href={`/resources/${resource.server_slug}/${resource.slug}`}
                    avatarUrl={resource.avatar_url}
                    name={`${resource.server_slug}/${resource.slug}`}
                    description={resource.description}
                    price={earnings > 0 ? formatUsd(earnings) : undefined}
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
                      resource.call_count && resource.call_count > 0
                        ? `${resource.call_count.toLocaleString()} calls`
                        : undefined
                    }
                    type="resource"
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
                  {/* Show page numbers */}
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Calculate which page numbers to show
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
