import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { Search, X } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";

export interface ModelFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  modality: string;
  onModalityChange: (value: string) => void;
  provider: string;
  onProviderChange: (value: string) => void;
  priceRange: string | null;
  onPriceRangeChange: (value: string | null) => void;
  providers: string[]; // List of unique providers for dropdown
  onClearFilters: () => void;
}

export function ModelFilters({
  search,
  onSearchChange,
  modality,
  onModalityChange,
  provider,
  onProviderChange,
  priceRange,
  onPriceRangeChange,
  providers,
  onClearFilters,
}: ModelFiltersProps) {
  // Calculate active filter count (excluding search)
  const activeFilterCount =
    (modality !== "all" ? 1 : 0) +
    (provider !== "all" ? 1 : 0) +
    (priceRange !== null ? 1 : 0);

  const hasActiveFilters = search.length > 0 || activeFilterCount > 0;

  // Modality options
  const modalityOptions = [
    { value: "all", label: "All Types" },
    { value: "text", label: "Text" },
    { value: "image", label: "Image" },
    { value: "video", label: "Video" },
    { value: "audio", label: "Audio" },
    { value: "multimodal", label: "Multimodal" },
  ];

  // Provider options (dynamic from models)
  const providerOptions = [
    { value: "all", label: "All Providers" },
    ...providers.map((p) => ({ value: p, label: p })),
  ];

  // Price range options
  const priceOptions = [
    { value: "all", label: "All Prices" },
    { value: "free", label: "Free" },
    { value: "budget", label: "Budget ($0-1/1M)" },
    { value: "standard", label: "Standard ($1-5/1M)" },
    { value: "premium", label: "Premium ($5+/1M)" },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6 py-1">
      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Modality dropdown */}
      <Select
        value={modality}
        onChange={onModalityChange}
        options={modalityOptions}
        className="w-full sm:w-[160px]"
      />

      {/* Provider dropdown */}
      <Select
        value={provider}
        onChange={onProviderChange}
        options={providerOptions}
        className="w-full sm:w-[180px]"
      />

      {/* Price range dropdown */}
      <Select
        value={priceRange || "all"}
        onChange={(value) => onPriceRangeChange(value === "all" ? null : value)}
        options={priceOptions}
        className="w-full sm:w-[200px]"
      />

      {/* Active filter badge with clear all button */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
            "bg-primary/10 text-primary hover:bg-primary/20 transition-colors",
          )}
        >
          <span>{activeFilterCount + (search ? 1 : 0)} active</span>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
