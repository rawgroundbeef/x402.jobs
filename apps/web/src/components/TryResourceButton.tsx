"use client";

import { Button } from "@x402jobs/ui/button";
import { Play } from "lucide-react";
import { useModals, type ModalResource } from "@/contexts/ModalContext";

interface TryResourceButtonProps {
  resource: ModalResource;
  size?: "sm" | "xs";
  className?: string;
}

/**
 * Standardized "Try" button for resources.
 * Opens the resource interaction modal when clicked.
 */
export function TryResourceButton({
  resource,
  size = "sm",
  className,
}: TryResourceButtonProps) {
  const { openResourceModal } = useModals();

  const handleClick = () => {
    openResourceModal(resource);
  };

  if (size === "xs") {
    // Compact version for cards/lists - matches original inline style
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent text-foreground transition-colors border border-border ${className || ""}`}
      >
        <Play className="w-2.5 h-2.5 mr-1" />
        Try
      </button>
    );
  }

  // Default size for detail pages
  return (
    <Button size="sm" onClick={handleClick} className={className}>
      <Play className="w-3 h-3 mr-1" />
      Try It
    </Button>
  );
}
