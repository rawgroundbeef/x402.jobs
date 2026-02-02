import { AIModel } from "@/hooks/useAIModelsQuery";
import { ProviderIcon } from "@/components/icons/ProviderIcons";
import { formatContextLength, formatTokenPrice } from "@/lib/format";
import { Type, Image, Video, Volume2, Star } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";

interface ModelCardProps {
  model: AIModel;
  onSelect?: (model: AIModel) => void;
  isSelected?: boolean;
  showCuratedBadge?: boolean;
}

export function ModelCard({
  model,
  onSelect,
  isSelected = false,
  showCuratedBadge = false,
}: ModelCardProps) {
  const handleClick = () => {
    onSelect?.(model);
  };

  // Determine modality icons to show
  const modalityIcons: React.ReactNode[] = [];
  if (model.modality === "text") {
    modalityIcons.push(<Type key="text" className="w-4 h-4" />);
  } else if (model.modality === "image") {
    modalityIcons.push(<Image key="image" className="w-4 h-4" />);
  } else if (model.modality === "video") {
    modalityIcons.push(<Video key="video" className="w-4 h-4" />);
  } else if (model.modality === "audio") {
    modalityIcons.push(<Volume2 key="audio" className="w-4 h-4" />);
  } else if (model.modality === "multimodal") {
    modalityIcons.push(
      <Type key="text" className="w-4 h-4" />,
      <Image key="image" className="w-4 h-4" />,
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "p-4 rounded-lg border border-border bg-card hover:bg-accent hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer relative",
        isSelected && "ring-2 ring-primary",
      )}
    >
      {/* Curated badge (top right, only when requested) */}
      {showCuratedBadge && model.is_curated && (
        <div className="absolute top-2 right-2">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        </div>
      )}

      {/* Provider icon + name */}
      <div className="flex items-center gap-2 mb-2">
        <ProviderIcon provider={model.provider} className="w-5 h-5" />
        <span className="text-sm text-muted-foreground">{model.provider}</span>
      </div>

      {/* Model name */}
      <h3 className="text-base font-semibold mb-1">{model.display_name}</h3>

      {/* Description (truncated to 2 lines) */}
      {model.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {model.description}
        </p>
      )}

      {/* Modality icons row */}
      {modalityIcons.length > 0 && (
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          {modalityIcons}
        </div>
      )}

      {/* Context length badge */}
      <div className="mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
          {formatContextLength(model.context_length)} context
        </span>
      </div>

      {/* Pricing row */}
      <div className="text-xs text-muted-foreground">
        <span>In: {formatTokenPrice(model.pricing_prompt)}/1M</span>
        <span className="mx-1">|</span>
        <span>Out: {formatTokenPrice(model.pricing_completion)}/1M</span>
      </div>
    </div>
  );
}
