"use client";

import { EntityAvatar, EntitySize, EntityType } from "./EntityAvatar";

// Re-export types for backwards compatibility
export type AvatarSize = EntitySize;

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  fallbackIcon?: React.ReactNode;
  fallbackClassName?: string;
  className?: string;
  /** Entity type for appropriate fallback icon */
  type?: EntityType;
}

/**
 * Avatar component - wrapper around EntityAvatar for backwards compatibility.
 * For new code, prefer using EntityAvatar directly with explicit type.
 *
 * @example
 * // Old way (still works)
 * <Avatar src={url} size="lg" fallbackIcon={<Box />} />
 *
 * // New way (preferred)
 * <EntityAvatar src={url} type="resource" size="lg" />
 */
export function Avatar({
  src,
  alt = "",
  size = "md",
  fallbackIcon,
  fallbackClassName = "bg-muted",
  className,
  type = "profile",
}: AvatarProps) {
  return (
    <EntityAvatar
      src={src}
      alt={alt}
      size={size}
      type={type}
      fallbackIcon={fallbackIcon}
      fallbackClassName={fallbackClassName}
      className={className}
    />
  );
}

/**
 * @deprecated Use useEntityIconSize from EntityAvatar instead
 */
export function useAvatarIconSize(size: AvatarSize): string {
  const iconSizes: Record<AvatarSize, string> = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
    xl: "w-8 h-8",
    "2xl": "w-10 h-10",
    "3xl": "w-14 h-14",
  };
  return iconSizes[size];
}
