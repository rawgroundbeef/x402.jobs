"use client";

import { useState } from "react";
import { cn } from "@x402jobs/ui/utils";

interface DrawerHeaderAvatarProps {
  src?: string | null;
  alt?: string;
  fallbackIcon: React.ReactNode;
  fallbackClassName?: string;
  className?: string;
}

/**
 * Standardized avatar component for drawer/panel headers.
 * Shows an image if src is provided, otherwise shows a fallback icon.
 */
export function DrawerHeaderAvatar({
  src,
  alt = "",
  fallbackIcon,
  fallbackClassName = "bg-muted",
  className,
}: DrawerHeaderAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when src changes
  if (src && imageError) {
    setImageError(false);
  }

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-16 h-16 rounded-xl object-cover flex-shrink-0",
          className,
        )}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0",
        fallbackClassName,
        className,
      )}
    >
      {fallbackIcon}
    </div>
  );
}
