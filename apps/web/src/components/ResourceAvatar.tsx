"use client";

import { Box } from "lucide-react";

interface ResourceAvatarProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-16 h-16",
};

const iconSizes = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-8 h-8",
};

export function ResourceAvatar({
  src,
  alt = "",
  size = "md",
  className = "",
}: ResourceAvatarProps) {
  const sizeClass = sizeClasses[size];
  const iconSize = iconSizes[size];

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-xl object-contain bg-muted ${className}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl bg-muted flex items-center justify-center ${className}`}
    >
      <Box className={`${iconSize} text-muted-foreground`} />
    </div>
  );
}
