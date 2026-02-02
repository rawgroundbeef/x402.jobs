"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAIModelsQuery, AIModel } from "@/hooks/useAIModelsQuery";
import { ModelCard } from "./ModelCard";
import { ModelFilters } from "./ModelFilters";
import { Pagination } from "./Pagination";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@x402jobs/ui/tabs";
import { Button } from "@x402jobs/ui/button";
import { Box } from "lucide-react";

export interface ModelBrowserProps {
  onSelect?: (model: AIModel) => void;
  selectedModelId?: string;
}

const ITEMS_PER_PAGE = 20;

export function ModelBrowser({ onSelect, selectedModelId }: ModelBrowserProps) {
  const { models, isLoading, error } = useAIModelsQuery();

  // State
  const [activeTab, setActiveTab] = useState<"popular" | "all">("popular");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modality, setModality] = useState<string>("all");
  const [provider, setProvider] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Reset to first page when filters change
  const handleModalityChange = useCallback((value: string) => {
    setModality(value);
    setCurrentPage(0);
  }, []);

  const handleProviderChange = useCallback((value: string) => {
    setProvider(value);
    setCurrentPage(0);
  }, []);

  const handlePriceRangeChange = useCallback((value: string | null) => {
    setPriceRange(value);
    setCurrentPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setModality("all");
    setProvider("all");
    setPriceRange(null);
    setCurrentPage(0);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as "popular" | "all");
    setCurrentPage(0);
  }, []);

  // Extract unique providers from models
  const uniqueProviders = useMemo(() => {
    const providers = new Set<string>();
    models.forEach((model) => providers.add(model.provider));
    return Array.from(providers).sort();
  }, [models]);

  // Apply filtering logic
  const filteredModels = useMemo(() => {
    let filtered = models;

    // Filter by tab (popular = curated)
    if (activeTab === "popular") {
      filtered = filtered.filter((m) => m.is_curated);
    }

    // Filter by search
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((m) =>
        m.display_name.toLowerCase().includes(searchLower),
      );
    }

    // Filter by modality
    if (modality !== "all") {
      filtered = filtered.filter((m) => m.modality === modality);
    }

    // Filter by provider
    if (provider !== "all") {
      filtered = filtered.filter((m) => m.provider === provider);
    }

    // Filter by price range
    if (priceRange) {
      filtered = filtered.filter((m) => {
        const price = parseFloat(m.pricing_completion || "0");
        const perMillion = price * 1000000;

        if (priceRange === "free") {
          return perMillion === 0;
        } else if (priceRange === "budget") {
          return perMillion > 0 && perMillion <= 1;
        } else if (priceRange === "standard") {
          return perMillion > 1 && perMillion <= 5;
        } else if (priceRange === "premium") {
          return perMillion > 5;
        }
        return true;
      });
    }

    return filtered;
  }, [models, activeTab, debouncedSearch, modality, provider, priceRange]);

  // Paginate results
  const paginatedModels = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredModels.slice(start, end);
  }, [filteredModels, currentPage]);

  const totalPages = Math.ceil(filteredModels.length / ITEMS_PER_PAGE);
  const showPagination = activeTab === "all" && totalPages > 1;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load models</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please try again later
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tabs: Popular | All Models */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="all">All Models</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {/* Filters */}
          <ModelFilters
            search={search}
            onSearchChange={setSearch}
            modality={modality}
            onModalityChange={handleModalityChange}
            provider={provider}
            onProviderChange={handleProviderChange}
            priceRange={priceRange}
            onPriceRangeChange={handlePriceRangeChange}
            providers={uniqueProviders}
            onClearFilters={handleClearFilters}
          />

          {/* Empty state */}
          {paginatedModels.length === 0 ? (
            <div className="text-center py-20">
              <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No models match your filters
              </p>
              <Button onClick={handleClearFilters} variant="outline">
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              {/* Grid of model cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    onSelect={onSelect}
                    isSelected={selectedModelId === model.id}
                    showCuratedBadge={activeTab === "all"}
                  />
                ))}
              </div>

              {/* Pagination (only on All tab when needed) */}
              {showPagination && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
