"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { AnimatedDialog, AnimatedDialogContent } from "@x402jobs/ui/dialog";
import { Input } from "@x402jobs/ui/input";
import { Button } from "@x402jobs/ui/button";
import { Search, Box, Layers, Server, Loader2, Plus } from "lucide-react";
import { publicFetcher } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { ChainIcon } from "@/components/icons/ChainIcons";

interface Resource {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  server_slug?: string;
  server_id?: string;
  avatar_url?: string;
  server?: {
    id?: string;
    name?: string;
    slug?: string;
    favicon_url?: string;
  };
  output_schema?: {
    input?: {
      method?: string;
      bodyFields?: Record<string, unknown>;
      queryParams?: Record<string, unknown>;
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

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional callback to add a resource to the canvas. When provided, shows Add button on resources. */
  onAddResource?: (resource: Resource) => void;
  /** Filter resources by network (e.g., when on canvas with a specific network job) */
  filterNetwork?: string;
}

interface Job {
  id: string;
  name: string;
  description?: string;
  network: string;
  owner_username?: string;
  estimated_price?: number;
}

interface ServerItem {
  id: string;
  slug?: string;
  name: string;
  origin_url: string;
  resource_count: number;
  favicon_url?: string;
}

type SearchResult =
  | { type: "resource"; data: Resource }
  | { type: "job"; data: Job }
  | { type: "server"; data: ServerItem };

export function SearchModal({
  isOpen,
  onClose,
  onAddResource,
  filterNetwork,
}: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  // Build query params for server-side search
  const resourcesQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (debouncedQuery.trim()) {
      params.set("search", debouncedQuery.trim());
    }
    if (filterNetwork) {
      params.set("network", filterNetwork);
    }
    return params.toString();
  }, [debouncedQuery, filterNetwork]);

  const jobsQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (debouncedQuery.trim()) {
      params.set("search", debouncedQuery.trim());
    }
    return params.toString();
  }, [debouncedQuery]);

  // Fetch data with server-side search
  const { data: resourcesData, isLoading: resourcesLoading } = useSWR<{
    resources: Resource[];
  }>(
    isOpen && debouncedQuery.trim()
      ? `/api/v1/resources?${resourcesQueryParams}`
      : null,
    publicFetcher,
  );
  const { data: jobsData, isLoading: jobsLoading } = useSWR<{ jobs: Job[] }>(
    isOpen && debouncedQuery.trim() && !onAddResource
      ? `/jobs/public?${jobsQueryParams}`
      : null,
    publicFetcher,
  );
  const { data: serversData, isLoading: serversLoading } = useSWR<{
    servers: ServerItem[];
  }>(
    isOpen && debouncedQuery.trim() && !onAddResource ? "/servers" : null,
    publicFetcher,
  );

  const isLoading = resourcesLoading || jobsLoading || serversLoading;

  // Build results from server-side searched data
  const results = useMemo((): SearchResult[] => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return [];

    const allResults: SearchResult[] = [];

    // Resources are already filtered server-side
    (resourcesData?.resources || []).forEach((r) => {
      allResults.push({ type: "resource", data: r });
    });

    // Jobs are already filtered server-side
    if (!onAddResource) {
      (jobsData?.jobs || []).forEach((j) => {
        allResults.push({ type: "job", data: j });
      });

      // Servers need client-side filtering (API doesn't support search param)
      (serversData?.servers || []).forEach((s) => {
        const searchText =
          `${s.name} ${s.slug || ""} ${s.origin_url}`.toLowerCase();
        if (searchText.includes(q)) {
          allResults.push({ type: "server", data: s });
        }
      });
    }

    return allResults.slice(0, 30); // Limit total results
  }, [debouncedQuery, resourcesData, jobsData, serversData, onAddResource]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      let path = "";
      if (result.type === "resource") {
        const r = result.data;
        path = `/resources/${r.server_slug}/${r.slug}`;
      } else if (result.type === "job") {
        path = `/jobs/${result.data.id}`;
      } else if (result.type === "server") {
        path = `/servers/${result.data.slug}`;
      }

      // Close first, then navigate
      onClose();
      if (path) {
        // Small delay to let the modal close animation start
        setTimeout(() => {
          router.push(path);
        }, 50);
      }
    },
    [onClose, router],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const selected = results[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, selectedIndex, handleSelect, onClose],
  );

  const getResultImage = (result: SearchResult): string | null => {
    switch (result.type) {
      case "resource": {
        const r = result.data;
        return r.avatar_url || r.server?.favicon_url || null;
      }
      case "server":
        return result.data.favicon_url || null;
      case "job":
        return null;
    }
  };

  const getResultFallbackIcon = (result: SearchResult) => {
    switch (result.type) {
      case "resource":
        return <Box className="w-4 h-4 text-resource" />;
      case "job":
        return <Layers className="w-4 h-4 text-resource" />;
      case "server":
        return <Server className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getResultTitle = (result: SearchResult): string => {
    switch (result.type) {
      case "resource": {
        const r = result.data;
        return r.server_slug && r.slug ? `${r.server_slug}/${r.slug}` : r.name;
      }
      case "job": {
        const j = result.data;
        const slug = j.name.toLowerCase().replace(/\s+/g, "-");
        return j.owner_username ? `@${j.owner_username}/${slug}` : slug;
      }
      case "server":
        return result.data.slug || result.data.name;
    }
  };

  const getResultSubtitle = (result: SearchResult): string => {
    switch (result.type) {
      case "resource":
        return result.data.description || "Resource";
      case "job":
        return result.data.description || "Job";
      case "server":
        return `${result.data.resource_count} resources`;
    }
  };

  return (
    <AnimatedDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatedDialogContent
        className="max-w-xl p-0 gap-0 overflow-hidden"
        showClose={false}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search resources, jobs, servers..."
            className="border-0 focus-visible:ring-0 px-0 text-base"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query && results.length === 0 && !isLoading && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {!query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Start typing to search...
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => {
                const imageUrl = getResultImage(result);
                return (
                  <button
                    key={`${result.type}-${result.data.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      index === selectedIndex
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (
                            e.target as HTMLImageElement
                          ).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 ${imageUrl ? "hidden" : ""}`}
                    >
                      {getResultFallbackIcon(result)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium font-mono text-sm truncate">
                        {getResultTitle(result)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getResultSubtitle(result)}
                      </p>
                    </div>
                    {result.type === "resource" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <ChainIcon
                          network={result.data.network}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatPrice(result.data.max_amount_required)}
                        </span>
                        {onAddResource && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddResource(result.data);
                              onClose();
                            }}
                            title="Add to canvas"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    {result.type === "job" &&
                      result.data.estimated_price !== undefined && (
                        <div className="flex items-center gap-2 shrink-0">
                          <ChainIcon
                            network={result.data.network}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-xs font-mono text-muted-foreground">
                            {formatPrice(
                              result.data.estimated_price.toString(),
                            )}
                          </span>
                        </div>
                      )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                ↵
              </kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                esc
              </kbd>
              close
            </span>
          </div>
        </div>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
