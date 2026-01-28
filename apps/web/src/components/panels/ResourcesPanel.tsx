"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import useSWR from "swr";
import {
  Plus,
  Loader2,
  Search,
  Box,
  Play,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { SlidePanel } from "./SlidePanel";
import { PanelTabs } from "./PanelTabs";
import { publicFetcher } from "@/lib/api";
import { useModals, type ModalResource } from "@/contexts/ModalContext";
import { formatResourcePath } from "@/lib/format";

const ITEMS_PER_PAGE = 25;

// Helper component for resource avatar with fallback
function ResourceAvatar({
  src,
  fallbackIcon: FallbackIcon = Box,
  fallbackClassName = "bg-resource/20 text-resource",
}: {
  src?: string;
  fallbackIcon?: typeof Box | typeof Layers;
  fallbackClassName?: string;
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${fallbackClassName}`}
      >
        <FallbackIcon className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
      onError={() => setHasError(true)}
    />
  );
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Resource types
interface Resource {
  id: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  server_id?: string;
  slug?: string;
  server_slug?: string;
  server?: {
    id: string;
    name: string;
    slug?: string;
    favicon_url?: string;
  };
  output_schema?: {
    input?: {
      method?: string;
      bodyFields?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
      queryParams?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
    };
  };
  // Prompt template parameters
  pt_parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
}

interface JobParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface PublicJob {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  network: string;
  price: number;
  webhook_url: string;
  owner_username?: string;
  isOwn?: boolean;
  jobParameters?: JobParameter[];
  avatar_url?: string;
}

export type ResourcesPanelTab = "resources" | "jobs";

interface ResourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ResourcesPanelTab;
  filterNetwork?: "solana" | "base";
  onSelectResource?: (resource: Resource) => void;
  onTryResource?: (resource: Resource) => void;
}

export function ResourcesPanel({
  isOpen,
  onClose,
  initialTab = "resources",
  filterNetwork,
  onSelectResource,
  onTryResource,
}: ResourcesPanelProps) {
  const { openRegisterResource, openResourceModal, openCreateJob } =
    useModals();
  const [activeTab, setActiveTab] = useState<ResourcesPanelTab>(initialTab);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState<"all" | "solana" | "base">(
    filterNetwork || "all",
  );
  const [resourcesPage, setResourcesPage] = useState(0);
  const [jobsPage, setJobsPage] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure panel animation has started
      const timeout = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Sync network filter with prop (for when filterNetwork changes)
  useEffect(() => {
    if (filterNetwork) {
      setNetworkFilter(filterNetwork);
    }
  }, [filterNetwork]);

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setDebouncedSearch("");
      setResourcesPage(0);
      setJobsPage(0);
      // Only reset network filter if not locked by prop
      if (!filterNetwork) {
        setNetworkFilter("all");
      }
    }
  }, [isOpen, filterNetwork]);

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      // Reset to first page when search changes
      setResourcesPage(0);
      setJobsPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Build resources query string
  const resourcesQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(resourcesPage * ITEMS_PER_PAGE));
    params.set("sort", "popular");
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    if (networkFilter !== "all") {
      params.set("network", networkFilter);
    }
    return params.toString();
  }, [debouncedSearch, networkFilter, resourcesPage]);

  // Build jobs query string
  const jobsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("offset", String(jobsPage * ITEMS_PER_PAGE));
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    if (networkFilter !== "all") {
      params.set("network", networkFilter);
    }
    return params.toString();
  }, [debouncedSearch, networkFilter, jobsPage]);

  // Fetch resources with server-side search and pagination
  const {
    data: resourcesData,
    error: resourcesError,
    isLoading: resourcesLoading,
  } = useSWR<{ resources: Resource[]; pagination: PaginationInfo }>(
    isOpen && activeTab === "resources"
      ? `/api/v1/resources?${resourcesQueryString}`
      : null,
    publicFetcher,
  );

  // Fetch public jobs with server-side search and pagination
  const {
    data: publicJobsData,
    error: publicJobsError,
    isLoading: publicJobsLoading,
  } = useSWR<{ jobs: PublicJob[]; pagination: PaginationInfo }>(
    isOpen && activeTab === "jobs" ? `/jobs/public?${jobsQueryString}` : null,
    publicFetcher,
  );

  const isLoading =
    activeTab === "resources" ? resourcesLoading : publicJobsLoading;
  const error = activeTab === "resources" ? resourcesError : publicJobsError;

  // Get resources (already filtered server-side)
  const resources = resourcesData?.resources || [];
  const resourcesPagination = resourcesData?.pagination;
  const resourcesTotalPages = resourcesPagination
    ? Math.ceil(resourcesPagination.total / ITEMS_PER_PAGE)
    : 0;

  // Get jobs (already filtered server-side)
  const publicJobs = publicJobsData?.jobs || [];
  const jobsPagination = publicJobsData?.pagination;
  const jobsTotalPages = jobsPagination
    ? Math.ceil(jobsPagination.total / ITEMS_PER_PAGE)
    : 0;

  // Reset page when network filter changes
  const handleNetworkFilterChange = useCallback(
    (net: "all" | "solana" | "base") => {
      setNetworkFilter(net);
      setResourcesPage(0);
      setJobsPage(0);
    },
    [],
  );

  // Convert job parameters to output_schema format
  const jobParametersToSchema = (params?: JobParameter[]) => {
    if (!params || params.length === 0) return undefined;
    const bodyFields: Record<
      string,
      { type: string; required?: boolean; description?: string }
    > = {};
    params.forEach((p) => {
      bodyFields[p.name] = {
        type: p.type,
        required: p.required,
        description: p.description,
      };
    });
    return { input: { bodyFields } };
  };

  const handleTryResource = (resource: Resource) => {
    const modalResource: ModalResource = {
      id: resource.id,
      name: resource.name,
      description: resource.description,
      resource_url: resource.resource_url,
      network: resource.network,
      max_amount_required: resource.max_amount_required,
      avatar_url: resource.avatar_url,
      server_id: resource.server_id,
      server_name: resource.server?.name,
      output_schema: resource.output_schema,
      pt_parameters: resource.pt_parameters,
    };

    if (onTryResource) {
      onTryResource(resource);
    } else {
      openResourceModal(modalResource);
    }
    onClose();
  };

  const handleTryJob = (job: PublicJob) => {
    // Convert job to resource format for trying
    const jobAsResource: Resource = {
      id: job.id,
      name: job.name,
      description: job.description,
      resource_url: job.webhook_url,
      network: job.network,
      max_amount_required: String(job.price * 1_000_000),
      output_schema: jobParametersToSchema(job.jobParameters),
    };
    if (onTryResource) {
      onTryResource(jobAsResource);
    }
    onClose();
  };

  const handleSelectResource = (resource: Resource) => {
    if (onSelectResource) {
      onSelectResource(resource);
      onClose();
    }
  };

  const handleSelectJob = (job: PublicJob) => {
    if (onSelectResource) {
      // Convert public job to resource format for workflow
      const jobAsResource: Resource = {
        id: job.id,
        name: job.name,
        description: job.description,
        resource_url: job.webhook_url,
        network: job.network,
        max_amount_required: String(job.price * 1_000_000),
        output_schema: jobParametersToSchema(job.jobParameters),
      };
      onSelectResource(jobAsResource);
      onClose();
    }
  };

  const handleAddResource = () => {
    openRegisterResource();
    onClose();
  };

  const handleNewJob = () => {
    openCreateJob();
    onClose();
  };

  const tabs = [
    { id: "resources", label: "Resources" },
    { id: "jobs", label: "Jobs" },
  ];

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Resources"
      headerRight={
        <Button
          variant="ghost"
          size="sm"
          onClick={activeTab === "resources" ? handleAddResource : handleNewJob}
          className="gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {activeTab === "resources" ? "Create Resource" : "Create Job"}
        </Button>
      }
      fullBleed
    >
      {/* Tabs */}
      <PanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as ResourcesPanelTab)}
      />

      {/* Search + Filters */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder={
              activeTab === "resources"
                ? "Search resources..."
                : "Search jobs..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Network filter (only if not locked) */}
        {!filterNetwork && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "solana", "base"] as const).map((net) => (
              <button
                key={net}
                onClick={() => handleNetworkFilterChange(net)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                  networkFilter === net
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {net === "all" ? "All" : net === "solana" ? "Solana" : "Base"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-destructive">
            Failed to load {activeTab === "resources" ? "resources" : "jobs"}
          </div>
        ) : activeTab === "resources" ? (
          // Resources list
          resources.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {debouncedSearch
                  ? "No matching resources"
                  : "No resources found"}
              </p>
            </div>
          ) : (
            <>
              <div className="p-2 space-y-1">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group"
                  >
                    {/* Avatar/Icon */}
                    <ResourceAvatar
                      src={resource.avatar_url || resource.server?.favicon_url}
                      fallbackIcon={Box}
                      fallbackClassName="bg-resource/20 text-resource"
                    />

                    {/* Info */}
                    <button
                      onClick={() =>
                        onSelectResource
                          ? handleSelectResource(resource)
                          : handleTryResource(resource)
                      }
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium truncate font-mono">
                        {formatResourcePath(resource)}
                      </p>
                      <p
                        className="text-xs text-muted-foreground truncate"
                        title={resource.resource_url}
                      >
                        {resource.resource_url}
                      </p>
                    </button>

                    {/* Try button */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleTryResource(resource)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Try It"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Pagination for resources */}
              {resourcesTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setResourcesPage((p) => Math.max(0, p - 1))}
                    disabled={resourcesPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {resourcesPage + 1} of {resourcesTotalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setResourcesPage((p) =>
                        Math.min(resourcesTotalPages - 1, p + 1),
                      )
                    }
                    disabled={!resourcesPagination?.hasMore}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )
        ) : // Public Jobs list
        publicJobs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {debouncedSearch ? "No matching jobs" : "No public jobs found"}
            </p>
          </div>
        ) : (
          <>
            <div className="p-2 space-y-1">
              {publicJobs.map((job) => {
                const jobSlug =
                  job.slug || job.name.toLowerCase().replace(/\s+/g, "-");
                const jobPath = job.owner_username
                  ? `@${job.owner_username}/${jobSlug}`
                  : jobSlug;
                return (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group"
                  >
                    {/* Avatar/Icon */}
                    <ResourceAvatar
                      src={job.avatar_url}
                      fallbackIcon={Layers}
                      fallbackClassName="bg-primary/20 text-primary"
                    />

                    {/* Info */}
                    <button
                      onClick={() =>
                        onSelectResource
                          ? handleSelectJob(job)
                          : handleTryJob(job)
                      }
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium truncate font-mono">
                        {jobPath}
                      </p>
                      <p
                        className="text-xs text-muted-foreground truncate"
                        title={job.webhook_url}
                      >
                        {job.description || job.webhook_url}
                      </p>
                    </button>

                    {/* Try button */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleTryJob(job)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Try It"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Pagination for jobs */}
            {jobsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setJobsPage((p) => Math.max(0, p - 1))}
                  disabled={jobsPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {jobsPage + 1} of {jobsTotalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    setJobsPage((p) => Math.min(jobsTotalPages - 1, p + 1))
                  }
                  disabled={!jobsPagination?.hasMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={activeTab === "resources" ? handleAddResource : handleNewJob}
        >
          <Plus className="h-4 w-4" />
          {activeTab === "resources" ? "Register Resource" : "Create Job"}
        </Button>
      </div>
    </SlidePanel>
  );
}
