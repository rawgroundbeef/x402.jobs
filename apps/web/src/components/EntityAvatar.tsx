"use client";

import { useState } from "react";
import { cn } from "@x402jobs/ui/utils";
import { User, Server, Box, Zap, Globe, Bot } from "lucide-react";

export type EntityType =
  | "profile"
  | "server"
  | "resource"
  | "job"
  | "agent"
  | "website";
export type EntitySize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface EntityAvatarProps {
  /** Image URL */
  src?: string | null;
  /** Alt text for accessibility */
  alt?: string;
  /** Type of entity - determines fallback icon */
  type?: EntityType;
  /** Size of the avatar */
  size?: EntitySize;
  /** Additional CSS classes */
  className?: string;
  /** Custom fallback icon (overrides type-based default) */
  fallbackIcon?: React.ReactNode;
  /** Custom fallback background class */
  fallbackClassName?: string;
}

const sizeClasses: Record<EntitySize, string> = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
  "2xl": "w-24 h-24",
  "3xl": "w-32 h-32",
};

const iconSizes: Record<EntitySize, string> = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
  "2xl": "w-10 h-10",
  "3xl": "w-14 h-14",
};

const roundedClasses: Record<EntitySize, string> = {
  xs: "rounded-md",
  sm: "rounded-lg",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

// Icon component for each entity type
const typeIcons: Record<EntityType, typeof User> = {
  profile: User,
  server: Server,
  resource: Box,
  job: Zap,
  agent: Bot,
  website: Globe,
};

// Background colors for each entity type (subtle, themed)
const typeBackgrounds: Record<EntityType, string> = {
  profile: "bg-accent border border-muted-foreground/20",
  server: "bg-accent border border-muted-foreground/20",
  resource: "bg-accent border border-muted-foreground/20",
  job: "bg-accent border border-muted-foreground/20",
  agent: "bg-accent border border-muted-foreground/20",
  website: "bg-accent border border-muted-foreground/20",
};

/**
 * Unified avatar component for all entity types.
 * Automatically shows the appropriate fallback icon based on entity type
 * when no image is provided or when the image fails to load.
 *
 * @example
 * // Profile avatar
 * <EntityAvatar src={user.avatar_url} type="profile" size="lg" />
 *
 * // Server favicon
 * <EntityAvatar src={server.favicon_url} type="server" size="md" />
 *
 * // Resource icon
 * <EntityAvatar src={resource.avatar_url} type="resource" size="xl" />
 *
 * // Job icon
 * <EntityAvatar src={job.avatar_url} type="job" size="sm" />
 */
export function EntityAvatar({
  src,
  alt = "",
  type = "profile",
  size = "md",
  className,
  fallbackIcon,
  fallbackClassName,
}: EntityAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset error state when src changes
  if (src !== prevSrc) {
    setPrevSrc(src);
    setImageError(false);
  }

  const sizeClass = sizeClasses[size];
  const iconSize = iconSizes[size];
  const rounded = roundedClasses[size];
  const IconComponent = typeIcons[type];
  const bgClass = fallbackClassName || typeBackgrounds[type];

  const showImage = src && !imageError;

  if (showImage) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          sizeClass,
          rounded,
          "object-cover flex-shrink-0",
          className,
        )}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        rounded,
        "flex items-center justify-center flex-shrink-0",
        bgClass,
        className,
      )}
    >
      {fallbackIcon || (
        <IconComponent className={cn(iconSize, "text-muted-foreground")} />
      )}
    </div>
  );
}

/**
 * Hook to get the icon size class for a given entity size.
 * Useful when you need to size a custom fallback icon externally.
 */
export function useEntityIconSize(size: EntitySize): string {
  return iconSizes[size];
}

/**
 * Get the default icon component for an entity type.
 * Useful when you need to render the icon outside of EntityAvatar.
 */
export function getEntityIcon(type: EntityType) {
  return typeIcons[type];
}
