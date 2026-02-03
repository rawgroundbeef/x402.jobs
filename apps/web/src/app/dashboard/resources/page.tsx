"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Input } from "@x402jobs/ui/input";
import { Dropdown, DropdownItem, DropdownDivider } from "@x402jobs/ui/dropdown";
import { authenticatedFetch } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { ChainIcon, BaseIcon, SolanaIcon } from "@/components/icons/ChainIcons";
import { RESOURCE_CATEGORIES } from "@/constants/categories";
import { AddResourceModalButton } from "@/components/AddResourceModalButton";
import { ResourceEditModal } from "@/components/modals/ResourceEditModal";
import {
  Loader2,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Archive,
  AlertCircle,
  Pencil,
  Play,
  Search,
  X,
  MoreVertical,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

interface Resource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  resource_url: string;
  network: string;
  price_usdc: string;
  resource_type:
    | "external"
    | "proxy"
    | "prompt"
    | "prompt_template"
    | "static"
    | "openrouter_instant";
  call_count: number;
  total_earned_usdc: number;
  is_active: boolean;
  created_at: string;
  avatar_url?: string | null;
  category?: string;
  server?: {
    slug: string;
    name: string;
    is_hosted: boolean;
    favicon_url?: string;
  };
  // Prompt template specific fields
  pt_system_prompt?: string;
  pt_parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
  pt_model?: string;
  pt_max_tokens?: number;
  pt_allows_user_message?: boolean;
}

type FilterType = "all" | "proxy" | "external";
type NetworkFilter = "all" | "base" | "solana";

const RESOURCE_TYPE_LABELS = {
  external: "External",
  proxy: "Created",
  prompt: "Prompt",
  prompt_template: "Claude Prompt",
  openrouter_instant: "OpenRouter",
  static: "Static",
};

const NETWORK_OPTIONS: {
  value: NetworkFilter;
  label: string;
  icon?: React.ReactNode;
}[] = [
  { value: "all", label: "All Networks" },
  { value: "base", label: "Base", icon: <BaseIcon className="w-4 h-4" /> },
  {
    value: "solana",
    label: "Solana",
    icon: <SolanaIcon className="w-4 h-4" />,
  },
];

type CategoryFilter = "all" | (typeof RESOURCE_CATEGORIES)[number]["value"];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All Categories" },
  ...RESOURCE_CATEGORIES.map((cat) => ({
    value: cat.value as CategoryFilter,
    label: cat.label,
  })),
];

// Archive Confirmation Modal
function ArchiveConfirmationModal({
  isOpen,
  resourceName,
  onClose,
  onConfirm,
  isArchiving,
}: {
  isOpen: boolean;
  resourceName: string;
  onClose: () => void;
  onConfirm: () => void;
  isArchiving: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-2">Archive Resource</h2>
        <p className="text-muted-foreground mb-4">
          Are you sure you want to archive{" "}
          <span className="font-medium text-foreground">"{resourceName}"</span>?
        </p>
        <div className="bg-muted/50 rounded-lg p-3 mb-6 text-sm text-muted-foreground space-y-2">
          <p>When archived:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Hidden from your resources list and public listings</li>
            <li>Existing jobs using this resource will continue to work</li>
            <li>Earnings and metrics will still accrue to you</li>
          </ul>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isArchiving}>
            Cancel
          </Button>
          <Button variant="default" onClick={onConfirm} disabled={isArchiving}>
            {isArchiving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Archiving...
              </>
            ) : (
              "Archive"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [startingJobId, setStartingJobId] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [archiveModal, setArchiveModal] = useState<{
    isOpen: boolean;
    resource: Resource | null;
    isArchiving: boolean;
  }>({
    isOpen: false,
    resource: null,
    isArchiving: false,
  });
  const [showArchived, setShowArchived] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Fetch user's resources
  const fetchResources = async () => {
    try {
      const res = await authenticatedFetch("/user/resources");
      if (!res.ok) throw new Error("Failed to fetch resources");
      const data = await res.json();
      setResources(data.resources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  // Archive resource
  const handleArchive = async () => {
    if (!archiveModal.resource) return;

    setArchiveModal((prev) => ({ ...prev, isArchiving: true }));

    try {
      const res = await authenticatedFetch(
        `/resources/${archiveModal.resource.id}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to archive resource");
      // Update local state to mark as archived
      setResources((prev) =>
        prev.map((r) =>
          r.id === archiveModal.resource?.id ? { ...r, is_active: false } : r,
        ),
      );
      setArchiveModal({ isOpen: false, resource: null, isArchiving: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to archive resource",
      );
      setArchiveModal((prev) => ({ ...prev, isArchiving: false }));
    }
  };

  // Restore archived resource
  const handleRestore = async (resource: Resource) => {
    try {
      const res = await authenticatedFetch(
        `/resources/${resource.id}/restore`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error("Failed to restore resource");
      // Update local state to mark as active
      setResources((prev) =>
        prev.map((r) => (r.id === resource.id ? { ...r, is_active: true } : r)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to restore resource",
      );
    }
  };

  // Copy URL
  const copyUrl = useCallback(async (resource: Resource) => {
    await navigator.clipboard.writeText(resource.resource_url);
    setCopiedId(resource.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Start a job with this resource
  const handleStartJob = async (resource: Resource) => {
    setStartingJobId(resource.id);
    setError("");

    try {
      const price = parseFloat(resource.price_usdc) || 0.01;

      const workflow_data = {
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 100, y: 200 },
            data: {},
          },
          {
            id: "resource-1",
            type: "resource",
            position: { x: 350, y: 200 },
            data: {
              resource: {
                id: resource.id,
                name: resource.name,
                slug: resource.slug,
                serverSlug: resource.server?.slug,
                description: resource.description,
                price: price,
                avatarUrl: resource.avatar_url,
                resourceUrl: resource.resource_url,
                network: resource.network,
                pt_parameters: resource.pt_parameters,
              },
              configuredInputs: {},
            },
          },
          {
            id: "output-1",
            type: "output",
            position: { x: 600, y: 200 },
            data: { result: null, isLoading: false },
          },
        ],
        edges: [
          {
            id: "e-trigger-resource",
            source: "trigger-1",
            target: "resource-1",
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
          {
            id: "e-resource-output",
            source: "resource-1",
            target: "output-1",
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
        ],
      };

      const res = await authenticatedFetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${resource.name} Job`,
          network: resource.network,
          workflow_data: workflow_data,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create job");
      }

      const data = await res.json();
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start job");
      setStartingJobId(null);
    }
  };

  // Filter resources
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      // Active/Archived filter
      if (showArchived) {
        if (r.is_active) return false; // Only show archived
      } else {
        if (!r.is_active) return false; // Only show active
      }

      // Type filter
      if (filter !== "all" && r.resource_type !== filter) return false;

      // Network filter
      if (networkFilter !== "all" && r.network !== networkFilter) return false;

      // Category filter
      if (categoryFilter !== "all" && r.category !== categoryFilter)
        return false;

      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(searchLower);
        const matchesUrl = r.resource_url.toLowerCase().includes(searchLower);
        const matchesDescription = r.description
          ?.toLowerCase()
          .includes(searchLower);
        if (!matchesName && !matchesUrl && !matchesDescription) return false;
      }

      return true;
    });
  }, [
    resources,
    filter,
    networkFilter,
    categoryFilter,
    debouncedSearch,
    showArchived,
  ]);

  // Stats (only count active resources for display counts)
  const activeResources = resources.filter((r) => r.is_active);
  const archivedResources = resources.filter((r) => !r.is_active);
  const totalEarnings = resources.reduce(
    (sum, r) => sum + (r.total_earned_usdc || 0),
    0,
  );
  const totalCalls = resources.reduce((sum, r) => sum + (r.call_count || 0), 0);
  const createdResources = activeResources.filter(
    (r) => r.resource_type !== "external",
  );

  // Get current network label for dropdown trigger
  const currentNetwork = NETWORK_OPTIONS.find((n) => n.value === networkFilter);
  const currentCategory = CATEGORY_OPTIONS.find(
    (c) => c.value === categoryFilter,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resources</h1>
        <AddResourceModalButton
          variant="default"
          label="Create Resource"
          onSuccess={fetchResources}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-sm text-muted-foreground">Active Resources</p>
          <p className="text-2xl font-bold">{activeResources.length}</p>
          <div className="flex gap-2 mt-1">
            {createdResources.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500">
                {createdResources.length} created
              </span>
            )}
            {archivedResources.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                {archivedResources.length} archived
              </span>
            )}
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <p className="text-sm text-muted-foreground">Total Calls</p>
          <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <p className="text-sm text-muted-foreground">Total Earnings</p>
          <p className="text-2xl font-bold text-green-500">
            {formatUsd(totalEarnings)}
          </p>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter Tabs + Network Dropdown */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {(["all", "proxy", "external"] as const).map((type) => {
            const count = activeResources.filter(
              (r) => type === "all" || r.resource_type === type,
            ).length;
            return (
              <button
                key={type}
                onClick={() => {
                  setFilter(type);
                  setShowArchived(false); // Exit archived view when selecting type
                }}
                className={`px-4 py-2 rounded-lg border text-sm whitespace-nowrap transition-all ${
                  filter === type && !showArchived
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {type === "all" ? "All" : RESOURCE_TYPE_LABELS[type]}
                {type !== "all" && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({count})
                  </span>
                )}
              </button>
            );
          })}

          {/* Archived Toggle */}
          {archivedResources.length > 0 && (
            <button
              onClick={() => {
                setShowArchived(true);
                setFilter("all"); // Reset type filter when viewing archived
              }}
              className={`px-4 py-2 rounded-lg border text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                showArchived
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Archived
              <span className="text-xs text-muted-foreground">
                ({archivedResources.length})
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter Dropdown */}
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-accent transition-colors">
                <span>{currentCategory?.label}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            }
            placement="bottom-end"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <DropdownItem
                key={option.value}
                onClick={() => setCategoryFilter(option.value)}
                active={categoryFilter === option.value}
              >
                {option.label}
              </DropdownItem>
            ))}
          </Dropdown>

          {/* Network Filter Dropdown */}
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-accent transition-colors">
                {currentNetwork?.icon}
                <span>{currentNetwork?.label}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            }
            placement="bottom-end"
          >
            {NETWORK_OPTIONS.map((option) => (
              <DropdownItem
                key={option.value}
                onClick={() => setNetworkFilter(option.value)}
                active={networkFilter === option.value}
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* Results info when filtering */}
      {(debouncedSearch ||
        networkFilter !== "all" ||
        categoryFilter !== "all") && (
        <p className="text-sm text-muted-foreground">
          {filteredResources.length === 0
            ? "No resources found"
            : `${filteredResources.length} resource${filteredResources.length !== 1 ? "s" : ""}`}
          {debouncedSearch && ` matching "${debouncedSearch}"`}
          {categoryFilter !== "all" && ` in ${currentCategory?.label}`}
          {networkFilter !== "all" &&
            ` on ${networkFilter.charAt(0).toUpperCase() + networkFilter.slice(1)}`}
        </p>
      )}

      {/* Resources List */}
      {filteredResources.length === 0 ? (
        <Card className="p-8 text-center">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Resources</h2>
          <p className="text-muted-foreground mb-4">
            {filter === "all" && networkFilter === "all" && !debouncedSearch
              ? "Create your first resource to start earning."
              : "No resources match your filters."}
          </p>
          <AddResourceModalButton
            variant="primary"
            label="Create Resource"
            onSuccess={fetchResources}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredResources.map((resource) => {
            const isInstant = resource.resource_type !== "external";
            const resourcePageUrl = resource.server?.slug
              ? `/resources/${resource.server.slug}/${resource.slug}`
              : null;

            return (
              <Card
                key={resource.id}
                className={`p-4 ${resourcePageUrl ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}
                onClick={() => resourcePageUrl && router.push(resourcePageUrl)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {resource.avatar_url ? (
                      <img
                        src={resource.avatar_url}
                        alt={resource.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-sm font-medium ${
                          isInstant
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {resource.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">
                          {resource.name}
                        </h3>
                        <ChainIcon
                          network={resource.network as "solana" | "base"}
                          className="w-4 h-4 shrink-0"
                        />
                        <span
                          className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                            isInstant
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {RESOURCE_TYPE_LABELS[resource.resource_type]}
                        </span>
                      </div>
                      {resource.is_active && (
                        <p className="text-sm text-muted-foreground truncate">
                          {resource.resource_url}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">
                        {formatUsd(parseFloat(resource.price_usdc))}
                      </p>
                      <p className="text-xs text-muted-foreground">per call</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">
                        {resource.call_count?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">calls</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-500">
                        {formatUsd(resource.total_earned_usdc || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">earned</p>
                    </div>

                    {/* Action Buttons */}
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartJob(resource)}
                        disabled={startingJobId === resource.id}
                        title="Run as Job"
                        className="text-trigger hover:text-trigger-dark hover:bg-trigger/10"
                      >
                        {startingJobId === resource.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Overflow Menu */}
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                        placement="bottom-end"
                      >
                        <DropdownItem
                          onClick={() => setEditingResource(resource)}
                        >
                          <span className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </span>
                        </DropdownItem>
                        <DropdownItem
                          onClick={() =>
                            window.open(resource.resource_url, "_blank")
                          }
                        >
                          <span className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Open URL
                          </span>
                        </DropdownItem>
                        <DropdownItem onClick={() => copyUrl(resource)}>
                          <span className="flex items-center gap-2">
                            {copiedId === resource.id ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {copiedId === resource.id ? "Copied!" : "Copy URL"}
                          </span>
                        </DropdownItem>
                        <DropdownDivider />
                        {showArchived ? (
                          <DropdownItem onClick={() => handleRestore(resource)}>
                            <span className="flex items-center gap-2">
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </span>
                          </DropdownItem>
                        ) : (
                          <DropdownItem
                            onClick={() =>
                              setArchiveModal({
                                isOpen: true,
                                resource,
                                isArchiving: false,
                              })
                            }
                            className="text-muted-foreground"
                          >
                            <span className="flex items-center gap-2">
                              <Archive className="h-4 w-4" />
                              Archive
                            </span>
                          </DropdownItem>
                        )}
                      </Dropdown>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Resource Modal */}
      {editingResource && (
        <ResourceEditModal
          isOpen={!!editingResource}
          onClose={() => setEditingResource(null)}
          resource={{
            id: editingResource.id,
            name: editingResource.name,
            slug: editingResource.slug,
            description: editingResource.description ?? undefined,
            server_slug: editingResource.server?.slug,
            avatar_url: editingResource.avatar_url ?? undefined,
            resource_type: editingResource.resource_type,
            parameters: editingResource.pt_parameters,
            system_prompt: editingResource.pt_system_prompt,
          }}
          onSaved={() => {
            setEditingResource(null);
            fetchResources();
          }}
        />
      )}

      {/* Archive Confirmation Modal */}
      <ArchiveConfirmationModal
        isOpen={archiveModal.isOpen}
        resourceName={archiveModal.resource?.name || ""}
        onClose={() =>
          setArchiveModal({ isOpen: false, resource: null, isArchiving: false })
        }
        onConfirm={handleArchive}
        isArchiving={archiveModal.isArchiving}
      />
    </div>
  );
}
