"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import {
  X,
  Search,
  Box,
  Play,
  PlusCircle,
  Plus,
  Layers,
  Workflow,
  User,
  LogIn,
  Server,
} from "lucide-react";
import { authenticatedFetcher, publicFetcher } from "@/lib/api";
import { formatPrice, formatUsd } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type TabType = "resources" | "jobs";

// Job parameter definition
interface JobParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// Public job interface (includes user's own jobs with isOwn flag)
interface PublicJob {
  id: string;
  name: string;
  description?: string;
  price: number;
  network?: string; // solana or base
  owner_username?: string;
  run_count?: number;
  created_at: string;
  webhook_url: string;
  isOwn?: boolean; // True if this is the current user's own job
  jobParameters?: JobParameter[]; // Exposed job parameters for configuration
}

export interface Resource {
  id: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  category?: string;
  avatar_url?: string;
  server_id?: string;
  server_name?: string;
  server_origin?: string;
  output_schema?: {
    input?: {
      type?: string;
      method?: string;
      bodyType?: string;
      bodyFields?: Record<
        string,
        {
          type: string;
          required?: boolean;
          description?: string;
        }
      >;
      queryParams?: Record<
        string,
        {
          type: string;
          required?: boolean;
          description?: string;
          enum?: string[];
        }
      >;
    };
    output?: Record<string, unknown>;
  };
  extra?: {
    serviceName?: string;
    agentName?: string;
    avatarUrl?: string;
    [key: string]: unknown;
  };
}

import { SolanaIcon, BaseIcon, ChainIcon } from "@/components/icons/ChainIcons";
import { Globe } from "lucide-react";

type NetworkType = "all" | "solana" | "base";

// Network display config
const NETWORKS: {
  id: NetworkType;
  label: string;
  color: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "all",
    label: "All",
    color: "text-muted-foreground",
    icon: <Globe className="w-3.5 h-3.5" />,
  },
  {
    id: "solana",
    label: "Solana",
    color: "text-purple-500",
    icon: <SolanaIcon className="w-3.5 h-3.5" />,
  },
  {
    id: "base",
    label: "Base",
    color: "text-blue-500",
    icon: <BaseIcon className="w-3.5 h-3.5" />,
  },
];

interface ResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (resource: Resource) => void;
  onTry?: (resource: Resource) => void;
  filterNetwork?: string; // If set, only show resources for this network (used when adding to a job)
}

export function ResourcesModal({
  isOpen,
  onClose,
  onSelect,
  onTry,
  filterNetwork,
}: ResourcesModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("resources");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(
    filterNetwork ? (filterNetwork as NetworkType) : "all",
  );

  const { data, isLoading } = useSWR<{ resources: Resource[] }>(
    isOpen ? "/api/v1/resources" : null,
    publicFetcher,
  );

  // Fetch public jobs when Jobs tab is active
  const { data: jobsData, isLoading: loadingJobs } = useSWR<{
    jobs: PublicJob[];
  }>(
    isOpen && activeTab === "jobs" ? "/jobs/public" : null,
    authenticatedFetcher,
  );

  const resources = data?.resources || [];
  const jobs = jobsData?.jobs || [];

  // Determine effective network filter (prop takes precedence)
  const effectiveNetwork =
    filterNetwork || (selectedNetwork === "all" ? null : selectedNetwork);

  const filteredResources = resources.filter((r) => {
    // Network filter
    if (
      effectiveNetwork &&
      r.network?.toLowerCase() !== effectiveNetwork.toLowerCase()
    ) {
      return false;
    }
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        r.name?.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower) ||
        r.extra?.agentName?.toLowerCase().includes(searchLower) ||
        r.extra?.serviceName?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const filteredJobs = jobs.filter((j) => {
    // Network filter - jobs default to "solana" if not set
    const jobNetwork = j.network || "solana";
    if (
      effectiveNetwork &&
      jobNetwork.toLowerCase() !== effectiveNetwork.toLowerCase()
    ) {
      return false;
    }
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        j.name?.toLowerCase().includes(searchLower) ||
        j.description?.toLowerCase().includes(searchLower) ||
        j.owner_username?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (!isOpen) return null;

  // Convert a job to a Resource format for onSelect
  const jobToResource = (job: PublicJob): Resource => {
    // Convert job parameters to bodyFields format for ResourceConfigModal
    const bodyFields: Record<
      string,
      { type: string; required?: boolean; description?: string }
    > = {};

    if (job.jobParameters && job.jobParameters.length > 0) {
      job.jobParameters.forEach((param) => {
        bodyFields[param.name] = {
          type: param.type || "string",
          required: param.required,
          description: param.description,
        };
      });
    }

    return {
      id: job.id,
      name: job.name,
      description: job.description,
      resource_url: job.webhook_url,
      network: job.network || "solana", // Use job's network, default to solana for old jobs
      max_amount_required: String(job.price * 1_000_000), // Convert to micro units
      category: "Jobs",
      output_schema:
        Object.keys(bodyFields).length > 0
          ? {
              input: {
                type: "http",
                method: "POST",
                bodyType: "json",
                bodyFields,
              },
            }
          : undefined,
      extra: {
        serviceName: job.name, // Use job name for display
        agentName: job.name, // This becomes displayName in the canvas
        ownerUsername: job.owner_username,
        isJob: true,
      },
    };
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6 md:p-8">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-2xl my-auto max-h-[calc(100vh-4rem)] flex flex-col">
          {/* Header with Tabs */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("resources")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === "resources"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Box className="h-4 w-4" />
                Resources
              </button>
              <button
                onClick={() => setActiveTab("jobs")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === "jobs"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Workflow className="h-4 w-4" />
                Jobs
              </button>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search + Network Filter */}
          <div className="px-4 pt-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === "resources"
                    ? "Search resources..."
                    : "Search jobs..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Network Filter Tabs - only show when not locked to a network */}
            {(activeTab === "resources" || activeTab === "jobs") &&
              !filterNetwork && (
                <div className="flex items-center gap-1">
                  {NETWORKS.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => setSelectedNetwork(network.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        selectedNetwork === network.id
                          ? `bg-accent ${network.color}`
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      {network.icon}
                      {network.label}
                    </button>
                  ))}
                </div>
              )}

            {/* Show locked network badge when filtering by job's network */}
            {(activeTab === "resources" || activeTab === "jobs") &&
              filterNetwork && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 bg-accent/50 rounded-lg w-fit ${
                    filterNetwork === "base"
                      ? "text-blue-500"
                      : "text-purple-500"
                  }`}
                >
                  <ChainIcon network={filterNetwork} className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    Showing {filterNetwork === "base" ? "Base" : "Solana"}{" "}
                    resources only
                  </span>
                </div>
              )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {activeTab === "jobs" ? (
              // Jobs Tab
              loadingJobs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Info Banner */}
                  <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 mb-4">
                    <Layers className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">
                        Jobs are Composite Resources
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Each job is an x402 resource that chains multiple
                        resources together. Add a job to your workflow just like
                        any other resource.
                      </p>
                    </div>
                  </div>

                  {filteredJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Workflow className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>{search ? "No jobs found" : "No public jobs yet"}</p>
                      <p className="text-xs mt-1">
                        Jobs with webhook triggers appear here
                      </p>
                    </div>
                  ) : (
                    filteredJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* Job Icon */}
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Workflow className="w-5 h-5 text-muted-foreground" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {job.name}
                              </span>
                              {/* Network badge */}
                              <ChainIcon
                                network={job.network || "solana"}
                                className="w-3.5 h-3.5 flex-shrink-0"
                              />
                              {job.isOwn && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent text-muted-foreground">
                                  Your Job
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              {job.owner_username && !job.isOwn && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {job.owner_username}
                                </span>
                              )}
                              {job.run_count !== undefined && (
                                <span>
                                  {!job.isOwn && job.owner_username && "• "}
                                  {job.run_count} runs
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price & Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs font-mono text-green-500 font-medium mr-1">
                              {formatUsd(job.price)}
                            </span>
                            {user ? (
                              onSelect && (
                                <button
                                  onClick={() => onSelect(jobToResource(job))}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                >
                                  <PlusCircle className="w-2.5 h-2.5 mr-1" />
                                  Add
                                </button>
                              )
                            ) : (
                              <Link
                                href="/login"
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                              >
                                <LogIn className="w-2.5 h-2.5 mr-1" />
                                Sign in
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {job.description && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            {job.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )
            ) : // Resources Tab
            isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Box className="w-10 h-10 mx-auto mb-3 opacity-50" />
                {search ? "No resources found" : "No resources registered yet"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredResources.map((resource) => {
                  const priceDisplay = formatPrice(
                    resource.max_amount_required,
                  );
                  const avatarUrl =
                    resource.avatar_url || resource.extra?.avatarUrl;
                  // Extract URL parts
                  const urlInfo = (() => {
                    try {
                      const url = new URL(resource.resource_url);
                      return {
                        protocol: url.protocol.replace(":", ""), // "http" or "https"
                        hostname: url.hostname,
                        pathname: url.pathname,
                        fullUrl: resource.resource_url,
                      };
                    } catch {
                      return {
                        protocol: "",
                        hostname: "",
                        pathname: resource.resource_url,
                        fullUrl: resource.resource_url,
                      };
                    }
                  })();

                  // Get last segment of path for display name fallback
                  const lastSegment = (() => {
                    const segments = urlInfo.pathname
                      .split("/")
                      .filter(Boolean);
                    return segments[segments.length - 1] || resource.name;
                  })();

                  // Display name: use agentName/serviceName if available, otherwise last path segment
                  const hasCustomName =
                    resource.extra?.agentName || resource.extra?.serviceName;
                  const displayName = hasCustomName
                    ? resource.extra?.agentName || resource.extra?.serviceName
                    : lastSegment;

                  return (
                    <div
                      key={resource.id}
                      className="p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar - square with contain to avoid stretching */}
                        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                // Replace with fallback icon on error
                                const parent = (e.target as HTMLImageElement)
                                  .parentElement;
                                if (parent) {
                                  parent.innerHTML =
                                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
                                }
                              }}
                            />
                          ) : (
                            <Box className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">
                              {displayName}
                            </span>
                            {resource.server_id && (
                              <Link
                                href={`/servers/${resource.server_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                title={`View server: ${resource.server_name || urlInfo.hostname}`}
                              >
                                <Server className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                          <p
                            className="text-xs text-muted-foreground font-mono truncate mt-0.5"
                            title={urlInfo.fullUrl}
                          >
                            <span
                              className={
                                urlInfo.protocol === "http"
                                  ? "text-amber-500"
                                  : "text-muted-foreground"
                              }
                            >
                              {urlInfo.protocol}://
                            </span>
                            {urlInfo.hostname}
                            {urlInfo.pathname}
                          </p>
                        </div>

                        {/* Network, Price & Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Network Badge */}
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded ${
                              resource.network?.toLowerCase() === "base"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-purple-500/10 text-purple-500"
                            }`}
                            title={
                              resource.network?.toLowerCase() === "base"
                                ? "Base"
                                : "Solana"
                            }
                          >
                            <ChainIcon
                              network={resource.network || "solana"}
                              className="w-3.5 h-3.5"
                            />
                          </span>
                          <span className="text-xs font-mono text-muted-foreground mr-1">
                            {priceDisplay}
                          </span>
                          {user ? (
                            <button
                              onClick={() => onTry?.(resource)}
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent text-foreground transition-colors"
                            >
                              <Play className="w-2.5 h-2.5 mr-1" />
                              Try
                            </button>
                          ) : (
                            <Link
                              href="/login"
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent text-foreground transition-colors"
                            >
                              <Play className="w-2.5 h-2.5 mr-1" />
                              Try
                            </Link>
                          )}
                          {user ? (
                            onSelect && (
                              <button
                                onClick={() => onSelect(resource)}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                              >
                                <PlusCircle className="w-2.5 h-2.5 mr-1" />
                                Add
                              </button>
                            )
                          ) : (
                            <Link
                              href="/login"
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            >
                              <LogIn className="w-2.5 h-2.5 mr-1" />
                              Sign in
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Description - full width at bottom */}
                      {resource.description && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          {resource.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - only show register button on resources tab */}
          {activeTab === "resources" && (
            <div className="p-4 flex justify-end">
              <Link
                href={user ? "/dashboard/resources/new" : "/login"}
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded bg-resource/20 hover:bg-resource/30 text-resource transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {user ? "Resource" : "Sign in to Add Resource"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
