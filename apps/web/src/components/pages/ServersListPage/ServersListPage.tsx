"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { publicFetcher } from "@/lib/api";
import { Server, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import BaseLayout from "@/components/BaseLayout";
import { PageHeader } from "@/components/PageHeader";
import { ListCard } from "@/components/ListCard";
import Link from "next/link";
import { formatUsd } from "@/lib/format";

type SortOption = "popular" | "latest" | "resources";

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "latest", label: "Latest" },
  { value: "resources", label: "Most Resources" },
];

const ITEMS_PER_PAGE = 25;

interface ServerData {
  id: string;
  slug?: string;
  origin_url: string;
  name: string;
  favicon_url?: string;
  description?: string;
  resource_count: number;
  total_calls?: number;
  total_earned_usdc?: string;
  created_at: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ServersResponse {
  servers: ServerData[];
  pagination: PaginationInfo;
}

export default function ServersListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("popular");
  const [page, setPage] = useState(0);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(page * ITEMS_PER_PAGE));
    params.set("sort", sort);
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    return params.toString();
  }, [debouncedSearch, sort, page]);

  const { data, isLoading } = useSWR<ServersResponse>(
    `/servers?${queryString}`,
    publicFetcher,
  );

  const servers = data?.servers || [];
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
      ? `Servers (${pagination.total.toLocaleString()})`
      : "Servers";

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title={titleWithCount}
        description="Hosts that manage collections of x402 resources"
        rightSlot={
          <Button variant="primary" as={Link} href="/dashboard/resources/new">
            <Plus className="w-4 h-4" />
            Add Resource
          </Button>
        }
      />

      <main className="w-full pb-8">
        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 py-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search servers..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={sort}
            onChange={handleSortChange}
            options={SORT_OPTIONS}
            className="w-full sm:w-[180px]"
          />
        </div>

        {/* Search results info */}
        {debouncedSearch && pagination && !isLoading && (
          <p className="text-sm text-muted-foreground mb-4">
            {pagination.total === 0
              ? "No servers found"
              : pagination.total === 1
                ? "1 server"
                : `${pagination.total} servers`}
            {` matching "${debouncedSearch}"`}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-20">
            <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch
                ? "No servers match your search"
                : "No servers registered yet"}
            </p>
            {!debouncedSearch && (
              <p className="text-sm text-muted-foreground mt-2">
                Register your first x402 resource to create a server
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {servers.map((server) => {
                const hostname = (() => {
                  try {
                    return new URL(server.origin_url).hostname;
                  } catch {
                    return server.origin_url;
                  }
                })();
                return (
                  <ListCard
                    key={server.id}
                    href={`/servers/${server.slug}`}
                    avatarUrl={server.favicon_url}
                    name={server.slug || server.name}
                    description={hostname}
                    price={
                      server.total_earned_usdc &&
                      parseFloat(server.total_earned_usdc) > 0
                        ? formatUsd(parseFloat(server.total_earned_usdc))
                        : undefined
                    }
                    priceSuffix="earned"
                    countLabel={`${server.resource_count} ${server.resource_count === 1 ? "resource" : "resources"}`}
                    type="server"
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
