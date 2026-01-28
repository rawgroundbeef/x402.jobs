import * as React from "react";
import { cn } from "./lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional text to display in the center of the divider
   */
  label?: string;
  /**
   * Orientation of the divider
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
}

/**
 * A divider component that can optionally display text in the center
 *
 * @example
 * // Simple divider
 * <Divider />
 *
 * @example
 * // Divider with text
 * <Divider label="or continue with" />
 */
const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, label, orientation = "horizontal", ...props }, ref) => {
    if (orientation === "vertical") {
      return (
        <div
          ref={ref}
          className={cn("shrink-0 bg-border w-[1px]", className)}
          {...props}
        />
      );
    }

    // Horizontal divider without label
    if (!label) {
      return (
        <div
          ref={ref}
          className={cn("shrink-0 bg-border h-[1px] w-full", className)}
          {...props}
        />
      );
    }

    // Horizontal divider with label
    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
    );
  },
);

Divider.displayName = "Divider";

export { Divider };
