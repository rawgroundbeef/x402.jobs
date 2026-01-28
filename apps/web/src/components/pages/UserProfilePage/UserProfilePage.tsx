"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { publicFetcher } from "@/lib/api";
import {
  ChevronRight,
  ChevronLeft,
  User,
  Box,
  Server,
  Search,
  Zap,
} from "lucide-react";
import BaseLayout from "@/components/BaseLayout";
import { Avatar } from "@/components/Avatar";
import { ListCard } from "@/components/ListCard";
import { formatPrice, formatUsd } from "@/lib/format";

type SortOption =
  | "latest"
  | "popular"
  | "price_low"
  | "price_high"
  | "earnings";

const SORT_OPTIONS = [
  { value: "earnings", label: "Highest Earning" },
  { value: "popular", label: "Most Popular" },
  { value: "latest", label: "Latest" },
  { value: "price_low", label: "Price: Low → High" },
  { value: "price_high", label: "Price: High → Low" },
];

const ITEMS_PER_PAGE = 10;
const JOBS_PER_PAGE = 10;

interface ProfileData {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface PublicJob {
  id: string;
  display_id: string;
  name: string;
  slug?: string;
  description?: string;
  avatar_url?: string;
  run_count: number;
  created_at: string;
  price: number;
  earnings?: number;
}

interface OwnedServer {
  id: string;
  slug?: string;
  name: string;
  origin_url: string;
  favicon_url?: string;
  description?: string;
  resource_count: number;
  total_calls: number;
  total_earned_usdc?: string;
}

interface OwnedResource {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  call_count: number;
  server_slug?: string;
  server_name?: string;
  server_favicon?: string;
}

interface ProfileStats {
  jobCount: number;
  serverCount: number;
  resourceCount: number;
  totalEarnings?: number;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ProfileResponse {
  profile: ProfileData;
  jobs: PublicJob[];
  servers: OwnedServer[];
  resources: OwnedResource[];
  stats: ProfileStats;
}

interface ResourcesResponse {
  resources: OwnedResource[];
  pagination: PaginationInfo;
}

interface JobsResponse {
  jobs: PublicJob[];
  username: string;
  pagination: PaginationInfo;
}

interface UserProfilePageProps {
  username: string;
}

export default function UserProfilePage({ username }: UserProfilePageProps) {
  // Jobs section state
  const [jobsSearch, setJobsSearch] = useState("");
  const [debouncedJobsSearch, setDebouncedJobsSearch] = useState("");
  const [jobsSort, setJobsSort] = useState<SortOption>("earnings");
  const [jobsPage, setJobsPage] = useState(0);

  // Resources section state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("popular");
  const [page, setPage] = useState(0);

  // Debounce jobs search input
  const handleJobsSearchChange = useCallback((value: string) => {
    setJobsSearch(value);
    setJobsPage(0);
    const timeout = setTimeout(() => {
      setDebouncedJobsSearch(value);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // Build jobs query string
  const jobsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(JOBS_PER_PAGE));
    params.set("offset", String(jobsPage * JOBS_PER_PAGE));
    params.set("sort", jobsSort);
    if (debouncedJobsSearch) {
      params.set("search", debouncedJobsSearch);
    }
    return params.toString();
  }, [debouncedJobsSearch, jobsSort, jobsPage]);

  // Build resources query string
  const resourcesQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(page * ITEMS_PER_PAGE));
    params.set("sort", sort);
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    return params.toString();
  }, [debouncedSearch, sort, page]);

  const handleJobsSortChange = (newSort: string) => {
    setJobsSort(newSort as SortOption);
    setJobsPage(0);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort as SortOption);
    setPage(0);
  };

  // Main profile data
  const { data, isLoading, error } = useSWR<ProfileResponse>(
    `/user/public/${username}`,
    publicFetcher,
  );

  // Separate jobs query with pagination
  const { data: jobsData, isLoading: jobsLoading } = useSWR<JobsResponse>(
    data?.profile ? `/user/public/${username}/jobs?${jobsQueryString}` : null,
    publicFetcher,
  );

  // Separate resources query with pagination
  const { data: resourcesData, isLoading: resourcesLoading } =
    useSWR<ResourcesResponse>(
      data?.profile
        ? `/user/public/${username}/resources?${resourcesQueryString}`
        : null,
      publicFetcher,
    );

  const paginatedJobs = jobsData?.jobs || [];
  const jobsPagination = jobsData?.pagination;
  const jobsTotalPages = jobsPagination
    ? Math.ceil(jobsPagination.total / JOBS_PER_PAGE)
    : 0;
  const showJobsControls =
    jobsPagination && jobsPagination.total > JOBS_PER_PAGE;

  const paginatedResources = resourcesData?.resources || [];
  const pagination = resourcesData?.pagination;
  const totalPages = pagination
    ? Math.ceil(pagination.total / ITEMS_PER_PAGE)
    : 0;
  const showResourcesControls = pagination && pagination.total > ITEMS_PER_PAGE;

  // Loading state
  if (isLoading) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </BaseLayout>
    );
  }

  // Error or not found
  if (error || !data?.profile) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="text-center py-20">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">User Not Found</h1>
          <p className="text-muted-foreground">
            The user @{username} doesn&apos;t exist.
          </p>
        </div>
      </BaseLayout>
    );
  }

  const { profile, servers, stats } = data;

  return (
    <BaseLayout maxWidth="max-w-5xl">
      <main className="w-full pb-12">
        {/* Profile Header - Centered */}
        <div className="text-center py-12 md:py-16">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
          </div>

          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <Avatar
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
              size="3xl"
              fallbackIcon={
                <User className="w-14 h-14 text-muted-foreground" />
              }
              className="border-2 border-border shadow-lg"
            />
          </div>

          {/* Profile Info */}
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {profile.display_name || `@${profile.username}`}
          </h1>
          {profile.display_name && (
            <p className="text-lg text-muted-foreground mb-3">
              @{profile.username}
            </p>
          )}
          {profile.bio && (
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {profile.bio}
            </p>
          )}

          {/* Total Earnings Badge */}
          {stats.totalEarnings !== undefined && stats.totalEarnings > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="font-semibold">
                {formatUsd(stats.totalEarnings)} earned
              </span>
            </div>
          )}
        </div>

        {/* Stats Cards - Match homepage style with colored icons */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Zap className="h-5 w-5 text-violet-500" />
              <span className="text-2xl md:text-3xl font-bold font-mono">
                {stats.jobCount}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Jobs</p>
          </Card>
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Server className="h-5 w-5 text-blue-500" />
              <span className="text-2xl md:text-3xl font-bold font-mono">
                {stats.serverCount}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Servers</p>
          </Card>
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Box className="h-5 w-5 text-teal-500" />
              <span className="text-2xl md:text-3xl font-bold font-mono">
                {stats.resourceCount}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Resources
            </p>
          </Card>
        </div>

        {/* Jobs Section - The products this user sells */}
        {stats.jobCount > 0 && (
          <div className="mb-12 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-violet-500" />
              Jobs
            </h2>

            {/* Search and Sort - always visible */}
            <div className="flex flex-col sm:flex-row gap-3 py-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search jobs..."
                  value={jobsSearch}
                  onChange={(e) => handleJobsSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={jobsSort}
                onChange={handleJobsSortChange}
                options={SORT_OPTIONS}
                className="w-full sm:w-[180px]"
              />
            </div>

            {/* Results count - show when searching */}
            {debouncedJobsSearch && jobsPagination && !jobsLoading && (
              <p className="text-sm text-muted-foreground">
                {jobsPagination.total === 0
                  ? "No jobs found"
                  : jobsPagination.total === 1
                    ? "1 job"
                    : `${jobsPagination.total} jobs`}
                {` matching "${debouncedJobsSearch}"`}
              </p>
            )}

            {/* Loading state */}
            {jobsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              </div>
            ) : paginatedJobs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {debouncedJobsSearch
                    ? "No jobs match your search"
                    : "No jobs yet"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedJobs.map((job) => {
                    const jobSlug =
                      job.slug || job.name.toLowerCase().replace(/\s+/g, "-");
                    const displayPath = `@${profile.username}/${jobSlug}`;
                    const jobHref = job.slug
                      ? `/@${profile.username}/${job.slug}`
                      : `/jobs/${job.id}`;

                    return (
                      <ListCard
                        key={job.id}
                        href={jobHref}
                        avatarUrl={job.avatar_url}
                        name={displayPath}
                        description={job.description}
                        price={
                          job.earnings && job.earnings > 0
                            ? formatUsd(job.earnings)
                            : undefined
                        }
                        priceSuffix="earned"
                        countLabel={
                          job.run_count > 0
                            ? `${job.run_count.toLocaleString()} runs`
                            : undefined
                        }
                        type="job"
                        variant="featured"
                      />
                    );
                  })}
                </div>

                {/* Pagination - only show if more than one page */}
                {showJobsControls && jobsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setJobsPage((p) => Math.max(0, p - 1))}
                      disabled={jobsPage === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>

                    <div className="flex items-center gap-1 px-2">
                      {Array.from(
                        { length: Math.min(jobsTotalPages, 5) },
                        (_, i) => {
                          let pageNum: number;
                          if (jobsTotalPages <= 5) {
                            pageNum = i;
                          } else if (jobsPage < 3) {
                            pageNum = i;
                          } else if (jobsPage > jobsTotalPages - 4) {
                            pageNum = jobsTotalPages - 5 + i;
                          } else {
                            pageNum = jobsPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={
                                jobsPage === pageNum ? "secondary" : "ghost"
                              }
                              size="sm"
                              onClick={() => setJobsPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum + 1}
                            </Button>
                          );
                        },
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setJobsPage((p) => Math.min(jobsTotalPages - 1, p + 1))
                      }
                      disabled={!jobsPagination?.hasMore}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Servers Section */}
        {servers.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Server className="h-5 w-5 text-blue-500" />
              Servers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {servers.map((server) => (
                <Link
                  key={server.id}
                  href={`/servers/${server.slug || server.id}`}
                  className="block group"
                >
                  <Card className="p-5 hover:bg-accent/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01] transition-all duration-200 ease-out h-full">
                    <div className="flex items-center gap-4">
                      <Avatar
                        src={server.favicon_url}
                        alt={server.name}
                        size="lg"
                        fallbackIcon={
                          <Server className="w-6 h-6 text-muted-foreground" />
                        }
                        className="group-hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg truncate mb-1">
                          {server.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {server.resource_count}{" "}
                          {server.resource_count === 1
                            ? "resource"
                            : "resources"}
                          {server.total_calls > 0 && (
                            <span className="ml-2">
                              • {server.total_calls.toLocaleString()} calls
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Resources Section */}
        {stats.resourceCount > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Box className="h-5 w-5 text-teal-500" />
              Resources
            </h2>

            {/* Search and Sort - always visible */}
            <div className="flex flex-col sm:flex-row gap-3 py-2">
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
              <Select
                value={sort}
                onChange={handleSortChange}
                options={SORT_OPTIONS}
                className="w-full sm:w-[180px]"
              />
            </div>

            {/* Results count - show when searching */}
            {debouncedSearch && pagination && !resourcesLoading && (
              <p className="text-sm text-muted-foreground">
                {pagination.total === 0
                  ? "No resources found"
                  : pagination.total === 1
                    ? "1 resource"
                    : `${pagination.total} resources`}
                {` matching "${debouncedSearch}"`}
              </p>
            )}

            {/* Loading state */}
            {resourcesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              </div>
            ) : paginatedResources.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <Box className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {debouncedSearch
                    ? "No resources match your search"
                    : "No resources yet"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedResources.map((resource) => (
                    <ListCard
                      key={resource.id}
                      href={`/resources/${resource.server_slug}/${resource.slug}`}
                      avatarUrl={resource.avatar_url || resource.server_favicon}
                      name={`${resource.server_slug}/${resource.slug}`}
                      description={resource.description}
                      price={
                        resource.max_amount_required
                          ? formatPrice(resource.max_amount_required)
                          : undefined
                      }
                      countLabel={
                        resource.call_count > 0
                          ? `${resource.call_count.toLocaleString()} calls`
                          : undefined
                      }
                      type="resource"
                    />
                  ))}
                </div>

                {/* Pagination - only show if more than one page */}
                {showResourcesControls && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
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
                      {Array.from(
                        { length: Math.min(totalPages, 5) },
                        (_, i) => {
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
                        },
                      )}
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
          </div>
        )}
      </main>
    </BaseLayout>
  );
}
