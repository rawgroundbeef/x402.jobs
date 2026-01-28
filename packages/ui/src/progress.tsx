"use client";

import * as React from "react";
import { cn } from "./lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  variant?: "default" | "gradient";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      indeterminate = false,
      variant = "default",
      ...props
    },
    ref,
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-muted",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            variant === "gradient"
              ? "animated-gradient-progress"
              : "bg-primary",
            indeterminate && "animate-progress-indeterminate",
          )}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    );
  },
);

Progress.displayName = "Progress";

export { Progress };
