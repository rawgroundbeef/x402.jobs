"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { Card } from "@x402jobs/ui/card";
import { publicFetcher, authenticatedFetch } from "@/lib/api";
import {
  Server,
  ExternalLink,
  Trash2,
  Loader2,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Box,
  Play,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";
import BaseLayout from "@/components/BaseLayout";
import { Avatar } from "@/components/Avatar";
import { ClaimOwnershipButton } from "@/components/ClaimOwnershipButton";
import { ServerEditModal } from "@/components/modals/ServerEditModal";
import { ListCard } from "@/components/ListCard";
import { formatUsd, formatPrice } from "@/lib/format";
import { BaseIcon, SolanaIcon } from "@/components/icons/ChainIcons";
import { cn } from "@x402jobs/ui/utils";

type SortOption = "latest" | "popular" | "price_low" | "price_high";
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
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Most Popular" },
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
  verified_owner_id?: string;
  registered_by?: string;
  owner_username?: string;
  owner_display_name?: string;
  owner_avatar_url?: string;
  is_hosted?: boolean;
}

interface ResourceData {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  output_schema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  is_verified: boolean;
  created_at: string;
  registered_by?: string;
  call_count?: number;
}

interface ServerDetailPageProps {
  serverSlug: string;
}

export default function ServerDetailPage({
  serverSlug,
}: ServerDetailPageProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { openRegisterResource } = useModals();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Search, sort, chain filter, and pagination state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("latest");
  const [chain, setChain] = useState<ChainFilter>("all");
  const [page, setPage] = useState(0);

  // Debounce search input - only update debouncedSearch, handle page reset separately
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== search) {
          setPage(0); // Reset page only when search actually changes
        }
        return search;
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Build query string for resources
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

  // Handle chain filter change
  const handleChainChange = (newChain: ChainFilter) => {
    setChain(newChain);
    setPage(0);
  };

  const { data, isLoading, error, mutate } = useSWR<{
    server: ServerData;
    resources: ResourceData[];
    pagination: PaginationInfo;
  }>(`/servers/${serverSlug}?${queryString}`, publicFetcher, {
    keepPreviousData: true, // Prevent flash during search/pagination
  });

  const pagination = data?.pagination;
  const totalPages = pagination
    ? Math.ceil(pagination.total / ITEMS_PER_PAGE)
    : 0;

  const handleSortChange = (newSort: string) => {
    setSort(newSort as SortOption);
    setPage(0); // Reset to first page on sort change
  };

  const handleEditSaved = (newSlug?: string) => {
    mutate(); // Refresh data
    if (newSlug && newSlug !== serverSlug) {
      router.push(`/servers/${newSlug}`);
    }
  };

  const handleDeleteServer = async () => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this server? This will only work if it has no active resources.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await authenticatedFetch(`/servers/${data?.server?.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete server");
      }

      router.push("/servers");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete server",
      );
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data?.server) {
    return (
      <BaseLayout maxWidth="max-w-5xl">
        <main className="max-w-5xl mx-auto px-4 py-20 text-center">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Server not found</p>
        </main>
      </BaseLayout>
    );
  }

  const { server, resources } = data;
  const hostname = new URL(server.origin_url).hostname;
  const canEdit = isAdmin || server.verified_owner_id === user?.id;
  const isClaimed = !!server.verified_owner_id;
  const totalEarnings = server.total_earned_usdc
    ? parseFloat(server.total_earned_usdc)
    : 0;

  return (
    <BaseLayout maxWidth="max-w-5xl">
      <main className="w-full pb-12">
        {/* Server Header - Centered Profile Style */}
        <div className="text-center py-12 md:py-16">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-500/5 via-transparent to-transparent rounded-full blur-3xl" />
          </div>

          {/* Server Icon - Large & Centered */}
          <div className="flex justify-center mb-6">
            <Avatar
              src={server.favicon_url}
              alt={server.name}
              size="3xl"
              fallbackIcon={
                <Server className="w-14 h-14 text-muted-foreground" />
              }
              className="border-2 border-border shadow-lg"
            />
          </div>

          {/* Server Name */}
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {server.name || server.slug}
          </h1>

          {/* Domain Link */}
          <a
            href={server.origin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition-colors"
          >
            {hostname}
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Owner & Claimed Status */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {isClaimed && server.owner_username ? (
              <>
                <Link
                  href={`/@${server.owner_username}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Owned by @{server.owner_username}
                </Link>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Claimed
                </span>
              </>
            ) : server.is_hosted ? (
              // Hosted servers are platform-managed, show owner without "Claimed" badge
              server.owner_username && (
                <Link
                  href={`/@${server.owner_username}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Owned by @{server.owner_username}
                </Link>
              )
            ) : (
              <ClaimOwnershipButton
                serverId={server.id}
                serverSlug={server.slug || server.name}
                serverOriginUrl={server.origin_url}
                isLoggedIn={!!user}
                ownerUsername={server.owner_username}
                onSuccess={() => mutate()}
              />
            )}
          </div>

          {/* Description */}
          {server.description && (
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              {server.description}
            </p>
          )}

          {/* Total Earnings Badge */}
          {totalEarnings > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-6">
              <span className="font-semibold">
                {formatUsd(totalEarnings)} earned
              </span>
            </div>
          )}

          {deleteError && (
            <p className="text-sm text-destructive mb-4">{deleteError}</p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Box className="h-5 w-5 text-teal-500" />
              <span className="text-2xl md:text-3xl font-bold font-mono">
                {server.resource_count || 0}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Resources
            </p>
          </Card>
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Play className="h-5 w-5 text-violet-500" />
              <span className="text-2xl md:text-3xl font-bold font-mono">
                {(server.total_calls || 0).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Total Calls
            </p>
          </Card>
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl md:text-3xl font-bold font-mono">
                {formatUsd(totalEarnings)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Earned</p>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {canEdit && (
            <>
              <Button
                variant="primary"
                className="h-10"
                onClick={() => openRegisterResource()}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Resource
              </Button>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => setShowEditModal(true)}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit Server
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="h-10 text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={handleDeleteServer}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1.5" />
                  )}
                  Delete
                </Button>
              )}
            </>
          )}
          {!canEdit && !isClaimed && !server.is_hosted && user && (
            <p className="text-sm text-muted-foreground">
              Claim this server to add resources and customize it
            </p>
          )}
        </div>

        {/* Resources Section */}
        <div>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Box className="h-5 w-5 text-teal-500" />
              Resources
            </h2>
          </div>

          {/* Search, Chain Filter, and Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search resources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

          {/* Results count */}
          {pagination && !isLoading && (
            <p className="text-sm text-muted-foreground mb-4">
              {pagination.total === 0
                ? "No resources found"
                : pagination.total === 1
                  ? "1 resource"
                  : `${pagination.total} resources`}
              {debouncedSearch && ` matching "${debouncedSearch}"`}
              {chain !== "all" &&
                ` on ${chain.charAt(0).toUpperCase() + chain.slice(1)}`}
            </p>
          )}

          {/* Resources List */}
          {resources.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">
                {debouncedSearch || chain !== "all"
                  ? "No resources match your filters"
                  : "No resources yet"}
              </p>
              {!debouncedSearch && chain === "all" && canEdit && (
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first resource to get started
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {resources.map((resource) => {
                const avatarUrl =
                  resource.avatar_url ||
                  (resource.extra as { avatarUrl?: string })?.avatarUrl ||
                  server.favicon_url;
                const priceDisplay = formatPrice(resource.max_amount_required);
                return (
                  <ListCard
                    key={resource.id}
                    href={`/resources/${server.slug}/${resource.slug}`}
                    avatarUrl={avatarUrl}
                    name={`${server.slug}/${resource.slug}`}
                    description={resource.description}
                    price={priceDisplay !== "$0.00" ? priceDisplay : undefined}
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
          )}

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
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={!pagination?.hasMore}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <ServerEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          server={{
            id: server.id,
            name: server.name,
            slug: server.slug,
            description: server.description,
            favicon_url: server.favicon_url,
          }}
          onSaved={handleEditSaved}
        />
      )}
    </BaseLayout>
  );
}
